'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const AnalyticsDashboard = dynamic(() => import('./AnalyticsDashboard'), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse space-y-8">
      <div className="h-10 bg-white/10 rounded-lg w-1/4 mb-4"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-[#18181b]/20 border border-white/5 rounded-[22px] p-5 h-28"></div>
        ))}
      </div>
      <div className="bg-[#18181b]/20 border border-white/5 rounded-2xl h-80"></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#18181b]/20 border border-white/5 rounded-2xl h-80"></div>
        <div className="bg-[#18181b]/20 border border-white/5 rounded-2xl h-80"></div>
      </div>
    </div>
  )
})

import SettingsTab from './SettingsTab'
import PasswordRequestsTab from './PasswordRequestsTab'

export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') => {
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

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'events' | 'team' | 'analytics' | 'settings' | 'password_reqs'>('events')
  const supabase = createClient()

  const [userRole, setUserRole] = useState<'admin' | 'core_member' | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [team, setTeam] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [editingTeamMember, setEditingTeamMember] = useState<any>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [allowTeamsToggle, setAllowTeamsToggle] = useState(false)
  const [eventPricingType, setEventPricingType] = useState<'free' | 'paid'>('free')
  const [chargeType, setChargeType] = useState<'per_person' | 'per_team'>('per_person')
  
  const [statusMsg, setStatusMsg] = useState<{ id: string, msg: string, type: 'error' | 'success' | 'info' } | null>(null)

  // Custom Modal States
  const [resettingUser, setResettingUser] = useState<{ id: string, email: string } | null>(null)
  const [newPasswordValue, setNewPasswordValue] = useState('')
  const [resetModalError, setResetModalError] = useState<string | null>(null)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [deletingUser, setDeletingUser] = useState<{ id: string, email: string } | null>(null)

  useEffect(() => {
    checkUserRole()
    if (activeTab === 'users') fetchUsers()
    if (activeTab === 'events') fetchEvents()
    if (activeTab === 'team') fetchTeam()
  }, [activeTab])

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

  async function compressAndConvertImage(file: File, maxW = 900, maxH = 900, quality = 0.72): Promise<File> {
    if (typeof window === 'undefined' || !window.FileReader) return file
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > maxW) {
              height = Math.round((height * maxW) / width)
              width = maxW
            }
          } else {
            if (height > maxH) {
              width = Math.round((width * maxH) / height)
              height = maxH
            }
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(file)
            return
          }

          ctx.drawImage(img, 0, 0, width, height)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                  type: 'image/webp',
                  lastModified: Date.now()
                })
                resolve(compressedFile)
              } else {
                resolve(file)
              }
            },
            'image/webp',
            quality
          )
        }
        img.onerror = () => resolve(file)
      }
      reader.onerror = () => resolve(file)
    })
  }

  async function uploadImage(file: File, pathPrefix: string) {
    const compressed = await compressAndConvertImage(file)
    const fileName = `${pathPrefix}-${Math.random().toString(36).substring(2)}-${Date.now()}.webp`
    
    const { data, error } = await supabase.storage.from('images').upload(fileName, compressed)
    if (error) throw error
    
    const { data: publicData } = supabase.storage.from('images').getPublicUrl(fileName)
    return publicData.publicUrl
  }

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
    }
  }

  const openPasswordResetModal = (userId: string, email: string) => {
    setResettingUser({ id: userId, email })
    setNewPasswordValue('')
    setResetModalError(null)
  }

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resettingUser) return
    if (newPasswordValue.length < 6) {
      setResetModalError('Password must be at least 6 characters.')
      triggerHaptic('error')
      return
    }

    setIsResettingPassword(true)
    setResetModalError(null)
    
    showStatus(`user_${resettingUser.id}`, 'Updating password...', 'info')
    const { data: { session } } = await supabase.auth.getSession()
    let err = null
    
    if (session?.user.id === resettingUser.id) {
      const { error } = await supabase.auth.updateUser({ password: newPasswordValue })
      err = error
    } else {
      const { error } = await supabase.rpc('admin_change_password', { target_user_id: resettingUser.id, new_password: newPasswordValue })
      err = error
    }

    setIsResettingPassword(false)

    if (err) {
      setResetModalError(err.message)
      showStatus(`user_${resettingUser.id}`, `Failed: ${err.message}`, 'error')
      triggerHaptic('error')
    } else {
      showStatus(`user_${resettingUser.id}`, 'Password Updated!', 'success')
      setResettingUser(null)
      triggerHaptic('success')
    }
  }

  const openDeleteUserModal = (userId: string, email: string) => {
    setDeletingUser({ id: userId, email })
  }

  const confirmDeleteUser = async () => {
    if (!deletingUser) return
    const userId = deletingUser.id
    const email = deletingUser.email

    setDeletingUser(null)
    showStatus(`user_${userId}`, 'Deleting...', 'info')
    
    const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId })
    
    if (error) {
      showStatus(`user_${userId}`, `Failed: ${error.message}`, 'error')
      triggerHaptic('error')
    } else {
      showStatus(`user_${userId}`, 'User Deleted', 'success')
      fetchUsers()
      triggerHaptic('success')
    }
  }

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const role = formData.get('role') as string

    showStatus('create_user', 'Creating account...', 'info')

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
  }

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
    const type = formData.get('type') as string
    const imageFile = formData.get('image') as File
    const certificateHtml = formData.get('certificate_html') as string
    
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
      certificate_html: certificateHtml || null,
      event_pricing: eventPricingType,
      charge_type: eventPricingType === 'paid' ? chargeType : null,
      registration_fee: eventPricingType === 'paid' ? parseInt(formData.get('registration_fee') as string) || 0 : 0,
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
      title, slug, date_start, status, type, location: formData.get('location'), description: formData.get('description'), image_url, registration_open: formData.get('registration_open') === 'on', form_requirements, certificate_html: certificateHtml, max_capacity 
    }])
    
    if (error) {
      showStatus('create_event', `Failed: ${error.message}`, 'error')
    } else {
      showStatus('create_event', 'Event Created Successfully!', 'success')
      ;(e.target as HTMLFormElement).reset()
      fetchEvents()
    }
  }

  async function deleteEvent(id: string, title: string) {
    if (confirm("Are you sure you want to delete this event?")) {
      const { data: evt } = await supabase.from('events').select('image_url').eq('id', id).single()
      if (evt?.image_url) {
        try {
          const url = evt.image_url
          if (url.includes('/storage/v1/object/public/images/')) {
            const path = url.split('/storage/v1/object/public/images/')[1]
            await supabase.storage.from('images').remove([path])
          }
        } catch (err) {
          console.error('Failed to remove event poster from storage:', err)
        }
      }
      await supabase.from('events').delete().eq('id', id)
      fetchEvents()
    }
  }

  async function toggleRegistration(id: string, currentState: boolean) {
    showStatus(`event_${id}`, 'Toggling...', 'info')
    const { error } = await supabase.from('events').update({ registration_open: !currentState }).eq('id', id)
    if (error) {
      showStatus(`event_${id}`, `Failed: ${error.message}`, 'error')
    } else {
      fetchEvents()
    }
  }

  async function toggleEventStatus(id: string, currentStatus: string) {
    showStatus(`event_${id}`, 'Updating status...', 'info')
    const newStatus = currentStatus === 'completed' ? 'upcoming' : 'completed'
    const { error } = await supabase.from('events').update({ status: newStatus }).eq('id', id)
    if (error) {
      showStatus(`event_${id}`, `Failed: ${error.message}`, 'error')
    } else {
      fetchEvents()
    }
  }

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
    const twitter_url = formData.get('twitter_url') as string
    const instagram_url = formData.get('instagram_url') as string
    const email = formData.get('email') as string
    const portfolio_url = formData.get('portfolio_url') as string
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

    const payload = { name, role, linkedin_url, github_url, twitter_url, instagram_url, email, portfolio_url, image_url, category: 'team' }

    const { error } = await supabase.from('team_members').insert([payload])
    if (error) {
      showStatus('create_team', `Failed: ${error.message}`, 'error')
    } else {
      showStatus('create_team', 'Team Member Created Successfully!', 'success')
      ;(e.target as HTMLFormElement).reset()
      fetchTeam()
    }
  }

  async function handleUpdateTeam(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingTeamMember) return

    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    const role = formData.get('role') as string
    const linkedin_url = formData.get('linkedin_url') as string
    const github_url = formData.get('github_url') as string
    const twitter_url = formData.get('twitter_url') as string
    const instagram_url = formData.get('instagram_url') as string
    const email = formData.get('email') as string
    const portfolio_url = formData.get('portfolio_url') as string
    const imageFile = formData.get('image') as File

    showStatus('update_team', 'Uploading and updating...', 'info')
    
    let image_url = editingTeamMember.image_url || ''
    if (imageFile && imageFile.size > 0) {
      try {
        image_url = await uploadImage(imageFile, 'team')
      } catch (err: any) {
        showStatus('update_team', `Upload Failed: ${err.message}`, 'error')
        return
      }
    }

    const payload = { name, role, linkedin_url, github_url, twitter_url, instagram_url, email, portfolio_url, image_url, category: 'team' }

    const { error } = await supabase.from('team_members').update(payload).eq('id', editingTeamMember.id)
    if (error) {
      showStatus('update_team', `Failed: ${error.message}`, 'error')
    } else {
      showStatus('update_team', 'Team Member Updated Successfully!', 'success')
      setEditingTeamMember(null)
      fetchTeam()
    }
  }

  async function deleteTeam(id: string) {
    if (confirm("Are you sure you want to delete this member?")) {
      const { data: member } = await supabase.from('team_members').select('image_url').eq('id', id).single()
      if (member?.image_url) {
        try {
          const url = member.image_url
          if (url.includes('/storage/v1/object/public/images/')) {
            const path = url.split('/storage/v1/object/public/images/')[1]
            await supabase.storage.from('images').remove([path])
          }
        } catch (err) {
          console.error('Failed to remove team member avatar from storage:', err)
        }
      }
      await supabase.from('team_members').delete().eq('id', id)
      fetchTeam()
    }
  }

  if (userRole === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans relative overflow-hidden">
        {/* Glowing Backgrounds */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[10%] w-[600px] h-[600px] rounded-full bg-purple-500/8 blur-[150px]"></div>
        
        {/* Brand Preloader Content */}
        <div className="flex flex-col items-center gap-6 animate-pulse z-10">
          <img src="https://lkbwunzswqbnoygxtilm.supabase.co/storage/v1/object/public/webpage/MSC%20Logo.png" alt="MSC Logo" className="w-16 h-16 object-contain animate-bounce" style={{ animationDuration: '2s' }} />
          <div className="flex flex-col items-center gap-1">
            <h1 className="font-syne font-black tracking-widest text-xl bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
              MSC PORTAL
            </h1>
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Establishing Secure Handshake...</p>
          </div>
          <div className="w-8 h-8 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-[#09090b] text-[#f4f4f5] font-sans overflow-hidden">
      {/* Background glowing gradients */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute bottom-[-10%] left-[10%] w-[600px] h-[600px] rounded-full bg-purple-500/8 blur-[150px] animate-pulse" style={{ animationDuration: '12s' }}></div>
      </div>

      {/* Mobile Top Header */}
      <div className="md:hidden relative flex items-center justify-between p-4 bg-[#0d0d10]/90 backdrop-blur-xl border-b border-white/5 z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <img src="https://lkbwunzswqbnoygxtilm.supabase.co/storage/v1/object/public/webpage/MSC%20Logo.png" alt="MSC Logo" className="w-6 h-6 object-contain" />
          <span className="font-syne font-black tracking-widest text-lg bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
            {userRole === 'admin' ? 'MSC ADMIN' : 'MSC CORE'}
          </span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white/80 hover:text-white p-2 rounded-lg bg-white/5 border border-white/10 transition-all">
          <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'} text-lg`}></i>
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed top-[61px] md:top-0 left-0 md:relative w-full md:w-[280px] bg-[#0c0c0e]/90 md:bg-[#0c0c0e]/60 backdrop-blur-2xl md:border-r border-white/5 flex flex-col p-6 z-40 h-[calc(100dvh-61px)] md:h-auto transition-all duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} overflow-y-auto justify-between`}>
        <div className="flex flex-col">
          {/* Logo Brand Header */}
          <div className="hidden md:flex items-center gap-3 mb-10 mt-2 px-2">
            <img src="https://lkbwunzswqbnoygxtilm.supabase.co/storage/v1/object/public/webpage/MSC%20Logo.png" alt="MSC Logo" className="w-8 h-8 object-contain shrink-0" />
            <span className="font-syne font-black tracking-widest text-lg bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent uppercase">
              {userRole === 'admin' ? 'MSC Admin' : 'Core Workspace'}
            </span>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col gap-6">
            {userRole === 'admin' && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest px-4 mb-2">Security & Control</span>
                <button 
                  onClick={() => { triggerHaptic('light'); setActiveTab('users'); setIsMobileMenuOpen(false); }} 
                  className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all text-left flex items-center gap-3 relative border ${
                    activeTab === 'users' 
                      ? 'bg-white/5 border-white/10 text-white shadow-[inset_0_1px_rgba(255,255,255,0.05),0_10px_20px_rgba(0,0,0,0.4)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-blue-500 before:rounded-full' 
                      : 'text-[#a1a1aa] hover:text-white border-transparent hover:bg-white/[0.01]'
                  }`}
                >
                  <i className="fas fa-users-cog w-4 text-blue-400/85"></i> User Access
                </button>
                <button 
                  onClick={() => { triggerHaptic('light'); setActiveTab('password_reqs'); setIsMobileMenuOpen(false); }} 
                  className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all text-left flex items-center gap-3 relative border ${
                    activeTab === 'password_reqs' 
                      ? 'bg-white/5 border-white/10 text-white shadow-[inset_0_1px_rgba(255,255,255,0.05),0_10px_20px_rgba(0,0,0,0.4)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-yellow-500 before:rounded-full' 
                      : 'text-[#a1a1aa] hover:text-white border-transparent hover:bg-white/[0.01]'
                  }`}
                >
                  <i className="fas fa-key w-4 text-yellow-400/85"></i> Passwords
                </button>
              </div>
            )}
            
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest px-4 mb-2">Operations</span>
              <button 
                onClick={() => { triggerHaptic('light'); setActiveTab('events'); setIsMobileMenuOpen(false); }} 
                className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all text-left flex items-center gap-3 relative border ${
                  activeTab === 'events' 
                    ? 'bg-white/5 border-white/10 text-white shadow-[inset_0_1px_rgba(255,255,255,0.05),0_10px_20px_rgba(0,0,0,0.4)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-blue-500 before:rounded-full' 
                    : 'text-[#a1a1aa] hover:text-white border-transparent hover:bg-white/[0.01]'
                }`}
              >
                <i className="fas fa-calendar-alt w-4 text-blue-400/85"></i> Events
              </button>
              <button 
                onClick={() => { triggerHaptic('light'); setActiveTab('team'); setIsMobileMenuOpen(false); }} 
                className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all text-left flex items-center gap-3 relative border ${
                  activeTab === 'team' 
                    ? 'bg-white/5 border-white/10 text-white shadow-[inset_0_1px_rgba(255,255,255,0.05),0_10px_20px_rgba(0,0,0,0.4)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-purple-500 before:rounded-full' 
                    : 'text-[#a1a1aa] hover:text-white border-transparent hover:bg-white/[0.01]'
                }`}
              >
                <i className="fas fa-users w-4 text-purple-400/85"></i> Team Members
              </button>
              <button 
                onClick={() => { triggerHaptic('light'); setActiveTab('analytics'); setIsMobileMenuOpen(false); }} 
                className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all text-left flex items-center gap-3 relative border ${
                  activeTab === 'analytics' 
                    ? 'bg-white/5 border-white/10 text-white shadow-[inset_0_1px_rgba(255,255,255,0.05),0_10px_20px_rgba(0,0,0,0.4)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-pink-500 before:rounded-full' 
                    : 'text-[#a1a1aa] hover:text-white border-transparent hover:bg-white/[0.01]'
                }`}
              >
                <i className="fas fa-chart-pie w-4 text-pink-400/85"></i> Analytics
              </button>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest px-4 mb-2">Workspace</span>
              <button 
                onClick={() => { triggerHaptic('light'); setActiveTab('settings'); setIsMobileMenuOpen(false); }} 
                className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all text-left flex items-center gap-3 relative border ${
                  activeTab === 'settings' 
                    ? 'bg-white/5 border-white/10 text-white shadow-[inset_0_1px_rgba(255,255,255,0.05),0_10px_20px_rgba(0,0,0,0.4)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-blue-500 before:rounded-full' 
                    : 'text-[#a1a1aa] hover:text-white border-transparent hover:bg-white/[0.01]'
                }`}
              >
                <i className="fas fa-cog w-4 text-blue-400/85"></i> Settings
              </button>
            </div>
          </div>
        </div>

        {/* Profile Card at bottom of sidebar */}
        <div className="mt-8 pt-4 border-t border-white/5 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md border border-white/10">
              <i className="fas fa-user-shield"></i>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-widest leading-none mb-1">Active User</span>
              <span className="text-xs font-bold text-white truncate max-w-[150px]">
                {userRole === 'admin' ? 'Administrator' : 'Core Member'}
              </span>
            </div>
          </div>
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/login';
            }} 
            className="w-full py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 hover:border-transparent rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
          >
            <i className="fas fa-sign-out-alt"></i> Log Out
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 overflow-y-auto p-6 pb-24 md:p-10 md:pb-10 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* USER TAB */}
          {activeTab === 'users' && userRole === 'admin' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h2 className="text-3xl font-syne font-extrabold text-white tracking-tight">User Access Provisioning</h2>
                <p className="text-white/40 text-sm mt-1">Manage accounts and platform authorizations for MSC Core Members.</p>
              </div>
              
              <div className="bg-[#18181b]/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 mb-8 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                  <i className="fas fa-user-plus text-blue-400"></i> Provision Core Account
                </h3>
                <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Email Address</label>
                    <input type="email" name="email" required placeholder="new@member.com" autoComplete="off" className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.15)] rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Password</label>
                    <input type="password" name="password" required placeholder="••••••••" autoComplete="new-password" className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.15)] rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Assign Role</label>
                    <select name="role" className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all appearance-none bg-no-repeat bg-right bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%23a1a1aa%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] pr-10">
                      <option value="core_member">Core Member</option>
                    </select>
                  </div>
                  <div>
                    <button type="submit" className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] text-white">Create Account</button>
                  </div>
                </form>
                {statusMsg?.id === 'create_user' && <div className={`mt-4 text-xs font-semibold ${statusMsg.type === 'error' ? 'text-red-400' : statusMsg.type === 'success' ? 'text-green-400' : 'text-blue-400'}`}>{statusMsg.msg}</div>}
              </div>

              <div className="bg-[#18181b]/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02]">
                      <th className="text-[#a1a1aa] font-bold text-xs uppercase tracking-wider p-4">Email Address</th>
                      <th className="text-[#a1a1aa] font-bold text-xs uppercase tracking-wider p-4">Role</th>
                      <th className="text-[#a1a1aa] font-bold text-xs uppercase tracking-wider p-4 text-right">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingUsers ? (
                      [...Array(4)].map((_, idx) => (
                        <tr key={idx} className="border-b border-white/5 animate-pulse">
                          <td className="p-4">
                            <div className="h-4 bg-white/10 rounded w-48"></div>
                          </td>
                          <td className="p-4">
                            <div className="h-8 bg-white/5 border border-white/10 rounded-xl w-24"></div>
                          </td>
                          <td className="p-4 text-right flex justify-end gap-2">
                            <div className="h-8 bg-white/5 rounded-xl w-20"></div>
                            <div className="h-8 bg-red-500/5 rounded-xl w-20"></div>
                          </td>
                        </tr>
                      ))
                    ) : users.length === 0 ? (
                      <tr><td colSpan={3} className="text-center p-10 text-[#a1a1aa]">No users found.</td></tr>
                    ) : (
                      users.map(u => (
                        <tr key={u.id} className="hover:bg-white/[0.02] border-b border-white/5 transition-colors">
                          <td className="p-4 font-semibold text-white/80">{u.email}</td>
                          <td className="p-4">
                            <select
                              defaultValue={u.role}
                              onChange={(e) => { triggerHaptic('medium'); updateUserRole(u.id, e.target.value); }}
                              disabled={u.role === 'admin'}
                              className="p-2 rounded-xl bg-black/30 text-white/85 text-xs font-semibold border border-white/10 focus:outline-none focus:border-blue-500 disabled:opacity-50 appearance-none pr-6 bg-no-repeat bg-[right_8px_center] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%23a1a1aa%22%20stroke-width%3D%221.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')]"
                            >
                              <option value="core_member">Core Member</option>
                              {u.role === 'admin' && <option value="admin">Admin</option>}
                            </select>
                          </td>
                          <td className="p-4 text-right flex items-center justify-end gap-2">
                            <span className={`text-xs mr-2 font-medium ${statusMsg?.id === `user_${u.id}` ? (statusMsg.type === 'error' ? 'text-red-400' : statusMsg.type === 'success' ? 'text-green-400' : 'text-zinc-400') : 'hidden'}`}>{statusMsg?.id === `user_${u.id}` ? statusMsg.msg : ''}</span>
                            <button onClick={() => { triggerHaptic('light'); openPasswordResetModal(u.id, u.email); }} disabled={u.role === 'admin'} className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-30 flex items-center gap-1.5 cursor-pointer"><i className="fas fa-key text-[10px]"></i> Reset</button>
                            <button onClick={() => { triggerHaptic('heavy'); openDeleteUserModal(u.id, u.email); }} disabled={u.role === 'admin'} className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 hover:border-transparent rounded-xl text-xs font-bold transition-colors disabled:opacity-30 flex items-center gap-1.5 cursor-pointer"><i className="fas fa-trash-alt text-[10px]"></i> Delete</button>
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
              <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-syne font-extrabold text-white tracking-tight">Events Management</h2>
                  <p className="text-white/40 text-sm mt-1">Configure event listings, registrations criteria, and certificate templates.</p>
                </div>
              </div>
              
              {userRole === 'admin' && (
                <div className="bg-[#18181b]/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 mb-8 shadow-xl">
                  <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                    <i className="fas fa-calendar-plus text-blue-400"></i> Create New Event
                  </h3>
                  <form onSubmit={handleCreateEvent} className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Event Title</label>
                        <input type="text" name="title" required placeholder="e.g. Hackathon 2.0" className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Date</label>
                        <input type="date" name="date_start" required className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Status</label>
                        <select name="status" className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all appearance-none bg-no-repeat bg-right bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%23a1a1aa%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] pr-10">
                          <option value="upcoming">Upcoming</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Event Type</label>
                        <select name="type" required className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all appearance-none bg-no-repeat bg-right bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%23a1a1aa%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] pr-10">
                          <option value="hackathon">Hackathon</option>
                          <option value="workshop">Workshop</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Venue / Location</label>
                        <input type="text" name="location" placeholder="e.g. Mini Auditorium, SR-Block" className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Maximum Capacity (Optional)</label>
                        <input type="number" name="max_capacity" min="1" placeholder="e.g. 150 (Leave empty for unlimited)" className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Event Description</label>
                      <textarea name="description" rows={3} required placeholder="Provide a compelling description of the event..." className="p-3.5 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20 resize-none"></textarea>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                      <div>
                        <label className="block text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider mb-2">Event Poster Image <span className="text-white/20 lowercase font-normal">(optional)</span></label>
                        <input type="file" name="image" accept="image/*" className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl px-4 py-2.5 text-white outline-none transition-all text-sm file:mr-4 file:py-1.5 file:px-3.5 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 file:transition-all cursor-pointer" />
                      </div>
                      
                      <div className="flex items-center">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <input type="checkbox" name="registration_open" className="w-5 h-5 accent-blue-500 rounded border-white/20 bg-black/50 cursor-pointer" />
                          <div>
                            <span className="text-sm font-bold text-white block">Open Registrations Instantly</span>
                            <span className="text-[10px] text-white/40 block mt-0.5">Let participants register as soon as the event is created.</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Certificate HTML Template <span className="text-white/20 lowercase font-normal">(optional)</span></span>
                        <span className="text-[10px] text-yellow-500/80 normal-case font-normal">Placeholders: {`{{NAME}}, {{EVENT_TITLE}}, {{EVENT_DATE}}, {{COLLEGE_NAME}}`}</span>
                      </label>
                      <textarea 
                        name="certificate_html" 
                        rows={4}
                        placeholder={`<div style="font-family: sans-serif; text-align: center; padding: 40px; background: white; color: black;">\n  <h1>Certificate of Participation</h1>\n  <p>Presented to {{NAME}} for participating in {{EVENT_TITLE}} on {{EVENT_DATE}}.</p>\n</div>`}
                        className="w-full bg-black/40 border border-white/10 focus:border-yellow-500/50 rounded-xl p-3.5 text-white font-mono text-xs outline-none transition-all resize-none"
                      ></textarea>
                    </div>

                    <div className="p-5 bg-black/30 border border-white/5 rounded-2xl">
                      <h4 className="text-xs font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                        <i className="fas fa-tasks text-blue-400"></i> Public Registration Form Setup
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-3">
                          <label className="flex items-center gap-3 cursor-not-allowed opacity-60">
                            <input type="checkbox" defaultChecked disabled className="w-4.5 h-4.5 accent-blue-500 rounded bg-black/50" />
                            <span className="text-sm text-white/80">Require Student Email (Mandatory)</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input type="checkbox" name="req_reg_num" defaultChecked className="w-4.5 h-4.5 accent-blue-500 rounded border-white/20 bg-black/50 cursor-pointer" />
                            <span className="text-sm text-white/80">Require Registration Number</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input type="checkbox" name="req_branch" className="w-4.5 h-4.5 accent-blue-500 rounded border-white/20 bg-black/50 cursor-pointer" />
                            <span className="text-sm text-white/80">Require Branch</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input type="checkbox" name="req_spec" className="w-4.5 h-4.5 accent-blue-500 rounded border-white/20 bg-black/50 cursor-pointer" />
                            <span className="text-sm text-white/80">Require Specialization</span>
                          </label>
                        </div>
                        
                        <div className="flex flex-col gap-3 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input type="checkbox" name="allow_external_students" className="w-4.5 h-4.5 accent-blue-500 rounded border-white/20 bg-black/50 cursor-pointer" />
                            <span className="text-sm font-semibold text-blue-300">Allow Students from Other Colleges</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input type="checkbox" name="provide_certificates" defaultChecked className="w-4.5 h-4.5 accent-blue-500 rounded border-white/20 bg-black/50 cursor-pointer" />
                            <span className="text-sm font-semibold text-white/80">Provide E-Certificates</span>
                          </label>
                          <div className="h-px bg-white/5 my-1"></div>
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input type="checkbox" name="allow_teams" checked={allowTeamsToggle} onChange={(e) => { setAllowTeamsToggle(e.target.checked); if (!e.target.checked) setChargeType('per_person'); }} className="w-4.5 h-4.5 accent-blue-500 rounded border-white/20 bg-black/50 cursor-pointer" />
                            <span className="text-sm font-semibold text-purple-400">Allow Team Registrations</span>
                          </label>
                          {allowTeamsToggle && (
                            <div className="flex items-center gap-3 pl-7 animate-in fade-in slide-in-from-left-2 duration-200">
                              <span className="text-xs text-white/60">Max Team Size:</span>
                              <input type="number" name="max_team_size" defaultValue={3} min={2} max={10} className="w-16 p-1.5 bg-black/40 border border-white/10 focus:border-blue-500 rounded-xl text-white text-center text-xs outline-none" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Registration Fee Section */}
                    <div className="p-5 bg-black/30 border border-white/5 rounded-2xl mt-4">
                      <h4 className="text-xs font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                        <i className="fas fa-rupee-sign text-green-400"></i> Registration Fee
                      </h4>
                      <div className="flex gap-3 mb-4">
                        <button type="button"
                          onClick={() => setEventPricingType('free')}
                          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                            eventPricingType === 'free'
                              ? 'bg-green-500/15 text-green-400 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]'
                              : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'
                          }`}>
                          <i className="fas fa-gift mr-2"></i>Free
                        </button>
                        <button type="button"
                          onClick={() => setEventPricingType('paid')}
                          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                            eventPricingType === 'paid'
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                              : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'
                          }`}>
                          <i className="fas fa-credit-card mr-2"></i>Paid
                        </button>
                      </div>

                      {eventPricingType === 'paid' && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-4">
                          {/* Charge Type */}
                          <div>
                            <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider mb-2 block">
                              Charge Type
                            </label>
                            <div className="flex gap-3">
                              <label className="flex items-center gap-2 cursor-pointer text-sm text-white/80">
                                <input type="radio" name="charge_type" value="per_person"
                                  checked={chargeType === 'per_person'}
                                  onChange={() => setChargeType('per_person')}
                                  className="accent-blue-500" />
                                Per Person
                              </label>
                              {allowTeamsToggle && (
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-white/80">
                                  <input type="radio" name="charge_type" value="per_team"
                                    checked={chargeType === 'per_team'}
                                    onChange={() => setChargeType('per_team')}
                                    className="accent-blue-500" />
                                  Per Team
                                </label>
                              )}
                            </div>
                          </div>

                          {/* Fee Amount */}
                          <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">
                              Registration Fee (₹)
                            </label>
                            <input type="number" name="registration_fee" min="1" step="1" required={eventPricingType === 'paid'}
                              placeholder="e.g. 200"
                              className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                            <span className="text-[10px] text-white/40">
                              {chargeType === 'per_person'
                                ? 'Each participant pays this amount individually.'
                                : 'This is charged once for the entire team.'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center mt-2">
                      <div className={`text-xs font-semibold ${statusMsg?.type === 'error' ? 'text-red-400' : statusMsg?.type === 'success' ? 'text-green-400' : 'text-blue-400'}`}>
                        {statusMsg?.id === 'create_event' && statusMsg.msg}
                      </div>
                      <button type="submit" className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] text-white">Save Event</button>
                    </div>
                  </form>
                </div>
              )}

              {/* Event Cards Grid */}
              {loadingEvents ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-[#18181b]/20 border border-white/5 rounded-[24px] overflow-hidden h-[340px] animate-pulse flex flex-col justify-between p-6">
                      <div className="space-y-4">
                        <div className="h-32 bg-white/5 rounded-xl w-full"></div>
                        <div className="h-5 bg-white/10 rounded w-2/3"></div>
                        <div className="h-3 bg-white/5 rounded w-1/3"></div>
                        <div className="h-3 bg-white/5 rounded w-full"></div>
                      </div>
                      <div className="flex justify-between items-center mt-6">
                        <div className="h-8 bg-white/10 rounded-xl w-24"></div>
                        <div className="h-8 bg-white/5 rounded-xl w-16"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : events.length === 0 ? (
                <p className="text-white/40 text-center py-8">No events found.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {events.map(evt => (
                    <div key={evt.id} className="bg-[#18181b]/30 backdrop-blur-md border border-white/10 rounded-[24px] overflow-hidden flex flex-col relative group hover:border-blue-500/30 transition-all duration-300 shadow-lg animate-in fade-in zoom-in-95 duration-200">
                      {/* Poster image Header */}
                      <div className="h-44 bg-zinc-950/80 relative flex items-center justify-center overflow-hidden border-b border-white/5">
                        {evt.image_url ? (
                          <img src={evt.image_url} alt={evt.title} className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500" />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-transparent flex items-center justify-center">
                            <i className="fas fa-calendar-alt text-4xl text-white/5"></i>
                          </div>
                        )}
                        <div className="absolute top-4 right-4 flex gap-2 flex-wrap justify-end">
                          {evt.form_requirements?.event_pricing === 'paid' && (
                            <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-amber-500/20 text-amber-400 border-amber-500/30">
                              ₹{evt.form_requirements.registration_fee} {evt.form_requirements.charge_type === 'per_team' ? '/ Team' : '/ Person'}
                            </span>
                          )}
                          {evt.type && (
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${evt.type === 'hackathon' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.1)]' : evt.type === 'workshop' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.1)]' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                              {evt.type}
                            </span>
                          )}
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${evt.status === 'upcoming' ? 'bg-green-500/20 text-green-400 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                            {evt.status}
                          </span>
                          {evt.registration_open ? (
                            <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.1)]">
                              Open
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-red-500/20 text-red-400 border-red-500/30">
                              Closed
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition-colors line-clamp-1">{evt.title}</h3>
                          <p className="text-[11px] text-[#a1a1aa] mb-4 flex items-center flex-wrap gap-2">
                            <span className="flex items-center gap-1.5"><i className="fas fa-clock text-blue-400"></i> {new Date(evt.date_start).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' })}</span>
                            {evt.location && (
                              <>
                                <span className="text-white/20">•</span>
                                <span className="flex items-center gap-1.5"><i className="fas fa-map-marker-alt text-purple-400"></i> {evt.location}</span>
                              </>
                            )}
                          </p>
                          <p className="text-xs text-white/50 mb-6 line-clamp-2 leading-relaxed">{evt.description}</p>
                        </div>
                        
                        <div className="border-t border-white/5 pt-4 flex flex-wrap gap-2 justify-between items-center">
                          <Link href={`/admin/events/${evt.slug || evt.id}`} onClick={() => triggerHaptic('light')} className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white transition-all shadow-md flex items-center gap-1.5">
                            <i className="fas fa-external-link-alt"></i> Registrations
                          </Link>
                          
                          {userRole === 'admin' && (
                            <div className="flex gap-1.5">
                              <Link href={`/admin/events/${evt.slug || evt.id}/edit`} onClick={() => triggerHaptic('light')} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:border-blue-500/30 hover:bg-blue-500/10 flex items-center justify-center text-white/60 hover:text-blue-400 transition-all" title="Edit Event">
                                <i className="fas fa-edit text-xs"></i>
                              </Link>
                              <button onClick={() => { triggerHaptic('medium'); toggleEventStatus(evt.id, evt.status); }} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:border-green-500/30 hover:bg-green-500/10 flex items-center justify-center text-white/60 hover:text-green-400 transition-all cursor-pointer" title={evt.status === 'completed' ? 'Mark Upcoming' : 'Mark Completed'}>
                                <i className={`fas ${evt.status === 'completed' ? 'fa-calendar-plus' : 'fa-calendar-check'} text-xs`}></i>
                              </button>
                              <button onClick={() => { triggerHaptic('medium'); toggleRegistration(evt.id, !!evt.registration_open); }} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:border-orange-500/30 hover:bg-orange-500/10 flex items-center justify-center text-white/60 hover:text-orange-400 transition-all cursor-pointer" title={evt.registration_open ? 'Close Registration' : 'Open Registration'}>
                                <i className={`fas ${evt.registration_open ? 'fa-lock' : 'fa-lock-open'} text-xs`}></i>
                              </button>
                              <button onClick={() => { triggerHaptic('heavy'); deleteEvent(evt.id, evt.title); }} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 flex items-center justify-center text-white/60 hover:text-red-400 transition-all cursor-pointer" title="Delete Event">
                                <i className="fas fa-trash-alt text-xs"></i>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TEAM TAB */}
          {activeTab === 'team' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h2 className="text-3xl font-syne font-extrabold text-white tracking-tight">Team Directory</h2>
                <p className="text-white/40 text-sm mt-1">Configure profile listings shown in the public team section.</p>
              </div>
              
              {userRole === 'admin' && (
                <div className="bg-[#18181b]/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 mb-8 shadow-xl">
                  <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                    <i className="fas fa-user-plus text-purple-400"></i> Add Team Member
                  </h3>
                  <form onSubmit={handleCreateTeam} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Full Name</label>
                        <input type="text" name="name" required placeholder="e.g. John Doe" className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Role</label>
                        <input type="text" name="role" required placeholder="e.g. Technical Lead" className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">LinkedIn URL</label>
                        <input type="url" name="linkedin_url" placeholder="https://www.linkedin.com/in/..." className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">GitHub URL</label>
                        <input type="url" name="github_url" placeholder="https://github.com/..." className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Twitter/X URL</label>
                        <input type="url" name="twitter_url" placeholder="https://x.com/..." className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Instagram URL</label>
                        <input type="url" name="instagram_url" placeholder="https://instagram.com/..." className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Email Address</label>
                        <input type="email" name="email" placeholder="email@example.com" className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Portfolio URL</label>
                        <input type="url" name="portfolio_url" placeholder="https://yourwebsite.com" className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 bg-white/[0.02] border border-white/5 p-4 rounded-xl">
                      <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Profile Picture (Upload)</label>
                      <input type="file" name="image" accept="image/*" className="w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 transition-all cursor-pointer" />
                    </div>

                    <div className="flex justify-between items-center mt-2">
                      <div className={`text-xs font-semibold ${statusMsg?.type === 'error' ? 'text-red-400' : statusMsg?.type === 'success' ? 'text-green-400' : 'text-blue-400'}`}>
                        {statusMsg?.id === 'create_team' && statusMsg.msg}
                      </div>
                      <button type="submit" className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] text-white">Save Member</button>
                    </div>
                  </form>
                </div>
              )}

              {/* Team Members Cards */}
              {loadingTeam ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-[#18181b]/20 border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center animate-pulse">
                      <div className="w-20 h-20 rounded-full bg-white/5 mb-4"></div>
                      <div className="h-4 bg-white/10 rounded w-2/3 mb-2"></div>
                      <div className="h-3 bg-white/5 rounded w-1/2 mb-4"></div>
                      <div className="flex gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-white/5"></div>
                        <div className="w-8 h-8 rounded-full bg-white/5"></div>
                      </div>
                      <div className="w-full h-8 rounded-xl bg-white/5"></div>
                    </div>
                  ))}
                </div>
              ) : team.length === 0 ? (
                <p className="text-white/40 text-center py-8">No team members found.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {team.map(member => (
                    <div key={member.id} className="bg-[#18181b]/30 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300 shadow-lg">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/15 flex items-center justify-center overflow-hidden mb-4 shadow-md group-hover:border-blue-500/40 transition-all">
                        {member.image_url ? (
                          <img src={member.image_url} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl font-bold text-white/80">{member.name.charAt(0)}</span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">{member.name}</h3>
                      <p className="text-xs text-white/50 mb-4 font-medium line-clamp-1">{member.role}</p>
                      
                      <div className="flex gap-3 mb-4">
                        {member.linkedin_url && (
                          <a href={member.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={() => triggerHaptic('light')} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/10 transition-all" title="LinkedIn">
                            <i className="fab fa-linkedin-in text-xs"></i>
                          </a>
                        )}
                        {member.github_url && (
                          <a href={member.github_url} target="_blank" rel="noopener noreferrer" onClick={() => triggerHaptic('light')} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 hover:bg-white/10 transition-all" title="GitHub">
                            <i className="fab fa-github text-xs"></i>
                          </a>
                        )}
                      </div>
                      
                      {userRole === 'admin' && (
                        <div className="flex gap-2 w-full mt-2">
                          <button onClick={() => { triggerHaptic('light'); setEditingTeamMember(member); }} className="flex-1 py-2 bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white border border-blue-500/20 hover:border-transparent rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer">
                            Edit
                          </button>
                          <button onClick={() => { triggerHaptic('heavy'); deleteTeam(member.id); }} className="flex-1 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 hover:border-transparent rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer">
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Edit Team Member Modal */}
              {editingTeamMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                  <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 w-full max-w-3xl shadow-2xl overflow-y-auto max-h-[90vh]">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <i className="fas fa-user-edit text-blue-400"></i> Edit Team Member
                      </h3>
                      <button onClick={() => setEditingTeamMember(null)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                    
                    <form key={editingTeamMember.id} onSubmit={handleUpdateTeam} className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Full Name</label>
                          <input type="text" name="name" required defaultValue={editingTeamMember.name} placeholder="e.g. John Doe" className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Role</label>
                          <input type="text" name="role" required defaultValue={editingTeamMember.role} placeholder="e.g. Technical Lead" className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">LinkedIn URL</label>
                          <input type="url" name="linkedin_url" defaultValue={editingTeamMember.linkedin_url} placeholder="https://www.linkedin.com/in/..." className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">GitHub URL</label>
                          <input type="url" name="github_url" defaultValue={editingTeamMember.github_url} placeholder="https://github.com/..." className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Twitter/X URL</label>
                          <input type="url" name="twitter_url" defaultValue={editingTeamMember.twitter_url} placeholder="https://x.com/..." className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Instagram URL</label>
                          <input type="url" name="instagram_url" defaultValue={editingTeamMember.instagram_url} placeholder="https://instagram.com/..." className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Email Address</label>
                          <input type="email" name="email" defaultValue={editingTeamMember.email} placeholder="email@example.com" className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Portfolio URL</label>
                          <input type="url" name="portfolio_url" defaultValue={editingTeamMember.portfolio_url} placeholder="https://yourwebsite.com" className="p-3 bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl text-white outline-none transition-all placeholder:text-white/20" />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 bg-white/[0.02] border border-white/5 p-4 rounded-xl">
                        <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Profile Picture (Upload)</label>
                        <p className="text-xs text-white/50 mb-2">Leave blank to keep current picture</p>
                        <input type="file" name="image" accept="image/*" className="w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 transition-all cursor-pointer" />
                      </div>

                      <div className="flex justify-between items-center mt-6">
                        <div className={`text-xs font-semibold ${statusMsg?.type === 'error' ? 'text-red-400' : statusMsg?.type === 'success' ? 'text-green-400' : 'text-blue-400'}`}>
                          {statusMsg?.id === 'update_team' && statusMsg.msg}
                        </div>
                        <div className="flex gap-4">
                          <button type="button" onClick={() => setEditingTeamMember(null)} className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all text-white/70">Cancel</button>
                          <button type="submit" className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] text-white">Save Changes</button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && <AnalyticsDashboard />}


          {/* PASSWORD REQUESTS TAB */}
          {activeTab === 'password_reqs' && userRole === 'admin' && <PasswordRequestsTab />}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && <SettingsTab />}

          {/* ABOUT TAB */}
        </div>
      </main>

      {/* Password Reset Modal Overlay */}
      {resettingUser && (
        <div className="fixed inset-0 bg-[#09090b]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <i className="fas fa-key text-blue-400"></i> Reset Password
            </h3>
            <p className="text-xs text-white/50 mb-5">Change password for <strong className="text-white/80">{resettingUser.email}</strong>.</p>
            
            <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">New Password</label>
                <input 
                  type="password" 
                  value={newPasswordValue}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  placeholder="••••••••" 
                  required
                  className="p-3 bg-black/40 border border-white/10 focus:border-blue-500 rounded-xl text-white outline-none text-sm transition-all"
                />
              </div>

              {resetModalError && <p className="text-xs font-semibold text-red-400">{resetModalError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => { triggerHaptic('light'); setResettingUser(null); }}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isResettingPassword}
                  className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isResettingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-[#09090b]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-red-500/20 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
              <i className="fas fa-exclamation-triangle"></i> Delete Account
            </h3>
            <p className="text-sm text-white/70 leading-relaxed mb-6">
              Are you absolutely sure you want to delete <strong className="text-white font-bold">{deletingUser.email}</strong>? This action is permanent and cannot be undone.
            </p>

            <div className="flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => { triggerHaptic('light'); setDeletingUser(null); }}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={confirmDeleteUser}
                className="px-5 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer shadow-md"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
