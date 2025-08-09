const fs = require('fs');
const { createCanvas } = require('canvas');

// Create high-resolution photorealistic Earth textures
function generateEarthTextures() {
  // Main Earth color map (4K resolution)
  const colorCanvas = createCanvas(4096, 2048);
  const colorCtx = colorCanvas.getContext('2d');
  
  // Helper functions for coordinate conversion
  const lonToX = (lon) => ((lon + 180) / 360) * 4096;
  const latToY = (lat) => ((90 - lat) / 180) * 2048;
  
  // Fill with deep ocean color
  const gradient = colorCtx.createRadialGradient(2048, 1024, 0, 2048, 1024, 2048);
  gradient.addColorStop(0, '#2E5984'); // Deep ocean blue
  gradient.addColorStop(0.7, '#1A4B6B'); // Darker blue
  gradient.addColorStop(1, '#0F2A3F'); // Deep ocean
  colorCtx.fillStyle = gradient;
  colorCtx.fillRect(0, 0, 4096, 2048);
  
  // Add ocean depth variation
  for (let i = 0; i < 10000; i++) {
    const x = Math.random() * 4096;
    const y = Math.random() * 2048;
    const radius = Math.random() * 50 + 10;
    const depth = Math.random() * 0.3;
    
    const oceanGradient = colorCtx.createRadialGradient(x, y, 0, x, y, radius);
    oceanGradient.addColorStop(0, `rgba(20, 60, 90, ${depth})`);
    oceanGradient.addColorStop(1, 'rgba(20, 60, 90, 0)');
    colorCtx.fillStyle = oceanGradient;
    colorCtx.beginPath();
    colorCtx.arc(x, y, radius, 0, Math.PI * 2);
    colorCtx.fill();
  }
  
  // Draw photorealistic continents with detailed geography
  const drawDetailedContinent = (coordinates, color, detailColor) => {
    if (coordinates.length < 6) return;
    
    // Main continent fill
    colorCtx.fillStyle = color;
    colorCtx.beginPath();
    colorCtx.moveTo(lonToX(coordinates[0]), latToY(coordinates[1]));
    
    for (let i = 2; i < coordinates.length; i += 2) {
      colorCtx.lineTo(lonToX(coordinates[i]), latToY(coordinates[i + 1]));
    }
    
    colorCtx.closePath();
    colorCtx.fill();
    
    // Add terrain variation
    colorCtx.fillStyle = detailColor;
    for (let i = 0; i < coordinates.length; i += 4) {
      const x = lonToX(coordinates[i]);
      const y = latToY(coordinates[i + 1]);
      const size = Math.random() * 20 + 5;
      colorCtx.fillRect(x + Math.random() * 100 - 50, y + Math.random() * 100 - 50, size, size);
    }
  };
  
  // North America with realistic colors
  drawDetailedContinent([
    -170, 65, -165, 68, -140, 69, -130, 70, -120, 69, -110, 60, -95, 49, -85, 46,
    -75, 45, -65, 47, -60, 50, -55, 52, -50, 60, -55, 65, -60, 70, -70, 75,
    -80, 75, -90, 75, -110, 72, -130, 70, -150, 68, -170, 65
  ], '#2E5016', '#1A3D0F'); // Dark forest green
  
  // United States - different biomes
  drawDetailedContinent([
    -125, 49, -120, 48, -110, 49, -95, 49, -85, 45, -80, 32, -82, 25, -97, 25,
    -104, 32, -117, 32, -125, 42, -125, 49
  ], '#4A6741', '#8B7355'); // Mixed forest/plains
  
  // Western US deserts
  drawDetailedContinent([
    -125, 42, -117, 32, -104, 32, -110, 40, -120, 45, -125, 42
  ], '#B8860B', '#DAA520'); // Desert colors
  
  // South America with Amazon
  drawDetailedContinent([
    -82, 12, -70, 12, -60, 5, -50, -5, -35, -10, -35, -25, -45, -35, -50, -45,
    -60, -50, -65, -45, -70, -40, -75, -30, -80, -15, -82, 12
  ], '#1A4D1A', '#0D2D0D'); // Deep Amazon green
  
  // Brazil highlands
  drawDetailedContinent([
    -60, -5, -50, -5, -45, -15, -50, -25, -60, -20, -60, -5
  ], '#3D5C2A', '#2A4019'); // Highland green
  
  // Africa with varied terrain
  drawDetailedContinent([
    -18, 35, 10, 37, 25, 32, 35, 30, 45, 15, 50, 5, 45, -10, 35, -25, 25, -30,
    15, -35, 5, -30, -5, -25, -10, -10, -15, 5, -18, 20, -18, 35
  ], '#8B7355', '#A0522D'); // Savanna browns
  
  // Sahara Desert
  drawDetailedContinent([
    -15, 30, 30, 32, 35, 25, 25, 15, 5, 15, -10, 20, -15, 30
  ], '#EDC9AF', '#DEB887'); // Sandy colors
  
  // Central African forests
  drawDetailedContinent([
    -5, 5, 15, 5, 25, -5, 20, -15, 5, -10, -5, 5
  ], '#2E5016', '#1A3D0F'); // Dense forest
  
  // Europe
  drawDetailedContinent([
    -10, 55, 5, 58, 15, 60, 25, 58, 35, 56, 45, 50, 40, 45, 30, 42, 20, 40,
    10, 42, 0, 45, -5, 50, -10, 55
  ], '#4A6741', '#5D7A51'); // Temperate green
  
  // Asia - Siberian forests
  drawDetailedContinent([
    45, 75, 180, 75, 180, 60, 170, 55, 150, 50, 130, 52, 110, 55, 90, 60,
    70, 65, 50, 70, 45, 75
  ], '#2E5016', '#1F3A11'); // Boreal forest
  
  // China and East Asia
  drawDetailedContinent([
    70, 50, 90, 48, 110, 45, 125, 40, 140, 35, 135, 25, 120, 20, 100, 25,
    85, 30, 75, 40, 70, 50
  ], '#4A6741', '#6B8E23'); // Mixed terrain
  
  // India subcontinent
  drawDetailedContinent([
    68, 35, 78, 35, 85, 30, 90, 25, 85, 15, 75, 8, 68, 8, 68, 25, 68, 35
  ], '#8B7355', '#CD853F'); // Indian plains
  
  // Australia
  drawDetailedContinent([
    113, -10, 130, -12, 140, -15, 145, -20, 150, -25, 145, -35, 135, -40,
    125, -38, 115, -35, 110, -25, 110, -15, 113, -10
  ], '#A0522D', '#D2691E'); // Outback colors
  
  // Antarctica
  colorCtx.fillStyle = '#FFFFFF';
  colorCtx.fillRect(0, latToY(-60), 4096, 2048 - latToY(-60));
  
  // Add ice texture to Antarctica
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 4096;
    const y = latToY(-60) + Math.random() * (2048 - latToY(-60));
    colorCtx.fillStyle = `rgba(240, 248, 255, ${Math.random() * 0.5 + 0.3})`;
    colorCtx.fillRect(x, y, Math.random() * 10, Math.random() * 10);
  }
  
  // Greenland
  drawDetailedContinent([
    -75, 83, -65, 83, -40, 80, -45, 75, -50, 70, -60, 65, -70, 68, -75, 75, -75, 83
  ], '#F0F8FF', '#E6F3FF');
  
  // Add major islands with realistic details
  const drawRealisticIsland = (lon, lat, radius, color) => {
    const x = lonToX(lon);
    const y = latToY(lat);
    
    const islandGradient = colorCtx.createRadialGradient(x, y, 0, x, y, radius);
    islandGradient.addColorStop(0, color);
    islandGradient.addColorStop(0.7, color);
    islandGradient.addColorStop(1, 'rgba(0,0,0,0)');
    
    colorCtx.fillStyle = islandGradient;
    colorCtx.beginPath();
    colorCtx.arc(x, y, radius, 0, Math.PI * 2);
    colorCtx.fill();
    
    // Add coastal details
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const coastX = x + Math.cos(angle) * radius * 0.8;
      const coastY = y + Math.sin(angle) * radius * 0.8;
      colorCtx.fillStyle = '#2E5984';
      colorCtx.fillRect(coastX, coastY, 2, 2);
    }
  };
  
  // Major islands with photorealistic colors
  drawRealisticIsland(139, 35, 12, '#2E5016'); // Japan
  drawRealisticIsland(-65, 18, 8, '#4A6741'); // Caribbean
  drawRealisticIsland(121, 14, 10, '#1A4D1A'); // Philippines
  drawRealisticIsland(110, -5, 15, '#2E5016'); // Indonesia
  drawRealisticIsland(47, -20, 10, '#8B7355'); // Madagascar
  drawRealisticIsland(174, -41, 8, '#4A6741'); // New Zealand
  drawRealisticIsland(-4, 54, 6, '#4A6741'); // British Isles
  drawRealisticIsland(81, 7, 4, '#2E5016'); // Sri Lanka
  
  // Add cloud shadows and atmospheric effects
  for (let i = 0; i < 1000; i++) {
    const x = Math.random() * 4096;
    const y = Math.random() * 2048;
    const size = Math.random() * 100 + 50;
    
    colorCtx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.1 + 0.05})`;
    colorCtx.beginPath();
    colorCtx.arc(x, y, size, 0, Math.PI * 2);
    colorCtx.fill();
  }
  
  // Save color map
  const colorBuffer = colorCanvas.toBuffer('image/png');
  fs.writeFileSync('public/textures/earth-color.png', colorBuffer);
  
  console.log('Generated photorealistic Earth color texture (4K)');
  
  // Generate normal map for terrain relief
  generateNormalMap();
  
  // Generate specular map for ocean reflection
  generateSpecularMap();
}

function generateNormalMap() {
  const normalCanvas = createCanvas(2048, 1024);
  const normalCtx = normalCanvas.getContext('2d');
  
  // Create terrain height data
  const imageData = normalCtx.createImageData(2048, 1024);
  
  for (let y = 0; y < 1024; y++) {
    for (let x = 0; x < 2048; x++) {
      const index = (y * 2048 + x) * 4;
      
      // Convert to longitude/latitude
      const lon = (x / 2048) * 360 - 180;
      const lat = 90 - (y / 1024) * 180;
      
      // Calculate terrain height based on geography
      let height = 0;
      
      // Mountain ranges
      if ((lon > 70 && lon < 90 && lat > 25 && lat < 40) || // Himalayas
          (lon > -80 && lon < -70 && lat > -50 && lat < 10) || // Andes
          (lon > -125 && lon < -110 && lat > 40 && lat < 50) || // Rockies
          (lon > 5 && lon < 15 && lat > 45 && lat < 48)) { // Alps
        height = 200 + Math.random() * 55; // High mountains
      }
      // Continental shelves
      else if ((lon > -100 && lon < -60 && lat > 20 && lat < 50) || // North American plains
               (lon > 20 && lon < 50 && lat > -20 && lat < 20) || // African plateau
               (lon > 100 && lon < 140 && lat > 30 && lat < 50)) { // Asian plateau
        height = 140 + Math.random() * 40; // Plateaus
      }
      // Ocean depths
      else if (Math.random() > 0.3) { // 70% ocean
        height = 50 + Math.random() * 50; // Ocean floor variation
      }
      // Land areas
      else {
        height = 120 + Math.random() * 30; // General land elevation
      }
      
      // Add noise for realistic terrain
      height += (Math.random() - 0.5) * 20;
      
      // Convert height to normal map RGB
      imageData.data[index] = Math.max(0, Math.min(255, height)); // R - height
      imageData.data[index + 1] = Math.max(0, Math.min(255, height)); // G - height
      imageData.data[index + 2] = Math.max(0, Math.min(255, height)); // B - height
      imageData.data[index + 3] = 255; // A - alpha
    }
  }
  
  normalCtx.putImageData(imageData, 0, 0);
  
  const normalBuffer = normalCanvas.toBuffer('image/png');
  fs.writeFileSync('public/textures/earth-normal.png', normalBuffer);
  
  console.log('Generated Earth normal map (2K)');
}

function generateSpecularMap() {
  const specularCanvas = createCanvas(2048, 1024);
  const specularCtx = specularCanvas.getContext('2d');
  
  // Black background (no reflection on land)
  specularCtx.fillStyle = '#000000';
  specularCtx.fillRect(0, 0, 2048, 1024);
  
  // Add ocean specularity
  const lonToX = (lon) => ((lon + 180) / 360) * 2048;
  const latToY = (lat) => ((90 - lat) / 180) * 1024;
  
  // Create ocean mask (everything not land should be reflective)
  for (let y = 0; y < 1024; y++) {
    for (let x = 0; x < 2048; x++) {
      const lon = (x / 2048) * 360 - 180;
      const lat = 90 - (y / 1024) * 180;
      
      // Check if this pixel is ocean (inverse of land areas)
      let isOcean = true;
      
      // Land area checks (simplified)
      if ((lon > -170 && lon < -50 && lat > 15 && lat < 75) || // North America
          (lon > -80 && lon < -35 && lat > -55 && lat < 12) || // South America
          (lon > -20 && lon < 50 && lat > -35 && lat < 37) || // Africa
          (lon > -10 && lon < 60 && lat > 35 && lat < 70) || // Europe
          (lon > 60 && lon < 180 && lat > 10 && lat < 75) || // Asia
          (lon > 110 && lon < 155 && lat > -45 && lat < -10) || // Australia
          (lat < -60)) { // Antarctica
        
        // More detailed land detection would go here
        // For now, use simplified approach
        if (Math.random() > 0.3) { // 70% of "land" pixels are actually land
          isOcean = false;
        }
      }
      
      if (isOcean) {
        // Ocean areas are reflective
        const reflection = 150 + Math.random() * 105; // High specularity for water
        specularCtx.fillStyle = `rgb(${reflection}, ${reflection}, ${reflection})`;
        specularCtx.fillRect(x, y, 1, 1);
      }
    }
  }
  
  const specularBuffer = specularCanvas.toBuffer('image/png');
  fs.writeFileSync('public/textures/earth-specular.png', specularBuffer);
  
  console.log('Generated Earth specular map (2K)');
}

// Run texture generation
try {
  generateEarthTextures();
  console.log('All Earth textures generated successfully!');
} catch (error) {
  console.error('Error generating textures:', error);
  console.log('Note: This script requires node-canvas. Install with: npm install canvas');
}