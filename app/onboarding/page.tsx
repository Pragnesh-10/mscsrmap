'use client'

import { useState } from 'react'
import { submitOnboarding } from './actions'

export default function OnboardingPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await submitOnboarding(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#050505] to-[#111111] text-white p-4">
      <div className="bg-[#191919]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-10 w-full max-w-[500px] shadow-2xl">
        <h2 className="text-3xl font-bold mb-2 text-center bg-gradient-to-r from-[#0078d4] to-[#00bcf2] bg-clip-text text-transparent">
          Welcome to MSC
        </h2>
        <p className="text-[#aaaaaa] text-sm mb-8 text-center">Please complete your profile to continue.</p>

        <form action={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#dddddd] mb-2">Full Name</label>
            <input
              type="text"
              name="fullName"
              required
              placeholder="e.g. Full Name"
              className="w-full p-3 bg-black/50 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#0078d4] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#dddddd] mb-2">Registration Number</label>
            <input
              type="text"
              name="regNumber"
              required
              placeholder="e.g. AP21110010001"
              className="w-full p-3 bg-black/50 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#0078d4] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#dddddd] mb-2">Phone Number</label>
            <input
              type="tel"
              name="phoneNumber"
              required
              placeholder="e.g. 9876543210"
              className="w-full p-3 bg-black/50 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#0078d4] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#dddddd] mb-2">Department</label>
            <select
              name="department"
              required
              defaultValue=""
              className="w-full p-3 bg-black/50 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#0078d4] transition-colors appearance-none"
            >
              <option value="" disabled>Select your department...</option>
              <option value="CSE">CSE</option>
              <option value="ECE">ECE</option>
              <option value="EEE">EEE</option>
              <option value="BSc">BSc</option>
              <option value="BBA">BBA</option>
              <option value="MBA">MBA</option>
              <option value="Mechanical">Mechanical</option>
              <option value="Civil">Civil</option>
              <option value="others">others</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#dddddd] mb-2">Year of Study</label>
            <select
              name="yearOfStudy"
              required
              defaultValue=""
              className="w-full p-3 bg-black/50 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#0078d4] transition-colors appearance-none"
            >
              <option value="" disabled>Select Year</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>

          {error && <div className="text-[#ff5555] text-sm text-center pt-2">{error}</div>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full p-3.5 bg-[#0078d4] hover:bg-[#005a9e] active:scale-95 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Complete Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
