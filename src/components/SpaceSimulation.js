import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import Earth from './Earth';
import Satellite from './Satellite';
import TLESatellite from './TLESatellite';

// Loading component - Three.js compatible
function LoadingScreen() {
  const loadingRef = useRef();
  
  useFrame((state, delta) => {
    if (loadingRef.current) {
      loadingRef.current.rotation.y += delta * 2;
      loadingRef.current.rotation.x += delta * 0.5;
    }
  });
  
  return (
    <group ref={loadingRef}>
      {/* Simple loading indicator using Three.js objects */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color="#00ff00" wireframe />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.8, 0.1, 8, 16]} />
        <meshBasicMaterial color="#ffffff" wireframe />
      </mesh>
    </group>
  );
}

function SpaceSimulation({ simulationSpeed, satelliteParams, tleSatellites = [], showManualSatellite = true, updateSatelliteCoverage, minElevationAngle = 0, showEarth = true, showEarthGrid = true }) {
  return (
    <Canvas
      camera={{ 
        position: [0, 0, 8], 
        fov: 75,
        near: 0.1,
        far: 1000
      }}
      style={{ background: '#000' }}
      gl={{ 
        antialias: true,
        alpha: false
      }}
    >
      <Suspense fallback={<LoadingScreen />}>
        {/* Ambient light for general illumination */}
        <ambientLight intensity={0.1} />
        
        {/* Directional light representing the Sun */}
        <directionalLight 
          position={[10, 5, 5]} 
          intensity={2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.1}
          shadow-camera-far={50}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        
        {/* Point light for additional lighting */}
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        
        {/* Stars background */}
        <Stars 
          radius={100} 
          depth={50} 
          count={1000} 
          factor={4} 
          saturation={0} 
        />
        
        {/* Earth (always mounted). Visibility controlled via props */}
        <Earth simulationSpeed={simulationSpeed} showGrid={showEarthGrid} showModel={showEarth} />
        
        {/* Manual Satellite */}
        {showManualSatellite && (
          <Satellite 
            simulationSpeed={simulationSpeed}
            satelliteParams={satelliteParams}
          />
        )}
        
        {/* TLE Satellites */}
        {tleSatellites.map(satellite => (
          <TLESatellite
            key={satellite.id}
            simulationSpeed={simulationSpeed}
            tleData={satellite.tleData}
            color={satellite.color}
            showOrbit={satellite.showOrbit}
            showCoverage={satellite.showCoverage}
            onCoverageUpdate={(coverageData) => updateSatelliteCoverage?.(satellite.id, coverageData)}
            minElevationAngle={minElevationAngle}
          />
        ))}
        
        {/* Camera controls */}
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={3}
          maxDistance={50}
        />
      </Suspense>
    </Canvas>
  );
}

export default SpaceSimulation;