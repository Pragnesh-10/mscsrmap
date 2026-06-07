'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { acceptPasswordRequest, rejectPasswordRequest } from './password_actions'

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
    setActionLoading(reqId)
    setErrorMsg(null)
    setSuccessMsg(null)

    const res = await acceptPasswordRequest(reqId, email, newPassword)
    if (res.error) {
      setErrorMsg(res.error)
    } else {
      setSuccessMsg(`Password successfully changed for ${email}.`)
      fetchRequests()
    }
    setActionLoading(null)
  }

  async function handleReject(reqId: string, email: string) {
    setActionLoading(reqId)
    setErrorMsg(null)
    setSuccessMsg(null)

    const res = await rejectPasswordRequest(reqId)
    if (res.error) {
      setErrorMsg(res.error)
    } else {
      setSuccessMsg(`Rejected request for ${email}.`)
      fetchRequests()
    }
    setActionLoading(null)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="bg-[#18181b] rounded-2xl border border-white/5 overflow-hidden">
      <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-yellow-500/10 to-transparent">
        <h2 className="text-xl font-bold text-white flex items-center gap-3">
          <i className="fas fa-key text-yellow-400"></i>
          Password Reset Requests
        </h2>
        <button onClick={fetchRequests} className="text-white/40 hover:text-white transition-colors">
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
          <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl bg-white/5">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-white/20">
              <i className="fas fa-check-circle text-2xl"></i>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No pending requests!</h3>
            <p className="text-white/40 text-sm">All password reset requests have been handled.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <div key={req.id} className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">{req.email}</h3>
                  <div className="text-xs font-semibold text-white/40 flex items-center gap-2">
                    <i className="fas fa-clock"></i> {new Date(req.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </div>
                </div>
                
                <div className="flex gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => handleAccept(req.id, req.email, req.new_password)}
                    disabled={actionLoading === req.id}
                    className="flex-1 md:flex-none px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500 hover:text-white rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50"
                  >
                    {actionLoading === req.id ? 'Processing...' : 'Accept & Change'}
                  </button>
                  <button 
                    onClick={() => handleReject(req.id, req.email)}
                    disabled={actionLoading === req.id}
                    className="flex-1 md:flex-none px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50"
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
