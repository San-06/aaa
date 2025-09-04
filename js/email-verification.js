// Email verification system for downloads

class EmailVerification {
    constructor() {
        this.verificationCode = null;
        this.userEmail = null;
        this.userName = null;
        this.isVerifying = false;
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.emailModal = document.getElementById('emailModal');
        this.codeModal = document.getElementById('codeModal');
        this.emailForm = document.getElementById('emailForm');
        this.codeForm = document.getElementById('codeForm');
        this.userEmailInput = document.getElementById('userEmail');
        this.userNameInput = document.getElementById('userName');
        this.verificationCodeInput = document.getElementById('verificationCode');
    }

    setupEventListeners() {
        // Download avatar button
        const downloadBtn = document.getElementById('downloadAvatar');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.showEmailVerification());
        }

        // Email form submission
        if (this.emailForm) {
            this.emailForm.addEventListener('submit', (e) => this.handleEmailSubmission(e));
        }

        // Code form submission
        if (this.codeForm) {
            this.codeForm.addEventListener('submit', (e) => this.handleCodeSubmission(e));
        }

        // Modal close buttons
        const closeEmailModal = document.getElementById('closeEmailModal');
        if (closeEmailModal) {
            closeEmailModal.addEventListener('click', () => this.hideEmailModal());
        }

        const closeCodeModal = document.getElementById('closeCodeModal');
        if (closeCodeModal) {
            closeCodeModal.addEventListener('click', () => this.hideCodeModal());
        }

        // Close modals when clicking outside
        if (this.emailModal) {
            this.emailModal.addEventListener('click', (e) => {
                if (e.target === this.emailModal) {
                    this.hideEmailModal();
                }
            });
        }

        if (this.codeModal) {
            this.codeModal.addEventListener('click', (e) => {
                if (e.target === this.codeModal) {
                    this.hideCodeModal();
                }
            });
        }

        // Auto-format verification code input
        if (this.verificationCodeInput) {
            this.verificationCodeInput.addEventListener('input', (e) => {
                this.formatVerificationCode(e.target);
            });
        }
    }

    showEmailVerification() {
        // Check if user is already verified
        const verifiedUser = Utils.getStorage('verifiedUser');
        if (verifiedUser && verifiedUser.verified) {
            this.proceedToDownload();
            return;
        }

        // Show email verification modal
        if (this.emailModal) {
            this.emailModal.style.display = 'flex';
            this.userEmailInput.focus();
        }
    }

    hideEmailModal() {
        if (this.emailModal) {
            this.emailModal.style.display = 'none';
        }
    }

    hideCodeModal() {
        if (this.codeModal) {
            this.codeModal.style.display = 'none';
        }
    }

    async handleEmailSubmission(e) {
        e.preventDefault();
        
        if (this.isVerifying) return;

        try {
            this.isVerifying = true;
            
            // Get form data
            this.userEmail = this.userEmailInput.value.trim();
            this.userName = this.userNameInput.value.trim();
            
            // Validate inputs
            const validation = this.validateEmailInputs();
            if (!validation.valid) {
                Utils.showNotification(validation.error, 'error');
                return;
            }

            // Show loading state
            const submitBtn = this.emailForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            // Send verification email
            await this.sendVerificationEmail();

            // Hide email modal and show code modal
            this.hideEmailModal();
            this.showCodeModal();

            Utils.showNotification('Verification code sent to your email!', 'success');

        } catch (error) {
            console.error('Email verification error:', error);
            Utils.showNotification('Failed to send verification email. Please try again.', 'error');
        } finally {
            this.isVerifying = false;
            
            // Reset button state
            const submitBtn = this.emailForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Send Verification Code';
            submitBtn.disabled = false;
        }
    }

    async handleCodeSubmission(e) {
        e.preventDefault();
        
        if (this.isVerifying) return;

        try {
            this.isVerifying = true;
            
            const enteredCode = this.verificationCodeInput.value.trim();
            
            // Validate code
            if (!enteredCode || enteredCode.length !== 6) {
                Utils.showNotification('Please enter a valid 6-digit verification code.', 'error');
                return;
            }

            // Show loading state
            const submitBtn = this.codeForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Verifying...';
            submitBtn.disabled = true;

            // Verify code
            const isValid = await this.verifyCode(enteredCode);
            
            if (isValid) {
                // Store verified user data
                const verifiedUser = {
                    email: this.userEmail,
                    name: this.userName,
                    verified: true,
                    verifiedAt: Date.now()
                };
                Utils.setStorage('verifiedUser', verifiedUser);
                
                // Hide code modal
                this.hideCodeModal();
                
                // Proceed to download
                this.proceedToDownload();
                
                Utils.showNotification('Email verified successfully!', 'success');
                
            } else {
                Utils.showNotification('Invalid verification code. Please try again.', 'error');
                this.verificationCodeInput.value = '';
                this.verificationCodeInput.focus();
            }

        } catch (error) {
            console.error('Code verification error:', error);
            Utils.showNotification('Failed to verify code. Please try again.', 'error');
        } finally {
            this.isVerifying = false;
            
            // Reset button state
            const submitBtn = this.codeForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Verify & Download';
            submitBtn.disabled = false;
        }
    }

    validateEmailInputs() {
        if (!this.userEmail) {
            return { valid: false, error: 'Please enter your email address.' };
        }
        
        if (!Utils.validateEmail(this.userEmail)) {
            return { valid: false, error: 'Please enter a valid email address.' };
        }
        
        if (!this.userName) {
            return { valid: false, error: 'Please enter your full name.' };
        }
        
        if (!Utils.validateName(this.userName)) {
            return { valid: false, error: 'Please enter a valid name (2-50 characters).' };
        }
        
        return { valid: true };
    }

    async sendVerificationEmail() {
        // Generate verification code
        this.verificationCode = this.generateVerificationCode();
        
        // In a real application, this would send an actual email
        // For demo purposes, we'll simulate the email sending
        await this.simulateEmailSending();
        
        // Log the verification attempt for audit purposes
        this.logVerificationAttempt('email_sent', {
            email: this.userEmail,
            name: this.userName,
            code: this.verificationCode,
            timestamp: Date.now()
        });
    }

    generateVerificationCode() {
        // Generate a 6-digit verification code
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    async simulateEmailSending() {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // In development, show the code in console for testing
        console.log(`Verification code for ${this.userEmail}: ${this.verificationCode}`);
        
        // In a real application, you would:
        // 1. Send the code to the user's email via your backend
        // 2. Store the code temporarily in your database
        // 3. Set an expiration time for the code
    }

    async verifyCode(enteredCode) {
        // In a real application, this would verify against your backend
        // For demo purposes, we'll check against the generated code
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const isValid = enteredCode === this.verificationCode;
        
        // Log the verification attempt
        this.logVerificationAttempt('code_verified', {
            email: this.userEmail,
            code: enteredCode,
            valid: isValid,
            timestamp: Date.now()
        });
        
        return isValid;
    }

    showCodeModal() {
        if (this.codeModal) {
            this.codeModal.style.display = 'flex';
            this.verificationCodeInput.focus();
        }
    }

    formatVerificationCode(input) {
        // Remove non-numeric characters
        let value = input.value.replace(/\D/g, '');
        
        // Limit to 6 digits
        value = value.substring(0, 6);
        
        input.value = value;
        
        // Auto-submit when 6 digits are entered
        if (value.length === 6) {
            setTimeout(() => {
                this.codeForm.dispatchEvent(new Event('submit'));
            }, 500);
        }
    }

    proceedToDownload() {
        // Hide any open modals
        this.hideEmailModal();
        this.hideCodeModal();
        
        // Start download process
        this.downloadAvatar();
        
        // Show feedback modal after download
        setTimeout(() => {
            this.showFeedbackModal();
        }, 2000);
    }

    async downloadAvatar() {
        try {
            // Get avatar data
            const avatarData = Utils.getStorage('avatarData');
            if (!avatarData) {
                throw new Error('No avatar data found');
            }
            
            // Create download link
            const downloadLink = document.createElement('a');
            downloadLink.href = avatarData.dataUrl;
            downloadLink.download = `sace-avatar-${Date.now()}.png`;
            
            // Trigger download
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // Log download activity
            this.logDownloadActivity();
            
            Utils.showNotification('Avatar downloaded successfully!', 'success');
            
        } catch (error) {
            console.error('Download error:', error);
            Utils.showNotification('Failed to download avatar', 'error');
        }
    }

    showFeedbackModal() {
        const feedbackModal = document.getElementById('feedbackModal');
        if (feedbackModal) {
            feedbackModal.style.display = 'flex';
        }
    }

    logVerificationAttempt(type, data) {
        // Log verification attempts for audit purposes
        const logEntry = {
            type: type,
            data: data,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            ip: 'unknown' // Would be provided by backend
        };
        
        // Store in local storage for now (in production, send to backend)
        const auditLogs = Utils.getStorage('auditLogs', []);
        auditLogs.push(logEntry);
        Utils.setStorage('auditLogs', auditLogs);
        
        // Send to backend in production
        this.sendAuditLog(logEntry);
    }

    logDownloadActivity() {
        const downloadLog = {
            type: 'avatar_download',
            data: {
                email: this.userEmail,
                name: this.userName,
                timestamp: Date.now(),
                avatarId: Utils.getStorage('currentAvatarId')
            },
            timestamp: Date.now(),
            userAgent: navigator.userAgent
        };
        
        // Store in local storage
        const auditLogs = Utils.getStorage('auditLogs', []);
        auditLogs.push(downloadLog);
        Utils.setStorage('auditLogs', auditLogs);
        
        // Send to backend
        this.sendAuditLog(downloadLog);
    }

    async sendAuditLog(logEntry) {
        try {
            // In production, send to your backend API
            await Utils.apiCall('/api/audit-logs', {
                method: 'POST',
                body: JSON.stringify(logEntry)
            });
        } catch (error) {
            console.error('Failed to send audit log:', error);
            // Don't show error to user, just log it
        }
    }

    // Public methods
    isUserVerified() {
        const verifiedUser = Utils.getStorage('verifiedUser');
        return verifiedUser && verifiedUser.verified;
    }

    getVerifiedUser() {
        return Utils.getStorage('verifiedUser');
    }

    clearVerification() {
        Utils.removeStorage('verifiedUser');
        this.userEmail = null;
        this.userName = null;
        this.verificationCode = null;
    }

    // Utility methods for testing
    getVerificationCode() {
        return this.verificationCode;
    }

    setVerificationCode(code) {
        this.verificationCode = code;
    }
}

// Initialize email verification when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.emailVerification = new EmailVerification();
});

// Export for use in other modules
window.EmailVerification = EmailVerification;
