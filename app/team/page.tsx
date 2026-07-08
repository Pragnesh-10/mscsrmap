import { createClient } from '@/utils/supabase/server'
import Navbar from '../components/Navbar'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const supabase = await createClient()

  // Fetch team from Supabase
  const { data: team, error } = await supabase
    .from('team_members')
    .select('*')
    .order('created_at', { ascending: true })

  return (
    <>
      <Navbar />

      {/* Background */}
      <div className="fixed inset-0 bg-[#0a0a0b] -z-20"></div>
      <div className="fixed top-[20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-500/10 blur-[150px] -z-10 pointer-events-none"></div>

      <main className="max-w-[1200px] mx-auto px-6 pt-32 pb-24 min-h-screen">
        <h2 className="text-4xl md:text-5xl font-bold mb-16 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Our Team Members</h2>

        {(!team || team.length === 0) ? (
          <div className="text-center py-20 text-white/40">
            <p>No team members found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {team.map(member => (
              <div key={member.id} className="bg-[#18181b]/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 hover:bg-[#18181b]/80 transition-all duration-300 group shadow-xl text-center pb-6">
                <div className="w-full aspect-square bg-black/40 overflow-hidden">
                  {member.image_url ? (
                    <img src={member.image_url} alt={member.name} className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#111] text-white/20">
                      <i className="fas fa-user text-5xl"></i>
                    </div>
                  )}
                </div>
                
                <div className="pt-6 px-4">
                  <h4 className="text-lg font-bold text-white mb-1">{member.name}</h4>
                  <p className="text-sm font-medium text-blue-400 mb-4">{member.role}</p>
                  
                  <div className="flex justify-center gap-4 text-white/40">
                    {member.linkedin_url && (
                      <a href={member.linkedin_url} target="_blank" rel="noopener noreferrer" className="hover:text-[#0077b5] transition-colors">
                        <i className="fab fa-linkedin text-lg"></i>
                      </a>
                    )}
                    {member.github_url && (
                      <a href={member.github_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                        <i className="fab fa-github text-lg"></i>
                      </a>
                    )}
                    {member.twitter_url && (
                      <a href={member.twitter_url} target="_blank" rel="noopener noreferrer" className="hover:text-[#1DA1F2] transition-colors">
                        <i className="fab fa-twitter text-lg"></i>
                      </a>
                    )}
                    {member.instagram_url && (
                      <a href={member.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:text-[#E1306C] transition-colors">
                        <i className="fab fa-instagram text-lg"></i>
                      </a>
                    )}
                    {member.email && (
                      <a href={`mailto:${member.email}`} className="hover:text-white transition-colors">
                        <i className="fas fa-envelope text-lg"></i>
                      </a>
                    )}
                    {member.portfolio_url && (
                      <a href={member.portfolio_url} target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors">
                        <i className="fas fa-globe text-lg"></i>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
