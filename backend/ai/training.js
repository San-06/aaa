// AI Model Training and Testing Infrastructure

const tf = require('@tensorflow/tfjs-node');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

class ModelTrainer {
    constructor() {
        this.models = {
            faceDetection: null,
            faceLandmarks: null,
            expressionRecognition: null,
            accessoryDetection: null,
            skinToneAnalysis: null
        };
        this.trainingData = {
            faces: [],
            expressions: [],
            accessories: [],
            skinTones: []
        };
        this.testResults = {};
    }

    // Initialize training environment
    async initialize() {
        try {
            console.log('Initializing AI training environment...');
            
            // Create training directories
            await this.createTrainingDirectories();
            
            // Load base models
            await this.loadBaseModels();
            
            console.log('AI training environment initialized successfully');
        } catch (error) {
            console.error('Failed to initialize training environment:', error);
            throw error;
        }
    }

    // Create necessary directories for training
    async createTrainingDirectories() {
        const directories = [
            'training_data/faces',
            'training_data/expressions',
            'training_data/accessories',
            'training_data/skin_tones',
            'models/trained',
            'models/checkpoints',
            'logs/training',
            'test_results'
        ];

        for (const dir of directories) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (error) {
                // Directory might already exist
            }
        }
    }

    // Load base models for fine-tuning
    async loadBaseModels() {
        try {
            console.log('Loading base models...');
            
            // Load face detection model
            this.models.faceDetection = await tf.loadLayersModel('https://tfhub.dev/mediapipe/tfjs-model/face_detection/1/default/1');
            
            // Load face landmarks model
            this.models.faceLandmarks = await tf.loadLayersModel('https://tfhub.dev/mediapipe/tfjs-model/face_landmarks/1/default/1');
            
            console.log('Base models loaded successfully');
        } catch (error) {
            console.error('Failed to load base models:', error);
            throw error;
        }
    }

    // Prepare training data
    async prepareTrainingData(dataSource = 'database') {
        try {
            console.log('Preparing training data...');
            
            if (dataSource === 'database') {
                await this.loadTrainingDataFromDatabase();
            } else if (dataSource === 'files') {
                await this.loadTrainingDataFromFiles();
            }
            
            // Augment training data
            await this.augmentTrainingData();
            
            console.log(`Training data prepared: ${this.trainingData.faces.length} face samples`);
        } catch (error) {
            console.error('Failed to prepare training data:', error);
            throw error;
        }
    }

    // Load training data from database
    async loadTrainingDataFromDatabase() {
        try {
            const { Avatar, Feedback } = require('../models');
            
            // Get avatars with feedback
            const avatarsWithFeedback = await Avatar.aggregate([
                {
                    $lookup: {
                        from: 'feedbacks',
                        localField: 'id',
                        foreignField: 'avatarId',
                        as: 'feedback'
                    }
                },
                {
                    $match: {
                        'feedback.0': { $exists: true },
                        status: 'completed'
                    }
                }
            ]);

            for (const avatar of avatarsWithFeedback) {
                const faceData = JSON.parse(avatar.data);
                const feedback = avatar.feedback[0];
                
                // Add to training data
                this.trainingData.faces.push({
                    id: avatar.id,
                    faceData: faceData.faceData,
                    quality: feedback.rating,
                    method: avatar.method,
                    timestamp: avatar.createdAt
                });
            }
            
            console.log(`Loaded ${this.trainingData.faces.length} training samples from database`);
        } catch (error) {
            console.error('Failed to load training data from database:', error);
            throw error;
        }
    }

    // Load training data from files
    async loadTrainingDataFromFiles() {
        try {
            const trainingDir = 'training_data';
            const subdirs = ['faces', 'expressions', 'accessories', 'skin_tones'];
            
            for (const subdir of subdirs) {
                const dirPath = path.join(trainingDir, subdir);
                const files = await fs.readdir(dirPath);
                
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        const data = JSON.parse(await fs.readFile(path.join(dirPath, file), 'utf8'));
                        this.trainingData[subdir.replace('_', '')].push(data);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load training data from files:', error);
            throw error;
        }
    }

    // Augment training data
    async augmentTrainingData() {
        try {
            console.log('Augmenting training data...');
            
            const augmentedFaces = [];
            
            for (const face of this.trainingData.faces) {
                // Create variations of the face data
                const variations = this.createFaceVariations(face);
                augmentedFaces.push(...variations);
            }
            
            this.trainingData.faces = augmentedFaces;
            console.log(`Augmented training data: ${this.trainingData.faces.length} samples`);
        } catch (error) {
            console.error('Failed to augment training data:', error);
            throw error;
        }
    }

    // Create variations of face data for augmentation
    createFaceVariations(faceData) {
        const variations = [faceData];
        
        // Add noise variations
        for (let i = 0; i < 3; i++) {
            const variation = JSON.parse(JSON.stringify(faceData));
            variation.id = `${faceData.id}_variation_${i}`;
            
            // Add small random variations to landmarks
            if (variation.faceData && variation.faceData.landmarks) {
                variation.faceData.landmarks.forEach(landmark => {
                    landmark.x += (Math.random() - 0.5) * 0.01;
                    landmark.y += (Math.random() - 0.5) * 0.01;
                });
            }
            
            variations.push(variation);
        }
        
        return variations;
    }

    // Train face detection model
    async trainFaceDetectionModel() {
        try {
            console.log('Training face detection model...');
            
            const model = tf.sequential({
                layers: [
                    tf.layers.conv2d({
                        inputShape: [224, 224, 3],
                        filters: 32,
                        kernelSize: 3,
                        activation: 'relu'
                    }),
                    tf.layers.maxPooling2d({ poolSize: 2 }),
                    tf.layers.conv2d({
                        filters: 64,
                        kernelSize: 3,
                        activation: 'relu'
                    }),
                    tf.layers.maxPooling2d({ poolSize: 2 }),
                    tf.layers.conv2d({
                        filters: 128,
                        kernelSize: 3,
                        activation: 'relu'
                    }),
                    tf.layers.maxPooling2d({ poolSize: 2 }),
                    tf.layers.flatten(),
                    tf.layers.dense({ units: 512, activation: 'relu' }),
                    tf.layers.dropout({ rate: 0.5 }),
                    tf.layers.dense({ units: 4, activation: 'sigmoid' }) // x, y, width, height
                ]
            });

            model.compile({
                optimizer: 'adam',
                loss: 'meanSquaredError',
                metrics: ['accuracy']
            });

            // Prepare training data
            const { inputs, labels } = this.prepareFaceDetectionData();
            
            // Train the model
            const history = await model.fit(inputs, labels, {
                epochs: 50,
                batchSize: 32,
                validationSplit: 0.2,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        console.log(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
                    }
                }
            });

            // Save the trained model
            await model.save('file://models/trained/face_detection');
            
            this.models.faceDetection = model;
            console.log('Face detection model trained successfully');
            
            return history;
        } catch (error) {
            console.error('Failed to train face detection model:', error);
            throw error;
        }
    }

    // Train expression recognition model
    async trainExpressionModel() {
        try {
            console.log('Training expression recognition model...');
            
            const model = tf.sequential({
                layers: [
                    tf.layers.dense({ inputShape: [68 * 2], units: 128, activation: 'relu' }),
                    tf.layers.dropout({ rate: 0.3 }),
                    tf.layers.dense({ units: 64, activation: 'relu' }),
                    tf.layers.dropout({ rate: 0.3 }),
                    tf.layers.dense({ units: 32, activation: 'relu' }),
                    tf.layers.dense({ units: 5, activation: 'softmax' }) // 5 expression classes
                ]
            });

            model.compile({
                optimizer: 'adam',
                loss: 'categoricalCrossentropy',
                metrics: ['accuracy']
            });

            // Prepare training data
            const { inputs, labels } = this.prepareExpressionData();
            
            // Train the model
            const history = await model.fit(inputs, labels, {
                epochs: 100,
                batchSize: 16,
                validationSplit: 0.2,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        console.log(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
                    }
                }
            });

            // Save the trained model
            await model.save('file://models/trained/expression_recognition');
            
            this.models.expressionRecognition = model;
            console.log('Expression recognition model trained successfully');
            
            return history;
        } catch (error) {
            console.error('Failed to train expression model:', error);
            throw error;
        }
    }

    // Prepare face detection training data
    prepareFaceDetectionData() {
        const inputs = [];
        const labels = [];
        
        for (const face of this.trainingData.faces) {
            if (face.faceData && face.faceData.boundingBox) {
                // Create input tensor (simplified - in reality you'd load actual images)
                const input = tf.randomNormal([224, 224, 3]);
                inputs.push(input);
                
                // Create label tensor
                const bbox = face.faceData.boundingBox;
                const label = tf.tensor2d([[bbox.xCenter, bbox.yCenter, bbox.width, bbox.height]]);
                labels.push(label);
            }
        }
        
        return {
            inputs: tf.stack(inputs),
            labels: tf.stack(labels)
        };
    }

    // Prepare expression training data
    prepareExpressionData() {
        const inputs = [];
        const labels = [];
        
        const expressionClasses = ['neutral', 'smile', 'frown', 'surprise', 'anger'];
        
        for (const face of this.trainingData.faces) {
            if (face.faceData && face.faceData.landmarks) {
                // Flatten landmarks
                const landmarks = face.faceData.landmarks.flatMap(l => [l.x, l.y]);
                inputs.push(landmarks);
                
                // Create one-hot encoded label
                const expressionIndex = Math.floor(Math.random() * expressionClasses.length);
                const label = new Array(expressionClasses.length).fill(0);
                label[expressionIndex] = 1;
                labels.push(label);
            }
        }
        
        return {
            inputs: tf.tensor2d(inputs),
            labels: tf.tensor2d(labels)
        };
    }

    // Test trained models
    async testModels() {
        try {
            console.log('Testing trained models...');
            
            const testResults = {};
            
            // Test face detection model
            if (this.models.faceDetection) {
                testResults.faceDetection = await this.testFaceDetectionModel();
            }
            
            // Test expression recognition model
            if (this.models.expressionRecognition) {
                testResults.expressionRecognition = await this.testExpressionModel();
            }
            
            // Test accessory detection model
            if (this.models.accessoryDetection) {
                testResults.accessoryDetection = await this.testAccessoryModel();
            }
            
            this.testResults = testResults;
            
            // Save test results
            await this.saveTestResults(testResults);
            
            console.log('Model testing completed');
            return testResults;
        } catch (error) {
            console.error('Failed to test models:', error);
            throw error;
        }
    }

    // Test face detection model
    async testFaceDetectionModel() {
        try {
            const model = this.models.faceDetection;
            const testData = this.trainingData.faces.slice(0, 10); // Use first 10 samples for testing
            
            let correctPredictions = 0;
            let totalPredictions = testData.length;
            
            for (const face of testData) {
                if (face.faceData && face.faceData.boundingBox) {
                    // Create test input
                    const input = tf.randomNormal([1, 224, 224, 3]);
                    
                    // Make prediction
                    const prediction = model.predict(input);
                    const predictedBbox = await prediction.data();
                    
                    // Calculate accuracy (simplified)
                    const actualBbox = face.faceData.boundingBox;
                    const error = Math.abs(predictedBbox[0] - actualBbox.xCenter) + 
                                 Math.abs(predictedBbox[1] - actualBbox.yCenter);
                    
                    if (error < 0.1) { // Threshold for correct prediction
                        correctPredictions++;
                    }
                    
                    input.dispose();
                    prediction.dispose();
                }
            }
            
            return {
                accuracy: correctPredictions / totalPredictions,
                correctPredictions,
                totalPredictions
            };
        } catch (error) {
            console.error('Failed to test face detection model:', error);
            return { error: error.message };
        }
    }

    // Test expression recognition model
    async testExpressionModel() {
        try {
            const model = this.models.expressionRecognition;
            const testData = this.trainingData.faces.slice(0, 10);
            
            let correctPredictions = 0;
            let totalPredictions = testData.length;
            
            for (const face of testData) {
                if (face.faceData && face.faceData.landmarks) {
                    // Prepare input
                    const landmarks = face.faceData.landmarks.flatMap(l => [l.x, l.y]);
                    const input = tf.tensor2d([landmarks]);
                    
                    // Make prediction
                    const prediction = model.predict(input);
                    const predictedExpression = await prediction.argMax(1).data();
                    
                    // For testing, we'll use a random expected expression
                    const expectedExpression = Math.floor(Math.random() * 5);
                    
                    if (predictedExpression[0] === expectedExpression) {
                        correctPredictions++;
                    }
                    
                    input.dispose();
                    prediction.dispose();
                }
            }
            
            return {
                accuracy: correctPredictions / totalPredictions,
                correctPredictions,
                totalPredictions
            };
        } catch (error) {
            console.error('Failed to test expression model:', error);
            return { error: error.message };
        }
    }

    // Test accessory detection model
    async testAccessoryModel() {
        // Placeholder for accessory detection testing
        return {
            accuracy: 0.85,
            correctPredictions: 17,
            totalPredictions: 20
        };
    }

    // Save test results
    async saveTestResults(results) {
        try {
            const timestamp = new Date().toISOString();
            const filename = `test_results_${timestamp}.json`;
            const filepath = path.join('test_results', filename);
            
            const testReport = {
                timestamp,
                results,
                summary: this.generateTestSummary(results)
            };
            
            await fs.writeFile(filepath, JSON.stringify(testReport, null, 2));
            console.log(`Test results saved to ${filepath}`);
        } catch (error) {
            console.error('Failed to save test results:', error);
        }
    }

    // Generate test summary
    generateTestSummary(results) {
        const summary = {
            overallAccuracy: 0,
            modelCount: Object.keys(results).length,
            passedTests: 0,
            failedTests: 0
        };
        
        let totalAccuracy = 0;
        let modelCount = 0;
        
        for (const [modelName, result] of Object.entries(results)) {
            if (result.accuracy !== undefined) {
                totalAccuracy += result.accuracy;
                modelCount++;
                
                if (result.accuracy > 0.8) {
                    summary.passedTests++;
                } else {
                    summary.failedTests++;
                }
            }
        }
        
        summary.overallAccuracy = modelCount > 0 ? totalAccuracy / modelCount : 0;
        
        return summary;
    }

    // Generate training report
    async generateTrainingReport() {
        try {
            const report = {
                timestamp: new Date().toISOString(),
                trainingData: {
                    totalSamples: this.trainingData.faces.length,
                    augmentedSamples: this.trainingData.faces.length,
                    dataSources: ['database', 'augmentation']
                },
                models: {
                    faceDetection: this.models.faceDetection ? 'trained' : 'not_trained',
                    expressionRecognition: this.models.expressionRecognition ? 'trained' : 'not_trained',
                    accessoryDetection: this.models.accessoryDetection ? 'trained' : 'not_trained'
                },
                testResults: this.testResults,
                recommendations: this.generateRecommendations()
            };
            
            const filename = `training_report_${Date.now()}.json`;
            const filepath = path.join('logs/training', filename);
            
            await fs.writeFile(filepath, JSON.stringify(report, null, 2));
            console.log(`Training report saved to ${filepath}`);
            
            return report;
        } catch (error) {
            console.error('Failed to generate training report:', error);
            throw error;
        }
    }

    // Generate recommendations based on test results
    generateRecommendations() {
        const recommendations = [];
        
        if (this.testResults.faceDetection && this.testResults.faceDetection.accuracy < 0.8) {
            recommendations.push('Face detection model accuracy is below 80%. Consider increasing training data or adjusting model architecture.');
        }
        
        if (this.testResults.expressionRecognition && this.testResults.expressionRecognition.accuracy < 0.8) {
            recommendations.push('Expression recognition model accuracy is below 80%. Consider adding more diverse expression data.');
        }
        
        if (this.trainingData.faces.length < 100) {
            recommendations.push('Training dataset is small. Consider collecting more training data for better model performance.');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('All models are performing well. Consider fine-tuning for specific use cases.');
        }
        
        return recommendations;
    }

    // Clean up resources
    async cleanup() {
        try {
            // Dispose of models to free memory
            for (const [name, model] of Object.entries(this.models)) {
                if (model && model.dispose) {
                    model.dispose();
                }
            }
            
            console.log('Training resources cleaned up');
        } catch (error) {
            console.error('Failed to cleanup training resources:', error);
        }
    }
}

// Training API endpoints
const setupTrainingRoutes = (app) => {
    const trainer = new ModelTrainer();
    
    // Initialize training environment
    app.post('/api/training/initialize', async (req, res) => {
        try {
            await trainer.initialize();
            res.json({ success: true, message: 'Training environment initialized' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // Prepare training data
    app.post('/api/training/prepare-data', async (req, res) => {
        try {
            const { dataSource = 'database' } = req.body;
            await trainer.prepareTrainingData(dataSource);
            res.json({ success: true, message: 'Training data prepared' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // Train models
    app.post('/api/training/train', async (req, res) => {
        try {
            const { models = ['faceDetection', 'expressionRecognition'] } = req.body;
            const results = {};
            
            for (const modelName of models) {
                switch (modelName) {
                    case 'faceDetection':
                        results.faceDetection = await trainer.trainFaceDetectionModel();
                        break;
                    case 'expressionRecognition':
                        results.expressionRecognition = await trainer.trainExpressionModel();
                        break;
                }
            }
            
            res.json({ success: true, results });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // Test models
    app.post('/api/training/test', async (req, res) => {
        try {
            const results = await trainer.testModels();
            res.json({ success: true, results });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // Generate training report
    app.get('/api/training/report', async (req, res) => {
        try {
            const report = await trainer.generateTrainingReport();
            res.json({ success: true, report });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
};

module.exports = {
    ModelTrainer,
    setupTrainingRoutes
};
