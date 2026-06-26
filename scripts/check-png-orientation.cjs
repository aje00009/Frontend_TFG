#!/usr/bin/env node
/**
 * Compara la orientación del PNG de predicción con el GeoTIFF de probabilidad
 * para detectar si hay que voltearlo verticalmente en Cesium.
 *
 * Uso: node scripts/check-png-orientation.cjs <especie> <algoritmo>
 */

const fs = require('fs');
const path = require('path');
const { fromFile } = require('geotiff');
const { Jimp } = require('jimp');

const BASE_DIR = path.join(__dirname, '..', 'public', 'web', 'data', 'species');

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function geoToPixel(lon, lat, bbox, w, h) {
  const u = (lon - bbox.west) / (bbox.east - bbox.west);
  const v = (lat - bbox.south) / (bbox.north - bbox.south);
  const x = Math.floor(clamp(u, 0, 1) * (w - 1));
  const yNorthUp = Math.floor((1 - clamp(v, 0, 1)) * (h - 1)); // fila 0 = north
  const ySouthUp = Math.floor(clamp(v, 0, 1) * (h - 1));       // fila 0 = south
  return { x, yNorthUp, ySouthUp };
}

function classify(prob) {
  if (prob >= 0.6) return 'alta/rojo';
  if (prob >= 0.3) return 'media-alta/amarillo';
  if (prob >= 0.15) return 'media-baja/verde';
  if (prob >= 0.05) return 'baja/cian';
  return 'muy baja/azul';
}

function colorName(r, g, b) {
  const best = [
    { name: 'azul oscuro', r: 0, g: 0, b: 139 },
    { name: 'cian', r: 0, g: 191, b: 255 },
    { name: 'verde', r: 127, g: 255, b: 0 },
    { name: 'amarillo', r: 255, g: 215, b: 0 },
    { name: 'rojo', r: 220, g: 0, b: 0 },
  ].reduce((a, c) => {
    const da = (a.r - r) ** 2 + (a.g - g) ** 2 + (a.b - b) ** 2;
    const dc = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2;
    return dc < da ? c : a;
  });
  return best.name;
}

async function main() {
  const speciesId = process.argv[2] || 'pinus_nigra';
  const algoId = process.argv[3] || 'Random_Forest';
  const scenarioDir = path.join(BASE_DIR, speciesId, algoId, 'current');
  const tifPath = path.join(scenarioDir, `${speciesId}_${algoId}_Actual_probabilidad.tif`);
  const pngPath = path.join(scenarioDir, `${speciesId}_${algoId}_Actual.png`);
  const bboxPath = path.join(scenarioDir, `${speciesId}_${algoId}_Actual_bbox.json`);
  const occPath = path.join(BASE_DIR, speciesId, 'common', `${speciesId}_Occurrences.csv`);

  if (!fs.existsSync(tifPath) || !fs.existsSync(pngPath) || !fs.existsSync(bboxPath)) {
    console.error('Faltan archivos:', { tifPath, pngPath, bboxPath });
    process.exit(1);
  }

  const bbox = JSON.parse(fs.readFileSync(bboxPath, 'utf8'));
  console.log(`\n${speciesId}/${algoId}`);
  console.log('bbox tif:', bbox);

  const tiff = await fromFile(tifPath);
  const image = await tiff.getImage();
  const data = await image.readRasters();
  const values = data[0];
  const [tifW, tifH] = [image.getWidth(), image.getHeight()];

  const png = await Jimp.read(pngPath);
  const [pngW, pngH] = [png.bitmap.width, png.bitmap.height];
  console.log('tif size', tifW, tifH, 'png size', pngW, pngH);

  const rows = fs.readFileSync(occPath, 'utf8')
    .split('\n').slice(1)
    .filter(l => l.trim())
    .map(l => {
      const [lon, lat] = l.split(',').map(Number);
      return { lon, lat };
    });

  let agreeNorth = 0;
  let agreeSouth = 0;
  let total = 0;

  for (const p of rows) {
    // valor tif en la celda del punto
    const tifPix = geoToPixel(p.lon, p.lat, bbox, tifW, tifH);
    const tifIdx = tifPix.yNorthUp * tifW + tifPix.x;
    const prob = values[tifIdx];
    if (prob === undefined || Number.isNaN(prob)) continue;

    const cat = classify(prob);

    const pngPix = geoToPixel(p.lon, p.lat, bbox, pngW, pngH);
    function getRGBA(x, y) {
      const idx = (y * pngW + x) * 4;
      return { r: png.bitmap.data[idx], g: png.bitmap.data[idx + 1], b: png.bitmap.data[idx + 2] };
    }
    const cNorth = getRGBA(pngPix.x, pngPix.yNorthUp);
    const cSouth = getRGBA(pngPix.x, pngPix.ySouthUp);
    const nameNorth = colorName(cNorth.r, cNorth.g, cNorth.b);
    const nameSouth = colorName(cSouth.r, cSouth.g, cSouth.b);

    // Simplificación: alta/muy alta debería ser rojo/amarillo; baja azul/cian
    const expectedHigh = prob >= 0.3;
    const isHighNorth = ['rojo', 'amarillo'].includes(nameNorth);
    const isHighSouth = ['rojo', 'amarillo'].includes(nameSouth);

    const okNorth = expectedHigh === isHighNorth;
    const okSouth = expectedHigh === isHighSouth;
    if (okNorth) agreeNorth++;
    if (okSouth) agreeSouth++;
    total++;

    if (total <= 10) {
      console.log(`  point ${p.lon.toFixed(4)},${p.lat.toFixed(4)} -> tif prob ${prob.toFixed(3)} (${cat})`);
      console.log(`    PNG north-up (${pngPix.yNorthUp}): ${nameNorth} ${okNorth ? 'OK' : 'NO'}`);
      console.log(`    PNG south-up (${pngPix.ySouthUp}): ${nameSouth} ${okSouth ? 'OK' : 'NO'}`);
    }
  }

  console.log(`\nAciertos north-up (sin voltear): ${agreeNorth}/${total}`);
  console.log(`Aciertos south-up (volteado):    ${agreeSouth}/${total}`);
  if (agreeSouth > agreeNorth) {
    console.log('=> El PNG debe VOLTEARSE verticalmente (flipY) para coincidir con el TIF.');
  } else if (agreeNorth > agreeSouth) {
    console.log('=> El PNG NO debe voltearse; usa orientación north-up directa.');
  } else {
    console.log('=> No se puede determinar la orientación con estos criterios.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
