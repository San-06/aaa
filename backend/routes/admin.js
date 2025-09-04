// Admin routes for database management and system administration

const express = require('express');
const router = express.Router();
const { User, Avatar, Feedback, AuditLog } = require('../models');
const { encryptData, decryptData } = require('../utils/encryption');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

// Apply authentication and admin middleware to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// Dashboard statistics
router.get('/dashboard', async (req, res) => {
    try {
        const stats = await getDashboardStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to get dashboard statistics' });
    }
});

// User management
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        
        const query = {};
        if (search) {
            query.$or = [
                { email: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } }
            ];
        }
        
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        
        const users = await User.find(query)
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .select('-__v');
        
        const total = await User.countDocuments(query);
        
        res.json({
            success: true,
            data: {
                users,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Get user details
router.get('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get user's avatars
        const avatars = await Avatar.find({ userId })
            .sort({ createdAt: -1 })
            .limit(10);
        
        // Get user's feedback
        const feedbacks = await Feedback.find({ userId })
            .sort({ createdAt: -1 })
            .limit(10);
        
        // Get user's activity
        const activity = await AuditLog.find({ userId })
            .sort({ timestamp: -1 })
            .limit(20);
        
        res.json({
            success: true,
            data: {
                user,
                avatars,
                feedbacks,
                activity
            }
        });
    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({ error: 'Failed to get user details' });
    }
});

// Update user
router.put('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;
        
        // Remove sensitive fields
        delete updates.password;
        delete updates._id;
        delete updates.createdAt;
        
        const user = await User.findByIdAndUpdate(
            userId,
            { ...updates, updatedAt: new Date() },
            { new: true, runValidators: true }
        );
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Log the update
        await AuditLog.create({
            type: 'admin_user_update',
            userId: req.user.userId,
            data: encryptData({
                targetUserId: userId,
                updates,
                timestamp: new Date()
            }),
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            severity: 'medium'
        });
        
        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user
router.delete('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Delete user's data
        await Avatar.deleteMany({ userId });
        await Feedback.deleteMany({ userId });
        await AuditLog.deleteMany({ userId });
        await User.findByIdAndDelete(userId);
        
        // Log the deletion
        await AuditLog.create({
            type: 'admin_user_delete',
            userId: req.user.userId,
            data: encryptData({
                deletedUserId: userId,
                deletedUserEmail: user.email,
                timestamp: new Date()
            }),
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            severity: 'high'
        });
        
        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Avatar management
router.get('/avatars', async (req, res) => {
    try {
        const { page = 1, limit = 20, status = '', method = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        
        const query = {};
        if (status) query.status = status;
        if (method) query.method = method;
        
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        
        const avatars = await Avatar.find(query)
            .populate('userId', 'email name')
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .select('-data -__v');
        
        const total = await Avatar.countDocuments(query);
        
        res.json({
            success: true,
            data: {
                avatars,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get avatars error:', error);
        res.status(500).json({ error: 'Failed to get avatars' });
    }
});

// Get avatar details
router.get('/avatars/:avatarId', async (req, res) => {
    try {
        const { avatarId } = req.params;
        
        const avatar = await Avatar.findOne({ id: avatarId }).populate('userId', 'email name');
        if (!avatar) {
            return res.status(404).json({ error: 'Avatar not found' });
        }
        
        // Get avatar feedback
        const feedbacks = await Feedback.find({ avatarId })
            .populate('userId', 'email name')
            .sort({ createdAt: -1 });
        
        res.json({
            success: true,
            data: {
                avatar,
                feedbacks
            }
        });
    } catch (error) {
        console.error('Get avatar details error:', error);
        res.status(500).json({ error: 'Failed to get avatar details' });
    }
});

// Delete avatar
router.delete('/avatars/:avatarId', async (req, res) => {
    try {
        const { avatarId } = req.params;
        
        const avatar = await Avatar.findOne({ id: avatarId });
        if (!avatar) {
            return res.status(404).json({ error: 'Avatar not found' });
        }
        
        // Delete related feedback
        await Feedback.deleteMany({ avatarId });
        await Avatar.findOneAndDelete({ id: avatarId });
        
        // Log the deletion
        await AuditLog.create({
            type: 'admin_avatar_delete',
            userId: req.user.userId,
            data: encryptData({
                deletedAvatarId: avatarId,
                avatarUserId: avatar.userId,
                timestamp: new Date()
            }),
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            severity: 'medium'
        });
        
        res.json({
            success: true,
            message: 'Avatar deleted successfully'
        });
    } catch (error) {
        console.error('Delete avatar error:', error);
        res.status(500).json({ error: 'Failed to delete avatar' });
    }
});

// Feedback management
router.get('/feedback', async (req, res) => {
    try {
        const { page = 1, limit = 20, rating = '', category = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        
        const query = {};
        if (rating) query.rating = parseInt(rating);
        if (category) query.category = category;
        
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        
        const feedbacks = await Feedback.find(query)
            .populate('userId', 'email name')
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await Feedback.countDocuments(query);
        
        res.json({
            success: true,
            data: {
                feedbacks,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get feedback error:', error);
        res.status(500).json({ error: 'Failed to get feedback' });
    }
});

// Audit logs
router.get('/audit-logs', async (req, res) => {
    try {
        const { page = 1, limit = 50, type = '', severity = '', userId = '', startDate = '', endDate = '' } = req.query;
        
        const query = {};
        if (type) query.type = type;
        if (severity) query.severity = severity;
        if (userId) query.userId = userId;
        
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }
        
        const auditLogs = await AuditLog.find(query)
            .populate('userId', 'email name')
            .sort({ timestamp: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await AuditLog.countDocuments(query);
        
        res.json({
            success: true,
            data: {
                auditLogs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
});

// System settings
router.get('/settings', async (req, res) => {
    try {
        const settings = {
            system: {
                version: process.env.npm_package_version || '1.0.0',
                nodeVersion: process.version,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                environment: process.env.NODE_ENV || 'development'
            },
            database: {
                connected: true,
                // Add more database info if needed
            },
            features: {
                emailVerification: process.env.EMAIL_SERVICE ? true : false,
                fileUpload: true,
                rateLimiting: true,
                encryption: true
            }
        };
        
        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

// Export data
router.post('/export', async (req, res) => {
    try {
        const { format = 'json', dataTypes = ['users', 'avatars', 'feedbacks', 'auditLogs'] } = req.body;
        
        const exportData = {};
        
        if (dataTypes.includes('users')) {
            exportData.users = await User.find({}, { email: 1, name: 1, verified: 1, createdAt: 1, stats: 1 });
        }
        
        if (dataTypes.includes('avatars')) {
            exportData.avatars = await Avatar.find({}, { id: 1, userId: 1, method: 1, status: 1, downloadCount: 1, createdAt: 1 });
        }
        
        if (dataTypes.includes('feedbacks')) {
            exportData.feedbacks = await Feedback.find({}, { userId: 1, avatarId: 1, rating: 1, review: 1, createdAt: 1 });
        }
        
        if (dataTypes.includes('auditLogs')) {
            exportData.auditLogs = await AuditLog.find({}, { type: 1, userId: 1, ip: 1, timestamp: 1, severity: 1 }).limit(1000);
        }
        
        exportData.exportDate = new Date();
        exportData.exportedBy = req.user.userId;
        
        // Log the export
        await AuditLog.create({
            type: 'admin_data_export',
            userId: req.user.userId,
            data: encryptData({
                format,
                dataTypes,
                recordCount: Object.keys(exportData).length,
                timestamp: new Date()
            }),
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            severity: 'medium'
        });
        
        res.json({
            success: true,
            data: exportData
        });
    } catch (error) {
        console.error('Export data error:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Database cleanup
router.post('/cleanup', async (req, res) => {
    try {
        const { cleanupTypes = ['expiredCodes', 'oldLogs', 'failedAvatars'] } = req.body;
        
        const results = {};
        
        if (cleanupTypes.includes('expiredCodes')) {
            const expiredCodes = await AuditLog.deleteMany({
                type: 'email_verification_sent',
                timestamp: { $lt: new Date(Date.now() - 15 * 60 * 1000) }
            });
            results.expiredCodes = expiredCodes.deletedCount;
        }
        
        if (cleanupTypes.includes('oldLogs')) {
            const oldLogs = await AuditLog.deleteMany({
                timestamp: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
            });
            results.oldLogs = oldLogs.deletedCount;
        }
        
        if (cleanupTypes.includes('failedAvatars')) {
            const failedAvatars = await Avatar.deleteMany({
                status: 'failed',
                createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            });
            results.failedAvatars = failedAvatars.deletedCount;
        }
        
        // Log the cleanup
        await AuditLog.create({
            type: 'admin_database_cleanup',
            userId: req.user.userId,
            data: encryptData({
                cleanupTypes,
                results,
                timestamp: new Date()
            }),
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            severity: 'medium'
        });
        
        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('Database cleanup error:', error);
        res.status(500).json({ error: 'Failed to cleanup database' });
    }
});

// Helper function to get dashboard statistics
async function getDashboardStats() {
    const [
        totalUsers,
        verifiedUsers,
        totalAvatars,
        completedAvatars,
        totalFeedbacks,
        averageRating,
        recentActivity,
        systemStats
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ verified: true }),
        Avatar.countDocuments(),
        Avatar.countDocuments({ status: 'completed' }),
        Feedback.countDocuments(),
        Feedback.aggregate([{ $group: { _id: null, avgRating: { $avg: '$rating' } } }]),
        AuditLog.find().sort({ timestamp: -1 }).limit(10).populate('userId', 'email name'),
        {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            nodeVersion: process.version
        }
    ]);
    
    return {
        users: {
            total: totalUsers,
            verified: verifiedUsers,
            unverified: totalUsers - verifiedUsers
        },
        avatars: {
            total: totalAvatars,
            completed: completedAvatars,
            failed: totalAvatars - completedAvatars
        },
        feedback: {
            total: totalFeedbacks,
            averageRating: averageRating[0]?.avgRating || 0
        },
        recentActivity,
        system: systemStats
    };
}

module.exports = router;
