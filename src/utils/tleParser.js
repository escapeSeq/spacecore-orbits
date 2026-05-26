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
    z: -eciPosition.y * scale  // Negate Y→Z to preserve right-handedness and orbit direction
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
    line1: "1 25544U 98067A   26146.19619863  .00012013  00000+0  22272-3 0  9996",
    line2: "2 25544  51.6332  48.9673 0007420  99.1432 261.0396 15.49386458568346"
  },
  HUBBLE: {
    name: "🔭 Hubble Space Telescope",
    line1: "1 20580U 90037B   26146.30085647  .00006627  00000+0  21072-3 0  9991",
    line2: "2 20580  28.4732 230.1289 0001284 261.2187  98.8263 15.30494849785216"
  },
  STARLINK: {
    name: "📡 Starlink-30323",
    line1: "1 57634U 23122C   26145.94513580 -.00000030  00000+0  84263-5 0  9999",
    line2: "2 57634  43.0047   5.0468 0001204 246.0468 114.0257 15.27563270154159"
  },
  NOAA19: {
    name: "🌍 NOAA-19 Weather Sat",
    line1: "1 33591U 09005A   26146.24772839  .00000038  00000+0  44114-4 0  9994",
    line2: "2 33591  98.9524 217.1060 0014853  92.7695 267.5177 14.13470268891386"
  },
  GPS: {
    name: "🗺️ GPS NAVSTAR 43",
    line1: "1 24876U 97035A   26145.26688860  .00000014  00000+0  00000+0 0  9996",
    line2: "2 24876  55.9835  99.4710 0101327  56.5207 304.4123  2.00563829211492"
  },
  GEOSAT: {
    name: "🌐 GOES-16 Weather Sat",
    line1: "1 41866U 16071A   26146.20470221 -.00000089  00000+0  00000+0 0  9993",
    line2: "2 41866   0.2867  85.7005 0000802 279.4534 207.6562  1.00272887 34885"
  },
  TERRA: {
    name: "🌱 Terra Earth Observing",
    line1: "1 25994U 99068A   26146.24154331  .00000387  00000+0  87758-4 0  9999",
    line2: "2 25994  97.9469 196.6565 0001111 330.9033  98.4153 14.61082692406401"
  },
  MOLNIYA: {
    name: "🛰️ MOLNIYA 1-91",
    line1: "1 25485U 98054A   26145.38836854 -.00000175  00000+0  00000+0 0  9995",
    line2: "2 25485  64.6601 288.6027 6673748 283.5307  14.7716  2.36441594213034"
  },
  OFEQ16: {
    name: "🔄 OFEQ-16 (Retrograde)",
    line1: "1 45860U 20044A   26115.04928298  .00000000  00000-0  00000-0 0  0003",
    line2: "2 45860 141.0665 259.1535 0016934 136.2528 224.4907 14.97431343000005"
  }
};
