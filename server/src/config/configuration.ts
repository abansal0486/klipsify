export default () => ({
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
  },
  gcs: {
    bucketName: process.env.GCS_BUCKET_NAME,
  },
  mongo: {
    uri: process.env.MONGO_URI,
  },
});
