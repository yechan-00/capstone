/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

const projectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID || appJson.expo?.extra?.eas?.projectId;

module.exports = {
  ...appJson.expo,
  extra: {
    ...(appJson.expo.extra ?? {}),
    eas: {
      ...(appJson.expo.extra?.eas ?? {}),
      ...(projectId ? { projectId } : {}),
    },
  },
};
