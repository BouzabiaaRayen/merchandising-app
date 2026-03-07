import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Get Supabase credentials from environment or use defaults
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl ?? 'https://izaioowthzcghkerrpmk.supabase.co';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6YWlvb3d0YnpjZ2hrZXJycG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2ODc1MDUsImV4cCI6MjA4NjI2MzUwNX0.y2DeJBoqkSXc7_Jx3dcenPrFKBHv_iH3yT_8uFRb5Dw';

console.log('🔐 Supabase Client Initialized');
console.log('🌐 URL:', supabaseUrl);
console.log('🔑 Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 30)}...` : 'NOT SET');

// Create Supabase client with custom options
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
  global: {
    headers: {
      'apikey': supabaseAnonKey,
    },
  },
});

// Test connection
const testConnection = async () => {
  try {
    console.log('🧪 Testing Supabase connection...');
    console.log('🔗 Testing URL:', supabaseUrl);
    
    // First test basic fetch connectivity
    try {
      console.log('📡 Testing basic fetch to Supabase...');
      const testFetch = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      });
      console.log('📡 Fetch test status:', testFetch.status);
    } catch (fetchErr) {
      console.error('❌ Basic fetch failed:', fetchErr.message);
    }
    
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error('❌ Connection test failed!');
      console.error('Error message:', error.message);
      console.error('Error name:', error.name);
      console.error('Full error:', JSON.stringify(error, null, 2));
    } else {
      console.log('✅ Connected to Supabase! Buckets:', data?.map(b => b.name).join(', '));
    }
  } catch (err) {
    console.error('❌ Connection error caught:');
    console.error('Message:', err.message);
    console.error('Name:', err.name);
    console.error('Stack:', err.stack);
  }
};

// Run test after a short delay
setTimeout(testConnection, 1000);

// Storage bucket name for reports
export const REPORTS_BUCKET = 'merchandiser-reports';
