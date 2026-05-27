#!/usr/bin/env node
/**
 * Pre-procesa un DEM GeoTIFF para el visor 3D.
 * - Lee el GeoTIFF
 * - Reduce la resolución si es demasiado grande (max 1024x1024 por defecto)
 * - Guarda:
 *     public/data/terrain/terrain.bin   → elevaciones como Float32Array
 *     public/data/terrain/terrain.json  → metadatos (width, height, bbox, etc.)
 *
 * Uso:
 *   node scripts/process-dem.js [ruta/al/dem.tif] [max_size]
 *
 * Ejemplo:
 *   node scripts/process-dem.js public/data/terrain/dem.tif 1024
 */

const fs = require('fs');
const path = require('path');
const { fromFile } = require('geotiff');

const INPUT_PATH = process.argv[2] || 'public/data/terrain/dem.tif';
const MAX_SIZE = parseInt(process.argv[3], 10) || 1024;
const OUTPUT_DIR = 'public/data/terrain';

async function processDEM() {
  console.log(`Leyendo DEM: ${INPUT_PATH}`);

  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`No existe: ${INPUT_PATH}`);
    process.exit(1);
  }

  const tiff = await fromFile(INPUT_PATH);
  const image = await tiff.getImage();

  const width = image.getWidth();
  const height = image.getHeight();
  const bbox = image.getBoundingBox();

  console.log(`  Dimensiones originales: ${width} x ${height}`);
  console.log(`  Bounding box: [${bbox.join(', ')}]`);

  // Calcular factor de downsampleo
  const maxDim = Math.max(width, height);
  let step = 1;
  if (maxDim > MAX_SIZE) {
    step = Math.ceil(maxDim / MAX_SIZE);
  }

  const outW = Math.floor(width / step);
  const outH = Math.floor(height / step);

  console.log(`  Downsample step: ${step}x → ${outW} x ${outH}`);

  // Leer datos completos
  const data = await image.readRasters({ interleave: false });
  const elevations = data[0];

  // Downsample: tomar un píxel cada `step`
  const outElevations = new Float32Array(outW * outH);
  let minEl = Infinity;
  let maxEl = -Infinity;

  for (let outRow = 0; outRow < outH; outRow++) {
    for (let outCol = 0; outCol < outW; outCol++) {
      const srcRow = outRow * step;
      const srcCol = outCol * step;
      const srcIdx = srcRow * width + srcCol;
      const val = elevations[srcIdx];

      const outIdx = outRow * outW + outCol;
      outElevations[outIdx] = val;

      if (!isNaN(val) && val > -9999) {
        if (val < minEl) minEl = val;
        if (val > maxEl) maxEl = val;
      }
    }
  }

  // Guardar binario
  const binPath = path.join(OUTPUT_DIR, 'terrain.bin');
  fs.writeFileSync(binPath, Buffer.from(outElevations.buffer));

  // Guardar metadatos JSON
  const meta = {
    width: outW,
    height: outH,
    originalWidth: width,
    originalHeight: height,
    step,
    bbox: {
      west: bbox[0],
      south: bbox[1],
      east: bbox[2],
      north: bbox[3],
    },
    minElevation: minEl,
    maxElevation: maxEl,
  };

  const jsonPath = path.join(OUTPUT_DIR, 'terrain.json');
  fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2));

  const binSizeMB = (fs.statSync(binPath).size / 1024 / 1024).toFixed(2);
  const jsonSizeKB = (fs.statSync(jsonPath).size / 1024).toFixed(2);

  console.log(`\n✅ Pre-procesado completado:`);
  console.log(`   ${binPath}  (${binSizeMB} MB)`);
  console.log(`   ${jsonPath}  (${jsonSizeKB} KB)`);
  console.log(`   Elevación: ${minEl.toFixed(1)} – ${maxEl.toFixed(1)} m`);
}

processDEM().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
