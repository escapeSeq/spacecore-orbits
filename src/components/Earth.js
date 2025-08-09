import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useLoader } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as THREE from 'three';

function Earth({ simulationSpeed }) {
  const earthRef = useRef();

  // Load the Earth_2K.obj model
  const obj = useLoader(OBJLoader, '/models/Earth_2K.obj');
  
  // Load clean Earth texture
  const diffuseMap = useTexture('/textures/Diffuse_2K.png');



  // Clone and prepare the model
  const earthModel = useMemo(() => {
    if (obj) {
      const clonedObj = obj.clone();
      
      // Calculate the bounding box to determine proper scaling
      const box = new THREE.Box3().setFromObject(clonedObj);
      const size = box.getSize(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z);
      
      // Scale to make the Earth radius 2 units (diameter 4 units)
      const targetRadius = 2;
      const scaleFactor = (targetRadius * 2) / maxDimension;
      
      // Apply clean material with just diffuse texture
      clonedObj.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshLambertMaterial({
            map: diffuseMap,        // Clean Earth texture only
          });
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      // Scale the model to proper Earth size
      clonedObj.scale.setScalar(scaleFactor);
      
      // Center the model
      const center = box.getCenter(new THREE.Vector3());
      clonedObj.position.sub(center.multiplyScalar(scaleFactor));
      
      return clonedObj;
    }
    return null;
  }, [obj, diffuseMap]);

  // Earth rotation animation
  useFrame((state, delta) => {
    // Accurate Earth rotation: 24 hours = 1 day
    const earthRotationSpeed = (2 * Math.PI) / (24 * 60 * 60); // radians per second for 24-hour day
    
    if (earthRef.current) {
      earthRef.current.rotation.y += earthRotationSpeed * delta * simulationSpeed;
    }
  });
  
  return (
    <group>
      {/* Main Earth model (Mundo.obj) */}
      {earthModel && (
        <primitive 
          ref={earthRef} 
          object={earthModel} 
          receiveShadow 
          castShadow 
        />
      )}
      

    </group>
  );
}

export default Earth;