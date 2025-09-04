// 3D Face Mesh Generator from Face Landmarks

class FaceMeshGenerator {
    constructor() {
        this.geometry = null;
        this.material = null;
        this.mesh = null;
        this.faceData = null;
    }

    // Generate 3D face mesh from face landmarks
    generateFaceMesh(faceData) {
        this.faceData = faceData;
        
        // Create face geometry from landmarks
        this.geometry = this.createFaceGeometry(faceData);
        
        // Create material with skin tone
        this.material = this.createFaceMaterial(faceData);
        
        // Create mesh
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        
        return this.mesh;
    }

    createFaceGeometry(faceData) {
        const geometry = new THREE.BufferGeometry();
        
        // Extract landmarks from the primary face (front view)
        const primaryLandmarks = faceData.landmarks.front || faceData.landmarks.left || faceData.landmarks.right;
        
        if (!primaryLandmarks) {
            throw new Error('No face landmarks available');
        }

        // Convert 2D landmarks to 3D vertices
        const vertices = [];
        const uvs = [];
        const normals = [];
        
        // Process each landmark
        primaryLandmarks.forEach((landmark, index) => {
            // Convert normalized coordinates to 3D space
            const x = (landmark.x - 0.5) * 2; // Convert to [-1, 1]
            const y = -(landmark.y - 0.5) * 2; // Flip Y and convert to [-1, 1]
            const z = landmark.z || 0; // Use z-coordinate if available
            
            vertices.push(x, y, z);
            
            // UV coordinates for texture mapping
            uvs.push(landmark.x, landmark.y);
            
            // Calculate normal (simplified)
            const normal = this.calculateNormal(landmark, primaryLandmarks);
            normals.push(normal.x, normal.y, normal.z);
        });

        // Create faces using Delaunay triangulation or predefined face topology
        const indices = this.createFaceIndices(primaryLandmarks);
        
        // Set geometry attributes
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setIndex(indices);
        
        // Compute normals if not already set
        geometry.computeVertexNormals();
        
        return geometry;
    }

    calculateNormal(landmark, allLandmarks) {
        // Simplified normal calculation
        // In a real implementation, you'd calculate proper surface normals
        
        // Find nearby landmarks
        const nearbyLandmarks = allLandmarks.filter(l => {
            const distance = Math.sqrt(
                Math.pow(l.x - landmark.x, 2) + Math.pow(l.y - landmark.y, 2)
            );
            return distance < 0.1; // Threshold for nearby points
        });

        if (nearbyLandmarks.length < 2) {
            return new THREE.Vector3(0, 0, 1); // Default normal
        }

        // Calculate average normal from nearby points
        let normalX = 0, normalY = 0, normalZ = 0;
        
        for (let i = 0; i < nearbyLandmarks.length - 1; i++) {
            const p1 = nearbyLandmarks[i];
            const p2 = nearbyLandmarks[i + 1];
            
            // Cross product to get normal
            const v1 = new THREE.Vector3(p1.x - landmark.x, p1.y - landmark.y, (p1.z || 0) - (landmark.z || 0));
            const v2 = new THREE.Vector3(p2.x - landmark.x, p2.y - landmark.y, (p2.z || 0) - (landmark.z || 0));
            
            const cross = new THREE.Vector3().crossVectors(v1, v2);
            cross.normalize();
            
            normalX += cross.x;
            normalY += cross.y;
            normalZ += cross.z;
        }
        
        const normal = new THREE.Vector3(normalX, normalY, normalZ);
        normal.normalize();
        
        return normal;
    }

    createFaceIndices(landmarks) {
        // Use MediaPipe Face Mesh topology to create faces
        // This is a simplified version - in reality, you'd use the full 468-point topology
        
        const indices = [];
        
        // Define face regions and their connections
        const faceRegions = {
            // Face contour
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
            nose: [1, 2, 5, 4, 6, 19, 20, 94, 125, 141, 235, 236, 3, 51, 48, 115, 131, 134, 102, 49, 220, 305, 281, 360, 279, 331, 294, 358, 327, 326, 2, 97, 98, 129],
            
            // Mouth
            mouth: [61, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318, 13, 82, 81, 80, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312]
        };

        // Create triangles for each face region
        for (const [regionName, regionIndices] of Object.entries(faceRegions)) {
            const validIndices = regionIndices.filter(i => i < landmarks.length);
            
            if (validIndices.length >= 3) {
                // Create fan triangulation for each region
                for (let i = 1; i < validIndices.length - 1; i++) {
                    indices.push(validIndices[0], validIndices[i], validIndices[i + 1]);
                }
            }
        }

        // Add general face triangulation
        this.addGeneralFaceTriangulation(indices, landmarks);
        
        return indices;
    }

    addGeneralFaceTriangulation(indices, landmarks) {
        // Add more triangles to create a complete face mesh
        // This is a simplified approach - in reality, you'd use proper Delaunay triangulation
        
        const step = 5; // Skip some points to avoid too many triangles
        
        for (let i = 0; i < landmarks.length - step; i += step) {
            for (let j = i + step; j < landmarks.length - step; j += step) {
                const k = j + step;
                if (k < landmarks.length) {
                    // Check if points are close enough to form a valid triangle
                    const p1 = landmarks[i];
                    const p2 = landmarks[j];
                    const p3 = landmarks[k];
                    
                    const dist12 = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
                    const dist23 = Math.sqrt(Math.pow(p2.x - p3.x, 2) + Math.pow(p2.y - p3.y, 2));
                    const dist31 = Math.sqrt(Math.pow(p3.x - p1.x, 2) + Math.pow(p3.y - p1.y, 2));
                    
                    // Only create triangle if points are reasonably close
                    if (dist12 < 0.2 && dist23 < 0.2 && dist31 < 0.2) {
                        indices.push(i, j, k);
                    }
                }
            }
        }
    }

    createFaceMaterial(faceData) {
        // Create material with skin tone
        const skinTone = faceData.skinTone || { r: 200, g: 150, b: 120 };
        
        // Create skin texture
        const skinTexture = this.createSkinTexture(skinTone);
        
        // Create material
        const material = new THREE.MeshLambertMaterial({
            map: skinTexture,
            color: new THREE.Color(skinTone.r / 255, skinTone.g / 255, skinTone.b / 255),
            side: THREE.DoubleSide
        });

        return material;
    }

    createSkinTexture(skinTone) {
        // Create a procedural skin texture
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Create base skin color
        const baseColor = `rgb(${skinTone.r}, ${skinTone.g}, ${skinTone.b})`;
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, 512, 512);
        
        // Add skin texture details
        this.addSkinDetails(ctx, skinTone);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        return texture;
    }

    addSkinDetails(ctx, skinTone) {
        // Add subtle skin texture details
        const imageData = ctx.getImageData(0, 0, 512, 512);
        const data = imageData.data;
        
        // Add noise and variation
        for (let i = 0; i < data.length; i += 4) {
            // Add subtle noise
            const noise = (Math.random() - 0.5) * 20;
            
            data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
        }
        
        // Add some skin imperfections
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const radius = Math.random() * 3 + 1;
            
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, `rgba(${skinTone.r - 10}, ${skinTone.g - 10}, ${skinTone.b - 10}, 0.3)`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    // Apply facial expressions to the mesh
    applyExpressions(expressions) {
        if (!this.mesh || !this.geometry) return;

        const positions = this.geometry.attributes.position.array;
        const originalPositions = [...positions]; // Store original positions
        
        // Apply expression modifications
        if (expressions.smile) {
            this.applySmile(positions, originalPositions);
        }
        
        if (expressions.frown) {
            this.applyFrown(positions, originalPositions);
        }
        
        if (expressions.raisedEyebrows) {
            this.applyRaisedEyebrows(positions, originalPositions);
        }
        
        if (expressions.squint) {
            this.applySquint(positions, originalPositions);
        }
        
        // Update geometry
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.computeVertexNormals();
    }

    applySmile(positions, originalPositions) {
        // Modify mouth corners to create smile
        const mouthCornerIndices = [61, 291]; // Left and right mouth corners
        
        mouthCornerIndices.forEach(index => {
            if (index * 3 + 1 < positions.length) {
                const yIndex = index * 3 + 1;
                positions[yIndex] = originalPositions[yIndex] + 0.05; // Move corners up
            }
        });
    }

    applyFrown(positions, originalPositions) {
        // Modify mouth corners to create frown
        const mouthCornerIndices = [61, 291];
        
        mouthCornerIndices.forEach(index => {
            if (index * 3 + 1 < positions.length) {
                const yIndex = index * 3 + 1;
                positions[yIndex] = originalPositions[yIndex] - 0.05; // Move corners down
            }
        });
    }

    applyRaisedEyebrows(positions, originalPositions) {
        // Modify eyebrow positions
        const eyebrowIndices = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46, // Left eyebrow
                               296, 334, 293, 300, 276, 283, 282, 295, 285, 336]; // Right eyebrow
        
        eyebrowIndices.forEach(index => {
            if (index * 3 + 1 < positions.length) {
                const yIndex = index * 3 + 1;
                positions[yIndex] = originalPositions[yIndex] + 0.03; // Move eyebrows up
            }
        });
    }

    applySquint(positions, originalPositions) {
        // Modify eye positions to create squint
        const eyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, // Left eye
                           362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]; // Right eye
        
        eyeIndices.forEach(index => {
            if (index * 3 + 1 < positions.length) {
                const yIndex = index * 3 + 1;
                positions[yIndex] = originalPositions[yIndex] - 0.02; // Move eyes down slightly
            }
        });
    }

    // Add accessories to the face mesh
    addAccessories(accessories) {
        if (!this.mesh) return;

        const accessoriesGroup = new THREE.Group();
        
        if (accessories.glasses) {
            const glasses = this.createGlasses();
            accessoriesGroup.add(glasses);
        }
        
        if (accessories.earrings) {
            const leftEarring = this.createEarring(-0.8, 0, 0.8);
            const rightEarring = this.createEarring(0.8, 0, 0.8);
            accessoriesGroup.add(leftEarring);
            accessoriesGroup.add(rightEarring);
        }
        
        if (accessories.hat) {
            const hat = this.createHat();
            accessoriesGroup.add(hat);
        }
        
        this.mesh.add(accessoriesGroup);
    }

    createGlasses() {
        const glassesGroup = new THREE.Group();
        
        // Left lens
        const leftLensGeometry = new THREE.RingGeometry(0.15, 0.2, 16);
        const lensMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x87CEEB,
            transparent: true,
            opacity: 0.3
        });
        const leftLens = new THREE.Mesh(leftLensGeometry, lensMaterial);
        leftLens.position.set(-0.3, 0.2, 0.85);
        glassesGroup.add(leftLens);
        
        // Right lens
        const rightLens = leftLens.clone();
        rightLens.position.set(0.3, 0.2, 0.85);
        glassesGroup.add(rightLens);
        
        // Bridge
        const bridgeGeometry = new THREE.BoxGeometry(0.1, 0.02, 0.02);
        const bridgeMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const bridge = new THREE.Mesh(bridgeGeometry, bridgeMaterial);
        bridge.position.set(0, 0.2, 0.85);
        glassesGroup.add(bridge);
        
        return glassesGroup;
    }

    createEarring(x, y, z) {
        const earringGeometry = new THREE.SphereGeometry(0.03, 16, 16);
        const earringMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
        const earring = new THREE.Mesh(earringGeometry, earringMaterial);
        earring.position.set(x, y, z);
        
        return earring;
    }

    createHat() {
        const hatGeometry = new THREE.CylinderGeometry(0.6, 0.8, 0.3, 16);
        const hatMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const hat = new THREE.Mesh(hatGeometry, hatMaterial);
        hat.position.y = 1.2;
        
        return hat;
    }

    // Get the generated mesh
    getMesh() {
        return this.mesh;
    }

    // Get the geometry for export
    getGeometry() {
        return this.geometry;
    }

    // Get the material
    getMaterial() {
        return this.material;
    }
}

// Export for use in other modules
window.FaceMeshGenerator = FaceMeshGenerator;
