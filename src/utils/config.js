/**
 * Configuración dinámica multi-especie, multi-algoritmo, multi-período.
 * Lee el catálogo desde ./web/data/index.json generado por GEU.
 */

const DATA_BASE = import.meta.env.VITE_DATA_BASE || './web/data';
const POINTCLOUD_BASE = import.meta.env.VITE_POINTCLOUD_BASE || './data/pointcloud';
const INDEX_URL = `${DATA_BASE}/index.json`;

/**
 * Zonas DEM por especie. Permite que cada especie use el relieve correcto
 * sin duplicar terrenos por algoritmo.
 */
const TERRAIN_ZONES = {
  abies_alba: 'pirineos',
  fagus_sylvatica: 'pirineos',
  pinus_uncinata: 'pirineos',
  pinus_nigra: 'sierra_magina',
  pinus_halapensis: 'sierra_magina',
  juniperus_communis: 'sierra_magina',
};

let cachedIndex = null;

export const PERIODS = [
  { id: '2021_2040', label: '2021-2040' },
  { id: '2041_2060', label: '2041-2060' },
  { id: '2061_2080', label: '2061-2080' },
  { id: '2081_2100', label: '2081-2100' },
];

const SPECIES_LABELS = {
  abies_alba: 'Abies alba',
  fagus_sylvatica: 'Fagus sylvatica',
  juniperus_communis: 'Juniperus communis',
  pinus_halapensis: 'Pinus halepensis',
  pinus_nigra: 'Pinus nigra',
  pinus_uncinata: 'Pinus uncinata',
};

function titleCase(str) {
  return str.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

function getSpeciesLabel(id) {
  return SPECIES_LABELS[id] || titleCase(id.replace(/_/g, ' '));
}

function normalizeId(label) {
  return label.replace(/\s+/g, '_');
}

/**
 * Parsea una etiqueta de SSP del index.json.
 * Ejemplo: "SSP1-2.6 (Sostenibilidad)" ->
 *   { id: 'ssp126', label: 'SSP1-2.6 (Sostenibilidad)', suffix: 'SSP1-2.6_(Sostenibilidad)' }
 */
function parseSsp(sspLabel) {
  const match = String(sspLabel).trim().match(/^SSP(\d+)[-\.]([\d.]+)\s*\(([^)]+)\)$/);
  if (!match) return null;
  const code = match[1] + match[2].replace(/\./g, '');
  const category = match[3].trim().replace(/\s+/g, '_');
  const codeLabel = `SSP${match[1]}-${match[2]}`;
  return {
    id: `ssp${code}`,
    label: `${codeLabel} (${match[3].trim()})`,
    suffix: `${codeLabel}_(${category})`,
  };
}

function parsePeriod(periodLabel) {
  return {
    id: String(periodLabel).trim().replace(/-/g, '_'),
    label: String(periodLabel).trim(),
  };
}

/**
 * Enriquece el index.json crudo con objetos listos para usar en los selectores.
 */
function enrichIndex(raw) {
  if (!raw || typeof raw !== 'object') return { species: [], periods: PERIODS, ssps: [] };

  const algorithmList = (raw.algorithms || []).map((label) => ({
    id: normalizeId(label),
    label,
  }));

  const ssps = (raw.ssps || []).map(parseSsp).filter(Boolean);
  const periods = (raw.periods || PERIODS.map((p) => p.label)).map(parsePeriod);

  return {
    ...raw,
    periods,
    ssps,
    species: (raw.species || []).map((id) => ({
      id,
      label: getSpeciesLabel(id),
      algorithms: algorithmList.map((algo) => ({
        ...algo,
        prefix: `${id}_${algo.id}`,
        ssps,
        periods: periods.map((p) => p.id),
      })),
    })),
  };
}

export async function loadSpeciesIndex() {
  if (cachedIndex) return cachedIndex;
  const res = await fetch(INDEX_URL);
  if (!res.ok) throw new Error(`No se pudo cargar ${INDEX_URL}: ${res.status}`);
  cachedIndex = enrichIndex(await res.json());
  return cachedIndex;
}

export function getSpecies(index) {
  return index?.species || [];
}

export function getAlgorithms(index, speciesId) {
  const sp = index?.species?.find((s) => s.id === speciesId);
  return sp?.algorithms || [];
}

export function getAlgorithm(index, speciesId, algoId) {
  const algos = getAlgorithms(index, speciesId);
  return algos.find((a) => a.id === algoId);
}

export function getPeriods() {
  return PERIODS;
}

export function getPeriodLabel(periodId) {
  return PERIODS.find((p) => p.id === periodId)?.label || periodId;
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
    scenarios.push({
      id: `${ssp.id}_${periodId}`,
      label: `${ssp.label} (${periodLabel})`,
      folder: `future/${ssp.id}_${periodId}`,
      suffix: `${ssp.suffix}_${periodLabel}`,
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
  const base = `${DATA_BASE}/species/${speciesId}/${algoId}/${scenario.folder}/${prefix}_${scenario.suffix}`;

  return {
    geojson: `${base}.geojson`,
    png: `${base}.png`,
    tif: `${base}.tif`,
    bbox: `${base}_bbox.json`,
    csv: `${base}.csv`,
    metrics: `${DATA_BASE}/species/${speciesId}/${algoId}/${prefix}_Metrics.json`,
    config: `${DATA_BASE}/species/${speciesId}/${algoId}/${prefix}_Config.json`,
  };
}

/**
 * Ruta del CSV de curvas de respuesta.
 */
export function getCurvesPath(index, speciesId, algoId) {
  const algo = getAlgorithm(index, speciesId, algoId);
  const prefix = algo?.prefix || '';
  return `${DATA_BASE}/species/${speciesId}/${algoId}/curves/${prefix}_ResponseCurves.csv`;
}

/**
 * Ruta del PNG de diferencias para un SSP + período dados.
 */
export function getDiffPath(index, speciesId, algoId, sspId, periodId) {
  const algo = getAlgorithm(index, speciesId, algoId);
  const ssp = algo?.ssps?.find((s) => s.id === sspId);
  if (!ssp || !periodId) return null;
  const prefix = algo?.prefix || '';
  const periodLabel = getPeriodLabel(periodId);
  return `${DATA_BASE}/species/${speciesId}/${algoId}/diff/${prefix}_${ssp.suffix}_${periodLabel}_Diferencias.png`;
}

/**
 * Ruta del JSON de tablas de diferencias.
 */
export function getDiffTablesPath(index, speciesId, algoId, periodId) {
  const algo = getAlgorithm(index, speciesId, algoId);
  if (!algo) return null;
  const prefix = algo?.prefix || '';
  return `${DATA_BASE}/species/${speciesId}/${algoId}/diff/${prefix}_DifferenceTables.json`;
}

/**
 * Ruta del CSV de ocurrencias (puntos de presencia) de una especie.
 * Formato esperado: longitude,latitude[,elevation]
 */
export function getOccurrencesPath(index, speciesId, algoId) {
  return `${DATA_BASE}/species/${speciesId}/common/${speciesId}_Occurrences.csv`;
}

/**
 * Ruta base para el DEM específico de una especie+algoritmo.
 * Si no existe, el visor 3D debería hacer fallback al DEM global.
 */
export function getTerrainBase(speciesId, algoId) {
  const zone = TERRAIN_ZONES[speciesId];
  if (zone) return `${DATA_BASE}/terrain/${zone}`;
  return `${DATA_BASE}/species/${speciesId}/${algoId}/terrain`;
}

/**
 * Ruta base para los point clouds legacy de una especie+algoritmo.
 */
export function getPointCloudBase(speciesId, algoId) {
  return `${POINTCLOUD_BASE}/${speciesId}/${algoId}`;
}

/**
 * Ruta al index.json de point clouds.
 */
export function getPointCloudIndexUrl(speciesId, algoId) {
  return `${getPointCloudBase(speciesId, algoId)}/index.json`;
}
