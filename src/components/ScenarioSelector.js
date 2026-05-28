import {
  loadSpeciesIndex,
  getSpecies,
  getAlgorithms,
  getAlgorithm,
  getPeriods,
  getScenarios,
  getPaths,
} from '../utils/config.js';

export async function initScenarioSelector(onChange) {
  const container = document.getElementById('scenario-selector');
  if (!container) return;

  let index;
  try {
    index = await loadSpeciesIndex();
  } catch (err) {
    console.error('[ScenarioSelector] Error cargando catálogo:', err);
    container.innerHTML = `<div class="text-red-400 text-sm">Error cargando catálogo de especies</div>`;
    return;
  }

  const speciesList = getSpecies(index);
  if (speciesList.length === 0) {
    container.innerHTML = `<div class="text-red-400 text-sm">No hay especies disponibles</div>`;
    return;
  }

  const periods = getPeriods();

  // Estado actual
  let currentSpecies = speciesList[0];
  let currentAlgo = getAlgorithms(index, currentSpecies.id)[0];
  let currentPeriod = periods[periods.length - 1]; // 2081-2100 por defecto
  let currentScenarios = getScenarios(index, currentSpecies.id, currentAlgo.id, currentPeriod.id);
  let currentScenario = currentScenarios[0];

  function renderOptions() {
    container.innerHTML = `
      <div class="flex flex-wrap items-center gap-3 bg-geu-panel/90 backdrop-blur px-5 py-3 rounded-2xl border border-white/10 shadow-2xl">
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-400 font-medium">Especie:</label>
          <select id="species-select" class="geu-select min-w-[180px]">
            ${speciesList.map(s => `<option value="${s.id}" ${s.id === currentSpecies.id ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-400 font-medium">Algoritmo:</label>
          <select id="algorithm-select" class="geu-select min-w-[160px]">
            ${getAlgorithms(index, currentSpecies.id).map(a => `<option value="${a.id}" ${a.id === currentAlgo.id ? 'selected' : ''}>${a.label}</option>`).join('')}
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-400 font-medium">Período:</label>
          <select id="period-select" class="geu-select min-w-[120px]">
            ${periods.map(p => `<option value="${p.id}" ${p.id === currentPeriod.id ? 'selected' : ''}>${p.label}</option>`).join('')}
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-400 font-medium">Escenario:</label>
          <select id="scenario-select" class="geu-select min-w-[260px]">
            ${currentScenarios.map(s => `<option value="${s.id}" ${s.id === currentScenario.id ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </div>
      </div>
    `;

    const speciesSelect = container.querySelector('#species-select');
    const algoSelect = container.querySelector('#algorithm-select');
    const periodSelect = container.querySelector('#period-select');
    const scenarioSelect = container.querySelector('#scenario-select');

    speciesSelect.addEventListener('change', () => {
      currentSpecies = speciesList.find(s => s.id === speciesSelect.value);
      const algos = getAlgorithms(index, currentSpecies.id);
      currentAlgo = algos[0] || null;
      if (currentAlgo) {
        currentScenarios = getScenarios(index, currentSpecies.id, currentAlgo.id, currentPeriod.id);
        currentScenario = currentScenarios[0] || null;
      }
      renderOptions();
      emitCurrent();
    });

    algoSelect.addEventListener('change', () => {
      currentAlgo = getAlgorithms(index, currentSpecies.id).find(a => a.id === algoSelect.value);
      if (currentAlgo) {
        currentScenarios = getScenarios(index, currentSpecies.id, currentAlgo.id, currentPeriod.id);
        currentScenario = currentScenarios[0] || null;
      }
      renderOptions();
      emitCurrent();
    });

    periodSelect.addEventListener('change', () => {
      currentPeriod = periods.find(p => p.id === periodSelect.value);
      if (currentAlgo) {
        currentScenarios = getScenarios(index, currentSpecies.id, currentAlgo.id, currentPeriod.id);
        // Intentar mantener el mismo SSP si está disponible en el nuevo período
        const prevSsp = currentScenario.id.split('_')[0];
        const matching = currentScenarios.find(s => s.id.startsWith(prevSsp + '_'));
        currentScenario = matching || currentScenarios[0] || null;
      }
      renderOptions();
      emitCurrent();
    });

    scenarioSelect.addEventListener('change', () => {
      currentScenario = currentScenarios.find(s => s.id === scenarioSelect.value);
      emitCurrent();
    });
  }

  function emitCurrent() {
    if (!currentSpecies || !currentAlgo || !currentScenario) return;
    const paths = getPaths(index, currentSpecies.id, currentAlgo.id, currentScenario);
    const detail = {
      species: currentSpecies,
      algorithm: currentAlgo,
      period: currentPeriod,
      scenario: currentScenario,
      paths,
    };
    onChange(detail);
  }

  renderOptions();
  emitCurrent();
}
