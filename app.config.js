const appJson = require('./app.json');

// Load .env so API_BASE_URL is available (e.g. for Android emulator: http://10.0.2.2:8000/api)
require('dotenv').config();

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      apiUrl: process.env.API_BASE_URL || 'http://localhost:8000/api',
    },
  },
};
