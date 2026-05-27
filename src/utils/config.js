// Nombres exactos de los archivos que exporta GEU
const SPECIES_PREFIX = 'Pinus_uncinata_Ramond_ex_DC._Random_Forest';
const BASE = './data/species';

// Cada escenario mapea a la carpeta y al sufijo del nombre de archivo
export const SCENARIOS = [
  { id: 'actual', label: 'Actual (Presente)', folder: 'current', suffix: 'Actual' },
  { id: 'ssp126_2081_2100', label: 'SSP1-2.6 (2081-2100)', folder: 'future/ssp126_2081_2100', suffix: 'SSP1-2.6_(Sostenibilidad)_2081-2100' },
  { id: 'ssp245_2081_2100', label: 'SSP2-4.5 (2081-2100)', folder: 'future/ssp245_2081_2100', suffix: 'SSP2-4.5_(Intermedio)_2081-2100' },
  { id: 'ssp370_2081_2100', label: 'SSP3-7.0 (2081-2100)', folder: 'future/ssp370_2081_2100', suffix: 'SSP3-7.0_(Rivalidad_regional)_2081-2100' },
  { id: 'ssp585_2081_2100', label: 'SSP5-8.5 (2081-2100)', folder: 'future/ssp585_2081_2100', suffix: 'SSP5-8.5_(Combustibles_fosiles)_2081-2100' },
];

export function getPaths(scenario) {
  const base = `${BASE}/${scenario.folder}/${SPECIES_PREFIX}_${scenario.suffix}`;
  return {
    geojson: `${base}.geojson`,
    png: `${base}.png`,
    tif: `${base}.tif`,
    metrics: scenario.id === 'actual'
      ? `${BASE}/current/${SPECIES_PREFIX}_Metrics.json`
      : null,
    config: scenario.id === 'actual'
      ? `${BASE}/current/${SPECIES_PREFIX}_Config.json`
      : null,
  };
}

export function getCurvesPath() {
  return `${BASE}/curves/${SPECIES_PREFIX}_ResponseCurves.csv`;
}

export function getDiffPath() {
  return `${BASE}/diff/${SPECIES_PREFIX}_Diferencias.png`;
}
