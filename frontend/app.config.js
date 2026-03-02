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
    },
  },
};
