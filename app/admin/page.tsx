'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import Link from 'next/link'
import AnalyticsDashboard from './AnalyticsDashboard'
import { logAudit, fetchAuditLogs } from './audit_actions'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('events')
  const supabase = createClient()

  const [userRole, setUserRole] = useState<string | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [team, setTeam] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loadingAudit, setLoadingAudit] = useState(true)
  const [allowTeamsToggle, setAllowTeamsToggle] = useState(false)
  
  const [statusMsg, setStatusMsg] = useState<{ id: string, msg: string, type: 'error' | 'success' | 'info' } | null>(null)

  useEffect(() => {
    checkUserRole()
    if (activeTab === 'users') fetchUsers()
    if (activeTab === 'events') fetchEvents()
    if (activeTab === 'team') fetchTeam()
    if (activeTab === 'audit') fetchAuditLogsData()
  }, [activeTab])

  async function fetchAuditLogsData() {
    setLoadingAudit(true)
    const res = await fetchAuditLogs()
    if (res.data) setAuditLogs(res.data)
    setLoadingAudit(false)
  }

  async function checkUserRole() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase.from('member_profiles').select('role').eq('id', session.user.id).single()
    if (data) setUserRole(data.role)
  }

  function showStatus(id: string, msg: string, type: 'error' | 'success' | 'info') {
    setStatusMsg({ id, msg, type })
    setTimeout(() => setStatusMsg(null), 4000)
  }

  // --- IMAGE UPLOAD HELPER ---
  async function uploadImage(file: File, pathPrefix: string) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${pathPrefix}-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    
    const { data, error } = await supabase.storage.from('images').upload(fileName, file)
    if (error) throw error
    
    const { data: publicData } = supabase.storage.from('images').getPublicUrl(fileName)
    return publicData.publicUrl
  }

  // --- USERS ---
  async function fetchUsers() {
    setLoadingUsers(true)
    const { data, error } = await supabase.from('member_profiles').select('*').order('created_at', { ascending: false })
    if (!error && data) setUsers(data)
    setLoadingUsers(false)
  }

  async function updateUserRole(userId: string, newRole: string) {
    showStatus(`user_${userId}`, 'Updating...', 'info')
    const { error } = await supabase.rpc('set_user_roles', { target_user_id: userId, new_role: newRole })
    if (error) showStatus(`user_${userId}`, `Failed: ${error.message}`, 'error')
    else {
      showStatus(`user_${userId}`, 'Updated!', 'success')
      await logAudit('UPDATE_ROLE', { target_user_id: userId, new_role: newRole })
    }
  }

  async function changePassword(userId: string, email: string) {
    const newPassword = prompt(`Enter new password for ${email}:`)
    if (!newPassword) return
    if (newPassword.length < 6) return alert('Password must be at least 6 characters.')

    showStatus(`user_${userId}`, 'Updating password...', 'info')
    const { data: { session } } = await supabase.auth.getSession()
    let err = null
    
    if (session?.user.id === userId) {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      err = error
    } else {
      const { error } = await supabase.rpc('admin_change_password', { target_user_id: userId, new_password: newPassword })
      err = error
    }

    if (err) showStatus(`user_${userId}`, `Failed: ${err.message}`, 'error')
    else {
      showStatus(`user_${userId}`, 'Password Updated!', 'success')
      await logAudit('CHANGE_PASSWORD', { target_user_id: userId, target_email: email })
    }
  }

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`Are you absolutely sure you want to completely DELETE the user ${email}? This action cannot be undone.`)) return

    showStatus(`user_${userId}`, 'Deleting...', 'info')
    const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId })
    
    if (error) {
      showStatus(`user_${userId}`, `Failed: ${error.message}`, 'error')
    } else {
      showStatus(`user_${userId}`, 'User Deleted', 'success')
      fetchUsers()
      await logAudit('DELETE_USER', { target_user_id: userId, target_email: email })
    }
  }

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const role = formData.get('role') as string

    showStatus('create_user', 'Creating account...', 'info')

    // Use a temporary client that does NOT persist the session, to avoid logging out the admin!
    const tempClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data, error } = await tempClient.auth.signUp({ email, password })

    if (error) {
      showStatus('create_user', `Failed: ${error.message}`, 'error')
      return
    }

    if (!data.user) {
      showStatus('create_user', 'Failed: Unknown error, no user returned.', 'error')
      return
    }

    if (data.user.identities && data.user.identities.length === 0) {
      showStatus('create_user', 'Failed: This email already exists!', 'error')
      return
    }

    // Elevate user using main admin session
    if (role !== 'user') {
      const { error: elevateError } = await supabase.rpc('set_user_roles', { target_user_id: data.user.id, new_role: role })
      if (elevateError) {
        showStatus('create_user', `Created, but elevation failed: ${elevateError.message}`, 'error')
        fetchUsers()
        return
      }
    }

    showStatus('create_user', 'Account Created Successfully!', 'success')
    ;(e.target as HTMLFormElement).reset()
    fetchUsers()
    await logAudit('CREATE_USER', { new_email: email, role })
  }

  // --- EVENTS ---
  async function fetchEvents() {
    setLoadingEvents(true)
    const { data, error } = await supabase.from('events').select('*').order('date_start', { ascending: false })
    if (!error && data) setEvents(data)
    setLoadingEvents(false)
  }

  async function handleCreateEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const title = formData.get('title') as string
    const dateStartRaw = formData.get('date_start') as string
    const date_start = dateStartRaw ? new Date(dateStartRaw).toISOString() : new Date().toISOString()
    const status = formData.get('status') as string
    const location = formData.get('location') as string
    const description = formData.get('description') as string
    const imageFile = formData.get('image') as File
    const certificateHtml = formData.get('certificate_html') as string
    const registration_open = formData.get('registration_open') === 'on'

    // Generate slug
    const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    const randomSuffix = Math.random().toString(36).substring(2, 6)
    const slug = `${baseSlug}-${randomSuffix}`

    const form_requirements: Record<string, any> = {
      req_reg_num: formData.get('req_reg_num') === 'on',
      req_branch: formData.get('req_branch') === 'on',
      req_spec: formData.get('req_spec') === 'on',
      allow_teams: formData.get('allow_teams') === 'on',
      allow_external_students: formData.get('allow_external_students') === 'on',
      max_team_size: formData.get('allow_teams') === 'on' ? parseInt(formData.get('max_team_size') as string) || 1 : 1,
      provide_certificates: formData.get('provide_certificates') === 'on',
      certificate_html: certificateHtml || null
    }

    showStatus('create_event', 'Uploading and saving...', 'info')
    
    let image_url = ''
    if (imageFile && imageFile.size > 0) {
      try {
        image_url = await uploadImage(imageFile, 'event')
      } catch (err: any) {
        showStatus('create_event', `Poster Upload Failed: ${err.message}`, 'error')
        return
      }
    }

    const maxCapStr = formData.get('max_capacity') as string
    const max_capacity = maxCapStr ? parseInt(maxCapStr) : null

    const { error } = await supabase.from('events').insert([{ 
      title, slug, date_start, status, location, description: formData.get('description'), image_url, registration_open, form_requirements, certificate_html: certificateHtml, max_capacity 
    }])
    
    if (error) {
      showStatus('create_event', `Failed: ${error.message}`, 'error')
    } else {
      showStatus('create_event', 'Event Created Successfully!', 'success')
      ;(e.target as HTMLFormElement).reset()
      fetchEvents()
      await logAudit('CREATE_EVENT', { title })
    }
  }

  async function deleteEvent(id: string, title: string) {
    if (confirm("Are you sure you want to delete this event?")) {
      await supabase.from('events').delete().eq('id', id)
      fetchEvents()
      await logAudit('DELETE_EVENT', { event_id: id, title })
    }
  }

  async function toggleRegistration(id: string, currentState: boolean) {
    showStatus(`event_${id}`, 'Toggling...', 'info')
    const { error } = await supabase.from('events').update({ registration_open: !currentState }).eq('id', id)
    if (error) {
      showStatus(`event_${id}`, `Failed: ${error.message}`, 'error')
    } else {
      fetchEvents()
      await logAudit('TOGGLE_REGISTRATION', { event_id: id, registration_open: !currentState })
    }
  }

  // --- TEAM ---
  async function fetchTeam() {
    setLoadingTeam(true)
    const { data, error } = await supabase.from('team_members').select('*').order('created_at', { ascending: true })
    if (!error && data) setTeam(data)
    setLoadingTeam(false)
  }

  async function handleCreateTeam(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    const role = formData.get('role') as string
    const linkedin_url = formData.get('linkedin_url') as string
    const github_url = formData.get('github_url') as string
    const imageFile = formData.get('image') as File

    showStatus('create_team', 'Uploading and saving...', 'info')
    
    let image_url = ''
    if (imageFile && imageFile.size > 0) {
      try {
        image_url = await uploadImage(imageFile, 'team')
      } catch (err: any) {
        showStatus('create_team', `Upload Failed: ${err.message}`, 'error')
        return
      }
    }

    const { error } = await supabase.from('team_members').insert([{ name, role, linkedin_url, github_url, image_url, category: 'team' }])
    
    if (error) {
      showStatus('create_team', `Failed: ${error.message}`, 'error')
    } else {
      showStatus('create_team', 'Team Member Created Successfully!', 'success')
      ;(e.target as HTMLFormElement).reset()
      fetchTeam()
    }
  }

  async function deleteTeam(id: string) {
    if (confirm("Are you sure you want to delete this member?")) {
      await supabase.from('team_members').delete().eq('id', id)
      fetchTeam()
    }
  }

  return (
    <div className="flex h-screen bg-[#09090b] text-[#f4f4f5] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[260px] bg-[#18181b] border-r border-white/10 flex flex-col p-8 z-10">
        <div className="text-2xl font-extrabold mb-10 bg-gradient-to-br from-blue-500 to-purple-500 bg-clip-text text-transparent uppercase tracking-wider flex items-center gap-2 text-center leading-tight">
          {userRole === 'admin' ? 'MSC ADMIN' : 'CORE WORKSPACE'}
        </div>
        <div className="flex flex-col gap-3">
          {userRole === 'admin' && (
            <>
              <button onClick={() => setActiveTab('users')} className={`px-5 py-3 rounded-xl font-medium transition-all text-left ${activeTab === 'users' ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-[0_4px_15px_rgba(59,130,246,0.25)]' : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'}`}>User Access</button>
              <button onClick={() => setActiveTab('audit')} className={`px-5 py-3 rounded-xl font-medium transition-all text-left ${activeTab === 'audit' ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-[0_4px_15px_rgba(59,130,246,0.25)]' : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'}`}>Audit Logs</button>
            </>
          )}
          <button onClick={() => setActiveTab('events')} className={`px-5 py-3 rounded-xl font-medium transition-all text-left ${activeTab === 'events' ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-[0_4px_15px_rgba(59,130,246,0.25)]' : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'}`}>Events</button>
          <button onClick={() => setActiveTab('team')} className={`px-5 py-3 rounded-xl font-medium transition-all text-left ${activeTab === 'team' ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-[0_4px_15px_rgba(59,130,246,0.25)]' : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'}`}>Team Members</button>
          <button onClick={() => setActiveTab('analytics')} className={`px-5 py-3 rounded-xl font-medium transition-all text-left ${activeTab === 'analytics' ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-[0_4px_15px_rgba(59,130,246,0.25)]' : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'}`}>Analytics</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-10 relative">
        <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full bg-blue-500/15 blur-[100px] z-0 pointer-events-none"></div>
        <div className="absolute bottom-[-100px] left-[10%] w-[500px] h-[500px] rounded-full bg-purple-500/10 blur-[120px] z-0 pointer-events-none"></div>

        <div className="relative z-10 max-w-6xl mx-auto">
          {/* USERS TAB (Admins Only) */}
          {activeTab === 'users' && userRole === 'admin' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-3xl font-bold mb-8 text-[#f4f4f5] tracking-tight">Provision Core Members</h2>
              
              {/* Create User Form */}
              <div className="bg-[#18181b]/60 backdrop-blur-xl border border-white/10 rounded-[20px] p-8 mb-8 shadow-2xl">
                <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Email Address</label>
                    <input type="email" name="email" required placeholder="new@member.com" autoComplete="off" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Password</label>
                    <input type="password" name="password" required placeholder="••••••••" autoComplete="new-password" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Assign Role</label>
                    <select name="role" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 appearance-none">
                      <option value="core_member">Core Member</option>
                    </select>
                  </div>
                  <div>
                    <button type="submit" className="w-full p-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl font-bold transition-all shadow-lg text-white">Create Account</button>
                  </div>
                </form>
                {statusMsg?.id === 'create_user' && <div className={`mt-4 text-sm font-semibold ${statusMsg.type === 'error' ? 'text-red-500' : statusMsg.type === 'success' ? 'text-green-500' : 'text-blue-400'}`}>{statusMsg.msg}</div>}
              </div>

              {/* User Table */}
              <div className="bg-[#18181b]/60 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-black/20 text-[#a1a1aa] font-semibold text-[13px] uppercase tracking-wider p-5 border-b border-white/10">Email Address</th>
                      <th className="bg-black/20 text-[#a1a1aa] font-semibold text-[13px] uppercase tracking-wider p-5 border-b border-white/10">Role</th>
                      <th className="bg-black/20 text-[#a1a1aa] font-semibold text-[13px] uppercase tracking-wider p-5 border-b border-white/10 text-right">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingUsers ? (
                      <tr><td colSpan={3} className="text-center p-10 text-[#a1a1aa]">Loading system users...</td></tr>
                    ) : users.length === 0 ? (
                      <tr><td colSpan={3} className="text-center p-10 text-[#a1a1aa]">No users found.</td></tr>
                    ) : (
                      users.map(u => (
                        <tr key={u.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-5 border-b border-white/5">{u.email}</td>
                          <td className="p-5 border-b border-white/5">
                            <select
                              defaultValue={u.role}
                              onChange={(e) => updateUserRole(u.id, e.target.value)}
                              disabled={u.role === 'admin'}
                              className="p-2 rounded-md bg-black/30 text-white border border-white/20 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            >
                              <option value="core_member">Core Member</option>
                              {u.role === 'admin' && <option value="admin">Admin</option>}
                            </select>
                          </td>
                          <td className="p-5 border-b border-white/5 text-right space-x-2">
                            <span className={`text-sm mr-4 ${statusMsg?.id === `user_${u.id}` ? (statusMsg.type === 'error' ? 'text-red-500' : statusMsg.type === 'success' ? 'text-green-500' : 'text-gray-400') : 'hidden'}`}>{statusMsg?.id === `user_${u.id}` ? statusMsg.msg : ''}</span>
                            <button onClick={() => changePassword(u.id, u.email)} disabled={u.role === 'admin'} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-30">Change Password</button>
                            <button onClick={() => deleteUser(u.id, u.email)} disabled={u.role === 'admin'} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-30">Delete</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* EVENTS TAB */}
          {activeTab === 'events' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-3xl font-bold mb-8 text-[#f4f4f5] tracking-tight">Events Management</h2>
              
              {/* Create Event Form */}
              {userRole === 'admin' && (
                <div className="bg-[#18181b]/60 backdrop-blur-xl border border-white/10 rounded-[20px] p-8 mb-8 shadow-2xl">
                <form onSubmit={handleCreateEvent} className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Event Title</label>
                      <input type="text" name="title" required placeholder="e.g. Hackathon 2026" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Date & Time</label>
                      <input type="datetime-local" name="date_start" required className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Status</label>
                      <select name="status" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 appearance-none">
                        <option value="upcoming">Upcoming</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Venue / Location</label>
                    <input type="text" name="location" placeholder="e.g. Mini Auditorium, SR-Block" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Event Description</label>
                    <textarea name="description" rows={3} required placeholder="Describe what the event is about..." className="p-4 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500"></textarea>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Maximum Capacity (Optional)</label>
                    <input type="number" name="max_capacity" min="1" placeholder="e.g. 100 (Leave empty for unlimited)" className="p-4 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                    <span className="text-[10px] text-white/40">If set, any registrations past this limit will automatically be placed on a Waitlist.</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-[#a1a1aa] uppercase tracking-wider mb-2">Event Poster <span className="text-white/30 lowercase font-normal">(optional)</span></label>
                      <input type="file" name="image" accept="image/*" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-500/20 file:text-blue-400 hover:file:bg-blue-500/30 transition-all cursor-pointer" />
                    </div>
                    
                    <div className="flex flex-col gap-2 justify-center">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" name="registration_open" className="w-5 h-5 accent-blue-500 cursor-pointer" />
                        <span className="text-sm font-bold text-white">Open Registrations Immediately</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-bold text-[#a1a1aa] uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Certificate HTML Template</span>
                      <span className="text-[10px] text-yellow-500/80 normal-case font-normal">Optional. Supports Placeholders: {`{{NAME}}, {{EVENT_TITLE}}, {{EVENT_DATE}}, {{COLLEGE_NAME}}`}</span>
                    </label>
                    <textarea 
                      name="certificate_html" 
                      rows={6}
                      placeholder={`<div style="font-family: sans-serif; text-align: center; padding: 40px; background: white; color: black; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">\n  <h1 style="color: #3b82f6;">Certificate of Participation</h1>\n  <p>Proudly presented to</p>\n  <h2>{{NAME}}</h2>\n  <p>For participating in {{EVENT_TITLE}} on {{EVENT_DATE}}.</p>\n</div>`}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-mono text-xs focus:outline-none focus:border-yellow-500"
                    ></textarea>
                  </div>

                  {/* Form Builder Section */}
                  <div className="mt-4 p-5 bg-black/30 border border-white/5 rounded-xl">
                    <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Public Registration Form Setup</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-3">
                        <label className="flex items-center gap-3 cursor-not-allowed opacity-70">
                          <input type="checkbox" defaultChecked disabled className="w-4 h-4 accent-blue-500" />
                          <span className="text-sm text-white/80">Require Student Email (Mandatory)</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" name="req_reg_num" defaultChecked className="w-4 h-4 accent-blue-500 cursor-pointer" />
                          <span className="text-sm text-white/80">Require Registration Number</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" name="req_branch" className="w-4 h-4 accent-blue-500 cursor-pointer" />
                          <span className="text-sm text-white/80">Require Branch</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" name="req_spec" className="w-4 h-4 accent-blue-500 cursor-pointer" />
                          <span className="text-sm text-white/80">Require Specialization</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" name="allow_external_students" className="w-4 h-4 accent-blue-500 cursor-pointer" />
                          <span className="text-sm text-white/80 text-blue-300 font-semibold">Allow Students from Other Colleges</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                          <input type="checkbox" name="provide_certificates" defaultChecked className="w-4 h-4 accent-blue-500 cursor-pointer" />
                          <span className="text-sm font-semibold text-white/80">Provide E-Certificates</span>
                        </label>
                      </div>
                      
                      <div className="flex flex-col gap-3 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-4">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" name="allow_teams" checked={allowTeamsToggle} onChange={(e) => setAllowTeamsToggle(e.target.checked)} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                          <span className="text-sm text-white/80 font-semibold text-blue-400">Allow Team Registrations</span>
                        </label>
                        {allowTeamsToggle && (
                          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
                            <span className="text-sm text-white/60">Max Team Size:</span>
                            <input type="number" name="max_team_size" defaultValue={3} min={2} max={10} className="w-20 p-2 bg-black/40 border border-white/10 rounded-lg text-white text-center focus:outline-none focus:border-blue-500" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-2">
                    <div className={`text-sm font-semibold ${statusMsg?.type === 'error' ? 'text-red-500' : statusMsg?.type === 'success' ? 'text-green-500' : 'text-blue-400'}`}>
                      {statusMsg?.id === 'create_event' && statusMsg.msg}
                    </div>
                    <button type="submit" className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl font-bold transition-all shadow-lg text-white">Save Event</button>
                  </div>
                </form>
              </div>
              )}

              {/* Event Table */}
              <div className="bg-[#18181b]/60 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-black/20 text-[#a1a1aa] font-semibold text-[13px] uppercase tracking-wider p-5 border-b border-white/10">Title</th>
                      <th className="bg-black/20 text-[#a1a1aa] font-semibold text-[13px] uppercase tracking-wider p-5 border-b border-white/10">Date</th>
                      <th className="bg-black/20 text-[#a1a1aa] font-semibold text-[13px] uppercase tracking-wider p-5 border-b border-white/10">Status</th>
                      <th className="bg-black/20 text-[#a1a1aa] font-semibold text-[13px] uppercase tracking-wider p-5 border-b border-white/10 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingEvents ? (
                      <tr><td colSpan={4} className="text-center p-10 text-[#a1a1aa]">Loading events...</td></tr>
                    ) : (
                      events.map(evt => (
                        <tr key={evt.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-5 border-b border-white/5">
                            <Link href={`/admin/events/${evt.id}`} className="font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2">
                              {evt.title} <i className="fas fa-external-link-alt text-[10px]"></i>
                            </Link>
                          </td>
                          <td className="p-5 border-b border-white/5">{new Date(evt.date_start).toLocaleString()}</td>
                          <td className="p-5 border-b border-white/5"><span className={`px-3 py-1 border rounded-full text-xs font-bold uppercase tracking-wider ${evt.status === 'upcoming' ? 'bg-green-500/15 text-green-500 border-green-500/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>{evt.status}</span></td>
                          <td className="p-5 border-b border-white/5 text-right space-x-2">
                            <span className={`text-sm mr-4 ${statusMsg?.id === `event_${evt.id}` ? (statusMsg.type === 'error' ? 'text-red-500' : statusMsg.type === 'success' ? 'text-green-500' : 'text-gray-400') : 'hidden'}`}>{statusMsg?.id === `event_${evt.id}` ? statusMsg.msg : ''}</span>
                            
                            <Link href={`/admin/events/${evt.id}`} className="px-4 py-2 border rounded-lg text-[13px] font-semibold transition-colors bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500 hover:text-white mr-2 inline-block">
                              Registrations
                            </Link>
                            
                            {userRole === 'admin' && (
                              <>
                                <button onClick={() => toggleRegistration(evt.id, !!evt.registration_open)} className={`px-4 py-2 border rounded-lg text-[13px] font-semibold transition-colors ${evt.registration_open ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500 hover:text-white' : 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500 hover:text-white'}`}>
                                  {evt.registration_open ? 'Close' : 'Open'}
                                </button>
                                <button onClick={() => deleteEvent(evt.id, evt.title)} className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white rounded-lg text-[13px] font-semibold transition-colors">Delete</button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TEAM TAB */}
          {activeTab === 'team' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-3xl font-bold mb-8 text-[#f4f4f5] tracking-tight">Team Directory</h2>
              
              {/* Create Team Form */}
              {userRole === 'admin' && (
                <div className="bg-[#18181b]/60 backdrop-blur-xl border border-white/10 rounded-[20px] p-8 mb-8 shadow-2xl">
                <form onSubmit={handleCreateTeam} className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Full Name</label>
                      <input type="text" name="name" required placeholder="e.g. John Doe" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Role</label>
                      <input type="text" name="role" required placeholder="e.g. Core Member" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">LinkedIn URL</label>
                      <input type="url" name="linkedin_url" placeholder="https://linkedin.com/in/..." className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">GitHub URL</label>
                      <input type="url" name="github_url" placeholder="https://github.com/..." className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Profile Picture (Upload)</label>
                    <input type="file" name="image" accept="image/*" className="p-2 bg-black/40 border border-white/10 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20" />
                  </div>

                  <div className="flex justify-between items-center mt-2">
                    <div className={`text-sm font-semibold ${statusMsg?.type === 'error' ? 'text-red-500' : statusMsg?.type === 'success' ? 'text-green-500' : 'text-blue-400'}`}>
                      {statusMsg?.id === 'create_team' && statusMsg.msg}
                    </div>
                    <button type="submit" className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl font-bold transition-all shadow-lg text-white">Save Member</button>
                  </div>
                </form>
              </div>
              )}

              {/* Team Table */}
              <div className="bg-[#18181b]/60 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-black/20 text-[#a1a1aa] font-semibold text-[13px] uppercase tracking-wider p-5 border-b border-white/10">Name</th>
                      <th className="bg-black/20 text-[#a1a1aa] font-semibold text-[13px] uppercase tracking-wider p-5 border-b border-white/10">Role</th>
                      <th className="bg-black/20 text-[#a1a1aa] font-semibold text-[13px] uppercase tracking-wider p-5 border-b border-white/10 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingTeam ? (
                      <tr><td colSpan={3} className="text-center p-10 text-[#a1a1aa]">Loading team...</td></tr>
                    ) : (
                      team.map(member => (
                        <tr key={member.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-5 border-b border-white/5">{member.name}</td>
                          <td className="p-5 border-b border-white/5">{member.role}</td>
                          <td className="p-5 border-b border-white/5 text-right">
                            {userRole === 'admin' && (
                              <button onClick={() => deleteTeam(member.id)} className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white rounded-lg text-[13px] font-semibold transition-colors">Delete</button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && <AnalyticsDashboard />}

          {/* AUDIT LOGS TAB (Admins Only) */}
          {userRole === 'admin' && activeTab === 'audit' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-black text-white tracking-wider">SECURITY AUDIT LOGS</h1>
                  <p className="text-[#a1a1aa] mt-2">Immutable record of all administrative actions taken on the platform.</p>
                </div>
                <button onClick={fetchAuditLogsData} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[13px] font-semibold text-white transition-colors flex items-center gap-2">
                  <i className="fas fa-sync-alt"></i> Refresh Logs
                </button>
              </div>

              <div className="bg-black/30 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-md overflow-x-auto">
                {loadingAudit ? (
                  <div className="flex justify-center p-12">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <p className="text-white/40 text-center py-8">No audit logs found.</p>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-[11px] uppercase tracking-widest text-[#a1a1aa]">
                        <th className="p-4 font-bold">Timestamp</th>
                        <th className="p-4 font-bold">Admin Email</th>
                        <th className="p-4 font-bold">Action</th>
                        <th className="p-4 font-bold">Metadata Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                          <td className="p-4 text-xs text-white/60 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                          <td className="p-4 text-sm font-bold text-blue-400">{log.admin_email}</td>
                          <td className="p-4">
                            <span className="px-2 py-1 bg-white/10 text-white text-[10px] font-black tracking-widest rounded-md border border-white/10">
                              {log.action_type}
                            </span>
                          </td>
                          <td className="p-4">
                            <pre className="text-[10px] text-white/50 font-mono bg-black/50 p-2 rounded-lg overflow-x-auto max-w-sm">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
