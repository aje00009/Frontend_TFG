#!/usr/bin/env node
/**
 * Extrae el bounding box real de cada GeoTIFF de predicción
 * y genera un archivo {nombre}_bbox.json junto a cada PNG/GeoTIFF.
 *
 * El frontend usará estos bbox.json para georreferenciar el heatmap
 * en lugar de calcularlo desde el GeoJSON (que puede estar recortado).
 *
 * Uso:
 *   node scripts/extract-bboxes.cjs
 */

const fs = require('fs');
const path = require('path');
const { fromFile } = require('geotiff');

const BASE_DIR = path.join(__dirname, '..', 'public', 'web', 'data', 'species');

async function extractBboxes() {
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

      // Recorrer current y future
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
        const tifFiles = fs.readdirSync(scenarioPath)
          .filter((name) => name.endsWith('.tif'));

        if (tifFiles.length === 0) continue;

        // Preferir el *_probabilidad.tif, sino cualquier .tif
        const tifName = tifFiles.find((name) => name.includes('_probabilidad')) || tifFiles[0];
        const tifPath = path.join(scenarioPath, tifName);

        // El nombre base es el del PNG/GeoTIFF sin extensión (el .tif normal o probabilidad)
        // Usamos el primer .tif que NO sea probabilidad si existe, para que el nombre coincida con el PNG
        const baseTifName = tifFiles.find((name) => !name.includes('_probabilidad')) || tifName;
        const baseName = path.basename(baseTifName, '.tif');
        const bboxPath = path.join(scenarioPath, `${baseName}_bbox.json`);

        try {
          const tiff = await fromFile(tifPath);
          const image = await tiff.getImage();
          const bbox = image.getBoundingBox();

          const meta = {
            source: tifName,
            west: bbox[0],
            south: bbox[1],
            east: bbox[2],
            north: bbox[3],
          };

          fs.writeFileSync(bboxPath, JSON.stringify(meta, null, 2));
          count++;
        } catch (err) {
          console.error(`✗ ${tifPath}: ${err.message}`);
          errors++;
        }
      }
    }
  }

  console.log(`\n✅ ${count} bbox.json generados`);
  if (errors > 0) console.log(`✗ ${errors} errores`);
}

extractBboxes().catch((err) => {
  console.error('Error general:', err);
  process.exit(1);
});
