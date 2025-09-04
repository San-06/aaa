// Sace.io Backend Server
// Secure API with audit logging and user management

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

// Import database models
const { AuditLog, User, Avatar, Feedback } = require('./models');
const { connectDB } = require('./database');

// Import middleware
const { authenticateToken, validateRequest, sanitizeInput } = require('./middleware');
const { encryptData, decryptData, hashData } = require('./utils/encryption');

// Import routes
const authRoutes = require('./routes/auth');
const avatarRoutes = require('./routes/avatars');
const userRoutes = require('./routes/users');
const auditRoutes = require('./routes/audit');
const feedbackRoutes = require('./routes/feedback');
const avatarGenerationRoutes = require('./routes/avatar-generation');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "https://api.tensorflow.org"]
        }
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs for sensitive operations
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/', limiter);
app.use('/api/auth/', strictLimiter);
app.use('/api/avatars/upload', strictLimiter);

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://sace.io', 'https://www.sace.io'] 
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 4 // Maximum 4 files
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
        }
    }
});

// Database connection
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/avatars', avatarRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/avatar', avatarGenerationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

// Email verification endpoint
app.post('/api/verify-email', async (req, res) => {
    try {
        const { email, name } = req.body;
        
        // Validate input
        if (!email || !name) {
            return res.status(400).json({ error: 'Email and name are required' });
        }
        
        // Generate verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        
        // Store verification code (encrypted)
        const hashedCode = await hashData(verificationCode);
        const verificationData = {
            email,
            code: hashedCode,
            expiresAt,
            attempts: 0,
            createdAt: new Date()
        };
        
        // Save to database (in production, use Redis for temporary storage)
        await AuditLog.create({
            type: 'email_verification_sent',
            data: encryptData(verificationData),
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date()
        });
        
        // Send email (in production, use actual email service)
        await sendVerificationEmail(email, name, verificationCode);
        
        res.json({ 
            success: true, 
            message: 'Verification code sent to your email' 
        });
        
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ error: 'Failed to send verification email' });
    }
});

// Verify code endpoint
app.post('/api/verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        
        if (!email || !code) {
            return res.status(400).json({ error: 'Email and code are required' });
        }
        
        // Find verification record
        const verificationRecord = await AuditLog.findOne({
            type: 'email_verification_sent',
            'data.email': email,
            createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) } // Within 15 minutes
        }).sort({ createdAt: -1 });
        
        if (!verificationRecord) {
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }
        
        const verificationData = decryptData(verificationRecord.data);
        
        // Check attempts
        if (verificationData.attempts >= 3) {
            return res.status(400).json({ error: 'Too many attempts. Please request a new code.' });
        }
        
        // Verify code
        const isValid = await bcrypt.compare(code, verificationData.code);
        
        if (!isValid) {
            // Increment attempts
            verificationData.attempts++;
            verificationRecord.data = encryptData(verificationData);
            await verificationRecord.save();
            
            return res.status(400).json({ error: 'Invalid verification code' });
        }
        
        // Create or update user
        let user = await User.findOne({ email });
        if (!user) {
            user = await User.create({
                email,
                name: verificationData.name,
                verified: true,
                verifiedAt: new Date(),
                createdAt: new Date()
            });
        } else {
            user.verified = true;
            user.verifiedAt = new Date();
            await user.save();
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        // Log successful verification
        await AuditLog.create({
            type: 'email_verification_success',
            userId: user._id,
            data: encryptData({ email, verifiedAt: new Date() }),
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date()
        });
        
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                verified: user.verified
            }
        });
        
    } catch (error) {
        console.error('Code verification error:', error);
        res.status(500).json({ error: 'Failed to verify code' });
    }
});

// Avatar generation endpoint
app.post('/api/generate-avatar', upload.array('images', 4), async (req, res) => {
    try {
        const { method, faceData } = req.body;
        const files = req.files;
        
        // Validate input
        if (!method || (method === 'upload' && (!files || files.length < 3))) {
            return res.status(400).json({ error: 'Invalid request data' });
        }
        
        // Process images
        const processedImages = [];
        if (files) {
            for (const file of files) {
                const processedImage = await processImage(file);
                processedImages.push(processedImage);
            }
        }
        
        // Generate avatar (simplified for demo)
        const avatarData = await generateAvatar(method, faceData, processedImages);
        
        // Save avatar to database
        const avatar = await Avatar.create({
            id: uuidv4(),
            data: encryptData(avatarData),
            method,
            createdAt: new Date(),
            status: 'completed'
        });
        
        // Log avatar generation
        await AuditLog.create({
            type: 'avatar_generated',
            data: encryptData({
                avatarId: avatar.id,
                method,
                timestamp: new Date()
            }),
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date()
        });
        
        res.json({
            success: true,
            avatarId: avatar.id,
            avatarData: avatarData
        });
        
    } catch (error) {
        console.error('Avatar generation error:', error);
        res.status(500).json({ error: 'Failed to generate avatar' });
    }
});

// Download avatar endpoint
app.get('/api/download-avatar/:avatarId', authenticateToken, async (req, res) => {
    try {
        const { avatarId } = req.params;
        const userId = req.user.userId;
        
        // Find avatar
        const avatar = await Avatar.findOne({ id: avatarId });
        if (!avatar) {
            return res.status(404).json({ error: 'Avatar not found' });
        }
        
        // Log download
        await AuditLog.create({
            type: 'avatar_downloaded',
            userId,
            data: encryptData({
                avatarId,
                downloadedAt: new Date()
            }),
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date()
        });
        
        // Return avatar data
        const avatarData = decryptData(avatar.data);
        res.json({
            success: true,
            avatarData
        });
        
    } catch (error) {
        console.error('Avatar download error:', error);
        res.status(500).json({ error: 'Failed to download avatar' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    
    // Log error
    AuditLog.create({
        type: 'server_error',
        data: encryptData({
            error: error.message,
            stack: error.stack,
            url: req.url,
            method: req.method
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date()
    }).catch(err => console.error('Failed to log error:', err));
    
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Helper functions
async function sendVerificationEmail(email, name, code) {
    // In production, use actual email service like SendGrid, AWS SES, etc.
    console.log(`Verification email for ${email}: ${code}`);
    
    // For demo purposes, we'll just log the email
    // In production, you would use nodemailer or similar
    const transporter = nodemailer.createTransporter({
        // Email service configuration
    });
    
    const mailOptions = {
        from: 'noreply@sace.io',
        to: email,
        subject: 'Sace.io Email Verification',
        html: `
            <h2>Verify Your Email</h2>
            <p>Hello ${name},</p>
            <p>Your verification code is: <strong>${code}</strong></p>
            <p>This code will expire in 15 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
        `
    };
    
    // await transporter.sendMail(mailOptions);
}

async function processImage(file) {
    try {
        // Process image with Sharp
        const processedBuffer = await sharp(file.buffer)
            .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
        
        return {
            originalName: file.originalname,
            size: processedBuffer.length,
            data: processedBuffer.toString('base64'),
            mimeType: 'image/jpeg'
        };
    } catch (error) {
        console.error('Image processing error:', error);
        throw new Error('Failed to process image');
    }
}

async function generateAvatar(method, faceData, images) {
    // Simplified avatar generation
    // In production, this would use actual AI/ML models
    
    const avatarData = {
        id: uuidv4(),
        method,
        faceData: faceData ? JSON.parse(faceData) : null,
        images: images || [],
        generatedAt: new Date(),
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // Placeholder
        metadata: {
            version: '1.0.0',
            quality: 'high',
            format: 'png'
        }
    };
    
    return avatarData;
}

// Start server
app.listen(PORT, () => {
    console.log(`Sace.io server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
