'use client'

import { useEffect, useRef } from 'react'

interface BackgroundVideoProps {
  src: string
  className?: string
  id?: string
}

export default function BackgroundVideo({ src, className, id }: BackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Programmatically play the video and safely catch any unhandled play() rejections
    // (such as AbortError when element is unmounted/removed from document during navigation)
    const playPromise = video.play()
    if (playPromise !== undefined) {
      playPromise.catch((err: Error) => {
        if (err.name === 'AbortError' || err.message?.includes('interrupted')) {
          // Expected when navigating away while media is loading or playing
          return
        }
        // Catch autoplay restriction policy or other non-critical errors
        console.debug('Video playback interrupted or restricted:', err)
      })
    }

    return () => {
      if (video) {
        try {
          video.pause()
        } catch (_) {}
      }
    }
  }, [src])

  return (
    <video
      ref={videoRef}
      id={id}
      className={className}
      muted
      loop
      playsInline
      preload="metadata"
    >
      <source src={src} type="video/mp4" />
    </video>
  )
}
