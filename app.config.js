const appJson = require('./app.json');

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      apiUrl: 'http://10.0.2.2:8000/api/v1',
    },
  },
};
