'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { TicketTemplate } from './TicketTemplate'
import { submitPublicRegistration } from '../events/actions'

interface FormRequirements {
  req_reg_num?: boolean;
  req_branch?: boolean;
  req_spec?: boolean;
  allow_teams?: boolean;
  max_team_size?: number;
}

interface Props {
  eventId: string;
  eventTitle: string;
  isRegistrationOpen: boolean;
  formRequirements?: FormRequirements;
  isWaitlistMode?: boolean;
}

export default function RegisterButton({ eventId, eventTitle, isRegistrationOpen, formRequirements, isWaitlistMode = false }: Props) {
  const [loading, setLoading] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [showWaitlistModal, setShowWaitlistModal] = useState(false)
  const [currentHash, setCurrentHash] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('-')
  const [userEmail, setUserEmail] = useState<string>('-')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  
  const ticketRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Dynamic Form State
  const [teamSize, setTeamSize] = useState(1)
  const [teamLeadIndex, setTeamLeadIndex] = useState(0)

  const reqs = formRequirements || {
    req_reg_num: true, req_branch: false, req_spec: false, allow_teams: false, max_team_size: 1
  }

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    const formData = new FormData(e.currentTarget)
    
    // Build base form data for the primary user
    const emailVal = formData.get('email') as string;
    const nameVal = formData.get('fullName') as string;
    const teamNameVal = formData.get('teamName') as string;
    
    setUserName(nameVal || '-');
    setUserEmail(emailVal || '-');

    const baseData: any = {
      email: emailVal,
      fullName: nameVal,
      teamName: teamNameVal,
    }
    if (reqs.req_reg_num) baseData.regNum = formData.get('regNum')
    if (reqs.req_branch) baseData.branch = formData.get('branch')
    if (reqs.req_spec) baseData.specialization = formData.get('specialization')
    baseData.year = formData.get('year')

    // Build team members array if applicable
    const teamMembers = []
    for (let i = 1; i < teamSize; i++) {
      const memberData: any = {
        fullName: formData.get(`member_${i}_name`),
        email: formData.get(`member_${i}_email`),
        year: formData.get(`member_${i}_year`)
      }
      if (reqs.req_reg_num) memberData.regNum = formData.get(`member_${i}_regNum`)
      if (reqs.req_branch) memberData.branch = formData.get(`member_${i}_branch`)
      if (reqs.req_spec) memberData.specialization = formData.get(`member_${i}_spec`)
      
      teamMembers.push(memberData)
    }

    baseData.teamMembers = teamMembers
    baseData.teamLeadIndex = teamLeadIndex

    const res = await submitPublicRegistration(eventId, baseData)
    setLoading(false)

    if (res?.error) {
      setErrorMsg(res.error)
    } else if (res?.success) {
      setShowFormModal(false)
      if (res.isWaitlisted) {
        setShowWaitlistModal(true)
      } else {
        setCurrentHash(res.hash_payload)
        setShowTicketModal(true)
      }
    }
  }

  async function downloadTicket() {
    if (!ticketRef.current) return;
    try {
      const htmlToImage = await import('html-to-image')
      const dataUrl = await htmlToImage.toPng(ticketRef.current, { backgroundColor: '#18181b', pixelRatio: 2, style: { transform: 'scale(1)', transformOrigin: 'top left' } })
      const link = document.createElement('a')
      link.download = `Event-Ticket-${currentHash?.substring(0, 8)}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error("Failed to generate ticket image:", err)
    }
  }

  // The QR code value will be the absolute URL to the checkin page!
  const qrCodeUrl = typeof window !== 'undefined' ? `${window.location.origin}/admin/checkin/${currentHash}` : ''

  return (
    <>
      <button 
        onClick={() => {
          if (currentHash) setShowTicketModal(true)
          else setShowFormModal(true)
        }}
        disabled={!isRegistrationOpen && !currentHash}
        className={`mt-4 px-5 py-2.5 rounded-xl text-sm font-bold transition-all w-full flex justify-center items-center gap-2 ${
          currentHash 
            ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]' 
            : !isRegistrationOpen
              ? 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed'
              : isWaitlistMode
                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
        } disabled:opacity-50`}
      >
        {currentHash ? (
          <><span>View My Ticket</span><i className="fas fa-qrcode"></i></>
        ) : !isRegistrationOpen ? (
          <><span>Registrations Closed</span><i className="fas fa-lock"></i></>
        ) : isWaitlistMode ? (
          <><span>Join Waitlist</span><i className="fas fa-clock"></i></>
        ) : (
          <><span>Register Now</span><i className="fas fa-arrow-right"></i></>
        )}
      </button>

      {/* Registration Form Modal */}
      {mounted && showFormModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-8 w-full max-w-2xl flex flex-col shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowFormModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
              <i className="fas fa-times text-lg"></i>
            </button>
            
            <h3 className="text-2xl font-bold text-white mb-2">Register for Event</h3>
            <p className="text-sm text-blue-400 mb-8 font-medium">{eventTitle}</p>

            {errorMsg && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm font-semibold">{errorMsg}</div>}
            
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Full Name</label>
                  <input type="text" name="fullName" required placeholder="Full Name" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Student Email Address</label>
                  <input type="email" name="email" required placeholder="you@university.edu" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {reqs.req_reg_num && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Reg No.</label>
                    <input type="text" name="regNum" required placeholder="APXX11XXXX" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                  </div>
                )}
                {reqs.req_branch && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Branch</label>
                    <select name="branch" required defaultValue="" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 w-full">
                      <option value="" disabled>Select Branch</option>
                      <option value="CSE">CSE</option>
                      <option value="ECE">ECE</option>
                      <option value="EEE">EEE</option>
                      <option value="BSc">BSc</option>
                      <option value="BBA">BBA</option>
                      <option value="MBA">MBA</option>
                      <option value="Mechanical">Mechanical</option>
                      <option value="others">others</option>
                    </select>
                  </div>
                )}
                {reqs.req_spec && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Specialization</label>
                    <input type="text" name="specialization" required placeholder="e.g. AI/ML" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Year of Study</label>
                  <select name="year" required defaultValue="" className="p-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500">
                    <option value="" disabled>Select Year</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Team Fields */}
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
                        <label className="text-[13px] font-semibold text-blue-400 uppercase tracking-wider">Team Name (Mandatory)</label>
                        <input type="text" name="teamName" required placeholder="Enter your team name" className="p-3 bg-black/40 border border-blue-500/30 rounded-xl text-white focus:outline-none focus:border-blue-500 w-full mb-4" />
                        
                        <label className="text-[13px] font-semibold text-blue-400 uppercase tracking-wider">Who is the Team Lead?</label>
                        <select value={teamLeadIndex} onChange={(e) => setTeamLeadIndex(parseInt(e.target.value))} className="p-3 bg-black/40 border border-blue-500/30 rounded-xl text-white focus:outline-none focus:border-blue-500">
                          <option value={0}>Me (Primary Registrant)</option>
                          {Array.from({length: teamSize - 1}, (_, i) => i + 1).map(num => (
                            <option key={num} value={num}>Member {num + 1}</option>
                          ))}
                        </select>
                      </div>

                      {Array.from({length: teamSize - 1}, (_, i) => i + 1).map(num => (
                        <div key={num} className="flex flex-col gap-4 pt-4 first:pt-0">
                          <h5 className="text-sm font-bold text-white/80">Member {num + 1} Details</h5>
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
                            {reqs.req_reg_num && (
                              <div className="flex flex-col gap-2">
                                <label className="text-[12px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Reg No.</label>
                                <input type="text" name={`member_${num}_regNum`} required placeholder="Reg Number" className="p-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500" />
                              </div>
                            )}
                            {reqs.req_branch && (
                              <div className="flex flex-col gap-2">
                                <label className="text-[12px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Branch</label>
                                <select name={`member_${num}_branch`} required defaultValue="" className="p-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 w-full">
                                  <option value="" disabled>Select Branch</option>
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
                            )}
                            {reqs.req_spec && (
                              <div className="flex flex-col gap-2">
                                <label className="text-[12px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Specialization</label>
                                <input type="text" name={`member_${num}_spec`} required placeholder="Spec" className="p-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500" />
                              </div>
                            )}
                            <div className="flex flex-col gap-2">
                              <label className="text-[12px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Year</label>
                              <select name={`member_${num}_year`} required defaultValue="" className="p-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500">
                                <option value="" disabled>Select Year</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button type="submit" disabled={loading} className={`w-full mt-4 p-4 rounded-xl font-bold transition-all shadow-lg text-white disabled:opacity-50 ${isWaitlistMode ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600' : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'}`}>
                {loading ? 'Processing...' : isWaitlistMode ? 'Join Waitlist Queue' : 'Complete Registration'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* QR Code Ticket Modal */}
      {mounted && showTicketModal && currentHash && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-w-sm w-full relative">
            <button onClick={() => setShowTicketModal(false)} className="absolute -top-12 right-0 text-white/40 hover:text-white transition-colors">
              <i className="fas fa-times text-2xl"></i>
            </button>
            
            {/* Downloadable Ticket Section (Hidden container for rendering) */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
              <TicketTemplate 
                ref={ticketRef}
                eventTitle={eventTitle}
                name={userName}
                email={userEmail}
                registrationId={currentHash}
                qrCodeUrl={qrCodeUrl}
              />
            </div>
            
            {/* Visual Preview for Modal */}
            <div className="bg-[#18181b] border border-white/10 rounded-2xl p-8 flex flex-col items-center shadow-2xl relative mb-4">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-t-2xl"></div>
              <h3 className="text-xl font-bold text-white mt-4 mb-2 text-center">OFFICIAL TICKET</h3>
              <p className="text-sm text-blue-400 mb-8 text-center font-bold max-w-[250px]">{eventTitle}</p>
              
              <div className="bg-white p-4 rounded-xl mb-6 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                <QRCodeCanvas value={qrCodeUrl} size={200} level="H" />
              </div>
              
              <div className="w-full border-t border-dashed border-white/20 pt-6 mb-2">
                <p className="text-[10px] uppercase tracking-widest text-white/40 text-center mb-1">Ticket Hash ID</p>
                <p className="text-xs text-white/80 font-mono text-center break-all">{currentHash.substring(0, 16)}...</p>
              </div>
            </div>

            <button onClick={downloadTicket} className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl text-white font-bold transition-colors shadow-lg flex justify-center items-center gap-2">
              <i className="fas fa-download"></i> Download Ticket Form
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Waitlist Success Modal */}
      {mounted && showWaitlistModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-8 w-full max-w-sm flex flex-col shadow-2xl relative items-center text-center">
            <button onClick={() => setShowWaitlistModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
              <i className="fas fa-times text-lg"></i>
            </button>
            <div className="w-20 h-20 bg-yellow-500/10 text-yellow-400 rounded-full flex items-center justify-center text-4xl mb-6 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
              <i className="fas fa-clock"></i>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">You're on the list!</h3>
            <p className="text-sm text-white/60 mb-8 leading-relaxed">
              This event is currently at full capacity, but you've been added to the waitlist queue. If a spot opens up, the organizers will notify you and automatically issue your ticket!
            </p>
            <button onClick={() => setShowWaitlistModal(false)} className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors shadow-lg">
              Got it
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
