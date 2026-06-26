import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter';

function triggerDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
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

export function exportSceneToObj(scene, simulationTime = new Date()) {
  scene.updateMatrixWorld(true);

  const exporter = new OBJExporter();
  const objContent = exporter.parse(scene);
  const filename = `spacecore-orbit-${formatTimestamp(simulationTime)}.obj`;
  triggerDownload(objContent, filename);
}
