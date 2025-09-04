// Real Face Mesh Detection using MediaPipe

class FaceMeshDetector {
    constructor() {
        this.model = null;
        this.isInitialized = false;
        this.faceMeshConfig = {
            runtime: 'tfjs',
            refineLandmarks: true,
            maxFaces: 1,
            flipHorizontal: false,
            predictIrises: true
        };
    }

    async initialize() {
        try {
            console.log('Initializing Face Mesh Detector...');
            
            // Load MediaPipe Face Mesh model
            this.model = await faceLandmarksDetection.createDetector(
                faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
                this.faceMeshConfig
            );
            
            this.isInitialized = true;
            console.log('Face Mesh Detector initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Face Mesh Detector:', error);
            throw error;
        }
    }

    async detectFaceMesh(imageElement) {
        if (!this.isInitialized) {
            throw new Error('Face Mesh Detector not initialized');
        }

        try {
            // Detect face mesh
            const faces = await this.model.estimateFaces(imageElement, {
                flipHorizontal: false,
                predictIrises: true
            });

            if (faces.length === 0) {
                return null;
            }

            const face = faces[0];
            
            // Extract detailed face mesh data
            const faceMeshData = this.extractFaceMeshData(face);
            
            return faceMeshData;
            
        } catch (error) {
            console.error('Face mesh detection error:', error);
            throw error;
        }
    }

    extractFaceMeshData(face) {
        const landmarks = face.keypoints;
        const boundingBox = face.boundingBox;
        
        // MediaPipe Face Mesh has 468 3D landmarks
        const faceMesh = {
            landmarks: landmarks.map(landmark => ({
                x: landmark.x,
                y: landmark.y,
                z: landmark.z || 0, // Add z-coordinate if not present
                name: landmark.name || null
            })),
            boundingBox: {
                xCenter: boundingBox.xCenter,
                yCenter: boundingBox.yCenter,
                width: boundingBox.width,
                height: boundingBox.height
            },
            faceInViewConfidence: face.faceInViewConfidence,
            // Extract specific facial features
            facialFeatures: this.extractFacialFeatures(landmarks),
            // Calculate face orientation
            orientation: this.calculateFaceOrientation(landmarks)
        };

        return faceMesh;
    }

    extractFacialFeatures(landmarks) {
        // Define key facial feature indices (MediaPipe Face Mesh)
        const featureIndices = {
            // Face contour (jawline)
            faceContour: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
            
            // Left eyebrow
            leftEyebrow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
            
            // Right eyebrow
            rightEyebrow: [296, 334, 293, 300, 276, 283, 282, 295, 285, 336],
            
            // Left eye
            leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
            
            // Right eye
            rightEye: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
            
            // Nose
            nose: [1, 2, 5, 4, 6, 19, 20, 94, 125, 141, 235, 236, 3, 51, 48, 115, 131, 134, 102, 49, 220, 305, 281, 360, 279, 331, 294, 358, 327, 326, 2, 97, 98, 129, 358, 327, 326, 2, 97, 98, 129],
            
            // Mouth (outer)
            mouthOuter: [61, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318, 13, 82, 81, 80, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312],
            
            // Mouth (inner)
            mouthInner: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]
        };

        const features = {};
        
        for (const [featureName, indices] of Object.entries(featureIndices)) {
            features[featureName] = indices.map(index => {
                if (landmarks[index]) {
                    return {
                        x: landmarks[index].x,
                        y: landmarks[index].y,
                        z: landmarks[index].z || 0
                    };
                }
                return null;
            }).filter(point => point !== null);
        }

        return features;
    }

    calculateFaceOrientation(landmarks) {
        // Use key landmarks to calculate face orientation
        const leftEye = landmarks[33]; // Left eye center
        const rightEye = landmarks[362]; // Right eye center
        const nose = landmarks[1]; // Nose tip
        const leftEar = landmarks[234]; // Left ear
        const rightEar = landmarks[454]; // Right ear

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

    // Analyze facial expressions
    analyzeExpressions(landmarks) {
        const expressions = {
            smile: false,
            frown: false,
            raisedEyebrows: false,
            squint: false,
            surprise: false
        };

        // Analyze mouth for smile/frown
        const mouthCorners = [61, 291]; // Left and right mouth corners
        const mouthCenter = [13, 14]; // Upper and lower lip center
        
        if (mouthCorners.every(i => landmarks[i]) && mouthCenter.every(i => landmarks[i])) {
            const leftCorner = landmarks[61];
            const rightCorner = landmarks[291];
            const upperLip = landmarks[13];
            const lowerLip = landmarks[14];
            
            const mouthCenterY = (upperLip.y + lowerLip.y) / 2;
            const cornerY = (leftCorner.y + rightCorner.y) / 2;
            
            expressions.smile = cornerY < mouthCenterY - 0.01;
            expressions.frown = cornerY > mouthCenterY + 0.01;
        }

        // Analyze eyebrows
        const leftEyebrow = [70, 63, 105, 66, 107];
        const rightEyebrow = [296, 334, 293, 300, 276];
        const leftEye = [33, 7, 163, 144, 145];
        const rightEye = [362, 382, 381, 380, 374];

        if (leftEyebrow.every(i => landmarks[i]) && leftEye.every(i => landmarks[i])) {
            const eyebrowY = leftEyebrow.reduce((sum, i) => sum + landmarks[i].y, 0) / leftEyebrow.length;
            const eyeY = leftEye.reduce((sum, i) => sum + landmarks[i].y, 0) / leftEye.length;
            
            expressions.raisedEyebrows = eyebrowY < eyeY - 0.02;
        }

        // Analyze eye openness for squint
        if (leftEye.every(i => landmarks[i])) {
            const eyeHeight = Math.max(...leftEye.map(i => landmarks[i].y)) - Math.min(...leftEye.map(i => landmarks[i].y));
            expressions.squint = eyeHeight < 0.02;
        }

        return expressions;
    }

    // Extract skin tone from face region
    extractSkinTone(imageElement, landmarks) {
        try {
            // Create canvas to extract face region
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = imageElement.width;
            canvas.height = imageElement.height;
            
            ctx.drawImage(imageElement, 0, 0);
            
            // Get face bounding box
            const bbox = this.getFaceBoundingBox(landmarks);
            
            // Extract skin tone from cheek regions
            const cheekRegions = [
                { x: bbox.x + bbox.width * 0.2, y: bbox.y + bbox.height * 0.4 },
                { x: bbox.x + bbox.width * 0.8, y: bbox.y + bbox.height * 0.4 }
            ];
            
            const skinColors = [];
            
            cheekRegions.forEach(region => {
                const imageData = ctx.getImageData(region.x, region.y, 10, 10);
                const data = imageData.data;
                
                let r = 0, g = 0, b = 0;
                for (let i = 0; i < data.length; i += 4) {
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                }
                
                const pixelCount = data.length / 4;
                skinColors.push({
                    r: Math.round(r / pixelCount),
                    g: Math.round(g / pixelCount),
                    b: Math.round(b / pixelCount)
                });
            });
            
            // Average skin tone
            const avgSkinTone = {
                r: Math.round(skinColors.reduce((sum, color) => sum + color.r, 0) / skinColors.length),
                g: Math.round(skinColors.reduce((sum, color) => sum + color.g, 0) / skinColors.length),
                b: Math.round(skinColors.reduce((sum, color) => sum + color.b, 0) / skinColors.length)
            };
            
            return avgSkinTone;
            
        } catch (error) {
            console.error('Failed to extract skin tone:', error);
            return { r: 200, g: 150, b: 120 }; // Default skin tone
        }
    }

    getFaceBoundingBox(landmarks) {
        const xs = landmarks.map(l => l.x);
        const ys = landmarks.map(l => l.y);
        
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    // Detect accessories (glasses, earrings, etc.)
    detectAccessories(landmarks) {
        const accessories = {
            glasses: false,
            earrings: false,
            hat: false,
            mask: false
        };

        // Simple heuristic-based detection
        // In a real implementation, you'd use more sophisticated computer vision
        
        // Check for glasses by analyzing eye region
        const leftEye = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
        const rightEye = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
        
        // Check if there are many landmarks around the eyes (might indicate glasses)
        const eyeLandmarks = [...leftEye, ...rightEye].filter(i => landmarks[i]);
        accessories.glasses = eyeLandmarks.length > 20; // Heuristic threshold

        return accessories;
    }

    // Process multiple face angles
    async processMultipleAngles(images) {
        const results = {};
        
        for (const [angle, imageData] of Object.entries(images)) {
            if (imageData && imageData.image) {
                try {
                    const faceMesh = await this.detectFaceMesh(imageData.image);
                    if (faceMesh) {
                        results[angle] = {
                            faceMesh,
                            expressions: this.analyzeExpressions(faceMesh.landmarks),
                            skinTone: this.extractSkinTone(imageData.image, faceMesh.landmarks),
                            accessories: this.detectAccessories(faceMesh.landmarks),
                            orientation: faceMesh.orientation
                        };
                    }
                } catch (error) {
                    console.error(`Failed to process ${angle} image:`, error);
                }
            }
        }
        
        return results;
    }

    // Combine face data from multiple angles
    combineFaceData(multiAngleData) {
        const combined = {
            landmarks: {},
            expressions: {},
            skinTone: null,
            accessories: {},
            orientations: {}
        };

        // Combine data from all angles
        for (const [angle, data] of Object.entries(multiAngleData)) {
            if (data) {
                combined.landmarks[angle] = data.faceMesh.landmarks;
                combined.expressions[angle] = data.expressions;
                combined.accessories[angle] = data.accessories;
                combined.orientations[angle] = data.orientation;
                
                // Use the first available skin tone
                if (!combined.skinTone && data.skinTone) {
                    combined.skinTone = data.skinTone;
                }
            }
        }

        return combined;
    }

    isReady() {
        return this.isInitialized;
    }
}

// Export for use in other modules
window.FaceMeshDetector = FaceMeshDetector;
