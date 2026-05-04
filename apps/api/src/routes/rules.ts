import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, isAdmin } from '../middleware/auth'

const router = Router()

// GET /api/rules
router.get('/', authenticate, async (_req, res) => {
  const rules = await prisma.eligibilityRule.findMany({
    where: { is_active: true },
    orderBy: [{ domain: 'asc' }, { sort_order: 'asc' }],
  })
  res.json({ rules })
})

// GET /api/rules/:id
router.get('/:id', authenticate, async (req, res) => {
  const rule = await prisma.eligibilityRule.findUnique({ where: { id: req.params.id } })
  if (!rule) { res.status(404).json({ error: 'Rule not found' }); return }
  res.json({ rule })
})

// PUT /api/rules/:id  admin only
router.put('/:id', authenticate, isAdmin, async (req, res) => {
  const rule = await prisma.eligibilityRule.update({
    where: { id: req.params.id },
    data: req.body,
  })
  res.json({ rule })
})

export default router
