'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type EventStat = {
  title: string
  teamsRegistered: number
  individualsRegistered: number
  totalMembers: number
  checkedInMembers: number
  checkinRate: number
}

export default function AnalyticsDashboard() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEvents: 0,
    totalRegistrations: 0,
    totalParticipants: 0,
    checkInRate: 0,
  })
  const [eventStats, setEventStats] = useState<EventStat[]>([])

  useEffect(() => {
    fetchAnalytics()

    const channel = supabase.channel('analytics_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
        // Re-fetch stats when registrations change (e.g. check-ins, new signups)
        fetchAnalytics()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchAnalytics() {
    setLoading(true)

    try {
      // Parallel fetch for speed
      const [
        { count: usersCount },
        { count: eventsCount },
        { data: regs }
      ] = await Promise.all([
        supabase.from('member_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('events').select('*', { count: 'exact', head: true }),
        supabase.from('registrations').select('created_at, checked_in, form_data, team_data, event_id, events(title)')
      ])

      const totalRegs = regs?.length || 0
      let totalParticipantsCount = 0
      let checkedInCount = 0

      const eventMap: Record<string, EventStat> = {}

      if (regs) {
        regs.forEach(reg => {
          // 1. Calculate actual participant count (handling teams correctly)
          const isTeam = reg.team_data && typeof reg.team_data === 'object' && Array.isArray((reg.team_data as any).members)
          const teamMembers = isTeam ? ((reg.team_data as any).members as any[]) : []
          const attendeeCount = 1 + teamMembers.length

          totalParticipantsCount += attendeeCount
          if (reg.checked_in) {
            checkedInCount += attendeeCount
          }

          // Per-event aggregation
          const eventTitle = (reg.events as any)?.title || 'Unknown Event'
          if (!eventMap[eventTitle]) {
            eventMap[eventTitle] = {
              title: eventTitle,
              teamsRegistered: 0,
              individualsRegistered: 0,
              totalMembers: 0,
              checkedInMembers: 0,
              checkinRate: 0
            }
          }

          if (isTeam) {
            eventMap[eventTitle].teamsRegistered += 1
          } else {
            eventMap[eventTitle].individualsRegistered += 1
          }

          eventMap[eventTitle].totalMembers += attendeeCount
          if (reg.checked_in) {
            eventMap[eventTitle].checkedInMembers += attendeeCount
          }
        })
      }

      const rate = totalParticipantsCount > 0 ? Math.round((checkedInCount / totalParticipantsCount) * 100) : 0

      setStats({
        totalUsers: usersCount || 0,
        totalEvents: eventsCount || 0,
        totalRegistrations: totalRegs,
        totalParticipants: totalParticipantsCount,
        checkInRate: rate
      })

      const eventStatsArray = Object.values(eventMap).map(stat => ({
        ...stat,
        checkinRate: stat.totalMembers > 0 ? Math.round((stat.checkedInMembers / stat.totalMembers) * 100) : 0
      })).sort((a, b) => b.totalMembers - a.totalMembers)

      setEventStats(eventStatsArray)

    } catch (error) {
      console.error('Failed to parse analytics metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <div className="mb-6">
        <h2 className="text-3xl font-syne font-extrabold text-white tracking-tight">Platform Analytics</h2>
        <p className="text-white/40 text-sm mt-1">Real-time statistics, registration timeline, and branch demographic breakdowns.</p>
      </div>
      
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Participants Card */}
        <div className="bg-[#18181b]/30 backdrop-blur-md border border-white/10 rounded-[22px] p-5 relative overflow-hidden group hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.05)] transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-bl-full -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-110"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#a1a1aa] text-xs font-bold uppercase tracking-wider">Total Participants</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <i className="fas fa-user-friends text-xs"></i>
            </div>
          </div>
          <p className="text-3xl font-syne font-black text-white tracking-tight">{stats.totalParticipants}</p>
        </div>

        {/* Submissions Card */}
        <div className="bg-[#18181b]/30 backdrop-blur-md border border-white/10 rounded-[22px] p-5 relative overflow-hidden group hover:border-pink-500/30 hover:shadow-[0_0_20px_rgba(236,72,153,0.05)] transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-pink-500/5 rounded-bl-full -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-110"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#a1a1aa] text-xs font-bold uppercase tracking-wider">Submissions</span>
            <div className="w-7 h-7 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
              <i className="fas fa-ticket-alt text-xs"></i>
            </div>
          </div>
          <p className="text-3xl font-syne font-black text-white tracking-tight">{stats.totalRegistrations}</p>
        </div>
        
        {/* Events Card */}
        <div className="bg-[#18181b]/30 backdrop-blur-md border border-white/10 rounded-[22px] p-5 relative overflow-hidden group hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(139,92,246,0.05)] transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-bl-full -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-110"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#a1a1aa] text-xs font-bold uppercase tracking-wider">Events Hosted</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <i className="fas fa-calendar-alt text-xs"></i>
            </div>
          </div>
          <p className="text-3xl font-syne font-black text-white tracking-tight">{stats.totalEvents}</p>
        </div>

        {/* Check-in Rate Card */}
        <div className="bg-[#18181b]/30 backdrop-blur-md border border-white/10 rounded-[22px] p-5 relative overflow-hidden group hover:border-green-500/30 hover:shadow-[0_0_20px_rgba(34,197,94,0.05)] transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/5 rounded-bl-full -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-110"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#a1a1aa] text-xs font-bold uppercase tracking-wider">Check-in Rate</span>
            <div className="w-7 h-7 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
              <i className="fas fa-user-check text-xs"></i>
            </div>
          </div>
          <p className="text-3xl font-syne font-black text-white tracking-tight">{stats.checkInRate}%</p>
        </div>

        {/* Core Members Card */}
        <div className="bg-[#18181b]/30 backdrop-blur-md border border-white/10 rounded-[22px] p-5 relative overflow-hidden group hover:border-yellow-500/30 hover:shadow-[0_0_20px_rgba(234,179,8,0.05)] transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/5 rounded-bl-full -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-110"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#a1a1aa] text-xs font-bold uppercase tracking-wider">Core Members</span>
            <div className="w-7 h-7 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400">
              <i className="fas fa-users text-xs"></i>
            </div>
          </div>
          <p className="text-3xl font-syne font-black text-white tracking-tight">{stats.totalUsers}</p>
        </div>
      </div>

      {/* Event Analytics Table */}
      <div className="bg-[#18181b]/30 backdrop-blur-md border border-white/10 rounded-[22px] overflow-hidden shadow-lg mt-8">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-list-alt text-blue-400"></i> Event Analytics
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[#aaaaaa] text-sm uppercase tracking-wider">
                <th className="p-4 font-semibold">Event</th>
                <th className="p-4 font-semibold text-center">Individuals</th>
                <th className="p-4 font-semibold text-center">Teams</th>
                <th className="p-4 font-semibold text-center">Total Members</th>
                <th className="p-4 font-semibold">Check-in Rate</th>
              </tr>
            </thead>
            <tbody className="text-white text-sm divide-y divide-white/10">
              {eventStats.map((stat, idx) => (
                <tr key={idx} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-medium">{stat.title}</td>
                  <td className="p-4 text-center">{stat.individualsRegistered}</td>
                  <td className="p-4 text-center">{stat.teamsRegistered}</td>
                  <td className="p-4 text-center">{stat.totalMembers}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${stat.checkinRate > 50 ? 'bg-green-500' : stat.checkinRate > 20 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                          style={{ width: `${stat.checkinRate}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold w-9 text-right">{stat.checkinRate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {eventStats.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[#aaaaaa]">No event data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
