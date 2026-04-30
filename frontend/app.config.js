const appJson = require('./app.json');

// Use environment variable or default to localhost/emulator
// For Android Emulator: http://10.0.2.2:8000/api/v1
// For Real Device/iOS: http://YOUR_COMPUTER_IP:8000/api/v1
// For Web: http://localhost:8000/api/v1

const getApiUrl = () => {
  // Prefer explicit API URL from environment
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (process.env.API_URL) {
    return process.env.API_URL;
  }

  // No static default here; runtime code in src/services/api.js resolves device/emulator host.
  return undefined;
};

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      apiUrl: getApiUrl(),
      // Supabase configuration for document storage
      supabaseUrl: process.env.SUPABASE_URL || 'https://izaioowtbzcghkerrpmk.supabase.co',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6YWlvb3d0YnpjZ2hrZXJycG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2ODc1MDUsImV4cCI6MjA4NjI2MzUwNX0.y2DeJBoqkSXc7_Jx3dcenPrFKBHv_iH3yT_8uFRb5Dw',
    },
  },
};
