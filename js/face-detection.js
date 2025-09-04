// Advanced face detection and analysis functionality

class FaceDetector {
    constructor() {
        this.models = {
            faceMesh: null,
            blazeface: null,
            faceLandmarks: null
        };
        this.isInitialized = false;
        this.detectionConfig = {
            runtime: 'tfjs',
            refineLandmarks: true,
            maxFaces: 10,
            flipHorizontal: false,
            predictIrises: true
        };
        
        this.initializeModels();
    }

    async initializeModels() {
        try {
            await tf.ready();
            
            // Load multiple models for comprehensive face detection
            await Promise.all([
                this.loadFaceMeshModel(),
                this.loadBlazeFaceModel(),
                this.loadFaceLandmarksModel()
            ]);
            
            this.isInitialized = true;
            console.log('All face detection models loaded successfully');
            
        } catch (error) {
            console.error('Failed to initialize face detection models:', error);
            throw error;
        }
    }

    async loadFaceMeshModel() {
        try {
            this.models.faceMesh = await faceLandmarksDetection.createDetector(
                faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
                this.detectionConfig
            );
            console.log('Face mesh model loaded');
        } catch (error) {
            console.error('Failed to load face mesh model:', error);
        }
    }

    async loadBlazeFaceModel() {
        try {
            this.models.blazeface = await blazeface.load();
            console.log('BlazeFace model loaded');
        } catch (error) {
            console.error('Failed to load BlazeFace model:', error);
        }
    }

    async loadFaceLandmarksModel() {
        try {
            this.models.faceLandmarks = await faceLandmarksDetection.createDetector(
                faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
                {
                    ...this.detectionConfig,
                    refineLandmarks: true
                }
            );
            console.log('Face landmarks model loaded');
        } catch (error) {
            console.error('Failed to load face landmarks model:', error);
        }
    }

    async detectFaces(imageElement) {
        if (!this.isInitialized) {
            throw new Error('Face detector not initialized');
        }

        try {
            const results = await Promise.allSettled([
                this.detectWithFaceMesh(imageElement),
                this.detectWithBlazeFace(imageElement),
                this.detectWithLandmarks(imageElement)
            ]);

            // Combine and validate results
            const faceMeshResults = results[0].status === 'fulfilled' ? results[0].value : [];
            const blazefaceResults = results[1].status === 'fulfilled' ? results[1].value : [];
            const landmarksResults = results[2].status === 'fulfilled' ? results[2].value : [];

            return this.combineDetectionResults(faceMeshResults, blazefaceResults, landmarksResults);

        } catch (error) {
            console.error('Face detection error:', error);
            return [];
        }
    }

    async detectWithFaceMesh(imageElement) {
        if (!this.models.faceMesh) return [];
        
        try {
            const faces = await this.models.faceMesh.estimateFaces(imageElement, {
                flipHorizontal: false,
                predictIrises: true
            });
            
            return faces.map(face => ({
                ...face,
                detectionMethod: 'faceMesh',
                quality: this.calculateFaceQuality(face)
            }));
        } catch (error) {
            console.error('Face mesh detection error:', error);
            return [];
        }
    }

    async detectWithBlazeFace(imageElement) {
        if (!this.models.blazeface) return [];
        
        try {
            const predictions = await this.models.blazeface.estimateFaces(imageElement);
            
            return predictions.map(prediction => ({
                boundingBox: {
                    xCenter: prediction.topLeft[0] + prediction.bottomRight[0] / 2,
                    yCenter: prediction.topLeft[1] + prediction.bottomRight[1] / 2,
                    width: prediction.bottomRight[0] - prediction.topLeft[0],
                    height: prediction.bottomRight[1] - prediction.topLeft[1]
                },
                faceInViewConfidence: prediction.probability,
                detectionMethod: 'blazeface',
                quality: prediction.probability
            }));
        } catch (error) {
            console.error('BlazeFace detection error:', error);
            return [];
        }
    }

    async detectWithLandmarks(imageElement) {
        if (!this.models.faceLandmarks) return [];
        
        try {
            const faces = await this.models.faceLandmarks.estimateFaces(imageElement, {
                flipHorizontal: false,
                refineLandmarks: true
            });
            
            return faces.map(face => ({
                ...face,
                detectionMethod: 'landmarks',
                quality: this.calculateFaceQuality(face)
            }));
        } catch (error) {
            console.error('Face landmarks detection error:', error);
            return [];
        }
    }

    combineDetectionResults(faceMeshResults, blazefaceResults, landmarksResults) {
        const combinedFaces = [];
        const processedFaces = new Set();

        // Prioritize face mesh results as they're most detailed
        faceMeshResults.forEach(face => {
            const faceId = this.generateFaceId(face);
            if (!processedFaces.has(faceId)) {
                combinedFaces.push({
                    ...face,
                    confidence: face.faceInViewConfidence || 0.8,
                    quality: this.calculateFaceQuality(face),
                    landmarks: face.keypoints || [],
                    boundingBox: face.boundingBox
                });
                processedFaces.add(faceId);
            }
        });

        // Add BlazeFace results for faces not detected by face mesh
        blazefaceResults.forEach(face => {
            const faceId = this.generateFaceId(face);
            if (!processedFaces.has(faceId)) {
                combinedFaces.push({
                    ...face,
                    confidence: face.faceInViewConfidence || 0.7,
                    quality: face.quality || 0.6,
                    landmarks: [],
                    boundingBox: face.boundingBox
                });
                processedFaces.add(faceId);
            }
        });

        // Add landmarks results for additional validation
        landmarksResults.forEach(face => {
            const faceId = this.generateFaceId(face);
            const existingFace = combinedFaces.find(f => this.generateFaceId(f) === faceId);
            if (existingFace && face.keypoints) {
                existingFace.landmarks = face.keypoints;
                existingFace.quality = Math.max(existingFace.quality, this.calculateFaceQuality(face));
            }
        });

        return combinedFaces;
    }

    generateFaceId(face) {
        const bbox = face.boundingBox;
        return `${Math.round(bbox.xCenter * 100)}_${Math.round(bbox.yCenter * 100)}_${Math.round(bbox.width * 100)}_${Math.round(bbox.height * 100)}`;
    }

    calculateFaceQuality(face) {
        let quality = 0;

        // Base quality from confidence
        if (face.faceInViewConfidence) {
            quality += face.faceInViewConfidence * 0.4;
        }

        // Face size factor
        if (face.boundingBox) {
            const faceSize = face.boundingBox.width * face.boundingBox.height;
            if (faceSize > 0.1) quality += 0.3;
            else if (faceSize > 0.05) quality += 0.2;
            else quality += 0.1;
        }

        // Landmarks quality
        if (face.keypoints && face.keypoints.length > 0) {
            quality += 0.3;
            
            // Check for key facial features
            const hasEyes = this.hasKeyLandmarks(face.keypoints, ['leftEye', 'rightEye']);
            const hasNose = this.hasKeyLandmarks(face.keypoints, ['noseTip']);
            const hasMouth = this.hasKeyLandmarks(face.keypoints, ['mouth']);
            
            if (hasEyes && hasNose && hasMouth) {
                quality += 0.1;
            }
        }

        return Math.min(quality, 1.0);
    }

    hasKeyLandmarks(landmarks, featureNames) {
        return featureNames.some(name => 
            landmarks.some(landmark => landmark.name === name)
        );
    }

    analyzeFaceFeatures(face) {
        const analysis = {
            expressions: this.analyzeExpressions(face),
            accessories: this.detectAccessories(face),
            skinTone: this.analyzeSkinTone(face),
            hairStyle: this.analyzeHairStyle(face),
            clothing: this.analyzeClothing(face),
            orientation: this.calculateFaceOrientation(face)
        };

        return analysis;
    }

    analyzeExpressions(face) {
        const expressions = {
            smile: false,
            frown: false,
            raisedEyebrows: false,
            squint: false,
            surprise: false
        };

        if (!face.keypoints || face.keypoints.length === 0) {
            return expressions;
        }

        // Analyze mouth landmarks for smile/frown
        const mouthLandmarks = face.keypoints.filter(l => 
            l.name && (l.name.includes('mouth') || l.name.includes('lip'))
        );

        if (mouthLandmarks.length >= 2) {
            const mouthCenter = mouthLandmarks.reduce((acc, l) => acc + l.y, 0) / mouthLandmarks.length;
            const mouthCorners = mouthLandmarks.filter(l => 
                l.name && (l.name.includes('corner') || l.name.includes('end'))
            );

            if (mouthCorners.length >= 2) {
                const cornerY = mouthCorners.reduce((acc, l) => acc + l.y, 0) / mouthCorners.length;
                expressions.smile = cornerY < mouthCenter - 0.01;
                expressions.frown = cornerY > mouthCenter + 0.01;
            }
        }

        // Analyze eyebrow landmarks
        const eyebrowLandmarks = face.keypoints.filter(l => 
            l.name && l.name.includes('eyebrow')
        );

        if (eyebrowLandmarks.length > 0) {
            const eyebrowY = eyebrowLandmarks.reduce((acc, l) => acc + l.y, 0) / eyebrowLandmarks.length;
            const eyeY = face.keypoints
                .filter(l => l.name && l.name.includes('eye'))
                .reduce((acc, l) => acc + l.y, 0) / face.keypoints.filter(l => l.name && l.name.includes('eye')).length;
            
            expressions.raisedEyebrows = eyebrowY < eyeY - 0.02;
        }

        // Analyze eye landmarks for squint
        const eyeLandmarks = face.keypoints.filter(l => 
            l.name && (l.name.includes('eye') || l.name.includes('iris'))
        );

        if (eyeLandmarks.length > 0) {
            const eyeHeight = Math.max(...eyeLandmarks.map(l => l.y)) - Math.min(...eyeLandmarks.map(l => l.y));
            expressions.squint = eyeHeight < 0.02;
        }

        return expressions;
    }

    detectAccessories(face) {
        const accessories = {
            glasses: false,
            earrings: false,
            hat: false,
            mask: false
        };

        // This is a simplified detection - in production, you'd use more sophisticated methods
        if (face.keypoints && face.keypoints.length > 0) {
            // Check for glasses by looking for landmarks around the eyes
            const eyeLandmarks = face.keypoints.filter(l => 
                l.name && l.name.includes('eye')
            );

            if (eyeLandmarks.length > 0) {
                // Simple heuristic: if there are many landmarks around the eyes, might be glasses
                accessories.glasses = eyeLandmarks.length > 10;
            }

            // Check for earrings by looking for landmarks around the ears
            const earLandmarks = face.keypoints.filter(l => 
                l.name && l.name.includes('ear')
            );

            if (earLandmarks.length > 0) {
                accessories.earrings = earLandmarks.length > 5;
            }
        }

        return accessories;
    }

    analyzeSkinTone(face) {
        // This would require image analysis of the face region
        // For now, return a placeholder
        return {
            tone: 'medium',
            confidence: 0.7,
            rgb: { r: 200, g: 150, b: 120 }
        };
    }

    analyzeHairStyle(face) {
        // This would require analysis of the head region
        // For now, return a placeholder
        return {
            style: 'short',
            color: 'brown',
            confidence: 0.6
        };
    }

    analyzeClothing(face) {
        // This would require analysis of the body region
        // For now, return a placeholder
        return {
            type: 'casual',
            color: 'blue',
            confidence: 0.5
        };
    }

    calculateFaceOrientation(face) {
        if (!face.keypoints || face.keypoints.length === 0) {
            return { yaw: 0, pitch: 0, roll: 0 };
        }

        const leftEye = face.keypoints.find(l => l.name === 'leftEye');
        const rightEye = face.keypoints.find(l => l.name === 'rightEye');
        const nose = face.keypoints.find(l => l.name === 'noseTip');

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

    detectPets(imageElement) {
        // This would require a pet detection model
        // For now, return empty array
        return [];
    }

    isPet(face) {
        // Simple heuristic to distinguish pets from humans
        // In production, you'd use a trained classifier
        if (!face.keypoints || face.keypoints.length === 0) {
            return false;
        }

        // Check for human-specific landmarks
        const humanLandmarks = ['leftEye', 'rightEye', 'noseTip', 'mouth'];
        const hasHumanFeatures = humanLandmarks.some(landmarkName =>
            face.keypoints.some(landmark => landmark.name === landmarkName)
        );

        return !hasHumanFeatures;
    }

    // Public methods
    isReady() {
        return this.isInitialized;
    }

    async detectFacesInImage(imageElement) {
        return await this.detectFaces(imageElement);
    }

    async detectFacesInVideo(videoElement) {
        return await this.detectFaces(videoElement);
    }

    getModelInfo() {
        return {
            faceMesh: !!this.models.faceMesh,
            blazeface: !!this.models.blazeface,
            faceLandmarks: !!this.models.faceLandmarks,
            initialized: this.isInitialized
        };
    }
}

// Initialize face detector when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    window.faceDetector = new FaceDetector();
    
    // Wait for models to load
    try {
        await window.faceDetector.initializeModels();
        console.log('Face detector ready');
    } catch (error) {
        console.error('Failed to initialize face detector:', error);
    }
});

// Export for use in other modules
window.FaceDetector = FaceDetector;
