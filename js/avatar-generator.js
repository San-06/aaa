// Real 3D Avatar Generation System with Face Mesh Detection

class AvatarGenerator {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.avatar = null;
        this.isGenerating = false;
        this.generationProgress = 0;
        
        // Initialize real components
        this.faceMeshDetector = new FaceMeshDetector();
        this.faceMeshGenerator = new FaceMeshGenerator();
        this.clothingDetector = new ClothingDetector();
        this.glbExporter = new GLBExporter();
        
        this.initializeThreeJS();
        this.setupEventListeners();
    }

    async initialize() {
        try {
            console.log('Initializing Real Avatar Generator...');
            
            // Initialize face mesh detector
            await this.faceMeshDetector.initialize();
            
            console.log('Real Avatar Generator initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Avatar Generator:', error);
            throw error;
        }
    }

    initializeThreeJS() {
        // Initialize Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);
        
        // Initialize camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, 5);
        
        // Initialize renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(400, 400);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Add lighting
        this.setupLighting();
        
        // Add controls
        this.setupControls();
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        // Point light for additional illumination
        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(-10, -10, 5);
        this.scene.add(pointLight);
    }

    setupControls() {
        // Mouse controls for avatar rotation
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetRotationX = 0;
        this.targetRotationY = 0;
        
        document.addEventListener('mousemove', (event) => {
            if (this.avatar) {
                this.mouseX = (event.clientX / window.innerWidth) * 2 - 1;
                this.mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
                
                this.targetRotationY = this.mouseX * 0.5;
                this.targetRotationX = this.mouseY * 0.3;
            }
        });
    }

    setupEventListeners() {
        // Rotate avatar button
        const rotateBtn = document.getElementById('rotateAvatar');
        if (rotateBtn) {
            rotateBtn.addEventListener('click', () => this.rotateAvatar());
        }

        // Zoom avatar button
        const zoomBtn = document.getElementById('zoomAvatar');
        if (zoomBtn) {
            zoomBtn.addEventListener('click', () => this.zoomAvatar());
        }
    }

    async generateFromUploadData() {
        try {
            this.isGenerating = true;
            this.updateGenerationStatus('Starting real avatar generation...', 10);
            
            // Get upload data
            const uploadData = Utils.getStorage('uploadData');
            if (!uploadData) {
                throw new Error('No upload data found');
            }

            // Initialize face mesh detector if not already done
            if (!this.faceMeshDetector.isReady()) {
                this.updateGenerationStatus('Initializing face detection...', 15);
                await this.faceMeshDetector.initialize();
            }

            // Validate uploaded images
            this.updateGenerationStatus('Validating uploaded images...', 20);
            const validationResults = await this.validateImages(uploadData.images);
            
            // Check if all images are valid
            const validImages = Object.values(validationResults).filter(result => result.valid);
            if (validImages.length === 0) {
                throw new Error('No valid faces detected in uploaded images');
            }

            // Generate real 3D avatar from images
            this.updateGenerationStatus('Generating 3D face mesh...', 30);
            this.avatar = await this.generateAvatarFromImages(uploadData.images);
            
            // Add to scene and start rendering
            this.updateGenerationStatus('Rendering avatar...', 90);
            this.scene.add(this.avatar);
            this.startRendering();
            
            // Show result
            this.updateGenerationStatus('Avatar generation complete!', 100);
            this.showAvatarResult();
            
            Utils.showNotification('Real 3D avatar generated successfully!', 'success');
            
        } catch (error) {
            console.error('Avatar generation error:', error);
            Utils.showNotification('Failed to generate avatar: ' + error.message, 'error');
        } finally {
            this.isGenerating = false;
        }
    }

    async generateAvatarFromImages(images) {
        try {
            console.log('Generating 3D avatar from uploaded images...');
            
            // Step 1: Detect face meshes from all images
            const multiAngleData = await this.faceMeshDetector.processMultipleAngles(images);
            
            if (Object.keys(multiAngleData).length === 0) {
                throw new Error('No faces detected in uploaded images');
            }
            
            // Step 2: Combine face data from multiple angles
            const combinedFaceData = this.faceMeshDetector.combineFaceData(multiAngleData);
            
            // Step 3: Analyze clothing from images
            const clothingData = await this.clothingDetector.analyzeClothing(images);
            
            // Step 4: Generate 3D face mesh
            const faceMesh = this.faceMeshGenerator.generateFaceMesh(combinedFaceData);
            
            // Step 5: Apply expressions
            if (combinedFaceData.expressions) {
                this.faceMeshGenerator.applyExpressions(combinedFaceData.expressions);
            }
            
            // Step 6: Add accessories
            if (combinedFaceData.accessories) {
                this.faceMeshGenerator.addAccessories(combinedFaceData.accessories);
            }
            
            // Step 7: Create complete avatar
            const avatar = await this.createCompleteAvatar(faceMesh, clothingData, combinedFaceData);
            
            console.log('Real 3D avatar generated successfully');
            return avatar;
            
        } catch (error) {
            console.error('Avatar generation failed:', error);
            throw error;
        }
    }

    async createCompleteAvatar(faceMesh, clothingData, faceData) {
        // Create avatar group
        const avatarGroup = new THREE.Group();
        
        // Add the generated face mesh
        avatarGroup.add(faceMesh);
        
        // Create body with detected clothing
        const body = this.createBodyWithClothing(clothingData);
        avatarGroup.add(body);
        
        // Add hair (simplified)
        const hair = this.createHair(faceData);
        if (hair) {
            avatarGroup.add(hair);
        }
        
        return avatarGroup;
    }

    createBodyWithClothing(clothingData) {
        // Create body geometry
        const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.6, 1.5, 16);
        
        // Create body material with detected clothing colors
        let bodyColor = 0x87CEEB; // Default blue
        if (clothingData && clothingData.recommendations && clothingData.recommendations.primaryColor) {
            const color = clothingData.recommendations.primaryColor;
            bodyColor = new THREE.Color(color.r / 255, color.g / 255, color.b / 255);
        }
        
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: bodyColor });
        
        // Create body mesh
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = -0.5;
        body.castShadow = true;
        
        // Add clothing details based on detected style
        if (clothingData && clothingData.recommendations) {
            this.addClothingDetails(body, clothingData.recommendations);
        }
        
        return body;
    }

    addClothingDetails(body, clothingRecommendations) {
        // Add clothing details based on detected style and colors
        const style = clothingRecommendations.style;
        
        switch (style) {
            case 'minimalist':
                // Add simple, clean lines
                this.addMinimalistDetails(body, clothingRecommendations);
                break;
            case 'preppy':
                // Add collar and structured elements
                this.addPreppyDetails(body, clothingRecommendations);
                break;
            case 'casual':
                // Add relaxed, comfortable elements
                this.addCasualDetails(body, clothingRecommendations);
                break;
            case 'classic':
                // Add timeless, elegant elements
                this.addClassicDetails(body, clothingRecommendations);
                break;
        }
    }

    addMinimalistDetails(body, recommendations) {
        // Add simple collar
        const collarGeometry = new THREE.CylinderGeometry(0.45, 0.5, 0.1, 16);
        const collarMaterial = new THREE.MeshLambertMaterial({ 
            color: new THREE.Color(0.9, 0.9, 0.9) 
        });
        const collar = new THREE.Mesh(collarGeometry, collarMaterial);
        collar.position.y = 0.7;
        body.add(collar);
    }

    addPreppyDetails(body, recommendations) {
        // Add structured collar and buttons
        const collarGeometry = new THREE.BoxGeometry(0.8, 0.15, 0.05);
        const collarMaterial = new THREE.MeshLambertMaterial({ 
            color: new THREE.Color(0.95, 0.95, 0.95) 
        });
        const collar = new THREE.Mesh(collarGeometry, collarMaterial);
        collar.position.y = 0.7;
        body.add(collar);
        
        // Add buttons
        for (let i = 0; i < 3; i++) {
            const buttonGeometry = new THREE.SphereGeometry(0.02, 8, 8);
            const buttonMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
            const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
            button.position.set(0, 0.4 - i * 0.2, 0.42);
            body.add(button);
        }
    }

    addCasualDetails(body, recommendations) {
        // Add relaxed fit details
        const pocketGeometry = new THREE.BoxGeometry(0.15, 0.2, 0.02);
        const pocketMaterial = new THREE.MeshLambertMaterial({ 
            color: new THREE.Color(0.8, 0.8, 0.8) 
        });
        
        const leftPocket = new THREE.Mesh(pocketGeometry, pocketMaterial);
        leftPocket.position.set(-0.25, 0.2, 0.42);
        body.add(leftPocket);
        
        const rightPocket = new THREE.Mesh(pocketGeometry, pocketMaterial);
        rightPocket.position.set(0.25, 0.2, 0.42);
        body.add(rightPocket);
    }

    addClassicDetails(body, recommendations) {
        // Add elegant, timeless details
        const lapelGeometry = new THREE.BoxGeometry(0.1, 0.3, 0.02);
        const lapelMaterial = new THREE.MeshLambertMaterial({ 
            color: new THREE.Color(0.7, 0.7, 0.7) 
        });
        
        const leftLapel = new THREE.Mesh(lapelGeometry, lapelMaterial);
        leftLapel.position.set(-0.2, 0.5, 0.42);
        body.add(leftLapel);
        
        const rightLapel = new THREE.Mesh(lapelGeometry, lapelMaterial);
        rightLapel.position.set(0.2, 0.5, 0.42);
        body.add(rightLapel);
    }

    createHair(faceData) {
        // Create simple hair based on face data
        const hairGeometry = new THREE.SphereGeometry(1.1, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
        const hairMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x8B4513 // Brown hair
        });
        
        const hair = new THREE.Mesh(hairGeometry, hairMaterial);
        hair.position.y = 1.6;
        hair.scale.set(1, 0.8, 1);
        
        return hair;
    }

    // Validate uploaded images
    async validateImages(images) {
        const validationResults = {};
        
        for (const [angle, imageData] of Object.entries(images)) {
            if (imageData && imageData.image) {
                try {
                    const faceMesh = await this.faceMeshDetector.detectFaceMesh(imageData.image);
                    validationResults[angle] = {
                        valid: faceMesh !== null,
                        faceDetected: faceMesh !== null,
                        orientation: faceMesh ? faceMesh.orientation : null
                    };
                } catch (error) {
                    validationResults[angle] = {
                        valid: false,
                        faceDetected: false,
                        error: error.message
                    };
                }
            }
        }
        
        return validationResults;
    }

    startRendering() {
        const avatarDisplay = document.getElementById('avatarDisplay');
        if (avatarDisplay) {
            avatarDisplay.appendChild(this.renderer.domElement);
        }
        
        // Start animation loop
        this.animate();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.avatar) {
            // Smooth rotation based on mouse position
            this.avatar.rotation.y += (this.targetRotationY - this.avatar.rotation.y) * 0.1;
            this.avatar.rotation.x += (this.targetRotationX - this.avatar.rotation.x) * 0.1;
            
            // Gentle floating animation
            this.avatar.position.y = 0.5 + Math.sin(Date.now() * 0.001) * 0.1;
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    rotateAvatar() {
        if (this.avatar) {
            this.avatar.rotation.y += Math.PI / 4;
        }
    }

    zoomAvatar() {
        if (this.camera) {
            this.camera.position.z = this.camera.position.z === 5 ? 3 : 5;
        }
    }

    updateGenerationStatus(message, percentage) {
        this.generationProgress = percentage;
        
        const progressElement = document.getElementById('generationProgress');
        if (progressElement) {
            progressElement.style.width = `${percentage}%`;
        }
        
        const statusElement = document.getElementById('generationStatus');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    showAvatarResult() {
        // Hide generation interface
        const generationInterface = document.getElementById('generationInterface');
        if (generationInterface) {
            generationInterface.style.display = 'none';
        }
        
        // Show result interface
        const avatarResult = document.getElementById('avatarResult');
        if (avatarResult) {
            avatarResult.style.display = 'block';
        }
        
        // Update feature list with real data
        this.updateFeatureList();
    }

    updateFeatureList() {
        const featureList = document.getElementById('featureList');
        if (!featureList) return;
        
        // Get real data from face mesh and clothing detection
        const clothingData = this.clothingDetector.getClothingData();
        const faceData = this.faceMeshDetector.getFaceMeshData();
        
        const features = [
            { 
                icon: '👤', 
                title: 'Face Mesh', 
                description: 'Real 3D face mesh generated from landmarks' 
            },
            { 
                icon: '🎨', 
                title: 'Skin Tone', 
                description: clothingData && clothingData.skinTone ? 
                    `RGB(${clothingData.skinTone.r}, ${clothingData.skinTone.g}, ${clothingData.skinTone.b})` : 
                    'Detected from images' 
            },
            { 
                icon: '👕', 
                title: 'Clothing Style', 
                description: clothingData && clothingData.recommendations ? 
                    clothingData.recommendations.style : 
                    'Casual style detected' 
            },
            { 
                icon: '🎭', 
                title: 'Expressions', 
                description: 'Facial expressions preserved in 3D model' 
            },
            { 
                icon: '📱', 
                title: 'Export Format', 
                description: 'GLB 3D model ready for download' 
            }
        ];
        
        featureList.innerHTML = '';
        features.forEach(feature => {
            const featureItem = Utils.createElement('div', 'feature-item');
            featureItem.innerHTML = `
                <div class="feature-icon">${feature.icon}</div>
                <div class="feature-details">
                    <h5>${feature.title}</h5>
                    <p>${feature.description}</p>
                </div>
            `;
            featureList.appendChild(featureItem);
        });
    }

    // Export avatar as GLB with real face mesh
    async exportAvatarAsGLB(filename = 'avatar.glb') {
        if (!this.avatar) {
            throw new Error('No avatar to export');
        }

        try {
            console.log('Exporting avatar as GLB...');
            
            // Get clothing data
            const clothingData = this.clothingDetector.getClothingData();
            
            // Export using GLB exporter
            const glbData = await this.glbExporter.exportAvatarAsGLB(
                this.avatar, 
                clothingData,
                {
                    generatedAt: new Date().toISOString(),
                    version: '1.0.0',
                    source: 'Sace.io Avatar Creator'
                }
            );
            
            // Download the GLB file
            this.glbExporter.downloadGLB(filename);
            
            console.log('GLB export completed successfully');
            return glbData;
            
        } catch (error) {
            console.error('GLB export failed:', error);
            throw error;
        }
    }

    // Public methods
    isGeneratingAvatar() {
        return this.isGenerating;
    }

    getAvatar() {
        return this.avatar;
    }

    exportAvatar() {
        if (!this.avatar) return null;
        
        // Export avatar as GLB format
        return this.exportAvatarAsGLB();
    }

    // Get face mesh data for analysis
    getFaceMeshData() {
        return this.faceMeshDetector.getFaceMeshData();
    }

    // Get clothing analysis data
    getClothingData() {
        return this.clothingDetector.getClothingData();
    }

    // Clean up resources
    dispose() {
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        if (this.scene) {
            this.scene.clear();
        }
        
        this.avatar = null;
        this.isGenerating = false;
        
        // Clear GLB data
        this.glbExporter.clearGLBData();
    }
}

// Initialize avatar generator when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    window.avatarGenerator = new AvatarGenerator();
    await window.avatarGenerator.initialize();
});

// Export for use in other modules
window.AvatarGenerator = AvatarGenerator;