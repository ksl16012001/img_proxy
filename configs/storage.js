require('dotenv').config();

module.exports = {
  idrive: {
    apiKey: process.env.IDRIVE_API_KEY,
    apiSecret: process.env.IDRIVE_API_SECRET,
    bucket: process.env.IDRIVE_BUCKET,
    region: process.env.IDRIVE_REGION || 'us-east-1',
    endpoint: process.env.IDRIVE_ENDPOINT
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  }
};