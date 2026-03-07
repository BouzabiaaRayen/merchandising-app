const appJson = require('./app.json');

// Use environment variable or default to localhost/emulator
// For Android Emulator: http://10.0.2.2:8000/api/v1
// For Real Device/iOS: http://YOUR_COMPUTER_IP:8000/api/v1
// For Web: http://localhost:8000/api/v1

const getApiUrl = () => {
  // Check if environment variable is set
  if (process.env.API_URL) {
    return process.env.API_URL;
  }
  
  // Default to Android emulator
  // Change this to 'http://192.168.0.60:8000/api/v1' if testing on real device
  return 'http://192.168.0.60:8000/api/v1';
};

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      apiUrl: getApiUrl(),
      // Supabase configuration for document storage
      supabaseUrl: process.env.SUPABASE_URL || 'https://izaioowthzcghkerrpmk.supabase.co',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6YWlvb3d0YnpjZ2hrZXJycG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2ODc1MDUsImV4cCI6MjA4NjI2MzUwNX0.y2DeJBoqkSXc7_Jx3dcenPrFKBHv_iH3yT_8uFRb5Dw',
    },
  },
};
