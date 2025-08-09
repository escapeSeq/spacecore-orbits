/**
 * Test file for TLE Parser functionality
 * Can be run manually in the browser console for validation
 */

import { parseTLE, calculateSatellitePosition, SAMPLE_TLES, validateTLEChecksum } from './tleParser.js';

// Test TLE parsing with ISS data
export function testTLEParsing() {
  console.log('Testing TLE parsing...');
  
  try {
    const iss = SAMPLE_TLES.ISS;
    const tleData = parseTLE(iss.line1, iss.line2, iss.name);
    
    console.log('Parsed TLE data:', tleData);
    console.log('✓ TLE parsing successful');
    
    // Validate key fields
    if (tleData.inclination && tleData.semiMajorAxis && tleData.period) {
      console.log('✓ Key orbital elements extracted');
    } else {
      console.log('✗ Missing key orbital elements');
    }
    
    return tleData;
  } catch (error) {
    console.error('✗ TLE parsing failed:', error);
    return null;
  }
}

// Test satellite position calculation
export function testPositionCalculation() {
  console.log('Testing position calculation...');
  
  try {
    const iss = SAMPLE_TLES.ISS;
    const tleData = parseTLE(iss.line1, iss.line2, iss.name);
    const position = calculateSatellitePosition(tleData, new Date());
    
    console.log('Calculated position:', position);
    
    // Basic validation
    if (position.position && position.velocity && position.altitude > 0) {
      console.log('✓ Position calculation successful');
      console.log(`Altitude: ${position.altitude.toFixed(2)} km`);
      console.log(`Distance: ${position.distance.toFixed(2)} km`);
    } else {
      console.log('✗ Invalid position calculation');
    }
    
    return position;
  } catch (error) {
    console.error('✗ Position calculation failed:', error);
    return null;
  }
}

// Test checksum validation
export function testChecksumValidation() {
  console.log('Testing checksum validation...');
  
  const iss = SAMPLE_TLES.ISS;
  const line1Valid = validateTLEChecksum(iss.line1);
  const line2Valid = validateTLEChecksum(iss.line2);
  
  console.log(`Line 1 checksum valid: ${line1Valid}`);
  console.log(`Line 2 checksum valid: ${line2Valid}`);
  
  if (line1Valid && line2Valid) {
    console.log('✓ Checksum validation successful');
  } else {
    console.log('✗ Checksum validation failed');
  }
  
  return line1Valid && line2Valid;
}

// Run all tests
export function runAllTests() {
  console.log('=== TLE Parser Test Suite ===');
  
  const tleData = testTLEParsing();
  const position = testPositionCalculation();
  const checksumValid = testChecksumValidation();
  
  console.log('=== Test Summary ===');
  console.log(`TLE Parsing: ${tleData ? '✓' : '✗'}`);
  console.log(`Position Calculation: ${position ? '✓' : '✗'}`);
  console.log(`Checksum Validation: ${checksumValid ? '✓' : '✗'}`);
  
  return {
    tleData,
    position,
    checksumValid
  };
}

// Run tests if in browser environment
if (typeof window !== 'undefined') {
  window.testTLE = {
    runAllTests,
    testTLEParsing,
    testPositionCalculation,
    testChecksumValidation
  };
}

