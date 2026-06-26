import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';

function triggerDownload(content, filename, mimeType = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
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

function isEffectivelyVisible(object) {
  let current = object;
  while (current) {
    if (current.visible === false) return false;
    current = current.parent;
  }
  return true;
}

function applyWorldTransform(target, source) {
  target.position.set(0, 0, 0);
  target.quaternion.identity();
  target.scale.set(1, 1, 1);
  target.matrix.copy(source.matrixWorld);
  target.matrix.decompose(target.position, target.quaternion, target.scale);
  target.updateMatrixWorld(true);
}

function prepareMaterial(material) {
  if (!material) {
    return new THREE.MeshStandardMaterial({ color: 0xffffff });
  }

  const materials = Array.isArray(material) ? material : [material];
  const prepared = materials.map((mat) => {
    const cloned = mat.clone();
    cloned.transparent = cloned.transparent || cloned.opacity < 0.999;
    if (cloned.map) {
      cloned.map.needsUpdate = true;
    }
    return cloned;
  });

  return prepared.length === 1 ? prepared[0] : prepared;
}

function cloneMeshForExport(object) {
  const geometry = object.geometry?.clone?.();
  if (!geometry) return null;

  const mesh = new THREE.Mesh(geometry, prepareMaterial(object.material));
  applyWorldTransform(mesh, object);
  return mesh;
}

function clonePointsForExport(object) {
  const geometry = object.geometry?.clone?.();
  if (!geometry) return null;

  const points = new THREE.Points(geometry, prepareMaterial(object.material));
  applyWorldTransform(points, object);
  return points;
}

function convertLineToTube(object) {
  const geometry = object.geometry;
  const positions = geometry?.attributes?.position;
  if (!positions || positions.count < 2) return null;

  const points = [];
  for (let i = 0; i < positions.count; i++) {
    points.push(new THREE.Vector3(
      positions.getX(i),
      positions.getY(i),
      positions.getZ(i),
    ));
  }

  const first = points[0];
  const last = points[points.length - 1];
  const isClosed = object.isLineLoop || (
    points.length > 3 && first.distanceTo(last) < 1e-5
  );

  const curvePoints = isClosed && first.distanceTo(last) < 1e-5
    ? points.slice(0, -1)
    : points;

  const curve = curvePoints.length >= 2
    ? new THREE.CatmullRomCurve3(curvePoints, isClosed)
    : null;
  if (!curve) return null;

  const radius = object.userData?.exportLineRadius ?? 0.004;
  const tubularSegments = Math.max(Math.min(curvePoints.length * 6, 256), 16);
  const tubeGeometry = new THREE.TubeGeometry(curve, tubularSegments, radius, 6, isClosed);
  const mesh = new THREE.Mesh(tubeGeometry, prepareMaterial(object.material));
  applyWorldTransform(mesh, object);
  return mesh;
}

function prepareSceneForExport(sourceScene) {
  const root = new THREE.Group();
  root.name = 'SpaceCoreOrbit';
  const disposables = [];

  sourceScene.updateMatrixWorld(true);

  sourceScene.traverse((object) => {
    if (object.isLight || object.isCamera) return;
    if (!isEffectivelyVisible(object)) return;

    let exported = null;

    if (object.isMesh) {
      exported = cloneMeshForExport(object);
    } else if (object.isLine || object.isLineSegments || object.isLineLoop) {
      exported = convertLineToTube(object);
    } else if (object.isPoints) {
      exported = clonePointsForExport(object);
    }

    if (exported) {
      root.add(exported);
      disposables.push(exported);
    }
  });

  root.userData.__disposables = disposables;
  return root;
}

function disposeExportRoot(root) {
  for (const object of root.userData.__disposables || []) {
    object.geometry?.dispose?.();
    const materials = object.material
      ? (Array.isArray(object.material) ? object.material : [object.material])
      : [];
    materials.forEach((material) => material.dispose?.());
  }
}

function captureSceneImage(gl, scene, camera, scale = 2) {
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

  return { dataUrl: canvas.toDataURL('image/png'), width, height };
}

export function exportSceneToGlb(scene, simulationTime = new Date()) {
  const exportRoot = prepareSceneForExport(scene);
  const filename = `spacecore-orbit-${formatTimestamp(simulationTime)}.glb`;

  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      exportRoot,
      (result) => {
        disposeExportRoot(exportRoot);
        triggerDownload(result, filename, 'model/gltf-binary');
        resolve();
      },
      (error) => {
        disposeExportRoot(exportRoot);
        reject(error);
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
