#!/usr/bin/env node
/**
 * Elimina del directorio dist/ los archivos que no se usan en el frontend
 * para reducir el tamaño del despliegue.
 *
 * Ejecutar después de `npm run build`:
 *   node scripts/clean-unused-assets.cjs
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');

function deleteFiles(dir, pattern) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      deleteFiles(fullPath, pattern);
    } else if (entry.name.match(pattern)) {
      fs.unlinkSync(fullPath);
    }
  }
}

function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeEmptyDirs(fullPath);
    }
  }
  if (fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}

function getSize(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += getSize(fullPath);
    } else {
      total += fs.statSync(fullPath).size;
    }
  }
  return total;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

console.log(`Tamaño dist antes: ${formatBytes(getSize(DIST_DIR))}`);

// GeoJSON: solo se usan en histograma/descargas, no en visualización
console.log('Eliminando GeoJSONs...');
deleteFiles(DIST_DIR, /\.geojson$/);

// TIFs: no se usan en el frontend (el visor lee PNGs)
console.log('Eliminando TIFs...');
deleteFiles(DIST_DIR, /\.tif$/);

// PLYs dentro de web/data/species: las nubes se cargan desde data/pointcloud
console.log('Eliminando PLYs duplicados...');
deleteFiles(path.join(DIST_DIR, 'web', 'data', 'species'), /\.ply$/);

// DEM original no procesado: no se usa; se usan terrain.json/.bin
const legacyDem = path.join(DIST_DIR, 'data', 'terrain', 'dem_sierra_magina.tif');
if (fs.existsSync(legacyDem)) {
  console.log('Eliminando DEM original sin procesar...');
  fs.unlinkSync(legacyDem);
}

// CSVs por escenario: se usan solo en descargas; los de ocurrencias en common se mantienen
console.log('Eliminando CSVs por escenario (manteniendo common/*_Occurrences.csv)...');
const speciesDir = path.join(DIST_DIR, 'web', 'data', 'species');
function deleteScenarioCsvs(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'common') continue;
      deleteScenarioCsvs(fullPath);
    } else if (entry.name.endsWith('.csv')) {
      fs.unlinkSync(fullPath);
    }
  }
}
deleteScenarioCsvs(speciesDir);

removeEmptyDirs(DIST_DIR);

console.log(`Tamaño dist después: ${formatBytes(getSize(DIST_DIR))}`);
