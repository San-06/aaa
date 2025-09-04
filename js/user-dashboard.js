// User dashboard and avatar management system

class UserDashboard {
    constructor() {
        this.userAvatars = new Map();
        this.currentUser = null;
        this.isLoggedIn = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadUserData();
    }

    initializeElements() {
        this.loginBtn = document.getElementById('loginBtn');
        this.dashboardBtn = document.getElementById('dashboardBtn');
        this.dashboardInterface = this.createDashboardInterface();
    }

    setupEventListeners() {
        // Login button
        if (this.loginBtn) {
            this.loginBtn.addEventListener('click', () => this.showLoginModal());
        }

        // Dashboard button
        if (this.dashboardBtn) {
            this.dashboardBtn.addEventListener('click', () => this.showDashboard());
        }

        // Create another avatar button
        const createAnotherBtn = document.getElementById('createAnother');
        if (createAnotherBtn) {
            createAnotherBtn.addEventListener('click', () => this.createAnotherAvatar());
        }

        // Feedback submission
        const submitFeedbackBtn = document.getElementById('submitFeedback');
        if (submitFeedbackBtn) {
            submitFeedbackBtn.addEventListener('click', () => this.submitFeedback());
        }
    }

    createDashboardInterface() {
        const dashboard = Utils.createElement('div', 'dashboard-interface', '');
        dashboard.style.display = 'none';
        dashboard.innerHTML = `
            <div class="dashboard-container">
                <div class="dashboard-header">
                    <h2>My Avatars</h2>
                    <button class="btn-secondary" id="closeDashboard">Close</button>
                </div>
                <div class="dashboard-content">
                    <div class="user-info">
                        <div class="user-avatar">
                            <div class="avatar-placeholder">
                                <i class="fas fa-user"></i>
                            </div>
                        </div>
                        <div class="user-details">
                            <h3 id="userName">User Name</h3>
                            <p id="userEmail">user@example.com</p>
                            <p id="avatarCount">0 avatars created</p>
                        </div>
                    </div>
                    <div class="avatars-grid" id="avatarsGrid">
                        <!-- Avatar cards will be populated here -->
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dashboard);
        
        // Add close button event listener
        const closeBtn = dashboard.querySelector('#closeDashboard');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideDashboard());
        }
        
        return dashboard;
    }

    loadUserData() {
        // Check if user is verified
        const verifiedUser = Utils.getStorage('verifiedUser');
        if (verifiedUser && verifiedUser.verified) {
            this.currentUser = verifiedUser;
            this.isLoggedIn = true;
            this.updateLoginState();
        }

        // Load user avatars
        this.loadUserAvatars();
    }

    updateLoginState() {
        if (this.isLoggedIn) {
            if (this.loginBtn) {
                this.loginBtn.style.display = 'none';
            }
            if (this.dashboardBtn) {
                this.dashboardBtn.style.display = 'block';
            }
        } else {
            if (this.loginBtn) {
                this.loginBtn.style.display = 'block';
            }
            if (this.dashboardBtn) {
                this.dashboardBtn.style.display = 'none';
            }
        }
    }

    showLoginModal() {
        // Use the existing email verification modal for login
        if (window.emailVerification) {
            window.emailVerification.showEmailVerification();
        }
    }

    showDashboard() {
        if (!this.isLoggedIn) {
            this.showLoginModal();
            return;
        }

        this.dashboardInterface.style.display = 'block';
        this.updateDashboardContent();
    }

    hideDashboard() {
        this.dashboardInterface.style.display = 'none';
    }

    updateDashboardContent() {
        if (!this.currentUser) return;

        // Update user info
        const userName = this.dashboardInterface.querySelector('#userName');
        const userEmail = this.dashboardInterface.querySelector('#userEmail');
        const avatarCount = this.dashboardInterface.querySelector('#avatarCount');

        if (userName) userName.textContent = this.currentUser.name;
        if (userEmail) userEmail.textContent = this.currentUser.email;
        if (avatarCount) avatarCount.textContent = `${this.userAvatars.size} avatars created`;

        // Update avatars grid
        this.updateAvatarsGrid();
    }

    updateAvatarsGrid() {
        const avatarsGrid = this.dashboardInterface.querySelector('#avatarsGrid');
        if (!avatarsGrid) return;

        avatarsGrid.innerHTML = '';

        if (this.userAvatars.size === 0) {
            avatarsGrid.innerHTML = `
                <div class="no-avatars">
                    <i class="fas fa-user-circle"></i>
                    <h3>No avatars yet</h3>
                    <p>Create your first avatar to get started!</p>
                    <button class="btn-primary" onclick="window.userDashboard.createAnotherAvatar()">
                        Create Avatar
                    </button>
                </div>
            `;
            return;
        }

        // Create avatar cards
        this.userAvatars.forEach((avatarData, avatarId) => {
            const avatarCard = this.createAvatarCard(avatarData, avatarId);
            avatarsGrid.appendChild(avatarCard);
        });
    }

    createAvatarCard(avatarData, avatarId) {
        const card = Utils.createElement('div', 'avatar-card');
        
        card.innerHTML = `
            <div class="avatar-preview">
                <img src="${avatarData.thumbnail}" alt="Avatar preview">
                <div class="avatar-overlay">
                    <button class="btn-secondary" onclick="window.userDashboard.downloadAvatar('${avatarId}')">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn-secondary" onclick="window.userDashboard.deleteAvatar('${avatarId}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="avatar-info">
                <h4>Avatar ${avatarId.slice(-4)}</h4>
                <p>Created ${Utils.getRelativeTime(new Date(avatarData.createdAt))}</p>
                <div class="avatar-rating">
                    ${this.renderRating(avatarData.rating)}
                </div>
                ${avatarData.review ? `<p class="avatar-review">"${avatarData.review}"</p>` : ''}
            </div>
        `;

        return card;
    }

    renderRating(rating) {
        if (!rating) {
            return '<span class="no-rating">Not rated</span>';
        }

        const stars = [];
        for (let i = 1; i <= 5; i++) {
            const emoji = this.getRatingEmoji(i);
            const isActive = i <= rating;
            stars.push(`<span class="rating-star ${isActive ? 'active' : ''}">${emoji}</span>`);
        }

        return stars.join('');
    }

    getRatingEmoji(rating) {
        const emojis = {
            1: '😠',
            2: '😕',
            3: '😐',
            4: '🙂',
            5: '😍'
        };
        return emojis[rating] || '😐';
    }

    saveAvatar(avatarData) {
        if (!this.isLoggedIn) return;

        const avatarId = `avatar_${Date.now()}`;
        const avatarRecord = {
            id: avatarId,
            data: avatarData,
            thumbnail: this.createThumbnail(avatarData),
            createdAt: Date.now(),
            rating: null,
            review: null,
            downloadCount: 0
        };

        this.userAvatars.set(avatarId, avatarRecord);
        this.saveUserAvatars();

        // Update dashboard if it's open
        if (this.dashboardInterface.style.display === 'block') {
            this.updateAvatarsGrid();
        }

        return avatarId;
    }

    createThumbnail(avatarData) {
        // Create a thumbnail from the avatar data
        // This would typically be generated from the 3D model
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');

        // Create a simple placeholder thumbnail
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, 200, 200);
        
        ctx.fillStyle = '#667eea';
        ctx.font = '24px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Avatar', 100, 100);

        return canvas.toDataURL('image/png');
    }

    downloadAvatar(avatarId) {
        const avatarData = this.userAvatars.get(avatarId);
        if (!avatarData) return;

        try {
            // Create download link
            const downloadLink = document.createElement('a');
            downloadLink.href = avatarData.data.dataUrl;
            downloadLink.download = `sace-avatar-${avatarId}.png`;
            
            // Trigger download
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            // Update download count
            avatarData.downloadCount++;
            this.saveUserAvatars();

            Utils.showNotification('Avatar downloaded successfully!', 'success');

        } catch (error) {
            console.error('Download error:', error);
            Utils.showNotification('Failed to download avatar', 'error');
        }
    }

    deleteAvatar(avatarId) {
        if (!confirm('Are you sure you want to delete this avatar?')) {
            return;
        }

        this.userAvatars.delete(avatarId);
        this.saveUserAvatars();
        this.updateAvatarsGrid();

        Utils.showNotification('Avatar deleted successfully', 'success');
    }

    createAnotherAvatar() {
        // Hide dashboard
        this.hideDashboard();

        // Reset to mode selection
        const modeSelection = document.querySelector('.mode-selection');
        if (modeSelection) {
            modeSelection.style.display = 'block';
        }

        // Hide other interfaces
        const interfaces = [
            'scanningInterface',
            'uploadInterface',
            'generationInterface',
            'avatarResult'
        ];

        interfaces.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'none';
            }
        });

        // Clear previous data
        Utils.removeStorage('scanData');
        Utils.removeStorage('uploadData');
        Utils.removeStorage('avatarData');

        Utils.showNotification('Ready to create a new avatar!', 'info');
    }

    submitFeedback() {
        const rating = document.querySelector('.rating-btn.selected');
        const reviewText = document.getElementById('reviewText');

        if (!rating) {
            Utils.showNotification('Please select a rating', 'error');
            return;
        }

        const ratingValue = parseInt(rating.dataset.rating);
        const review = reviewText ? reviewText.value.trim() : '';

        // Get current avatar data
        const avatarData = Utils.getStorage('avatarData');
        if (!avatarData) {
            Utils.showNotification('No avatar data found', 'error');
            return;
        }

        // Save feedback
        const feedback = {
            rating: ratingValue,
            review: review,
            timestamp: Date.now()
        };

        // If user is logged in, save to their avatar collection
        if (this.isLoggedIn) {
            const avatarId = this.saveAvatar(avatarData);
            const avatarRecord = this.userAvatars.get(avatarId);
            if (avatarRecord) {
                avatarRecord.rating = ratingValue;
                avatarRecord.review = review;
                this.saveUserAvatars();
            }
        }

        // Send feedback to backend
        this.sendFeedback(feedback);

        // Hide feedback modal
        const feedbackModal = document.getElementById('feedbackModal');
        if (feedbackModal) {
            feedbackModal.style.display = 'none';
        }

        Utils.showNotification('Thank you for your feedback!', 'success');

        // Show dashboard if user is logged in
        if (this.isLoggedIn) {
            setTimeout(() => {
                this.showDashboard();
            }, 1000);
        }
    }

    async sendFeedback(feedback) {
        try {
            // Send feedback to backend
            await Utils.apiCall('/api/feedback', {
                method: 'POST',
                body: JSON.stringify({
                    ...feedback,
                    userEmail: this.currentUser ? this.currentUser.email : null,
                    userAgent: navigator.userAgent,
                    timestamp: Date.now()
                })
            });
        } catch (error) {
            console.error('Failed to send feedback:', error);
            // Don't show error to user, just log it
        }
    }

    saveUserAvatars() {
        if (!this.currentUser) return;

        const userData = {
            ...this.currentUser,
            avatars: Array.from(this.userAvatars.entries())
        };

        Utils.setStorage('userData', userData);
    }

    loadUserAvatars() {
        const userData = Utils.getStorage('userData');
        if (userData && userData.avatars) {
            this.userAvatars = new Map(userData.avatars);
        }
    }

    // Public methods
    isUserLoggedIn() {
        return this.isLoggedIn;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getUserAvatars() {
        return Array.from(this.userAvatars.values());
    }

    getAvatarById(avatarId) {
        return this.userAvatars.get(avatarId);
    }

    // Event handlers for rating buttons
    setupRatingButtons() {
        const ratingButtons = document.querySelectorAll('.rating-btn');
        ratingButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all buttons
                ratingButtons.forEach(b => b.classList.remove('selected'));
                // Add active class to clicked button
                btn.classList.add('selected');
            });
        });
    }
}

// Initialize user dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.userDashboard = new UserDashboard();
    
    // Setup rating buttons when feedback modal is shown
    const feedbackModal = document.getElementById('feedbackModal');
    if (feedbackModal) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    if (feedbackModal.style.display === 'flex') {
                        window.userDashboard.setupRatingButtons();
                    }
                }
            });
        });
        observer.observe(feedbackModal, { attributes: true });
    }
});

// Export for use in other modules
window.UserDashboard = UserDashboard;
