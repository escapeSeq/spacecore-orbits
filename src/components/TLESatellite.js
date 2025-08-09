import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { calculateSatellitePosition, eciToSceneCoordinates } from '../utils/tleParser';

function TLESatellite({ simulationSpeed, tleData, color = "#00ff00", showOrbit = true, showTrail = true, showCoverage = true, onCoverageUpdate, minElevationAngle = 0 }) {
  const satelliteRef = useRef();
  const orbitLineRef = useRef();
  const trailRef = useRef();
  const coverageConeRef = useRef();
  const coverageRingRef = useRef();
  
  // Constants
  const EARTH_RADIUS = 2; // Earth radius in our 3D scene (represents 6371 km)
  
  // Trail points for satellite path
  const trailPoints = useRef([]);
  const maxTrailLength = 100;

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
      return { height: 0, radius: 0, angle: 0, coverageRadius: 0, coveragePercentage: 0, coverageAreaKm2: 0, centralAngle: 0, satelliteAltitudeKm: 0 };
    }

    // Geometry for minimum elevation angle constraint
    const degToRad = Math.PI / 180;
    const eRad = Math.max(0, Math.min(90, minElevationAngle)) * degToRad; // clamp 0..90 deg
    const u = REAL_EARTH_RADIUS / realSatDistance; // R/d

    // Central angle without elevation constraint (horizon)
    const psi0 = Math.acos(Math.min(1, Math.max(-1, u)));

    // Central angle with minimum elevation e: psi_e = arccos(u * cos e) - e
    const acosArg = u * Math.cos(eRad);
    const psi_e = Math.max(0, Math.acos(Math.min(1, Math.max(-1, acosArg))) - eRad);

    // Plane containing the coverage circle is at distance p from Earth's center along the axis
    const p = REAL_EARTH_RADIUS * Math.cos(psi_e);

    // Distance from satellite to that plane along axis toward Earth's center
    const coneHeightReal = Math.max(0, realSatDistance - p);

    // Circle radius on that plane (equals circle on Earth's surface at central angle psi_e)
    const coneBaseRadiusReal = REAL_EARTH_RADIUS * Math.sin(psi_e);

    // Scale to scene coordinates
    const coneHeight = (coneHeightReal / REAL_EARTH_RADIUS) * EARTH_RADIUS;
    const coneBaseRadius = (coneBaseRadiusReal / REAL_EARTH_RADIUS) * EARTH_RADIUS;

    // Coverage metrics based on spherical cap with central angle psi_e
    const sphericalCapArea = 2 * Math.PI * REAL_EARTH_RADIUS * REAL_EARTH_RADIUS * (1 - Math.cos(psi_e));
    const totalEarthArea = 4 * Math.PI * REAL_EARTH_RADIUS * REAL_EARTH_RADIUS;
    const coveragePercentage = (sphericalCapArea / totalEarthArea) * 100;

    const altitudeReal = realSatDistance - REAL_EARTH_RADIUS;

    return {
      height: coneHeight,
      radius: coneBaseRadius,
      angle: psi_e, // store central angle for reference
      coverageRadius: (coneBaseRadiusReal / REAL_EARTH_RADIUS) * EARTH_RADIUS,
      coveragePercentage,
      coverageAreaKm2: sphericalCapArea,
      centralAngle: psi_e,
      satelliteAltitudeKm: altitudeReal
    };
  };

  // Calculate orbit path for visualization
  const orbitCurve = useMemo(() => {
    if (!tleData) return null;
    
    const points = [];
    const segments = 256;
    const currentTime = new Date();
    
    // Generate orbit points over one complete period
    const periodMinutes = tleData.period;
    const timeStep = periodMinutes / segments;
    
    for (let i = 0; i <= segments; i++) {
      const time = new Date(currentTime.getTime() + i * timeStep * 60 * 1000);
      const satPos = calculateSatellitePosition(tleData, time);
      const scenePos = eciToSceneCoordinates(satPos.position, EARTH_RADIUS);
      points.push(new THREE.Vector3(scenePos.x, scenePos.y, scenePos.z));
    }
    
    return new THREE.CatmullRomCurve3(points, true);
  }, [tleData]);

  // Animation loop
  useFrame((state, delta) => {
    if (satelliteRef.current && tleData) {
      // Calculate current satellite position based on simulation time
      const baseTime = new Date();
      const simulationTime = new Date(baseTime.getTime() + state.clock.elapsedTime * simulationSpeed * 1000);
      
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
          onCoverageUpdate({ ...coverage, direction: { x: directionUnit.x, y: directionUnit.y, z: directionUnit.z } });
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
          coverageConeRef.current.visible = true;

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
      
      // Update trail
      if (showTrail) {
        trailPoints.current.push(new THREE.Vector3(scenePos.x, scenePos.y, scenePos.z));
        if (trailPoints.current.length > maxTrailLength) {
          trailPoints.current.shift();
        }
        
        // Update trail geometry
        if (trailRef.current && trailPoints.current.length > 1) {
          const trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints.current);
          if (trailRef.current.geometry) {
            trailRef.current.geometry.dispose();
          }
          trailRef.current.geometry = trailGeometry;
        }
      }
    }
  });

  if (!tleData) {
    return null;
  }

  return (
    <group>
      {/* Visible orbit path using tube geometry */}
      {showOrbit && orbitCurve && (
        <mesh>
          <tubeGeometry args={[orbitCurve, 128, 0.008, 8, true]} />
          <meshBasicMaterial 
            color={color} 
            transparent 
            opacity={0.6}
          />
        </mesh>
      )}

      {/* Backup line for orbit */}
      {showOrbit && orbitCurve && (
        <line ref={orbitLineRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={orbitCurve.getPoints(256).length}
              array={new Float32Array(orbitCurve.getPoints(256).flatMap(p => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial 
            color={color} 
            transparent 
            opacity={0.8}
          />
        </line>
      )}
      
      {/* Satellite trail */}
      {showTrail && (
        <line ref={trailRef}>
          <bufferGeometry />
          <lineBasicMaterial color={color} transparent opacity={0.4} />
        </line>
      )}
      
      {/* Coverage cone */}
      {showCoverage && (
        <mesh ref={coverageConeRef}>
          <meshBasicMaterial 
            color={color}
            transparent 
            opacity={0.15}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Coverage boundary ring on Earth */}
      {showCoverage && (
        <line ref={coverageRingRef}>
          <bufferGeometry />
          <lineBasicMaterial color={color} transparent opacity={0.8} linewidth={1} />
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
