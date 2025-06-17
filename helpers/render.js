const sharp = require('sharp');
const axios = require('axios');
const storage = require('./storage');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SharpMockupRender {
    constructor() {
        this.backgroundImage = null
        this.overlayImage = null
        this.overlayImageColor = null
        this.designImage = null
        this.designImageSize = null
        this.cropImage = null
        this.cropDesignImage = null
    }

    async loadMockupConfig(mockupId) {
        try {
            const configPath = path.join(__dirname, '..', 'configs', `${mockupId}.json`);
            const configData = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configData);

            // Validate required properties
            const requiredProps = [
                'backgroundImage',
                'overlayImage',
                'overlayImageColor',
                'designImagePosition',
                'designImageSize'
            ];

            for (const prop of requiredProps) {
                if (!config[prop]) {
                    throw new Error(`Missing required property: ${prop}`);
                }
            }

            return config;
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Mockup config not found for ID: ${mockupId}`);
            }
            throw error;
        }
    }

    async saveMockupConfig(mockupId, config) {
        try {
            const configPath = path.join(__dirname, '..', 'configs', `${mockupId}.json`);
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));
            return config;
        } catch (error) {
            throw new Error(`Failed to save mockup config: ${error.message}`);
        }
    }

    async downloadImage(key, storageId) {
        try {
            const tempDir = path.join(__dirname, '..', 'temp');
            const hash = crypto.createHash('md5').update(`${key}-${storageId}`).digest('hex');
            const filePath = path.join(tempDir, `${hash}.png`);

            // Check if file exists in temp directory
            try {
                await fs.access(filePath);
                return filePath;
            } catch (error) {
                // File doesn't exist, proceed with download
            }

            // Ensure temp directory exists
            await fs.mkdir(tempDir, { recursive: true });

            // Download image from storage
            const imageBuffer = await storage.r2.download(key);
            await fs.writeFile(filePath, imageBuffer);

            return filePath;
        } catch (error) {
            throw new Error(`Failed to download image: ${error.message}`);
        }
    }

    async loadBackgroundImage(imagePath) {
        try {
            this.backgroundImage = await sharp(imagePath);
            return this.backgroundImage;
        } catch (error) {
            throw new Error(`Failed to load background image: ${error.message}`);
        }
    }

    async loadOverlayImage(imagePath) {
        try {
            this.overlayImage = await sharp(imagePath);
            return this.overlayImage;
        } catch (error) {
            throw new Error(`Failed to load overlay image: ${error.message}`);
        }
    }

    async changeBackgroundImageColor(color) {
        try {
            if (!this.backgroundImage) {
                throw new Error('Background image not loaded');
            }

            // convert hex color to rgb
            const rgb = this.hexToRgb(color);

            const width = 1000;
            const height = 1000;
            // const color = { r: 255, g: 0, b: 0, alpha: 0.5 }; // Red with 50% opacity

            const colorOverlay = {
                create: {
                    width,
                    height,
                    channels: 4,
                    background: rgb
                }
            };

            this.backgroundImage = await this.backgroundImage
                .composite([{ input: await sharp(colorOverlay).png().toBuffer(), blend: 'over' }])

            return this.backgroundImage;
        } catch (error) {
            throw new Error(`Failed to change overlay color: ${error.message}`);
        }
    }

    hexToRgb(hex) {
        const brightnessMultiplier = 2; // Increase color intensity by 20%
        const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * brightnessMultiplier));
        const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * brightnessMultiplier));
        const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * brightnessMultiplier));
        return { r, g, b, alpha: 1 };
    }

    async loadDesignImage(imagePath) {
        try {
            this.designImage = await sharp(imagePath);
            return this.designImage;
        } catch (error) {
            throw new Error(`Failed to load design image: ${error.message}`);
        }
    }

    async resizeDesignImage(designImage, designImageSize) {
        try {
            this.designImageSize = designImageSize;
            return await designImage.resize(designImageSize.width, designImageSize.height);
        } catch (error) {
            throw new Error(`Failed to resize design image: ${error.message}`);
        }
    }

    // create red image
    async createColorImage(width, height, color) {
        if (!color) {
            color = { r: 255, g: 0, b: 0, alpha: 1 };
        } else {
            color = this.hexToRgb(color);
        }
        const image = await sharp({ create: { width, height, channels: 4, background: color } }).png().toBuffer();
        return image;
    }

    // load crop design image
    async loadCropDesignImage(imagePath) {
        try {
            this.cropDesignImage = await sharp(imagePath);
            return this.cropDesignImage;
        } catch (error) {
            throw new Error(`Failed to load crop design image: ${error.message}`);
        }
    }

    // load crop image
    async loadCropImage(imagePath) {
        try {
            this.cropImage = await sharp(imagePath);
            return this.cropImage;
        } catch (error) {
            throw new Error(`Failed to load crop image: ${error.message}`);
        }
    }
    async resizeDesignImageToFitCrop(designImage, cropImage) {
        try {
            const designMeta = await designImage.metadata();
            const cropMeta = await cropImage.metadata();
    
            const designRatio = designMeta.width / designMeta.height;
            const cropRatio = cropMeta.width / cropMeta.height;
    
            let targetWidth, targetHeight;
    
            if (designRatio > cropRatio) {
                // thiết kế quá rộng, scale theo chiều ngang
                targetWidth = cropMeta.width;
                targetHeight = Math.round(cropMeta.width / designRatio);
            } else {
                // thiết kế quá cao, scale theo chiều dọc
                targetHeight = cropMeta.height;
                targetWidth = Math.round(cropMeta.height * designRatio);
            }
    
            return await designImage
                .resize(targetWidth, targetHeight, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 } // nền trong suốt
                })
                .toBuffer();
        } catch (error) {
            throw new Error(`Failed to resize design image to fit crop: ${error.message}`);
        }
    }    
    async render(mockupId, designPath, storageId, hexColor) {
        try {
            // Load mockup configuration
            const config = await this.loadMockupConfig(mockupId);

            // Download and load background image
            const backgroundPath = await this.downloadImage(config.backgroundImage.key, storageId);
            const background = await this.loadBackgroundImage(backgroundPath);

            // load crop image
            const cropImagePath = await this.downloadImage(config.cropImage.key, storageId);
            const cropImage = await this.loadCropImage(cropImagePath);

            // load crop design image
            const cropDesignImagePath = await this.downloadImage(config.cropDesignImage.key, storageId);
            const cropDesignImage = await this.loadCropDesignImage(cropDesignImagePath);

            if (hexColor) {
                await this.changeBackgroundImageColor(hexColor);
            }

            // Download and load overlay image
            const overlayPath = await this.downloadImage(config.overlayImage.key, storageId);
            const overlay = await this.loadOverlayImage(overlayPath);

            // Download and load design image
            const designImagePath = await this.downloadImage(designPath, storageId);
            const designImage = await this.loadDesignImage(designImagePath);

            // Resize design image according to config
            const resizedDesignBuffer = await this.resizeDesignImageToFitCrop(designImage, this.cropImage);

            // background size
            const backgroundSize = await this.backgroundImage.metadata();

            // Composite all images
            const result = await this.backgroundImage
                .composite([
                    {
                        input: await this.createColorImage(backgroundSize.width, backgroundSize.height, hexColor),
                        top: 0,
                        left: 0
                    },
                    {
                        input: await overlay.toBuffer(),
                        blend: 'over'
                    },
                    {
                        input: resizedDesignBuffer,
                        top: Math.floor((backgroundSize.height - (await sharp(resizedDesignBuffer).metadata()).height) / 2),
                        left: Math.floor((backgroundSize.width - (await sharp(resizedDesignBuffer).metadata()).width) / 2)
                    },
                    {
                        input: await cropImage.toBuffer(),
                        top: 0,
                        left: 0,
                        blend: 'dest-in'
                    }
                ])
                .toBuffer();

            return result;
        } catch (error) {
            throw new Error(`Failed to render mockup: ${error.message}`);
        }
    }

    async saveImage(image, path) {
        try {
            await fs.writeFile(path, image);
            return path;
        } catch (error) {
            throw new Error(`Failed to save image: ${error.message}`);
        }
    }

    async uploadImage(image, key, storageId) {
        try {
            const result = await storage.r2.upload(image, key);
            return result;
        } catch (error) {
            throw new Error(`Failed to upload image: ${error.message}`);
        }
    }
}

module.exports = SharpMockupRender;
