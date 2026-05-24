/**
 * TLE (Two-Line Element) Parser and SGP4 Orbital Mechanics Calculator
 * Implements basic SGP4 algorithm for satellite position calculation
 */

// Constants
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS = 6378.137; // km
const MU = 398600.4418; // Earth's gravitational parameter (km³/s²)
const J2 = 1.0826e-3; // Second zonal harmonic of Earth's gravitational field

/**
 * Parse a TLE string and extract orbital elements
 * @param {string} tleLine1 - First line of TLE
 * @param {string} tleLine2 - Second line of TLE
 * @param {string} name - Optional satellite name
 * @returns {object} Parsed TLE data
 */
export function parseTLE(tleLine1, tleLine2, name = 'Unknown') {
  // Validate TLE format
  if (!tleLine1 || !tleLine2 || tleLine1.length < 69 || tleLine2.length < 69) {
    throw new Error('Invalid TLE format: Lines must be at least 69 characters long');
  }

  if (tleLine1[0] !== '1' || tleLine2[0] !== '2') {
    throw new Error('Invalid TLE format: Lines must start with "1" and "2"');
  }

  try {
    // Parse Line 1
    const catalogNumber = parseInt(tleLine1.substring(2, 7).trim());
    const epochYear = parseInt(tleLine1.substring(18, 20));
    const epochDay = parseFloat(tleLine1.substring(20, 32));
    const meanMotionDerivative = parseFloat(tleLine1.substring(33, 43));
    const bstar = parseFloat(tleLine1.substring(53, 61)) * Math.pow(10, parseInt(tleLine1.substring(59, 61)));

    // Parse Line 2
    const inclination = parseFloat(tleLine2.substring(8, 16)); // degrees
    const raan = parseFloat(tleLine2.substring(17, 25)); // Right Ascension of Ascending Node (degrees)
    const eccentricity = parseFloat('0.' + tleLine2.substring(26, 33)); // decimal
    const argumentOfPerigee = parseFloat(tleLine2.substring(34, 42)); // degrees
    const meanAnomaly = parseFloat(tleLine2.substring(43, 51)); // degrees
    const meanMotion = parseFloat(tleLine2.substring(52, 63)); // revolutions per day

    // Convert epoch to full year
    const fullEpochYear = epochYear + (epochYear < 57 ? 2000 : 1900);

    // Calculate epoch date
    const epochDate = new Date(fullEpochYear, 0, 1);
    epochDate.setTime(epochDate.getTime() + (epochDay - 1) * 24 * 60 * 60 * 1000);

    // Calculate semi-major axis from mean motion
    const n = meanMotion * 2 * Math.PI / (24 * 60 * 60); // radians per second
    const a = Math.pow(MU / (n * n), 1/3); // km

    return {
      name,
      catalogNumber,
      epochDate,
      epochYear: fullEpochYear,
      epochDay,
      inclination,
      raan,
      eccentricity,
      argumentOfPerigee,
      meanAnomaly,
      meanMotion,
      meanMotionDerivative,
      bstar,
      semiMajorAxis: a,
      // Calculated values for easier use
      perigeeAltitude: a * (1 - eccentricity) - EARTH_RADIUS,
      apogeeAltitude: a * (1 + eccentricity) - EARTH_RADIUS,
      period: 2 * Math.PI / n / 60 // minutes
    };
  } catch (error) {
    throw new Error(`Error parsing TLE: ${error.message}`);
  }
}

/**
 * Calculate satellite position using simplified SGP4 algorithm
 * @param {object} tle - Parsed TLE data
 * @param {Date} date - Date for position calculation
 * @returns {object} Position in ECI coordinates (km) and velocity (km/s)
 */
export function calculateSatellitePosition(tle, date = new Date()) {
  // Time since epoch in minutes
  const timeSinceEpoch = (date.getTime() - tle.epochDate.getTime()) / (1000 * 60);

  // Convert to radians
  const inc = tle.inclination * DEG_TO_RAD;
  const raan = tle.raan * DEG_TO_RAD;
  const argp = tle.argumentOfPerigee * DEG_TO_RAD;
  const M0 = tle.meanAnomaly * DEG_TO_RAD;

  // Mean motion (radians per minute)
  const n0 = tle.meanMotion * 2 * Math.PI / (24 * 60);

  // Semi-latus rectum and related
  const a = tle.semiMajorAxis;
  const e = tle.eccentricity;
  const p_param = a * (1 - e * e);

  // J2 secular perturbation rates (radians per minute)
  const cosInc = Math.cos(inc);
  const sinInc = Math.sin(inc);
  const j2Factor = (3 / 2) * J2 * Math.pow(EARTH_RADIUS / p_param, 2);

  // RAAN precession: Ω̇ = -(3/2) * J2 * (R_E/p)^2 * n * cos(i)
  const raanDot = -j2Factor * n0 * cosInc;

  // Argument of perigee drift: ω̇ = (3/2) * J2 * (R_E/p)^2 * n * (2 - (5/2) sin²i)
  const argpDot = j2Factor * n0 * (2 - 2.5 * sinInc * sinInc);

  // Mean motion secular correction: ṅ_J2 = (3/2) * J2 * (R_E/p)^2 * n * (1 - (3/2) sin²i) * sqrt(1-e²)
  const nJ2 = j2Factor * n0 * (1 - 1.5 * sinInc * sinInc) * Math.sqrt(1 - e * e);
  const nCorrected = n0 + nJ2;

  // Drag correction (mean motion derivative is ṅ/2 in rev/day², convert to rad/min²)
  const ndot2 = tle.meanMotionDerivative * 2 * Math.PI / (24 * 60) / (24 * 60); // rad/min²

  // Current mean anomaly: M = M0 + n·t + (ṅ/2)·t²
  const M = M0 + nCorrected * timeSinceEpoch + ndot2 * timeSinceEpoch * timeSinceEpoch;

  // Solve Kepler's equation for eccentric anomaly (Newton-Raphson)
  let E = M;
  for (let i = 0; i < 10; i++) {
    const dE = (E - tle.eccentricity * Math.sin(E) - M) / (1 - tle.eccentricity * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }

  // True anomaly
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + tle.eccentricity) * Math.sin(E / 2),
    Math.sqrt(1 - tle.eccentricity) * Math.cos(E / 2)
  );

  // Distance from Earth center
  const r = tle.semiMajorAxis * (1 - tle.eccentricity * Math.cos(E));

  // Position in orbital plane
  const x_orb = r * Math.cos(nu);
  const y_orb = r * Math.sin(nu);

  // Velocity in orbital plane
  const p = tle.semiMajorAxis * (1 - tle.eccentricity * tle.eccentricity);
  const vx_orb = -Math.sqrt(MU / p) * Math.sin(nu);
  const vy_orb = Math.sqrt(MU / p) * (tle.eccentricity + Math.cos(nu));

  // Apply J2 secular perturbations to RAAN and argument of perigee
  // TLEs are only accurate for ~14 days; cap J2 drift to avoid unrealistic orientation from stale TLEs
  const MAX_J2_PROPAGATION_MIN = 14 * 24 * 60; // 14 days in minutes
  const j2Time = Math.max(-MAX_J2_PROPAGATION_MIN, Math.min(MAX_J2_PROPAGATION_MIN, timeSinceEpoch));
  const currentRaan = raan + raanDot * j2Time;
  const currentArgp = argp + argpDot * j2Time;

  // Rotation matrices for orbital plane to ECI
  const cosRaan = Math.cos(currentRaan);
  const sinRaan = Math.sin(currentRaan);
  const cosArgp = Math.cos(currentArgp);
  const sinArgp = Math.sin(currentArgp);
  // cosInc, sinInc already computed above

  // Transform to ECI coordinates
  const x = (cosRaan * cosArgp - sinRaan * sinArgp * cosInc) * x_orb +
            (-cosRaan * sinArgp - sinRaan * cosArgp * cosInc) * y_orb;
  
  const y = (sinRaan * cosArgp + cosRaan * sinArgp * cosInc) * x_orb +
            (-sinRaan * sinArgp + cosRaan * cosArgp * cosInc) * y_orb;
  
  const z = (sinArgp * sinInc) * x_orb + (cosArgp * sinInc) * y_orb;

  // Transform velocity to ECI coordinates
  const vx = (cosRaan * cosArgp - sinRaan * sinArgp * cosInc) * vx_orb +
             (-cosRaan * sinArgp - sinRaan * cosArgp * cosInc) * vy_orb;
  
  const vy = (sinRaan * cosArgp + cosRaan * sinArgp * cosInc) * vx_orb +
             (-sinRaan * sinArgp + cosRaan * cosArgp * cosInc) * vy_orb;
  
  const vz = (sinArgp * sinInc) * vx_orb + (cosArgp * sinInc) * vy_orb;

  return {
    position: { x, y, z }, // km
    velocity: { x: vx, y: vy, z: vz }, // km/s
    altitude: Math.sqrt(x*x + y*y + z*z) - EARTH_RADIUS,
    distance: Math.sqrt(x*x + y*y + z*z)
  };
}

/**
 * Convert ECI coordinates to scene coordinates for Three.js
 * @param {object} eciPosition - ECI position in km
 * @param {number} earthRadius - Earth radius in scene units
 * @returns {object} Position in scene coordinates
 */
export function eciToSceneCoordinates(eciPosition, earthRadius = 2) {
  const scale = earthRadius / EARTH_RADIUS;
  
  return {
    x: eciPosition.x * scale,
    y: eciPosition.z * scale, // Z becomes Y (up)
    z: eciPosition.y * scale  // Y becomes +Z (preserves orbit direction)
  };
}

/**
 * Validate TLE checksum
 * @param {string} tleLine - TLE line to validate
 * @returns {boolean} True if checksum is valid
 */
export function validateTLEChecksum(tleLine) {
  if (tleLine.length < 69) return false;
  
  let sum = 0;
  for (let i = 0; i < 68; i++) {
    const char = tleLine[i];
    if (char >= '0' && char <= '9') {
      sum += parseInt(char);
    } else if (char === '-') {
      sum += 1;
    }
  }
  
  const checksum = parseInt(tleLine[68]);
  return (sum % 10) === checksum;
}

/**
 * Sample TLE data for testing
 */
export const SAMPLE_TLES = {
  ISS: {
    name: "🚀 ISS (ZARYA)",
    line1: "1 25544U 98067A   26144.19669721  .00007438  00000+0  14130-3 0  9991",
    line2: "2 25544  51.6327  58.8652 0007496  92.3340 267.8507 15.49341091568031"
  },
  HUBBLE: {
    name: "🔭 Hubble Space Telescope",
    line1: "1 20580U 90037B   24001.00000000  .00000000  00000-0  00000-0 0  9991",
    line2: "2 20580  28.4684 288.8542 0002978 321.7771  38.2496 15.09299743654321"
  },
  STARLINK: {
    name: "📡 Starlink-1007",
    line1: "1 44713U 19074A   24001.00000000  .00002182  00000-0  16717-3 0  9990",
    line2: "2 44713  53.0531 123.4567 0001234  98.7654 261.3456 15.06417112234567"
  },
  NOAA19: {
    name: "🌍 NOAA-19 Weather Sat",
    line1: "1 33591U 09005A   24001.00000000  .00000100  00000-0  62552-4 0  9990",
    line2: "2 33591  99.1890 123.4567 0014567  45.1234 315.0123 14.11826543456789"
  },
  GPS: {
    name: "🗺️ GPS BIIR-2",
    line1: "1 24876U 97035A   24001.00000000 -.00000020  00000-0  00000-0 0  9994",
    line2: "2 24876  55.4567 234.5678 0123456  78.9012 281.1234  2.00561234567890"
  },
  GEOSAT: {
    name: "🌐 GOES-16 Weather Sat",
    line1: "1 41866U 16071A   24001.00000000 -.00000280  00000-0  00000-0 0  9991",
    line2: "2 41866   0.0123 264.5678 0002345  12.3456  45.6789  1.00270123456789"
  },
  TERRA: {
    name: "🌱 Terra Earth Observing",
    line1: "1 25994U 99068A   24001.00000000  .00000200  00000-0  89123-4 0  9997",
    line2: "2 25994  98.2123 156.7890 0001234  89.0123 271.1234 14.57123456789012"
  },
  MOLNIYA: {
    name: "🛰️ MOLNIYA 1-91",
    line1: "1 25485U 98054A   25220.25238000  -.00000045  00000+0  00000+0 0  9999",
    line2: "2 25485  64.5387 331.0544 6772907 286.8560 13.3661  2.36441399 206179"
  }
};
