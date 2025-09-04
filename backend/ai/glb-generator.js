// GLB Generator for 3D Avatar Meshes

const THREE = require('three');
const { GLTFExporter } = require('three/examples/jsm/exporters/GLTFExporter.js');
const fs = require('fs').promises;
const path = require('path');

class GLBGenerator {
    constructor() {
        this.scene = null;
        this.avatar = null;
    }

    // Generate GLB from 3D mesh data
    async generateGLB(meshData, metadata = {}) {
        try {
            console.log('Generating GLB from 3D mesh...');
            
            // Create Three.js scene
            this.scene = new THREE.Scene();
            
            // Create avatar mesh from data
            this.avatar = this.createAvatarMesh(meshData);
            
            // Add to scene
            this.scene.add(this.avatar);
            
            // Add lighting
            this.addLighting();
            
            // Export as GLB
            const glbBuffer = await this.exportAsGLB();
            
            console.log('GLB generation completed successfully');
            
            return {
                buffer: glbBuffer,
                size: glbBuffer.byteLength,
                metadata: {
                    ...metadata,
                    generatedAt: new Date().toISOString(),
                    format: 'GLB',
                    version: '2.0'
                }
            };
            
        } catch (error) {
            console.error('GLB generation failed:', error);
            throw error;
        }
    }

    createAvatarMesh(meshData) {
        // Create geometry from mesh data
        const geometry = new THREE.BufferGeometry();
        
        // Set vertices
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
        
        // Set UV coordinates
        if (meshData.uvs) {
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(meshData.uvs, 2));
        }
        
        // Set normals
        if (meshData.normals) {
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
        } else {
            geometry.computeVertexNormals();
        }
        
        // Set faces
        if (meshData.faces) {
            geometry.setIndex(meshData.faces);
        }
        
        // Create material
        const material = this.createAvatarMaterial(meshData);
        
        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);
        
        // Add body if provided
        if (meshData.body) {
            const body = this.createBodyMesh(meshData.body);
            mesh.add(body);
        }
        
        return mesh;
    }

    createAvatarMaterial(meshData) {
        // Create skin material
        const skinTone = meshData.skinTone || { r: 200, g: 150, b: 120 };
        
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(skinTone.r / 255, skinTone.g / 255, skinTone.b / 255),
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
        
        // Add skin texture if available
        if (meshData.skinTexture) {
            const texture = this.createTextureFromData(meshData.skinTexture);
            material.map = texture;
        }
        
        return material;
    }

    createBodyMesh(bodyData) {
        // Create body geometry
        const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.6, 1.5, 16);
        
        // Create body material
        const clothingColor = bodyData.color || { r: 100, g: 150, b: 200 };
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(clothingColor.r / 255, clothingColor.g / 255, clothingColor.b / 255),
            roughness: 0.7,
            metalness: 0.0
        });
        
        // Create body mesh
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = -0.5;
        
        return body;
    }

    createTextureFromData(textureData) {
        // Create texture from image data
        const canvas = document.createElement('canvas');
        canvas.width = textureData.width || 512;
        canvas.height = textureData.height || 512;
        const ctx = canvas.getContext('2d');
        
        if (textureData.data) {
            const imageData = ctx.createImageData(canvas.width, canvas.height);
            imageData.data.set(textureData.data);
            ctx.putImageData(imageData, 0, 0);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        return texture;
    }

    addLighting() {
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // Add directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
        
        // Add fill light
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-5, 0, -5);
        this.scene.add(fillLight);
    }

    async exportAsGLB() {
        return new Promise((resolve, reject) => {
            const exporter = new GLTFExporter();
            
            const options = {
                binary: true,
                includeCustomExtensions: true,
                animations: [],
                embedImages: true,
                maxTextureSize: 2048,
                trs: false,
                onlyVisible: false,
                truncateDrawRange: true,
                embedBuffers: true,
                maxTextureSize: 2048
            };
            
            exporter.parse(
                this.scene,
                (result) => {
                    // Convert to ArrayBuffer
                    const glbBuffer = new ArrayBuffer(result.length);
                    const view = new Uint8Array(glbBuffer);
                    view.set(result);
                    resolve(glbBuffer);
                },
                (error) => {
                    console.error('GLTF export error:', error);
                    reject(error);
                },
                options
            );
        });
    }

    // Save GLB to file
    async saveGLBToFile(glbBuffer, filePath) {
        try {
            const buffer = Buffer.from(glbBuffer);
            await fs.writeFile(filePath, buffer);
            console.log(`GLB saved to: ${filePath}`);
            return filePath;
        } catch (error) {
            console.error('Failed to save GLB file:', error);
            throw error;
        }
    }

    // Generate GLB filename
    generateFilename(prefix = 'avatar') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `${prefix}_${timestamp}.glb`;
    }

    // Validate GLB buffer
    validateGLB(glbBuffer) {
        try {
            const view = new DataView(glbBuffer);
            
            // Check GLB magic number
            const magic = view.getUint32(0, false);
            if (magic !== 0x46546C67) { // "glTF"
                return { valid: false, error: 'Invalid GLB magic number' };
            }
            
            // Check version
            const version = view.getUint32(4, false);
            if (version !== 2) {
                return { valid: false, error: 'Unsupported GLB version' };
            }
            
            // Check total length
            const totalLength = view.getUint32(8, false);
            if (totalLength !== glbBuffer.byteLength) {
                return { valid: false, error: 'Invalid GLB length' };
            }
            
            return { valid: true, size: glbBuffer.byteLength };
            
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    // Get GLB metadata
    getGLBMetadata(glbBuffer) {
        const validation = this.validateGLB(glbBuffer);
        
        return {
            size: glbBuffer.byteLength,
            format: 'GLB',
            version: '2.0',
            validation,
            generatedAt: new Date().toISOString()
        };
    }

    // Clean up resources
    dispose() {
        if (this.scene) {
            this.scene.clear();
            this.scene = null;
        }
        this.avatar = null;
    }
}

module.exports = GLBGenerator;
