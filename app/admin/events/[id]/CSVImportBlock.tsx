'use client'

import React, { useState, useRef } from 'react'
import Papa from 'papaparse'
import { importExternalRegistrations } from './actions'

export default function CSVImportBlock({ eventId }: { eventId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ successCount: number, skipCount: number, errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
      setResult(null)
      setProgress(0)
    }
  }

  const handleProcess = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(10); // Start parsing

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        setProgress(30); // Parsed

        if (results.data && results.data.length > 0) {
          try {
            // We process all at once for simplicity, but could chunk if the file is massive
            const res = await importExternalRegistrations(eventId, results.data)
            setProgress(100);
            
            if (res.error) {
              setResult({ successCount: 0, skipCount: 0, errors: [res.error] });
            } else {
              setResult({
                successCount: res.successCount || 0,
                skipCount: res.skipCount || 0,
                errors: res.errors || []
              });
            }
          } catch (err: any) {
            setResult({ successCount: 0, skipCount: 0, errors: [err.message] });
            setProgress(0);
          }
        } else {
          setResult({ successCount: 0, skipCount: 0, errors: ["No valid data found in CSV"] });
          setProgress(0);
        }
        
        setIsProcessing(false);
      },
      error: (error) => {
        setResult({ successCount: 0, skipCount: 0, errors: [error.message] });
        setIsProcessing(false);
        setProgress(0);
      }
    });
  }

  return (
    <div className="bg-black/20 border border-white/10 rounded-2xl p-6 md:p-8 mb-8 backdrop-blur-md">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center text-green-400">
          <i className="fas fa-file-csv text-xl"></i>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">External Registration Sync</h2>
          <p className="text-white/40 text-sm mt-1">Import registrations from Unstop or Google Forms via CSV</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <input 
          type="file" 
          accept=".csv"
          onChange={handleFileChange}
          ref={fileInputRef}
          className="block w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-green-500/10 file:text-green-400 hover:file:bg-green-500/20 transition-all cursor-pointer bg-black/40 border border-white/5 rounded-xl p-2"
        />
        <button 
          onClick={handleProcess}
          disabled={!file || isProcessing}
          className="w-full md:w-auto shrink-0 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 rounded-xl text-white font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <><i className="fas fa-circle-notch fa-spin mr-2"></i> Processing...</>
          ) : (
            <><i className="fas fa-sync mr-2"></i> Process and Sync Data</>
          )}
        </button>
      </div>

      {isProcessing && (
        <div className="w-full bg-white/5 rounded-full h-2 mt-6 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500 ease-out" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}

      {result && (
        <div className={`mt-6 p-4 rounded-xl border ${result.errors.length > 0 && result.successCount === 0 ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
          <h3 className="font-bold mb-2 flex items-center gap-2">
            <i className={`fas fa-${result.errors.length > 0 && result.successCount === 0 ? 'exclamation-circle' : 'check-circle'}`}></i>
            Sync Completed
          </h3>
          <div className="flex gap-6 text-sm mb-2">
            <span><strong className="text-white">{result.successCount}</strong> Imported</span>
            <span><strong className="text-white">{result.skipCount}</strong> Skipped / Existed</span>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-current/20">
              <p className="text-xs font-bold mb-1 opacity-80">Issues Encountered:</p>
              <ul className="list-disc list-inside text-xs opacity-70 max-h-32 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
