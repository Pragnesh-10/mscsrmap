'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'

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

const compressAndConvertImage = async (file: File, maxW = 500, maxH = 500, quality = 0.70): Promise<File> => {
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

export default function SettingsTab() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [msg, setMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null)
  
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data, error } = await supabase
      .from('member_profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (data) setProfile(data)
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    triggerHaptic('light')
    setSaving(true)
    setMsg(null)

    const formData = new FormData(e.currentTarget)
    const updates = {
      full_name: formData.get('full_name'),
      department: formData.get('department'),
      year_of_study: formData.get('year_of_study'),
      phone_number: formData.get('phone_number'),
      registration_number: formData.get('registration_number'),
      bio: formData.get('bio'),
    }

    const { error } = await supabase
      .from('member_profiles')
      .update(updates)
      .eq('id', profile.id)

    if (error) {
      triggerHaptic('error')
      setMsg({ text: error.message, type: 'error' })
    } else {
      triggerHaptic('success')
      setMsg({ text: 'Profile updated successfully!', type: 'success' })
      setProfile({ ...profile, ...updates })
    }
    setSaving(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    
    triggerHaptic('light')
    setUploadingAvatar(true)
    setMsg(null)

    // 1. Compress image to modern WebP format
    const compressed = await compressAndConvertImage(file)
    const fileName = `${profile.id}/avatar-${Date.now()}.webp`

    // 2. Delete previous avatar to reclaim storage space
    if (profile.profile_picture_url) {
      try {
        const oldUrl = profile.profile_picture_url
        if (oldUrl.includes('/storage/v1/object/public/avatars/')) {
          const oldPath = oldUrl.split('/storage/v1/object/public/avatars/')[1]
          await supabase.storage.from('avatars').remove([oldPath])
        }
      } catch (err) {
        console.error('Failed to clean up old avatar:', err)
      }
    }

    // 3. Upload the compressed file to the 'avatars' bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, compressed, { upsert: true })

    if (uploadError) {
      triggerHaptic('error')
      setMsg({ text: `Upload failed: ${uploadError.message}`, type: 'error' })
      setUploadingAvatar(false)
      return
    }

    // 2. Get the public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName)

    const publicUrl = urlData.publicUrl

    // 3. Update the member_profiles table
    const { error: updateError } = await supabase
      .from('member_profiles')
      .update({ profile_picture_url: publicUrl })
      .eq('id', profile.id)

    if (updateError) {
      triggerHaptic('error')
      setMsg({ text: updateError.message, type: 'error' })
    } else {
      triggerHaptic('success')
      setProfile({ ...profile, profile_picture_url: publicUrl })
      setMsg({ text: 'Profile picture updated!', type: 'success' })
    }
    
    setUploadingAvatar(false)
  }

  if (loading) {
    return (
      <div className="bg-[#18181b]/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl animate-pulse">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-blue-500/5 to-transparent">
          <div className="h-6 bg-white/10 rounded w-48"></div>
        </div>
        <div className="p-8 flex flex-col md:flex-row gap-10">
          <div className="flex flex-col items-center md:items-start md:w-1/3 space-y-4">
            <div className="w-40 h-40 rounded-full bg-white/5 border-4 border-white/10"></div>
            <div className="h-5 bg-white/10 rounded w-2/3"></div>
            <div className="h-4 bg-white/5 rounded w-1/3"></div>
          </div>
          <div className="flex-1 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2"><div className="h-3 bg-white/5 rounded w-1/4"></div><div className="h-10 bg-white/10 rounded-xl"></div></div>
              <div className="space-y-2"><div className="h-3 bg-white/5 rounded w-1/4"></div><div className="h-10 bg-white/10 rounded-xl"></div></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2"><div className="h-3 bg-white/5 rounded w-1/4"></div><div className="h-10 bg-white/10 rounded-xl"></div></div>
              <div className="space-y-2"><div className="h-3 bg-white/5 rounded w-1/4"></div><div className="h-10 bg-white/10 rounded-xl"></div></div>
            </div>
            <div className="space-y-2"><div className="h-3 bg-white/5 rounded w-1/4"></div><div className="h-10 bg-white/10 rounded-xl"></div></div>
            <div className="space-y-2"><div className="h-3 bg-white/5 rounded w-1/4"></div><div className="h-28 bg-white/10 rounded-xl"></div></div>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) return <div className="text-white/60">Profile not found.</div>

  return (
    <div className="bg-[#18181b]/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">
      <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-blue-500/5 to-transparent">
        <h2 className="text-xl font-syne font-bold text-white flex items-center gap-3">
          <i className="fas fa-cog text-blue-400"></i>
          Account Settings
        </h2>
      </div>

      <div className="p-8">
        {msg && (
          <div className={`mb-6 p-4 rounded-xl text-sm font-semibold border ${msg.type === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
            {msg.text}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-10">
          
          {/* Left Column: Avatar & Basic Info */}
          <div className="flex flex-col items-center md:items-start md:w-1/3">
            <div className="relative group mb-6">
              <div className="w-40 h-40 rounded-full border-4 border-white/10 shadow-2xl bg-white/5 overflow-hidden transition-all duration-300 group-hover:border-blue-500/30">
                {profile.profile_picture_url ? (
                  <img src={profile.profile_picture_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
                    <i className="fas fa-user text-4xl mb-2"></i>
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-2 right-2 w-10 h-10 bg-blue-500 hover:bg-blue-600 rounded-full text-white flex items-center justify-center shadow-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {uploadingAvatar ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-camera"></i>}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleAvatarUpload} 
              />
            </div>

            <div className="text-center md:text-left w-full">
              <h3 className="text-2xl font-syne font-bold text-white mb-1 leading-tight">{profile.full_name || 'No Name'}</h3>
              <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-4">{profile.role.replace('_', ' ')}</p>
              
              <div className="bg-white/5 border border-white/5 rounded-xl p-4 text-xs font-semibold text-white/60 w-full mb-2 flex items-center gap-2">
                <i className="fas fa-envelope text-blue-400/80 w-4 text-center"></i> {profile.email}
              </div>
            </div>
          </div>

          {/* Right Column: Edit Form */}
          <div className="flex-1">
            <form onSubmit={handleSave} className="space-y-5">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Full Name</label>
                  <input name="full_name" defaultValue={profile.full_name} className="w-full bg-[#1e1e24]/40 border border-white/10 focus:border-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.15)] rounded-xl px-4 py-3 outline-none text-white transition-all" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Registration Number</label>
                  <input name="registration_number" defaultValue={profile.registration_number} className="w-full bg-[#1e1e24]/40 border border-white/10 focus:border-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.15)] rounded-xl px-4 py-3 outline-none text-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Department / Branch</label>
                  <select name="department" defaultValue={profile.department || ""} className="w-full bg-[#1e1e24]/40 border border-white/10 focus:border-blue-500/50 rounded-xl px-4 py-3 outline-none text-white transition-all appearance-none bg-no-repeat bg-right bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%23a1a1aa%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%2%2320stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] pr-10">
                    <option value="" disabled>Select Department / Branch</option>
                    <option value="CSE">CSE</option>
                    <option value="ECE">ECE</option>
                    <option value="EEE">EEE</option>
                    <option value="BSc">BSc</option>
                    <option value="BBA">BBA</option>
                    <option value="MBA">MBA</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="Civil">Civil</option>
                    <option value="others">others</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Year of Study</label>
                  <select name="year_of_study" defaultValue={profile.year_of_study || ""} className="w-full bg-[#1e1e24]/40 border border-white/10 focus:border-blue-500/50 rounded-xl px-4 py-3 outline-none text-white transition-all appearance-none bg-no-repeat bg-right bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%23a1a1aa%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%2%2320stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] pr-10">
                    <option value="" disabled>Select Year</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Phone Number</label>
                <input name="phone_number" defaultValue={profile.phone_number} className="w-full bg-[#1e1e24]/40 border border-white/10 focus:border-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.15)] rounded-xl px-4 py-3 outline-none text-white transition-all" />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">Bio / Description</label>
                <textarea name="bio" defaultValue={profile.bio} rows={4} className="w-full bg-[#1e1e24]/40 border border-white/10 focus:border-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.15)] rounded-xl px-4 py-3 outline-none text-white transition-all resize-none placeholder-white/20" placeholder="Tell us about your role in MSC..."></textarea>
              </div>

              <div className="pt-4 flex justify-end">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {saving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>

            </form>
          </div>

        </div>
      </div>
    </div>
  )
}
