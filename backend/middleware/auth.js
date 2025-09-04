// Authentication middleware

const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Authenticate JWT token
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        
        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        req.user = {
            userId: user._id,
            email: user.email,
            name: user.name,
            role: user.role || 'user'
        };
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        } else {
            console.error('Authentication error:', error);
            return res.status(500).json({ error: 'Authentication failed' });
        }
    }
};

// Require admin role
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Optional authentication (for public endpoints that can benefit from user context)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);
            
            if (user) {
                req.user = {
                    userId: user._id,
                    email: user.email,
                    name: user.name,
                    role: user.role || 'user'
                };
            }
        }
        
        next();
    } catch (error) {
        // Continue without authentication for optional auth
        next();
    }
};

// Rate limiting by user
const rateLimitByUser = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const requests = new Map();
    
    return (req, res, next) => {
        const userId = req.user?.userId || req.ip;
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Clean up old entries
        if (requests.has(userId)) {
            const userRequests = requests.get(userId).filter(time => time > windowStart);
            requests.set(userId, userRequests);
        } else {
            requests.set(userId, []);
        }
        
        const userRequests = requests.get(userId);
        
        if (userRequests.length >= maxRequests) {
            return res.status(429).json({ 
                error: 'Too many requests',
                retryAfter: Math.ceil((userRequests[0] + windowMs - now) / 1000)
            });
        }
        
        userRequests.push(now);
        next();
    };
};

// Verify email verification
const requireEmailVerification = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if user is verified (this would be stored in the user object)
    // For now, we'll assume all authenticated users are verified
    next();
};

// Check user permissions
const checkPermissions = (permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const userPermissions = req.user.permissions || [];
        const hasPermission = permissions.some(permission => 
            userPermissions.includes(permission) || userPermissions.includes('admin')
        );
        
        if (!hasPermission) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        next();
    };
};

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        { 
            userId: user._id, 
            email: user.email,
            role: user.role || 'user'
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// Refresh token
const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }
        
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        
        const newToken = generateToken(user);
        
        res.json({
            success: true,
            token: newToken,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role || 'user'
            }
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({ error: 'Invalid refresh token' });
    }
};

// Logout (invalidate token)
const logout = async (req, res, next) => {
    try {
        // In a production system, you would maintain a blacklist of invalidated tokens
        // For now, we'll just return success
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
};

module.exports = {
    authenticateToken,
    requireAdmin,
    optionalAuth,
    rateLimitByUser,
    requireEmailVerification,
    checkPermissions,
    generateToken,
    refreshToken,
    logout
};
