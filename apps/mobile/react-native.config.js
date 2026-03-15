/**
 * React Native CLI Configuration
 * הגדרות CLI של React Native
 */
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./src/assets/fonts'],
  dependencies: {
    '@react-native-community/datetimepicker': {
      platforms: {
        android: null, // Disable broken autolinking — manually registered in MainApplication
      },
    },
  },
};
