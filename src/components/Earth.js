import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useLoader } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as THREE from 'three';

function Earth({ simulationSpeed, showGrid = true, showModel = true }) {
  const earthRef = useRef();

  // Scene Earth radius
  const SCENE_EARTH_RADIUS = 2;

  // Load the Earth_2K.obj model
  const obj = useLoader(OBJLoader, '/models/Earth_2K.obj');
  
  // Load clean Earth texture
  const diffuseMap = useTexture('/textures/Diffuse_2K.png');

  // Create a high-smoothness sphere for silhouette smoothing (rendered just inside)
  const smoothingSphere = useMemo(() => {
    const geom = new THREE.SphereGeometry(SCENE_EARTH_RADIUS * 0.989, 128, 128);
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
    const mesh = new THREE.Mesh(geom, mat);
    return mesh;
  }, []);

  // Clone and prepare the model
  const earthModel = useMemo(() => {
    if (obj) {
      const clonedObj = obj.clone();
      
      // Calculate the bounding box to determine proper scaling
      const box = new THREE.Box3().setFromObject(clonedObj);
      const size = box.getSize(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z);
      
      // Target diameter for exact Earth radius
      const targetDiameter = SCENE_EARTH_RADIUS * 2;
      const baseScaleFactor = targetDiameter / maxDimension;
      const modelScaleFactor = baseScaleFactor * 0.99; // 1% smaller to avoid z-fighting with grid
      
      // Apply flat material with only diffuse texture (no lighting/bump)
      clonedObj.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshBasicMaterial({ map: diffuseMap });
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
      
      // Scale and center the model
      clonedObj.scale.setScalar(modelScaleFactor);
      const center = box.getCenter(new THREE.Vector3());
      clonedObj.position.sub(center.multiplyScalar(modelScaleFactor));
      
      return clonedObj;
    }
    return null;
  }, [obj, diffuseMap]);

  // Generate latitude and longitude grid lines (exact radius)
  const { latitudeLines, longitudeLines } = useMemo(() => {
    const latStepDeg = 10; // degrees between latitude circles
    const lonStepDeg = 10; // degrees between meridians
    const segments = 128;  // segments per line/circle

    const latLines = [];
    const lonLines = [];

    // Latitude circles (exclude the poles where radius is ~0)
    for (let lat = -80; lat <= 80; lat += latStepDeg) {
      const phi = THREE.MathUtils.degToRad(lat);
      const y = SCENE_EARTH_RADIUS * Math.sin(phi);
      const r = SCENE_EARTH_RADIUS * Math.cos(phi);
      const points = [];
      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        const x = r * Math.cos(t);
        const z = r * Math.sin(t);
        points.push(new THREE.Vector3(x, y, z));
      }
      latLines.push(new THREE.BufferGeometry().setFromPoints(points));
    }

    // Longitude meridians
    for (let lon = 0; lon < 360; lon += lonStepDeg) {
      const lambda = THREE.MathUtils.degToRad(lon);
      const points = [];
      for (let i = 0; i <= segments; i++) {
        // phi from -90 to +90
        const phi = THREE.MathUtils.lerp(-Math.PI / 2, Math.PI / 2, i / segments);
        const x = SCENE_EARTH_RADIUS * Math.cos(phi) * Math.cos(lambda);
        const y = SCENE_EARTH_RADIUS * Math.sin(phi);
        const z = SCENE_EARTH_RADIUS * Math.cos(phi) * Math.sin(lambda);
        points.push(new THREE.Vector3(x, y, z));
      }
      lonLines.push(new THREE.BufferGeometry().setFromPoints(points));
    }

    return { latitudeLines: latLines, longitudeLines: lonLines };
  }, []);

  // Earth rotation animation (apply to group containing globe + grid)
  useFrame((state, delta) => {
    const earthRotationSpeed = (2 * Math.PI) / (24 * 60 * 60); // radians per second for 24-hour day
    if (earthRef.current) {
      earthRef.current.rotation.y += earthRotationSpeed * delta * simulationSpeed;
    }
  });
  
  return (
    <group ref={earthRef}>
      {/* Smooth silhouette sphere inside to ensure perfectly round outline */}
      {showModel && (
        <primitive object={smoothingSphere} />
      )}

      {/* Earth model (1% smaller) */}
      {showModel && earthModel && (
        <primitive object={earthModel} />
      )}

      {/* Grid lines, fixed to exact Earth radius */}
      {showGrid && (
        <group>
          {latitudeLines.map((geom, idx) => (
            <line key={`lat-${idx}`}>
              <bufferGeometry attach="geometry" {...geom} />
              <lineBasicMaterial color="#00ff00" transparent opacity={0.25} />
            </line>
          ))}
          {longitudeLines.map((geom, idx) => (
            <line key={`lon-${idx}`}>
              <bufferGeometry attach="geometry" {...geom} />
              <lineBasicMaterial color="#00ff00" transparent opacity={0.25} />
            </line>
          ))}
        </group>
      )}
    </group>
  );
}

export default Earth;