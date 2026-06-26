import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { calculateSatellitePosition, eciToSceneCoordinates } from '../utils/tleParser';

import { COLOR_SCHEMES, DEFAULT_COLOR_SCHEME } from '../themes/colorSchemes';

function TLESatellite({ simulationSpeed, simulationElapsedRef, isPaused = false, tleData, color = "#00ff00", showOrbit = true, showCoverage = true, showBeam = true, onCoverageUpdate, minElevationAngle = 0, theme = COLOR_SCHEMES[DEFAULT_COLOR_SCHEME] }) {
  const satelliteRef = useRef();
  const orbitMeshRef = useRef();
  const coverageConeRef = useRef();
  const coverageRingRef = useRef();
  const lastOrbitUpdateRef = useRef(-Infinity);
  const signalColorRef = useRef(new THREE.Color(color));

  // Keep beam, orbit, and coverage on the same satellite signal colour
  const syncSignalMaterials = () => {
    signalColorRef.current.set(color);
    const c = signalColorRef.current;

    if (orbitMeshRef.current?.material) {
      orbitMeshRef.current.material.color.copy(c);
      orbitMeshRef.current.material.opacity = theme.orbitOpacity;
    }
    if (coverageConeRef.current?.material) {
      coverageConeRef.current.material.color.copy(c);
      coverageConeRef.current.material.opacity = theme.beamOpacity;
    }
    if (coverageRingRef.current?.material) {
      coverageRingRef.current.material.color.copy(c);
      coverageRingRef.current.material.opacity = theme.coverageRingOpacity;
    }
  };
  // Constants
  const EARTH_RADIUS = 2; // Earth radius in our 3D scene (represents 6371 km)
  
  // Calculate coverage cone parameters for line-of-sight to Earth's horizon or constrained by min elevation
  const calculateCoverageGeometry = (satellitePosition) => {
    // Use the same Earth radius as TLE parser for consistency
    const REAL_EARTH_RADIUS = 6378.137; // km (same as tleParser.js)
    const satDistance = Math.sqrt(
      satellitePosition.x * satellitePosition.x + 
      satellitePosition.y * satellitePosition.y + 
      satellitePosition.z * satellitePosition.z
    );
    
    // Convert to real distance (satellite distance from Earth center)
    const realSatDistance = (satDistance / EARTH_RADIUS) * REAL_EARTH_RADIUS;

    // Validation: ensure satellite is above Earth's surface
    if (realSatDistance <= REAL_EARTH_RADIUS) {
      return { height: 0, radius: 0, angle: 0, coverageRadius: 0, coveragePercentage: 0, coverageAreaKm2: 0, centralAngle: 0, satelliteAltitudeKm: 0, u: 1 };
    }

    // Geometry for minimum elevation angle constraint
    const degToRad = Math.PI / 180;
    const e = Math.max(0, Math.min(90, minElevationAngle)) * degToRad; // clamp 0..90 deg
    const u = REAL_EARTH_RADIUS / realSatDistance; // R/d

    // Correct central angle ψ using exact geometry:
    // cos ψ = u * cos^2 e + sin e * sqrt(1 - u^2 cos^2 e)
    const cosE = Math.cos(e);
    const sinE = Math.sin(e);
    const term = 1 - Math.min(1, Math.max(0, u * u * cosE * cosE));
    const cosPsiRaw = u * cosE * cosE + sinE * Math.sqrt(Math.max(0, term));
    const cosPsi = Math.min(1, Math.max(-1, cosPsiRaw));
    const psi = Math.acos(cosPsi);

    // Plane containing the coverage circle is at distance p from Earth's center along the axis
    const p = REAL_EARTH_RADIUS * cosPsi;

    // Distance from satellite to that plane along axis toward Earth's center
    const coneHeightReal = Math.max(0, realSatDistance - p);

    // Circle radius on that plane (equals circle on Earth's surface at central angle psi)
    const coneBaseRadiusReal = REAL_EARTH_RADIUS * Math.sin(psi);

    // Scale to scene coordinates
    const coneHeight = (coneHeightReal / REAL_EARTH_RADIUS) * EARTH_RADIUS;
    const coneBaseRadius = (coneBaseRadiusReal / REAL_EARTH_RADIUS) * EARTH_RADIUS;

    // Coverage metrics based on spherical cap with central angle psi
    const sphericalCapArea = 2 * Math.PI * REAL_EARTH_RADIUS * REAL_EARTH_RADIUS * (1 - cosPsi);
    const totalEarthArea = 4 * Math.PI * REAL_EARTH_RADIUS * REAL_EARTH_RADIUS;
    const coveragePercentage = (sphericalCapArea / totalEarthArea) * 100;

    const altitudeReal = realSatDistance - REAL_EARTH_RADIUS;

    return {
      height: coneHeight,
      radius: coneBaseRadius,
      angle: psi,
      coverageRadius: (coneBaseRadiusReal / REAL_EARTH_RADIUS) * EARTH_RADIUS,
      coveragePercentage,
      coverageAreaKm2: sphericalCapArea,
      centralAngle: psi,
      satelliteAltitudeKm: altitudeReal,
      u
    };
  };

  // Animation loop
  useFrame((state, delta) => {
    syncSignalMaterials();

    if (satelliteRef.current && tleData) {
      // Calculate current satellite position based on simulation time
      const baseTime = new Date();
      const elapsedSeconds = simulationElapsedRef?.current ?? 0;
      const simulationTime = new Date(baseTime.getTime() + elapsedSeconds * 1000);

      // Dynamically update orbit path (single period, tube, includes J2 precession)
      if (showOrbit && orbitMeshRef.current && !isPaused) {
        const elapsedReal = elapsedSeconds / Math.max(simulationSpeed, 0.001);
        if (elapsedReal - lastOrbitUpdateRef.current > 2.0) { // update every 2s real time
          lastOrbitUpdateRef.current = elapsedReal;

          const segments = 256;
          const periodMinutes = tleData.period;
          const timeStep = periodMinutes / segments;

          const points = [];
          for (let i = 0; i <= segments; i++) {
            const t = new Date(simulationTime.getTime() + i * timeStep * 60 * 1000);
            const pos = calculateSatellitePosition(tleData, t);
            const scene = eciToSceneCoordinates(pos.position, EARTH_RADIUS);
            points.push(new THREE.Vector3(scene.x, scene.y, scene.z));
          }

          const curve = new THREE.CatmullRomCurve3(points, true);
          const tubeGeom = new THREE.TubeGeometry(curve, 128, 0.008, 8, true);
          if (orbitMeshRef.current.geometry) {
            orbitMeshRef.current.geometry.dispose();
          }
          orbitMeshRef.current.geometry = tubeGeom;
        }
      }
      
      const satPos = calculateSatellitePosition(tleData, simulationTime);
      const scenePos = eciToSceneCoordinates(satPos.position, EARTH_RADIUS);
      
      satelliteRef.current.position.set(scenePos.x, scenePos.y, scenePos.z);
      
      // Update satellite rotation to face direction of travel
      const velocity = eciToSceneCoordinates(satPos.velocity, EARTH_RADIUS);
      const velocityVector = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
      if (velocityVector.length() > 0) {
        satelliteRef.current.lookAt(
          satelliteRef.current.position.clone().add(velocityVector.normalize())
        );
      }

      // Update coverage cone & ring
      if (showCoverage && coverageConeRef.current) {
        const coverage = calculateCoverageGeometry(scenePos);
        
        // Update coverage data for UI display
        if (onCoverageUpdate && coverage.coveragePercentage !== undefined) {
          // Direction from Earth center to satellite (unit vector in scene coords)
          const satellitePosition = new THREE.Vector3(scenePos.x, scenePos.y, scenePos.z);
          const directionUnit = satellitePosition.length() > 0 ? satellitePosition.clone().normalize() : new THREE.Vector3(0,1,0);

          // Compute geographic lat/lon from scene position
          const dist = satellitePosition.length();
          const latitude = Math.asin(scenePos.y / dist) * (180 / Math.PI);
          // Scene→ECI: x_eci=x_scene, y_eci=z_scene → ECI longitude = atan2(z_scene, x_scene)
          const lonEci = Math.atan2(scenePos.z, scenePos.x) * (180 / Math.PI);
          // GMST: convert ECI longitude to geographic longitude
          const jd = simulationTime.getTime() / 86400000 + 2440587.5;
          const gmstDeg = (280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360;
          const longitude = ((lonEci - gmstDeg + 540) % 360) - 180;

          onCoverageUpdate({ ...coverage, direction: { x: directionUnit.x, y: directionUnit.y, z: directionUnit.z }, latitude, longitude });
        }
        
        // Only show visuals if there's meaningful coverage (satellite is above Earth)
        if (coverage.height > 0.01) {
          // Calculate direction from satellite to Earth center
          const earthCenter = new THREE.Vector3(0, 0, 0);
          const satellitePosition = new THREE.Vector3(scenePos.x, scenePos.y, scenePos.z);
          const directionToEarth = earthCenter.clone().sub(satellitePosition).normalize();
          
          // Use the corrected cone geometry - radius is already calculated properly
          const safeHeight = Math.max(coverage.height, 0.01);
          const safeRadius = Math.max(coverage.radius, 0.01);
          
          const coneGeometry = new THREE.ConeGeometry(safeRadius, safeHeight, 16);
          
          // Position the cone so tip is at satellite and extends toward Earth
          const coneCenter = satellitePosition.clone().add(
            directionToEarth.clone().multiplyScalar(safeHeight / 2)
          );
          coverageConeRef.current.position.copy(coneCenter);
          
          // Rotate cone so tip (+Y) points back toward satellite
          const defaultUp = new THREE.Vector3(0, 1, 0);
          const quaternion = new THREE.Quaternion();
          const tipDirection = satellitePosition.clone().sub(coneCenter).normalize();
          quaternion.setFromUnitVectors(defaultUp, tipDirection);
          coverageConeRef.current.setRotationFromQuaternion(quaternion);
          
          // Update cone geometry
          if (coverageConeRef.current.geometry) {
            coverageConeRef.current.geometry.dispose();
          }
          coverageConeRef.current.geometry = coneGeometry;
          coverageConeRef.current.visible = showBeam;

          // Update intersection ring on Earth's surface
          if (coverageRingRef.current) {
            const axis = new THREE.Vector3(scenePos.x, scenePos.y, scenePos.z).normalize();
            const psi = coverage.centralAngle || 0;
            const ringRadius = EARTH_RADIUS * Math.sin(psi);
            const planeOffset = EARTH_RADIUS * Math.cos(psi);

            if (ringRadius > 0.0005) {
              // Build orthonormal basis (axis, b1, b2)
              let up = new THREE.Vector3(0, 1, 0);
              if (Math.abs(axis.dot(up)) > 0.99) up = new THREE.Vector3(1, 0, 0);
              const b1 = new THREE.Vector3().crossVectors(axis, up).normalize();
              const b2 = new THREE.Vector3().crossVectors(axis, b1).normalize();

              const center = axis.clone().multiplyScalar(planeOffset);
              const segments = 128;
              const points = [];
              for (let i = 0; i <= segments; i++) {
                const t = (i / segments) * Math.PI * 2;
                const pt = center.clone()
                  .add(b1.clone().multiplyScalar(ringRadius * Math.cos(t)))
                  .add(b2.clone().multiplyScalar(ringRadius * Math.sin(t)));
                points.push(pt);
              }

              const ringGeometry = new THREE.BufferGeometry().setFromPoints(points);
              if (coverageRingRef.current.geometry) {
                coverageRingRef.current.geometry.dispose();
              }
              coverageRingRef.current.geometry = ringGeometry;
              coverageRingRef.current.visible = true;
            } else {
              coverageRingRef.current.visible = false;
            }
          }
        } else {
          // Hide if no coverage
          coverageConeRef.current.visible = false;
          if (coverageRingRef.current) coverageRingRef.current.visible = false;
        }
      }
    }
  });

  if (!tleData) {
    return null;
  }

  return (
    <group>
      {/* Orbit path (single period tube, dynamically updated for J2 precession) */}
      {showOrbit && (
        <mesh ref={orbitMeshRef}>
          <bufferGeometry />
          <meshBasicMaterial 
            color={color} 
            transparent 
            opacity={theme.orbitOpacity}
            toneMapped={!theme.highContrastSignals}
          />
        </mesh>
      )}
      
      {/* Coverage cone — uses each satellite's signal colour */}
      {showCoverage && (
        <mesh ref={coverageConeRef}>
          <meshBasicMaterial 
            color={color}
            transparent 
            opacity={theme.beamOpacity}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={!theme.highContrastSignals}
          />
        </mesh>
      )}

      {/* Coverage boundary ring on Earth */}
      {showCoverage && (
        <line ref={coverageRingRef}>
          <bufferGeometry />
          <lineBasicMaterial
            color={color}
            transparent
            opacity={theme.coverageRingOpacity}
            linewidth={1}
            toneMapped={!theme.highContrastSignals}
          />
        </line>
      )}
      
      {/* Satellite body */}
      <group ref={satelliteRef} scale={0.3}>
        {/* Main body */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.2]} />
          <meshPhongMaterial color="#666666" />
        </mesh>
        
        {/* Solar panels */}
        <mesh position={[-0.15, 0, 0]}>
          <boxGeometry args={[0.05, 0.3, 0.1]} />
          <meshPhongMaterial color="#001122" />
        </mesh>
        <mesh position={[0.15, 0, 0]}>
          <boxGeometry args={[0.05, 0.3, 0.1]} />
          <meshPhongMaterial color="#001122" />
        </mesh>
        
        {/* Communication antenna */}
        <mesh position={[0, 0, 0.15]}>
          <cylinderGeometry args={[0.01, 0.01, 0.1]} />
          <meshPhongMaterial color="#ffffff" />
        </mesh>
        
        {/* Thruster */}
        <mesh position={[0, 0, -0.15]}>
          <coneGeometry args={[0.02, 0.05]} />
          <meshPhongMaterial color="#ff4444" />
        </mesh>
        
        {/* Status light */}
        <mesh position={[0, 0.08, 0]}>
          <sphereGeometry args={[0.01]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
    </group>
  );
}

export default TLESatellite;
