// Avatar Generation API Routes

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

const ONNXAvatarModel = require('../ai/onnx-model');
const GLBGenerator = require('../ai/glb-generator');
const { Avatar, AuditLog } = require('../models');
const { encryptData } = require('../utils/encryption');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

// Initialize AI models
const onnxModel = new ONNXAvatarModel();
const glbGenerator = new GLBGenerator();

// Initialize models on startup
(async () => {
    try {
        await onnxModel.initialize();
        console.log('Avatar generation models initialized successfully');
    } catch (error) {
        console.error('Failed to initialize avatar generation models:', error);
    }
})();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 3 // Maximum 3 files (front, left, right)
    },
    fileFilter: (req, file, cb) => {
        // Check file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
        }
    }
});

// Validation middleware
const validateImageUpload = (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'No images uploaded'
        });
    }

    if (req.files.length < 2) {
        return res.status(400).json({
            success: false,
            error: 'At least 2 images are required (front and side view)'
        });
    }

    // Check for required angles
    const uploadedAngles = req.files.map(file => file.fieldname);
    const requiredAngles = ['front', 'left', 'right'];
    const missingAngles = requiredAngles.filter(angle => !uploadedAngles.includes(angle));

    if (missingAngles.length > 0) {
        return res.status(400).json({
            success: false,
            error: `Missing required image angles: ${missingAngles.join(', ')}`
        });
    }

    next();
};

// Main avatar generation endpoint
router.post('/generate', 
    optionalAuth,
    upload.fields([
        { name: 'front', maxCount: 1 },
        { name: 'left', maxCount: 1 },
        { name: 'right', maxCount: 1 }
    ]),
    validateImageUpload,
    async (req, res) => {
        const startTime = Date.now();
        let avatarId = null;

        try {
            console.log('Starting avatar generation...');
            
            // Generate unique avatar ID
            avatarId = uuidv4();
            
            // Extract image buffers
            const imageBuffers = {
                front: req.files.front[0].buffer,
                left: req.files.left[0].buffer,
                right: req.files.right[0].buffer
            };

            // Validate images
            await validateImages(imageBuffers);

            // Process images through ONNX model
            console.log('Processing images through ONNX model...');
            const modelResult = await onnxModel.predict([
                imageBuffers.front,
                imageBuffers.left,
                imageBuffers.right
            ]);

            // Extract facial features
            const facialFeatures = onnxModel.extractFacialFeatures(modelResult.landmarks[0]);

            // Generate 3D mesh
            console.log('Generating 3D mesh...');
            const meshData = onnxModel.generate3DMesh(modelResult.landmarks[0]);
            
            // Add facial features to mesh data
            meshData.skinTone = facialFeatures.skinTone;
            meshData.expressions = facialFeatures.expressions;
            meshData.faceShape = facialFeatures.faceShape;
            meshData.accessories = facialFeatures.accessories;

            // Generate GLB
            console.log('Generating GLB file...');
            const glbResult = await glbGenerator.generateGLB(meshData, {
                avatarId,
                generatedAt: new Date().toISOString(),
                modelInfo: modelResult.modelInfo,
                inferenceTime: modelResult.inferenceTime
            });

            // Save GLB to file
            const filename = glbGenerator.generateFilename(`avatar_${avatarId}`);
            const filePath = path.join('uploads', 'avatars', filename);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await glbGenerator.saveGLBToFile(glbResult.buffer, filePath);

            // Create avatar record in database
            const avatarRecord = new Avatar({
                id: avatarId,
                userId: req.user?.userId || null,
                data: encryptData({
                    method: 'image_upload',
                    images: {
                        front: { size: imageBuffers.front.length, type: 'image' },
                        left: { size: imageBuffers.left.length, type: 'image' },
                        right: { size: imageBuffers.right.length, type: 'image' }
                    },
                    landmarks: modelResult.landmarks[0],
                    facialFeatures,
                    meshData: {
                        vertexCount: meshData.vertices.length / 3,
                        faceCount: meshData.faces.length / 3
                    },
                    generatedAt: new Date().toISOString()
                }),
                method: 'image_upload',
                status: 'completed',
                downloadCount: 0,
                metadata: {
                    generationTime: Date.now() - startTime,
                    inferenceTime: modelResult.inferenceTime,
                    modelVersion: '1.0.0',
                    glbSize: glbResult.buffer.byteLength,
                    filename: filename
                }
            });

            await avatarRecord.save();

            // Log audit trail
            await AuditLog.create({
                type: 'avatar_generated',
                userId: req.user?.userId || null,
                data: encryptData({
                    avatarId,
                    method: 'image_upload',
                    generationTime: Date.now() - startTime,
                    inferenceTime: modelResult.inferenceTime,
                    timestamp: new Date()
                }),
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                severity: 'low'
            });

            // Return success response
            res.json({
                success: true,
                data: {
                    avatarId,
                    status: 'completed',
                    generationTime: Date.now() - startTime,
                    inferenceTime: modelResult.inferenceTime,
                    facialFeatures,
                    meshInfo: {
                        vertexCount: meshData.vertices.length / 3,
                        faceCount: meshData.faces.length / 3
                    },
                    glbInfo: {
                        size: glbResult.buffer.byteLength,
                        filename: filename
                    },
                    downloadUrl: `/api/avatar/download/${avatarId}`
                }
            });

        } catch (error) {
            console.error('Avatar generation failed:', error);
            
            // Log error
            await AuditLog.create({
                type: 'avatar_generation_failed',
                userId: req.user?.userId || null,
                data: encryptData({
                    avatarId,
                    error: error.message,
                    timestamp: new Date()
                }),
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                severity: 'medium'
            });

            res.status(500).json({
                success: false,
                error: 'Avatar generation failed',
                details: error.message
            });
        }
    }
);

// Download GLB file endpoint
router.get('/download/:avatarId', async (req, res) => {
    try {
        const { avatarId } = req.params;
        
        // Find avatar record
        const avatar = await Avatar.findOne({ id: avatarId });
        if (!avatar) {
            return res.status(404).json({
                success: false,
                error: 'Avatar not found'
            });
        }

        // Get filename from metadata
        const filename = avatar.metadata.filename;
        if (!filename) {
            return res.status(404).json({
                success: false,
                error: 'Avatar file not found'
            });
        }

        // Construct file path
        const filePath = path.join('uploads', 'avatars', filename);
        
        // Check if file exists
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({
                success: false,
                error: 'Avatar file not found on disk'
            });
        }

        // Increment download count
        avatar.downloadCount += 1;
        await avatar.save();

        // Log download
        await AuditLog.create({
            type: 'avatar_downloaded',
            userId: req.user?.userId || null,
            data: encryptData({
                avatarId,
                filename,
                timestamp: new Date()
            }),
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            severity: 'low'
        });

        // Set headers and send file
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.sendFile(path.resolve(filePath));

    } catch (error) {
        console.error('Avatar download failed:', error);
        res.status(500).json({
            success: false,
            error: 'Download failed',
            details: error.message
        });
    }
});

// Get avatar info endpoint
router.get('/info/:avatarId', async (req, res) => {
    try {
        const { avatarId } = req.params;
        
        const avatar = await Avatar.findOne({ id: avatarId });
        if (!avatar) {
            return res.status(404).json({
                success: false,
                error: 'Avatar not found'
            });
        }

        // Decrypt avatar data
        const avatarData = JSON.parse(avatar.data);
        
        res.json({
            success: true,
            data: {
                id: avatar.id,
                method: avatar.method,
                status: avatar.status,
                downloadCount: avatar.downloadCount,
                createdAt: avatar.createdAt,
                metadata: avatar.metadata,
                facialFeatures: avatarData.facialFeatures,
                meshInfo: avatarData.meshData
            }
        });

    } catch (error) {
        console.error('Failed to get avatar info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get avatar info',
            details: error.message
        });
    }
});

// Validate images helper function
async function validateImages(imageBuffers) {
    const validationResults = {};
    
    for (const [angle, buffer] of Object.entries(imageBuffers)) {
        try {
            // Use Sharp to validate and get image info
            const imageInfo = await sharp(buffer).metadata();
            
            // Check image dimensions
            if (imageInfo.width < 224 || imageInfo.height < 224) {
                throw new Error(`Image too small. Minimum size is 224x224 pixels.`);
            }
            
            // Check image format
            if (!['jpeg', 'png', 'webp'].includes(imageInfo.format)) {
                throw new Error(`Unsupported image format: ${imageInfo.format}`);
            }
            
            validationResults[angle] = {
                valid: true,
                width: imageInfo.width,
                height: imageInfo.height,
                format: imageInfo.format,
                size: buffer.length
            };
            
        } catch (error) {
            validationResults[angle] = {
                valid: false,
                error: error.message
            };
        }
    }
    
    // Check if all images are valid
    const invalidImages = Object.entries(validationResults)
        .filter(([angle, result]) => !result.valid);
    
    if (invalidImages.length > 0) {
        const errorMessage = invalidImages
            .map(([angle, result]) => `${angle}: ${result.error}`)
            .join('; ');
        throw new Error(`Image validation failed: ${errorMessage}`);
    }
    
    return validationResults;
}

// Health check endpoint
router.get('/health', async (req, res) => {
    try {
        const modelInfo = onnxModel.getModelInfo();
        
        res.json({
            success: true,
            data: {
                status: 'healthy',
                model: {
                    initialized: modelInfo.isInitialized,
                    path: modelInfo.modelPath,
                    inputShape: modelInfo.inputShape,
                    outputShape: modelInfo.outputShape
                },
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Health check failed',
            details: error.message
        });
    }
});

module.exports = router;
