// Main application controller for Sace.io

class SaceApp {
    constructor() {
        this.isInitialized = false;
        this.currentMode = null;
        this.appState = {
            scanning: false,
            uploading: false,
            generating: false,
            completed: false
        };
        
        this.initializeApp();
    }

    async initializeApp() {
        try {
            console.log('Initializing Sace.io...');
            
            // Wait for all modules to be ready
            await this.waitForModules();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize app state
            this.initializeAppState();
            
            // Show onboarding if first visit
            this.checkFirstVisit();
            
            this.isInitialized = true;
            console.log('Sace.io initialized successfully!');
            
        } catch (error) {
            console.error('Failed to initialize Sace.io:', error);
            Utils.showNotification('Failed to initialize application', 'error');
        }
    }

    async waitForModules() {
        const modules = [
            'cameraManager',
            'imageProcessor', 
            'faceDetector',
            'avatarGenerator',
            'emailVerification',
            'userDashboard'
        ];

        const waitForModule = (moduleName) => {
            return new Promise((resolve) => {
                const checkModule = () => {
                    if (window[moduleName]) {
                        resolve();
                    } else {
                        setTimeout(checkModule, 100);
                    }
                };
                checkModule();
            });
        };

        await Promise.all(modules.map(waitForModule));
    }

    setupEventListeners() {
        // Mode selection buttons
        const startLiveScanBtn = document.getElementById('startLiveScan');
        const startUploadBtn = document.getElementById('startUpload');

        if (startLiveScanBtn) {
            startLiveScanBtn.addEventListener('click', () => this.startLiveScanMode());
        }

        if (startUploadBtn) {
            startUploadBtn.addEventListener('click', () => this.startUploadMode());
        }

        // Global error handling
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            Utils.showNotification('An unexpected error occurred', 'error');
        });

        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handlePageHidden();
            } else {
                this.handlePageVisible();
            }
        });

        // Handle beforeunload
        window.addEventListener('beforeunload', () => {
            this.handleBeforeUnload();
        });
    }

    initializeAppState() {
        // Set initial app state
        this.appState = {
            scanning: false,
            uploading: false,
            generating: false,
            completed: false
        };

        // Show mode selection by default
        this.showModeSelection();
    }

    checkFirstVisit() {
        const hasVisited = Utils.getStorage('hasVisited', false);
        if (!hasVisited) {
            Utils.setStorage('hasVisited', true);
            this.showOnboarding();
        }
    }

    showOnboarding() {
        // Create onboarding modal
        const onboardingModal = Utils.createElement('div', 'modal onboarding-modal');
        onboardingModal.innerHTML = `
            <div class="modal-content onboarding-content">
                <div class="modal-header">
                    <h3>Welcome to Sace.io!</h3>
                </div>
                <div class="modal-body">
                    <div class="onboarding-steps">
                        <div class="onboarding-step">
                            <div class="step-icon">📷</div>
                            <h4>Choose Your Method</h4>
                            <p>Use live scanning with your webcam or upload 3-4 clear images</p>
                        </div>
                        <div class="onboarding-step">
                            <div class="step-icon">🤖</div>
                            <h4>AI Analysis</h4>
                            <p>Our AI analyzes facial features, expressions, and accessories</p>
                        </div>
                        <div class="onboarding-step">
                            <div class="step-icon">🎨</div>
                            <h4>3D Avatar</h4>
                            <p>Get your personalized cartoon-style 3D avatar</p>
                        </div>
                        <div class="onboarding-step">
                            <div class="step-icon">📧</div>
                            <h4>Download</h4>
                            <p>Verify your email to download your avatar</p>
                        </div>
                    </div>
                    <div class="onboarding-actions">
                        <button class="btn-primary" id="startOnboarding">Get Started</button>
                        <button class="btn-secondary" id="skipOnboarding">Skip Tutorial</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(onboardingModal);

        // Add event listeners
        const startBtn = onboardingModal.querySelector('#startOnboarding');
        const skipBtn = onboardingModal.querySelector('#skipOnboarding');

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                document.body.removeChild(onboardingModal);
                this.showModeSelection();
            });
        }

        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                document.body.removeChild(onboardingModal);
                this.showModeSelection();
            });
        }
    }

    startLiveScanMode() {
        this.currentMode = 'live_scan';
        this.appState.scanning = true;
        
        // Hide mode selection
        this.hideModeSelection();
        
        // Start live scanning
        if (window.cameraManager) {
            window.cameraManager.startLiveScan();
        }
    }

    startUploadMode() {
        this.currentMode = 'image_upload';
        this.appState.uploading = true;
        
        // Hide mode selection
        this.hideModeSelection();
        
        // Show upload interface
        if (window.imageProcessor) {
            window.imageProcessor.showUploadInterface();
        }
    }

    showModeSelection() {
        const modeSelection = document.querySelector('.mode-selection');
        if (modeSelection) {
            modeSelection.style.display = 'block';
        }
    }

    hideModeSelection() {
        const modeSelection = document.querySelector('.mode-selection');
        if (modeSelection) {
            modeSelection.style.display = 'none';
        }
    }

    handlePageHidden() {
        // Pause any ongoing processes when page is hidden
        if (this.appState.scanning && window.cameraManager) {
            window.cameraManager.stopLiveScan();
        }
    }

    handlePageVisible() {
        // Resume processes when page becomes visible
        if (this.appState.scanning && window.cameraManager) {
            // Don't auto-resume scanning for privacy reasons
            this.appState.scanning = false;
        }
    }

    handleBeforeUnload() {
        // Clean up resources before page unload
        if (window.cameraManager) {
            window.cameraManager.stopLiveScan();
        }
        
        // Save any pending data
        this.saveAppState();
    }

    saveAppState() {
        const appState = {
            currentMode: this.currentMode,
            appState: this.appState,
            timestamp: Date.now()
        };
        
        Utils.setStorage('appState', appState);
    }

    loadAppState() {
        const savedState = Utils.getStorage('appState');
        if (savedState) {
            this.currentMode = savedState.currentMode;
            this.appState = savedState.appState;
        }
    }

    // Public methods for external control
    getCurrentMode() {
        return this.currentMode;
    }

    getAppState() {
        return this.appState;
    }

    isAppReady() {
        return this.isInitialized;
    }

    // Utility methods
    resetApp() {
        this.currentMode = null;
        this.appState = {
            scanning: false,
            uploading: false,
            generating: false,
            completed: false
        };
        
        // Clear stored data
        Utils.removeStorage('scanData');
        Utils.removeStorage('uploadData');
        Utils.removeStorage('avatarData');
        
        // Show mode selection
        this.showModeSelection();
        
        // Hide all interfaces
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
    }

    // Error handling
    handleError(error, context = '') {
        console.error(`Error in ${context}:`, error);
        
        // Show user-friendly error message
        const userMessage = this.getUserFriendlyError(error);
        Utils.showNotification(userMessage, 'error');
        
        // Log error for debugging
        this.logError(error, context);
    }

    getUserFriendlyError(error) {
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
        
        if (error.message.includes('face detection')) {
            return 'Face detection failed. Please try again with better lighting.';
        }
        
        if (error.message.includes('avatar generation')) {
            return 'Avatar generation failed. Please try again.';
        }
        
        return 'An unexpected error occurred. Please try again.';
    }

    logError(error, context) {
        const errorLog = {
            message: error.message,
            stack: error.stack,
            context: context,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        // Store in local storage
        const errorLogs = Utils.getStorage('errorLogs', []);
        errorLogs.push(errorLog);
        Utils.setStorage('errorLogs', errorLogs);
        
        // Send to backend in production
        this.sendErrorLog(errorLog);
    }

    async sendErrorLog(errorLog) {
        try {
            await Utils.apiCall('/api/error-logs', {
                method: 'POST',
                body: JSON.stringify(errorLog)
            });
        } catch (error) {
            console.error('Failed to send error log:', error);
        }
    }

    // Performance monitoring
    startPerformanceMonitoring() {
        // Monitor page load performance
        window.addEventListener('load', () => {
            const perfData = performance.getEntriesByType('navigation')[0];
            console.log('Page load time:', perfData.loadEventEnd - perfData.loadEventStart);
        });
        
        // Monitor memory usage
        if (performance.memory) {
            setInterval(() => {
                const memory = performance.memory;
                console.log('Memory usage:', {
                    used: Math.round(memory.usedJSHeapSize / 1048576) + ' MB',
                    total: Math.round(memory.totalJSHeapSize / 1048576) + ' MB',
                    limit: Math.round(memory.jsHeapSizeLimit / 1048576) + ' MB'
                });
            }, 30000); // Every 30 seconds
        }
    }
}

// Initialize the main application
document.addEventListener('DOMContentLoaded', () => {
    window.saceApp = new SaceApp();
    
    // Start performance monitoring
    window.saceApp.startPerformanceMonitoring();
});

// Export for use in other modules
window.SaceApp = SaceApp;
