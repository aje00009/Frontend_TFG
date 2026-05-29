import { loadSpeciesIndex, getDiffPath, getDiffTablesPath, getPeriods } from '../utils/config.js';

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
    <div id="diff-tables" class="mt-12 max-w-4xl mx-auto"></div>
  `;

  const img = container.querySelector('#diff-img');
  const placeholder = container.querySelector('#diff-placeholder');
  const periodSelect = container.querySelector('#diff-period-select');
  const sspSelect = container.querySelector('#diff-ssp-select');
  const tablesContainer = container.querySelector('#diff-tables');

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

  function fmtNum(v) {
    if (v == null) return '-';
    return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  }

  function fmtPct(v) {
    if (v == null) return '-';
    const sign = v > 0 ? '+' : '';
    return `${sign}${fmtNum(v)}%`;
  }

  function pctColorClass(v) {
    if (v == null) return 'text-gray-400';
    if (v < 0) return 'text-red-400';
    if (v > 0) return 'text-green-400';
    return 'text-gray-400';
  }

  function tableHeader(title) {
    return `
      <div class="flex items-center gap-3 mb-3 mt-8">
        <div class="h-px flex-1 bg-gray-600"></div>
        <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap">${title}</h3>
        <div class="h-px flex-1 bg-gray-600"></div>
      </div>
    `;
  }

  function renderTables(data, ssps) {
    if (!data) {
      tablesContainer.innerHTML = '';
      return;
    }

    const current = data.current || {};
    const futures = data.futures || [];
    const threshold = data.threshold ?? 0.5;

    // Tabla 1: Área por umbral
    let html = tableHeader(`Área por umbral (${threshold})`);
    html += `<table class="w-full text-sm text-left border-collapse">
      <thead>
        <tr class="border-b border-gray-600 text-gray-400">
          <th class="py-2 px-3 font-medium">Escenario</th>
          <th class="py-2 px-3 font-medium text-right">Área (km2)</th>
          <th class="py-2 px-3 font-medium text-right">Cambio (%)</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-700/60">
        <tr class="text-gray-200">
          <td class="py-2 px-3">Actual</td>
          <td class="py-2 px-3 text-right font-mono">${fmtNum(current.occupiedAreaKm2)}</td>
          <td class="py-2 px-3 text-right font-mono text-gray-400">-</td>
        </tr>`;

    futures.forEach(f => {
      html += `<tr class="text-gray-200">
        <td class="py-2 px-3">SDM ${f.scenario} ${f.period?.replace(/-/g, '')}</td>
        <td class="py-2 px-3 text-right font-mono">${fmtNum(f.occupiedAreaKm2)}</td>
        <td class="py-2 px-3 text-right font-mono ${pctColorClass(f.occupiedAreaChangePct)}">${fmtPct(f.occupiedAreaChangePct)}</td>
      </tr>`;
    });

    html += `</tbody></table>`;

    // Tabla 2: Área continua ponderada
    html += tableHeader('Área continua ponderada');
    html += `<table class="w-full text-sm text-left border-collapse">
      <thead>
        <tr class="border-b border-gray-600 text-gray-400">
          <th class="py-2 px-3 font-medium">Escenario</th>
          <th class="py-2 px-3 font-medium text-right">Área cont. (km2)</th>
          <th class="py-2 px-3 font-medium text-right">Cambio (%)</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-700/60">
        <tr class="text-gray-200">
          <td class="py-2 px-3">Actual</td>
          <td class="py-2 px-3 text-right font-mono">${fmtNum(current.continuousAreaKm2)}</td>
          <td class="py-2 px-3 text-right font-mono text-gray-400">-</td>
        </tr>`;

    futures.forEach(f => {
      html += `<tr class="text-gray-200">
        <td class="py-2 px-3">SDM ${f.scenario} ${f.period?.replace(/-/g, '')}</td>
        <td class="py-2 px-3 text-right font-mono">${fmtNum(f.continuousAreaKm2)}</td>
        <td class="py-2 px-3 text-right font-mono ${pctColorClass(f.continuousAreaChangePct)}">${fmtPct(f.continuousAreaChangePct)}</td>
      </tr>`;
    });

    html += `</tbody></table>`;

    // Tabla 3: Balance de hábitat continuo
    html += tableHeader('Balance de hábitat continuo');
    html += `<table class="w-full text-sm text-left border-collapse">
      <thead>
        <tr class="border-b border-gray-600 text-gray-400">
          <th class="py-2 px-3 font-medium">Escenario</th>
          <th class="py-2 px-3 font-medium text-right">Pérdida</th>
          <th class="py-2 px-3 font-medium text-right">Ganancia</th>
          <th class="py-2 px-3 font-medium text-right">Estable</th>
          <th class="py-2 px-3 font-medium text-right">Cambio neto</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-700/60">
        <tr class="text-gray-200">
          <td class="py-2 px-3">Actual</td>
          <td class="py-2 px-3 text-right font-mono text-gray-400">${fmtNum(0)}</td>
          <td class="py-2 px-3 text-right font-mono text-gray-400">${fmtNum(0)}</td>
          <td class="py-2 px-3 text-right font-mono">${fmtNum(current.continuousAreaKm2)}</td>
          <td class="py-2 px-3 text-right font-mono text-gray-400">+0,0%</td>
        </tr>`;

    futures.forEach(f => {
      html += `<tr class="text-gray-200">
        <td class="py-2 px-3">SDM ${f.scenario} ${f.period?.replace(/-/g, '')}</td>
        <td class="py-2 px-3 text-right font-mono text-red-400">${fmtNum(f.habitatLossKm2)}</td>
        <td class="py-2 px-3 text-right font-mono text-green-400">${fmtNum(f.habitatGainKm2)}</td>
        <td class="py-2 px-3 text-right font-mono">${fmtNum(f.habitatStableKm2)}</td>
        <td class="py-2 px-3 text-right font-mono ${pctColorClass(f.netChangePct)}">${fmtPct(f.netChangePct)}</td>
      </tr>`;
    });

    html += `</tbody></table>`;

    tablesContainer.innerHTML = html;
  }

  async function loadTables(speciesId, algoId, periodId, ssps) {
    const path = getDiffTablesPath(index, speciesId, algoId, periodId);
    if (!path) {
      tablesContainer.innerHTML = '';
      return;
    }
    try {
      const res = await fetch(path);
      if (!res.ok) {
        tablesContainer.innerHTML = '';
        return;
      }
      const data = await res.json();
      renderTables(data, ssps);
    } catch (err) {
      console.warn('[DiffMap] No se pudieron cargar las tablas:', err);
      tablesContainer.innerHTML = '';
    }
  }

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
      loadTables(model.species.id, model.algorithm.id, currentPeriodId, ssps);
    } else {
      img.classList.add('hidden');
      placeholder.classList.remove('hidden');
      placeholder.querySelector('span').textContent = 'Selecciona un período y un SSP para ver las diferencias.';
      tablesContainer.innerHTML = '';
    }
  }

  function onSelectionChange() {
    if (!currentModel) return;
    currentPeriodId = periodSelect.value;
    currentSspId = sspSelect.value;
    loadDiffImage(currentModel.species.id, currentModel.algorithm.id, currentPeriodId, currentSspId);
    loadTables(currentModel.species.id, currentModel.algorithm.id, currentPeriodId, currentModel.algorithm?.ssps || []);
  }

  if (periodSelect) {
    periodSelect.addEventListener('change', onSelectionChange);
  }
  if (sspSelect) {
    sspSelect.addEventListener('change', onSelectionChange);
  }

  window.addEventListener('model-changed', (e) => render(e.detail));
}
