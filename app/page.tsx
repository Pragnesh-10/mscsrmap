import Navbar from "./components/Navbar"
import BackgroundVideo from "./components/BackgroundVideo"

export default function Home() {
  return (
    <>
      <Navbar />

      {/* Background Video */}
      <BackgroundVideo
        src="https://lkbwunzswqbnoygxtilm.supabase.co/storage/v1/object/public/webpage/Microsoft_Student_Community_Title_Card.mp4"
        className="fixed inset-0 w-full h-full object-cover -z-20 opacity-40 grayscale blur-sm brightness-50"
      />
      <div className="fixed inset-0 bg-[#0a0a0b]/80 -z-10"></div>

      {/* Hero Section */}
      <main className="relative min-h-screen flex items-center justify-center pt-16">
        <div className="max-w-[1400px] w-full mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
          
          <div className="text-left">
            <p className="text-xs font-medium tracking-[5px] text-white/45 uppercase mb-5">SRM UNIVERSITY AP</p>
            <h1 className="text-5xl md:text-7xl font-bold mb-3 tracking-tighter leading-[1.1] text-white">Microsoft Student Community</h1>
            <div className="w-[60px] h-1 bg-white my-6 rounded-sm"></div>
            <p className="text-lg font-normal text-white/55 mt-3 leading-relaxed">Empowering students through technology & innovation</p>
            <p className="mt-6 text-[0.95rem] leading-[1.7] text-white/40 max-w-[480px]">
              The Microsoft Student Community is a dynamic student-led organization dedicated to fostering innovation, technical skills, and collaborative learning. Join us to explore, build, and lead through hands-on workshops, hackathons, and expert sessions.
            </p>
          </div>

          <div className="relative w-full aspect-[16/10] rounded-lg overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
            <img 
              src="https://lkbwunzswqbnoygxtilm.supabase.co/storage/v1/object/public/webpage/hackmsc1.jpg" 
              alt="MSC Event" 
              className="w-full h-full object-cover" 
            />
          </div>

        </div>
      </main>

      {/* About Section */}
      <section className="py-24 max-w-[1000px] mx-auto px-6">
        <h2 className="text-3xl font-semibold text-center mb-12 text-white">About Our Community</h2>
        
        <div className="grid md:grid-cols-3 gap-16 items-center">
          <div className="md:col-span-2 space-y-5">
            <p className="text-[0.95rem] text-white/60 leading-relaxed">
              <strong className="text-white font-semibold">Microsoft Student Community SRMAP - Be a Force for Good!</strong>
            </p>
            <p className="text-[0.95rem] text-white/60 leading-relaxed">
              The Microsoft Student Community, Amaravati at SRM University AP is a vibrant, collaborative student-led organization that brings together tech enthusiasts eager to explore, learn, and innovate with Microsoft tools and technologies. Our mission is to empower students with practical, hands-on experience in areas like Azure, AI, and cloud computing...
            </p>

            <div className="flex gap-12 mt-10">
              <div>
                <h3 className="text-4xl font-bold text-white leading-none">50+</h3>
                <p className="text-white/40 font-normal text-xs uppercase tracking-widest mt-2">Active Members</p>
              </div>
              <div>
                <h3 className="text-4xl font-bold text-white leading-none">1000+</h3>
                <p className="text-white/40 font-normal text-xs uppercase tracking-widest mt-2">Audience</p>
              </div>
              <div>
                <h3 className="text-4xl font-bold text-white leading-none">10+</h3>
                <p className="text-white/40 font-normal text-xs uppercase tracking-widest mt-2">Events Hosted</p>
              </div>
            </div>
          </div>
          
          <div className="md:col-span-1 flex items-center justify-center">
            <img 
              src="https://lkbwunzswqbnoygxtilm.supabase.co/storage/v1/object/public/webpage/MSC%20Logo.png" 
              alt="MSC Logo" 
              className="w-full h-auto object-contain" 
            />
          </div>
        </div>
      </section>
    </>
  )
}
