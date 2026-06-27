'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { acceptPasswordRequest, rejectPasswordRequest } from './password_actions'

const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') => {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    try {
      switch (type) {
        case 'light':
          window.navigator.vibrate(10)
          break
        case 'medium':
          window.navigator.vibrate(25)
          break
        case 'heavy':
          window.navigator.vibrate(55)
          break
        case 'success':
          window.navigator.vibrate([15, 30, 15])
          break
        case 'warning':
          window.navigator.vibrate([35, 45, 35])
          break
        case 'error':
          window.navigator.vibrate([80, 45, 80])
          break
      }
    } catch (_) {}
  }
}

export default function PasswordRequestsTab() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchRequests()
  }, [])

  async function fetchRequests() {
    setLoading(true)
    const { data, error } = await supabase
      .from('password_reset_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    
    if (data) setRequests(data)
    setLoading(false)
  }

  async function handleAccept(reqId: string, email: string, newPassword: string) {
    triggerHaptic('light')
    setActionLoading(reqId)
    setErrorMsg(null)
    setSuccessMsg(null)

    const res = await acceptPasswordRequest(reqId, email, newPassword)
    if (res.error) {
      triggerHaptic('error')
      setErrorMsg(res.error)
    } else {
      triggerHaptic('success')
      setSuccessMsg(`Password successfully changed for ${email}.`)
      fetchRequests()
    }
    setActionLoading(null)
  }

  async function handleReject(reqId: string, email: string) {
    triggerHaptic('light')
    setActionLoading(reqId)
    setErrorMsg(null)
    setSuccessMsg(null)

    const res = await rejectPasswordRequest(reqId)
    if (res.error) {
      triggerHaptic('error')
      setErrorMsg(res.error)
    } else {
      triggerHaptic('warning')
      setSuccessMsg(`Rejected request for ${email}.`)
      fetchRequests()
    }
    setActionLoading(null)
  }

  if (loading) {
    return (
      <div className="bg-[#18181b]/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl animate-pulse">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-yellow-500/5 to-transparent">
          <div className="h-6 bg-white/10 rounded w-48"></div>
          <div className="h-8 bg-white/5 rounded-xl w-24"></div>
        </div>
        <div className="p-8 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white/[0.01] border border-white/5 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-2 w-full md:w-1/3">
                <div className="h-4 bg-white/10 rounded w-2/3"></div>
                <div className="h-3 bg-white/5 rounded w-1/2"></div>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <div className="h-8 bg-white/5 border border-white/10 rounded-lg w-28"></div>
                <div className="h-8 bg-white/5 border border-white/10 rounded-lg w-16"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#18181b]/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">
      <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-yellow-500/5 to-transparent">
        <h2 className="text-xl font-syne font-bold text-white flex items-center gap-3">
          <i className="fas fa-key text-yellow-400"></i>
          Password Reset Requests
        </h2>
        <button 
          onClick={() => { triggerHaptic('light'); fetchRequests(); }} 
          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-xs font-bold text-white transition-colors flex items-center gap-2 cursor-pointer"
        >
          <i className="fas fa-sync-alt"></i> Refresh
        </button>
      </div>

      <div className="p-8">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl text-sm font-semibold border bg-red-500/10 text-red-400 border-red-500/20">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-6 p-4 rounded-xl text-sm font-semibold border bg-green-500/10 text-green-400 border-green-500/20">
            {successMsg}
          </div>
        )}

        {requests.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-white/20">
              <i className="fas fa-check-circle text-2xl text-yellow-400/80"></i>
            </div>
            <h3 className="text-lg font-syne font-bold text-white mb-2">No pending requests</h3>
            <p className="text-white/40 text-xs">All password reset requests have been successfully handled.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <div key={req.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-white/10 hover:bg-white/[0.03] transition-all">
                <div>
                  <h3 className="text-base font-bold text-white mb-1">{req.email}</h3>
                  <div className="text-[10px] font-semibold text-white/40 flex items-center gap-2">
                    <i className="fas fa-clock"></i> {new Date(req.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </div>
                </div>
                
                <div className="flex gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => handleAccept(req.id, req.email, req.new_password)}
                    disabled={actionLoading === req.id}
                    className="flex-1 md:flex-none px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading === req.id ? 'Processing...' : 'Accept & Change'}
                  </button>
                  <button 
                    onClick={() => handleReject(req.id, req.email)}
                    disabled={actionLoading === req.id}
                    className="flex-1 md:flex-none px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
