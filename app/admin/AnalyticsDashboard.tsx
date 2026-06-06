'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export default function AnalyticsDashboard() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEvents: 0,
    totalRegistrations: 0,
    checkInRate: 0,
  })
  const [registrationData, setRegistrationData] = useState<any[]>([])
  const [departmentData, setDepartmentData] = useState<any[]>([])

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1']

  useEffect(() => {
    fetchAnalytics()
  }, [])

  async function fetchAnalytics() {
    setLoading(true)

    // Parallel fetch for speed
    const [
      { count: usersCount },
      { count: eventsCount },
      { data: regs }
    ] = await Promise.all([
      supabase.from('member_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('registrations').select('created_at, checked_in, form_data')
    ])

    const totalRegs = regs?.length || 0
    const checkedInRegs = regs?.filter(r => r.checked_in).length || 0
    const rate = totalRegs > 0 ? Math.round((checkedInRegs / totalRegs) * 100) : 0

    setStats({
      totalUsers: usersCount || 0,
      totalEvents: eventsCount || 0,
      totalRegistrations: totalRegs,
      checkInRate: rate
    })

    // Process Timeline Data (Registrations by Date)
    if (regs) {
      const dateMap: Record<string, number> = {}
      const deptMap: Record<string, number> = {}

      regs.forEach(reg => {
        // Date processing
        const dateObj = new Date(reg.created_at)
        const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`
        dateMap[dateStr] = (dateMap[dateStr] || 0) + 1

        // Department processing
        const dept = reg.form_data?.branch || 'Other'
        deptMap[dept] = (deptMap[dept] || 0) + 1
      })

      // Convert to array for Recharts
      const timelineArray = Object.keys(dateMap).map(date => ({
        date,
        registrations: dateMap[date]
      }))
      
      const deptArray = Object.keys(deptMap).map(name => ({
        name: name.toUpperCase(),
        value: deptMap[name]
      })).sort((a, b) => b.value - a.value).slice(0, 6) // Top 6

      setRegistrationData(timelineArray)
      setDepartmentData(deptArray)
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-3xl font-bold mb-8 text-[#f4f4f5] tracking-tight">Platform Analytics</h2>
      
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <p className="text-[#a1a1aa] text-sm font-bold uppercase tracking-wider mb-2">Total Platform Users</p>
          <p className="text-4xl font-black text-white">{stats.totalUsers}</p>
        </div>
        
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-purple-500/30 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <p className="text-[#a1a1aa] text-sm font-bold uppercase tracking-wider mb-2">Events Hosted</p>
          <p className="text-4xl font-black text-white">{stats.totalEvents}</p>
        </div>

        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-pink-500/30 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <p className="text-[#a1a1aa] text-sm font-bold uppercase tracking-wider mb-2">Total Registrations</p>
          <p className="text-4xl font-black text-white">{stats.totalRegistrations}</p>
        </div>

        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-green-500/30 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <p className="text-[#a1a1aa] text-sm font-bold uppercase tracking-wider mb-2">Avg. Check-in Rate</p>
          <p className="text-4xl font-black text-white">{stats.checkInRate}%</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Registration Timeline */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <i className="fas fa-chart-line text-blue-400"></i> Registration Velocity
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={registrationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} />
                <YAxis stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white' }}
                  itemStyle={{ color: '#60a5fa', fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="registrations" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#18181b' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Demographics */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <i className="fas fa-chart-pie text-purple-400"></i> Branch Demographics
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={departmentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({name, percent}) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                >
                  {departmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white' }}
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
