const SUPABASE_URL = 'https://bsdbntmjxeowpnlekrzi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ha3dmbml2cG9ka3ZwZXJiZmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NjY1NzEsImV4cCI6MjA5NjE0MjU3MX0.HBRbewp7wTLsaTa0JKQCWRqRHxHlcPG8_Pnunr4P1hg';

async function test() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/member_profiles?select=*`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    const text = await res.text();
    console.log("Profiles:", text);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}
test();
