// GLB Model Exporter for 3D Avatars

class GLBExporter {
    constructor() {
        this.glbData = null;
        this.scene = null;
    }

    // Export 3D avatar as GLB format
    async exportAvatarAsGLB(avatarMesh, clothingData, metadata = {}) {
        try {
            console.log('Starting GLB export...');
            
            // Create a new scene for export
            this.scene = new THREE.Scene();
            
            // Clone the avatar mesh to avoid modifying the original
            const clonedMesh = avatarMesh.clone();
            
            // Add clothing to the avatar
            if (clothingData) {
                const clothingMesh = this.createClothingMesh(clothingData);
                if (clothingMesh) {
                    this.scene.add(clothingMesh);
                }
            }
            
            // Add the avatar mesh
            this.scene.add(clonedMesh);
            
            // Add lighting for proper export
            this.addExportLighting();
            
            // Create GLB data
            const glbData = await this.createGLBData();
            
            // Add metadata
            glbData.metadata = {
                ...metadata,
                exportedAt: new Date().toISOString(),
                version: '1.0.0',
                format: 'GLB',
                generator: 'Sace.io Avatar Creator'
            };
            
            this.glbData = glbData;
            
            console.log('GLB export completed successfully');
            return glbData;
            
        } catch (error) {
            console.error('GLB export failed:', error);
            throw error;
        }
    }

    createClothingMesh(clothingData) {
        if (!clothingData || !clothingData.recommendations) {
            return null;
        }

        const clothingGroup = new THREE.Group();
        
        // Create shirt
        const shirt = this.createShirt(clothingData.recommendations);
        if (shirt) {
            clothingGroup.add(shirt);
        }
        
        // Create pants
        const pants = this.createPants(clothingData.recommendations);
        if (pants) {
            clothingGroup.add(pants);
        }
        
        return clothingGroup;
    }

    createShirt(clothingRecommendations) {
        const primaryColor = clothingRecommendations.primaryColor;
        if (!primaryColor) return null;

        // Create shirt geometry
        const shirtGeometry = new THREE.CylinderGeometry(0.4, 0.5, 0.8, 16);
        
        // Create shirt material
        const shirtMaterial = new THREE.MeshLambertMaterial({
            color: new THREE.Color(primaryColor.r / 255, primaryColor.g / 255, primaryColor.b / 255)
        });
        
        // Create shirt mesh
        const shirt = new THREE.Mesh(shirtGeometry, shirtMaterial);
        shirt.position.set(0, 0.2, 0);
        shirt.scale.set(1, 1, 0.8);
        
        // Add sleeves
        const sleeveGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8);
        const sleeveMaterial = new THREE.MeshLambertMaterial({
            color: new THREE.Color(primaryColor.r / 255, primaryColor.g / 255, primaryColor.b / 255)
        });
        
        const leftSleeve = new THREE.Mesh(sleeveGeometry, sleeveMaterial);
        leftSleeve.position.set(-0.6, 0.3, 0);
        leftSleeve.rotation.z = Math.PI / 2;
        
        const rightSleeve = new THREE.Mesh(sleeveGeometry, sleeveMaterial);
        rightSleeve.position.set(0.6, 0.3, 0);
        rightSleeve.rotation.z = -Math.PI / 2;
        
        const shirtGroup = new THREE.Group();
        shirtGroup.add(shirt);
        shirtGroup.add(leftSleeve);
        shirtGroup.add(rightSleeve);
        
        return shirtGroup;
    }

    createPants(clothingRecommendations) {
        const secondaryColor = clothingRecommendations.secondaryColor || clothingRecommendations.primaryColor;
        if (!secondaryColor) return null;

        // Create pants geometry
        const pantsGeometry = new THREE.CylinderGeometry(0.3, 0.35, 0.8, 16);
        
        // Create pants material
        const pantsMaterial = new THREE.MeshLambertMaterial({
            color: new THREE.Color(secondaryColor.r / 255, secondaryColor.g / 255, secondaryColor.b / 255)
        });
        
        // Create pants mesh
        const pants = new THREE.Mesh(pantsGeometry, pantsMaterial);
        pants.position.set(0, -0.6, 0);
        
        // Add legs
        const legGeometry = new THREE.CylinderGeometry(0.12, 0.15, 0.7, 8);
        const legMaterial = new THREE.MeshLambertMaterial({
            color: new THREE.Color(secondaryColor.r / 255, secondaryColor.g / 255, secondaryColor.b / 255)
        });
        
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-0.2, -1.2, 0);
        
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(0.2, -1.2, 0);
        
        const pantsGroup = new THREE.Group();
        pantsGroup.add(pants);
        pantsGroup.add(leftLeg);
        pantsGroup.add(rightLeg);
        
        return pantsGroup;
    }

    addExportLighting() {
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // Add directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
        
        // Add fill light
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-1, 0.5, -1);
        this.scene.add(fillLight);
    }

    async createGLBData() {
        return new Promise((resolve, reject) => {
            try {
                // Use GLTFExporter to create GLB
                const exporter = new THREE.GLTFExporter();
                
                const options = {
                    binary: true, // Export as GLB (binary)
                    includeCustomExtensions: true,
                    animations: [],
                    embedImages: true,
                    maxTextureSize: 2048
                };
                
                exporter.parse(
                    this.scene,
                    (result) => {
                        // Convert to GLB format
                        const glbData = this.convertToGLB(result);
                        resolve(glbData);
                    },
                    (error) => {
                        console.error('GLTF export error:', error);
                        reject(error);
                    },
                    options
                );
                
            } catch (error) {
                console.error('GLB creation error:', error);
                reject(error);
            }
        });
    }

    convertToGLB(gltfData) {
        // Convert GLTF data to GLB format
        const glbBuffer = this.createGLBBuffer(gltfData);
        
        return {
            buffer: glbBuffer,
            size: glbBuffer.byteLength,
            format: 'GLB',
            data: gltfData
        };
    }

    createGLBBuffer(gltfData) {
        // Create GLB buffer from GLTF data
        const jsonString = JSON.stringify(gltfData);
        const jsonBuffer = new TextEncoder().encode(jsonString);
        
        // Pad JSON to 4-byte boundary
        const jsonPadding = (4 - (jsonBuffer.length % 4)) % 4;
        const paddedJsonBuffer = new Uint8Array(jsonBuffer.length + jsonPadding);
        paddedJsonBuffer.set(jsonBuffer);
        
        // Create GLB header
        const header = new ArrayBuffer(12);
        const headerView = new DataView(header);
        
        // GLB magic number
        headerView.setUint32(0, 0x46546C67, false); // "glTF"
        headerView.setUint32(4, 2, false); // Version
        headerView.setUint32(8, 12 + paddedJsonBuffer.length, false); // Total length
        
        // Create JSON chunk
        const jsonChunkHeader = new ArrayBuffer(8);
        const jsonChunkHeaderView = new DataView(jsonChunkHeader);
        jsonChunkHeaderView.setUint32(0, paddedJsonBuffer.length, false);
        jsonChunkHeaderView.setUint32(4, 0x4E4F534A, false); // "JSON"
        
        // Combine all buffers
        const totalLength = header.byteLength + jsonChunkHeader.byteLength + paddedJsonBuffer.length;
        const glbBuffer = new ArrayBuffer(totalLength);
        const glbView = new Uint8Array(glbBuffer);
        
        let offset = 0;
        glbView.set(new Uint8Array(header), offset);
        offset += header.byteLength;
        
        glbView.set(new Uint8Array(jsonChunkHeader), offset);
        offset += jsonChunkHeader.byteLength;
        
        glbView.set(paddedJsonBuffer, offset);
        
        return glbBuffer;
    }

    // Download GLB file
    downloadGLB(filename = 'avatar.glb') {
        if (!this.glbData) {
            throw new Error('No GLB data to download');
        }

        const blob = new Blob([this.glbData.buffer], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        console.log(`GLB file downloaded: ${filename}`);
    }

    // Get GLB data as base64
    getGLBAsBase64() {
        if (!this.glbData) {
            throw new Error('No GLB data available');
        }

        const buffer = this.glbData.buffer;
        const bytes = new Uint8Array(buffer);
        let binary = '';
        
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        
        return btoa(binary);
    }

    // Get GLB data as data URL
    getGLBAsDataURL() {
        if (!this.glbData) {
            throw new Error('No GLB data available');
        }

        const base64 = this.getGLBAsBase64();
        return `data:model/gltf-binary;base64,${base64}`;
    }

    // Validate GLB data
    validateGLB() {
        if (!this.glbData) {
            return { valid: false, error: 'No GLB data' };
        }

        try {
            const buffer = this.glbData.buffer;
            const view = new DataView(buffer);
            
            // Check GLB magic number
            const magic = view.getUint32(0, false);
            if (magic !== 0x46546C67) {
                return { valid: false, error: 'Invalid GLB magic number' };
            }
            
            // Check version
            const version = view.getUint32(4, false);
            if (version !== 2) {
                return { valid: false, error: 'Unsupported GLB version' };
            }
            
            // Check total length
            const totalLength = view.getUint32(8, false);
            if (totalLength !== buffer.byteLength) {
                return { valid: false, error: 'Invalid GLB length' };
            }
            
            return { valid: true, size: buffer.byteLength };
            
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    // Get GLB metadata
    getGLBMetadata() {
        if (!this.glbData) {
            return null;
        }

        return {
            size: this.glbData.size,
            format: this.glbData.format,
            metadata: this.glbData.metadata,
            validation: this.validateGLB()
        };
    }

    // Clear GLB data
    clearGLBData() {
        this.glbData = null;
        this.scene = null;
    }
}

// Export for use in other modules
window.GLBExporter = GLBExporter;
