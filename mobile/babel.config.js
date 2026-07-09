module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Alias react-native-vector-icons -> @expo/vector-icons so React Native Paper
      // (which imports from 'react-native-vector-icons') uses Expo's bundled icon
      // sets without needing the native module / font linking step.
      [
        'module-resolver',
        {
          alias: {
            'react-native-vector-icons': '@expo/vector-icons',
          },
        },
      ],
    ],
  };
};
