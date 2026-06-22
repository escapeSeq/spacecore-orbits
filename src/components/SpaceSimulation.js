import React, { useRef, Suspense, useLayoutEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import ThemeStars from './ThemeStars';
import Earth from './Earth';
import Satellite from './Satellite';
import TLESatellite from './TLESatellite';
import { COLOR_SCHEMES, DEFAULT_COLOR_SCHEME } from '../themes/colorSchemes';

function SkyBackground({ color }) {
  const { scene, gl } = useThree();

  useLayoutEffect(() => {
    const sky = new THREE.Color(color);
    scene.background = sky;
    gl.setClearColor(sky, 1);
  }, [color, scene, gl]);

  return null;
}

function LoadingScreen({ theme }) {
  const loadingRef = useRef();

  useFrame((state, delta) => {
    if (loadingRef.current) {
      loadingRef.current.rotation.y += delta * 2;
      loadingRef.current.rotation.x += delta * 0.5;
    }
  });

  return (
    <group ref={loadingRef}>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color={theme.loadingWireframe} wireframe />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.8, 0.1, 8, 16]} />
        <meshBasicMaterial color={theme.loadingTorus} wireframe />
      </mesh>
    </group>
  );
}

function SpaceSimulation({
  simulationSpeed,
  satelliteParams,
  tleSatellites = [],
  showManualSatellite = true,
  updateSatelliteCoverage,
  minElevationAngle = 0,
  showEarth = true,
  showEarthGrid = true,
  theme = COLOR_SCHEMES[DEFAULT_COLOR_SCHEME],
}) {
  return (
    <Canvas
      camera={{
        position: [0, 0, 8],
        fov: 75,
        near: 0.1,
        far: 1000,
      }}
      style={{ background: theme.canvas }}
      gl={{
        antialias: true,
        alpha: false,
      }}
    >
      <SkyBackground color={theme.canvas} />

      {theme.showStars && (
        <ThemeStars key={theme.id} variant={theme.id} />
      )}

      <Suspense fallback={<LoadingScreen theme={theme} />}>
        <ambientLight intensity={theme.ambientLight} />

        <directionalLight
          position={[10, 5, 5]}
          intensity={theme.directionalLight}
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

        <pointLight position={[10, 10, 10]} intensity={theme.pointLight} />

        <Earth
          simulationSpeed={simulationSpeed}
          showGrid={showEarthGrid}
          showModel={showEarth}
          theme={theme}
        />

        {showManualSatellite && (
          <Satellite
            simulationSpeed={simulationSpeed}
            satelliteParams={satelliteParams}
          />
        )}

        {tleSatellites.map(satellite => (
          <TLESatellite
            key={satellite.id}
            simulationSpeed={simulationSpeed}
            tleData={satellite.tleData}
            color={satellite.color}
            showOrbit={satellite.showOrbit}
            showCoverage={satellite.showCoverage}
            showBeam={satellite.showBeam !== false}
            onCoverageUpdate={(coverageData) => updateSatelliteCoverage?.(satellite.id, coverageData)}
            minElevationAngle={minElevationAngle}
            theme={theme}
          />
        ))}

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
