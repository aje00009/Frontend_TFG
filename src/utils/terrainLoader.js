import * as THREE from 'three';

const META_URL = '/data/terrain/terrain.json';
const BIN_URL = '/data/terrain/terrain.bin';

/**
 * Carga el DEM pre-procesado (terrain.json + terrain.bin).
 * Mucho más rápido que leer el GeoTIFF completo en el navegador.
 */
export async function loadDEM() {
  const [metaRes, binRes] = await Promise.all([
    fetch(META_URL),
    fetch(BIN_URL),
  ]);

  if (!metaRes.ok) throw new Error(`Failed to fetch terrain.json: ${metaRes.status}`);
  if (!binRes.ok) throw new Error(`Failed to fetch terrain.bin: ${binRes.status}`);

  const meta = await metaRes.json();
  const arrayBuffer = await binRes.arrayBuffer();
  const elevations = new Float32Array(arrayBuffer);

  return {
    width: meta.width,
    height: meta.height,
    elevations,
    bbox: meta.bbox,
    minElevation: meta.minElevation,
    maxElevation: meta.maxElevation,
  };
}

/**
 * Convierte coordenadas lon/lat a metros aproximados (equirectangular)
 * para usar en Three.js sin distorsión grave en zonas pequeñas.
 */
export function lonLatToMeters(lon, lat, refLat) {
  const cosLat = Math.cos((refLat * Math.PI) / 180);
  const x = lon * 111320 * cosLat;
  const y = lat * 110540;
  return { x, y };
}

/**
 * Genera una malla Three.js (PlaneGeometry) a partir de los datos DEM.
 * Aplica exageración vertical.
 *
 * Retorna: { geometry, widthMeters, heightMeters, minElevation, maxElevation }
 */
export function createTerrainGeometry(demData, exaggeration = 1.5) {
  const { width, height, elevations, bbox } = demData;

  // Dimensiones en metros aproximados
  const refLat = (bbox.north + bbox.south) / 2;
  const sw = lonLatToMeters(bbox.west, bbox.south, refLat);
  const ne = lonLatToMeters(bbox.east, bbox.north, refLat);
  const widthMeters = ne.x - sw.x;
  const heightMeters = ne.y - sw.y;

  // min/max de elevación
  let minEl = Infinity;
  let maxEl = -Infinity;
  for (let i = 0; i < elevations.length; i++) {
    const v = elevations[i];
    if (!isNaN(v) && v > -9999) {
      if (v < minEl) minEl = v;
      if (v > maxEl) maxEl = v;
    }
  }

  // Crear geometría con segmentos = resolución del DEM
  const geometry = new THREE.PlaneGeometry(
    widthMeters,
    heightMeters,
    width - 1,
    height - 1
  );

  // Desplazar vértices en Z según elevación
  const positions = geometry.attributes.position.array;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = row * width + col;
      const vIdx = idx * 3;
      const elev = elevations[idx];

      if (!isNaN(elev) && elev > -9999) {
        positions[vIdx + 2] = (elev - minEl) * exaggeration;
      } else {
        positions[vIdx + 2] = 0;
      }
    }
  }

  geometry.computeVertexNormals();

  return {
    geometry,
    widthMeters,
    heightMeters,
    minElevation: minEl,
    maxElevation: maxEl,
  };
}
