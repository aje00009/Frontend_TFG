import { loadSpeciesIndex, getDiffPath, getPeriods } from '../utils/config.js';

export async function initDiffMap(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <h2 class="text-3xl font-bold mb-2 text-center">Mapa de Diferencias</h2>
    <p class="text-center text-gray-400 mb-4">Comparación futuro vs actual: <span class="text-red-400 font-medium">rojo = pérdida</span>, <span class="text-green-400 font-medium">verde = ganancia</span>.</p>
    <div class="flex justify-center gap-4 mb-6 flex-wrap">
      <div class="bg-black/40 backdrop-blur px-4 py-2 rounded-lg border border-white/10 flex items-center gap-3">
        <label class="text-xs text-gray-400 uppercase tracking-wider font-medium">Período:</label>
        <select id="diff-period-select" class="geu-select text-xs py-1 min-w-[140px]">
          <option value="" disabled selected>Cargando...</option>
        </select>
      </div>
      <div class="bg-black/40 backdrop-blur px-4 py-2 rounded-lg border border-white/10 flex items-center gap-3">
        <label class="text-xs text-gray-400 uppercase tracking-wider font-medium">SSP:</label>
        <select id="diff-ssp-select" class="geu-select text-xs py-1 min-w-[200px]">
          <option value="" disabled selected>Cargando...</option>
        </select>
      </div>
    </div>
    <div class="relative w-full flex justify-center">
      <img id="diff-img" src="" alt="Mapa de diferencias" class="rounded-xl border border-white/10 max-w-full shadow-2xl hidden" />
      <div id="diff-placeholder" class="geu-card w-full max-w-4xl h-96 flex flex-col items-center justify-center text-gray-500 gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>Selecciona un período y un SSP para ver el mapa de diferencias.</span>
        <span class="text-xs text-gray-600">Los archivos PNG deben estar en <code>public/data/species/{especie}/{algoritmo}/diff/</code></span>
      </div>
    </div>
    <div class="flex justify-center gap-6 mt-6">
      <div class="flex items-center gap-2 text-sm text-gray-300"><span class="inline-block w-4 h-4 rounded bg-red-500"></span> Pérdida de hábitat</div>
      <div class="flex items-center gap-2 text-sm text-gray-300"><span class="inline-block w-4 h-4 rounded bg-green-500"></span> Ganancia de hábitat</div>
      <div class="flex items-center gap-2 text-sm text-gray-300"><span class="inline-block w-4 h-4 rounded bg-gray-500"></span> Sin cambio</div>
    </div>
  `;

  const img = container.querySelector('#diff-img');
  const placeholder = container.querySelector('#diff-placeholder');
  const periodSelect = container.querySelector('#diff-period-select');
  const sspSelect = container.querySelector('#diff-ssp-select');

  let index;
  try {
    index = await loadSpeciesIndex();
  } catch (err) {
    console.error('[DiffMap] Error cargando catálogo:', err);
    return;
  }

  let currentModel = null;
  let currentPeriodId = null;
  let currentSspId = null;

  const allPeriods = getPeriods();

  function extractPeriodAndSsp(scenarioId) {
    if (!scenarioId || scenarioId === 'actual') return { periodId: null, sspId: null };
    const parts = scenarioId.split('_');
    const sspId = parts[0];
    const periodId = parts.slice(1).join('_');
    return { periodId, sspId };
  }

  function updatePeriodOptions(periods, selectedId) {
    if (!periodSelect || !periods?.length) return;
    const options = periods.map(p =>
      `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.label}</option>`
    ).join('');
    periodSelect.innerHTML = options;
  }

  function updateSspOptions(ssps, selectedId) {
    if (!sspSelect || !ssps?.length) return;
    const options = ssps.map(s =>
      `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${s.label}</option>`
    ).join('');
    sspSelect.innerHTML = options;
  }

  function loadDiffImage(speciesId, algoId, periodId, sspId) {
    const path = getDiffPath(index, speciesId, algoId, sspId, periodId);
    if (!path) {
      img.classList.add('hidden');
      placeholder.classList.remove('hidden');
      placeholder.querySelector('span').textContent = 'No se encontró la ruta de diferencias para esta combinación.';
      return;
    }

    fetch(path)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); })
      .then(() => {
        img.src = path;
        img.classList.remove('hidden');
        placeholder.classList.add('hidden');
      })
      .catch(() => {
        img.classList.add('hidden');
        placeholder.classList.remove('hidden');
        placeholder.querySelector('span').textContent = 'Archivo no disponible todavía. Añade el PNG a la carpeta correspondiente.';
      });
  }

  function render(model, forcePeriodId = null, forceSspId = null) {
    if (!model) return;
    currentModel = model;

    const ssps = model.algorithm?.ssps || [];
    const algoPeriods = model.algorithm?.periods || allPeriods.map(p => p.id);
    const availablePeriods = allPeriods.filter(p => algoPeriods.includes(p.id));

    // Extraer period/ssp del escenario actual
    const { periodId: scenarioPeriodId, sspId: scenarioSspId } = extractPeriodAndSsp(model.scenario.id);

    // Determinar qué valores usar
    const defaultPeriodId = forcePeriodId || scenarioPeriodId || currentPeriodId || availablePeriods[availablePeriods.length - 1]?.id;
    const defaultSspId = forceSspId || scenarioSspId || currentSspId || ssps[0]?.id;

    // Actualizar selects solo si cambió el algoritmo/especie
    const prevPeriodOptions = Array.from(periodSelect.options).map(o => o.value);
    const newPeriodIds = availablePeriods.map(p => p.id);
    const periodsChanged = prevPeriodOptions.length !== newPeriodIds.length || prevPeriodOptions.some((id, i) => id !== newPeriodIds[i]);

    if (periodsChanged) {
      updatePeriodOptions(availablePeriods, defaultPeriodId);
    }

    const prevSspOptions = Array.from(sspSelect.options).map(o => o.value);
    const newSspIds = ssps.map(s => s.id);
    const sspsChanged = prevSspOptions.length !== newSspIds.length || prevSspOptions.some((id, i) => id !== newSspIds[i]);

    if (sspsChanged) {
      updateSspOptions(ssps, defaultSspId);
    }

    // Asegurar que los valores estén seleccionados
    if (periodSelect.value !== defaultPeriodId) periodSelect.value = defaultPeriodId;
    if (sspSelect.value !== defaultSspId) sspSelect.value = defaultSspId;

    currentPeriodId = defaultPeriodId;
    currentSspId = defaultSspId;

    if (currentPeriodId && currentSspId) {
      loadDiffImage(model.species.id, model.algorithm.id, currentPeriodId, currentSspId);
    } else {
      img.classList.add('hidden');
      placeholder.classList.remove('hidden');
      placeholder.querySelector('span').textContent = 'Selecciona un período y un SSP para ver las diferencias.';
    }
  }

  function onSelectionChange() {
    if (!currentModel) return;
    currentPeriodId = periodSelect.value;
    currentSspId = sspSelect.value;
    loadDiffImage(currentModel.species.id, currentModel.algorithm.id, currentPeriodId, currentSspId);
  }

  if (periodSelect) {
    periodSelect.addEventListener('change', onSelectionChange);
  }
  if (sspSelect) {
    sspSelect.addEventListener('change', onSelectionChange);
  }

  window.addEventListener('model-changed', (e) => render(e.detail));
}
