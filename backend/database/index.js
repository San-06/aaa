// Database connection and configuration

const mongoose = require('mongoose');
const redis = require('redis');

// MongoDB connection
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sace_io';
        
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferCommands: false,
            bufferMaxEntries: 0
        };

        const conn = await mongoose.connect(mongoURI, options);
        
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        
        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });
        
        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('MongoDB connection closed through app termination');
            process.exit(0);
        });
        
    } catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
    }
};

// Redis connection
let redisClient = null;

const connectRedis = async () => {
    try {
        const redisURI = process.env.REDIS_URI || 'redis://localhost:6379';
        
        redisClient = redis.createClient({
            url: redisURI,
            retry_strategy: (options) => {
                if (options.error && options.error.code === 'ECONNREFUSED') {
                    return new Error('The server refused the connection');
                }
                if (options.total_retry_time > 1000 * 60 * 60) {
                    return new Error('Retry time exhausted');
                }
                if (options.attempt > 10) {
                    return undefined;
                }
                return Math.min(options.attempt * 100, 3000);
            }
        });
        
        redisClient.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });
        
        redisClient.on('connect', () => {
            console.log('Redis Client Connected');
        });
        
        redisClient.on('ready', () => {
            console.log('Redis Client Ready');
        });
        
        redisClient.on('end', () => {
            console.log('Redis Client Disconnected');
        });
        
        await redisClient.connect();
        
    } catch (error) {
        console.error('Redis connection failed:', error);
        // Continue without Redis if connection fails
    }
};

// Redis helper functions
const redisHelpers = {
    async set(key, value, expireInSeconds = null) {
        if (!redisClient) return false;
        
        try {
            const serializedValue = JSON.stringify(value);
            if (expireInSeconds) {
                await redisClient.setEx(key, expireInSeconds, serializedValue);
            } else {
                await redisClient.set(key, serializedValue);
            }
            return true;
        } catch (error) {
            console.error('Redis SET error:', error);
            return false;
        }
    },
    
    async get(key) {
        if (!redisClient) return null;
        
        try {
            const value = await redisClient.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Redis GET error:', error);
            return null;
        }
    },
    
    async del(key) {
        if (!redisClient) return false;
        
        try {
            await redisClient.del(key);
            return true;
        } catch (error) {
            console.error('Redis DEL error:', error);
            return false;
        }
    },
    
    async exists(key) {
        if (!redisClient) return false;
        
        try {
            const result = await redisClient.exists(key);
            return result === 1;
        } catch (error) {
            console.error('Redis EXISTS error:', error);
            return false;
        }
    },
    
    async expire(key, seconds) {
        if (!redisClient) return false;
        
        try {
            await redisClient.expire(key, seconds);
            return true;
        } catch (error) {
            console.error('Redis EXPIRE error:', error);
            return false;
        }
    },
    
    async incr(key) {
        if (!redisClient) return 0;
        
        try {
            return await redisClient.incr(key);
        } catch (error) {
            console.error('Redis INCR error:', error);
            return 0;
        }
    },
    
    async decr(key) {
        if (!redisClient) return 0;
        
        try {
            return await redisClient.decr(key);
        } catch (error) {
            console.error('Redis DECR error:', error);
            return 0;
        }
    }
};

// Database health check
const checkDatabaseHealth = async () => {
    const health = {
        mongodb: false,
        redis: false,
        timestamp: new Date()
    };
    
    // Check MongoDB
    try {
        await mongoose.connection.db.admin().ping();
        health.mongodb = true;
    } catch (error) {
        console.error('MongoDB health check failed:', error);
    }
    
    // Check Redis
    try {
        if (redisClient) {
            await redisClient.ping();
            health.redis = true;
        }
    } catch (error) {
        console.error('Redis health check failed:', error);
    }
    
    return health;
};

// Database cleanup functions
const cleanupExpiredData = async () => {
    try {
        // Clean up expired verification codes
        const expiredVerificationCodes = await mongoose.connection.db.collection('auditlogs').deleteMany({
            type: 'email_verification_sent',
            timestamp: { $lt: new Date(Date.now() - 15 * 60 * 1000) } // 15 minutes ago
        });
        
        console.log(`Cleaned up ${expiredVerificationCodes.deletedCount} expired verification codes`);
        
        // Clean up old audit logs (keep only last 90 days)
        const oldAuditLogs = await mongoose.connection.db.collection('auditlogs').deleteMany({
            timestamp: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // 90 days ago
        });
        
        console.log(`Cleaned up ${oldAuditLogs.deletedCount} old audit logs`);
        
        // Clean up failed avatar generations (older than 24 hours)
        const failedAvatars = await mongoose.connection.db.collection('avatars').deleteMany({
            status: 'failed',
            createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // 24 hours ago
        });
        
        console.log(`Cleaned up ${failedAvatars.deletedCount} failed avatar generations`);
        
    } catch (error) {
        console.error('Database cleanup error:', error);
    }
};

// Database backup functions
const createBackup = async () => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `sace_backup_${timestamp}`;
        
        // This would typically use mongodump in production
        console.log(`Creating backup: ${backupName}`);
        
        // In production, you would:
        // 1. Use mongodump to create a backup
        // 2. Compress the backup
        // 3. Upload to cloud storage
        // 4. Clean up local backup files
        
        return backupName;
    } catch (error) {
        console.error('Backup creation error:', error);
        throw error;
    }
};

// Database statistics
const getDatabaseStats = async () => {
    try {
        const stats = {
            users: await mongoose.connection.db.collection('users').countDocuments(),
            avatars: await mongoose.connection.db.collection('avatars').countDocuments(),
            feedbacks: await mongoose.connection.db.collection('feedbacks').countDocuments(),
            auditLogs: await mongoose.connection.db.collection('auditlogs').countDocuments(),
            timestamp: new Date()
        };
        
        return stats;
    } catch (error) {
        console.error('Database stats error:', error);
        return null;
    }
};

// Initialize connections
const initializeDatabase = async () => {
    await connectDB();
    await connectRedis();
    
    // Schedule cleanup tasks
    setInterval(cleanupExpiredData, 60 * 60 * 1000); // Every hour
    
    // Schedule health checks
    setInterval(checkDatabaseHealth, 5 * 60 * 1000); // Every 5 minutes
    
    console.log('Database initialization completed');
};

module.exports = {
    connectDB,
    connectRedis,
    redisHelpers,
    checkDatabaseHealth,
    cleanupExpiredData,
    createBackup,
    getDatabaseStats,
    initializeDatabase
};
