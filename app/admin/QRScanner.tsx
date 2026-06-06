'use client'

import { useEffect, useState, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export default function QRScanner({ eventId }: { eventId?: string }) {
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [secureContextError, setSecureContextError] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isNavigating = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setSecureContextError(true)
      return
    }

    // Initialize the direct scanner
    const html5QrCode = new Html5Qrcode("reader")
    scannerRef.current = html5QrCode

    // Auto-start camera
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length > 0) {
        html5QrCode.start(
          { facingMode: "environment" }, // Prefer back camera
          { 
            fps: 20, 
            disableFlip: false,
            // Removing qrbox allows scanning the entire video frame, making detection MUCH easier
          },
          onScanSuccess,
          onScanFailure
        ).catch(err => {
          console.error("Error starting camera:", err)
          setCameraError("Could not start camera. Please ensure you have granted camera permissions.")
        });
      } else {
        setCameraError("No cameras detected on this device.")
      }
    }).catch(err => {
      console.error("Error getting cameras:", err)
      setCameraError("Failed to access camera. Please check your browser permissions.")
    })

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          html5QrCode.clear()
        }).catch(console.error)
      } else {
        try { html5QrCode.clear() } catch(e) {}
      }
    }
  }, [])

  function onScanSuccess(decodedText: string, decodedResult: any) {
    if (isNavigating.current) return;
    
    setScanResult(decodedText)
    
    // Extract hash whether it's a full URL or just a hash
    let hash = decodedText;
    if (decodedText.includes('/admin/checkin/')) {
      hash = decodedText.split('/admin/checkin/')[1];
    }
    
    // Navigate using relative path so it always uses the current domain
    if (hash && hash.length > 10) {
      isNavigating.current = true;
      if (scannerRef.current) {
        scannerRef.current.pause(true); // Pause scanning
      }
      
      const url = new URL(`/admin/checkin/${hash}`, window.location.origin);
      if (eventId) {
        url.searchParams.set('eventId', eventId);
      }
      window.location.href = url.pathname + url.search;
    }
  }

  function onScanFailure(error: any) {
    // Handle scan failure silently, it fires continuously until a QR code is found
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-8 border-b border-white/5 pb-6 w-full text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Live Check-in Scanner</h2>
        <p className="text-white/40 text-sm">Point your camera at a student's QR Ticket to instantly check them in!</p>
      </div>

      <div className="w-full max-w-lg bg-black/40 border-4 border-blue-500/30 rounded-3xl overflow-hidden p-2 shadow-[0_0_50px_rgba(59,130,246,0.15)] relative min-h-[300px] flex items-center justify-center">
        {secureContextError ? (
          <div className="text-center p-6 bg-red-500/10 rounded-2xl border border-red-500/30">
            <i className="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
            <h3 className="text-xl font-bold text-red-400 mb-2">Camera Blocked by Browser</h3>
            <p className="text-white/60 text-sm">
              Your browser is blocking camera access because you are not on a secure connection (HTTPS or Localhost). 
              If you are testing on your phone using a local IP address (e.g. 192.168.x.x), you must use <strong>ngrok</strong> or deploy to a secure domain!
            </p>
          </div>
        ) : cameraError ? (
          <div className="text-center p-6 bg-red-500/10 rounded-2xl border border-red-500/30">
            <i className="fas fa-video-slash text-4xl text-red-500 mb-4"></i>
            <h3 className="text-xl font-bold text-red-400 mb-2">Camera Error</h3>
            <p className="text-white/60 text-sm">{cameraError}</p>
          </div>
        ) : (
          <div id="reader" className="w-full bg-black rounded-2xl overflow-hidden min-h-[250px]"></div>
        )}
      </div>

      {scanResult && (
        <div className="mt-8 p-6 bg-green-500/10 border border-green-500/20 rounded-2xl text-center max-w-lg w-full">
          <i className="fas fa-check-circle text-4xl text-green-500 mb-4"></i>
          <h3 className="text-xl font-bold text-green-400 mb-2">QR Code Detected!</h3>
          <p className="text-green-400/60 break-all text-sm">{scanResult}</p>
          {!scanResult.includes('/admin/checkin/') && (
            <p className="text-red-400 text-sm font-bold mt-4">Invalid Ticket Format!</p>
          )}
        </div>
      )}
      
    </div>
  )
}
