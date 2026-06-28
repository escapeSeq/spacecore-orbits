import React, { useRef, Suspense, useLayoutEffect, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import ThemeStars from './ThemeStars';
import Earth from './Earth';
import Satellite from './Satellite';
import TLESatellite from './TLESatellite';
import { COLOR_SCHEMES, DEFAULT_COLOR_SCHEME } from '../themes/colorSchemes';
import {
  exportSceneToGlb,
  exportViewToSvg,
  exportAnimatedViewToSvg,
  captureSceneImage,
  SVG_ANIMATION_DURATION_SEC,
  SVG_ANIMATION_FRAME_COUNT,
  SVG_ANIMATION_SIMULATION_SPAN_SEC,
} from '../utils/sceneExport';

function SimulationClock({ simulationSpeed, isPaused, simulationElapsedRef, isExporting }) {
  useFrame((state, delta) => {
    if (!isPaused && !isExporting) {
      simulationElapsedRef.current += delta * simulationSpeed;
    }
  });
  return null;
}

function AnimationSvgExporter({
  simulationElapsedRef,
  backgroundColor,
  simulationSpeed,
  onExportComplete,
  onExportProgress,
}) {
  const { scene, gl, camera, invalidate } = useThree();
  const jobRef = useRef(null);
  const propsRef = useRef({
    backgroundColor,
    simulationSpeed,
    onExportComplete,
    onExportProgress,
  });
  propsRef.current = {
    backgroundColor,
    simulationSpeed,
    onExportComplete,
    onExportProgress,
  };

  useEffect(() => {
    const startElapsed = simulationElapsedRef.current;
    jobRef.current = {
      frameIndex: 0,
      frames: [],
      startElapsed,
      width: 0,
      height: 0,
      readyToCapture: false,
    };
    invalidate();

    return () => {
      jobRef.current = null;
      simulationElapsedRef.current = startElapsed;
      invalidate();
    };
  }, [invalidate, simulationElapsedRef]);

  useFrame(() => {
    const job = jobRef.current;
    if (!job || job.readyToCapture) return;

    const { simulationSpeed: speed } = propsRef.current;
    const simSpan = Math.max(
      SVG_ANIMATION_SIMULATION_SPAN_SEC,
      speed * SVG_ANIMATION_DURATION_SEC,
    );
    simulationElapsedRef.current = job.startElapsed
      + (job.frameIndex / SVG_ANIMATION_FRAME_COUNT) * simSpan;
    job.readyToCapture = true;
  }, -100);

  useFrame(() => {
    const job = jobRef.current;
    if (!job || !job.readyToCapture) return;

    job.readyToCapture = false;

    const captured = captureSceneImage(gl, scene, camera, 1, 'image/jpeg', 0.82);
    if (job.frameIndex === 0) {
      job.width = captured.width;
      job.height = captured.height;
    }
    job.frames.push(captured.dataUrl);
    job.frameIndex += 1;

    propsRef.current.onExportProgress?.(job.frameIndex, SVG_ANIMATION_FRAME_COUNT);

    if (job.frameIndex >= SVG_ANIMATION_FRAME_COUNT) {
      const { backgroundColor: bg, onExportComplete: onDone } = propsRef.current;
      try {
        const simulationTime = new Date(Date.now() + job.startElapsed * 1000);
        exportAnimatedViewToSvg(
          job.frames,
          job.width,
          job.height,
          bg,
          simulationTime,
          SVG_ANIMATION_DURATION_SEC,
        );
      } catch (error) {
        console.error('Animated SVG export failed:', error);
        alert(error.message || 'Animated SVG export failed. Please try again.');
      } finally {
        simulationElapsedRef.current = job.startElapsed;
        jobRef.current = null;
        invalidate();
        onDone?.();
      }
      return;
    }

    invalidate();
  }, 1000);

  return null;
}

function SceneExporter({ exportRequest, simulationElapsedRef, backgroundColor, onExportComplete }) {
  const { scene, gl, camera } = useThree();
  const renderStateRef = useRef({ scene, gl, camera, backgroundColor, simulationElapsedRef, onExportComplete });
  renderStateRef.current = { scene, gl, camera, backgroundColor, simulationElapsedRef, onExportComplete };

  useEffect(() => {
    const exportId = exportRequest?.id;
    if (!exportId) return;

    const { scene: currentScene, gl: currentGl, camera: currentCamera, backgroundColor: bg, simulationElapsedRef: elapsedRef, onExportComplete: onDone } = renderStateRef.current;
    const simulationTime = new Date(Date.now() + elapsedRef.current * 1000);

    if (exportRequest.format === 'svg') {
      try {
        exportViewToSvg(currentGl, currentScene, currentCamera, bg, simulationTime);
      } catch (error) {
        console.error('SVG export failed:', error);
        alert(error.message || 'SVG export failed. Please try again.');
      }
      onDone?.();
      return;
    }

    exportSceneToGlb(currentScene, simulationTime)
      .then(() => onDone?.())
      .catch((error) => {
        console.error('3D export failed:', error);
        alert(error.message || '3D export failed. Please try again.');
        onDone?.();
      });
  }, [exportRequest?.id, exportRequest?.format]);

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
  isExporting = false,
  onExportProgress,
}) {
  return (
    <Canvas
      camera={{
        position: [0, 0, 8],
        fov: 75,
        near: 0.1,
        far: 1000,
      }}
      style={{ background: theme.canvas, width: '100%', height: '100%' }}
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
        isExporting={isExporting}
      />
      <SceneExporter
        exportRequest={exportRequest}
        simulationElapsedRef={simulationElapsedRef}
        backgroundColor={theme.canvas}
        onExportComplete={onExportComplete}
      />
      {isExporting && (
        <AnimationSvgExporter
          simulationElapsedRef={simulationElapsedRef}
          backgroundColor={theme.canvas}
          simulationSpeed={simulationSpeed}
          onExportComplete={onExportComplete}
          onExportProgress={onExportProgress}
        />
      )}

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
