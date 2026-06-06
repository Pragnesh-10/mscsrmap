'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
// @ts-ignore
import domtoimage from 'dom-to-image-more'
import { submitPublicRegistration, lookupTeamRegistration } from '../events/actions'

export default function EventPortalTabs({ event }: { event: any }) {
  const [activeTab, setActiveTab] = useState<'register' | 'check' | 'certificate'>('register')
  const [mounted, setMounted] = useState(false)

  // Registration State
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [currentHash, setCurrentHash] = useState<string | null>(null)
  const [currentReg, setCurrentReg] = useState<any>(null)
  const [showTicketModal, setShowTicketModal] = useState(false)
  
  // Lookup State
  const [lookupEmail, setLookupEmail] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  
  // Dynamic Form State
  const [teamSize, setTeamSize] = useState(1)
  const [teamLeadIndex, setTeamLeadIndex] = useState(0)
  const [isInternal, setIsInternal] = useState(true)
  const ticketRef = useRef<HTMLDivElement>(null)

  const reqs = event.form_requirements || {
    req_reg_num: true, req_branch: false, req_spec: false, allow_teams: false, max_team_size: 1, provide_certificates: true
  }
  const provideCertificates = reqs.provide_certificates !== false
  const isOpen = !!event.registration_open

  useEffect(() => {
    setMounted(true)
  }, [])

  async function handleRegistrationSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    const formData = new FormData(e.currentTarget)
    const baseData: any = {
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      year: formData.get('year')
    }

    if (isInternal) {
      if (!baseData.email.toString().toLowerCase().endsWith('@srmap.edu.in')) {
        setErrorMsg('Only @srmap.edu.in email addresses are allowed for SRMAP students.')
        setLoading(false)
        return
      }
      if (reqs.req_reg_num) baseData.regNum = formData.get('regNum')
      if (reqs.req_branch) baseData.branch = formData.get('branch')
      if (reqs.req_spec) baseData.specialization = formData.get('specialization')
    } else {
      baseData.collegeName = formData.get('collegeName')
      baseData.city = formData.get('city')
    }

    const teamMembers = []
    for (let i = 1; i < teamSize; i++) {
      const memberEmail = formData.get(`member_${i}_email`)?.toString() || ''
      
      if (isInternal && !memberEmail.toLowerCase().endsWith('@srmap.edu.in')) {
        setErrorMsg(`Member ${i + 1} must use an @srmap.edu.in email address.`)
        setLoading(false)
        return
      }

      const member: any = {
        fullName: formData.get(`member_${i}_name`),
        email: memberEmail,
        year: formData.get(`member_${i}_year`)
      }
      if (isInternal) {
        if (reqs.req_reg_num) member.regNum = formData.get(`member_${i}_regNum`)
        if (reqs.req_branch) member.branch = formData.get(`member_${i}_branch`)
        if (reqs.req_spec) member.spec = formData.get(`member_${i}_spec`)
      }
      teamMembers.push(member)
    }

    baseData.teamMembers = teamMembers
    baseData.teamLeadIndex = teamLeadIndex
    if (teamSize > 1) {
      baseData.teamName = formData.get('teamName')
    }

    const res = await submitPublicRegistration(event.id, baseData)
    setLoading(false)

    if (res?.error) {
      setErrorMsg(res.error)
    } else if (res?.success) {
      setCurrentHash(res.hash_payload)
      if (res.registration) {
        setCurrentReg(res.registration)
      }
      setShowTicketModal(true)
    }
  }

  async function handleLookupSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLookupLoading(true)
    setLookupError(null)

    const res = await lookupTeamRegistration(event.id, lookupEmail)
    setLookupLoading(false)

    if (res?.error) {
      setLookupError(res.error)
    } else if (res?.success) {
      setCurrentHash(res.hash_payload)
      if (res.registration) setCurrentReg(res.registration)
      setShowTicketModal(true)
    }
  }

  async function downloadTicket() {
    if (!ticketRef.current) return;
    try {
      const dataUrl = await domtoimage.toPng(ticketRef.current, { bgcolor: '#18181b', scale: 2 })
      const link = document.createElement('a')
      link.download = `Event-Ticket-${currentHash?.substring(0, 8)}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error("Failed to generate ticket image:", err)
    }
  }

  async function downloadCertificate() {
    const certEl = document.getElementById('certificate-node')
    if (!certEl) return;
    try {
      const dataUrl = await domtoimage.toPng(certEl, { bgcolor: '#0a0a0b', scale: 2 })
      const link = document.createElement('a')
      link.download = `${event.title}-Certificate.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error("Failed to generate certificate:", err)
    }
  }

  const qrCodeUrl = typeof window !== 'undefined' ? `${window.location.origin}/admin/checkin/${currentHash}` : ''
  const certType = currentReg?.form_data?.certificate_type || 'none'
  const isWinner = certType === 'winner'
  const isRunnerUp = certType === 'runner_up'
  const isParticipation = certType === 'participation'
  const hasCertificate = isWinner || isRunnerUp || isParticipation
  const customTemplateUrl = event.form_requirements?.certificate_template_url

  return (
    <>
      <div className="w-full">
        {/* Tabs */}
        <div className="flex flex-col md:flex-row gap-2 mb-8 bg-[#18181b]/40 backdrop-blur-md p-2 rounded-2xl border border-white/5">
          <button 
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-4 px-6 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'register' 
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <i className="fas fa-file-signature"></i> Register for Event
          </button>
          <button 
            onClick={() => setActiveTab('check')}
            className={`flex-1 py-4 px-6 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'check' 
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]' 
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <i className="fas fa-search"></i> Check Team Details
          </button>
          
          {provideCertificates && (
            <button 
              onClick={() => setActiveTab('certificate')}
              className={`flex-1 py-4 px-6 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'certificate' 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]' 
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <i className="fas fa-certificate"></i> E-Certificate
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="bg-[#18181b]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl min-h-[400px]">
          
          {/* REGISTER TAB */}
          {activeTab === 'register' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="mb-8 border-b border-white/5 pb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Event Registration</h2>
                <p className="text-white/40 text-sm">Secure your spot by filling out the form below.</p>
              </div>

              {!isOpen ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4 text-red-500">
                    <i className="fas fa-lock text-2xl"></i>
                  </div>
                  <h3 className="text-xl font-bold text-red-400 mb-2">Registrations are Closed</h3>
                  <p className="text-red-400/60 text-sm">The administration has closed registrations for this event.</p>
                </div>
              ) : currentHash ? (
                 <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-8 flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4 text-green-500">
                    <i className="fas fa-check text-2xl"></i>
                  </div>
                  <h3 className="text-xl font-bold text-green-400 mb-2">You are Registered!</h3>
                  <p className="text-green-400/60 text-sm mb-6">Your registration was successful. Keep your ticket safe!</p>
                  <button onClick={() => setShowTicketModal(true)} className="px-6 py-3 bg-green-500 hover:bg-green-600 rounded-xl font-bold transition-colors text-white">
                    View My Ticket
                  </button>
                 </div>
              ) : (
                <form onSubmit={handleRegistrationSubmit} className="flex flex-col gap-6">
                  {errorMsg && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm font-semibold">{errorMsg}</div>}
                  
                  {reqs.allow_external_students && (
                    <div className="flex flex-col gap-3 p-5 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-2">
                      <h4 className="text-[13px] font-bold text-blue-400 uppercase tracking-wider">Are you an SRMAP Student?</h4>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="student_type" checked={isInternal} onChange={() => setIsInternal(true)} className="w-4 h-4 accent-blue-500" />
                          <span className="text-sm font-semibold text-white">Yes, I am from SRMAP</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="student_type" checked={!isInternal} onChange={() => setIsInternal(false)} className="w-4 h-4 accent-blue-500" />
                          <span className="text-sm font-semibold text-white/80">No, I am from another College/University</span>
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Full Name</label>
                      <input type="text" name="fullName" required placeholder="John Doe" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Student Email Address</label>
                      <input type="email" name="email" required placeholder="you@university.edu" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {isInternal ? (
                      <>
                        {reqs.req_reg_num && (
                          <div className="flex flex-col gap-2">
                            <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Reg No.</label>
                            <input type="text" name="regNum" required placeholder="APXX11XXXX" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                          </div>
                        )}
                        {reqs.req_branch && (
                          <div className="flex flex-col gap-2">
                            <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Branch</label>
                            <input type="text" name="branch" required placeholder="e.g. CSE" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                          </div>
                        )}
                        {reqs.req_spec && (
                          <div className="flex flex-col gap-2">
                            <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Specialization</label>
                            <input type="text" name="specialization" required placeholder="e.g. AI/ML" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex flex-col gap-2 lg:col-span-2">
                          <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">College/University Name</label>
                          <input type="text" name="collegeName" required placeholder="e.g. VIT Chennai" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">City</label>
                          <input type="text" name="city" required placeholder="e.g. Chennai" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                        </div>
                      </>
                    )}
                    <div className="flex flex-col gap-2">
                      <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Year of Study</label>
                      <input type="text" name="year" required placeholder="e.g. 2nd Year" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>

                  {reqs.allow_teams && reqs.max_team_size && reqs.max_team_size > 1 && (
                    <div className="mt-4 pt-6 border-t border-white/10">
                      <h4 className="text-lg font-bold text-white mb-4">Team Registration (Optional)</h4>
                      <div className="flex flex-col gap-2 mb-6">
                        <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Total Team Size</label>
                        <select value={teamSize} onChange={(e) => setTeamSize(parseInt(e.target.value))} className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 w-full md:w-1/3">
                          {Array.from({length: reqs.max_team_size}, (_, i) => i + 1).map(num => (
                            <option key={num} value={num}>{num === 1 ? '1 (Solo)' : num}</option>
                          ))}
                        </select>
                      </div>

                      {teamSize > 1 && (
                        <div className="flex flex-col gap-6 p-5 bg-white/5 rounded-xl border border-white/10 mb-6">
                          <div className="flex flex-col gap-2 mb-2 border-b border-white/10 pb-6">
                            <label className="text-[13px] font-semibold text-blue-400 uppercase tracking-wider">Team Name</label>
                            <input type="text" name="teamName" required placeholder="Enter a cool team name" className="p-3 bg-black/40 border border-blue-500/30 rounded-xl text-white focus:outline-none focus:border-blue-500 w-full mb-4" />
                            
                            <label className="text-[13px] font-semibold text-blue-400 uppercase tracking-wider">Who is the Team Lead?</label>
                            <select value={teamLeadIndex} onChange={(e) => setTeamLeadIndex(parseInt(e.target.value))} className="p-3 bg-black/40 border border-blue-500/30 rounded-xl text-white focus:outline-none focus:border-blue-500">
                              <option value={0}>Me (Primary Registrant)</option>
                              {Array.from({length: teamSize - 1}, (_, i) => i + 1).map(num => (
                                <option key={num} value={num}>Member {num + 1}</option>
                              ))}
                            </select>
                          </div>

                          {Array.from({length: teamSize - 1}, (_, i) => i + 1).map(num => (
                            <div key={num} className="flex flex-col gap-4 pt-4 first:pt-0 border-t border-white/5">
                              <h5 className="text-sm font-bold text-white/80 mt-4">Member {num + 1} Details</h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                  <label className="text-[12px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Name</label>
                                  <input type="text" name={`member_${num}_name`} required placeholder={`Member ${num + 1} Name`} className="p-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500" />
                                </div>
                                <div className="flex flex-col gap-2">
                                  <label className="text-[12px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Email</label>
                                  <input type="email" name={`member_${num}_email`} required placeholder={`member${num+1}@example.com`} className="p-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500" />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {isInternal && (
                                  <>
                                    {reqs.req_reg_num && (
                                      <div className="flex flex-col gap-2">
                                        <label className="text-[12px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Reg No.</label>
                                        <input type="text" name={`member_${num}_regNum`} required placeholder="Reg Number" className="p-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500" />
                                      </div>
                                    )}
                                    {reqs.req_branch && (
                                      <div className="flex flex-col gap-2">
                                        <label className="text-[12px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Branch</label>
                                        <input type="text" name={`member_${num}_branch`} required placeholder="Branch" className="p-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500" />
                                      </div>
                                    )}
                                    {reqs.req_spec && (
                                      <div className="flex flex-col gap-2">
                                        <label className="text-[12px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Specialization</label>
                                        <input type="text" name={`member_${num}_spec`} required placeholder="Spec" className="p-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500" />
                                      </div>
                                    )}
                                  </>
                                )}
                                <div className="flex flex-col gap-2">
                                  <label className="text-[12px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Year</label>
                                  <input type="text" name={`member_${num}_year`} required placeholder="Year" className="p-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="w-full mt-4 p-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl font-bold transition-all shadow-lg text-white disabled:opacity-50">
                    {loading ? 'Processing Registration...' : 'Complete Registration'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* CHECK TEAM TAB */}
          {activeTab === 'check' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="mb-8 border-b border-white/5 pb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Check Team Details & Retrieve Ticket</h2>
                <p className="text-white/40 text-sm">Enter the Team Lead's email address to recover your registration form and QR code.</p>
              </div>

              <div className="max-w-md mx-auto">
                <form onSubmit={handleLookupSubmit} className="flex flex-col gap-6">
                  {lookupError && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm font-semibold">{lookupError}</div>}
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Team Lead Email Address</label>
                    <input 
                      type="email" 
                      required 
                      value={lookupEmail}
                      onChange={(e) => setLookupEmail(e.target.value)}
                      placeholder="lead@university.edu" 
                      className="p-4 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500 text-lg" 
                    />
                  </div>
                  
                  <button type="submit" disabled={lookupLoading} className="w-full p-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-xl font-bold transition-all shadow-lg text-white disabled:opacity-50">
                    {lookupLoading ? 'Searching...' : 'Find My Ticket'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* CERTIFICATE TAB */}
          {provideCertificates && activeTab === 'certificate' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              {!currentReg ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                    <i className="fas fa-lock text-4xl text-white/20"></i>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-4">E-Certificates Locked</h2>
                  <p className="text-white/40 text-center max-w-md">
                    Please go to the <b>"Check Team Details"</b> tab and enter your email address to unlock your certificate!
                  </p>
                </div>
              ) : !hasCertificate ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                    <i className={`fas text-4xl ${event.status === 'completed' ? 'fa-hourglass-half text-orange-400' : 'fa-lock text-white/20'}`}></i>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-4">No Certificate Assigned Yet</h2>
                  <p className="text-white/40 text-center max-w-md">
                    {event.status === 'completed' 
                      ? 'The administration is currently processing the certificates for this event. Check back shortly!'
                      : 'Certificates will be unlocked here after the event concludes and attendance is verified.'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="mb-8 border-b border-white/5 pb-6 w-full">
                    <h2 className="text-2xl font-bold text-white mb-2">Your E-Certificate</h2>
                    <p className="text-white/40 text-sm">Congratulations! You can download your official certificate below.</p>
                  </div>

                  {/* Certificate Node for html2canvas */}
                  {reqs.certificate_html ? (
                    <div 
                      id="certificate-node" 
                      className="w-full max-w-3xl aspect-[1.414/1] relative shadow-2xl mb-8 overflow-hidden bg-white"
                      dangerouslySetInnerHTML={{ 
                        __html: reqs.certificate_html
                          .replace(/\{\{NAME\}\}/g, currentReg.team_data?.teamName || currentReg.form_data?.fullName || '')
                          .replace(/\{\{EVENT_TITLE\}\}/g, event.title || '')
                          .replace(/\{\{EVENT_DATE\}\}/g, new Date(event.date_start).toLocaleDateString())
                          .replace(/\{\{COLLEGE_NAME\}\}/g, currentReg.form_data?.collegeName || 'SRMAP')
                      }}
                    />
                  ) : (
                    <div id="certificate-node" className="relative w-full max-w-3xl aspect-[1.414/1] bg-[#0a0a0b] overflow-hidden border-8 border-double p-12 flex flex-col items-center text-center shadow-2xl mb-8"
                    style={{
                      borderColor: isWinner ? '#eab308' : isRunnerUp ? '#9ca3af' : '#3b82f6',
                      background: customTemplateUrl ? `url(${customTemplateUrl})` : 
                                  (isWinner ? 'radial-gradient(circle at center, #422006 0%, #0a0a0b 100%)' :
                                  isRunnerUp ? 'radial-gradient(circle at center, #1f2937 0%, #0a0a0b 100%)' :
                                  'radial-gradient(circle at center, #172554 0%, #0a0a0b 100%)'),
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      textShadow: customTemplateUrl ? '0 2px 10px rgba(0,0,0,0.8)' : 'none'
                    }}
                  >
                    {/* Optional Dark Overlay if custom template is too bright, but we rely on text-shadow instead to preserve the template's beauty */}
                    
                    {/* Watermark Logo/Icon - hide if custom template to prevent clashing */}
                    {!customTemplateUrl && (
                      <i className={`fas absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[300px] opacity-5 pointer-events-none ${
                        isWinner ? 'fa-trophy text-yellow-500' : isRunnerUp ? 'fa-medal text-gray-400' : 'fa-award text-blue-500'
                      }`}></i>
                    )}

                    <div className="relative z-10 flex flex-col items-center w-full h-full">
                      <h4 className="text-sm font-black tracking-[0.3em] uppercase text-white/80 mb-12 drop-shadow-md">Official Certificate</h4>
                      
                      <h1 className={`text-5xl md:text-6xl font-black uppercase mb-4 tracking-wider drop-shadow-lg ${
                        isWinner ? 'text-yellow-400' : isRunnerUp ? 'text-gray-200' : 'text-blue-300'
                      }`}>
                        {isWinner ? 'Winner' : isRunnerUp ? 'Runner-Up' : 'Participation'}
                      </h1>
                      
                      <p className="text-white/80 text-lg mb-8 font-light italic drop-shadow-md">This is proudly presented to</p>
                      
                      <h2 className="text-4xl font-bold text-white mb-8 border-b border-white/30 pb-4 inline-block px-12 drop-shadow-xl">
                        {currentReg.team_data?.teamName ? currentReg.team_data.teamName : currentReg.form_data?.fullName}
                      </h2>
                      
                      <p className="text-white/80 text-lg mb-4 font-light italic drop-shadow-md">for their outstanding participation and achievement in</p>
                      <h3 className="text-2xl font-bold text-white mb-auto drop-shadow-lg">{event.title}</h3>
                      
                      <div className="w-full flex justify-between items-end mt-12 border-t border-white/30 pt-8 drop-shadow-md">
                        <div className="flex flex-col items-center w-48">
                          <div className="h-px w-full bg-white/60 mb-2"></div>
                          <span className="text-xs text-white/80 uppercase tracking-widest font-bold">Event Date</span>
                          <span className="text-sm text-white/90 mt-1 font-semibold">{new Date(event.date_start).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}

                  <button onClick={downloadCertificate} className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl font-bold transition-all shadow-[0_10px_30px_rgba(59,130,246,0.3)] text-white flex items-center gap-3">
                    <i className="fas fa-download text-xl"></i> Download High-Res Certificate
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* QR Code Ticket Modal */}
      {mounted && showTicketModal && currentHash && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-w-sm w-full relative">
            <button onClick={() => setShowTicketModal(false)} className="absolute -top-12 right-0 text-white/40 hover:text-white transition-colors">
              <i className="fas fa-times text-2xl"></i>
            </button>
            
            <div ref={ticketRef} className="bg-[#18181b] border border-white/10 rounded-2xl p-8 flex flex-col items-center shadow-2xl relative mb-4 w-[400px]">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-t-2xl"></div>
              
              <div className="w-full border-b border-white/10 pb-4 mb-6 text-center mt-2">
                <h3 className="text-xl font-black text-white tracking-wider">OFFICIAL REGISTRATION</h3>
                <p className="text-sm text-blue-400 font-bold mt-1">{event.title}</p>
                {event.location && (
                  <p className="text-xs text-white/60 mt-1 flex items-center justify-center gap-1">
                    <i className="fas fa-map-marker-alt"></i> {event.location}
                  </p>
                )}
                {event.date_start && (
                  <p className="text-xs text-white/60 mt-1 flex items-center justify-center gap-1">
                    <i className="fas fa-calendar-alt"></i> {new Date(event.date_start).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="flex w-full justify-between items-center mb-6">
                <div className="bg-white p-4 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.15)] shrink-0">
                  <QRCodeSVG value={currentHash || ''} size={150} level="M" />
                </div>
                
                <div className="ml-6 flex-1 flex flex-col items-end text-right">
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Primary Registrant</p>
                  <p className="text-sm font-bold text-white mb-3">
                    {currentReg?.form_data?.fullName || currentReg?.lead_email || 'N/A'}
                  </p>
                  
                  {currentReg?.team_data?.teamName && (
                    <>
                      <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Team Name</p>
                      <p className="text-sm font-bold text-purple-400">{currentReg.team_data.teamName}</p>
                    </>
                  )}
                </div>
              </div>

              {currentReg?.team_data?.members && currentReg.team_data.members.length > 0 && (
                <div className="w-full bg-black/40 rounded-xl p-4 mb-6 border border-white/5">
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2 border-b border-white/5 pb-2">Team Members</p>
                  <div className="flex flex-col gap-1">
                    {currentReg.team_data.members.map((m: any, idx: number) => (
                      <p key={idx} className="text-xs text-white/80 flex justify-between">
                        <span>{m.fullName || m.email}</span>
                        {currentReg.team_data.leadIndex === idx + 1 && <span className="text-purple-400 text-[10px] font-bold">LEAD</span>}
                      </p>
                    ))}
                    {currentReg.team_data.leadIndex === 0 && (
                      <p className="text-xs text-white/80 flex justify-between">
                        <span>{currentReg.form_data?.fullName || currentReg.lead_email}</span>
                        <span className="text-purple-400 text-[10px] font-bold">LEAD</span>
                      </p>
                    )}
                  </div>
                </div>
              )}
              

            </div>

            <button onClick={downloadTicket} className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl text-white font-bold transition-colors shadow-lg flex justify-center items-center gap-2">
              <i className="fas fa-download"></i> Download Ticket Form
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
