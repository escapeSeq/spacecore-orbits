import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Satellite({ simulationSpeed, satelliteParams }) {
  const satelliteRef = useRef();
  const orbitLineRef = useRef();
  const trailRef = useRef();
  
  // Constants
  const EARTH_RADIUS = 2; // Earth radius in our 3D scene (represents 6371 km)
  const REAL_EARTH_RADIUS = 6371; // Real Earth radius in km
  
  // Calculate orbital parameters with better scaling for visibility
  const orbitRadius = useMemo(() => {
    // Use a logarithmic scale for better visualization of different altitudes
    // For LEO (200-2000km): scale normally but with minimum visible distance
    // For higher orbits: compress the scale
    const altitudeKm = satelliteParams.altitude;
    let scaledAltitude;
    
    if (altitudeKm <= 2000) {
      // Linear scaling for LEO with good visibility
      scaledAltitude = (altitudeKm / REAL_EARTH_RADIUS) * EARTH_RADIUS * 4; // 4x scale for visibility
    } else {
      // Compressed scaling for higher orbits
      const leoMax = (2000 / REAL_EARTH_RADIUS) * EARTH_RADIUS * 4;
      const additionalAltitude = altitudeKm - 2000;
      scaledAltitude = leoMax + Math.log(1 + additionalAltitude / 1000) * 0.3;
    }
    
    return EARTH_RADIUS + Math.max(scaledAltitude, 0.1); // Minimum 0.1 units above surface
  }, [satelliteParams.altitude]);
  
  // Calculate orbital period using Kepler's laws
  const orbitalPeriod = useMemo(() => {
    // Accurate calculation: T = 2π * sqrt(r³/GM)
    // GM for Earth = 398600.4418 km³/s²
    const GM = 398600.4418; // km³/s²
    const r = REAL_EARTH_RADIUS + satelliteParams.altitude; // km
    const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(r, 3) / GM);
    return periodSeconds;
  }, [satelliteParams.altitude]);
  
  // Create complete orbit path using curve for tube geometry
  const orbitCurve = useMemo(() => {
    const points = [];
    const segments = 256; // More segments for smoother orbit line
    const inclination = (satelliteParams.inclination * Math.PI) / 180;
    
    // Create a complete orbital path
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = orbitRadius * Math.cos(angle);
      const y = orbitRadius * Math.sin(angle) * Math.cos(inclination);
      const z = orbitRadius * Math.sin(angle) * Math.sin(inclination);
      points.push(new THREE.Vector3(x, y, z));
    }
    
    return new THREE.CatmullRomCurve3(points, true); // true for closed curve
  }, [orbitRadius, satelliteParams.inclination]);
  
  // Trail points for satellite path
  const trailPoints = useRef([]);
  const maxTrailLength = 100;
  
  // Animation loop
  useFrame((state, delta) => {
    if (satelliteRef.current) {
      const time = state.clock.elapsedTime * simulationSpeed;
      const angle = -(time / orbitalPeriod) * Math.PI * 2; // Negative for correct counterclockwise rotation
      const inclination = (satelliteParams.inclination * Math.PI) / 180;
      
      // Calculate satellite position
      const x = orbitRadius * Math.cos(angle);
      const y = orbitRadius * Math.sin(angle) * Math.cos(inclination);
      const z = orbitRadius * Math.sin(angle) * Math.sin(inclination);
      
      satelliteRef.current.position.set(x, y, z);
      
      // Update satellite rotation to face direction of travel
      const velocity = new THREE.Vector3(
        -orbitRadius * Math.sin(angle),
        orbitRadius * Math.cos(angle) * Math.cos(inclination),
        orbitRadius * Math.cos(angle) * Math.sin(inclination)
      );
      satelliteRef.current.lookAt(
        satelliteRef.current.position.clone().add(velocity.normalize())
      );
      
      // Update trail
      trailPoints.current.push(new THREE.Vector3(x, y, z));
      if (trailPoints.current.length > maxTrailLength) {
        trailPoints.current.shift();
      }
      
      // Update trail geometry
      if (trailRef.current && trailPoints.current.length > 1) {
        const trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints.current);
        trailRef.current.geometry.dispose();
        trailRef.current.geometry = trailGeometry;
      }
    }
  });
  
  return (
    <group>
      {/* Visible orbit path using tube geometry */}
      <mesh>
        <tubeGeometry args={[orbitCurve, 128, 0.008, 8, true]} />
        <meshBasicMaterial 
          color="#00ccff" 
          transparent 
          opacity={0.8}
        />
      </mesh>

      {/* Backup line for orbit (in case tube doesn't work) */}
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
          color="#00ccff" 
          transparent={false} 
          opacity={1.0}
        />
      </line>
      
      {/* Satellite trail */}
      <line ref={trailRef}>
        <bufferGeometry />
        <lineBasicMaterial color="#00ff00" transparent opacity={0.6} />
      </line>
      
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
          <meshBasicMaterial color="#00ff00" />
        </mesh>
      </group>
    </group>
  );
}

export default Satellite;