'use client'

import { useState } from 'react'
import { login } from './actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#050505] to-[#111111] text-white p-4">
      <div className="bg-[#191919]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-12 w-full max-w-[420px] shadow-2xl text-center">
        <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-[#0078d4] to-[#00bcf2] bg-clip-text text-transparent">
          MSC Portal
        </h2>
        <p className="text-[#aaaaaa] text-sm mb-8">Sign in to access your community dashboard</p>

        <form action={handleSubmit} className="text-left space-y-5">
          <div>
            <label className="block text-sm text-[#aaaaaa] mb-2" htmlFor="email">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              placeholder="student@srmap.edu.in"
              className="w-full p-3 bg-black/50 border border-[#333333] rounded-md text-white focus:outline-none focus:border-[#0078d4] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-[#aaaaaa] mb-2" htmlFor="password">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              placeholder="••••••••"
              className="w-full p-3 bg-black/50 border border-[#333333] rounded-md text-white focus:outline-none focus:border-[#0078d4] transition-colors"
            />
          </div>

          {error && <div className="text-[#ff5555] text-sm text-center pt-2">{error}</div>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full p-3.5 bg-[#0078d4] hover:bg-[#005a9e] active:scale-95 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
