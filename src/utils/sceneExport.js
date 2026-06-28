import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';

function triggerDownload(content, filename, mimeType = 'text/plain') {
  let blob;
  if (content instanceof Blob) {
    blob = content;
  } else if (content instanceof ArrayBuffer) {
    blob = new Blob([content], { type: mimeType });
  } else if (typeof content === 'object') {
    blob = new Blob([JSON.stringify(content, null, 2)], { type: 'model/gltf+json' });
    if (filename.endsWith('.glb')) {
      filename = filename.replace(/\.glb$/, '.gltf');
    }
  } else {
    blob = new Blob([content], { type: mimeType });
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatTimestamp(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}-${hh}${mi}${ss}`;
}

function isLineObject(object) {
  return object.isLine || object.isLineSegments || object.isLineLoop || object.type === 'Line';
}

function hasRenderableGeometry(mesh) {
  const position = mesh.geometry?.attributes?.position;
  return Boolean(position && position.count > 0);
}

function convertMaterialForGltf(material) {
  if (!material) {
    return new THREE.MeshStandardMaterial({ color: 0xffffff });
  }

  const materials = Array.isArray(material) ? material : [material];
  const converted = materials.map((mat) => {
    const transparent = mat.transparent || (mat.opacity !== undefined && mat.opacity < 0.999);
    const std = new THREE.MeshStandardMaterial({
      color: mat.color?.clone?.() ?? new THREE.Color(0xffffff),
      map: mat.map || null,
      transparent,
      opacity: mat.opacity ?? 1,
      side: mat.side ?? THREE.FrontSide,
      depthWrite: mat.depthWrite !== false,
      metalness: 0.05,
      roughness: 0.9,
    });
    std.userData.exportConverted = true;
    if (std.map) std.map.needsUpdate = true;
    return std;
  });

  return converted.length === 1 ? converted[0] : converted;
}

function shouldRemoveFromExport(object) {
  if (object.isLight || object.isCamera) return true;
  if (object.isPoints) return true;
  if (isLineObject(object)) return true;
  if (object.userData?.exportExclude) return true;

  if (object.isMesh) {
    if (!hasRenderableGeometry(object)) return true;
    if (object.visible === false) return true;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.some((mat) => mat?.side === THREE.BackSide)) return true;
  }

  return false;
}

function sanitizeExportTree(root) {
  const removeList = [];
  const convertedMaterials = [];

  root.traverse((object) => {
    if (shouldRemoveFromExport(object)) {
      removeList.push(object);
      return;
    }

    if (object.isMesh && object.material) {
      object.material = convertMaterialForGltf(object.material);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      convertedMaterials.push(...materials);
      object.castShadow = false;
      object.receiveShadow = false;
    }
  });

  removeList.forEach((object) => {
    object.parent?.remove(object);
  });

  root.userData.__convertedMaterials = convertedMaterials;
}

function countExportMeshes(root) {
  let count = 0;
  root.traverse((object) => {
    if (object.isMesh && hasRenderableGeometry(object)) count += 1;
  });
  return count;
}

function prepareSceneForExport(sourceScene) {
  sourceScene.updateMatrixWorld(true);

  const exportRoot = new THREE.Group();
  exportRoot.name = 'SpaceCoreOrbit';

  sourceScene.children.forEach((child) => {
    if (child.isLight || child.isCamera) return;
    exportRoot.add(child.clone(true));
  });

  sanitizeExportTree(exportRoot);
  return exportRoot;
}

function disposeExportRoot(root) {
  for (const material of root.userData.__convertedMaterials || []) {
    material.dispose?.();
  }
}

function captureSceneImage(gl, scene, camera, scale = 2, mimeType = 'image/png', quality = undefined) {
  scene.updateMatrixWorld(true);

  const size = gl.getSize(new THREE.Vector2());
  const width = Math.max(1, Math.floor(size.x * scale));
  const height = Math.max(1, Math.floor(size.y * scale));

  const renderTarget = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
  });

  const prevTarget = gl.getRenderTarget();
  const prevAspect = camera.aspect;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  gl.setRenderTarget(renderTarget);
  gl.clear();
  gl.render(scene, camera);

  gl.setRenderTarget(prevTarget);
  camera.aspect = prevAspect;
  camera.updateProjectionMatrix();

  const pixels = new Uint8Array(width * height * 4);
  gl.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels);
  renderTarget.dispose();

  const flipped = new Uint8ClampedArray(width * height * 4);
  const rowBytes = width * 4;
  for (let y = 0; y < height; y++) {
    const srcOffset = (height - 1 - y) * rowBytes;
    flipped.set(pixels.subarray(srcOffset, srcOffset + rowBytes), y * rowBytes);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(flipped, width, height), 0, 0);

  const dataUrl = quality !== undefined
    ? canvas.toDataURL(mimeType, quality)
    : canvas.toDataURL(mimeType);

  return { dataUrl, width, height };
}

export const SVG_ANIMATION_DURATION_SEC = 10;
export const SVG_ANIMATION_FPS = 20;
export const SVG_ANIMATION_FRAME_COUNT = SVG_ANIMATION_DURATION_SEC * SVG_ANIMATION_FPS;

export { captureSceneImage };

export function buildAnimatedSvg(
  frames,
  width,
  height,
  backgroundColor,
  durationSec = SVG_ANIMATION_DURATION_SEC,
) {
  if (!frames.length) {
    throw new Error('Animated SVG export requires at least one frame.');
  }

  const bg = backgroundColor.startsWith('#') ? backgroundColor : `#${backgroundColor}`;
  const keyTimes = frames.map((_, index) => (index / frames.length).toFixed(6)).join(';');
  const hrefValues = frames.map((_, index) => `#frame-${index}`).join(';');

  const defs = frames.map((dataUrl, index) => (
    `    <image id="frame-${index}" width="${width}" height="${height}" href="${dataUrl}" xlink:href="${dataUrl}"/>`
  )).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
    `     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '  <defs>',
    defs,
    '  </defs>',
    `  <rect width="100%" height="100%" fill="${bg}"/>`,
    `  <use id="anim-frame" href="#frame-0" xlink:href="#frame-0" width="${width}" height="${height}">`,
    `    <animate attributeName="href" attributeType="XML"`,
    `             dur="${durationSec}s" repeatCount="indefinite" calcMode="discrete"`,
    `             keyTimes="${keyTimes}" values="${hrefValues}"/>`,
    '  </use>',
    '</svg>',
  ].join('\n');
}

export function exportAnimatedViewToSvg(
  frames,
  width,
  height,
  backgroundColor,
  simulationTime = new Date(),
  durationSec = SVG_ANIMATION_DURATION_SEC,
) {
  const svg = buildAnimatedSvg(frames, width, height, backgroundColor, durationSec);
  const filename = `spacecore-orbit-${formatTimestamp(simulationTime)}-10s-20fps.svg`;
  triggerDownload(svg, filename, 'image/svg+xml');
}

export function exportSceneToGlb(scene, simulationTime = new Date()) {
  const exportRoot = prepareSceneForExport(scene);
  const filename = `spacecore-orbit-${formatTimestamp(simulationTime)}.glb`;
  const meshCount = countExportMeshes(exportRoot);

  if (meshCount === 0) {
    disposeExportRoot(exportRoot);
    return Promise.reject(new Error('Nothing to export — show the globe or add satellites first.'));
  }

  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    // three@0.130 API: parse(input, onDone, options)
    exporter.parse(
      exportRoot,
      (result) => {
        disposeExportRoot(exportRoot);
        try {
          if (!(result instanceof ArrayBuffer)) {
            const gltfFilename = filename.replace(/\.glb$/, '.gltf');
            triggerDownload(result, gltfFilename, 'model/gltf+json');
          } else {
            triggerDownload(result, filename, 'model/gltf-binary');
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      {
        binary: true,
        embedImages: true,
        onlyVisible: true,
        truncateDrawRange: true,
      },
    );
  });
}

export function exportViewToSvg(gl, scene, camera, backgroundColor, simulationTime = new Date()) {
  const { dataUrl, width, height } = captureSceneImage(gl, scene, camera, 2);
  const bg = backgroundColor.startsWith('#') ? backgroundColor : `#${backgroundColor}`;

  const svg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
    `     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <rect width="100%" height="100%" fill="${bg}"/>`,
    `  <image width="${width}" height="${height}" xlink:href="${dataUrl}" href="${dataUrl}"/>`,
    '</svg>',
  ].join('\n');

  const filename = `spacecore-orbit-${formatTimestamp(simulationTime)}.svg`;
  triggerDownload(svg, filename, 'image/svg+xml');
}
