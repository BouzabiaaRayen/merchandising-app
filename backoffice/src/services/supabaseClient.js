import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables or use defaults
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://izaioowthzcghkerrpmk.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6YWlvb3d0YnpjZ2hrZXJycG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2ODc1MDUsImV4cCI6MjA4NjI2MzUwNX0.y2DeJBoqkSXc7_Jx3dcenPrFKBHv_iH3yT_8uFRb5Dw';

console.log('🔧 Supabase Config:', {
  url: supabaseUrl,
  keyPrefix: supabaseAnonKey?.substring(0, 20) + '...',
  envUrl: import.meta.env.VITE_SUPABASE_URL,
  envKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Not set'
});

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We handle auth separately
  },
});

// Storage bucket name for reports
export const REPORTS_BUCKET = 'merchandiser-reports';
