// Utility functions for Sace.io

class Utils {
    // DOM manipulation utilities
    static $(selector) {
        return document.querySelector(selector);
    }

    static $$(selector) {
        return document.querySelectorAll(selector);
    }

    static createElement(tag, className = '', content = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (content) element.textContent = content;
        return element;
    }

    // Animation utilities
    static animate(element, animation, duration = 500) {
        return new Promise((resolve) => {
            element.style.animationDuration = `${duration}ms`;
            element.classList.add(animation);
            
            element.addEventListener('animationend', () => {
                element.classList.remove(animation);
                resolve();
            }, { once: true });
        });
    }

    static fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        
        let start = null;
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = (timestamp - start) / duration;
            
            if (progress < 1) {
                element.style.opacity = progress;
                requestAnimationFrame(animate);
            } else {
                element.style.opacity = '1';
            }
        };
        
        requestAnimationFrame(animate);
    }

    static fadeOut(element, duration = 300) {
        let start = null;
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = (timestamp - start) / duration;
            
            if (progress < 1) {
                element.style.opacity = 1 - progress;
                requestAnimationFrame(animate);
            } else {
                element.style.display = 'none';
                element.style.opacity = '1';
            }
        };
        
        requestAnimationFrame(animate);
    }

    // Notification system
    static showNotification(message, type = 'info', duration = 5000) {
        const notification = this.createElement('div', `notification ${type}`);
        
        const header = this.createElement('div', 'notification-header');
        const title = this.createElement('div', 'notification-title', this.getNotificationTitle(type));
        const closeBtn = this.createElement('button', 'notification-close', '×');
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        const messageEl = this.createElement('div', 'notification-message', message);
        
        notification.appendChild(header);
        notification.appendChild(messageEl);
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto hide
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, duration);
        
        // Manual close
        closeBtn.addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        });
    }

    static getNotificationTitle(type) {
        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Information'
        };
        return titles[type] || 'Notification';
    }

    // File utilities
    static validateImageFile(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const maxSize = 10 * 1024 * 1024; // 10MB
        
        if (!validTypes.includes(file.type)) {
            return { valid: false, error: 'Please upload a valid image file (JPEG, PNG, or WebP)' };
        }
        
        if (file.size > maxSize) {
            return { valid: false, error: 'Image file is too large. Maximum size is 10MB' };
        }
        
        return { valid: true };
    }

    static readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(file);
        });
    }

    static compressImage(file, maxWidth = 800, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
                canvas.width = img.width * ratio;
                canvas.height = img.height * ratio;
                
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                canvas.toBlob(resolve, file.type, quality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }

    // Image processing utilities
    static getImageDimensions(file) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                resolve({ width: img.width, height: img.height });
            };
            img.src = URL.createObjectURL(file);
        });
    }

    static createImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    // Progress utilities
    static updateProgress(progressElement, percentage, statusText = '') {
        if (progressElement) {
            progressElement.style.width = `${percentage}%`;
        }
        
        const statusElement = document.getElementById('scanStatus') || document.getElementById('generationStatus');
        if (statusElement && statusText) {
            statusElement.textContent = statusText;
        }
    }

    // Local storage utilities
    static setStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('Failed to save to localStorage:', e);
        }
    }

    static getStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.warn('Failed to read from localStorage:', e);
            return defaultValue;
        }
    }

    static removeStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('Failed to remove from localStorage:', e);
        }
    }

    // API utilities
    static async apiCall(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const config = { ...defaultOptions, ...options };
        
        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    // Validation utilities
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    static validateName(name) {
        return name.trim().length >= 2 && name.trim().length <= 50;
    }

    // Color utilities
    static hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    static rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    static getContrastColor(hexColor) {
        const rgb = this.hexToRgb(hexColor);
        if (!rgb) return '#000000';
        
        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        return brightness > 128 ? '#000000' : '#FFFFFF';
    }

    // Device detection
    static isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    static isTablet() {
        return /iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 768;
    }

    static isDesktop() {
        return !this.isMobile() && !this.isTablet();
    }

    // Performance utilities
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Error handling
    static handleError(error, context = '') {
        console.error(`Error in ${context}:`, error);
        
        const userMessage = this.getUserFriendlyError(error);
        this.showNotification(userMessage, 'error');
    }

    static getUserFriendlyError(error) {
        if (error.name === 'NotAllowedError') {
            return 'Camera access denied. Please allow camera access to use live scanning.';
        }
        
        if (error.name === 'NotFoundError') {
            return 'No camera found. Please connect a camera to use live scanning.';
        }
        
        if (error.name === 'NotReadableError') {
            return 'Camera is already in use by another application.';
        }
        
        if (error.message.includes('network')) {
            return 'Network error. Please check your internet connection.';
        }
        
        return 'An unexpected error occurred. Please try again.';
    }

    // Canvas utilities
    static createCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    static drawImageToCanvas(image, canvas, x = 0, y = 0, width = null, height = null) {
        const ctx = canvas.getContext('2d');
        const drawWidth = width || image.width;
        const drawHeight = height || image.height;
        
        ctx.drawImage(image, x, y, drawWidth, drawHeight);
        return canvas;
    }

    static getImageDataFromCanvas(canvas, x = 0, y = 0, width = null, height = null) {
        const ctx = canvas.getContext('2d');
        const dataWidth = width || canvas.width;
        const dataHeight = height || canvas.height;
        
        return ctx.getImageData(x, y, dataWidth, dataHeight);
    }

    // Math utilities
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    static lerp(start, end, factor) {
        return start + (end - start) * factor;
    }

    static distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    static angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    }

    // Date utilities
    static formatDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    static getRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    }
}

// Export for use in other modules
window.Utils = Utils;
