import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Perform a lightweight query to ensure the Supabase database is active and connected
    const { data, error } = await supabase.from('events').select('id').limit(1)
    
    if (error) {
      throw error
    }
    
    return NextResponse.json({ 
      status: 'ok', 
      message: 'Supabase database pinged successfully.',
      timestamp: new Date().toISOString() 
    })
  } catch (error: any) {
    console.error('Keepalive health check failed:', error)
    return NextResponse.json({ 
      status: 'error', 
      message: error.message || 'Database query failed' 
    }, { 
      status: 500 
    })
  }
}
