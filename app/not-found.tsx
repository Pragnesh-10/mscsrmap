import Link from 'next/link'
import Navbar from './components/Navbar'

export default function NotFound() {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center relative overflow-hidden px-6">
        
        {/* Background glow elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 blur-[150px] rounded-full pointer-events-none -z-10"></div>
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-purple-500/10 blur-[100px] rounded-full pointer-events-none -z-10"></div>

        <div className="relative z-10 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          {/* Glitchy 404 Text */}
          <div className="relative inline-block">
            <h1 className="text-[120px] md:text-[180px] font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/20 leading-none drop-shadow-[0_0_40px_rgba(255,255,255,0.1)]">
              404
            </h1>
            <h1 className="absolute top-0 left-[4px] text-[120px] md:text-[180px] font-black text-blue-500/50 leading-none mix-blend-screen opacity-70 animate-pulse">
              404
            </h1>
            <h1 className="absolute top-0 -left-[4px] text-[120px] md:text-[180px] font-black text-purple-500/50 leading-none mix-blend-screen opacity-70 animate-pulse delay-75">
              404
            </h1>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-white mt-4 tracking-wider uppercase">
            Page Not Found
          </h2>
          
          <p className="text-[#a1a1aa] mt-4 max-w-md text-sm md:text-base leading-relaxed">
            The page you're looking for has vanished into the digital void, or maybe it never existed in the first place.
          </p>

          <Link 
            href="/" 
            className="mt-10 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-2xl font-bold text-white shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_40px_rgba(59,130,246,0.5)] transition-all transform hover:-translate-y-1 flex items-center gap-3"
          >
            <i className="fas fa-home"></i> Return Home
          </Link>

          <div className="mt-12 flex items-center gap-6 text-sm font-semibold text-white/30">
            <Link href="/events" className="hover:text-white/80 transition-colors">Browse Events</Link>
            <span>•</span>
            <Link href="/login" className="hover:text-white/80 transition-colors">Core Member Login</Link>
          </div>
        </div>
      </div>
    </>
  )
}
