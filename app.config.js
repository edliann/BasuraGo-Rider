const googleMapsAndroidApiKey =
  process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

module.exports = ({ config }) => {
  const app = config;

  return {
    ...app,
    plugins: [
      ...app.plugins,
      [
        'react-native-maps',
        {
          androidGoogleMapsApiKey: googleMapsAndroidApiKey,
        },
      ],
    ],
    extra: {
      ...app.extra,
      googleMapsAndroidApiKeyConfigured: Boolean(googleMapsAndroidApiKey),
    },
  };
};
