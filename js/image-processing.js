// Image upload and processing functionality

class ImageProcessor {
    constructor() {
        this.uploadedImages = new Map();
        this.requiredAngles = ['front', 'left', 'right'];
        this.optionalAngles = ['back'];
        this.faceDetector = null;
        this.isProcessing = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeFaceDetection();
    }

    initializeElements() {
        this.uploadZones = document.querySelectorAll('.upload-zone');
        this.uploadInputs = document.querySelectorAll('.upload-input');
        this.processBtn = document.getElementById('processImages');
        this.uploadError = document.getElementById('uploadError');
    }

    setupEventListeners() {
        // Upload mode button
        const startUploadBtn = document.getElementById('startUpload');
        if (startUploadBtn) {
            startUploadBtn.addEventListener('click', () => this.showUploadInterface());
        }

        // Back to modes button
        const backToModesBtn = document.getElementById('backToModes');
        if (backToModesBtn) {
            backToModesBtn.addEventListener('click', () => this.hideUploadInterface());
        }

        // Process images button
        if (this.processBtn) {
            this.processBtn.addEventListener('click', () => this.processUploadedImages());
        }

        // File input listeners
        this.uploadInputs.forEach(input => {
            input.addEventListener('change', (e) => this.handleFileUpload(e));
        });

        // Drag and drop listeners
        this.uploadZones.forEach(zone => {
            zone.addEventListener('dragover', (e) => this.handleDragOver(e));
            zone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            zone.addEventListener('drop', (e) => this.handleDrop(e));
            zone.addEventListener('click', () => this.triggerFileInput(zone));
        });
    }

    async initializeFaceDetection() {
        try {
            await tf.ready();
            
            // Load face detection model for image processing
            this.faceDetector = await faceLandmarksDetection.createDetector(
                faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
                {
                    runtime: 'tfjs',
                    refineLandmarks: true,
                    maxFaces: 1
                }
            );
            
            console.log('Image processing face detection model loaded');
            
        } catch (error) {
            console.error('Failed to load face detection for image processing:', error);
        }
    }

    showUploadInterface() {
        // Hide mode selection
        const modeSelection = document.querySelector('.mode-selection');
        if (modeSelection) {
            modeSelection.style.display = 'none';
        }
        
        // Show upload interface
        const uploadInterface = document.getElementById('uploadInterface');
        if (uploadInterface) {
            uploadInterface.style.display = 'block';
        }
        
        Utils.showNotification('Upload interface ready. Please upload your images.', 'info');
    }

    hideUploadInterface() {
        // Show mode selection
        const modeSelection = document.querySelector('.mode-selection');
        if (modeSelection) {
            modeSelection.style.display = 'block';
        }
        
        // Hide upload interface
        const uploadInterface = document.getElementById('uploadInterface');
        if (uploadInterface) {
            uploadInterface.style.display = 'none';
        }
        
        // Reset upload state
        this.resetUploadState();
    }

    triggerFileInput(zone) {
        const input = zone.querySelector('.upload-input');
        if (input) {
            input.click();
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        const angle = e.currentTarget.dataset.angle;
        
        if (files.length > 0) {
            this.processFile(files[0], angle);
        }
    }

    handleFileUpload(e) {
        const file = e.target.files[0];
        const angle = e.target.dataset.angle;
        
        if (file) {
            this.processFile(file, angle);
        }
    }

    async processFile(file, angle) {
        try {
            // Validate file
            const validation = Utils.validateImageFile(file);
            if (!validation.valid) {
                this.showUploadError(validation.error);
                return;
            }

            // Show processing status
            this.setUploadStatus(angle, 'processing', 'Processing image...');

            // Compress image for better performance
            const compressedFile = await Utils.compressImage(file, 800, 0.8);
            
            // Create image element
            const image = await Utils.createImageFromFile(compressedFile);
            
            // Detect face and validate angle
            const faceData = await this.detectFaceInImage(image);
            
            if (!faceData) {
                this.setUploadStatus(angle, 'error', 'No face detected');
                this.showUploadError('No face detected in the uploaded image. Please upload a clear image with a visible face.');
                return;
            }

            // Validate face angle
            const angleValidation = this.validateFaceAngle(faceData, angle);
            if (!angleValidation.valid) {
                this.setUploadStatus(angle, 'error', angleValidation.error);
                this.showUploadError(angleValidation.error);
                return;
            }

            // Store image data
            this.uploadedImages.set(angle, {
                file: compressedFile,
                image: image,
                faceData: faceData,
                dataUrl: await Utils.readFileAsDataURL(compressedFile),
                timestamp: Date.now()
            });

            // Update UI
            this.setUploadStatus(angle, 'success', 'Image uploaded successfully');
            this.showImagePreview(angle, image);
            this.updateProcessButton();

            Utils.showNotification(`${angle} image uploaded successfully!`, 'success');

        } catch (error) {
            console.error('Error processing file:', error);
            this.setUploadStatus(angle, 'error', 'Upload failed');
            this.showUploadError('Failed to process the uploaded image. Please try again.');
        }
    }

    async detectFaceInImage(image) {
        if (!this.faceDetector) {
            throw new Error('Face detector not initialized');
        }

        try {
            // Create a temporary canvas to draw the image
            const canvas = Utils.createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            // Detect faces
            const faces = await this.faceDetector.estimateFaces(canvas, {
                flipHorizontal: false,
                predictIrises: true
            });

            if (faces.length === 0) {
                return null;
            }

            // Return the first (and should be only) face
            const face = faces[0];
            return {
                boundingBox: face.boundingBox,
                keypoints: face.keypoints,
                faceInViewConfidence: face.faceInViewConfidence,
                landmarks: face.landmarks
            };

        } catch (error) {
            console.error('Face detection error:', error);
            return null;
        }
    }

    validateFaceAngle(faceData, expectedAngle) {
        const landmarks = faceData.keypoints;
        if (!landmarks || landmarks.length < 10) {
            return { valid: false, error: 'Insufficient facial landmarks detected' };
        }

        // Calculate face orientation based on key landmarks
        const orientation = this.calculateFaceOrientation(landmarks);
        
        switch (expectedAngle) {
            case 'front':
                if (orientation.yaw > 30 || orientation.yaw < -30) {
                    return { 
                        valid: false, 
                        error: 'This image appears to be a side view. Please upload a clear front-facing image.' 
                    };
                }
                if (orientation.pitch > 20 || orientation.pitch < -20) {
                    return { 
                        valid: false, 
                        error: 'This image appears to be tilted. Please upload a straight front-facing image.' 
                    };
                }
                break;

            case 'left':
                if (orientation.yaw > -10) {
                    return { 
                        valid: false, 
                        error: 'This image is not a left profile. Please upload a clear left side view.' 
                    };
                }
                break;

            case 'right':
                if (orientation.yaw < 10) {
                    return { 
                        valid: false, 
                        error: 'This image is not a right profile. Please upload a clear right side view.' 
                    };
                }
                break;

            case 'back':
                // Back view validation is more lenient
                if (Math.abs(orientation.yaw) < 60) {
                    return { 
                        valid: false, 
                        error: 'This image does not appear to be a back view. Please upload a clear back-facing image.' 
                    };
                }
                break;
        }

        return { valid: true };
    }

    calculateFaceOrientation(landmarks) {
        // Use key facial landmarks to determine orientation
        // This is a simplified calculation - in production, you'd use more sophisticated methods
        
        const leftEye = landmarks.find(l => l.name === 'leftEye') || landmarks[33];
        const rightEye = landmarks.find(l => l.name === 'rightEye') || landmarks[362];
        const nose = landmarks.find(l => l.name === 'noseTip') || landmarks[1];
        const leftEar = landmarks.find(l => l.name === 'leftEar') || landmarks[234];
        const rightEar = landmarks.find(l => l.name === 'rightEar') || landmarks[454];

        if (!leftEye || !rightEye || !nose) {
            return { yaw: 0, pitch: 0, roll: 0 };
        }

        // Calculate yaw (left-right rotation)
        const eyeDistance = Math.abs(rightEye.x - leftEye.x);
        const noseOffset = nose.x - (leftEye.x + rightEye.x) / 2;
        const yaw = (noseOffset / eyeDistance) * 90;

        // Calculate pitch (up-down rotation)
        const eyeCenterY = (leftEye.y + rightEye.y) / 2;
        const pitch = (nose.y - eyeCenterY) / eyeDistance * 90;

        // Calculate roll (tilt)
        const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180 / Math.PI;

        return { yaw, pitch, roll };
    }

    setUploadStatus(angle, status, message) {
        const zone = document.querySelector(`[data-angle="${angle}"]`);
        if (!zone) return;

        const statusElement = zone.querySelector('.upload-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `upload-status ${status}`;
        }

        // Update zone appearance
        zone.className = `upload-zone ${status}`;
    }

    showImagePreview(angle, image) {
        const zone = document.querySelector(`[data-angle="${angle}"]`);
        if (!zone) return;

        const preview = zone.querySelector('.upload-preview');
        if (preview) {
            preview.style.display = 'block';
            preview.innerHTML = `<img src="${image.src}" alt="${angle} preview">`;
        }

        // Hide placeholder
        const placeholder = zone.querySelector('.upload-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
    }

    updateProcessButton() {
        const hasRequiredImages = this.requiredAngles.every(angle => this.uploadedImages.has(angle));
        
        if (this.processBtn) {
            this.processBtn.disabled = !hasRequiredImages;
            
            if (hasRequiredImages) {
                this.processBtn.textContent = 'Process Images';
                this.processBtn.classList.remove('btn-secondary');
                this.processBtn.classList.add('btn-primary');
            } else {
                const missingAngles = this.requiredAngles.filter(angle => !this.uploadedImages.has(angle));
                this.processBtn.textContent = `Upload ${missingAngles.join(', ')} images`;
                this.processBtn.classList.remove('btn-primary');
                this.processBtn.classList.add('btn-secondary');
            }
        }
    }

    showUploadError(message) {
        if (this.uploadError) {
            this.uploadError.textContent = message;
            this.uploadError.style.display = 'block';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                this.uploadError.style.display = 'none';
            }, 5000);
        }
    }

    async processUploadedImages() {
        if (this.isProcessing) return;

        try {
            this.isProcessing = true;
            this.processBtn.disabled = true;
            this.processBtn.textContent = 'Processing...';

            // Validate all required images are present
            const missingAngles = this.requiredAngles.filter(angle => !this.uploadedImages.has(angle));
            if (missingAngles.length > 0) {
                throw new Error(`Missing required images: ${missingAngles.join(', ')}`);
            }

            // Prepare image data for processing
            const imageData = {
                front: this.uploadedImages.get('front'),
                left: this.uploadedImages.get('left'),
                right: this.uploadedImages.get('right'),
                back: this.uploadedImages.get('back') || null
            };

            // Store processed data
            Utils.setStorage('uploadData', {
                images: imageData,
                timestamp: Date.now(),
                method: 'image_upload'
            });

            // Hide upload interface
            this.hideUploadInterface();

            // Show generation interface
            const generationInterface = document.getElementById('generationInterface');
            if (generationInterface) {
                generationInterface.style.display = 'block';
            }

            // Start avatar generation
            if (window.avatarGenerator) {
                window.avatarGenerator.generateFromUploadData();
            }

            Utils.showNotification('Images processed successfully! Generating avatar...', 'success');

        } catch (error) {
            console.error('Error processing images:', error);
            this.showUploadError('Failed to process images. Please try again.');
            Utils.showNotification('Failed to process images', 'error');
        } finally {
            this.isProcessing = false;
            this.updateProcessButton();
        }
    }

    resetUploadState() {
        // Clear uploaded images
        this.uploadedImages.clear();

        // Reset UI
        this.uploadZones.forEach(zone => {
            const angle = zone.dataset.angle;
            
            // Reset status
            this.setUploadStatus(angle, '', '');
            
            // Hide preview
            const preview = zone.querySelector('.upload-preview');
            if (preview) {
                preview.style.display = 'none';
                preview.innerHTML = '';
            }

            // Show placeholder
            const placeholder = zone.querySelector('.upload-placeholder');
            if (placeholder) {
                placeholder.style.display = 'flex';
            }

            // Reset file input
            const input = zone.querySelector('.upload-input');
            if (input) {
                input.value = '';
            }
        });

        // Reset process button
        this.updateProcessButton();

        // Hide error message
        if (this.uploadError) {
            this.uploadError.style.display = 'none';
        }
    }

    // Public methods
    getUploadedImages() {
        return this.uploadedImages;
    }

    hasRequiredImages() {
        return this.requiredAngles.every(angle => this.uploadedImages.has(angle));
    }

    getImageData() {
        const data = {};
        this.uploadedImages.forEach((imageData, angle) => {
            data[angle] = {
                dataUrl: imageData.dataUrl,
                faceData: imageData.faceData,
                timestamp: imageData.timestamp
            };
        });
        return data;
    }
}

// Initialize image processor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.imageProcessor = new ImageProcessor();
});

// Export for use in other modules
window.ImageProcessor = ImageProcessor;
