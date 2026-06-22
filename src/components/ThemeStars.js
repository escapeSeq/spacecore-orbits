import React, { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { Color, NormalBlending, AdditiveBlending } from 'three';

const STAR_PROPS = {
  radius: 100,
  depth: 50,
  count: 1000,
  factor: 4,
  saturation: 0,
  fade: false,
};

function resolvePointsNode(node) {
  if (!node) return null;
  if (node.geometry && node.material) return node;
  if (node.children?.[0]?.geometry) return node.children[0];
  return null;
}

function patchStarColors(node, variant) {
  const points = resolvePointsNode(node);
  const colors = points?.geometry?.attributes?.color;
  const material = points?.material;
  if (!colors || !material) return false;

  const starColor = new Color();

  if (variant === 'light') {
    for (let i = 0; i < colors.count; i++) {
      starColor.setHSL(i / colors.count, 0, 0.15 + Math.random() * 0.22);
      colors.setXYZ(i, starColor.r, starColor.g, starColor.b);
    }
    material.blending = NormalBlending;
  } else {
    for (let i = 0; i < colors.count; i++) {
      starColor.setHSL(i / colors.count, 0, 0.9);
      colors.setXYZ(i, starColor.r, starColor.g, starColor.b);
    }
    material.blending = AdditiveBlending;
  }

  colors.needsUpdate = true;
  material.toneMapped = false;
  material.depthWrite = false;
  material.transparent = true;
  material.needsUpdate = true;
  return true;
}

/**
 * Same @react-three/drei Stars field — white (additive) on dark sky,
 * black (normal blend) on light sky.
 */
function ThemeStars({ variant = 'dark' }) {
  const nodeRef = useRef(null);
  const patchedRef = useRef(false);
  const variantRef = useRef(variant);
  variantRef.current = variant;

  const tryPatch = useCallback(() => {
    if (patchedRef.current) return true;
    const ok = patchStarColors(nodeRef.current, variantRef.current);
    if (ok) patchedRef.current = true;
    return ok;
  }, []);

  const setStarsRef = useCallback(
    (node) => {
      nodeRef.current = node;
      patchedRef.current = false;
      tryPatch();
    },
    [tryPatch]
  );

  useFrame(() => {
    tryPatch();
  });

  return <Stars ref={setStarsRef} {...STAR_PROPS} />;
}

export default ThemeStars;
