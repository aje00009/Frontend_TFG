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
  let mobileExpanded = false;

  function renderOptions() {
    const optionsVisibleClass = mobileExpanded ? 'grid' : 'hidden';
    container.innerHTML = `
      <div class="flex flex-col items-stretch gap-2 bg-geu-panel/90 backdrop-blur px-3 sm:px-4 py-3 rounded-2xl border border-terra-divider/10 shadow-2xl w-full max-w-full">
        <button id="selector-mobile-toggle" type="button" class="sm:hidden flex items-center justify-between w-full text-left group" aria-expanded="${mobileExpanded}" aria-controls="selector-options">
          <span class="text-xs font-semibold text-terra-text uppercase tracking-wide">Filtros del modelo</span>
          <svg id="selector-chevron" class="w-4 h-4 text-terra-muted transition-transform duration-200 ${mobileExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>
        <div id="selector-options" class="${optionsVisibleClass} sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div class="flex flex-col gap-1 min-w-0">
            <label class="text-xs text-terra-muted font-medium whitespace-nowrap">Especie:</label>
            <select id="species-select" class="geu-select w-full min-w-0">
              ${speciesList.map(s => `<option value="${s.id}" ${s.id === currentSpecies.id ? 'selected' : ''}>${s.label}</option>`).join('')}
            </select>
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <label class="text-xs text-terra-muted font-medium whitespace-nowrap">Algoritmo:</label>
            <select id="algorithm-select" class="geu-select w-full min-w-0">
              ${getAlgorithms(index, currentSpecies.id).map(a => `<option value="${a.id}" ${a.id === currentAlgo.id ? 'selected' : ''}>${a.label}</option>`).join('')}
            </select>
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <label class="text-xs text-terra-muted font-medium whitespace-nowrap">Período:</label>
            <select id="period-select" class="geu-select w-full min-w-0">
              ${periods.map(p => `<option value="${p.id}" ${p.id === currentPeriod.id ? 'selected' : ''}>${p.label}</option>`).join('')}
            </select>
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <label class="text-xs text-terra-muted font-medium whitespace-nowrap">Escenario:</label>
            <select id="scenario-select" class="geu-select w-full min-w-0">
              ${currentScenarios.map(s => `<option value="${s.id}" ${s.id === currentScenario.id ? 'selected' : ''}>${s.label}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    `;

    const speciesSelect = container.querySelector('#species-select');
    const algoSelect = container.querySelector('#algorithm-select');
    const periodSelect = container.querySelector('#period-select');
    const scenarioSelect = container.querySelector('#scenario-select');
    const mobileToggle = container.querySelector('#selector-mobile-toggle');

    if (mobileToggle) {
      mobileToggle.addEventListener('click', () => {
        mobileExpanded = !mobileExpanded;
        renderOptions();
      });
    }

    speciesSelect.addEventListener('change', () => {
      currentSpecies = speciesList.find(s => s.id === speciesSelect.value);
      const algos = getAlgorithms(index, currentSpecies.id);
      const prevAlgoId = currentAlgo?.id;
      currentAlgo = algos.find(a => a.id === prevAlgoId) || algos[0] || null;
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
