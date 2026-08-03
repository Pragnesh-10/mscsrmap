'use client'

import { useEffect, useState, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { createClient } from '@/utils/supabase/client'
import { 
  initDB, 
  saveRegistrations, 
  saveSingleRegistration, 
  getRegistrationByHash, 
  updateLocalRegistrationCheckin, 
  addToSyncQueue, 
  getSyncQueue, 
  removeFromSyncQueue,
  getRegistrationCount,
  searchCachedRegistrations
} from '@/utils/indexedDB'
import { syncOfflineCheckins } from '@/app/admin/events/[id]/actions'

// Haptic feedback trigger helper
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

// Synthesis of beep sound offline using Web Audio API
function playSound(type: 'success' | 'error' | 'click') {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    
    if (type === 'success') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1) // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.3)
    } else if (type === 'error') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(150, ctx.currentTime)
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.25)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.25)
    } else {
      osc.frequency.setValueAtTime(700, ctx.currentTime)
      gain.gain.setValueAtTime(0.03, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.05)
    }
  } catch (err) {
    console.error('AudioContext beep failed:', err)
  }
}

interface ScanLog {
  id: string
  name: string
  email: string
  time: string
  type: string
  synced: boolean
}

export default function QRScanner({ eventId }: { eventId?: string }) {
  const supabase = createClient()
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [secureContextError, setSecureContextError] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  
  // Offline-first States
  const [isOnline, setIsOnline] = useState(true)
  const [cachedCount, setCachedCount] = useState(0)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [isCaching, setIsCaching] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastCacheTime, setLastCacheTime] = useState<string | null>(null)
  
  // Camera toggles
  const [cameras, setCameras] = useState<any[]>([])
  const [activeCameraId, setActiveCameraId] = useState<string>('')
  const [torchSupported, setTorchSupported] = useState(false)
  const [isTorchOn, setIsTorchOn] = useState(false)

  // Scan History Log Feed
  const [scanHistory, setScanHistory] = useState<ScanLog[]>([])

  // Manual search lookup state
  const [manualSearchQuery, setManualSearchQuery] = useState('')
  const [manualSearchResults, setManualSearchResults] = useState<any[]>([])
  
  // Scanned Registration Detail Modal
  const [selectedReg, setSelectedReg] = useState<any | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [searchingRemote, setSearchingRemote] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Initialize DB and Status Checks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(window.navigator.onLine)
      
      const handleOnline = () => {
        setIsOnline(true)
        triggerHaptic('light')
        syncPendingQueue()
      }
      const handleOffline = () => {
        setIsOnline(false)
        triggerHaptic('warning')
      }

      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      
      // Initialize IndexedDB
      initDB().then(async () => {
        const count = await getRegistrationCount()
        setCachedCount(count)
        
        const queue = await getSyncQueue()
        setPendingSyncCount(queue.length)
        
        if (queue.length > 0 && window.navigator.onLine) {
          syncPendingQueue()
        }
      }).catch(console.error)

      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  // Real-time background sync for IndexedDB
  useEffect(() => {
    if (!eventId || !isOnline) return;

    const channel = supabase.channel(`scanner_${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: `event_id=eq.${eventId}` }, async (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          // Save the new/updated record to IndexedDB so local search stays up-to-date
          await saveSingleRegistration(payload.new)
          // Update cached count
          const count = await getRegistrationCount()
          setCachedCount(count)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, isOnline])

  const checkTorchSupport = () => {
    try {
      const videoElem = document.getElementById('reader')?.getElementsByTagName('video')[0]
      if (videoElem) {
        const stream = videoElem.srcObject as MediaStream
        const track = stream?.getVideoTracks()[0]
        if (track) {
          const capabilities = track.getCapabilities() as any
          if (capabilities && capabilities.torch) {
            setTorchSupported(true)
            return
          }
        }
      }
    } catch (e) {
      console.error('Failed to inspect camera track capabilities:', e)
    }
    setTorchSupported(false)
  }

  // Start Camera scanning logic
  const startScanning = async (cameraId: string) => {
    if (!scannerRef.current) return;
    
    try {
      if (scannerRef.current.isScanning) {
        try {
          await scannerRef.current.stop()
        } catch (_) {}
      }
      setIsTorchOn(false)
      setTorchSupported(false)

      await scannerRef.current.start(
        cameraId,
        { fps: 24, disableFlip: false },
        onScanSuccess,
        onScanFailure
      )
      
      // Check if torch is supported after a brief delay for camera setup
      setTimeout(checkTorchSupport, 500)
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.toString()?.includes('interrupted')) {
        return
      }
      console.error("Error starting camera scanner:", err)
      setCameraError("Could not start scanner. Ensure you have granted camera permissions.")
    }
  }

  // Initialize Camera selection and start default
  useEffect(() => {
    if (!isCameraActive) return

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setSecureContextError(true)
      return
    }

    const html5QrCode = new Html5Qrcode("reader")
    scannerRef.current = html5QrCode

    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length > 0) {
        setCameras(devices)
        
        // Find environment back camera
        const backCam = devices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('environment') || 
          d.label.toLowerCase().includes('rear')
        )
        const defaultCamId = backCam ? backCam.id : devices[0].id
        setActiveCameraId(defaultCamId)
        startScanning(defaultCamId)
      } else {
        setCameraError("No cameras detected on this device.")
      }
    }).catch(err => {
      console.error("Error getting cameras:", err)
      setCameraError("Failed to access camera. Please check your browser permissions.")
    })

    return () => {
      try {
        if (html5QrCode.isScanning) {
          html5QrCode.stop().then(() => {
            try { html5QrCode.clear() } catch (_) {}
          }).catch(err => {
            if (err?.name !== 'AbortError' && !err?.toString()?.includes('interrupted')) {
              console.debug('Scanner cleanup:', err)
            }
          })
        } else {
          try { html5QrCode.clear() } catch (_) {}
        }
      } catch (_) {}
    }
  }, [isCameraActive])

  // Manual lookup search effect
  useEffect(() => {
    if (manualSearchQuery.trim().length > 1) {
      searchCachedRegistrations(manualSearchQuery).then(results => {
        setManualSearchResults(results)
      }).catch(console.error)
    } else {
      setManualSearchResults([])
    }
  }, [manualSearchQuery])

  // Switch Active Camera
  const handleSwitchCamera = async (cameraId: string) => {
    triggerHaptic('light')
    setActiveCameraId(cameraId)
    await startScanning(cameraId)
  }

  // Toggle Torch/Flashlight
  const handleToggleTorch = async () => {
    if (!torchSupported) return
    const nextTorchState = !isTorchOn
    try {
      const videoElem = document.getElementById('reader')?.getElementsByTagName('video')[0]
      if (videoElem) {
        const stream = videoElem.srcObject as MediaStream
        const track = stream?.getVideoTracks()[0]
        if (track) {
          await track.applyConstraints({
            advanced: [{ torch: nextTorchState } as any]
          })
          setIsTorchOn(nextTorchState)
          triggerHaptic('light')
        }
      }
    } catch (e) {
      console.error('Failed to toggle camera flash:', e)
    }
  }

  // Cache registrations from Supabase to IndexedDB
  const downloadAndCacheRegistrations = async () => {
    if (!eventId) return
    setIsCaching(true)
    triggerHaptic('light')
    
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('event_id', eventId)

      if (error) throw error

      if (data) {
        await saveRegistrations(data)
        const count = await getRegistrationCount()
        setCachedCount(count)
        setLastCacheTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
        triggerHaptic('success')
      }
    } catch (err: any) {
      console.error('Caching failed:', err)
      triggerHaptic('error')
      alert('Failed to cache event registrations: ' + err.message)
    } finally {
      setIsCaching(false)
    }
  }

  // Sync any offline check-ins currently queued
  const syncPendingQueue = async () => {
    if (isSyncing || !window.navigator.onLine || !eventId) return
    setIsSyncing(true)
    
    try {
      const queue = await getSyncQueue()
      if (queue.length === 0) {
        setIsSyncing(false)
        return
      }

      // Convert local checkins to sync payload
      const payload = queue.map(q => ({
        hash: q.hash,
        type: q.type,
        memberIndex: q.memberIndex
      }))

      const res = await syncOfflineCheckins(eventId, payload)
      
      if (res?.success) {
        const syncedIds = queue.map(q => q.id!)
        await removeFromSyncQueue(syncedIds)
        
        const remainingQueue = await getSyncQueue()
        setPendingSyncCount(remainingQueue.length)
        
        // Refresh local cache count
        const count = await getRegistrationCount()
        setCachedCount(count)

        // Mark local history sync states
        setScanHistory(prev => prev.map(log => ({ ...log, synced: true })))
      } else if (res?.error) {
        console.error('Server sync error:', res.error)
      }
    } catch (err) {
      console.error('Sync queue loop failure:', err)
    } finally {
      setIsSyncing(false)
    }
  }

  // Handle successful QR scan
  const onScanSuccess = async (decodedText: string) => {
    // If modal is already open, ignore new scans
    if (showModal) return

    setScanResult(decodedText)
    
    // Extract ticket hash payload
    let hash = decodedText
    if (decodedText.includes('/admin/checkin/')) {
      hash = decodedText.split('/admin/checkin/')[1]
      // Strip potential URL parameters
      if (hash.includes('?')) {
        hash = hash.split('?')[0]
      }
    }

    if (!hash || hash.length < 10) {
      playSound('error')
      triggerHaptic('error')
      setErrorMessage("Invalid QR Ticket structure.")
      setShowModal(true)
      return
    }

    await handleVerificationByHash(hash)
  }

  // Handles lookup and display of detailed ticket record
  const handleVerificationByHash = async (hash: string) => {
    // Pause camera scanning temporarily
    if (scannerRef.current) {
      try {
        await scannerRef.current.pause(true)
      } catch (e) {}
    }

    // 1. Search locally in IndexedDB
    try {
      const localRecord = await getRegistrationByHash(hash)
      if (localRecord) {
        playSound('success')
        triggerHaptic('success')
        setSelectedReg(localRecord)
        setShowModal(true)
        return
      }
    } catch (e) {
      console.error('IndexedDB query failed:', e)
    }

    // 2. Fallback to server search if online
    if (isOnline) {
      setSearchingRemote(true)
      setShowModal(true) // Show scanning loader
      try {
        const { data, error } = await supabase
          .from('registrations')
          .select('*, events(title)')
          .eq('hash_payload', hash)
          .single()

        if (error || !data) {
          throw new Error("Ticket not found in central database.")
        }

        playSound('success')
        triggerHaptic('success')
        setSelectedReg(data)
      } catch (err: any) {
        playSound('error')
        triggerHaptic('error')
        setErrorMessage(err.message || "Invalid ticket.")
      } finally {
        setSearchingRemote(false)
      }
    } else {
      // Offline and not in cache
      playSound('error')
      triggerHaptic('error')
      setErrorMessage("Ticket not found in local cache (Offline Mode).")
      setShowModal(true)
    }
  }

  const onScanFailure = () => {
    // Silent fail since scanner loops continuously
  }

  // Execute Check-in Action (Offline-First)
  const handleCheckinAction = async (type: 'PRIMARY' | 'MEMBER', memberIndex?: number) => {
    if (!selectedReg || !eventId) return
    playSound('click')
    triggerHaptic('light')

    const hash = selectedReg.hash_payload

    try {
      // 1. Deep clone selectedReg to avoid mutation side-effects and guarantee updatedReg is defined
      const updatedReg = JSON.parse(JSON.stringify(selectedReg))

      if (type === 'PRIMARY') {
        updatedReg.checked_in = true
      } else if (type === 'MEMBER' && typeof memberIndex === 'number' && updatedReg.team_data?.members) {
        if (updatedReg.team_data.members[memberIndex]) {
          updatedReg.team_data.members[memberIndex].checked_in = true
        }
      }

      // 2. Save the updated record in IndexedDB (handles new/uncached registrations correctly)
      await saveSingleRegistration(updatedReg)
      
      // 3. Add to sync queue
      await addToSyncQueue(eventId, hash, type, memberIndex)
      
      // 4. Update state with the updated registration object
      setSelectedReg(updatedReg)
      
      // 5. Update sync status indicator
      const queue = await getSyncQueue()
      setPendingSyncCount(queue.length)

      // 6. Add to Scan history Feed
      let attendeeName = updatedReg.form_data?.fullName || updatedReg.lead_email
      if (type === 'MEMBER' && typeof memberIndex === 'number' && updatedReg.team_data?.members[memberIndex]) {
        attendeeName = updatedReg.team_data.members[memberIndex].fullName || `Member ${memberIndex + 2}`
      }

      const newLog: ScanLog = {
        id: Math.random().toString(),
        name: attendeeName,
        email: type === 'PRIMARY' ? updatedReg.lead_email : (updatedReg.team_data?.members[memberIndex!]?.email || ''),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: type === 'PRIMARY' ? 'Primary' : 'Team Member',
        synced: isOnline
      }
      setScanHistory(prev => [newLog, ...prev.slice(0, 4)])

      // 7. Fire sync action in background if online
      if (isOnline) {
        syncPendingQueue()
      }
    } catch (err) {
      console.error('Failed to store check-in locally:', err)
      alert('Failed to register check-in locally. Please try again.')
    }
  }

  // Resume scanning loop
  const handleCloseModal = () => {
    playSound('click')
    setSelectedReg(null)
    setErrorMessage(null)
    setShowModal(false)
    setScanResult(null)
    
    if (scannerRef.current) {
      try {
        scannerRef.current.resume()
      } catch (e) {}
    }
  }

  const isTeam = selectedReg?.team_data && selectedReg.team_data.members && selectedReg.team_data.members.length > 0
  
  return (
    <div className="flex flex-col items-center w-full">
      {/* Styles for Visual scanner view laser animation */}
      <style>{`
        @keyframes scan-laser {
          0% { top: 8%; opacity: 0.3; }
          50% { top: 92%; opacity: 0.9; }
          100% { top: 8%; opacity: 0.3; }
        }
        .scanner-laser {
          animation: scan-laser 2.2s infinite linear;
        }
      `}</style>

      {/* Offline Status & Cache Control Bar */}
      <div className="w-full max-w-lg mb-6 bg-[#18181b]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg z-10">
        {/* Network & Queue status */}
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-amber-500 animate-bounce'}`}></span>
            <span className="text-xs font-bold uppercase tracking-wider text-white/80">
              {isOnline ? 'Network: Online' : 'Network: Offline Mode'}
            </span>
          </div>
          <div className="text-[10px] text-white/40 font-semibold uppercase tracking-widest mt-0.5">
            {pendingSyncCount > 0 ? (
              <span className="text-orange-400 font-extrabold flex items-center gap-1">
                <i className="fas fa-exclamation-circle animate-pulse"></i> {pendingSyncCount} Scan(s) Pending Sync
              </span>
            ) : (
              <span className="text-green-500/85">All check-ins fully synced</span>
            )}
          </div>
        </div>

        {/* Sync Controls */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {eventId && (
            <button
              onClick={downloadAndCacheRegistrations}
              disabled={isCaching}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 disabled:opacity-50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isCaching ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Caching...
                </>
              ) : (
                <>
                  <i className="fas fa-sync-alt"></i> Update Cache ({cachedCount})
                </>
              )}
            </button>
          )}
          {pendingSyncCount > 0 && isOnline && (
            <button
              onClick={syncPendingQueue}
              disabled={isSyncing}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 disabled:opacity-50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSyncing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-cloud-upload-alt"></i>} Sync Queue
            </button>
          )}
        </div>
      </div>

      {lastCacheTime && (
        <div className="text-[10px] text-white/30 uppercase tracking-widest mb-4 font-semibold text-center">
          Last Local Sync: {lastCacheTime}
        </div>
      )}

      {/* Main Scanner Container with Viewfinder HUD and toggles */}
      <div className="w-full max-w-lg relative bg-black border-4 border-blue-500/30 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.2)] mb-6">
        
        {/* HTML5 QR Code target container */}
        {secureContextError ? (
          <div className="text-center p-8 bg-red-500/10 min-h-[320px] flex flex-col items-center justify-center">
            <i className="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
            <h3 className="text-xl font-bold text-red-400 mb-2">Camera Blocked by Browser</h3>
            <p className="text-white/60 text-sm max-w-sm">
              Camera access is denied. Ensure you are accessing via HTTPS or localhost for secure context permission.
            </p>
          </div>
        ) : !isCameraActive ? (
          <div className="text-center p-8 min-h-[320px] flex flex-col items-center justify-center">
            <i className="fas fa-camera text-4xl text-blue-400 mb-4 animate-pulse"></i>
            <h3 className="text-xl font-bold text-white mb-2">Camera Standby</h3>
            <p className="text-white/60 text-sm max-w-xs mb-6">
              Camera access is required to scan tickets. Click the button below to enable the scanner.
            </p>
            <button
              onClick={() => { triggerHaptic('light'); setIsCameraActive(true); }}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-bold transition-all text-white shadow-md cursor-pointer text-xs flex items-center gap-2"
            >
              <i className="fas fa-video"></i> Start Camera Scanner
            </button>
          </div>
        ) : cameraError ? (
          <div className="text-center p-8 bg-red-500/10 min-h-[320px] flex flex-col items-center justify-center">
            <i className="fas fa-video-slash text-4xl text-red-500 mb-4"></i>
            <h3 className="text-xl font-bold text-red-400 mb-2">Camera Access Error</h3>
            <p className="text-white/60 text-sm max-w-xs mb-4">{cameraError}</p>
            <button
              onClick={() => { triggerHaptic('light'); setCameraError(null); setIsCameraActive(false); }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            <div id="reader" className="w-full bg-black min-h-[320px]"></div>

            {/* Viewfinder Target & Glowing Corners Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              
              {/* Central Bounding Box target */}
              <div className="w-64 h-64 border border-blue-400/20 rounded-2xl relative shadow-[0_0_0_999px_rgba(9,9,11,0.5)]">
                
                {/* Neon Corner Accents */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg"></div>

                {/* Pulsating Scanning Laser Line */}
                <div className="absolute left-[5%] right-[5%] h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_rgba(34,211,238,0.8)] scanner-laser"></div>
              </div>
            </div>

            {/* Floating Control buttons overlays */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 px-6 pointer-events-auto">
              
              {/* Flashlight/Torch toggle button */}
              {torchSupported && (
                <button
                  onClick={handleToggleTorch}
                  className={`w-12 h-12 rounded-full border flex items-center justify-center text-lg backdrop-blur-xl transition-all shadow-md cursor-pointer ${
                    isTorchOn 
                      ? 'bg-yellow-500 border-yellow-400 text-black shadow-yellow-500/20' 
                      : 'bg-black/60 border-white/20 text-white/70 hover:text-white'
                  }`}
                  title="Toggle Camera Flashlight"
                >
                  <i className={`fas ${isTorchOn ? 'fa-lightbulb' : 'fa-flash'}`}></i>
                </button>
              )}

              {/* Cycle camera source button */}
              {cameras.length > 1 && (
                <div className="relative group">
                  <button
                    className="w-12 h-12 rounded-full bg-black/60 border border-white/20 text-white/70 hover:text-white flex items-center justify-center text-lg backdrop-blur-xl transition-all shadow-md cursor-pointer"
                    title="Switch Camera Lens"
                  >
                    <i className="fas fa-camera-rotate"></i>
                  </button>
                  <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-[#18181b] border border-white/10 rounded-xl p-2 hidden group-hover:flex flex-col gap-1 w-48 shadow-2xl">
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block mb-1 text-center font-bold">Select Camera</span>
                    {cameras.map(device => (
                      <button
                        key={device.id}
                        onClick={() => handleSwitchCamera(device.id)}
                        className={`text-left px-2.5 py-1.5 rounded-lg text-xs truncate transition-all cursor-pointer ${
                          device.id === activeCameraId 
                            ? 'bg-blue-500 text-white font-bold' 
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {device.label || `Camera ${cameras.indexOf(device) + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Manual lookup input panel */}
      <div className="w-full max-w-lg bg-[#18181b]/50 border border-white/10 rounded-2xl p-4 shadow-lg mb-6 z-10">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">Can't Scan? Manual Cache Search</label>
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs"></i>
          <input 
            type="text" 
            placeholder="Type student name, email or roll number..." 
            value={manualSearchQuery}
            onChange={(e) => setManualSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
          />
          {manualSearchQuery && (
            <button 
              onClick={() => setManualSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs cursor-pointer"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>

        {/* Inline Manual Search Results */}
        {manualSearchResults.length > 0 && (
          <div className="mt-3 divide-y divide-white/5 border-t border-white/5 pt-2 animate-in fade-in duration-200">
            {manualSearchResults.map(reg => (
              <div key={reg.id} className="py-2.5 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{reg.form_data?.fullName || 'N/A'}</div>
                  <div className="text-[10px] text-white/50 truncate flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono">{reg.form_data?.regNum || reg.lead_email}</span>
                    {reg.team_data?.teamName && (
                      <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 text-[8px] font-bold rounded">
                        Team: {reg.team_data.teamName}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setManualSearchQuery('');
                    handleVerificationByHash(reg.hash_payload);
                  }}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 rounded-lg text-[10px] font-bold text-white transition-all cursor-pointer"
                >
                  Verify
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Real-time Scan Feed History (Last 5 scans) */}
      {scanHistory.length > 0 && (
        <div className="w-full max-w-lg bg-[#18181b]/30 border border-white/5 rounded-2xl p-5 shadow-lg animate-in fade-in duration-300">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3 flex items-center gap-1.5">
            <i className="fas fa-history text-xs text-blue-400"></i> Scan Activity History
          </h4>
          <div className="flex flex-col gap-2">
            {scanHistory.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-4 p-2 bg-black/10 rounded-xl border border-white/[0.02]">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white/90 truncate">{log.name}</p>
                  <p className="text-[10px] text-white/40 truncate">{log.type} • {log.time}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                    log.synced 
                      ? 'bg-green-500/10 text-green-500 border border-green-500/10' 
                      : 'bg-orange-500/10 text-orange-400 border border-orange-400/10'
                  }`}>
                    {log.synced ? 'Synced' : 'Queued'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Slide-up Details Modal / Overlay */}
      {showModal && (
        <div className="fixed inset-0 bg-[#09090b]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#18181b] border border-white/10 rounded-[28px] max-w-lg w-full overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] relative max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-8 duration-300">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-white/40">Verify Ticket</span>
              <button 
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              
              {/* Loader during remote search */}
              {searchingRemote ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-10 h-10 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin"></div>
                  <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Querying Central Hub...</p>
                </div>
              ) : errorMessage ? (
                /* Ticket Error State */
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-4 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                    <i className="fas fa-exclamation-triangle text-2xl"></i>
                  </div>
                  <h4 className="text-lg font-bold text-red-400 mb-1">Check-in Invalid</h4>
                  <p className="text-white/60 text-sm max-w-xs">{errorMessage}</p>
                </div>
              ) : selectedReg ? (
                /* Normal Ticket Detail State */
                <div className="flex flex-col gap-6">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                    (isTeam ? (selectedReg.checked_in && selectedReg.team_data.members.every((m: any) => m.checked_in)) : selectedReg.checked_in)
                      ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                      : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  }`}>
                    <i className={`fas ${(isTeam ? (selectedReg.checked_in && selectedReg.team_data.members.every((m: any) => m.checked_in)) : selectedReg.checked_in) ? 'fa-check-double text-lg' : 'fa-ticket-alt'}`}></i>
                    <div className="text-xs font-bold uppercase tracking-wider">
                      {(isTeam ? (selectedReg.checked_in && selectedReg.team_data.members.every((m: any) => m.checked_in)) : selectedReg.checked_in) 
                        ? 'Fully Checked In' 
                        : isTeam ? 'Team Ticket (Pending)' : 'Ticket Registered'}
                    </div>
                  </div>

                  {/* Primary Registrant Info */}
                  <div className="bg-black/20 rounded-2xl p-5 border border-white/5">
                    <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-white/40">Primary Registrant</span>
                      {isTeam && selectedReg.team_data.leadIndex === 0 && (
                        <span className="text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">Team Lead</span>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-white/30 block mb-0.5">Name</span>
                        <span className="text-sm font-bold text-white">{selectedReg.form_data?.fullName || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-white/30 block mb-0.5">Email</span>
                        <span className="text-xs font-bold text-white/80 font-mono">{selectedReg.lead_email}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-1">
                        {selectedReg.form_data?.regNum && (
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-white/30 block mb-0.5">Roll No.</span>
                            <span className="text-xs font-bold text-blue-400 font-mono">{selectedReg.form_data.regNum}</span>
                          </div>
                        )}
                        {selectedReg.form_data?.branch && (
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-white/30 block mb-0.5">Branch</span>
                            <span className="text-xs font-bold text-white/80">{selectedReg.form_data.branch}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white/40 uppercase">Gate Entry</span>
                      {selectedReg.checked_in ? (
                        <span className="px-3 py-1 bg-green-500/10 border border-green-500/30 text-green-500 rounded-lg text-xs font-bold flex items-center gap-1.5">
                          <i className="fas fa-check-circle"></i> Checked In
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCheckinAction('PRIMARY')}
                          className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 rounded-xl text-white font-bold text-xs transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] cursor-pointer"
                        >
                          Check In Primary
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Team Members List */}
                  {isTeam && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 px-1 text-white/40">
                        <i className="fas fa-users text-xs"></i>
                        <span className="text-[10px] uppercase font-bold tracking-wider">
                          Team: {selectedReg.team_data.teamName || 'Roster'} ({selectedReg.team_data.members.length + 1})
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                        {selectedReg.team_data.members.map((member: any, index: number) => {
                          const isLead = selectedReg.team_data.leadIndex === (index + 1)
                          return (
                            <div key={index} className="bg-black/10 rounded-xl p-4 border border-white/5 flex flex-col gap-2">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] text-white/40 font-bold uppercase">Member {index + 2}</span>
                                {isLead && (
                                  <span className="text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">Team Lead</span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-[8px] text-white/30 uppercase tracking-widest block">Name</span>
                                  <span className="font-bold text-white">{member.fullName || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-[8px] text-white/30 uppercase tracking-widest block">Roll No.</span>
                                  <span className="font-semibold text-blue-400 font-mono">{member.regNum || 'N/A'}</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-1">
                                <span className="text-[10px] text-white/40 font-bold uppercase">Status</span>
                                {member.checked_in ? (
                                  <span className="px-2.5 py-0.5 bg-green-500/10 border border-green-500/30 text-green-500 rounded-md text-[10px] font-bold flex items-center gap-1">
                                    <i className="fas fa-check-circle"></i> Checked In
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleCheckinAction('MEMBER', index)}
                                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-bold text-[10px] transition-colors cursor-pointer"
                                  >
                                    Check In Member
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                </div>
              ) : null}

            </div>

            {/* Modal Action Bar */}
            <div className="p-6 bg-black/20 border-t border-white/5">
              <button
                onClick={handleCloseModal}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-2xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="fas fa-video"></i> Resume Scanning Roster
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  )
}
