'use client'

import React from 'react'

export default function AboutTab() {
  return (
    <div className="bg-[#18181b] rounded-2xl border border-white/5 overflow-hidden">
      <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-blue-500/10 to-transparent">
        <h2 className="text-xl font-bold text-white flex items-center gap-3">
          <i className="fas fa-info-circle text-blue-400"></i>
          About MSC System
        </h2>
      </div>

      <div className="p-8 space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Microsoft Student Community - SRM AP</h3>
          <p className="text-white/60 leading-relaxed">
            The MSC Event Management System is a specialized, high-performance platform built exclusively for the Microsoft Student Community at SRM University AP. It handles end-to-end event registrations, matchmaking, QR ticket generation, and core member administration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h4 className="text-blue-400 font-semibold mb-2"><i className="fas fa-shield-alt mr-2"></i> Security & Roles</h4>
            <p className="text-sm text-white/60">
              Strict Role-Based Access Control (RBAC) ensures Core Members can manage events and team members, while Admins have exclusive access to User Roles and system-wide Audit Logs.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h4 className="text-green-400 font-semibold mb-2"><i className="fas fa-bolt mr-2"></i> Performance</h4>
            <p className="text-sm text-white/60">
              Powered by Next.js 15 App Router and Supabase, the system leverages aggressive caching and Edge computing for sub-100ms response times globally.
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-white/5 flex items-center justify-between">
          <div className="text-sm text-white/40">
            Version 2.0.0 &bull; Built for MSC SRM AP
          </div>
          <div className="flex gap-4">
            <a href="https://github.com/mscsrmap/mscsrmap" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white transition-colors">
              <i className="fab fa-github text-xl"></i>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
