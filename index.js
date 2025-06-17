const express = require('express');
const sharp = require('sharp');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const storageServices = require('./helpers/storage');
const SharpMockupRender = require('./helpers/render');
const app = express();

// Color mapping
const colorMap = {
  white: '#FFFFFF',
  black: '#000000',
  red: '#FF0000',
  blue: '#0000FF',
  green: '#00FF00'
};

// Index
app.get('/', (req, res) => {
  res.send('Image Transformer API');
});

// Render route
app.get('/render', async (req, res) => {
  try {
    const { mockup_id, design_path, storage_id, color_name } = req.query;

    // Validate parameters
    if (!mockup_id || !design_path || !storage_id || !color_name) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Validate storage ID
    if (!storageServices[storage_id]) {
      return res.status(400).json({ error: 'Invalid storage ID' });
    }

    // Validate color
    if (!colorMap[color_name.toLowerCase()]) {
      return res.status(400).json({ error: 'Invalid color name' });
    }

    const hexColor = colorMap[color_name.toLowerCase()];
    const sharpMockupRender = new SharpMockupRender();
    const result = await sharpMockupRender.render(mockup_id, design_path, storage_id, hexColor);
    // response as image
    res.set('Content-Type', 'image/png');
    res.send(result);
  } catch (error) {
    console.error('Render error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sample mockup config file structure
const sampleMockupConfig = {
  mockup_file_path: 'path/to/mockup.png',
  mockup_size: { width: 1000, height: 1000 },
  design_position: { top: 200, left: 300 },
  design_size: { width: 400, height: 400 }
};

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port localhost:${PORT}`);
});