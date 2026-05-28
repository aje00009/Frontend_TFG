#!/usr/bin/env node
/**
 * Migra los datos de la estructura antigua (monoespecie) a la nueva (multi-especie).
 *
 * Estructura antigua:
 *   public/data/species/current/
 *   public/data/species/future/{ssp}_2081_2100/
 *   public/data/species/curves/
 *   public/data/species/diff/
 *   public/data/pointcloud/
 *
 * Estructura nueva:
 *   public/data/species/{especie}/{algoritmo}/current/
 *   public/data/species/{especie}/{algoritmo}/future/{ssp}_2081_2100/
 *   public/data/species/{especie}/{algoritmo}/curves/
 *   public/data/species/{especie}/{algoritmo}/diff/
 *   public/data/pointcloud/{especie}/{algoritmo}/
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'public', 'data');
const SPECIES_DIR = path.join(DATA_DIR, 'species');
const POINTCLOUD_DIR = path.join(DATA_DIR, 'pointcloud');

const SPECIES_ID = 'Pinus_uncinata';
const ALGO_ID = 'Random_Forest';
const PREFIX = 'Pinus_uncinata_Ramond_ex_DC._Random_Forest';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('  📁 Creado:', dir);
  }
}

function moveFile(src, dst) {
  if (!fs.existsSync(src)) {
    console.warn('  ⚠️ No existe:', src);
    return;
  }
  ensureDir(path.dirname(dst));
  fs.renameSync(src, dst);
  console.log('  ➡️ ', path.relative(ROOT, src), '→', path.relative(ROOT, dst));
}

function copyFile(src, dst) {
  if (!fs.existsSync(src)) {
    console.warn('  ⚠️ No existe:', src);
    return;
  }
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
  console.log('  📋', path.relative(ROOT, src), '→', path.relative(ROOT, dst));
}

function main() {
  console.log('\n🚀 Iniciando migración de datos...\n');

  const targetBase = path.join(SPECIES_DIR, SPECIES_ID, ALGO_ID);
  const targetPointcloud = path.join(POINTCLOUD_DIR, SPECIES_ID, ALGO_ID);

  // 1. Migrar current/
  console.log('\n📂 Migrando current/');
  const currentSrc = path.join(SPECIES_DIR, 'current');
  const currentDst = path.join(targetBase, 'current');
  for (const file of fs.readdirSync(currentSrc)) {
    moveFile(path.join(currentSrc, file), path.join(currentDst, file));
  }
  fs.rmdirSync(currentSrc);

  // 2. Migrar future/
  console.log('\n📂 Migrando future/');
  const futureSrc = path.join(SPECIES_DIR, 'future');
  const futureDst = path.join(targetBase, 'future');
  for (const sspDir of fs.readdirSync(futureSrc)) {
    const sspSrc = path.join(futureSrc, sspDir);
    const sspDst = path.join(futureDst, sspDir);
    for (const file of fs.readdirSync(sspSrc)) {
      moveFile(path.join(sspSrc, file), path.join(sspDst, file));
    }
    fs.rmdirSync(sspSrc);
  }
  fs.rmdirSync(futureSrc);

  // 3. Migrar curves/
  console.log('\n📂 Migrando curves/');
  const curvesSrc = path.join(SPECIES_DIR, 'curves');
  const curvesDst = path.join(targetBase, 'curves');
  for (const file of fs.readdirSync(curvesSrc)) {
    moveFile(path.join(curvesSrc, file), path.join(curvesDst, file));
  }
  fs.rmdirSync(curvesSrc);

  // 4. diff/ puede estar vacío, pero lo movemos igual
  console.log('\n📂 Migrando diff/');
  const diffSrc = path.join(SPECIES_DIR, 'diff');
  const diffDst = path.join(targetBase, 'diff');
  if (fs.existsSync(diffSrc)) {
    for (const file of fs.readdirSync(diffSrc)) {
      moveFile(path.join(diffSrc, file), path.join(diffDst, file));
    }
    fs.rmdirSync(diffSrc);
  }

  // 5. Migrar point clouds
  console.log('\n📂 Migrando pointclouds/');
  ensureDir(targetPointcloud);
  const oldPlyFiles = fs.readdirSync(POINTCLOUD_DIR).filter(f => f.endsWith('.ply'));
  for (const file of oldPlyFiles) {
    moveFile(path.join(POINTCLOUD_DIR, file), path.join(targetPointcloud, file));
  }

  // 6. Crear species/index.json
  console.log('\n📝 Creando species/index.json');
  const index = {
    species: [
      {
        id: SPECIES_ID,
        label: 'Pinus uncinata',
        algorithms: [
          {
            id: ALGO_ID,
            label: 'Random Forest',
            prefix: PREFIX,
            periods: ['2021_2040', '2041_2060', '2061_2080', '2081_2100'],
            ssps: [
              { id: 'ssp126', label: 'SSP1-2.6', suffix: 'SSP1-2.6_(Sostenibilidad)' },
              { id: 'ssp245', label: 'SSP2-4.5', suffix: 'SSP2-4.5_(Intermedio)' },
              { id: 'ssp370', label: 'SSP3-7.0', suffix: 'SSP3-7.0_(Rivalidad_regional)' },
              { id: 'ssp585', label: 'SSP5-8.5', suffix: 'SSP5-8.5_(Combustibles_fosiles)' },
            ],
          },
        ],
      },
    ],
  };
  fs.writeFileSync(path.join(SPECIES_DIR, 'index.json'), JSON.stringify(index, null, 2));
  console.log('  ✅', path.relative(ROOT, path.join(SPECIES_DIR, 'index.json')));

  // 7. Crear pointcloud index.json
  console.log('\n📝 Creando pointcloud/index.json');
  const scenarioMap = {
    [`${PREFIX}_Actual.ply`]: 'actual',
    [`${PREFIX}_SSP1-2.6_(Sostenibilidad)_2081-2100(1).ply`]: 'ssp126_2081_2100',
    [`${PREFIX}_SSP2-4.5_(Intermedio)_2081-2100.ply`]: 'ssp245_2081_2100',
    [`${PREFIX}_SSP3-7.0_(Rivalidad_regional)_2081-2100.ply`]: 'ssp370_2081_2100',
    [`${PREFIX}_SSP5-8.5_(Combustibles_fosiles)_2081-2100.ply`]: 'ssp585_2081_2100',
  };
  const labelMap = {
    actual: 'Actual',
    ssp126_2081_2100: 'SSP1-2.6 (2081-2100)',
    ssp245_2081_2100: 'SSP2-4.5 (2081-2100)',
    ssp370_2081_2100: 'SSP3-7.0 (2081-2100)',
    ssp585_2081_2100: 'SSP5-8.5 (2081-2100)',
  };

  const pcIndex = [];
  for (const [file, scenarioId] of Object.entries(scenarioMap)) {
    if (fs.existsSync(path.join(targetPointcloud, file))) {
      pcIndex.push({
        label: labelMap[scenarioId],
        url: `/data/pointcloud/${SPECIES_ID}/${ALGO_ID}/${file}`,
        scenarioId,
      });
    }
  }
  fs.writeFileSync(path.join(targetPointcloud, 'index.json'), JSON.stringify(pcIndex, null, 2));
  console.log('  ✅', path.relative(ROOT, path.join(targetPointcloud, 'index.json')));

  // 8. Borrar index.json antiguo de pointcloud
  const oldPcIndex = path.join(POINTCLOUD_DIR, 'index.json');
  if (fs.existsSync(oldPcIndex)) {
    fs.unlinkSync(oldPcIndex);
    console.log('  🗑️  Borrado:', path.relative(ROOT, oldPcIndex));
  }

  console.log('\n✅ Migración completada.\n');
}

main();
