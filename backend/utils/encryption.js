// Encryption utilities for secure data handling

const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Encryption configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_ROUNDS = 12;

/**
 * Encrypt sensitive data
 * @param {string} text - Data to encrypt
 * @returns {string} - Encrypted data with IV and auth tag
 */
function encryptData(text) {
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
        cipher.setAAD(Buffer.from('sace-io-auth', 'utf8'));
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        // Combine IV, auth tag, and encrypted data
        const combined = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
        
        return combined;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedData - Encrypted data with IV and auth tag
 * @returns {string} - Decrypted data
 */
function decryptData(encryptedData) {
    try {
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }
        
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        
        const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
        decipher.setAAD(Buffer.from('sace-io-auth', 'utf8'));
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt data');
    }
}

/**
 * Hash data using bcrypt
 * @param {string} data - Data to hash
 * @returns {Promise<string>} - Hashed data
 */
async function hashData(data) {
    try {
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        const hashed = await bcrypt.hash(data, salt);
        return hashed;
    } catch (error) {
        console.error('Hashing error:', error);
        throw new Error('Failed to hash data');
    }
}

/**
 * Compare data with hash
 * @param {string} data - Data to compare
 * @param {string} hash - Hash to compare against
 * @returns {Promise<boolean>} - Whether data matches hash
 */
async function compareHash(data, hash) {
    try {
        return await bcrypt.compare(data, hash);
    } catch (error) {
        console.error('Hash comparison error:', error);
        return false;
    }
}

/**
 * Generate a secure random token
 * @param {number} length - Token length in bytes
 * @returns {string} - Random token
 */
function generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a secure random string
 * @param {number} length - String length
 * @returns {string} - Random string
 */
function generateRandomString(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
}

/**
 * Create a hash of the input data
 * @param {string} data - Data to hash
 * @param {string} algorithm - Hash algorithm (default: sha256)
 * @returns {string} - Hash of the data
 */
function createHash(data, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(data).digest('hex');
}

/**
 * Create HMAC signature
 * @param {string} data - Data to sign
 * @param {string} secret - Secret key
 * @param {string} algorithm - HMAC algorithm (default: sha256)
 * @returns {string} - HMAC signature
 */
function createHMAC(data, secret, algorithm = 'sha256') {
    return crypto.createHmac(algorithm, secret).update(data).digest('hex');
}

/**
 * Verify HMAC signature
 * @param {string} data - Original data
 * @param {string} signature - HMAC signature
 * @param {string} secret - Secret key
 * @param {string} algorithm - HMAC algorithm (default: sha256)
 * @returns {boolean} - Whether signature is valid
 */
function verifyHMAC(data, signature, secret, algorithm = 'sha256') {
    const expectedSignature = createHMAC(data, secret, algorithm);
    return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
    );
}

/**
 * Encrypt file data
 * @param {Buffer} fileData - File data to encrypt
 * @returns {Buffer} - Encrypted file data
 */
function encryptFile(fileData) {
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
        cipher.setAAD(Buffer.from('sace-io-file', 'utf8'));
        
        let encrypted = cipher.update(fileData);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        const authTag = cipher.getAuthTag();
        
        // Combine IV, auth tag, and encrypted data
        return Buffer.concat([iv, authTag, encrypted]);
    } catch (error) {
        console.error('File encryption error:', error);
        throw new Error('Failed to encrypt file');
    }
}

/**
 * Decrypt file data
 * @param {Buffer} encryptedFileData - Encrypted file data
 * @returns {Buffer} - Decrypted file data
 */
function decryptFile(encryptedFileData) {
    try {
        const iv = encryptedFileData.slice(0, IV_LENGTH);
        const authTag = encryptedFileData.slice(IV_LENGTH, IV_LENGTH + 16);
        const encrypted = encryptedFileData.slice(IV_LENGTH + 16);
        
        const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
        decipher.setAAD(Buffer.from('sace-io-file', 'utf8'));
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted;
    } catch (error) {
        console.error('File decryption error:', error);
        throw new Error('Failed to decrypt file');
    }
}

/**
 * Sanitize sensitive data for logging
 * @param {object} data - Data to sanitize
 * @returns {object} - Sanitized data
 */
function sanitizeForLogging(data) {
    const sensitiveFields = [
        'password', 'token', 'secret', 'key', 'code', 'email', 'phone',
        'ssn', 'creditCard', 'bankAccount', 'data', 'content'
    ];
    
    const sanitized = { ...data };
    
    for (const field of sensitiveFields) {
        if (sanitized[field]) {
            if (typeof sanitized[field] === 'string') {
                sanitized[field] = sanitized[field].substring(0, 4) + '***';
            } else if (typeof sanitized[field] === 'object') {
                sanitized[field] = '[REDACTED]';
            }
        }
    }
    
    return sanitized;
}

/**
 * Generate a secure session ID
 * @returns {string} - Secure session ID
 */
function generateSessionId() {
    return generateSecureToken(32);
}

/**
 * Generate a secure API key
 * @returns {string} - Secure API key
 */
function generateApiKey() {
    return 'sace_' + generateSecureToken(40);
}

/**
 * Mask sensitive data for display
 * @param {string} data - Data to mask
 * @param {number} visibleChars - Number of characters to show at start and end
 * @returns {string} - Masked data
 */
function maskSensitiveData(data, visibleChars = 2) {
    if (!data || data.length <= visibleChars * 2) {
        return '***';
    }
    
    const start = data.substring(0, visibleChars);
    const end = data.substring(data.length - visibleChars);
    const middle = '*'.repeat(data.length - visibleChars * 2);
    
    return start + middle + end;
}

/**
 * Validate encryption key strength
 * @param {string} key - Encryption key to validate
 * @returns {boolean} - Whether key is strong enough
 */
function validateEncryptionKey(key) {
    if (!key || key.length < 32) {
        return false;
    }
    
    // Check for sufficient entropy
    const entropy = calculateEntropy(key);
    return entropy >= 4.0; // Minimum entropy requirement
}

/**
 * Calculate entropy of a string
 * @param {string} str - String to calculate entropy for
 * @returns {number} - Entropy value
 */
function calculateEntropy(str) {
    const freq = {};
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    for (const count of Object.values(freq)) {
        const p = count / str.length;
        entropy -= p * Math.log2(p);
    }
    
    return entropy;
}

module.exports = {
    encryptData,
    decryptData,
    hashData,
    compareHash,
    generateSecureToken,
    generateRandomString,
    createHash,
    createHMAC,
    verifyHMAC,
    encryptFile,
    decryptFile,
    sanitizeForLogging,
    generateSessionId,
    generateApiKey,
    maskSensitiveData,
    validateEncryptionKey,
    calculateEntropy
};
