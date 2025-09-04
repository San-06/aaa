// Clothing Detection and Analysis

class ClothingDetector {
    constructor() {
        this.clothingData = null;
        this.colorPalette = null;
    }

    // Analyze clothing from uploaded images
    async analyzeClothing(images) {
        const clothingAnalysis = {
            colors: [],
            styles: [],
            textures: [],
            recommendations: null
        };

        // Analyze each image for clothing
        for (const [angle, imageData] of Object.entries(images)) {
            if (imageData && imageData.image) {
                try {
                    const clothing = await this.detectClothingInImage(imageData.image, angle);
                    if (clothing) {
                        clothingAnalysis.colors.push(...clothing.colors);
                        clothingAnalysis.styles.push(clothing.style);
                        clothingAnalysis.textures.push(clothing.texture);
                    }
                } catch (error) {
                    console.error(`Failed to analyze clothing in ${angle} image:`, error);
                }
            }
        }

        // Generate clothing recommendations based on skin tone
        if (clothingAnalysis.colors.length > 0) {
            clothingAnalysis.recommendations = this.generateClothingRecommendations(clothingAnalysis);
        }

        this.clothingData = clothingAnalysis;
        return clothingAnalysis;
    }

    async detectClothingInImage(imageElement, angle) {
        try {
            // Create canvas to analyze the image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = imageElement.width;
            canvas.height = imageElement.height;
            ctx.drawImage(imageElement, 0, 0);

            // Define clothing regions based on angle
            const clothingRegion = this.getClothingRegion(canvas, angle);
            
            if (!clothingRegion) {
                return null;
            }

            // Extract clothing data
            const clothing = {
                colors: this.extractClothingColors(ctx, clothingRegion),
                style: this.detectClothingStyle(ctx, clothingRegion, angle),
                texture: this.detectClothingTexture(ctx, clothingRegion),
                region: clothingRegion
            };

            return clothing;

        } catch (error) {
            console.error('Clothing detection error:', error);
            return null;
        }
    }

    getClothingRegion(canvas, angle) {
        const width = canvas.width;
        const height = canvas.height;

        // Define clothing regions based on image angle
        switch (angle) {
            case 'front':
                return {
                    x: width * 0.1,
                    y: height * 0.6,
                    width: width * 0.8,
                    height: height * 0.3
                };
            case 'left':
            case 'right':
                return {
                    x: width * 0.2,
                    y: height * 0.6,
                    width: width * 0.6,
                    height: height * 0.3
                };
            case 'back':
                return {
                    x: width * 0.1,
                    y: height * 0.5,
                    width: width * 0.8,
                    height: height * 0.4
                };
            default:
                return {
                    x: width * 0.1,
                    y: height * 0.6,
                    width: width * 0.8,
                    height: height * 0.3
                };
        }
    }

    extractClothingColors(ctx, region) {
        const imageData = ctx.getImageData(region.x, region.y, region.width, region.height);
        const data = imageData.data;
        
        const colorMap = new Map();
        const colors = [];

        // Sample colors from the clothing region
        for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // Skip transparent or very dark pixels
            if (a < 128 || (r < 30 && g < 30 && b < 30)) {
                continue;
            }

            // Quantize colors to reduce noise
            const quantizedR = Math.round(r / 32) * 32;
            const quantizedG = Math.round(g / 32) * 32;
            const quantizedB = Math.round(b / 32) * 32;

            const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;
            colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
        }

        // Get most common colors
        const sortedColors = Array.from(colorMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Top 5 colors

        sortedColors.forEach(([colorKey, count]) => {
            const [r, g, b] = colorKey.split(',').map(Number);
            colors.push({
                r, g, b,
                hex: this.rgbToHex(r, g, b),
                frequency: count,
                hsl: this.rgbToHsl(r, g, b)
            });
        });

        return colors;
    }

    detectClothingStyle(ctx, region, angle) {
        // Analyze clothing style based on patterns and shapes
        const imageData = ctx.getImageData(region.x, region.y, region.width, region.height);
        
        // Simple style detection based on color patterns
        const style = {
            type: 'casual', // Default
            pattern: 'solid',
            fit: 'regular'
        };

        // Detect patterns
        if (this.hasStripes(imageData)) {
            style.pattern = 'striped';
        } else if (this.hasDots(imageData)) {
            style.pattern = 'polka_dot';
        } else if (this.hasPlaid(imageData)) {
            style.pattern = 'plaid';
        } else {
            style.pattern = 'solid';
        }

        // Detect clothing type based on angle and region
        if (angle === 'front' || angle === 'back') {
            style.type = this.detectClothingType(imageData);
        }

        return style;
    }

    detectClothingTexture(ctx, region) {
        // Analyze texture based on pixel variation
        const imageData = ctx.getImageData(region.x, region.y, region.width, region.height);
        const data = imageData.data;
        
        let variation = 0;
        let sampleCount = 0;

        // Calculate color variation
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            if (i + 4 < data.length) {
                const nextR = data[i + 4];
                const nextG = data[i + 5];
                const nextB = data[i + 6];
                
                const diff = Math.abs(r - nextR) + Math.abs(g - nextG) + Math.abs(b - nextB);
                variation += diff;
                sampleCount++;
            }
        }

        const avgVariation = variation / sampleCount;
        
        if (avgVariation < 20) {
            return 'smooth';
        } else if (avgVariation < 50) {
            return 'textured';
        } else {
            return 'rough';
        }
    }

    hasStripes(imageData) {
        // Simple stripe detection
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        let stripeCount = 0;
        
        // Check for horizontal stripes
        for (let y = 0; y < height - 10; y += 5) {
            let colorChanges = 0;
            let lastColor = null;
            
            for (let x = 0; x < width; x += 2) {
                const index = (y * width + x) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                
                const currentColor = Math.round((r + g + b) / 3 / 32) * 32;
                
                if (lastColor !== null && Math.abs(currentColor - lastColor) > 32) {
                    colorChanges++;
                }
                lastColor = currentColor;
            }
            
            if (colorChanges > 3) {
                stripeCount++;
            }
        }
        
        return stripeCount > height / 20;
    }

    hasDots(imageData) {
        // Simple dot pattern detection
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        let dotCount = 0;
        
        // Look for circular patterns
        for (let y = 10; y < height - 10; y += 10) {
            for (let x = 10; x < width - 10; x += 10) {
                if (this.isCircularPattern(data, x, y, width, 5)) {
                    dotCount++;
                }
            }
        }
        
        return dotCount > (width * height) / 1000;
    }

    hasPlaid(imageData) {
        // Simple plaid detection
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // Check for both horizontal and vertical patterns
        const hasHorizontal = this.hasStripes(imageData);
        
        // Create vertical version
        const verticalImageData = this.rotateImageData(imageData);
        const hasVertical = this.hasStripes(verticalImageData);
        
        return hasHorizontal && hasVertical;
    }

    isCircularPattern(data, centerX, centerY, width, radius) {
        const centerIndex = (centerY * width + centerX) * 4;
        const centerR = data[centerIndex];
        const centerG = data[centerIndex + 1];
        const centerB = data[centerIndex + 2];
        
        let matches = 0;
        let total = 0;
        
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= radius) {
                    const x = centerX + dx;
                    const y = centerY + dy;
                    const index = (y * width + x) * 4;
                    
                    if (index >= 0 && index < data.length) {
                        const r = data[index];
                        const g = data[index + 1];
                        const b = data[index + 2];
                        
                        const colorDiff = Math.abs(r - centerR) + Math.abs(g - centerG) + Math.abs(b - centerB);
                        if (colorDiff < 30) {
                            matches++;
                        }
                        total++;
                    }
                }
            }
        }
        
        return matches / total > 0.7;
    }

    rotateImageData(imageData) {
        // Simple 90-degree rotation for plaid detection
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        const rotatedData = new Uint8ClampedArray(data.length);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const sourceIndex = (y * width + x) * 4;
                const targetIndex = (x * height + (height - 1 - y)) * 4;
                
                rotatedData[targetIndex] = data[sourceIndex];
                rotatedData[targetIndex + 1] = data[sourceIndex + 1];
                rotatedData[targetIndex + 2] = data[sourceIndex + 2];
                rotatedData[targetIndex + 3] = data[sourceIndex + 3];
            }
        }
        
        return {
            data: rotatedData,
            width: height,
            height: width
        };
    }

    detectClothingType(imageData) {
        // Simple clothing type detection
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // Analyze the shape and color distribution
        const topHalf = this.analyzeRegion(data, width, height, 0, 0, width, height / 2);
        const bottomHalf = this.analyzeRegion(data, width, height, 0, height / 2, width, height / 2);
        
        // Simple heuristics for clothing type
        if (topHalf.brightness > bottomHalf.brightness) {
            return 'shirt';
        } else if (bottomHalf.brightness > topHalf.brightness) {
            return 'pants';
        } else {
            return 'dress';
        }
    }

    analyzeRegion(data, width, height, x, y, regionWidth, regionHeight) {
        let totalR = 0, totalG = 0, totalB = 0;
        let pixelCount = 0;
        
        for (let dy = 0; dy < regionHeight; dy += 2) {
            for (let dx = 0; dx < regionWidth; dx += 2) {
                const index = ((y + dy) * width + (x + dx)) * 4;
                if (index < data.length) {
                    totalR += data[index];
                    totalG += data[index + 1];
                    totalB += data[index + 2];
                    pixelCount++;
                }
            }
        }
        
        const avgR = totalR / pixelCount;
        const avgG = totalG / pixelCount;
        const avgB = totalB / pixelCount;
        
        return {
            r: avgR,
            g: avgG,
            b: avgB,
            brightness: (avgR + avgG + avgB) / 3
        };
    }

    generateClothingRecommendations(clothingAnalysis) {
        // Generate clothing recommendations based on color theory and skin tone
        const recommendations = {
            primaryColor: null,
            secondaryColor: null,
            style: 'casual',
            reasoning: []
        };

        if (clothingAnalysis.colors.length === 0) {
            return recommendations;
        }

        // Get the most frequent color as primary
        const primaryColor = clothingAnalysis.colors[0];
        recommendations.primaryColor = primaryColor;

        // Generate complementary colors
        const complementary = this.getComplementaryColor(primaryColor);
        recommendations.secondaryColor = complementary;

        // Determine best style based on colors
        recommendations.style = this.determineBestStyle(clothingAnalysis);

        // Add reasoning
        recommendations.reasoning.push(`Primary color: ${primaryColor.hex}`);
        recommendations.reasoning.push(`Complementary color: ${complementary.hex}`);
        recommendations.reasoning.push(`Style: ${recommendations.style}`);

        return recommendations;
    }

    getComplementaryColor(color) {
        // Convert RGB to HSL
        const hsl = this.rgbToHsl(color.r, color.g, color.b);
        
        // Get complementary hue (180 degrees opposite)
        const complementaryHue = (hsl.h + 180) % 360;
        
        // Convert back to RGB
        const rgb = this.hslToRgb(complementaryHue, hsl.s, hsl.l);
        
        return {
            r: rgb.r,
            g: rgb.g,
            b: rgb.b,
            hex: this.rgbToHex(rgb.r, rgb.g, rgb.b),
            hsl: { h: complementaryHue, s: hsl.s, l: hsl.l }
        };
    }

    determineBestStyle(clothingAnalysis) {
        // Analyze patterns and colors to determine best style
        const patterns = clothingAnalysis.styles.map(s => s.pattern);
        const colors = clothingAnalysis.colors;
        
        // Count pattern types
        const patternCounts = patterns.reduce((acc, pattern) => {
            acc[pattern] = (acc[pattern] || 0) + 1;
            return acc;
        }, {});

        // Determine style based on patterns and colors
        if (patternCounts.solid > patternCounts.striped && patternCounts.solid > patternCounts.plaid) {
            return 'minimalist';
        } else if (patternCounts.striped > 0) {
            return 'preppy';
        } else if (patternCounts.plaid > 0) {
            return 'casual';
        } else {
            return 'classic';
        }
    }

    // Utility functions
    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return { h: h * 360, s: s * 100, l: l * 100 };
    }

    hslToRgb(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;

        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    // Get clothing data
    getClothingData() {
        return this.clothingData;
    }
}

// Export for use in other modules
window.ClothingDetector = ClothingDetector;
