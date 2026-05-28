/**
 * Configuración dinámica multi-especie, multi-algoritmo, multi-período.
 * Lee el catálogo desde /data/species/index.json
 */

const INDEX_URL = '/data/species/index.json';

let cachedIndex = null;

export async function loadSpeciesIndex() {
  if (cachedIndex) return cachedIndex;
  const res = await fetch(INDEX_URL);
  if (!res.ok) throw new Error(`No se pudo cargar ${INDEX_URL}: ${res.status}`);
  cachedIndex = await res.json();
  return cachedIndex;
}

export function getSpecies(index) {
  return index?.species || [];
}

export function getAlgorithms(index, speciesId) {
  const sp = index?.species?.find(s => s.id === speciesId);
  return sp?.algorithms || [];
}

export function getAlgorithm(index, speciesId, algoId) {
  const algos = getAlgorithms(index, speciesId);
  return algos.find(a => a.id === algoId);
}

export const PERIODS = [
  { id: '2021_2040', label: '2021-2040' },
  { id: '2041_2060', label: '2041-2060' },
  { id: '2061_2080', label: '2061-2080' },
  { id: '2081_2100', label: '2081-2100' },
];

export function getPeriods() {
  return PERIODS;
}

export function getPeriodLabel(periodId) {
  return PERIODS.find(p => p.id === periodId)?.label || periodId;
}

/**
 * Genera el array de escenarios para una combinación especie+algoritmo+período.
 * Cada escenario incluye: id, label, folder, suffix.
 */
export function getScenarios(index, speciesId, algoId, periodId) {
  const algo = getAlgorithm(index, speciesId, algoId);
  if (!algo) return [];

  const periodLabel = getPeriodLabel(periodId);
  const scenarios = [
    {
      id: 'actual',
      label: 'Actual (Presente)',
      folder: 'current',
      suffix: 'Actual',
    },
  ];

  for (const ssp of algo.ssps || []) {
    const sspPeriodSuffix = `${ssp.suffix}_${periodId.replace('_', '-')}`;
    scenarios.push({
      id: `${ssp.id}_${periodId}`,
      label: `${ssp.label} (${periodLabel})`,
      folder: `future/${ssp.id}_${periodId}`,
      suffix: sspPeriodSuffix,
    });
  }

  return scenarios;
}

/**
 * Devuelve las rutas de archivos para un escenario dado.
 */
export function getPaths(index, speciesId, algoId, scenario) {
  const algo = getAlgorithm(index, speciesId, algoId);
  const prefix = algo?.prefix || '';
  const base = `./data/species/${speciesId}/${algoId}/${scenario.folder}/${prefix}_${scenario.suffix}`;

  return {
    geojson: `${base}.geojson`,
    png: `${base}.png`,
    tif: `${base}.tif`,
    metrics: scenario.id === 'actual'
      ? `./data/species/${speciesId}/${algoId}/current/${prefix}_Metrics.json`
      : null,
    config: scenario.id === 'actual'
      ? `./data/species/${speciesId}/${algoId}/current/${prefix}_Config.json`
      : null,
  };
}

/**
 * Ruta del CSV de curvas de respuesta.
 */
export function getCurvesPath(index, speciesId, algoId) {
  const algo = getAlgorithm(index, speciesId, algoId);
  const prefix = algo?.prefix || '';
  return `./data/species/${speciesId}/${algoId}/curves/${prefix}_ResponseCurves.csv`;
}

/**
 * Ruta del PNG de diferencias para un SSP + período dados.
 * El diff compara Actual vs SSP en el período especificado.
 */
export function getDiffPath(index, speciesId, algoId, sspId, periodId) {
  const algo = getAlgorithm(index, speciesId, algoId);
  const ssp = algo?.ssps?.find(s => s.id === sspId);
  if (!ssp || !periodId) return null;
  const prefix = algo?.prefix || '';
  const periodSuffix = periodId.replace('_', '-');
  return `./data/species/${speciesId}/${algoId}/diff/${prefix}_${ssp.suffix}_${periodSuffix}_Diferencias.png`;
}

/**
 * Ruta base para los point clouds de una especie+algoritmo.
 */
export function getPointCloudBase(speciesId, algoId) {
  return `/data/pointcloud/${speciesId}/${algoId}`;
}

/**
 * Ruta al index.json de point clouds.
 */
export function getPointCloudIndexUrl(speciesId, algoId) {
  return `${getPointCloudBase(speciesId, algoId)}/index.json`;
}

// ─── Legacy API (mantener temporalmente para compatibilidad durante refactor) ───

export const SCENARIOS = [
  { id: 'actual', label: 'Actual (Presente)', folder: 'current', suffix: 'Actual' },
  { id: 'ssp126_2081_2100', label: 'SSP1-2.6 (2081-2100)', folder: 'future/ssp126_2081_2100', suffix: 'SSP1-2.6_(Sostenibilidad)_2081-2100' },
  { id: 'ssp245_2081_2100', label: 'SSP2-4.5 (2081-2100)', folder: 'future/ssp245_2081_2100', suffix: 'SSP2-4.5_(Intermedio)_2081-2100' },
  { id: 'ssp370_2081_2100', label: 'SSP3-7.0 (2081-2100)', folder: 'future/ssp370_2081_2100', suffix: 'SSP3-7.0_(Rivalidad_regional)_2081-2100' },
  { id: 'ssp585_2081_2100', label: 'SSP5-8.5 (2081-2100)', folder: 'future/ssp585_2081_2100', suffix: 'SSP5-8.5_(Combustibles_fosiles)_2081-2100' },
];

export function getPathsLegacy(scenario) {
  const SPECIES_PREFIX = 'Pinus_uncinata_Ramond_ex_DC._Random_Forest';
  const BASE = './data/species/Pinus_uncinata/Random_Forest';
  const base = `${BASE}/${scenario.folder}/${SPECIES_PREFIX}_${scenario.suffix}`;
  return {
    geojson: `${base}.geojson`,
    png: `${base}.png`,
    tif: `${base}.tif`,
    metrics: scenario.id === 'actual' ? `${BASE}/current/${SPECIES_PREFIX}_Metrics.json` : null,
    config: scenario.id === 'actual' ? `${BASE}/current/${SPECIES_PREFIX}_Config.json` : null,
  };
}

export function getCurvesPathLegacy() {
  return './data/species/Pinus_uncinata/Random_Forest/curves/ResponseCurves.csv';
}

export function getDiffPathLegacy() {
  return './data/species/Pinus_uncinata/Random_Forest/diff/Pinus_uncinata_Ramond_ex_DC._Random_Forest_Diferencias.png';
}
