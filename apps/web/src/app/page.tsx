<<<<<<< HEAD
﻿import Link from 'next/link'
=======
import Link from 'next/link'
>>>>>>> 723a05af3c40b1ee64fb8321883f8415d77a7b27
import { GraduationCap, CheckCircle, Phone, Mail, MapPin, ChevronRight, AlertCircle } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans antialiased">

      {/*  Top strip  */}
      <div className="bg-blue-900 text-blue-100 text-xs py-1.5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-1">
<<<<<<< HEAD
          <span>Helpdesk: <a href="tel:18001234567" className="underline underline-offset-2">1800-123-4567</a> (Mon-Sat, 9 AM - 6 PM)</span>
          <span>Applications are open for the 2025-26 cycle</span>
=======
          <span>Helpdesk: <a href="tel:18001234567" className="underline underline-offset-2">1800-123-4567</a> (MonSat, 9 AM  6 PM)</span>
          <span>Applications are open for the 202526 cycle</span>
>>>>>>> 723a05af3c40b1ee64fb8321883f8415d77a7b27
        </div>
      </div>

      {/*  Header  */}
      <header className="bg-blue-800 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-7 h-7 text-blue-800" />
            </div>
            <div>
              <div className="text-xl font-bold leading-tight tracking-tight">Merit-cum-Need Scholarship</div>
<<<<<<< HEAD
              <div className="text-blue-300 text-xs mt-0.5">Programme 2025-26</div>
=======
              <div className="text-blue-300 text-xs mt-0.5">Programme 202526</div>
>>>>>>> 723a05af3c40b1ee64fb8321883f8415d77a7b27
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-blue-200">
            <a href="#eligibility"   className="hover:text-white transition-colors">Eligibility</a>
            <a href="#how-to-apply"  className="hover:text-white transition-colors">How to Apply</a>
            <a href="#contact"       className="hover:text-white transition-colors">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login"
              className="px-4 py-1.5 text-sm text-blue-200 hover:text-white border border-blue-500 rounded hover:border-blue-300 transition-colors">
              Login
            </Link>
            <Link href="/register"
              className="px-4 py-1.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-white rounded transition-colors">
              Apply Now
            </Link>
          </div>
        </div>
      </header>

      {/*  Notice banner  */}
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-start gap-2.5 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
          <span>
<<<<<<< HEAD
            <strong>Notice:</strong> Applications for the UG Scholarship 2025-26 are now open.
=======
            <strong>Notice:</strong> Applications for the UG Scholarship 202526 are now open.
>>>>>>> 723a05af3c40b1ee64fb8321883f8415d77a7b27
            This scholarship is applicable for Undergraduate programmes only. Ensure all documents are uploaded before submission.
          </span>
        </div>
      </div>

      {/*  Hero  */}
      <section className="bg-gradient-to-br from-blue-800 to-blue-700 text-white py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-blue-300 text-sm font-medium mb-2 uppercase tracking-wide">Merit-cum-Need Scholarship</p>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">
              Supporting Deserving<br />UG Students Across India
            </h1>
            <p className="text-blue-200 text-base leading-relaxed mb-8">
              Scholarships of up to <strong className="text-white">75,000</strong> are awarded to
              meritorious undergraduate students from economically weaker sections
              at recognised institutions.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/register"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded text-sm transition-colors">
                Start Application
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link href="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-blue-400 text-blue-100 hover:bg-blue-600 font-medium rounded text-sm transition-colors">
                Track Existing Application
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/*  Key figures  */}
      <section className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-200">
            {[
              { value: '100',       label: 'Scholarships Awarded',    sub: 'per academic year' },
              { value: '75,000',   label: 'Maximum Award',           sub: 'for lowest income band' },
              { value: '20',        label: 'Waitlist Seats',          sub: 'in case of vacancy' },
              { value: '8 Lakh',   label: 'Income Ceiling',          sub: 'annual family income' },
            ].map(({ value, label, sub }) => (
              <div key={label} className="px-6 py-6 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-blue-800">{value}</div>
                <div className="text-sm font-medium text-slate-700 mt-1">{label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/*  Main content  */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid md:grid-cols-3 gap-10">

          {/* Left: Eligibility + How to Apply */}
          <div className="md:col-span-2 space-y-10">

            {/* Eligibility */}
            <div id="eligibility">
              <h2 className="text-xl font-bold text-blue-800 border-b-2 border-blue-800 pb-2 mb-5">
                Eligibility Criteria
              </h2>
              <ul className="space-y-3">
                {[
                  'Students enrolled in a UG programme (B.A., B.Sc., B.Com., B.E., B.Tech., B.B.A., etc.)',
                  'Institution affiliated to UGC, AICTE, or State Board of Technical Education',
                  'Annual family income not exceeding 8,00,000',
                  'Not receiving any other central or state scholarship simultaneously',
                  'Minimum 50% marks in 12th standard (qualifying examination)',
                  'Regular (full-time) mode of study only  distance / part-time not eligible',
                  'Indian nationality with valid Aadhaar card',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* How to Apply */}
            <div id="how-to-apply">
              <h2 className="text-xl font-bold text-blue-800 border-b-2 border-blue-800 pb-2 mb-5">
                How to Apply
              </h2>
              <ol className="space-y-4">
                {[
                  { step: '1', title: 'Register on the portal', desc: 'Create an account using your email ID and mobile number.' },
                  { step: '2', title: 'Fill the application form', desc: 'Enter personal, academic, family and financial details in the online form.' },
                  { step: '3', title: 'Upload documents', desc: 'Upload Aadhaar, income certificate, mark sheets, bank passbook, and institution ID.' },
                  { step: '4', title: 'Review and submit', desc: 'Review your application and submit. You can save as draft and return any time.' },
                ].map(({ step, title, desc }) => (
                  <li key={step} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-800 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                      {step}
                    </div>
                    <div className="pt-1">
                      <div className="font-semibold text-slate-800 text-sm">{title}</div>
                      <div className="text-slate-500 text-sm mt-0.5">{desc}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Documents required */}
            <div>
              <h2 className="text-xl font-bold text-blue-800 border-b-2 border-blue-800 pb-2 mb-5">
                Documents Required
              </h2>
              <div className="grid sm:grid-cols-2 gap-2">
                {[
                  'Aadhaar Card',
                  'Income Certificate (issued by competent authority)',
                  '10th / 12th Mark Sheet',
                  'Current Year Bonafide / Enrolment Certificate',
                  'Bank Passbook (first page)',
                  'Caste Certificate (if applicable)',
                  'Disability Certificate (if applicable)',
                  'Passport-size Photograph',
                ].map(doc => (
                  <div key={doc} className="flex items-center gap-2 text-sm text-slate-700 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                    {doc}
                  </div>
                ))}
              </div>
            </div>

            {/* Award structure */}
            <div id="awards">
              <h2 className="text-xl font-bold text-blue-800 border-b-2 border-blue-800 pb-2 mb-5">
                Award Structure
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-slate-200 rounded">
                  <thead>
                    <tr className="bg-blue-800 text-white">
                      <th className="text-left px-4 py-2.5 font-medium">Annual Family Income</th>
                      <th className="text-left px-4 py-2.5 font-medium">Scholarship Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ['Up to 1,00,000',   '75,000'],
                      ['1,00,001  3,00,000', '62,500'],
                      ['3,00,001  5,00,000', '50,000'],
                      ['5,00,001  8,00,000', '37,500'],
                    ].map(([band, amount], i) => (
                      <tr key={band} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-4 py-2.5 text-slate-700">{band}</td>
                        <td className="px-4 py-2.5 font-semibold text-blue-800">{amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 mt-2.5">
                * Differently-abled students receive an additional 15% uplift on the applicable amount.
              </p>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">

            {/* Apply CTA box */}
            <div className="bg-blue-800 text-white rounded p-5">
<<<<<<< HEAD
              <h3 className="font-bold text-base mb-1">Apply for 2025-26</h3>
=======
              <h3 className="font-bold text-base mb-1">Apply for 202526</h3>
>>>>>>> 723a05af3c40b1ee64fb8321883f8415d77a7b27
              <p className="text-blue-200 text-xs mb-4 leading-relaxed">
                Applications are open. Create an account to start your application.
              </p>
              <Link href="/register"
                className="block w-full text-center py-2.5 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold rounded transition-colors">
                Start Application
              </Link>
              <Link href="/login"
                className="block w-full text-center py-2 mt-2 border border-blue-500 text-blue-200 hover:text-white text-sm rounded transition-colors">
                Login to Portal
              </Link>
            </div>

            {/* Guidelines */}
            <div className="border border-slate-200 rounded">
              <div className="bg-slate-700 text-white px-4 py-2.5 rounded-t">
                <h3 className="font-semibold text-sm">Downloads</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {[
<<<<<<< HEAD
                  'Scholarship Guidelines 2025-26',
=======
                  'Scholarship Guidelines 202526',
>>>>>>> 723a05af3c40b1ee64fb8321883f8415d77a7b27
                  'List of Recognised Institutions',
                  'Income Certificate Format',
                  'Frequently Asked Questions',
                ].map(item => (
                  <a key={item} href="#"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-blue-700 hover:bg-blue-50 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
                    {item}
                  </a>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div id="contact" className="border border-slate-200 rounded">
              <div className="bg-slate-700 text-white px-4 py-2.5 rounded-t">
                <h3 className="font-semibold text-sm">Contact / Helpdesk</h3>
              </div>
              <div className="px-4 py-4 space-y-3 text-sm text-slate-700">
                <div className="flex items-start gap-2.5">
                  <Phone className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">1800-123-4567</div>
<<<<<<< HEAD
                    <div className="text-xs text-slate-400">Toll-free  Mon-Sat, 9 AM - 6 PM</div>
=======
                    <div className="text-xs text-slate-400">Toll-free  MonSat, 9 AM  6 PM</div>
>>>>>>> 723a05af3c40b1ee64fb8321883f8415d77a7b27
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">scholarship@trust.org</div>
                    <div className="text-xs text-slate-400">Response within 2 working days</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-slate-500 leading-relaxed">
                    4th Floor, Education Tower,<br />
                    Anna Salai, Chennai  600 002, Tamil Nadu
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/*  Footer  */}
      <footer className="bg-slate-800 text-slate-400 text-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="w-5 h-5 text-white" />
                <span className="text-white font-semibold">Merit-cum-Need Scholarship</span>
              </div>
              <p className="text-xs leading-relaxed max-w-xs text-slate-500">
                Promoting merit-based education by supporting students from economically weaker sections
                across India since 2018.
              </p>
            </div>
            <div className="flex gap-10 text-xs">
              <div className="space-y-2">
                <div className="text-slate-300 font-medium mb-1">Quick Links</div>
                <a href="#eligibility"  className="block hover:text-white transition-colors">Eligibility</a>
                <a href="#how-to-apply" className="block hover:text-white transition-colors">How to Apply</a>
              </div>
              <div className="space-y-2">
                <div className="text-slate-300 font-medium mb-1">Portal</div>
                <Link href="/register" className="block hover:text-white transition-colors">Register</Link>
                <Link href="/login"    className="block hover:text-white transition-colors">Login</Link>
                <Link href="/login"    className="block hover:text-white transition-colors">Staff Login</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-700 mt-6 pt-5 text-xs text-slate-500 flex flex-col sm:flex-row justify-between gap-2">
            <span> 2025 Merit-cum-Need Scholarship Programme. All rights reserved.</span>
            <span>Results declared after verification is complete.</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
