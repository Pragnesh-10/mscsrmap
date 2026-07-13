'use client'

import { useState } from 'react'
import { login, requestPasswordReset } from './actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showResetForm, setShowResetForm] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleLoginSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    const formData = new FormData(e.currentTarget)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  async function handleResetSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    
    const formData = new FormData(e.currentTarget)
    
    const newPassword = formData.get('new_password') as string
    const confirmPassword = formData.get('confirm_password') as string

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match!")
      setLoading(false)
      return
    }

    const result = await requestPasswordReset(formData)
    
    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess("Reset request sent! An admin must approve it before you can log in.")
      setShowResetForm(false)
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#050505] to-[#111111] text-white p-4">
      <div className="bg-[#191919]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-12 w-full max-w-[420px] shadow-2xl text-center transition-all">
        <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-[#0078d4] to-[#00bcf2] bg-clip-text text-transparent">
          MSC Portal
        </h2>
        <p className="text-[#aaaaaa] text-sm mb-8">
          {showResetForm ? 'Request an admin to reset your password' : 'Sign in to access your community dashboard'}
        </p>

        {showResetForm ? (
          <form onSubmit={handleResetSubmit} className="text-left space-y-5">
            <div>
              <label className="block text-sm text-[#aaaaaa] mb-2" htmlFor="reset-email">Email Address</label>
              <input type="email" id="reset-email" name="email" required placeholder="student@srmap.edu.in" className="w-full p-3 bg-black/50 border border-[#333333] rounded-md text-white focus:outline-none focus:border-[#0078d4] transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-[#aaaaaa] mb-2" htmlFor="new_password">New Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} id="new_password" name="new_password" required placeholder="••••••••" className="w-full p-3 bg-black/50 border border-[#333333] rounded-md text-white focus:outline-none focus:border-[#0078d4] transition-colors pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#aaaaaa] hover:text-white">
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-[#aaaaaa] mb-2" htmlFor="confirm_password">Confirm New Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} id="confirm_password" name="confirm_password" required placeholder="••••••••" className="w-full p-3 bg-black/50 border border-[#333333] rounded-md text-white focus:outline-none focus:border-[#0078d4] transition-colors pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#aaaaaa] hover:text-white">
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            {error && <div className="text-[#ff5555] text-sm text-center pt-2 bg-red-500/10 p-2 rounded border border-red-500/20">{error}</div>}

            <div className="pt-2 flex flex-col gap-3">
              <button type="submit" disabled={loading} className="w-full p-3.5 bg-yellow-500 hover:bg-yellow-600 active:scale-95 text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <i className="fas fa-spinner fa-spin"></i>}
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
              <button type="button" onClick={() => { setShowResetForm(false); setError(null); }} disabled={loading} className="w-full p-3.5 bg-white/5 hover:bg-white/10 active:scale-95 text-[#aaaaaa] hover:text-white font-semibold rounded-lg transition-all">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLoginSubmit} className="text-left space-y-5">
            <div>
              <label className="block text-sm text-[#aaaaaa] mb-2" htmlFor="email">Email Address</label>
              <input type="email" id="email" name="email" required placeholder="student@srmap.edu.in" className="w-full p-3 bg-black/50 border border-[#333333] rounded-md text-white focus:outline-none focus:border-[#0078d4] transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-[#aaaaaa] mb-2" htmlFor="password">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} id="password" name="password" required placeholder="••••••••" className="w-full p-3 bg-black/50 border border-[#333333] rounded-md text-white focus:outline-none focus:border-[#0078d4] transition-colors pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#aaaaaa] hover:text-white">
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            {error && <div className="text-[#ff5555] text-sm text-center pt-2 bg-red-500/10 p-2 rounded border border-red-500/20">{error}</div>}
            {success && <div className="text-green-400 text-sm text-center pt-2 bg-green-500/10 p-2 rounded border border-green-500/20">{success}</div>}

            <div className="pt-2 flex flex-col gap-3">
              <button type="submit" disabled={loading} className="w-full p-3.5 bg-[#0078d4] hover:bg-[#005a9e] active:scale-95 text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <i className="fas fa-spinner fa-spin"></i>}
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
              
              <button type="button" onClick={() => { setShowResetForm(true); setError(null); setSuccess(null); }} disabled={loading} className="w-full text-sm text-[#aaaaaa] hover:text-white transition-colors text-center py-2">
                Core Member? Request Password Reset
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
