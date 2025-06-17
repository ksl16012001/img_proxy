const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');
const FormData = require('form-data');
const config = require('../configs/storage');

// Constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to validate file input
const validateFileInput = (fileBuffer, fileName) => {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error('Invalid file buffer: must be a Buffer');
  }
  if (!fileName || typeof fileName !== 'string') {
    throw new Error('Invalid file name: must be a string');
  }
};

// Helper function to get content type from file name
const getContentType = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  const contentTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp'
  };
  return contentTypes[ext] || 'application/octet-stream';
};

// iDrive storage service implementation
const idriveService = {
  upload: async (fileBuffer, fileName, options = {}) => {
    try {
      // Validate inputs
      validateFileInput(fileBuffer, fileName);

      const contentType = options.contentType || getContentType(fileName);
      const retries = options.retries || MAX_RETRIES;
      const retryDelay = options.retryDelay || RETRY_DELAY;

      const formData = new FormData();
      formData.append('file', fileBuffer, {
        filename: fileName,
        contentType
      });

      let lastError;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const response = await axios.post(
            `${config.idrive.endpoint}/upload`,
            formData,
            {
              headers: {
                ...formData.getHeaders(),
                'X-API-Key': config.idrive.apiKey,
                'X-API-Secret': config.idrive.apiSecret
              },
              timeout: 30000 // 30 second timeout
            }
          );

          if (!response.data || !response.data.url) {
            throw new Error('Invalid response from iDrive API');
          }

          return response.data.url;
        } catch (error) {
          lastError = error;
          console.error(`Upload attempt ${attempt} failed:`, error.message);

          if (attempt < retries) {
            await delay(retryDelay * attempt); // Exponential backoff
            continue;
          }
        }
      }

      throw new Error(`Failed to upload after ${retries} attempts: ${lastError.message}`);
    } catch (error) {
      console.error('iDrive upload error:', error);
      throw error;
    }
  }
};

// Cloudflare R2 storage service implementation
const r2Service = {
  download: async (key) => {
    try {
      if (!key || typeof key !== 'string') {
        throw new Error('Invalid key: must be a string');
      }

      const s3Client = new S3Client({
        region: 'auto',
        endpoint: config.r2.endpoint,
        credentials: {
          accessKeyId: config.r2.accessKeyId,
          secretAccessKey: config.r2.secretAccessKey
        }
      });

      const command = new GetObjectCommand({
        Bucket: config.r2.bucket,
        Key: key
      });

      let lastError;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await s3Client.send(command);
          const chunks = [];

          // Convert the readable stream to buffer
          for await (const chunk of response.Body) {
            chunks.push(chunk);
          }

          return Buffer.concat(chunks);
        } catch (error) {
          lastError = error;
          console.error(`R2 download attempt ${attempt} failed:`, error.message);

          if (attempt < MAX_RETRIES) {
            await delay(RETRY_DELAY * attempt); // Exponential backoff
            continue;
          }
        }
      }

      throw new Error(`Failed to download from R2 after ${MAX_RETRIES} attempts: ${lastError.message}`);
    } catch (error) {
      console.error('R2 download error:', error);
      throw error;
    }
  },
  upload: async (fileBuffer, fileName, options = {}) => {
    try {
      // Validate inputs
      validateFileInput(fileBuffer, fileName);

      const contentType = options.contentType || getContentType(fileName);
      const retries = options.retries || MAX_RETRIES;
      const retryDelay = options.retryDelay || RETRY_DELAY;

      const s3Client = new S3Client({
        region: 'auto',
        endpoint: config.r2.endpoint,
        credentials: {
          accessKeyId: config.r2.accessKeyId,
          secretAccessKey: config.r2.secretAccessKey
        }
      });

      const command = new PutObjectCommand({
        Bucket: config.r2.bucket,
        Key: fileName,
        Body: fileBuffer,
        ContentType: contentType
      });

      let lastError;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await s3Client.send(command);
          return `${config.r2.endpoint}/${config.r2.bucket}/${fileName}`;
        } catch (error) {
          lastError = error;
          console.error(`R2 upload attempt ${attempt} failed:`, error.message);

          if (attempt < retries) {
            await delay(retryDelay * attempt); // Exponential backoff
            continue;
          }
        }
      }

      throw new Error(`Failed to upload to R2 after ${retries} attempts: ${lastError.message}`);
    } catch (error) {
      console.error('R2 upload error:', error);
      throw error;
    }
  }
};

module.exports = {
  idrive: idriveService,
  r2: r2Service
};