import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { calculateSatellitePosition, eciToSceneCoordinates } from '../utils/tleParser';

function TLESatellite({ simulationSpeed, tleData, color = "#00ff00", showOrbit = true, showTrail = true, showCoverage = true }) {
  const satelliteRef = useRef();
  const orbitLineRef = useRef();
  const trailRef = useRef();
  const coverageConeRef = useRef();
  
  // Constants
  const EARTH_RADIUS = 2; // Earth radius in our 3D scene (represents 6371 km)
  
  // Trail points for satellite path
  const trailPoints = useRef([]);
  const maxTrailLength = 100;

  // Calculate coverage cone parameters for line-of-sight to Earth's horizon
  const calculateCoverageGeometry = (satellitePosition) => {
    const REAL_EARTH_RADIUS = 6371; // km
    const satDistance = Math.sqrt(
      satellitePosition.x * satellitePosition.x + 
      satellitePosition.y * satellitePosition.y + 
      satellitePosition.z * satellitePosition.z
    );
    
    // Convert to real distance (satellite distance from Earth center)
    const realSatDistance = (satDistance / EARTH_RADIUS) * REAL_EARTH_RADIUS;
    
    // Calculate the angle from satellite to horizon (tangent to Earth's surface)
    const horizonAngle = Math.asin(REAL_EARTH_RADIUS / realSatDistance);
    
    // Distance from satellite to the tangent point on Earth's surface
    const tangentDistance = Math.sqrt(realSatDistance * realSatDistance - REAL_EARTH_RADIUS * REAL_EARTH_RADIUS);
    
    // Scale tangent distance back to scene coordinates
    const scaledTangentDistance = (tangentDistance / REAL_EARTH_RADIUS) * EARTH_RADIUS;
    
    // Calculate the radius of the coverage circle on Earth's surface
    // For a satellite, the coverage radius is determined by the central angle
    // Coverage radius = Earth_radius * sin(central_angle)
    // Central angle = arccos(Earth_radius / satellite_distance)
    const centralAngle = Math.acos(REAL_EARTH_RADIUS / realSatDistance);
    const coverageRadius = REAL_EARTH_RADIUS * Math.sin(centralAngle);
    const scaledCoverageRadius = (coverageRadius / REAL_EARTH_RADIUS) * EARTH_RADIUS;
    
    // Calculate the actual cone height - distance from satellite to where cone intersects Earth
    // This is different from tangent distance - it's the distance along the cone axis to Earth's surface
    const sceneEarthRadius = EARTH_RADIUS;
    const satelliteDistanceFromCenter = satDistance;
    
    // Distance from satellite to Earth surface along the line toward Earth center
    const distanceToEarthSurface = satelliteDistanceFromCenter - sceneEarthRadius;
    
    return {
      height: distanceToEarthSurface,   // Distance from satellite to Earth surface (where cone should end)
      radius: scaledCoverageRadius,     // Radius of coverage circle on Earth's surface
      angle: horizonAngle,              // Half-angle of the cone
      tangentDistance: scaledTangentDistance // Keep for reference
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

      // Update coverage cone
      if (showCoverage && coverageConeRef.current) {
        const coverage = calculateCoverageGeometry(scenePos);
        
        // Calculate direction from satellite to Earth center
        const earthCenter = new THREE.Vector3(0, 0, 0);
        const satellitePosition = new THREE.Vector3(scenePos.x, scenePos.y, scenePos.z);
        const directionToEarth = earthCenter.clone().sub(satellitePosition).normalize();
        
        // Create custom cone geometry with correct angle based on horizon
        // The cone radius should be calculated from height and horizon angle
        const coneRadius = coverage.height * Math.tan(coverage.angle);
        const coneGeometry = new THREE.ConeGeometry(coneRadius, coverage.height, 16);
        
        // Position cone so tip is at satellite and cone extends toward Earth
        // Three.js cone: tip at +Y, base at -Y, center at origin
        // We want: tip at satellite, base at tangent points on Earth
        // So we offset the cone center toward Earth by half the height
        const coneOffset = directionToEarth.clone().multiplyScalar(coverage.height / 2);
        const conePosition = satellitePosition.clone().add(coneOffset);
        coverageConeRef.current.position.copy(conePosition);
        
        // Rotate cone so the +Y tip points back toward satellite
        const defaultUp = new THREE.Vector3(0, 1, 0); // Default cone tip direction (+Y)
        const quaternion = new THREE.Quaternion();
        const tipDirection = directionToEarth.clone().negate(); // Point away from Earth (toward satellite)
        quaternion.setFromUnitVectors(defaultUp, tipDirection);
        coverageConeRef.current.setRotationFromQuaternion(quaternion);
        
        // Update geometry
        if (coverageConeRef.current.geometry) {
          coverageConeRef.current.geometry.dispose();
        }
        coverageConeRef.current.geometry = coneGeometry;
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
      
      {/* Satellite body */}
      <group ref={satelliteRef}>
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
