/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: '후회가계부',
  slug: 'regret-wallet',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/app-logo.png',
  userInterfaceStyle: 'light',
  assetBundlePatterns: ['assets/**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.regretwallet.app',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/app-logo.png',
      backgroundColor: '#C9847A',
    },
    package: 'com.regretwallet.app',
  },
  web: {
    favicon: './assets/images/app-logo.png',
  },
  plugins: [
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#34785F',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/app-logo.png',
        resizeMode: 'contain',
        backgroundColor: '#FAFCF7',
      },
    ],
    'expo-font',
    'expo-image',
    'expo-status-bar',
    'expo-router',
    '@react-native-community/datetimepicker',
  ],
  scheme: 'regretwallet',
  extra: {
    eas: {
      projectId:
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '4c642024-ca08-4e3a-bb41-9977ca0fd408',
    },
  },
};

module.exports = config;
