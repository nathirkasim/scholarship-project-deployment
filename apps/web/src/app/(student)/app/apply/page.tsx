'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertCircle, Upload, RefreshCw, ChevronLeft, ChevronRight, Save, Send } from 'lucide-react'

const STEPS = [
  { label: 'Personal Details',   desc: 'Name, Aadhaar, category, contact information' },
  { label: 'Academic Details',   desc: 'Institution, course, marks and arrears' },
  { label: 'Family Details',     desc: 'Family composition, parent and guardian status' },
  { label: 'Income & Finance',   desc: 'Annual household income, occupations, loans' },
  { label: 'Property & Assets',  desc: 'Land, vehicles, jewellery and valuables' },
  { label: 'Housing Details',    desc: 'House type, utilities and residential area' },
  { label: 'Govt. Benefits',     desc: 'Government schemes and ration card status' },
  { label: 'Upload Documents',   desc: 'Mandatory certificates and supporting proofs' },
  { label: 'Declaration',        desc: 'Read, verify and sign the solemn declaration' },
]

const TOTAL = STEPS.length

/*  Shared form primitives  */

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
    </div>
  )
}

const inp = 'w-full px-3 py-2 border border-gray-400 rounded text-sm focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700 bg-white'
const sel = 'w-full px-3 py-2 border border-gray-400 rounded text-sm focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700 bg-white'

function YN({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value || 'false'} onChange={e => onChange(e.target.value)} className={sel}>
      <option value="false">No</option>
      <option value="true">Yes</option>
    </select>
  )
}

/*  Step 1  Personal Details  */
function Step1({ data, set }: { data: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      <Field label="Full Name (as per Aadhaar)" required>
        <input className={inp} placeholder="Enter full legal name" value={data.full_name || ''} onChange={e => set('full_name', e.target.value)} />
      </Field>
      <Field label="Date of Birth" required>
        <input type="date" className={inp} value={data.dob || ''} onChange={e => set('dob', e.target.value)} />
      </Field>
      <Field label="Gender" required>
        <select className={sel} value={data.gender || ''} onChange={e => set('gender', e.target.value)}>
          <option value="">-- Select --</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other / Prefer not to say</option>
        </select>
      </Field>
      <Field label="Mobile Number" required hint="10-digit mobile number linked to Aadhaar">
        <input className={inp} placeholder="9XXXXXXXXX" maxLength={10} value={data.phone || ''} onChange={e => set('phone', e.target.value)} />
      </Field>
      <Field label="Aadhaar Number" required hint="12-digit Aadhaar (will be masked in records)">
        <input className={inp} placeholder="XXXX XXXX XXXX" maxLength={12} value={data.aadhaar_number || ''} onChange={e => set('aadhaar_number', e.target.value)} />
      </Field>
      <Field label="Caste Category" required>
        <select className={sel} value={data.caste_category || ''} onChange={e => set('caste_category', e.target.value)}>
          <option value="">-- Select --</option>
          <option value="SC">SC  Scheduled Caste</option>
          <option value="ST">ST  Scheduled Tribe</option>
          <option value="OBC">OBC  Other Backward Class</option>
          <option value="NT">NT  Nomadic / De-notified Tribe</option>
          <option value="General">General (Open Category)</option>
        </select>
      </Field>
      <Field label="Religious Minority Status" hint="As per National Commission for Minorities Act, 1992">
        <YN value={data.religion_minority_status} onChange={v => set('religion_minority_status', v)} />
      </Field>
      <Field label="Enrollment Status" required>
        <select className={sel} value={data.enrollment_status || ''} onChange={e => set('enrollment_status', e.target.value)}>
          <option value="">-- Select --</option>
          <option value="active">Active  Currently Attending Classes</option>
          <option value="inactive">Inactive  Temporarily Discontinued</option>
          <option value="on_leave">On Authorised Leave</option>
        </select>
      </Field>
      <Field label="Differently Abled (PwD)?">
        <YN value={data.is_differently_abled} onChange={v => set('is_differently_abled', v)} />
      </Field>
      <Field label="State" required>
        <input className={inp} placeholder="State of domicile" value={data.state || ''} onChange={e => set('state', e.target.value)} />
      </Field>
      <Field label="District" required>
        <input className={inp} placeholder="District" value={data.district || ''} onChange={e => set('district', e.target.value)} />
      </Field>
      <Field label="Pincode" required>
        <input className={inp} placeholder="6-digit PIN code" maxLength={6} value={data.pincode || ''} onChange={e => set('pincode', e.target.value)} />
      </Field>
    </div>
  )
}

/*  Step 2  Academic Details  */
function Step2({ data, set }: { data: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      <Field label="Institution / College Name" required>
        <input className={inp} placeholder="Full name of college or university" value={data.institution_name || ''} onChange={e => set('institution_name', e.target.value)} />
      </Field>
      <Field label="Course Name" required hint="e.g. B.E. Computer Science, B.Sc. Physics">
        <input className={inp} placeholder="Full name of course" value={data.course_name || ''} onChange={e => set('course_name', e.target.value)} />
      </Field>
      <Field label="Course Type" required>
        <select className={sel} value={data.course_type || ''} onChange={e => set('course_type', e.target.value)}>
          <option value="">-- Select --</option>
          <option value="engineering">Engineering / Technology (B.E. / B.Tech.)</option>
          <option value="medicine">Medicine / Pharmacy (MBBS / B.Pharm. / B.D.S.)</option>
          <option value="law">Law (LL.B. / B.L.)</option>
          <option value="arts_science">Arts / Science / Commerce (B.A. / B.Sc. / B.Com.)</option>
          <option value="management">Management (B.B.A. / B.M.S. / B.H.M.)</option>
          <option value="other">Other UG Programme</option>
        </select>
      </Field>
      <Field label="Mode of Study" required>
        <select className={sel} value={data.study_mode || ''} onChange={e => set('study_mode', e.target.value)}>
          <option value="">-- Select --</option>
          <option value="full_time">Full Time (Regular)</option>
          <option value="part_time">Part Time</option>
          <option value="distance">Distance / Correspondence</option>
        </select>
      </Field>
      <Field label="Current Year of Study" required>
        <select className={sel} value={data.year_of_study || ''} onChange={e => set('year_of_study', e.target.value)}>
          <option value="">-- Select --</option>
          {['1','2','3','4','5'].map(y => <option key={y} value={y}>Year {y}</option>)}
        </select>
      </Field>
      <Field label="HSC / 12th Board Percentage" required hint="Enter percentage obtained (not CGPA)">
        <input type="number" className={inp} min="0" max="100" step="0.01" placeholder="e.g. 78.50" value={data.hsc_percentage || ''} onChange={e => set('hsc_percentage', e.target.value)} />
      </Field>
      <Field label="UG Aggregate Percentage" hint="Leave blank if first year student">
        <input type="number" className={inp} min="0" max="100" step="0.01" placeholder="e.g. 72.30" value={data.ug_aggregate_pct || ''} onChange={e => set('ug_aggregate_pct', e.target.value)} />
      </Field>
      <Field label="No. of Failed / Pending Subjects" required hint="Enter 0 if no backlogs">
        <input type="number" className={inp} min="0" max="20" placeholder="0" value={data.active_arrears || ''} onChange={e => set('active_arrears', e.target.value)} />
      </Field>
      <Field label="First Generation Graduate?" hint="Neither parent holds a graduate degree">
        <YN value={data.is_first_graduate} onChange={v => set('is_first_graduate', v)} />
      </Field>
      <Field label="Currently Receiving Another Scholarship?">
        <YN value={data.receiving_other_scholarship} onChange={v => set('receiving_other_scholarship', v)} />
      </Field>
      <Field label="Previously Awarded This Scholarship?" hint="From this Trust in any prior year">
        <YN value={data.prev_awarded_by_trust} onChange={v => set('prev_awarded_by_trust', v)} />
      </Field>
    </div>
  )
}

/*  Step 3  Family Details  */
function Step3({ data, set }: { data: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      <Field label="Father's Status" required>
        <select className={sel} value={data.father_status || ''} onChange={e => set('father_status', e.target.value)}>
          <option value="">-- Select --</option>
          <option value="alive">Alive</option>
          <option value="deceased">Deceased</option>
        </select>
      </Field>
      <Field label="Mother's Status" required>
        <select className={sel} value={data.mother_status || ''} onChange={e => set('mother_status', e.target.value)}>
          <option value="">-- Select --</option>
          <option value="alive">Alive</option>
          <option value="deceased">Deceased</option>
        </select>
      </Field>
      <Field label="Single Parent Family?" required>
        <YN value={data.is_single_parent} onChange={v => set('is_single_parent', v)} />
      </Field>
      <Field label="Mother Receiving Widow Pension?">
        <YN value={data.mother_widow_pension} onChange={v => set('mother_widow_pension', v)} />
      </Field>
      <Field label="Total Family Members" required hint="Including applicant">
        <input type="number" className={inp} min="1" max="20" value={data.family_size || ''} onChange={e => set('family_size', e.target.value)} />
      </Field>
      <Field label="Number of Dependents" required hint="Members dependent on family income">
        <input type="number" className={inp} min="0" max="15" value={data.dependents || ''} onChange={e => set('dependents', e.target.value)} />
      </Field>
      <Field label="Earning Members in Family" required>
        <input type="number" className={inp} min="0" max="10" value={data.earning_members || ''} onChange={e => set('earning_members', e.target.value)} />
      </Field>
      <Field label="Siblings Currently in Education">
        <input type="number" className={inp} min="0" max="10" placeholder="0" value={data.siblings_in_education || ''} onChange={e => set('siblings_in_education', e.target.value)} />
      </Field>
      <Field label="Chronic / Serious Illness in Family?">
        <YN value={data.has_chronic_illness} onChange={v => set('has_chronic_illness', v)} />
      </Field>
      <Field label="Guardian's Annual Income ()" hint="Applicable only if both parents are deceased">
        <input type="number" className={inp} min="0" placeholder="0 if not applicable" value={data.guardian_annual_income || ''} onChange={e => set('guardian_annual_income', e.target.value)} />
      </Field>
    </div>
  )
}

/*  Step 4  Income & Finance  */
function Step4({ data, set }: { data: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      <Field label="Total Annual Household Income ()" required hint="Combined income of all earning members">
        <input type="number" className={inp} min="0" placeholder="e.g. 180000" value={data.total_annual_income || ''} onChange={e => set('total_annual_income', e.target.value)} />
      </Field>
      <Field label="Father's Occupation">
        <select className={sel} value={data.father_occupation || ''} onChange={e => set('father_occupation', e.target.value)}>
          <option value="">-- Select --</option>
          <option value="salaried_govt">Salaried  Government</option>
          <option value="salaried_private">Salaried  Private</option>
          <option value="self_employed">Self Employed / Business</option>
          <option value="farmer">Farmer / Agricultural</option>
          <option value="daily_wage">Daily Wage / Labour</option>
          <option value="unemployed">Unemployed</option>
          <option value="deceased">Deceased</option>
        </select>
      </Field>
      <Field label="Mother's Occupation">
        <select className={sel} value={data.mother_occupation || ''} onChange={e => set('mother_occupation', e.target.value)}>
          <option value="">-- Select --</option>
          <option value="salaried_govt">Salaried  Government</option>
          <option value="salaried_private">Salaried  Private</option>
          <option value="self_employed">Self Employed / Business</option>
          <option value="homemaker">Homemaker</option>
          <option value="daily_wage">Daily Wage / Labour</option>
          <option value="unemployed">Unemployed</option>
          <option value="deceased">Deceased</option>
        </select>
      </Field>
      <Field label="Outstanding Loan Amount ()" hint="Education or personal loans  enter 0 if none">
        <input type="number" className={inp} min="0" placeholder="0" value={data.loan_outstanding || ''} onChange={e => set('loan_outstanding', e.target.value)} />
      </Field>
      <Field label="Gold / Jewellery Value ()" hint="Approximate current market value of gold held by family">
        <input type="number" className={inp} min="0" placeholder="Approximate value in " value={data.gold_value_inr || ''} onChange={e => set('gold_value_inr', e.target.value)} />
      </Field>
      <Field label="Fixed Deposit / Bank Savings ()" hint="Total of all FDs, RDs and savings accounts">
        <input type="number" className={inp} min="0" placeholder="0" value={data.fixed_deposit_amount || ''} onChange={e => set('fixed_deposit_amount', e.target.value)} />
      </Field>
      <Field label="Ration Card Type">
        <select className={sel} value={data.ration_card_type || 'none'} onChange={e => set('ration_card_type', e.target.value)}>
          <option value="none">No ration card / Not applicable</option>
          <option value="AAY">AAY  Antyodaya Anna Yojana (poorest category)</option>
          <option value="BPL">BPL  Below Poverty Line</option>
          <option value="OPH">OPH  Other Priority Household (APL)</option>
        </select>
      </Field>
    </div>
  )
}

/*  Step 5  Property & Assets  */
function Step5({ data, set }: { data: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      <Field label="Total Asset Value ()" required hint="Approximate combined value of all family assets">
        <input type="number" className={inp} min="0" placeholder="e.g. 250000" value={data.total_asset_value || ''} onChange={e => set('total_asset_value', e.target.value)} />
      </Field>
      <Field label="Four-Wheeler Vehicle Value ()" hint="Car, jeep, van  enter 0 if not owned">
        <input type="number" className={inp} min="0" placeholder="0" value={data.car_value || ''} onChange={e => set('car_value', e.target.value)} />
      </Field>
      <Field label="Total Vehicles Owned" hint="Include two-wheelers, cars, tractors etc.">
        <input type="number" className={inp} min="0" max="20" placeholder="0" value={data.vehicle_count || ''} onChange={e => set('vehicle_count', e.target.value)} />
      </Field>
      <Field label="Electronics Value ()" hint="TV, refrigerator, washing machine, AC  approximate total">
        <input type="number" className={inp} min="0" placeholder="0" value={data.electronics_value || ''} onChange={e => set('electronics_value', e.target.value)} />
      </Field>
      <Field label="Agricultural Land Owned (acres)" hint="Enter 0 if no land holding">
        <input type="number" className={inp} min="0" step="0.1" placeholder="0.0" value={data.land_area_acres || ''} onChange={e => set('land_area_acres', e.target.value)} />
      </Field>
      <Field label="Number of Properties / Plots" hint="Residential or commercial  enter 0 if none">
        <input type="number" className={inp} min="0" placeholder="0" value={data.property_count || ''} onChange={e => set('property_count', e.target.value)} />
      </Field>
    </div>
  )
}

/*  Step 6  Housing Details  */
function Step6({ data, set }: { data: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      <Field label="Type of House (Census Classification)" required>
        <select className={sel} value={data.house_type || ''} onChange={e => set('house_type', e.target.value)}>
          <option value="">-- Select --</option>
          <option value="kuccha">Kuccha  Mud, bamboo or thatch</option>
          <option value="semi_pucca">Semi-Pucca  Mixed construction</option>
          <option value="pucca_rented">Pucca  Rented / Leased</option>
          <option value="pucca_owned">Pucca  Self Owned</option>
          <option value="flat_apartment">Flat / Apartment</option>
        </select>
      </Field>
      <Field label="Housing Ownership" required>
        <select className={sel} value={data.ownership_type || ''} onChange={e => set('ownership_type', e.target.value)}>
          <option value="">-- Select --</option>
          <option value="owned">Self Owned</option>
          <option value="rented">Rented / Leased</option>
          <option value="govt_allotted">Government Allotted</option>
          <option value="homeless">No Permanent Shelter</option>
        </select>
      </Field>
      <Field label="Total Rooms in House" required hint="Excluding kitchen and bathroom">
        <input type="number" className={inp} min="1" max="20" placeholder="e.g. 2" value={data.total_rooms || ''} onChange={e => set('total_rooms', e.target.value)} />
      </Field>
      <Field label="Residential Area Type" required>
        <select className={sel} value={data.residential_type || ''} onChange={e => set('residential_type', e.target.value)}>
          <option value="">-- Select --</option>
          <option value="urban">Urban</option>
          <option value="rural">Rural</option>
          <option value="tribal">Tribal / Forest / Scheduled Area</option>
        </select>
      </Field>
      <Field label="Has Electricity Connection?">
        <YN value={data.has_electricity || 'true'} onChange={v => set('has_electricity', v)} />
      </Field>
      <Field label="Has Piped / Tap Water Supply?">
        <YN value={data.has_piped_water || 'true'} onChange={v => set('has_piped_water', v)} />
      </Field>
      <Field label="Has Toilet / Sanitation Facility?">
        <YN value={data.has_toilet || 'true'} onChange={v => set('has_toilet', v)} />
      </Field>
      <Field label="Primary Cooking Fuel Used">
        <select className={sel} value={data.cooking_fuel || ''} onChange={e => set('cooking_fuel', e.target.value)}>
          <option value="">-- Select --</option>
          <option value="lpg">LPG / PNG (piped gas)</option>
          <option value="wood">Firewood / Biomass</option>
          <option value="coal">Coal / Kerosene</option>
          <option value="other">Other</option>
        </select>
      </Field>
    </div>
  )
}

/*  Step 7  Government Benefits  */
function Step7({ data, set }: { data: Record<string, string>; set: (k: string, v: string) => void }) {
  const BF = (key: string, label: string) => (
    <Field key={key} label={label}>
      <YN value={data[key]} onChange={v => set(key, v)} />
    </Field>
  )
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      {BF('has_bpl_card', 'BPL / AAY Ration Card Holder?')}
      {BF('has_mgnrega', 'MGNREGA Job Card / Employment Card?')}
      {BF('has_ayushman_bharat', 'Ayushman Bharat (PM-JAY) Beneficiary?')}
      {BF('has_pm_kisan', 'PM-KISAN Beneficiary (farmer family)?')}
      {BF('has_pm_awas', 'PM Awas Yojana Housing Beneficiary?')}
      {BF('has_scholarship_govt', 'Any Govt. Scholarship (SC/ST/OBC/Minority)?')}
      <Field label="Annual Family Expenditure ()" hint="Total household expenses per year">
        <input type="number" className={inp} min="0" placeholder="e.g. 120000" value={data.annual_expenses || ''} onChange={e => set('annual_expenses', e.target.value)} />
      </Field>
    </div>
  )
}

/*  Step 8  Upload Documents  */
function Step8({ applicationId }: { applicationId: string }) {
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [uploaded,  setUploaded]  = useState<Record<string, boolean>>({})
  const [toast,     setToast]     = useState('')

  const DOCS = [
    { key: 'aadhaar',        label: 'Aadhaar Card (front & back)',          required: true  },
    { key: 'income_cert',    label: 'Income Certificate (current financial year)', required: true  },
    { key: 'marksheet_hsc',  label: 'HSC / 12th Board Marksheet',           required: true  },
    { key: 'admission_proof',label: 'Admission / Enrolment Proof',          required: true  },
    { key: 'bank_passbook',  label: 'Bank Passbook  first page (with IFSC)', required: true  },
    { key: 'caste_cert',     label: 'Caste Certificate (SC / ST / OBC)',    required: false },
    { key: 'disability_cert',label: 'Disability Certificate (if applicable)',required: false },
    { key: 'ug_marksheet',   label: 'UG Previous Semester / Year Marksheet',required: false },
  ]

  async function upload(key: string, file: File) {
    setUploading(p => ({ ...p, [key]: true }))
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('document_type', key)
      body.append('application_id', applicationId)
      const res = await fetch('/api/proxy/documents/upload', { method: 'POST', body })
      if (res.ok) {
        setUploaded(p => ({ ...p, [key]: true }))
        setToast('File uploaded successfully')
        setTimeout(() => setToast(''), 3000)
      }
    } finally { setUploading(p => ({ ...p, [key]: false })) }
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-400 text-green-800 text-sm rounded">
          <CheckCircle2 className="w-4 h-4" /> {toast}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-400 rounded p-3 text-sm text-amber-900">
        <p className="font-semibold mb-1">Document Upload Instructions</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs text-amber-800">
          <li>All documents marked <span className="text-red-600 font-bold">*</span> are mandatory. Application cannot be submitted without them.</li>
          <li>Accepted formats: PDF, JPG, JPEG, PNG  Maximum 5 MB per file.</li>
          <li>Documents must be clear, legible and not password protected.</li>
          <li>Income certificate must be issued by a gazetted officer / tehsildar.</li>
        </ul>
      </div>

      <table className="w-full text-sm border border-gray-300 rounded overflow-hidden">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-300">
            <th className="text-left px-4 py-2.5 font-semibold text-gray-700 w-8">#</th>
            <th className="text-left px-4 py-2.5 font-semibold text-gray-700">Document Name</th>
            <th className="text-center px-4 py-2.5 font-semibold text-gray-700 w-28">Required</th>
            <th className="text-center px-4 py-2.5 font-semibold text-gray-700 w-36">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {DOCS.map((doc, i) => (
            <tr key={doc.key} className="bg-white hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-500 text-xs">{i + 1}</td>
              <td className="px-4 py-3 font-medium text-gray-800">{doc.label}</td>
              <td className="px-4 py-3 text-center">
                {doc.required
                  ? <span className="text-red-600 font-bold text-xs">Mandatory</span>
                  : <span className="text-gray-400 text-xs">If applicable</span>}
              </td>
              <td className="px-4 py-3 text-center">
                {uploaded[doc.key] ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded
                  </span>
                ) : (
                  <label className="cursor-pointer">
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => e.target.files?.[0] && upload(doc.key, e.target.files[0])}
                      disabled={uploading[doc.key]} />
                    <span className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border rounded transition-colors
                      ${uploading[doc.key]
                        ? 'bg-gray-100 text-gray-400 border-gray-300'
                        : 'bg-blue-800 text-white border-blue-800 hover:bg-blue-900'}`}>
                      {uploading[doc.key]
                        ? <><RefreshCw className="w-3 h-3 animate-spin" /> Uploading</>
                        : <><Upload className="w-3 h-3" /> Choose File</>}
                    </span>
                  </label>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/*  Step 9  Declaration  */
function Step9({
  checks, setChecks, name, setName, place, setPlace
}: {
  checks: boolean[]; setChecks: (c: boolean[]) => void
  name: string; setName: (s: string) => void
  place: string; setPlace: (s: string) => void
}) {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

  const DECLARATIONS = [
    'I declare that all the information furnished in this application form is true, correct and complete to the best of my knowledge and belief.',
    'I have not suppressed, misrepresented or concealed any material fact regarding my family income, assets, property, academic details or any other information required in this application.',
    'I am aware that furnishing false or misleading information will result in immediate disqualification of my application, cancellation of any scholarship awarded, and may render me liable to criminal proceedings under applicable law.',
    'I am not simultaneously receiving a scholarship from this Trust, nor have I applied to receive one, during the same academic year to which this application pertains.',
    'I give my consent for field verification of the information provided in this application, and I undertake to make available all original documents for inspection when required by the Trust or its authorised representatives.',
    'I have read and understood the terms, conditions and eligibility criteria of the Merit-cum-Need Scholarship Programme 202526 and confirm that I satisfy all applicable requirements.',
  ]

  function toggle(i: number) {
    const next = [...checks]
    next[i] = !next[i]
    setChecks(next)
  }

  return (
    <div className="space-y-5">
      {/* Formal notice */}
      <div className="bg-blue-900 text-white rounded px-5 py-4">
        <p className="font-bold text-sm uppercase tracking-wide mb-1">Solemn Declaration by Applicant</p>
        <p className="text-blue-200 text-xs leading-relaxed">
          Please read each statement carefully. You must tick all boxes to confirm your agreement before submitting the application.
          This declaration has legal standing and forms part of your application record.
        </p>
      </div>

      {/* Declaration text */}
      <div className="border border-gray-400 rounded bg-gray-50 px-5 py-4">
        <p className="text-sm text-gray-700 leading-relaxed mb-4">
          I, the undersigned, being the applicant for the Merit-cum-Need Scholarship Programme 202526, do hereby solemnly affirm and declare as follows:
        </p>
        <div className="space-y-3">
          {DECLARATIONS.map((text, i) => (
            <label key={i} className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors
              ${checks[i] ? 'bg-green-50 border-green-400' : 'bg-white border-gray-300 hover:border-blue-400'}`}>
              <input
                type="checkbox"
                checked={checks[i] || false}
                onChange={() => toggle(i)}
                className="mt-0.5 w-4 h-4 accent-blue-800 flex-shrink-0"
              />
              <span className="text-sm text-gray-800 leading-relaxed">
                <span className="font-semibold text-gray-600 mr-1">{i + 1}.</span>
                {text}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Signature section */}
      <div className="border border-gray-400 rounded bg-white px-5 py-4">
        <p className="text-sm font-semibold text-gray-700 mb-4 border-b border-gray-200 pb-2">Applicant Signature Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name (as signature) <span className="text-red-600">*</span>
            </label>
            <input
              className={inp}
              placeholder="Enter your full name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Place <span className="text-red-600">*</span>
            </label>
            <input
              className={inp}
              placeholder="City / Town"
              value={place}
              onChange={e => setPlace(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input className={`${inp} bg-gray-100 text-gray-600`} value={today} readOnly />
          </div>
        </div>
      </div>

      {/* Completion indicator */}
      {checks.every(Boolean) && name.trim() && place.trim() ? (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-400 rounded text-green-800 text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          All declarations confirmed. You may now submit your application.
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-400 rounded text-amber-800 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Please tick all {DECLARATIONS.length} declaration boxes and fill in your name and place to enable submission.
        </div>
      )}
    </div>
  )
}

/*  Main Page  */
export default function ApplyPage() {
  const router = useRouter()
  const [step,          setStep]          = useState(0)
  const [applicationId, setApplicationId] = useState<string | null>(null)
  const [formData,      setFormData]      = useState<Record<number, Record<string, string>>>({
    0: {}, 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {},
  })
  const [declChecks, setDeclChecks] = useState<boolean[]>(Array(6).fill(false))
  const [declName,   setDeclName]   = useState('')
  const [declPlace,  setDeclPlace]  = useState('')
  const [saving,     setSaving]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast,      setToast]      = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const canSubmit = step === TOTAL - 1
    && declChecks.every(Boolean)
    && declName.trim().length > 0
    && declPlace.trim().length > 0

  function setField(stepIdx: number, key: string, value: string) {
    setFormData(prev => ({ ...prev, [stepIdx]: { ...prev[stepIdx], [key]: value } }))
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500)
  }

  async function createDraftIfNeeded(): Promise<string | null> {
    if (applicationId) return applicationId
    const res = await fetch('/api/proxy/applications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({}),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      if (err?.application_id) { setApplicationId(err.application_id); return err.application_id }
      showToast('Could not create application draft', 'error'); return null
    }
    const d = await res.json()
    setApplicationId(d.application.id)
    return d.application.id
  }

  async function saveStep() {
    if (step >= 7) return // Steps 8 (docs) and 9 (declaration) don't call saveWizardStep
    setSaving(true)
    try {
      const id = await createDraftIfNeeded()
      if (!id) return
      await fetch(`/api/proxy/applications/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ step: step + 1, data: formData[step] }),
      })
      showToast(`Section ${step + 1} saved`)
    } catch { showToast('Save failed', 'error') }
    setSaving(false)
  }

  async function next() {
    await saveStep()
    setStep(s => Math.min(s + 1, TOTAL - 1))
  }

  async function submit() {
    setSubmitting(true)
    try {
      const id = await createDraftIfNeeded()
      if (!id) { setSubmitting(false); return }
      const res = await fetch(`/api/proxy/applications/${id}/submit`, { method: 'POST', credentials: 'include' })
      if (!res.ok) {
        const err = await res.json()
        showToast(err.error || 'Submission failed', 'error')
        return
      }
      router.push('/app/dashboard')
    } catch { showToast('Submission failed', 'error') }
    setSubmitting(false)
  }

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded shadow-lg text-sm font-medium flex items-center gap-2
          ${toast.type === 'success' ? 'bg-green-700 text-white' : 'bg-red-700 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-4xl">

        {/* Page title */}
        <div className="mb-4 border-b border-gray-300 pb-3">
          <h1 className="text-xl font-bold text-gray-900">Online Application Form  Merit-cum-Need Scholarship 202526</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Complete all sections carefully. Fields marked <span className="text-red-600 font-bold">*</span> are mandatory.
            You may save your progress and return before the deadline.
          </p>
        </div>

        {/* Step navigator  numbered tabs */}
        <div className="mb-5 overflow-x-auto">
          <div className="flex border-b border-gray-300 min-w-max">
            {STEPS.map((s, i) => {
              const done   = i < step
              const active = i === step
              return (
                <button key={i}
                  onClick={() => done && setStep(i)}
                  disabled={!done}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap
                    ${active  ? 'border-blue-800 text-blue-900 bg-blue-50'
                    : done    ? 'border-transparent text-green-700 hover:border-green-400 hover:bg-green-50 cursor-pointer'
                              : 'border-transparent text-gray-400 cursor-not-allowed'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                    ${active ? 'bg-blue-800 text-white' : done ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {done ? '' : i + 1}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Section card */}
        <div className="bg-white border border-gray-300 rounded mb-5">
          {/* Section header bar */}
          <div className="bg-blue-900 text-white px-5 py-3 rounded-t">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-blue-300 uppercase tracking-wider">Section {step + 1} of {TOTAL}</span>
                <h2 className="font-bold text-base mt-0.5">{STEPS[step].label}</h2>
              </div>
              <span className="text-xs text-blue-300">{STEPS[step].desc}</span>
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-1.5 bg-blue-700 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${((step + 1) / TOTAL) * 100}%` }} />
            </div>
          </div>

          <div className="px-6 py-5">
            {step === 0 && <Step1 data={formData[0]} set={(k, v) => setField(0, k, v)} />}
            {step === 1 && <Step2 data={formData[1]} set={(k, v) => setField(1, k, v)} />}
            {step === 2 && <Step3 data={formData[2]} set={(k, v) => setField(2, k, v)} />}
            {step === 3 && <Step4 data={formData[3]} set={(k, v) => setField(3, k, v)} />}
            {step === 4 && <Step5 data={formData[4]} set={(k, v) => setField(4, k, v)} />}
            {step === 5 && <Step6 data={formData[5]} set={(k, v) => setField(5, k, v)} />}
            {step === 6 && <Step7 data={formData[6]} set={(k, v) => setField(6, k, v)} />}
            {step === 7 && <Step8 applicationId={applicationId || ''} />}
            {step === 8 && (
              <Step9
                checks={declChecks} setChecks={setDeclChecks}
                name={declName}     setName={setDeclName}
                place={declPlace}   setPlace={setDeclPlace}
              />
            )}
          </div>
        </div>

        {/* Navigation row */}
        <div className="flex items-center justify-between bg-gray-100 border border-gray-300 rounded px-5 py-3 mb-4">
          <button onClick={() => setStep(s => Math.max(s - 1, 0))} disabled={step === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-400 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft className="w-4 h-4" /> Previous Section
          </button>

          <div className="text-xs text-gray-500">
            Section {step + 1} of {TOTAL}
          </div>

          <div className="flex items-center gap-2">
            {step < 7 && (
              <button onClick={saveStep} disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-400 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                <Save className="w-4 h-4" /> {saving ? 'Saving' : 'Save Draft'}
              </button>
            )}
            {step < TOTAL - 1 ? (
              <button onClick={next} disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-blue-800 hover:bg-blue-900 text-white rounded disabled:bg-gray-300 disabled:text-gray-500 transition-colors">
                Save & Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={submit} disabled={!canSubmit || submitting}
                className="inline-flex items-center gap-2 px-6 py-2 text-sm font-bold bg-green-700 hover:bg-green-800 text-white rounded disabled:bg-gray-300 disabled:text-gray-500 transition-colors">
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting Application' : 'Submit Application'}
              </button>
            )}
          </div>
        </div>

        {/* Notice */}
        <div className="border border-blue-300 bg-blue-50 rounded px-4 py-3 text-xs text-blue-800">
          <strong>Important:</strong> Once submitted, your application cannot be edited. Ensure all information is accurate and all
          mandatory documents are uploaded before final submission. For assistance, call{' '}
          <strong>1800-123-4567</strong> (MonSat, 9 AM  6 PM).
        </div>
      </div>
    </div>
  )
}
