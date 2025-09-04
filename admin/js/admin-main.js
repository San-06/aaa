// Main Admin Dashboard Controller

class AdminDashboard {
    constructor() {
        this.currentSection = 'overview';
        this.isAuthenticated = false;
        this.authToken = null;
        this.currentUser = null;
        this.charts = {};
        this.data = {
            users: [],
            avatars: [],
            feedback: [],
            auditLogs: []
        };
        
        this.initialize();
    }

    async initialize() {
        try {
            console.log('Initializing Admin Dashboard...');
            
            // Check for existing authentication
            this.authToken = localStorage.getItem('adminToken');
            if (this.authToken) {
                await this.verifyAuth();
            }
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize charts
            this.initializeCharts();
            
            if (this.isAuthenticated) {
                this.showDashboard();
                await this.loadDashboardData();
            } else {
                this.showLogin();
            }
            
            console.log('Admin Dashboard initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Admin Dashboard:', error);
            this.showError('Failed to initialize dashboard');
        }
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Sidebar menu items
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                this.switchSection(section);
            });
        });

        // Search and filter inputs
        this.setupSearchFilters();

        // Export buttons
        this.setupExportButtons();

        // Training controls
        this.setupTrainingControls();

        // Evaluation controls
        this.setupEvaluationControls();

        // Settings
        this.setupSettings();
    }

    setupSearchFilters() {
        // User search
        const userSearch = document.getElementById('userSearch');
        if (userSearch) {
            userSearch.addEventListener('input', (e) => this.filterUsers(e.target.value));
        }

        // Avatar search
        const avatarSearch = document.getElementById('avatarSearch');
        if (avatarSearch) {
            avatarSearch.addEventListener('input', (e) => this.filterAvatars(e.target.value));
        }

        // Feedback search
        const feedbackSearch = document.getElementById('feedbackSearch');
        if (feedbackSearch) {
            feedbackSearch.addEventListener('input', (e) => this.filterFeedback(e.target.value));
        }

        // Audit search
        const auditSearch = document.getElementById('auditSearch');
        if (auditSearch) {
            auditSearch.addEventListener('input', (e) => this.filterAuditLogs(e.target.value));
        }
    }

    setupExportButtons() {
        const exportButtons = [
            { id: 'exportUsers', data: 'users' },
            { id: 'exportAvatars', data: 'avatars' },
            { id: 'exportFeedback', data: 'feedback' },
            { id: 'exportAuditLogs', data: 'auditLogs' }
        ];

        exportButtons.forEach(button => {
            const element = document.getElementById(button.id);
            if (element) {
                element.addEventListener('click', () => this.exportData(button.data));
            }
        });
    }

    setupTrainingControls() {
        const controls = [
            { id: 'initializeTraining', action: 'initialize' },
            { id: 'prepareData', action: 'prepareData' },
            { id: 'startTraining', action: 'startTraining' }
        ];

        controls.forEach(control => {
            const element = document.getElementById(control.id);
            if (element) {
                element.addEventListener('click', () => this.handleTrainingAction(control.action));
            }
        });
    }

    setupEvaluationControls() {
        const controls = [
            { id: 'loadModel', action: 'loadModel' },
            { id: 'loadDataset', action: 'loadDataset' },
            { id: 'startEvaluation', action: 'startEvaluation' },
            { id: 'crossValidate', action: 'crossValidate' }
        ];

        controls.forEach(control => {
            const element = document.getElementById(control.id);
            if (element) {
                element.addEventListener('click', () => this.handleEvaluationAction(control.action));
            }
        });
    }

    setupSettings() {
        const saveBtn = document.getElementById('saveSettings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }

        const resetBtn = document.getElementById('resetSettings');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSettings());
        }
    }

    async verifyAuth() {
        try {
            const response = await this.apiCall('/api/admin/dashboard', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (response.success) {
                this.isAuthenticated = true;
                this.currentUser = response.user;
                return true;
            }
        } catch (error) {
            console.error('Auth verification failed:', error);
            this.authToken = null;
            localStorage.removeItem('adminToken');
        }
        return false;
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;
        
        try {
            const response = await this.apiCall('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (response.success) {
                this.authToken = response.token;
                this.currentUser = response.user;
                localStorage.setItem('adminToken', this.authToken);
                
                this.isAuthenticated = true;
                this.showDashboard();
                await this.loadDashboardData();
                
                this.showNotification('Login successful', 'success');
            } else {
                this.showNotification('Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showNotification('Login failed', 'error');
        }
    }

    handleLogout() {
        this.authToken = null;
        this.currentUser = null;
        localStorage.removeItem('adminToken');
        this.isAuthenticated = false;
        this.showLogin();
        this.showNotification('Logged out successfully', 'info');
    }

    showLogin() {
        document.getElementById('loginModal').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('dashboard').style.display = 'flex';
        
        if (this.currentUser) {
            document.getElementById('adminName').textContent = this.currentUser.name;
        }
    }

    switchSection(section) {
        // Update active menu item
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');
        
        // Update active content section
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(section).classList.add('active');
        
        // Update page title
        const titles = {
            overview: 'Dashboard Overview',
            users: 'User Management',
            avatars: 'Avatar Management',
            feedback: 'Feedback Management',
            'audit-logs': 'Audit Logs',
            'ai-training': 'AI Training',
            'model-evaluation': 'Model Evaluation',
            settings: 'System Settings'
        };
        
        document.getElementById('pageTitle').textContent = titles[section] || 'Dashboard';
        
        this.currentSection = section;
        
        // Load section-specific data
        this.loadSectionData(section);
    }

    async loadDashboardData() {
        try {
            // Load overview statistics
            const stats = await this.apiCall('/api/admin/dashboard', {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            if (stats.success) {
                this.updateOverviewStats(stats.data);
                this.updateCharts(stats.data);
                this.updateRecentActivity(stats.data.recentActivity);
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    async loadSectionData(section) {
        try {
            switch (section) {
                case 'users':
                    await this.loadUsers();
                    break;
                case 'avatars':
                    await this.loadAvatars();
                    break;
                case 'feedback':
                    await this.loadFeedback();
                    break;
                case 'audit-logs':
                    await this.loadAuditLogs();
                    break;
                case 'ai-training':
                    await this.loadTrainingStatus();
                    break;
                case 'model-evaluation':
                    await this.loadEvaluationResults();
                    break;
            }
        } catch (error) {
            console.error(`Failed to load ${section} data:`, error);
            this.showError(`Failed to load ${section} data`);
        }
    }

    updateOverviewStats(data) {
        document.getElementById('totalUsers').textContent = data.users.total;
        document.getElementById('totalAvatars').textContent = data.avatars.total;
        document.getElementById('totalFeedback').textContent = data.feedback.total;
        document.getElementById('averageRating').textContent = data.feedback.averageRating.toFixed(1);
    }

    updateCharts(data) {
        // Update user growth chart
        if (this.charts.userGrowth) {
            this.charts.userGrowth.data.labels = data.userGrowth.labels;
            this.charts.userGrowth.data.datasets[0].data = data.userGrowth.data;
            this.charts.userGrowth.update();
        }

        // Update avatar generation chart
        if (this.charts.avatarGeneration) {
            this.charts.avatarGeneration.data.labels = data.avatarGeneration.labels;
            this.charts.avatarGeneration.data.datasets[0].data = data.avatarGeneration.data;
            this.charts.avatarGeneration.update();
        }

        // Update feedback distribution chart
        if (this.charts.feedbackDistribution) {
            this.charts.feedbackDistribution.data.labels = data.feedbackDistribution.labels;
            this.charts.feedbackDistribution.data.datasets[0].data = data.feedbackDistribution.data;
            this.charts.feedbackDistribution.update();
        }
    }

    updateRecentActivity(activities) {
        const container = document.getElementById('recentActivity');
        if (!container) return;

        container.innerHTML = '';
        
        activities.forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `
                <div class="activity-icon" style="background: ${this.getActivityColor(activity.type)}">
                    <i class="${this.getActivityIcon(activity.type)}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-text">${activity.description}</div>
                    <div class="activity-time">${this.formatTime(activity.timestamp)}</div>
                </div>
            `;
            container.appendChild(item);
        });
    }

    getActivityColor(type) {
        const colors = {
            'user_registration': '#3b82f6',
            'avatar_generated': '#10b981',
            'avatar_downloaded': '#f59e0b',
            'feedback_submitted': '#8b5cf6',
            'security_event': '#ef4444'
        };
        return colors[type] || '#6b7280';
    }

    getActivityIcon(type) {
        const icons = {
            'user_registration': 'fas fa-user-plus',
            'avatar_generated': 'fas fa-user-circle',
            'avatar_downloaded': 'fas fa-download',
            'feedback_submitted': 'fas fa-comment',
            'security_event': 'fas fa-shield-alt'
        };
        return icons[type] || 'fas fa-info-circle';
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    }

    initializeCharts() {
        // User Growth Chart
        const userGrowthCtx = document.getElementById('userGrowthChart');
        if (userGrowthCtx) {
            this.charts.userGrowth = new Chart(userGrowthCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Users',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        // Avatar Generation Chart
        const avatarGenerationCtx = document.getElementById('avatarGenerationChart');
        if (avatarGenerationCtx) {
            this.charts.avatarGeneration = new Chart(avatarGenerationCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Avatars',
                        data: [],
                        backgroundColor: '#10b981'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        // Feedback Distribution Chart
        const feedbackDistributionCtx = document.getElementById('feedbackDistributionChart');
        if (feedbackDistributionCtx) {
            this.charts.feedbackDistribution = new Chart(feedbackDistributionCtx, {
                type: 'doughnut',
                data: {
                    labels: ['5 Stars', '4 Stars', '3 Stars', '2 Stars', '1 Star'],
                    datasets: [{
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: [
                            '#10b981',
                            '#34d399',
                            '#fbbf24',
                            '#f59e0b',
                            '#ef4444'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
    }

    async apiCall(url, options = {}) {
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
            
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <strong>${this.getNotificationTitle(type)}</strong>
                <p>${message}</p>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto hide
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 5000);
    }

    getNotificationTitle(type) {
        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Information'
        };
        return titles[type] || 'Notification';
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    // Placeholder methods for section-specific functionality
    async loadUsers() {
        // Implementation in admin-users.js
    }

    async loadAvatars() {
        // Implementation in admin-avatars.js
    }

    async loadFeedback() {
        // Implementation in admin-feedback.js
    }

    async loadAuditLogs() {
        // Implementation in admin-audit.js
    }

    async loadTrainingStatus() {
        // Implementation in admin-training.js
    }

    async loadEvaluationResults() {
        // Implementation in admin-evaluation.js
    }

    filterUsers(query) {
        // Implementation in admin-users.js
    }

    filterAvatars(query) {
        // Implementation in admin-avatars.js
    }

    filterFeedback(query) {
        // Implementation in admin-feedback.js
    }

    filterAuditLogs(query) {
        // Implementation in admin-audit.js
    }

    async exportData(dataType) {
        try {
            const response = await this.apiCall('/api/admin/export', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.authToken}` },
                body: JSON.stringify({ dataTypes: [dataType] })
            });

            if (response.success) {
                // Download the data
                const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${dataType}_export_${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
                
                this.showNotification(`${dataType} data exported successfully`, 'success');
            }
        } catch (error) {
            console.error('Export failed:', error);
            this.showError('Failed to export data');
        }
    }

    async handleTrainingAction(action) {
        try {
            let response;
            
            switch (action) {
                case 'initialize':
                    response = await this.apiCall('/api/training/initialize', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${this.authToken}` }
                    });
                    break;
                case 'prepareData':
                    response = await this.apiCall('/api/training/prepare-data', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${this.authToken}` },
                        body: JSON.stringify({ dataSource: 'database' })
                    });
                    break;
                case 'startTraining':
                    response = await this.apiCall('/api/training/train', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${this.authToken}` },
                        body: JSON.stringify({ models: ['faceDetection', 'expressionRecognition'] })
                    });
                    break;
            }
            
            if (response && response.success) {
                this.showNotification(`Training ${action} completed successfully`, 'success');
                await this.loadTrainingStatus();
            }
        } catch (error) {
            console.error(`Training ${action} failed:`, error);
            this.showError(`Failed to ${action} training`);
        }
    }

    async handleEvaluationAction(action) {
        try {
            let response;
            
            switch (action) {
                case 'loadModel':
                    response = await this.apiCall('/api/evaluation/load-model', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${this.authToken}` },
                        body: JSON.stringify({ modelPath: 'models/trained/face_detection' })
                    });
                    break;
                case 'loadDataset':
                    response = await this.apiCall('/api/evaluation/load-dataset', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${this.authToken}` },
                        body: JSON.stringify({ datasetPath: 'test_data' })
                    });
                    break;
                case 'startEvaluation':
                    response = await this.apiCall('/api/evaluation/evaluate', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${this.authToken}` }
                    });
                    break;
                case 'crossValidate':
                    response = await this.apiCall('/api/evaluation/cross-validate', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${this.authToken}` },
                        body: JSON.stringify({ k: 5 })
                    });
                    break;
            }
            
            if (response && response.success) {
                this.showNotification(`Evaluation ${action} completed successfully`, 'success');
                await this.loadEvaluationResults();
            }
        } catch (error) {
            console.error(`Evaluation ${action} failed:`, error);
            this.showError(`Failed to ${action} evaluation`);
        }
    }

    async saveSettings() {
        try {
            const settings = {
                autoCleanup: document.getElementById('autoCleanup').checked,
                dataRetention: parseInt(document.getElementById('dataRetention').value),
                autoTraining: document.getElementById('autoTraining').checked,
                trainingFrequency: parseInt(document.getElementById('trainingFrequency').value),
                rateLimiting: document.getElementById('rateLimiting').checked,
                auditLogging: document.getElementById('auditLogging').checked
            };

            // Save settings to backend
            const response = await this.apiCall('/api/admin/settings', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.authToken}` },
                body: JSON.stringify(settings)
            });

            if (response.success) {
                this.showNotification('Settings saved successfully', 'success');
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showError('Failed to save settings');
        }
    }

    resetSettings() {
        document.getElementById('autoCleanup').checked = true;
        document.getElementById('dataRetention').value = 90;
        document.getElementById('autoTraining').checked = false;
        document.getElementById('trainingFrequency').value = 24;
        document.getElementById('rateLimiting').checked = true;
        document.getElementById('auditLogging').checked = true;
        
        this.showNotification('Settings reset to default', 'info');
    }
}

// Initialize the admin dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});
