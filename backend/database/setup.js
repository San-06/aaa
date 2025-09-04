// Database setup and initialization script

const mongoose = require('mongoose');
const { User, Avatar, Feedback, AuditLog } = require('../models');
const { encryptData, hashData } = require('../utils/encryption');
const { v4: uuidv4 } = require('uuid');

// Database connection
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sace_io';
        await mongoose.connect(mongoURI);
        console.log('Database connected successfully');
    } catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
    }
};

// Create admin user
const createAdminUser = async () => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@sace.io';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: adminEmail });
        if (existingAdmin) {
            console.log('Admin user already exists');
            return existingAdmin;
        }
        
        // Create admin user
        const adminUser = new User({
            email: adminEmail,
            name: 'System Administrator',
            verified: true,
            verifiedAt: new Date(),
            role: 'admin',
            permissions: ['read', 'write', 'delete', 'admin'],
            createdAt: new Date()
        });
        
        await adminUser.save();
        console.log('Admin user created successfully');
        return adminUser;
        
    } catch (error) {
        console.error('Failed to create admin user:', error);
        throw error;
    }
};

// Create sample data for testing
const createSampleData = async () => {
    try {
        console.log('Creating sample data...');
        
        // Create sample users
        const sampleUsers = [];
        for (let i = 1; i <= 10; i++) {
            const user = new User({
                email: `user${i}@example.com`,
                name: `Test User ${i}`,
                verified: true,
                verifiedAt: new Date(),
                stats: {
                    avatarsCreated: Math.floor(Math.random() * 5),
                    totalDownloads: Math.floor(Math.random() * 10),
                    lastActivityAt: new Date()
                }
            });
            await user.save();
            sampleUsers.push(user);
        }
        
        // Create sample avatars
        const sampleAvatars = [];
        for (let i = 0; i < 20; i++) {
            const randomUser = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
            const avatar = new Avatar({
                id: uuidv4(),
                userId: randomUser._id,
                data: encryptData({
                    method: Math.random() > 0.5 ? 'live_scan' : 'image_upload',
                    generatedAt: new Date(),
                    quality: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
                    faceData: {
                        expressions: {
                            smile: Math.random() > 0.5,
                            frown: Math.random() > 0.8,
                            raisedEyebrows: Math.random() > 0.7
                        },
                        accessories: {
                            glasses: Math.random() > 0.8,
                            earrings: Math.random() > 0.9
                        }
                    }
                }),
                method: Math.random() > 0.5 ? 'live_scan' : 'image_upload',
                status: 'completed',
                downloadCount: Math.floor(Math.random() * 5),
                metadata: {
                    generationTime: Math.floor(Math.random() * 5000) + 1000,
                    quality: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
                    version: '1.0.0'
                }
            });
            await avatar.save();
            sampleAvatars.push(avatar);
        }
        
        // Create sample feedback
        for (let i = 0; i < 30; i++) {
            const randomUser = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
            const randomAvatar = sampleAvatars[Math.floor(Math.random() * sampleAvatars.length)];
            
            const feedback = new Feedback({
                userId: randomUser._id,
                avatarId: randomAvatar.id,
                rating: Math.floor(Math.random() * 5) + 1,
                review: Math.random() > 0.5 ? `Great avatar! User ${i} is satisfied.` : null,
                category: ['quality', 'accuracy', 'speed', 'usability', 'general'][Math.floor(Math.random() * 5)],
                metadata: {
                    userAgent: 'Mozilla/5.0 (Test Browser)',
                    ip: '127.0.0.1'
                }
            });
            await feedback.save();
        }
        
        // Create sample audit logs
        const auditTypes = [
            'user_registration',
            'email_verification_sent',
            'email_verification_success',
            'avatar_generated',
            'avatar_downloaded',
            'feedback_submitted'
        ];
        
        for (let i = 0; i < 100; i++) {
            const randomUser = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
            const auditType = auditTypes[Math.floor(Math.random() * auditTypes.length)];
            
            const auditLog = new AuditLog({
                type: auditType,
                userId: randomUser._id,
                data: encryptData({
                    action: auditType,
                    timestamp: new Date(),
                    details: `Sample audit log entry ${i}`
                }),
                ip: '127.0.0.1',
                userAgent: 'Mozilla/5.0 (Test Browser)',
                severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
            });
            await auditLog.save();
        }
        
        console.log('Sample data created successfully');
        
    } catch (error) {
        console.error('Failed to create sample data:', error);
        throw error;
    }
};

// Database statistics
const getDatabaseStats = async () => {
    try {
        const stats = {
            users: await User.countDocuments(),
            avatars: await Avatar.countDocuments(),
            feedbacks: await Feedback.countDocuments(),
            auditLogs: await AuditLog.countDocuments(),
            timestamp: new Date()
        };
        
        // Additional statistics
        const userStats = await User.aggregate([
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    verifiedUsers: { $sum: { $cond: ['$verified', 1, 0] } },
                    totalAvatarsCreated: { $sum: '$stats.avatarsCreated' },
                    totalDownloads: { $sum: '$stats.totalDownloads' }
                }
            }
        ]);
        
        const avatarStats = await Avatar.aggregate([
            {
                $group: {
                    _id: null,
                    totalAvatars: { $sum: 1 },
                    completedAvatars: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                    totalDownloads: { $sum: '$downloadCount' },
                    avgGenerationTime: { $avg: '$metadata.generationTime' }
                }
            }
        ]);
        
        const feedbackStats = await Feedback.aggregate([
            {
                $group: {
                    _id: null,
                    totalFeedback: { $sum: 1 },
                    averageRating: { $avg: '$rating' },
                    ratings: {
                        $push: '$rating'
                    }
                }
            }
        ]);
        
        return {
            ...stats,
            userStats: userStats[0] || {},
            avatarStats: avatarStats[0] || {},
            feedbackStats: feedbackStats[0] || {}
        };
        
    } catch (error) {
        console.error('Failed to get database stats:', error);
        throw error;
    }
};

// Database cleanup
const cleanupDatabase = async () => {
    try {
        console.log('Starting database cleanup...');
        
        // Remove expired verification codes
        const expiredCodes = await AuditLog.deleteMany({
            type: 'email_verification_sent',
            timestamp: { $lt: new Date(Date.now() - 15 * 60 * 1000) }
        });
        console.log(`Removed ${expiredCodes.deletedCount} expired verification codes`);
        
        // Remove old audit logs (keep last 90 days)
        const oldAuditLogs = await AuditLog.deleteMany({
            timestamp: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
        });
        console.log(`Removed ${oldAuditLogs.deletedCount} old audit logs`);
        
        // Remove failed avatars older than 24 hours
        const failedAvatars = await Avatar.deleteMany({
            status: 'failed',
            createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        console.log(`Removed ${failedAvatars.deletedCount} failed avatars`);
        
        // Remove inactive users (optional - be careful with this)
        if (process.env.REMOVE_INACTIVE_USERS === 'true') {
            const inactiveUsers = await User.deleteMany({
                'stats.lastActivityAt': { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
                verified: false
            });
            console.log(`Removed ${inactiveUsers.deletedCount} inactive unverified users`);
        }
        
        console.log('Database cleanup completed');
        
    } catch (error) {
        console.error('Database cleanup failed:', error);
        throw error;
    }
};

// Export data
const exportData = async (format = 'json') => {
    try {
        console.log(`Exporting data in ${format} format...`);
        
        const data = {
            users: await User.find({}, { email: 1, name: 1, verified: 1, createdAt: 1, stats: 1 }),
            avatars: await Avatar.find({}, { id: 1, userId: 1, method: 1, status: 1, downloadCount: 1, createdAt: 1 }),
            feedbacks: await Feedback.find({}, { userId: 1, avatarId: 1, rating: 1, review: 1, createdAt: 1 }),
            auditLogs: await AuditLog.find({}, { type: 1, userId: 1, ip: 1, timestamp: 1, severity: 1 }).limit(1000),
            exportDate: new Date(),
            totalRecords: {
                users: await User.countDocuments(),
                avatars: await Avatar.countDocuments(),
                feedbacks: await Feedback.countDocuments(),
                auditLogs: await AuditLog.countDocuments()
            }
        };
        
        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        } else if (format === 'csv') {
            // Convert to CSV format (simplified)
            return convertToCSV(data);
        }
        
        return data;
        
    } catch (error) {
        console.error('Data export failed:', error);
        throw error;
    }
};

// Convert data to CSV format
const convertToCSV = (data) => {
    let csv = '';
    
    // Users CSV
    csv += 'Users\n';
    csv += 'Email,Name,Verified,CreatedAt,AvatarsCreated,TotalDownloads\n';
    data.users.forEach(user => {
        csv += `${user.email},${user.name},${user.verified},${user.createdAt},${user.stats.avatarsCreated},${user.stats.totalDownloads}\n`;
    });
    
    csv += '\nAvatars\n';
    csv += 'ID,Method,Status,DownloadCount,CreatedAt\n';
    data.avatars.forEach(avatar => {
        csv += `${avatar.id},${avatar.method},${avatar.status},${avatar.downloadCount},${avatar.createdAt}\n`;
    });
    
    csv += '\nFeedbacks\n';
    csv += 'Rating,Review,CreatedAt\n';
    data.feedbacks.forEach(feedback => {
        csv += `${feedback.rating},"${feedback.review || ''}",${feedback.createdAt}\n`;
    });
    
    return csv;
};

// Main setup function
const setupDatabase = async () => {
    try {
        console.log('Setting up Sace.io database...');
        
        // Connect to database
        await connectDB();
        
        // Create admin user
        await createAdminUser();
        
        // Create sample data if requested
        if (process.env.CREATE_SAMPLE_DATA === 'true') {
            await createSampleData();
        }
        
        // Get and display statistics
        const stats = await getDatabaseStats();
        console.log('Database Statistics:');
        console.log(JSON.stringify(stats, null, 2));
        
        console.log('Database setup completed successfully!');
        
    } catch (error) {
        console.error('Database setup failed:', error);
        process.exit(1);
    }
};

// Command line interface
if (require.main === module) {
    const command = process.argv[2];
    
    switch (command) {
        case 'setup':
            setupDatabase();
            break;
        case 'stats':
            connectDB().then(() => getDatabaseStats()).then(console.log);
            break;
        case 'cleanup':
            connectDB().then(() => cleanupDatabase());
            break;
        case 'export':
            const format = process.argv[3] || 'json';
            connectDB().then(() => exportData(format)).then(console.log);
            break;
        case 'sample':
            connectDB().then(() => createSampleData());
            break;
        default:
            console.log('Available commands:');
            console.log('  setup   - Initialize database with admin user');
            console.log('  stats   - Show database statistics');
            console.log('  cleanup - Clean up old data');
            console.log('  export  - Export data (json/csv)');
            console.log('  sample  - Create sample data');
    }
}

module.exports = {
    connectDB,
    createAdminUser,
    createSampleData,
    getDatabaseStats,
    cleanupDatabase,
    exportData,
    setupDatabase
};
