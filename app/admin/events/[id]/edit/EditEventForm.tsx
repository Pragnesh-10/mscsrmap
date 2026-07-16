'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateEventDetails } from '../actions'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'

export default function EditEventForm({ event }: { event: any }) {
  const router = useRouter()
  const [allowTeamsToggle, setAllowTeamsToggle] = useState(event.form_requirements?.allow_teams || false)
  const [eventPricingType, setEventPricingType] = useState<'free' | 'paid'>(event.form_requirements?.event_pricing || 'free')
  const [chargeType, setChargeType] = useState<'per_person' | 'per_team'>(event.form_requirements?.charge_type || 'per_person')
  const [existingGallery, setExistingGallery] = useState<string[]>(event.gallery_urls || [])
  const [newGalleryFiles, setNewGalleryFiles] = useState<File[]>([])
  const [statusMsg, setStatusMsg] = useState<{ id: string, msg: string, type: 'error' | 'success' | 'info' } | null>(null)
  const supabase = createClient()

  function showStatus(id: string, msg: string, type: 'error' | 'success' | 'info') {
    setStatusMsg({ id, msg, type })
    if (type !== 'info') {
      setTimeout(() => setStatusMsg(null), 5000)
    }
  }

  async function uploadImage(file: File, pathPrefix: string) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${pathPrefix}-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    
    const { data, error } = await supabase.storage.from('images').upload(fileName, file)
    if (error) throw error
    
    const { data: publicData } = supabase.storage.from('images').getPublicUrl(fileName)
    return publicData.publicUrl
  }

  async function handleEditEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const title = formData.get('title') as string
    const dateStartRaw = formData.get('date_start') as string
    const date_start = dateStartRaw ? new Date(dateStartRaw).toISOString() : new Date().toISOString()
    const status = formData.get('status') as string
    const type = formData.get('type') as string
    const location = formData.get('location') as string
    const description = formData.get('description') as string
    const imageFile = formData.get('image') as File
    const certificateHtml = formData.get('certificate_html') as string
    const registration_open = formData.get('registration_open') === 'on'
    const galleryFiles = newGalleryFiles

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

    showStatus('edit_event', 'Saving changes...', 'info')
    
    let image_url = event.image_url // Keep existing by default
    if (imageFile && imageFile.size > 0) {
      try {
        image_url = await uploadImage(imageFile, 'event')
      } catch (err: any) {
        showStatus('edit_event', `Poster Upload Failed: ${err.message}`, 'error')
        return
      }
    }

    const maxCapStr = formData.get('max_capacity') as string
    const max_capacity = maxCapStr ? parseInt(maxCapStr) : null

    // Upload new gallery images
    const newGalleryUrls: string[] = []
    for (const file of galleryFiles) {
      if (file && file.size > 0) {
        try {
          const url = await uploadImage(file, 'gallery')
          newGalleryUrls.push(url)
        } catch (err: any) {
          showStatus('edit_event', `Gallery Upload Failed: ${err.message}`, 'error')
          return
        }
      }
    }
    const finalGallery = [...existingGallery, ...newGalleryUrls]

    const updateData = {
      title, date_start, status, type, location, description, image_url, registration_open, form_requirements, certificate_html: certificateHtml, max_capacity, gallery_urls: finalGallery 
    }

    const res = await updateEventDetails(event.id, updateData)
    
    if (res.error) {
      showStatus('edit_event', `Failed: ${res.error}`, 'error')
    } else {
      showStatus('edit_event', 'Event Updated Successfully!', 'success')
      setTimeout(() => {
        router.push(`/admin/events/${event.slug || event.id}`)
      }, 1500)
    }
  }

  // Format date for date input (YYYY-MM-DD) in local timezone
  function toLocalDatetimeString(dateObj: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
  }
  const defaultDate = event.date_start ? toLocalDatetimeString(new Date(event.date_start)) : ''

  return (
    <div className="bg-[#18181b]/60 backdrop-blur-xl border border-white/10 rounded-[20px] p-8 mb-8 shadow-2xl">
      <form onSubmit={handleEditEvent} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Event Title</label>
            <input type="text" name="title" required defaultValue={event.title} className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Date</label>
            <input type="date" name="date_start" required defaultValue={defaultDate} className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Status</label>
            <select name="status" defaultValue={event.status} className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 appearance-none">
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Event Type</label>
            <select name="type" defaultValue={event.type || 'hackathon'} className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 appearance-none">
              <option value="hackathon">Hackathon</option>
              <option value="workshop">Workshop</option>
            </select>
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Venue / Location</label>
          <input type="text" name="location" defaultValue={event.location || ''} className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Event Description</label>
          <textarea name="description" rows={3} required defaultValue={event.description || ''} className="p-4 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500"></textarea>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Maximum Capacity (Optional)</label>
          <input type="number" name="max_capacity" min="1" defaultValue={event.max_capacity || ''} className="p-4 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
          <span className="text-[10px] text-white/40">If set, any registrations past this limit will automatically be placed on a Waitlist.</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-[#a1a1aa] uppercase tracking-wider mb-2">Event Poster <span className="text-white/30 lowercase font-normal">(optional - leave blank to keep current)</span></label>
            <input type="file" name="image" accept="image/*" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-500/20 file:text-blue-400 hover:file:bg-blue-500/30 transition-all cursor-pointer" />
            {event.image_url && <img src={event.image_url} alt="Current poster" className="mt-2 h-20 rounded-md opacity-50" />}
          </div>
          
          <div className="flex flex-col gap-2 justify-center">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" name="registration_open" defaultChecked={event.registration_open} className="w-5 h-5 accent-blue-500 cursor-pointer" />
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
            defaultValue={event.certificate_html || ''}
            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-mono text-xs focus:outline-none focus:border-yellow-500"
          ></textarea>
        </div>

        {/* Gallery Upload Section */}
        <div className="flex flex-col gap-4 mt-2 p-5 bg-black/30 border border-white/5 rounded-xl">
          <div className="flex justify-between items-end">
            <label className="text-[13px] font-bold text-[#a1a1aa] uppercase tracking-wider">Event Photo Gallery</label>
            <span className="text-[10px] text-white/40 normal-case font-normal">Upload photos from the event (especially useful after completion).</span>
          </div>
          
          {existingGallery.length > 0 && (
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4 mb-2">
              {existingGallery.map((url, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden aspect-square">
                  <img src={url} alt={`Gallery ${i}`} className="w-full h-full object-cover" />
                  <button 
                    type="button" 
                    onClick={() => setExistingGallery(prev => prev.filter((_, index) => index !== i))}
                    className="absolute inset-0 bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold"
                  >
                    <i className="fas fa-trash-alt mr-2"></i> Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <input 
            type="file" 
            accept="image/*" 
            multiple 
            onChange={(e) => {
              if (e.target.files) {
                setNewGalleryFiles(prev => [...prev, ...Array.from(e.target.files!)])
              }
            }}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-500/20 file:text-blue-400 hover:file:bg-blue-500/30 transition-all cursor-pointer" 
          />
          
          {newGalleryFiles.length > 0 && (
            <div className="mt-3">
              <span className="text-xs text-blue-400 font-bold">{newGalleryFiles.length} new photos selected</span>
              <button type="button" onClick={() => setNewGalleryFiles([])} className="ml-3 text-xs text-red-400 hover:text-red-300">Clear Selection</button>
            </div>
          )}
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
                <input type="checkbox" name="req_reg_num" defaultChecked={event.form_requirements?.req_reg_num} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                <span className="text-sm text-white/80">Require Registration Number</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" name="req_branch" defaultChecked={event.form_requirements?.req_branch} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                <span className="text-sm text-white/80">Require Branch</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" name="req_spec" defaultChecked={event.form_requirements?.req_spec} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                <span className="text-sm text-white/80">Require Specialization</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" name="allow_external_students" defaultChecked={event.form_requirements?.allow_external_students} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                <span className="text-sm text-white/80 text-blue-300 font-semibold">Allow Students from Other Colleges</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                <input type="checkbox" name="provide_certificates" defaultChecked={event.form_requirements?.provide_certificates} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                <span className="text-sm font-semibold text-white/80">Provide E-Certificates</span>
              </label>
            </div>
            
            <div className="flex flex-col gap-3 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" name="allow_teams" checked={allowTeamsToggle} onChange={(e) => { setAllowTeamsToggle(e.target.checked); if (!e.target.checked) setChargeType('per_person'); }} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                <span className="text-sm text-white/80 font-semibold text-blue-400">Allow Team Registrations</span>
              </label>
              {allowTeamsToggle && (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
                  <span className="text-sm text-white/60">Max Team Size:</span>
                  <input type="number" name="max_team_size" defaultValue={event.form_requirements?.max_team_size || 3} min={2} max={10} className="w-20 p-2 bg-black/40 border border-white/10 rounded-lg text-white text-center focus:outline-none focus:border-blue-500" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Registration Fee Section */}
        <div className="mt-4 p-5 bg-black/30 border border-white/5 rounded-xl">
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
                  defaultValue={event.form_requirements?.registration_fee || ''}
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
          <div className={`text-sm font-semibold ${statusMsg?.type === 'error' ? 'text-red-500' : statusMsg?.type === 'success' ? 'text-green-500' : 'text-blue-400'}`}>
            {statusMsg?.id === 'edit_event' && statusMsg.msg}
          </div>
          <button type="submit" className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl font-bold transition-all shadow-lg text-white">Save Changes</button>
        </div>
      </form>
    </div>
  )
}
