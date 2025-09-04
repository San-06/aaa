// Validation middleware for API requests

const Joi = require('joi');

// Validation schemas
const schemas = {
    // User registration
    userRegistration: Joi.object({
        email: Joi.string().email().required(),
        name: Joi.string().min(2).max(50).required(),
        password: Joi.string().min(8).required()
    }),

    // Email verification
    emailVerification: Joi.object({
        email: Joi.string().email().required(),
        name: Joi.string().min(2).max(50).required()
    }),

    // Code verification
    codeVerification: Joi.object({
        email: Joi.string().email().required(),
        code: Joi.string().length(6).pattern(/^\d+$/).required()
    }),

    // Avatar generation
    avatarGeneration: Joi.object({
        method: Joi.string().valid('image_upload', 'live_scan').required(),
        faceData: Joi.object().optional(),
        preferences: Joi.object().optional()
    }),

    // Feedback submission
    feedbackSubmission: Joi.object({
        avatarId: Joi.string().uuid().required(),
        rating: Joi.number().integer().min(1).max(5).required(),
        review: Joi.string().max(500).optional(),
        category: Joi.string().valid('quality', 'accuracy', 'speed', 'usability', 'general').optional()
    }),

    // Admin operations
    adminUserUpdate: Joi.object({
        name: Joi.string().min(2).max(50).optional(),
        verified: Joi.boolean().optional(),
        role: Joi.string().valid('user', 'admin').optional()
    }),

    // Data export
    dataExport: Joi.object({
        format: Joi.string().valid('json', 'csv').required(),
        dataTypes: Joi.array().items(Joi.string().valid('users', 'avatars', 'feedbacks', 'auditLogs')).required()
    })
};

// Validation middleware factory
const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errorDetails = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errorDetails
            });
        }

        req.body = value;
        next();
    };
};

// File validation middleware
const validateFileUpload = (options = {}) => {
    const {
        maxSize = 10 * 1024 * 1024, // 10MB
        allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        maxFiles = 4
    } = options;

    return (req, res, next) => {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files uploaded'
            });
        }

        if (req.files.length > maxFiles) {
            return res.status(400).json({
                success: false,
                error: `Too many files. Maximum ${maxFiles} files allowed.`
            });
        }

        // Validate each file
        for (const file of req.files) {
            // Check file size
            if (file.size > maxSize) {
                return res.status(400).json({
                    success: false,
                    error: `File ${file.originalname} is too large. Maximum size is ${maxSize / (1024 * 1024)}MB.`
                });
            }

            // Check file type
            if (!allowedTypes.includes(file.mimetype)) {
                return res.status(400).json({
                    success: false,
                    error: `File ${file.originalname} has invalid type. Allowed types: ${allowedTypes.join(', ')}.`
                });
            }
        }

        next();
    };
};

// Image validation middleware
const validateImages = (options = {}) => {
    const {
        minWidth = 224,
        minHeight = 224,
        maxWidth = 4096,
        maxHeight = 4096
    } = options;

    return async (req, res, next) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No images uploaded'
                });
            }

            const sharp = require('sharp');
            const validationResults = [];

            for (const file of req.files) {
                try {
                    const metadata = await sharp(file.buffer).metadata();
                    
                    if (metadata.width < minWidth || metadata.height < minHeight) {
                        validationResults.push({
                            filename: file.originalname,
                            valid: false,
                            error: `Image too small. Minimum size is ${minWidth}x${minHeight} pixels.`
                        });
                    } else if (metadata.width > maxWidth || metadata.height > maxHeight) {
                        validationResults.push({
                            filename: file.originalname,
                            valid: false,
                            error: `Image too large. Maximum size is ${maxWidth}x${maxHeight} pixels.`
                        });
                    } else {
                        validationResults.push({
                            filename: file.originalname,
                            valid: true,
                            width: metadata.width,
                            height: metadata.height,
                            format: metadata.format
                        });
                    }
                } catch (error) {
                    validationResults.push({
                        filename: file.originalname,
                        valid: false,
                        error: 'Invalid image file'
                    });
                }
            }

            const invalidImages = validationResults.filter(result => !result.valid);
            if (invalidImages.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Image validation failed',
                    details: invalidImages
                });
            }

            req.imageValidation = validationResults;
            next();

        } catch (error) {
            console.error('Image validation error:', error);
            res.status(500).json({
                success: false,
                error: 'Image validation failed',
                details: error.message
            });
        }
    };
};

// Sanitize input middleware
const sanitizeInput = (req, res, next) => {
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            // Remove potentially dangerous characters
            return obj
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '')
                .trim();
        } else if (Array.isArray(obj)) {
            return obj.map(sanitize);
        } else if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[key] = sanitize(value);
            }
            return sanitized;
        }
        return obj;
    };

    if (req.body) {
        req.body = sanitize(req.body);
    }
    if (req.query) {
        req.query = sanitize(req.query);
    }
    if (req.params) {
        req.params = sanitize(req.params);
    }

    next();
};

// Rate limiting validation
const validateRateLimit = (req, res, next) => {
    // This would integrate with your rate limiting middleware
    // For now, just pass through
    next();
};

// Authentication validation
const validateAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }
    next();
};

// Admin validation
const validateAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Admin access required'
        });
    }
    next();
};

// Export validation functions
module.exports = {
    schemas,
    validateRequest,
    validateFileUpload,
    validateImages,
    sanitizeInput,
    validateRateLimit,
    validateAuth,
    validateAdmin
};
