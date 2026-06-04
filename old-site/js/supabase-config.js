// js/supabase-config.js

window.SUPABASE_URL = 'https://bsdbntmjxeowpnlekrzi.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzZGJudG1qeGVvd3BubGVrcnppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NzQ1NDIsImV4cCI6MjA5NjA1MDU0Mn0.sHQaOK4ULnQqyCmHHCRTIVCyazcENKg2AfUDQmC2bB4';

// 1. Keep a reference to the original library factory so we can spawn new clients if needed
window.supabaseFactory = window.supabase;

// 2. Instantiate the main client and overwrite the global variable so all existing scripts work
window.supabase = window.supabaseFactory.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
