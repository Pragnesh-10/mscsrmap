'use client'

import { useState, useEffect, Fragment } from 'react'
import { createClient } from '@/utils/supabase/client'
import { assignCertificates, updateRegistrationDetails, deleteRegistration } from './actions'
import IDCardModal from './IDCardModal'

export default function RegistrationsTable({ registrations, eventTitle, eventId }: { registrations: any[], eventTitle: string, eventId: string }) {
  const [liveRegs, setLiveRegs] = useState<any[]>(registrations)
  const supabase = createClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [certType, setCertType] = useState('participation')
  const [isAssigning, setIsAssigning] = useState(false)
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isIDModalOpen, setIsIDModalOpen] = useState(false)

  useEffect(() => {
    setLiveRegs(registrations)

    const channel = supabase.channel(`regs_${eventId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registrations', filter: `event_id=eq.${eventId}` }, (payload) => {
        setLiveRegs(prev => [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'registrations', filter: `event_id=eq.${eventId}` }, (payload) => {
        setLiveRegs(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'registrations', filter: `event_id=eq.${eventId}` }, (payload) => {
        setLiveRegs(prev => prev.filter(r => r.id !== payload.old.id))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [registrations, eventId])

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRegs.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredRegs.map(r => r.id)))
  }

  const handleAssignCertificates = async () => {
    if (selectedIds.size === 0) return
    setIsAssigning(true)
    const idsArray = Array.from(selectedIds)
    await assignCertificates(eventId, idsArray, certType)
    setIsAssigning(false)
    setSelectedIds(new Set())
    alert('Certificates Assigned Successfully!')
  }

  const startEditing = (reg: any) => {
    setEditingId(reg.id)
    setEditForm({
      lead_email: reg.lead_email,
      form_data: JSON.parse(JSON.stringify(reg.form_data || {})),
      team_data: JSON.parse(JSON.stringify(reg.team_data || {}))
    })
  }

  const saveEditing = async (regId: string) => {
    setIsSaving(true)
    const res = await updateRegistrationDetails(eventId, regId, editForm.lead_email, editForm.form_data, editForm.team_data)
    if (res?.error) {
      alert(`Error updating details: ${res.error}`)
    }
    setIsSaving(false)
    setEditingId(null)
  }

  const handleDelete = async (regId: string) => {
    if (!confirm('Are you absolutely sure you want to delete this registration? This action cannot be undone.')) return;
    setIsDeleting(regId)
    const res = await deleteRegistration(eventId, regId)
    if (res?.error) {
      alert(`Error deleting registration: ${res.error}`)
    }
    setIsDeleting(null)
  }

  const exportToCSV = () => {
    const rows = []
    rows.push(['Ticket ID', 'Email', 'Name', 'Reg Num', 'Branch', 'Team Name', 'Team Size', 'Status', 'Registration Date'])
    
    liveRegs.forEach(reg => {
      const teamName = reg.team_data?.teamName || 'N/A'
      const teamSize = reg.team_data?.members ? reg.team_data.members.length + 1 : 1
      const date = new Date(reg.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      const ticketId = reg.hash_payload.substring(0, 8)
      
      const exportedEmails = new Set()

      // Primary member
      const primaryEmail = reg.lead_email || 'N/A'
      const primaryName = reg.form_data?.fullName || 'N/A'
      const primaryRegNum = reg.form_data?.regNum || 'N/A'
      const primaryBranch = reg.form_data?.branch || 'N/A'
      const primaryStatus = reg.checked_in ? 'Checked In' : 'Pending'
      
      rows.push([
        ticketId,
        primaryEmail,
        primaryName,
        primaryRegNum,
        primaryBranch,
        teamName,
        teamSize,
        primaryStatus,
        date
      ])
      exportedEmails.add(primaryEmail.toLowerCase())

      // Team members rows
      if (reg.team_data?.members && Array.isArray(reg.team_data.members)) {
        reg.team_data.members.forEach((member: any) => {
          const email = member.email || 'N/A'
          
          if (!exportedEmails.has(email.toLowerCase())) {
            rows.push([
              ticketId,
              email,
              member.fullName || 'N/A',
              member.regNum || 'N/A',
              member.branch || 'N/A',
              teamName,
              teamSize,
              member.checked_in ? 'Checked In' : 'Pending',
              date
            ])
            exportedEmails.add(email.toLowerCase())
          }
        })
      }
    })

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Registrations-${eventTitle.replace(/\\s+/g, '-')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredRegs = liveRegs.filter(reg => {
    const term = searchQuery.toLowerCase()
    return (
      reg.lead_email.toLowerCase().includes(term) ||
      (reg.team_data?.teamName && reg.team_data.teamName.toLowerCase().includes(term)) ||
      (reg.form_data?.fullName && reg.form_data.fullName.toLowerCase().includes(term))
    )
  })

  return (
    <>
      <div className="bg-[#18181b]/60 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 bg-black/20">
        <div className="relative w-full md:w-96">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-white/40"></i>
          <input 
            type="text" 
            placeholder="Search emails, names, or team names..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 text-sm"
          />
        </div>
        <button onClick={exportToCSV} className="w-full md:w-auto px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
          <i className="fas fa-download text-blue-400"></i> Export CSV
        </button>
      </div>

      {/* Floating Toolbar for Certificates */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#18181b] border border-blue-500/50 rounded-2xl p-4 shadow-[0_10px_40px_rgba(59,130,246,0.3)] z-50 flex items-center gap-4 animate-in slide-in-from-bottom-10 duration-300">
          <div className="flex items-center">
            <button onClick={() => setSelectedIds(new Set())} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors mr-2">
              <i className="fas fa-times"></i>
            </button>
            <span className="text-blue-400 font-bold px-2">{selectedIds.size} Selected</span>
          </div>
          <div className="h-8 w-px bg-white/20"></div>
          <select 
            value={certType} 
            onChange={(e) => setCertType(e.target.value)}
            className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500"
          >
            <option value="none">No Certificate</option>
            <option value="participation">Participation</option>
            <option value="runner_up">Runner-Up</option>
            <option value="winner">Winner</option>
          </select>
          <button 
            onClick={handleAssignCertificates}
            disabled={isAssigning}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl font-bold transition-all shadow-lg text-white disabled:opacity-50"
          >
            {isAssigning ? 'Assigning...' : 'Assign Certificates'}
          </button>
          <button 
            disabled={selectedIds.size === 0}
            onClick={() => setIsIDModalOpen(true)}
            className="px-6 py-3 bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 border border-purple-500/30 rounded-xl font-bold transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
          >
            <i className="fas fa-id-badge"></i> Generate ID Cards
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="bg-black/40 text-[#a1a1aa] font-semibold text-[12px] uppercase tracking-wider p-5 border-b border-white/10 w-12 text-center">
                <input 
                  type="checkbox" 
                  checked={filteredRegs.length > 0 && selectedIds.size === filteredRegs.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                />
              </th>
              <th className="bg-black/40 text-[#a1a1aa] font-semibold text-[12px] uppercase tracking-wider p-5 border-b border-white/10 w-12"></th>
              <th className="bg-black/40 text-[#a1a1aa] font-semibold text-[12px] uppercase tracking-wider p-5 border-b border-white/10">Lead Email</th>
              <th className="bg-black/40 text-[#a1a1aa] font-semibold text-[12px] uppercase tracking-wider p-5 border-b border-white/10">Team Name</th>
              <th className="bg-black/40 text-[#a1a1aa] font-semibold text-[12px] uppercase tracking-wider p-5 border-b border-white/10 text-center">Certificate</th>
              <th className="bg-black/40 text-[#a1a1aa] font-semibold text-[12px] uppercase tracking-wider p-5 border-b border-white/10 text-center">Payment</th>
              <th className="bg-black/40 text-[#a1a1aa] font-semibold text-[12px] uppercase tracking-wider p-5 border-b border-white/10 text-center">Status</th>
              <th className="bg-black/40 text-[#a1a1aa] font-semibold text-[12px] uppercase tracking-wider p-5 border-b border-white/10 text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredRegs.length === 0 ? (
              <tr><td colSpan={9} className="text-center p-10 text-white/40">No registrations found.</td></tr>
            ) : (
              filteredRegs.map(reg => {
                const isTeam = reg.team_data && reg.team_data.members && reg.team_data.members.length > 0
                const isExpanded = expandedId === reg.id
                const teamSize = isTeam ? reg.team_data.members.length + 1 : 1

                const certType = reg.form_data?.certificate_type || 'none'
                const anyCheckedIn = reg.checked_in || (isTeam && reg.team_data.members.some((m: any) => m.checked_in))
                
                let certBadge = <span className="text-white/20 text-xs">-</span>
                if (certType === 'winner') certBadge = <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 font-bold uppercase tracking-wider text-[10px] rounded-md border border-yellow-500/20"><i className="fas fa-trophy mr-1"></i> Winner</span>
                else if (certType === 'runner_up') certBadge = <span className="px-2 py-1 bg-gray-400/10 text-gray-400 font-bold uppercase tracking-wider text-[10px] rounded-md border border-gray-400/20"><i className="fas fa-medal mr-1"></i> Runner-Up</span>
                else if (certType === 'participation') certBadge = <span className="px-2 py-1 bg-blue-500/10 text-blue-400 font-bold uppercase tracking-wider text-[10px] rounded-md border border-blue-500/20"><i className="fas fa-award mr-1"></i> Participated</span>

                return (
                  <Fragment key={reg.id}>
                    <tr className={`transition-colors border-b border-white/5 ${isExpanded ? 'bg-blue-500/5' : 'hover:bg-white/5'}`}>
                      <td className="p-5 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(reg.id)}
                          onChange={() => toggleSelect(reg.id)}
                          className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                        />
                      </td>
                      <td className="p-5 text-center text-white/40 cursor-pointer" onClick={() => toggleExpand(reg.id)}>
                        <i className={`fas fa-chevron-${isExpanded ? 'up text-blue-400' : 'down'} transition-all`}></i>
                      </td>
                      <td className="p-5 font-medium cursor-pointer" onClick={() => toggleExpand(reg.id)}>{reg.lead_email}</td>
                      <td className="p-5 cursor-pointer" onClick={() => toggleExpand(reg.id)}>
                        {reg.team_data?.teamName ? (
                          <span className="px-3 py-1 bg-purple-500/10 text-purple-400 font-bold uppercase tracking-wider text-[10px] rounded-full border border-purple-500/20">
                            {reg.team_data.teamName} <span className="ml-1 text-white/40">({teamSize})</span>
                          </span>
                        ) : <span className="text-white/40 text-xs">Individual</span>}
                      </td>
                      <td className="p-5 text-center">{anyCheckedIn ? certBadge : <span className="text-white/20 text-xs">-</span>}</td>
                      <td className="p-5 text-center">
                        {reg.form_data?.payment_data ? (
                          <span className="text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md text-xs font-bold border border-amber-500/20">
                            ₹{reg.form_data.payment_data.amount_paid} <i className="fas fa-check ml-1"></i>
                          </span>
                        ) : (
                          <span className="text-white/20 text-xs">-</span>
                        )}
                      </td>
                      <td className="p-5 text-center">
                        {reg.checked_in ? (
                          <span className="text-green-400 bg-green-500/10 px-2 py-1 rounded-md text-xs font-bold border border-green-500/20"><i className="fas fa-check-circle mr-1"></i> Checked In</span>
                        ) : (
                          <span className="text-orange-400 bg-orange-500/10 px-2 py-1 rounded-md text-xs font-bold border border-orange-500/20"><i className="fas fa-clock mr-1"></i> Pending</span>
                        )}
                      </td>
                      <td className="p-5 text-right text-sm text-white/50">{new Date(reg.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                    </tr>
                    
                    {isExpanded && (
                      <tr className="bg-black/20 border-b border-blue-500/20">
                        <td colSpan={9} className="p-0">
                          <div className="p-6 md:p-8 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest">{isTeam ? 'Detailed Roster' : 'Registration Details'}</h4>
                              {editingId === reg.id ? (
                                <div className="flex gap-2">
                                  <button onClick={() => setEditingId(null)} className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 rounded-md text-[10px] font-bold transition-colors">Cancel</button>
                                  <button onClick={() => saveEditing(reg.id)} disabled={isSaving} className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-md text-[10px] font-bold transition-colors">{isSaving ? 'Saving...' : 'Save Changes'}</button>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <button onClick={() => handleDelete(reg.id)} disabled={isDeleting === reg.id} className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-md text-[10px] font-bold transition-colors">
                                    {isDeleting === reg.id ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-trash mr-1"></i>} Delete
                                  </button>
                                  <button onClick={() => startEditing(reg)} className="px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-md text-[10px] font-bold transition-colors">
                                    <i className="fas fa-edit mr-1"></i> Edit Details
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            {editingId === reg.id && editForm.team_data ? (
                              <div className="mb-4 bg-white/5 border border-white/10 rounded-xl p-4">
                                <label className="text-[10px] uppercase text-white/40 tracking-wider block mb-1">Team Name</label>
                                <input type="text" value={editForm.team_data.teamName || ''} onChange={(e) => setEditForm({...editForm, team_data: {...editForm.team_data, teamName: e.target.value}})} className="w-full bg-black/40 border border-white/10 rounded-md p-2 text-white text-sm focus:border-blue-500 outline-none" />
                              </div>
                            ) : null}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              
                              {/* Primary Registrant */}
                              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
                                {reg.team_data?.leadIndex === 0 && <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>}
                                <span className="text-[10px] uppercase text-white/40 tracking-wider">Primary Registrant</span>
                                
                                {editingId === reg.id ? (
                                  <>
                                    <input type="text" placeholder="Full Name" value={editForm.form_data?.fullName || ''} onChange={(e) => setEditForm({...editForm, form_data: {...editForm.form_data, fullName: e.target.value}})} className="w-full bg-black/40 border border-white/10 rounded-md p-2 text-white text-sm focus:border-blue-500 outline-none" />
                                    <input type="text" placeholder="Email" value={editForm.lead_email || ''} onChange={(e) => setEditForm({...editForm, lead_email: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-md p-2 text-white text-sm focus:border-blue-500 outline-none" />
                                    <div className="flex gap-2">
                                      <input type="text" placeholder="Reg Num" value={editForm.form_data?.regNum || ''} onChange={(e) => setEditForm({...editForm, form_data: {...editForm.form_data, regNum: e.target.value}})} className="w-1/2 bg-black/40 border border-white/10 rounded-md p-2 text-white text-xs focus:border-blue-500 outline-none" />
                                      <input type="text" placeholder="Branch" value={editForm.form_data?.branch || ''} onChange={(e) => setEditForm({...editForm, form_data: {...editForm.form_data, branch: e.target.value}})} className="w-1/2 bg-black/40 border border-white/10 rounded-md p-2 text-white text-xs focus:border-blue-500 outline-none" />
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-bold text-white truncate">{reg.form_data?.fullName || 'N/A'}</span>
                                    <span className="text-xs text-white/60 truncate">{reg.lead_email}</span>
                                    <div className="flex gap-2 mt-auto pt-2 border-t border-white/5 text-xs text-white/40">
                                      {reg.form_data?.regNum && <span>{reg.form_data.regNum}</span>}
                                      {reg.form_data?.branch && <span>• {reg.form_data.branch}</span>}
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Nested Members */}
                              {(editingId === reg.id ? editForm.team_data?.members || [] : reg.team_data?.members || []).map((member: any, idx: number) => (
                                <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
                                  {reg.team_data?.leadIndex === (idx + 1) && <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>}
                                  <span className="text-[10px] uppercase text-white/40 tracking-wider">Member {idx + 1}</span>
                                  
                                  {editingId === reg.id ? (
                                    <>
                                      <input type="text" placeholder="Full Name" value={member.fullName || ''} onChange={(e) => {
                                        const newMembers = [...editForm.team_data.members];
                                        newMembers[idx] = { ...newMembers[idx], fullName: e.target.value };
                                        setEditForm({...editForm, team_data: {...editForm.team_data, members: newMembers}});
                                      }} className="w-full bg-black/40 border border-white/10 rounded-md p-2 text-white text-sm focus:border-blue-500 outline-none" />
                                      <input type="text" placeholder="Email" value={member.email || ''} onChange={(e) => {
                                        const newMembers = [...editForm.team_data.members];
                                        newMembers[idx] = { ...newMembers[idx], email: e.target.value };
                                        setEditForm({...editForm, team_data: {...editForm.team_data, members: newMembers}});
                                      }} className="w-full bg-black/40 border border-white/10 rounded-md p-2 text-white text-sm focus:border-blue-500 outline-none" />
                                      <div className="flex gap-2">
                                        <input type="text" placeholder="Reg Num" value={member.regNum || ''} onChange={(e) => {
                                          const newMembers = [...editForm.team_data.members];
                                          newMembers[idx] = { ...newMembers[idx], regNum: e.target.value };
                                          setEditForm({...editForm, team_data: {...editForm.team_data, members: newMembers}});
                                        }} className="w-1/2 bg-black/40 border border-white/10 rounded-md p-2 text-white text-xs focus:border-blue-500 outline-none" />
                                        <input type="text" placeholder="Branch" value={member.branch || ''} onChange={(e) => {
                                          const newMembers = [...editForm.team_data.members];
                                          newMembers[idx] = { ...newMembers[idx], branch: e.target.value };
                                          setEditForm({...editForm, team_data: {...editForm.team_data, members: newMembers}});
                                        }} className="w-1/2 bg-black/40 border border-white/10 rounded-md p-2 text-white text-xs focus:border-blue-500 outline-none" />
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-bold text-white truncate">{member.fullName || 'N/A'}</span>
                                      <span className="text-xs text-white/60 truncate">{member.email}</span>
                                      <div className="flex gap-2 mt-auto pt-2 border-t border-white/5 text-xs text-white/40">
                                        {member.regNum && <span>{member.regNum}</span>}
                                        {member.branch && <span>• {member.branch}</span>}
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
      
    <IDCardModal 
      isOpen={isIDModalOpen} 
      onClose={() => setIsIDModalOpen(false)} 
      registrations={filteredRegs.filter(r => selectedIds.has(r.id))} 
      eventTitle={eventTitle}
    />
  </>
)
}
