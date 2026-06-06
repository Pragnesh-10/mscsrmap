import { QRCodeSVG } from 'qrcode.react'

export default function IDCardModal({
  isOpen,
  onClose,
  registrations,
  eventTitle
}: {
  isOpen: boolean
  onClose: () => void
  registrations: any[]
  eventTitle: string
}) {
  if (!isOpen) return null

  const handlePrint = () => {
    window.print()
  }

  // Generate the check-in URL for a registration hash
  const getQrUrl = (hash: string) => {
    return typeof window !== 'undefined' ? `${window.location.origin}/admin/checkin/${hash}` : ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm print:bg-white print:backdrop-blur-none">
      
      {/* Non-Printable Modal Controls */}
      <div className="absolute top-0 w-full p-4 flex justify-between items-center bg-black/50 border-b border-white/10 print:hidden">
        <h2 className="text-xl font-bold text-white">ID Card Preview ({registrations.length})</h2>
        <div className="flex gap-4">
          <button 
            onClick={handlePrint}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            <i className="fas fa-print"></i> Print Badges
          </button>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Printable Area */}
      <div className="w-full h-full pt-20 pb-10 overflow-y-auto print:p-0 print:overflow-visible">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-center gap-6 print:gap-4 print:justify-start">
          
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              @page { size: A4; margin: 10mm; }
              body * { visibility: hidden; }
              #printable-badges, #printable-badges * { visibility: visible; }
              #printable-badges { position: absolute; left: 0; top: 0; width: 100%; display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
              .id-badge { page-break-inside: avoid; border: 1px solid #e5e7eb !important; background-color: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          `}} />

          <div id="printable-badges" className="flex flex-wrap justify-center gap-6 print:gap-4">
            {registrations.map((reg) => (
              <div 
                key={reg.id} 
                className="id-badge w-[2.125in] h-[3.375in] bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col items-center justify-between p-4 shadow-xl print:shadow-none relative"
                style={{ width: '220px', height: '350px' }}
              >
                {/* Header Banner */}
                <div className="absolute top-0 w-full h-12 bg-blue-600 flex items-center justify-center">
                  <span className="text-[10px] font-black text-white tracking-widest uppercase truncate px-2 text-center w-full">
                    {eventTitle}
                  </span>
                </div>

                {/* Badge Content */}
                <div className="mt-14 w-full flex flex-col items-center flex-grow">
                  {/* Participant Name */}
                  <h3 className="text-lg font-black text-gray-900 text-center leading-tight mb-1 break-words w-full">
                    {reg.form_data?.fullName || reg.team_data?.teamName || 'Participant'}
                  </h3>
                  
                  {/* College/Org */}
                  <p className="text-[10px] font-bold text-gray-500 text-center uppercase tracking-wider mb-4 w-full truncate">
                    {reg.form_data?.collegeName || 'SRMAP'}
                  </p>

                  {/* QR Code */}
                  <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm mb-4">
                    <QRCodeSVG value={getQrUrl(reg.hash_payload)} size={110} level="M" />
                  </div>

                  {/* Role / Team Label */}
                  <div className="mt-auto w-full flex flex-col items-center">
                    {reg.team_data?.teamName && (
                      <span className="text-[9px] text-gray-400 font-semibold mb-1">TEAM: {reg.team_data.teamName}</span>
                    )}
                    <div className="w-full py-1 bg-gray-100 border border-gray-200 rounded text-center">
                      <span className="text-[10px] font-black text-gray-700 tracking-widest uppercase">
                        {reg.lead_email ? 'LEAD' : 'PARTICIPANT'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
