// Camera management and live scanning functionality

class CameraManager {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.stream = null;
        this.isScanning = false;
        this.scanInterval = null;
        this.faceDetector = null;
        this.detectedFaces = new Map();
        this.scanProgress = 0;
        this.scanZones = [];
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.video = document.getElementById('cameraFeed');
        this.canvas = document.getElementById('scanningCanvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
        }
    }

    setupEventListeners() {
        // Start live scan button
        const startScanBtn = document.getElementById('startLiveScan');
        if (startScanBtn) {
            startScanBtn.addEventListener('click', () => this.startLiveScan());
        }

        // Stop scan button
        const stopScanBtn = document.getElementById('stopScan');
        if (stopScanBtn) {
            stopScanBtn.addEventListener('click', () => this.stopLiveScan());
        }

        // Camera feed events
        if (this.video) {
            this.video.addEventListener('loadedmetadata', () => this.onVideoLoaded());
            this.video.addEventListener('error', (e) => this.handleCameraError(e));
        }
    }

    async startLiveScan() {
        try {
            Utils.showNotification('Starting camera...', 'info');
            
            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: false
            });

            // Set video source
            this.video.srcObject = this.stream;
            
            // Show scanning interface
            this.showScanningInterface();
            
            // Initialize face detection
            await this.initializeFaceDetection();
            
            // Start scanning process
            this.startScanningProcess();
            
            Utils.showNotification('Camera started successfully!', 'success');
            
        } catch (error) {
            Utils.handleError(error, 'Camera initialization');
        }
    }

    async initializeFaceDetection() {
        try {
            // Load TensorFlow.js models
            await tf.ready();
            
            // Load face detection model
            this.faceDetector = await faceLandmarksDetection.createDetector(
                faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
                {
                    runtime: 'tfjs',
                    refineLandmarks: true,
                    maxFaces: 10
                }
            );
            
            console.log('Face detection model loaded successfully');
            
        } catch (error) {
            console.error('Failed to load face detection model:', error);
            Utils.showNotification('Face detection model failed to load', 'error');
        }
    }

    onVideoLoaded() {
        if (this.video && this.canvas) {
            // Set canvas size to match video
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            // Initialize scan zones
            this.initializeScanZones();
        }
    }

    initializeScanZones() {
        this.scanZones = [
            {
                id: 'center',
                x: this.canvas.width / 2 - 100,
                y: this.canvas.height / 2 - 100,
                width: 200,
                height: 200,
                active: true,
                confidence: 0
            }
        ];
    }

    startScanningProcess() {
        this.isScanning = true;
        this.scanProgress = 0;
        
        // Start face detection loop
        this.scanInterval = setInterval(() => {
            this.detectFaces();
            this.updateScanProgress();
            this.drawScanningOverlay();
        }, 100); // 10 FPS for performance
        
        // Update UI
        this.updateScanStatus('Scanning for faces...');
    }

    async detectFaces() {
        if (!this.faceDetector || !this.video || !this.ctx) return;

        try {
            // Detect faces in current frame
            const faces = await this.faceDetector.estimateFaces(this.video, {
                flipHorizontal: false,
                predictIrises: true
            });

            // Process detected faces
            this.processDetectedFaces(faces);
            
        } catch (error) {
            console.error('Face detection error:', error);
        }
    }

    processDetectedFaces(faces) {
        const currentTime = Date.now();
        const newFaces = new Map();

        faces.forEach((face, index) => {
            const faceId = `face_${index}`;
            const boundingBox = face.boundingBox;
            
            // Calculate face center and size
            const centerX = boundingBox.xCenter * this.canvas.width;
            const centerY = boundingBox.yCenter * this.canvas.height;
            const width = boundingBox.width * this.canvas.width;
            const height = boundingBox.height * this.canvas.height;
            
            // Check if face is in scan zone
            const inScanZone = this.isFaceInScanZone(centerX, centerY, width, height);
            
            if (inScanZone) {
                const faceData = {
                    id: faceId,
                    centerX,
                    centerY,
                    width,
                    height,
                    confidence: face.faceInViewConfidence || 0.8,
                    landmarks: face.keypoints,
                    timestamp: currentTime,
                    quality: this.calculateFaceQuality(face)
                };

                newFaces.set(faceId, faceData);
                
                // Update existing face or add new one
                if (this.detectedFaces.has(faceId)) {
                    const existingFace = this.detectedFaces.get(faceId);
                    existingFace.confidence = Math.max(existingFace.confidence, faceData.confidence);
                    existingFace.quality = Math.max(existingFace.quality, faceData.quality);
                    existingFace.timestamp = currentTime;
                } else {
                    this.detectedFaces.set(faceId, faceData);
                    this.onNewFaceDetected(faceData);
                }
            }
        });

        // Remove faces that are no longer detected
        for (const [faceId, faceData] of this.detectedFaces) {
            if (!newFaces.has(faceId) || currentTime - faceData.timestamp > 1000) {
                this.detectedFaces.delete(faceId);
                this.onFaceLost(faceId);
            }
        }
    }

    isFaceInScanZone(centerX, centerY, width, height) {
        return this.scanZones.some(zone => {
            return centerX >= zone.x && 
                   centerX <= zone.x + zone.width &&
                   centerY >= zone.y && 
                   centerY <= zone.y + zone.height;
        });
    }

    calculateFaceQuality(face) {
        let quality = 0;
        
        // Check face size (larger faces are generally better quality)
        const faceSize = face.boundingBox.width * face.boundingBox.height;
        if (faceSize > 0.1) quality += 0.3;
        else if (faceSize > 0.05) quality += 0.2;
        else quality += 0.1;
        
        // Check face confidence
        if (face.faceInViewConfidence) {
            quality += face.faceInViewConfidence * 0.4;
        }
        
        // Check if key landmarks are present
        if (face.keypoints && face.keypoints.length > 0) {
            quality += 0.3;
        }
        
        return Math.min(quality, 1.0);
    }

    onNewFaceDetected(faceData) {
        console.log('New face detected:', faceData);
        
        // Update UI to show detected face
        this.updateDetectedFacesUI();
        
        // Check if face quality is sufficient for avatar generation
        if (faceData.quality > 0.7 && faceData.confidence > 0.8) {
            this.onHighQualityFaceDetected(faceData);
        }
    }

    onFaceLost(faceId) {
        console.log('Face lost:', faceId);
        this.updateDetectedFacesUI();
    }

    onHighQualityFaceDetected(faceData) {
        // This face is good enough for avatar generation
        Utils.showNotification('High quality face detected! Ready for avatar generation.', 'success');
        
        // Update scan progress
        this.scanProgress = Math.min(this.scanProgress + 20, 100);
        
        // If we have enough data, we can proceed to avatar generation
        if (this.scanProgress >= 100) {
            this.completeScanning(faceData);
        }
    }

    updateDetectedFacesUI() {
        const container = document.getElementById('detectedFaces');
        if (!container) return;

        container.innerHTML = '';
        
        this.detectedFaces.forEach((faceData, faceId) => {
            const faceCard = this.createFaceCard(faceData);
            container.appendChild(faceCard);
        });
    }

    createFaceCard(faceData) {
        const card = Utils.createElement('div', 'face-card');
        
        // Create face preview (cropped from video)
        const preview = Utils.createElement('img', 'face-preview');
        preview.src = this.captureFaceImage(faceData);
        
        // Face info
        const info = Utils.createElement('div', 'face-info');
        info.innerHTML = `
            <div>Confidence: ${Math.round(faceData.confidence * 100)}%</div>
            <div>Quality: ${Math.round(faceData.quality * 100)}%</div>
            <div>Status: ${faceData.quality > 0.7 ? 'Ready' : 'Scanning...'}</div>
        `;
        
        card.appendChild(preview);
        card.appendChild(info);
        
        return card;
    }

    captureFaceImage(faceData) {
        // Create a temporary canvas to crop the face
        const tempCanvas = Utils.createCanvas(faceData.width, faceData.height);
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw the face region from the video
        tempCtx.drawImage(
            this.video,
            faceData.centerX - faceData.width / 2,
            faceData.centerY - faceData.height / 2,
            faceData.width,
            faceData.height,
            0,
            0,
            faceData.width,
            faceData.height
        );
        
        return tempCanvas.toDataURL('image/jpeg', 0.8);
    }

    drawScanningOverlay() {
        if (!this.ctx || !this.isScanning) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw scan zones
        this.scanZones.forEach(zone => {
            this.drawScanZone(zone);
        });
        
        // Draw detected faces
        this.detectedFaces.forEach(faceData => {
            this.drawFaceOverlay(faceData);
        });
        
        // Draw heatmap
        this.drawHeatmap();
    }

    drawScanZone(zone) {
        this.ctx.strokeStyle = zone.active ? '#667eea' : '#ccc';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        
        this.ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
        
        // Draw zone label
        this.ctx.fillStyle = zone.active ? '#667eea' : '#ccc';
        this.ctx.font = '16px Inter, sans-serif';
        this.ctx.fillText('Scan Zone', zone.x, zone.y - 10);
    }

    drawFaceOverlay(faceData) {
        const x = faceData.centerX - faceData.width / 2;
        const y = faceData.centerY - faceData.height / 2;
        
        // Choose color based on quality
        let color = '#ff0000'; // Red for low quality
        if (faceData.quality > 0.7) color = '#00ff00'; // Green for high quality
        else if (faceData.quality > 0.4) color = '#ffaa00'; // Orange for medium quality
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([]);
        this.ctx.strokeRect(x, y, faceData.width, faceData.height);
        
        // Draw confidence indicator
        this.ctx.fillStyle = color;
        this.ctx.font = '12px Inter, sans-serif';
        this.ctx.fillText(
            `${Math.round(faceData.confidence * 100)}%`,
            x,
            y - 5
        );
    }

    drawHeatmap() {
        // Create a simple heatmap effect based on face detection activity
        this.detectedFaces.forEach(faceData => {
            const gradient = this.ctx.createRadialGradient(
                faceData.centerX,
                faceData.centerY,
                0,
                faceData.centerX,
                faceData.centerY,
                faceData.width
            );
            
            gradient.addColorStop(0, `rgba(255, 0, 0, ${faceData.quality * 0.3})`);
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        });
    }

    updateScanProgress() {
        const progressElement = document.getElementById('scanProgress');
        if (progressElement) {
            progressElement.style.width = `${this.scanProgress}%`;
        }
    }

    updateScanStatus(message) {
        const statusElement = document.getElementById('scanStatus');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    completeScanning(bestFaceData) {
        this.stopLiveScan();
        
        // Store the best face data for avatar generation
        Utils.setStorage('scanData', {
            faceData: bestFaceData,
            timestamp: Date.now(),
            method: 'live_scan'
        });
        
        // Proceed to avatar generation
        this.proceedToAvatarGeneration();
    }

    proceedToAvatarGeneration() {
        // Hide scanning interface
        const scanningInterface = document.getElementById('scanningInterface');
        if (scanningInterface) {
            scanningInterface.style.display = 'none';
        }
        
        // Show generation interface
        const generationInterface = document.getElementById('generationInterface');
        if (generationInterface) {
            generationInterface.style.display = 'block';
        }
        
        // Start avatar generation process
        if (window.avatarGenerator) {
            window.avatarGenerator.generateFromScanData();
        }
    }

    showScanningInterface() {
        // Hide mode selection
        const modeSelection = document.querySelector('.mode-selection');
        if (modeSelection) {
            modeSelection.style.display = 'none';
        }
        
        // Show scanning interface
        const scanningInterface = document.getElementById('scanningInterface');
        if (scanningInterface) {
            scanningInterface.style.display = 'block';
        }
    }

    stopLiveScan() {
        this.isScanning = false;
        
        // Clear scanning interval
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
        
        // Stop camera stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        // Clear video source
        if (this.video) {
            this.video.srcObject = null;
        }
        
        // Clear canvas
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Reset state
        this.detectedFaces.clear();
        this.scanProgress = 0;
        
        // Update UI
        this.updateScanStatus('Scanning stopped');
        this.updateDetectedFacesUI();
        
        Utils.showNotification('Live scanning stopped', 'info');
    }

    handleCameraError(error) {
        console.error('Camera error:', error);
        Utils.handleError(error, 'Camera access');
        this.stopLiveScan();
    }

    // Public methods for external control
    isActive() {
        return this.isScanning;
    }

    getDetectedFaces() {
        return Array.from(this.detectedFaces.values());
    }

    getBestFace() {
        let bestFace = null;
        let bestScore = 0;
        
        this.detectedFaces.forEach(faceData => {
            const score = faceData.confidence * faceData.quality;
            if (score > bestScore) {
                bestScore = score;
                bestFace = faceData;
            }
        });
        
        return bestFace;
    }
}

// Initialize camera manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.cameraManager = new CameraManager();
});

// Export for use in other modules
window.CameraManager = CameraManager;
