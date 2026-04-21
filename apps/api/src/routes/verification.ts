import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, isVerifier, isOfficer } from '../middleware/auth'
import { applyVerificationMultiplier } from '../services/scoring/ruleEngine'
import { logStatusChange } from '../services/scoring/statusLog'
import { sendNotification } from '../services/notifications'

const router = Router()

// GET /api/verification/assignments  verifier's list OR officer's full list
router.get('/assignments', authenticate, async (req, res) => {
  const user = req.user!
  // Officers see all assignments for the active program
  if (user.role === 'super_admin') {
    const program = await prisma.scholarshipProgram.findFirst({
      where: { is_active: true }, orderBy: { created_at: 'desc' },
    })
    const assignments = await prisma.verificationAssignment.findMany({
      where: program ? { application: { program_id: program.id } } : {},
      include: {
        application: {
          include: {
            user: { select: { full_name: true, phone: true } },
            program: { select: { program_name: true } },
          },
        },
        verifier: { select: { id: true, full_name: true } },
      },
      orderBy: [{ verification_priority: 'asc' }],
    })
    res.json({ assignments }); return
  }
  if (user.role !== 'verifier') { res.status(403).json({ error: 'Forbidden' }); return }
  const assignments = await prisma.verificationAssignment.findMany({
    where: { verifier_id: req.user!.userId, status: { in: ['pending', 'in_progress'] } },
    include: {
      application: {
        include: {
          user: { select: { full_name: true, phone: true } },
          program: { select: { program_name: true } },
        },
      },
    },
    orderBy: [{ verification_priority: 'asc' }, { assigned_at: 'asc' }],
  })
  res.json({ assignments })
})

// GET /api/verification/assignments/:id
router.get('/assignments/:id', authenticate, isVerifier, async (req, res) => {
  const assignment = await prisma.verificationAssignment.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      application: {
        include: {
          user: {
            select: { full_name: true, email: true, phone: true },
          },
          program: true,
        },
      },
      field_reports: true,
    },
  })
  if (assignment.verifier_id !== req.user!.userId) {
    res.status(403).json({ error: 'Not assigned to you' }); return
  }

  // Load student profile tables for declared-vs-observed comparison
  const userId = assignment.application.user_id
  const [housing, financial, assets, family, personal] = await Promise.all([
    prisma.studentHousing.findUnique({ where: { user_id: userId } }),
    prisma.studentFinancial.findUnique({ where: { user_id: userId } }),
    prisma.studentAssets.findUnique({ where: { user_id: userId } }),
    prisma.studentFamily.findUnique({ where: { user_id: userId } }),
    prisma.studentPersonal.findUnique({ where: { user_id: userId } }),
  ])

  res.json({ assignment, declared: { housing, financial, assets, family, personal } })
})

// POST /api/verification/assignments/:id/report  submit 9-section form
router.post('/assignments/:id/report', authenticate, isVerifier, async (req, res) => {
  const assignment = await prisma.verificationAssignment.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { application: true },
  })
  if (assignment.verifier_id !== req.user!.userId) {
    res.status(403).json({ error: 'Not assigned to you' }); return
  }

  const b = req.body

  // Load declared student data for comparison
  const userId = assignment.application.user_id
  const [housing, financial, assets] = await Promise.all([
    prisma.studentHousing.findUnique({ where: { user_id: userId } }),
    prisma.studentFinancial.findUnique({ where: { user_id: userId } }),
    prisma.studentAssets.findUnique({ where: { user_id: userId } }),
  ])

  // Declared values (normalised to match observed types)
  const decl = {
    hasElectricity:  housing?.has_electricity     ?? false,
    hasPipedWater:   housing?.has_piped_water      ?? false,
    hasToilet:       housing?.has_toilet           ?? false,
    hasLpg:          housing?.has_lpg ?? false,
    houseType:       housing?.house_type           ?? null,
    ownershipType:   housing?.ownership_type       ?? null,
    hasCar:          Number(assets?.car_value      ?? 0) > 0,
    vehicleCount:    Number(assets?.vehicle_count  ?? 0),
    hasGold:         Number(financial?.gold_value_inr    ?? 0) > 0,
    hasElectronics:  Number(assets?.electronics_value    ?? 0) > 0,
    hasLand:         Number(assets?.land_area_acres      ?? 0) > 0,
    hasFD:           Number(financial?.fixed_deposit_amount ?? 0) > 0,
  }

  // Comparison: each field is a MATCH (1) or MISMATCH (0)
  // For fields with no declared equivalent, "observed true = match" (verifier confirmed presence)
  const comparisons: { field: string; match: boolean }[] = [
    // Section A — Identity: no declared equivalent; true = confirmed
    { field: 'sec_a_identity_match',      match: b.sec_a_identity_match === true },

    // Section B — Housing: compare against declared house_type and ownership_type
    { field: 'sec_b_housing_type',        match: !b.sec_b_housing_type_confirmed || b.sec_b_housing_type_confirmed === decl.houseType },
    { field: 'sec_b_ownership',           match: !b.sec_b_ownership_confirmed    || b.sec_b_ownership_confirmed    === decl.ownershipType },

    // Section C — Utilities: match = observed equals declared
    { field: 'sec_c_electricity',         match: (b.sec_c_electricity === true)  === decl.hasElectricity },
    { field: 'sec_c_water',               match: (b.sec_c_water       === true)  === decl.hasPipedWater },
    { field: 'sec_c_toilet',              match: (b.sec_c_toilet      === true)  === decl.hasToilet },
    { field: 'sec_c_lpg',                 match: (b.sec_c_lpg         === true)  === decl.hasLpg },

    // Section D — Income/occupation: verifier confirms docs; true = match
    { field: 'sec_d_income_doc_present',  match: b.sec_d_income_doc_present  === true },
    { field: 'sec_d_occupation_matches',  match: b.sec_d_occupation_matches  === true },

    // Section E — Vehicles/assets: compare against declared
    { field: 'sec_e_car_present',         match: (b.sec_e_car_present  === true) === decl.hasCar },
    { field: 'sec_e_vehicle_count',       match: Math.abs(Number(b.sec_e_vehicle_count_confirmed ?? 0) - decl.vehicleCount) <= 1 },
    { field: 'sec_e_gold_visible',        match: (b.sec_e_gold_visible === true) === decl.hasGold },

    // Section F — Electronics: compare against declared
    { field: 'sec_f_electronics_present', match: (b.sec_f_electronics_present === true) === decl.hasElectronics },

    // Section G — Land: compare against declared
    { field: 'sec_g_land_present',        match: (b.sec_g_land_present === true) === decl.hasLand },

    // Section H — Financial assets: compare against declared
    { field: 'sec_h_fd_docs_visible',     match: (b.sec_h_fd_docs_visible  === true) === decl.hasFD },
    { field: 'sec_h_savings_visible',     match: b.sec_h_savings_visible === true },

    // Section I — Documents: verifier confirms; true = match
    { field: 'sec_i_all_docs_present',    match: b.sec_i_all_docs_present === true },
  ]

  const yes_count    = comparisons.filter(c => c.match).length
  const total_fields = comparisons.length
  const match_score  = Math.round((yes_count / total_fields) * 100 * 100) / 100

  // Explicitly map only known DB fields (avoids blind spread of unknown keys)
  await prisma.verifierFieldReport.create({
    data: {
      assignment_id:                req.params.id,
      verifier_id:                  req.user!.userId,
      gps_latitude:                 b.gps_latitude  ?? null,
      gps_longitude:                b.gps_longitude ?? null,
      sec_a_identity_match:         b.sec_a_identity_match         ?? null,
      sec_b_housing_type_confirmed: b.sec_b_housing_type_confirmed || null,
      sec_b_ownership_confirmed:    b.sec_b_ownership_confirmed    || null,
      sec_c_electricity:            b.sec_c_electricity            ?? null,
      sec_c_water:                  b.sec_c_water                  ?? null,
      sec_c_toilet:                 b.sec_c_toilet                 ?? null,
      sec_c_lpg:                    b.sec_c_lpg                    ?? null,
      sec_d_income_doc_present:     b.sec_d_income_doc_present     ?? null,
      sec_d_occupation_matches:     b.sec_d_occupation_matches     ?? null,
      sec_e_car_present:            b.sec_e_car_present            ?? null,
      sec_e_vehicle_count_confirmed: b.sec_e_vehicle_count_confirmed != null ? Number(b.sec_e_vehicle_count_confirmed) : null,
      sec_e_gold_visible:           b.sec_e_gold_visible           ?? null,
      sec_f_electronics_present:    b.sec_f_electronics_present    ?? null,
      sec_g_land_present:           b.sec_g_land_present           ?? null,
      sec_h_fd_docs_visible:        b.sec_h_fd_docs_visible        ?? null,
      sec_h_savings_visible:        b.sec_h_savings_visible        ?? null,
      sec_i_all_docs_present:       b.sec_i_all_docs_present       ?? null,
      yes_count,
      total_fields,
      match_score,
      ...(b.verifier_notes ? { verifier_notes: String(b.verifier_notes) } : {}),
    },
  })

  await prisma.verificationAssignment.update({
    where: { id: req.params.id },
    data: { status: 'complete', completed_at: new Date() },
  })

  // Apply verification multiplier to composite
  await applyVerificationMultiplier(assignment.application_id, assignment.application.program_id)
  await logStatusChange(assignment.application_id, 'verification_pending', 'verification_complete',
    req.user!.userId, `Match score: ${match_score}%`)

  res.json({ message: 'Field report submitted', match_score })
})

// POST /api/verification/assign  accepts { verifier_id, application_id } or { verifier_id, application_ids[] }
router.post('/assign', authenticate, isOfficer, async (req, res) => {
  const { application_ids, application_id, verifier_id } = req.body
  // Normalize to array
  const ids: string[] = application_ids ?? (application_id ? [application_id] : [])
  if (!ids.length) { res.status(400).json({ error: 'No application IDs provided' }); return }

  // Compute priority score for each application
  const assignments = await Promise.all(
    ids.map(async (applicationId: string) => {
      const app = await prisma.application.findUniqueOrThrow({
        where: { id: applicationId },
        select: { anomaly_score: true, composite_score: true },
      })
      const priority_score =
        Number(app.anomaly_score ?? 0) * 0.6 +
        (Number(app.composite_score ?? 0) / 100) * 0.4

      return prisma.verificationAssignment.create({
        data: { application_id: applicationId, verifier_id, priority_score },
      })
    })
  )

  // Rank by priority_score desc (highest priority = lowest rank number = verified first)
  const ranked = await prisma.verificationAssignment.findMany({
    where: { id: { in: assignments.map(a => a.id) } },
    orderBy: { priority_score: 'desc' },
  })
  await Promise.all(
    ranked.map((a, i) =>
      prisma.verificationAssignment.update({
        where: { id: a.id },
        data: { verification_priority: i + 1 },
      })
    )
  )

  res.json({ message: `${assignments.length} assignments created` })
})

async function getVerifierReports(req: any, res: any) {
  const reports = await prisma.verifierFieldReport.findMany({
    where: { verifier_id: req.user!.userId },
    include: {
      assignment: {
        include: {
          application: {
            include: {
              user:    { select: { full_name: true } },
              program: { select: { program_name: true } },
            },
          },
        },
      },
    },
    orderBy: { submitted_at: 'desc' },
    take: 50,
  })
  res.json({ reports })
}

// GET /api/verification/my-reports  alias used by verifier history page
router.get('/my-reports', authenticate, isVerifier, getVerifierReports)

// GET /api/verification/history
router.get('/history',    authenticate, isVerifier, getVerifierReports)

export default router
