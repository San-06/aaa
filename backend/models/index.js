// Database models for Sace.io

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// User Schema
const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50
    },
    verified: {
        type: Boolean,
        default: false
    },
    verifiedAt: {
        type: Date
    },
    lastLoginAt: {
        type: Date
    },
    preferences: {
        notifications: {
            type: Boolean,
            default: true
        },
        privacy: {
            type: String,
            enum: ['public', 'private'],
            default: 'private'
        }
    },
    stats: {
        avatarsCreated: {
            type: Number,
            default: 0
        },
        totalDownloads: {
            type: Number,
            default: 0
        },
        lastActivityAt: {
            type: Date,
            default: Date.now
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Avatar Schema
const avatarSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    data: {
        type: String, // Encrypted avatar data
        required: true
    },
    method: {
        type: String,
        enum: ['live_scan', 'image_upload'],
        required: true
    },
    metadata: {
        faceData: {
            type: mongoose.Schema.Types.Mixed
        },
        images: [{
            originalName: String,
            size: Number,
            mimeType: String,
            processedAt: Date
        }],
        generationTime: {
            type: Number // in milliseconds
        },
        quality: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'high'
        },
        version: {
            type: String,
            default: '1.0.0'
        }
    },
    status: {
        type: String,
        enum: ['processing', 'completed', 'failed'],
        default: 'processing'
    },
    downloadCount: {
        type: Number,
        default: 0
    },
    lastDownloadedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Feedback Schema
const feedbackSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    avatarId: {
        type: String,
        ref: 'Avatar'
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    review: {
        type: String,
        maxlength: 500
    },
    category: {
        type: String,
        enum: ['quality', 'accuracy', 'speed', 'usability', 'general'],
        default: 'general'
    },
    metadata: {
        userAgent: String,
        ip: String,
        sessionId: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Audit Log Schema
const auditLogSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: [
            'user_registration',
            'email_verification_sent',
            'email_verification_success',
            'email_verification_failed',
            'avatar_generated',
            'avatar_downloaded',
            'avatar_deleted',
            'feedback_submitted',
            'user_login',
            'user_logout',
            'data_export',
            'data_deletion',
            'security_event',
            'server_error',
            'api_access'
        ]
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    data: {
        type: String, // Encrypted data
        required: true
    },
    ip: {
        type: String,
        required: true
    },
    userAgent: {
        type: String,
        required: true
    },
    sessionId: {
        type: String
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false // We use custom timestamp field
});

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'stats.lastActivityAt': -1 });

avatarSchema.index({ userId: 1, createdAt: -1 });
avatarSchema.index({ id: 1 });
avatarSchema.index({ status: 1 });
avatarSchema.index({ createdAt: -1 });

feedbackSchema.index({ userId: 1, createdAt: -1 });
feedbackSchema.index({ avatarId: 1 });
feedbackSchema.index({ rating: 1 });
feedbackSchema.index({ createdAt: -1 });

auditLogSchema.index({ type: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ ip: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

// Middleware
userSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

avatarSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Static methods
userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.getUserStats = function(userId) {
    return this.aggregate([
        { $match: { _id: userId } },
        {
            $lookup: {
                from: 'avatars',
                localField: '_id',
                foreignField: 'userId',
                as: 'avatars'
            }
        },
        {
            $lookup: {
                from: 'feedbacks',
                localField: '_id',
                foreignField: 'userId',
                as: 'feedbacks'
            }
        },
        {
            $project: {
                email: 1,
                name: 1,
                verified: 1,
                createdAt: 1,
                avatarCount: { $size: '$avatars' },
                totalDownloads: { $sum: '$avatars.downloadCount' },
                averageRating: { $avg: '$feedbacks.rating' },
                lastActivityAt: 1
            }
        }
    ]);
};

avatarSchema.statics.findByUserId = function(userId, limit = 10, skip = 0) {
    return this.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);
};

avatarSchema.statics.getPopularAvatars = function(limit = 10) {
    return this.find({ status: 'completed' })
        .sort({ downloadCount: -1 })
        .limit(limit);
};

feedbackSchema.statics.getAverageRating = function(avatarId) {
    return this.aggregate([
        { $match: { avatarId } },
        {
            $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 }
            }
        }
    ]);
};

auditLogSchema.statics.logEvent = function(type, data, options = {}) {
    const logEntry = new this({
        type,
        data: JSON.stringify(data),
        ip: options.ip || 'unknown',
        userAgent: options.userAgent || 'unknown',
        userId: options.userId,
        sessionId: options.sessionId,
        severity: options.severity || 'low',
        timestamp: new Date()
    });
    
    return logEntry.save();
};

auditLogSchema.statics.getUserActivity = function(userId, limit = 50) {
    return this.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit);
};

auditLogSchema.statics.getSecurityEvents = function(limit = 100) {
    return this.find({
        $or: [
            { type: 'security_event' },
            { severity: { $in: ['high', 'critical'] } }
        ]
    })
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Instance methods
userSchema.methods.updateLastActivity = function() {
    this.stats.lastActivityAt = new Date();
    return this.save();
};

userSchema.methods.incrementAvatarCount = function() {
    this.stats.avatarsCreated += 1;
    return this.save();
};

avatarSchema.methods.incrementDownloadCount = function() {
    this.downloadCount += 1;
    this.lastDownloadedAt = new Date();
    return this.save();
};

// Create models
const User = mongoose.model('User', userSchema);
const Avatar = mongoose.model('Avatar', avatarSchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = {
    User,
    Avatar,
    Feedback,
    AuditLog
};
