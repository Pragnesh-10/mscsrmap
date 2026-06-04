import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 w-full bg-[#0a0a0b]/80 backdrop-blur-md z-50 py-3 border-b border-white/10">
      <div className="max-w-[1000px] mx-auto px-6 flex justify-center items-center">
        <ul className="flex list-none gap-6 items-center">
          <li>
            <Link href="/" className="text-white/60 hover:text-white hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all text-[0.9rem] font-medium">Home</Link>
          </li>
          <li>
            <Link href="/events" className="text-white/60 hover:text-white hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all text-[0.9rem] font-medium">Events</Link>
          </li>
          <li>
            <Link href="/team" className="text-white/60 hover:text-white hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all text-[0.9rem] font-medium">Team</Link>
          </li>
          <li>
            <Link href="/login" className="text-[#0078d4] font-bold transition-all text-[0.9rem] hover:opacity-80">
              Login <i className="fas fa-sign-in-alt ml-1"></i>
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  )
}
