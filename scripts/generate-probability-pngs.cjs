#!/usr/bin/env node
/**
 * Regenera los PNGs de visualización a partir de los GeoTIFFs *_probabilidad.tif.
 * Garantiza que el PNG tenga el mismo bbox y orientación que el raster fuente,
 * resolviendo desplazamientos entre heatmap y ocurrencias.
 *
 * Uso:
 *   node scripts/generate-probability-pngs.cjs
 */

const fs = require('fs');
const path = require('path');
const { fromFile } = require('geotiff');
const { Jimp, ResizeStrategy } = require('jimp');

const BASE_DIR = path.join(__dirname, '..', 'public', 'web', 'data', 'species');
const TARGET_LONG_EDGE = 4096; // px del lado mayor del PNG resultante
const NODATA_THRESHOLD = -9000;

const STOPS = [
  { t: 0.0, r: 0, g: 0, b: 139 },
  { t: 0.05, r: 0, g: 191, b: 255 },
  { t: 0.15, r: 127, g: 255, b: 0 },
  { t: 0.30, r: 255, g: 215, b: 0 },
  { t: 0.60, r: 220, g: 0, b: 0 },
  { t: 1.0, r: 220, g: 0, b: 0 },
];

function geuColor(prob) {
  const p = Math.max(0, Math.min(1, prob));
  let lower = STOPS[0];
  let upper = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (p >= STOPS[i].t && p <= STOPS[i + 1].t) {
      lower = STOPS[i];
      upper = STOPS[i + 1];
      break;
    }
  }
  const range = upper.t - lower.t;
  const frac = range === 0 ? 0 : (p - lower.t) / range;
  return {
    r: Math.round(lower.r + (upper.r - lower.r) * frac),
    g: Math.round(lower.g + (upper.g - lower.g) * frac),
    b: Math.round(lower.b + (upper.b - lower.b) * frac),
  };
}

async function processTif(tifPath, pngPath) {
  const tiff = await fromFile(tifPath);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const data = await image.readRasters();
  const values = data[0];

  // Imagen de salida conservando el aspecto del raster
  const longEdge = Math.max(width, height);
  const scale = TARGET_LONG_EDGE / longEdge;
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  // Generar imagen a resolución nativa primero, luego escalar.
  // Se invierte el orden de las filas para que la fila 0 del PNG corresponda
  // al sur del raster (south-up), igual que los PNGs originales del proyecto.
  const nativeBuffer = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const srcIdx = row * width + col;
      const val = values[srcIdx];
      // fila 0 del PNG = última fila del raster = sur
      const outRow = height - 1 - row;
      const outIdx = (outRow * width + col) * 4;
      if (val === null || val === undefined || Number.isNaN(val) || val <= NODATA_THRESHOLD) {
        nativeBuffer[outIdx] = 0;
        nativeBuffer[outIdx + 1] = 0;
        nativeBuffer[outIdx + 2] = 0;
        nativeBuffer[outIdx + 3] = 0; // transparente
      } else {
        const c = geuColor(val);
        nativeBuffer[outIdx] = c.r;
        nativeBuffer[outIdx + 1] = c.g;
        nativeBuffer[outIdx + 2] = c.b;
        nativeBuffer[outIdx + 3] = 255;
      }
    }
  }

  const native = new Jimp({ width, height, data: nativeBuffer });
  const resized = await native.resize({ w: outW, h: outH, mode: ResizeStrategy.BILINEAR });
  await resized.write(pngPath);
  return { width: outW, height: outH };
}

async function main() {
  const speciesDirs = fs.readdirSync(BASE_DIR)
    .filter((name) => fs.statSync(path.join(BASE_DIR, name)).isDirectory());

  let count = 0;
  let errors = 0;

  for (const speciesId of speciesDirs) {
    const speciesPath = path.join(BASE_DIR, speciesId);
    const algoDirs = fs.readdirSync(speciesPath)
      .filter((name) => fs.statSync(path.join(speciesPath, name)).isDirectory());

    for (const algoId of algoDirs) {
      const algoPath = path.join(speciesPath, algoId);

      const scenarioDirs = [];
      const currentPath = path.join(algoPath, 'current');
      const futurePath = path.join(algoPath, 'future');
      if (fs.existsSync(currentPath)) scenarioDirs.push(currentPath);
      if (fs.existsSync(futurePath)) {
        fs.readdirSync(futurePath)
          .filter((name) => fs.statSync(path.join(futurePath, name)).isDirectory())
          .forEach((name) => scenarioDirs.push(path.join(futurePath, name)));
      }

      for (const scenarioPath of scenarioDirs) {
        const tifFiles = fs.readdirSync(scenarioPath).filter((name) => name.endsWith('.tif'));
        const tifName = tifFiles.find((name) => name.includes('_probabilidad')) || tifFiles[0];
        if (!tifName) continue;
        const tifPath = path.join(scenarioPath, tifName);
        const baseName = path.basename(tifName, '.tif').replace('_probabilidad', '');
        const pngPath = path.join(scenarioPath, `${baseName}.png`);

        try {
          const info = await processTif(tifPath, pngPath);
          console.log(`✅ ${path.relative(BASE_DIR, pngPath)} → ${info.width}x${info.height}`);
          count++;
        } catch (err) {
          console.error(`✗ ${tifPath}: ${err.message}`);
          errors++;
        }
      }
    }
  }

  console.log(`\n✅ ${count} PNGs regenerados`);
  if (errors > 0) console.log(`✗ ${errors} errores`);
}

main().catch((err) => {
  console.error('Error general:', err);
  process.exit(1);
});
