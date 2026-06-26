import React, { useRef, Suspense, useLayoutEffect, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import ThemeStars from './ThemeStars';
import Earth from './Earth';
import Satellite from './Satellite';
import TLESatellite from './TLESatellite';
import { COLOR_SCHEMES, DEFAULT_COLOR_SCHEME } from '../themes/colorSchemes';
import { exportSceneToGlb, exportViewToSvg } from '../utils/sceneExport';

function SimulationClock({ simulationSpeed, isPaused, simulationElapsedRef }) {
  useFrame((state, delta) => {
    if (!isPaused) {
      simulationElapsedRef.current += delta * simulationSpeed;
    }
  });
  return null;
}

function SceneExporter({ exportRequest, simulationElapsedRef, backgroundColor, onExportComplete }) {
  const { scene, gl, camera } = useThree();

  useEffect(() => {
    if (!exportRequest?.id) return;

    const simulationTime = new Date(Date.now() + simulationElapsedRef.current * 1000);

    if (exportRequest.format === 'svg') {
      exportViewToSvg(gl, scene, camera, backgroundColor, simulationTime);
      onExportComplete?.();
    } else {
      exportSceneToGlb(scene, simulationTime)
        .then(() => onExportComplete?.())
        .catch((error) => {
          console.error('3D export failed:', error);
          onExportComplete?.();
        });
    }
  }, [exportRequest, scene, gl, camera, backgroundColor, simulationElapsedRef, onExportComplete]);

  return null;
}

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
  isPaused = false,
  simulationElapsedRef,
  exportRequest = null,
  onExportComplete,
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
        preserveDrawingBuffer: true,
      }}
    >
      <SkyBackground color={theme.canvas} />
      <SimulationClock
        simulationSpeed={simulationSpeed}
        isPaused={isPaused}
        simulationElapsedRef={simulationElapsedRef}
      />
      <SceneExporter
        exportRequest={exportRequest}
        simulationElapsedRef={simulationElapsedRef}
        backgroundColor={theme.canvas}
        onExportComplete={onExportComplete}
      />

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
          isPaused={isPaused}
          showGrid={showEarthGrid}
          showModel={showEarth}
          theme={theme}
        />

        {showManualSatellite && (
          <Satellite
            simulationSpeed={simulationSpeed}
            isPaused={isPaused}
            simulationElapsedRef={simulationElapsedRef}
            satelliteParams={satelliteParams}
          />
        )}

        {tleSatellites.map(satellite => (
          <TLESatellite
            key={satellite.id}
            simulationSpeed={simulationSpeed}
            isPaused={isPaused}
            simulationElapsedRef={simulationElapsedRef}
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
