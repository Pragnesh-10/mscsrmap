'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts'

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
  const [registrationData, setRegistrationData] = useState<any[]>([])
  const [departmentData, setDepartmentData] = useState<any[]>([])
  const [eventData, setEventData] = useState<any[]>([])

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1']

  useEffect(() => {
    fetchAnalytics()
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

      const dateMap: Record<string, number> = {}
      const deptMap: Record<string, number> = {}
      const eventMap: Record<string, number> = {}

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

          // 2. Timeline Aggregation (group by sorted date keys: YYYY-MM-DD)
          const dateObj = new Date(reg.created_at)
          const year = dateObj.getFullYear()
          const month = String(dateObj.getMonth() + 1).padStart(2, '0')
          const day = String(dateObj.getDate()).padStart(2, '0')
          const dateKey = `${year}-${month}-${day}`
          dateMap[dateKey] = (dateMap[dateKey] || 0) + attendeeCount

          // 3. Department Demographics (include team members for accuracy)
          const leadBranch = (reg.form_data as any)?.branch || 'Other'
          deptMap[leadBranch] = (deptMap[leadBranch] || 0) + 1

          teamMembers.forEach(member => {
            const memberBranch = member.branch || 'Other'
            deptMap[memberBranch] = (deptMap[memberBranch] || 0) + 1
          })

          // 4. Event popularity metrics
          const eventTitle = (reg.events as any)?.title || 'Unknown Event'
          eventMap[eventTitle] = (eventMap[eventTitle] || 0) + attendeeCount
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

      // Convert timeline map to chronologically sorted array
      const timelineArray = Object.keys(dateMap)
        .sort()
        .map(dateKey => {
          const [y, m, d] = dateKey.split('-')
          const formattedDate = new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return {
            date: formattedDate,
            participants: dateMap[dateKey]
          }
        })

      // Convert department map to sorted array
      const deptArray = Object.keys(deptMap)
        .map(name => ({
          name: name.toUpperCase().trim(),
          value: deptMap[name]
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)

      // Convert event popularity map to sorted array
      const eventArray = Object.keys(eventMap)
        .map(title => ({
          title,
          participants: eventMap[title]
        }))
        .sort((a, b) => b.participants - a.participants)
        .slice(0, 5)

      setRegistrationData(timelineArray)
      setDepartmentData(deptArray)
      setEventData(eventArray)

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

      {/* Main Timeline Chart */}
      <div className="bg-[#18181b]/30 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-lg">
        <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2">
          <i className="fas fa-chart-line text-blue-400"></i> Participant Registration Velocity
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={registrationData}>
              <defs>
                <linearGradient id="registrationVelocity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.015)" vertical={false} />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.12)" tick={{fill: 'rgba(255,255,255,0.4)', fontSize: 10}} />
              <YAxis stroke="rgba(255,255,255,0.12)" tick={{fill: 'rgba(255,255,255,0.4)', fontSize: 10}} allowDecimals={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#09090b', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '14px', color: 'white', backdropFilter: 'blur(10px)' }}
                itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
              />
              <Area type="monotone" dataKey="participants" name="Participants" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#registrationVelocity)" dot={{ r: 3, fill: '#09090b', strokeWidth: 1.5, stroke: '#3b82f6' }} activeDot={{ r: 5, strokeWidth: 0, fill: '#60a5fa' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Split Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Event Popularity */}
        <div className="bg-[#18181b]/30 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-lg">
          <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2">
            <i className="fas fa-fire text-amber-400"></i> Event Popularity (Top 5)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eventData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" horizontal={false} />
                <XAxis type="number" stroke="rgba(255,255,255,0.2)" tick={{fill: 'rgba(255,255,255,0.4)', fontSize: 11}} allowDecimals={false} />
                <YAxis type="category" dataKey="title" stroke="rgba(255,255,255,0.2)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 10}} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px', color: 'white', backdropFilter: 'blur(10px)' }}
                  itemStyle={{ color: '#ec4899', fontWeight: 'bold' }}
                />
                <Bar dataKey="participants" name="Participants" fill="#ec4899" radius={[0, 8, 8, 0]} barSize={16}>
                  {eventData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Demographics */}
        <div className="bg-[#18181b]/30 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-lg">
          <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2">
            <i className="fas fa-chart-pie text-purple-400"></i> Branch Demographics (Top 6)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={departmentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                  label={({name, percent}) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={{ stroke: 'rgba(255,255,255,0.15)' }}
                >
                  {departmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px', color: 'white', backdropFilter: 'blur(10px)' }}
                  itemStyle={{ color: 'white', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
