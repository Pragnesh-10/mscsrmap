'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'

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
      setMsg({ text: error.message, type: 'error' })
    } else {
      setMsg({ text: 'Profile updated successfully!', type: 'success' })
      setProfile({ ...profile, ...updates })
    }
    setSaving(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    
    setUploadingAvatar(true)
    setMsg(null)

    const fileExt = file.name.split('.').pop()
    const fileName = `${profile.id}/avatar-${Date.now()}.${fileExt}`

    // 1. Upload the file to the 'avatars' bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })

    if (uploadError) {
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
      setMsg({ text: updateError.message, type: 'error' })
    } else {
      setProfile({ ...profile, profile_picture_url: publicUrl })
      setMsg({ text: 'Profile picture updated!', type: 'success' })
    }
    
    setUploadingAvatar(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!profile) return <div className="text-white/60">Profile not found.</div>

  return (
    <div className="bg-[#18181b] rounded-2xl border border-white/5 overflow-hidden">
      <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-blue-500/10 to-transparent">
        <h2 className="text-xl font-bold text-white flex items-center gap-3">
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
              <div className="w-40 h-40 rounded-full border-4 border-[#18181b] shadow-2xl bg-white/5 overflow-hidden">
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
                className="absolute bottom-2 right-2 w-10 h-10 bg-blue-500 rounded-full text-white flex items-center justify-center shadow-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
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
              <h3 className="text-2xl font-bold text-white mb-1">{profile.full_name || 'No Name'}</h3>
              <p className="text-blue-400 text-sm font-semibold uppercase tracking-wider mb-4">{profile.role.replace('_', ' ')}</p>
              
              <div className="bg-white/5 rounded-xl p-4 text-sm text-white/60 w-full mb-2">
                <i className="fas fa-envelope mr-2 w-4 text-center"></i> {profile.email}
              </div>
            </div>
          </div>

          {/* Right Column: Edit Form */}
          <div className="flex-1">
            <form onSubmit={handleSave} className="space-y-5">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Full Name</label>
                  <input name="full_name" defaultValue={profile.full_name} className="w-full bg-[#27272a] text-white px-4 py-3 rounded-xl border border-white/5 focus:border-blue-500/50 outline-none transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Registration Number</label>
                  <input name="registration_number" defaultValue={profile.registration_number} className="w-full bg-[#27272a] text-white px-4 py-3 rounded-xl border border-white/5 focus:border-blue-500/50 outline-none transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Department / Branch</label>
                  <input name="department" defaultValue={profile.department} className="w-full bg-[#27272a] text-white px-4 py-3 rounded-xl border border-white/5 focus:border-blue-500/50 outline-none transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Year of Study</label>
                  <input name="year_of_study" defaultValue={profile.year_of_study} className="w-full bg-[#27272a] text-white px-4 py-3 rounded-xl border border-white/5 focus:border-blue-500/50 outline-none transition-colors" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Phone Number</label>
                <input name="phone_number" defaultValue={profile.phone_number} className="w-full bg-[#27272a] text-white px-4 py-3 rounded-xl border border-white/5 focus:border-blue-500/50 outline-none transition-colors" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Bio / Description</label>
                <textarea name="bio" defaultValue={profile.bio} rows={4} className="w-full bg-[#27272a] text-white px-4 py-3 rounded-xl border border-white/5 focus:border-blue-500/50 outline-none transition-colors resize-none placeholder-white/20" placeholder="Tell us about your role in MSC..."></textarea>
              </div>

              <div className="pt-4 flex justify-end">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
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
