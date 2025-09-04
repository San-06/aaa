// AI Model Evaluation and Testing Tools

const tf = require('@tensorflow/tfjs-node');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ModelEvaluator {
    constructor() {
        this.evaluationMetrics = {
            accuracy: 0,
            precision: 0,
            recall: 0,
            f1Score: 0,
            confusionMatrix: [],
            rocCurve: [],
            precisionRecallCurve: []
        };
        this.testData = [];
        this.model = null;
        this.evaluationResults = {};
    }

    // Load model for evaluation
    async loadModel(modelPath) {
        try {
            console.log(`Loading model from ${modelPath}...`);
            this.model = await tf.loadLayersModel(modelPath);
            console.log('Model loaded successfully');
        } catch (error) {
            console.error('Failed to load model:', error);
            throw error;
        }
    }

    // Load test dataset
    async loadTestDataset(datasetPath) {
        try {
            console.log(`Loading test dataset from ${datasetPath}...`);
            
            const testFiles = await fs.readdir(datasetPath);
            const testData = [];
            
            for (const file of testFiles) {
                if (file.endsWith('.json')) {
                    const data = JSON.parse(await fs.readFile(path.join(datasetPath, file), 'utf8'));
                    testData.push(data);
                }
            }
            
            this.testData = testData;
            console.log(`Loaded ${testData.length} test samples`);
        } catch (error) {
            console.error('Failed to load test dataset:', error);
            throw error;
        }
    }

    // Evaluate model performance
    async evaluateModel() {
        try {
            if (!this.model) {
                throw new Error('No model loaded');
            }
            
            if (this.testData.length === 0) {
                throw new Error('No test data loaded');
            }
            
            console.log('Starting model evaluation...');
            
            const predictions = [];
            const actuals = [];
            
            // Make predictions on test data
            for (const sample of this.testData) {
                const prediction = await this.makePrediction(sample);
                predictions.push(prediction);
                actuals.push(sample.label);
            }
            
            // Calculate evaluation metrics
            this.evaluationResults = await this.calculateMetrics(predictions, actuals);
            
            // Generate detailed analysis
            await this.generateDetailedAnalysis();
            
            console.log('Model evaluation completed');
            return this.evaluationResults;
        } catch (error) {
            console.error('Failed to evaluate model:', error);
            throw error;
        }
    }

    // Make prediction on a single sample
    async makePrediction(sample) {
        try {
            // Prepare input data
            const input = this.prepareInput(sample);
            
            // Make prediction
            const prediction = this.model.predict(input);
            const result = await prediction.data();
            
            // Clean up tensors
            input.dispose();
            prediction.dispose();
            
            return result;
        } catch (error) {
            console.error('Failed to make prediction:', error);
            throw error;
        }
    }

    // Prepare input data for model
    prepareInput(sample) {
        // This is a simplified version - in reality, you'd process the actual data
        if (sample.type === 'face_detection') {
            return tf.randomNormal([1, 224, 224, 3]);
        } else if (sample.type === 'expression_recognition') {
            return tf.tensor2d([sample.landmarks]);
        } else if (sample.type === 'accessory_detection') {
            return tf.randomNormal([1, 128, 128, 3]);
        }
        
        throw new Error(`Unknown sample type: ${sample.type}`);
    }

    // Calculate evaluation metrics
    async calculateMetrics(predictions, actuals) {
        try {
            const metrics = {
                accuracy: 0,
                precision: 0,
                recall: 0,
                f1Score: 0,
                confusionMatrix: [],
                classMetrics: {},
                overallMetrics: {}
            };
            
            // Calculate accuracy
            let correctPredictions = 0;
            for (let i = 0; i < predictions.length; i++) {
                if (this.isCorrectPrediction(predictions[i], actuals[i])) {
                    correctPredictions++;
                }
            }
            metrics.accuracy = correctPredictions / predictions.length;
            
            // Calculate confusion matrix
            metrics.confusionMatrix = this.calculateConfusionMatrix(predictions, actuals);
            
            // Calculate precision, recall, and F1 score
            const { precision, recall, f1Score } = this.calculatePrecisionRecallF1(metrics.confusionMatrix);
            metrics.precision = precision;
            metrics.recall = recall;
            metrics.f1Score = f1Score;
            
            // Calculate per-class metrics
            metrics.classMetrics = this.calculatePerClassMetrics(metrics.confusionMatrix);
            
            return metrics;
        } catch (error) {
            console.error('Failed to calculate metrics:', error);
            throw error;
        }
    }

    // Check if prediction is correct
    isCorrectPrediction(prediction, actual) {
        if (Array.isArray(prediction)) {
            const predictedClass = prediction.indexOf(Math.max(...prediction));
            return predictedClass === actual;
        } else {
            // For regression tasks
            return Math.abs(prediction - actual) < 0.1;
        }
    }

    // Calculate confusion matrix
    calculateConfusionMatrix(predictions, actuals) {
        const numClasses = Math.max(...actuals) + 1;
        const matrix = Array(numClasses).fill().map(() => Array(numClasses).fill(0));
        
        for (let i = 0; i < predictions.length; i++) {
            const predictedClass = Array.isArray(predictions[i]) 
                ? predictions[i].indexOf(Math.max(...predictions[i]))
                : Math.round(predictions[i]);
            const actualClass = actuals[i];
            
            matrix[actualClass][predictedClass]++;
        }
        
        return matrix;
    }

    // Calculate precision, recall, and F1 score
    calculatePrecisionRecallF1(confusionMatrix) {
        const numClasses = confusionMatrix.length;
        let totalPrecision = 0;
        let totalRecall = 0;
        let totalF1 = 0;
        
        for (let i = 0; i < numClasses; i++) {
            const truePositives = confusionMatrix[i][i];
            const falsePositives = confusionMatrix.reduce((sum, row) => sum + row[i], 0) - truePositives;
            const falseNegatives = confusionMatrix[i].reduce((sum, val) => sum + val, 0) - truePositives;
            
            const precision = truePositives / (truePositives + falsePositives) || 0;
            const recall = truePositives / (truePositives + falseNegatives) || 0;
            const f1 = 2 * (precision * recall) / (precision + recall) || 0;
            
            totalPrecision += precision;
            totalRecall += recall;
            totalF1 += f1;
        }
        
        return {
            precision: totalPrecision / numClasses,
            recall: totalRecall / numClasses,
            f1Score: totalF1 / numClasses
        };
    }

    // Calculate per-class metrics
    calculatePerClassMetrics(confusionMatrix) {
        const numClasses = confusionMatrix.length;
        const classMetrics = {};
        
        for (let i = 0; i < numClasses; i++) {
            const truePositives = confusionMatrix[i][i];
            const falsePositives = confusionMatrix.reduce((sum, row) => sum + row[i], 0) - truePositives;
            const falseNegatives = confusionMatrix[i].reduce((sum, val) => sum + val, 0) - truePositives;
            
            const precision = truePositives / (truePositives + falsePositives) || 0;
            const recall = truePositives / (truePositives + falseNegatives) || 0;
            const f1 = 2 * (precision * recall) / (precision + recall) || 0;
            
            classMetrics[`class_${i}`] = {
                precision,
                recall,
                f1Score: f1,
                truePositives,
                falsePositives,
                falseNegatives
            };
        }
        
        return classMetrics;
    }

    // Generate detailed analysis
    async generateDetailedAnalysis() {
        try {
            const analysis = {
                timestamp: new Date().toISOString(),
                modelInfo: await this.getModelInfo(),
                evaluationResults: this.evaluationResults,
                recommendations: this.generateRecommendations(),
                performanceAnalysis: this.analyzePerformance(),
                errorAnalysis: this.analyzeErrors()
            };
            
            // Save analysis report
            const filename = `evaluation_report_${Date.now()}.json`;
            const filepath = path.join('test_results', filename);
            
            await fs.writeFile(filepath, JSON.stringify(analysis, null, 2));
            console.log(`Evaluation report saved to ${filepath}`);
            
            return analysis;
        } catch (error) {
            console.error('Failed to generate detailed analysis:', error);
            throw error;
        }
    }

    // Get model information
    async getModelInfo() {
        if (!this.model) {
            return { error: 'No model loaded' };
        }
        
        return {
            inputShape: this.model.inputs[0].shape,
            outputShape: this.model.outputs[0].shape,
            totalParams: this.model.countParams(),
            layers: this.model.layers.length,
            trainableParams: this.model.trainableParams.length
        };
    }

    // Generate recommendations based on evaluation results
    generateRecommendations() {
        const recommendations = [];
        
        if (this.evaluationResults.accuracy < 0.8) {
            recommendations.push('Model accuracy is below 80%. Consider increasing training data or adjusting model architecture.');
        }
        
        if (this.evaluationResults.precision < 0.7) {
            recommendations.push('Model precision is low. Consider addressing class imbalance or improving feature extraction.');
        }
        
        if (this.evaluationResults.recall < 0.7) {
            recommendations.push('Model recall is low. Consider reducing false negatives by adjusting decision thresholds.');
        }
        
        if (this.evaluationResults.f1Score < 0.75) {
            recommendations.push('F1 score is below 75%. Consider balancing precision and recall through hyperparameter tuning.');
        }
        
        // Check for class imbalance
        const confusionMatrix = this.evaluationResults.confusionMatrix;
        if (confusionMatrix.length > 0) {
            const classTotals = confusionMatrix.map(row => row.reduce((sum, val) => sum + val, 0));
            const maxClass = Math.max(...classTotals);
            const minClass = Math.min(...classTotals);
            
            if (maxClass / minClass > 3) {
                recommendations.push('Significant class imbalance detected. Consider using class weights or data augmentation.');
            }
        }
        
        if (recommendations.length === 0) {
            recommendations.push('Model performance is satisfactory. Consider fine-tuning for specific use cases.');
        }
        
        return recommendations;
    }

    // Analyze model performance
    analyzePerformance() {
        const analysis = {
            overallPerformance: 'good',
            strengths: [],
            weaknesses: [],
            improvementAreas: []
        };
        
        const accuracy = this.evaluationResults.accuracy;
        const precision = this.evaluationResults.precision;
        const recall = this.evaluationResults.recall;
        const f1Score = this.evaluationResults.f1Score;
        
        // Determine overall performance
        if (accuracy >= 0.9 && precision >= 0.85 && recall >= 0.85) {
            analysis.overallPerformance = 'excellent';
        } else if (accuracy >= 0.8 && precision >= 0.75 && recall >= 0.75) {
            analysis.overallPerformance = 'good';
        } else if (accuracy >= 0.7 && precision >= 0.65 && recall >= 0.65) {
            analysis.overallPerformance = 'fair';
        } else {
            analysis.overallPerformance = 'poor';
        }
        
        // Identify strengths
        if (accuracy >= 0.85) {
            analysis.strengths.push('High overall accuracy');
        }
        if (precision >= 0.8) {
            analysis.strengths.push('Good precision (low false positives)');
        }
        if (recall >= 0.8) {
            analysis.strengths.push('Good recall (low false negatives)');
        }
        if (f1Score >= 0.8) {
            analysis.strengths.push('Balanced precision and recall');
        }
        
        // Identify weaknesses
        if (accuracy < 0.8) {
            analysis.weaknesses.push('Low overall accuracy');
        }
        if (precision < 0.7) {
            analysis.weaknesses.push('Low precision (high false positives)');
        }
        if (recall < 0.7) {
            analysis.weaknesses.push('Low recall (high false negatives)');
        }
        if (f1Score < 0.7) {
            analysis.weaknesses.push('Imbalanced precision and recall');
        }
        
        // Identify improvement areas
        if (accuracy < 0.9) {
            analysis.improvementAreas.push('Increase training data diversity');
        }
        if (precision < 0.8) {
            analysis.improvementAreas.push('Improve feature extraction');
        }
        if (recall < 0.8) {
            analysis.improvementAreas.push('Adjust decision thresholds');
        }
        
        return analysis;
    }

    // Analyze prediction errors
    analyzeErrors() {
        const errorAnalysis = {
            commonErrors: [],
            errorPatterns: [],
            suggestions: []
        };
        
        // Analyze confusion matrix for common errors
        const confusionMatrix = this.evaluationResults.confusionMatrix;
        if (confusionMatrix.length > 0) {
            for (let i = 0; i < confusionMatrix.length; i++) {
                for (let j = 0; j < confusionMatrix[i].length; j++) {
                    if (i !== j && confusionMatrix[i][j] > 0) {
                        errorAnalysis.commonErrors.push({
                            actualClass: i,
                            predictedClass: j,
                            count: confusionMatrix[i][j],
                            percentage: (confusionMatrix[i][j] / confusionMatrix[i].reduce((sum, val) => sum + val, 0)) * 100
                        });
                    }
                }
            }
        }
        
        // Sort by frequency
        errorAnalysis.commonErrors.sort((a, b) => b.count - a.count);
        
        // Generate suggestions based on common errors
        if (errorAnalysis.commonErrors.length > 0) {
            const mostCommonError = errorAnalysis.commonErrors[0];
            errorAnalysis.suggestions.push(
                `Most common error: Class ${mostCommonError.actualClass} predicted as Class ${mostCommonError.predictedClass} (${mostCommonError.percentage.toFixed(1)}%)`
            );
        }
        
        return errorAnalysis;
    }

    // Cross-validation evaluation
    async crossValidate(k = 5) {
        try {
            console.log(`Starting ${k}-fold cross-validation...`);
            
            const foldSize = Math.floor(this.testData.length / k);
            const cvResults = [];
            
            for (let fold = 0; fold < k; fold++) {
                console.log(`Processing fold ${fold + 1}/${k}...`);
                
                const startIdx = fold * foldSize;
                const endIdx = fold === k - 1 ? this.testData.length : (fold + 1) * foldSize;
                
                const testFold = this.testData.slice(startIdx, endIdx);
                const trainFold = [
                    ...this.testData.slice(0, startIdx),
                    ...this.testData.slice(endIdx)
                ];
                
                // Temporarily replace test data
                const originalTestData = this.testData;
                this.testData = testFold;
                
                // Evaluate on this fold
                const foldResults = await this.evaluateModel();
                cvResults.push(foldResults);
                
                // Restore original test data
                this.testData = originalTestData;
            }
            
            // Calculate average results
            const avgResults = this.calculateAverageResults(cvResults);
            
            console.log('Cross-validation completed');
            return {
                foldResults: cvResults,
                averageResults: avgResults,
                standardDeviation: this.calculateStandardDeviation(cvResults)
            };
        } catch (error) {
            console.error('Failed to perform cross-validation:', error);
            throw error;
        }
    }

    // Calculate average results across folds
    calculateAverageResults(cvResults) {
        const numFolds = cvResults.length;
        const avgResults = {
            accuracy: 0,
            precision: 0,
            recall: 0,
            f1Score: 0
        };
        
        for (const result of cvResults) {
            avgResults.accuracy += result.accuracy;
            avgResults.precision += result.precision;
            avgResults.recall += result.recall;
            avgResults.f1Score += result.f1Score;
        }
        
        avgResults.accuracy /= numFolds;
        avgResults.precision /= numFolds;
        avgResults.recall /= numFolds;
        avgResults.f1Score /= numFolds;
        
        return avgResults;
    }

    // Calculate standard deviation
    calculateStandardDeviation(cvResults) {
        const avgResults = this.calculateAverageResults(cvResults);
        const numFolds = cvResults.length;
        
        const variance = {
            accuracy: 0,
            precision: 0,
            recall: 0,
            f1Score: 0
        };
        
        for (const result of cvResults) {
            variance.accuracy += Math.pow(result.accuracy - avgResults.accuracy, 2);
            variance.precision += Math.pow(result.precision - avgResults.precision, 2);
            variance.recall += Math.pow(result.recall - avgResults.recall, 2);
            variance.f1Score += Math.pow(result.f1Score - avgResults.f1Score, 2);
        }
        
        return {
            accuracy: Math.sqrt(variance.accuracy / numFolds),
            precision: Math.sqrt(variance.precision / numFolds),
            recall: Math.sqrt(variance.recall / numFolds),
            f1Score: Math.sqrt(variance.f1Score / numFolds)
        };
    }

    // Clean up resources
    async cleanup() {
        try {
            if (this.model && this.model.dispose) {
                this.model.dispose();
            }
            console.log('Evaluation resources cleaned up');
        } catch (error) {
            console.error('Failed to cleanup evaluation resources:', error);
        }
    }
}

// Evaluation API endpoints
const setupEvaluationRoutes = (app) => {
    const evaluator = new ModelEvaluator();
    
    // Load model for evaluation
    app.post('/api/evaluation/load-model', async (req, res) => {
        try {
            const { modelPath } = req.body;
            await evaluator.loadModel(modelPath);
            res.json({ success: true, message: 'Model loaded successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // Load test dataset
    app.post('/api/evaluation/load-dataset', async (req, res) => {
        try {
            const { datasetPath } = req.body;
            await evaluator.loadTestDataset(datasetPath);
            res.json({ success: true, message: 'Test dataset loaded successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // Evaluate model
    app.post('/api/evaluation/evaluate', async (req, res) => {
        try {
            const results = await evaluator.evaluateModel();
            res.json({ success: true, results });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // Cross-validation
    app.post('/api/evaluation/cross-validate', async (req, res) => {
        try {
            const { k = 5 } = req.body;
            const results = await evaluator.crossValidate(k);
            res.json({ success: true, results });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // Get evaluation report
    app.get('/api/evaluation/report', async (req, res) => {
        try {
            const report = await evaluator.generateDetailedAnalysis();
            res.json({ success: true, report });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
};

module.exports = {
    ModelEvaluator,
    setupEvaluationRoutes
};
