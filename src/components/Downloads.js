import JSZip from 'jszip';
import { loadSpeciesIndex, getPaths, getCurvesPath, getDiffPath, getDiffTablesPath, getOccurrencesPath } from '../utils/config.js';

export async function initDownloads(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <h2 class="text-3xl font-bold mb-2 text-center">Descargas</h2>
    <p class="text-center text-terra-muted mb-4">Archivos exportados por GEU para la especie y escenario seleccionados.</p>
    <div class="flex justify-center mb-6">
      <button id="downloads-all-btn" class="terra-btn flex items-center gap-2" disabled>
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
        </svg>
        Descargar todo (.zip)
      </button>
    </div>
    <div id="downloads-grid" class="flex flex-wrap justify-center gap-4"></div>
    <div id="downloads-info" class="mt-6 text-center text-terra-muted text-sm hidden">
      No hay archivos disponibles.
    </div>
    <div id="downloads-status" class="mt-4 text-center text-xs text-terra-accent hidden"></div>
  `;

  const grid = container.querySelector('#downloads-grid');
  const info = container.querySelector('#downloads-info');
  const allBtn = container.querySelector('#downloads-all-btn');
  const statusEl = container.querySelector('#downloads-status');

  let index;
  try {
    index = await loadSpeciesIndex();
  } catch (err) {
    console.error('[Downloads] Error cargando catálogo:', err);
    info.classList.remove('hidden');
    return;
  }

  function makeCard(label, path) {
    const filename = path.split('/').pop();
    const a = document.createElement('a');
    a.href = path;
    a.download = filename;
    a.className = 'geu-card flex items-center gap-3 hover:border-geu-accent transition-colors cursor-pointer min-w-[260px]';
    a.innerHTML = `
      <svg class="w-6 h-6 text-geu-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
      </svg>
      <div>
        <div class="font-medium text-sm">${label}</div>
        <div class="text-xs text-terra-subtle truncate max-w-[200px]">${filename}</div>
      </div>
    `;
    return a;
  }

  function getDownloadItems(model) {
    if (!model) return [];
    const paths = getPaths(index, model.species.id, model.algorithm.id, model.scenario);
    const items = [];

    if (paths.png) items.push({ label: 'Heatmap PNG', path: paths.png });
    if (paths.geojson) items.push({ label: 'GeoJSON puntos', path: paths.geojson });
    if (paths.tif) items.push({ label: 'GeoTIFF', path: paths.tif });
    if (paths.bbox) items.push({ label: 'Bounding box JSON', path: paths.bbox });
    if (paths.csv) items.push({ label: 'CSV escenario', path: paths.csv });
    if (paths.metrics) items.push({ label: 'Métricas JSON', path: paths.metrics });
    if (paths.config) items.push({ label: 'Config JSON', path: paths.config });

    const curvesPath = getCurvesPath(index, model.species.id, model.algorithm.id);
    if (curvesPath) items.push({ label: 'Curvas de respuesta CSV', path: curvesPath });

    const occurrencesPath = getOccurrencesPath(index, model.species.id, model.algorithm.id);
    if (occurrencesPath) items.push({ label: 'Ocurrencias CSV', path: occurrencesPath });

    const sspId = model.scenario.id === 'actual'
      ? (model.algorithm.ssps?.[0]?.id || null)
      : model.scenario.id.split('_')[0];
    const periodId = model.scenario.id === 'actual'
      ? (model.algorithm.periods?.[model.algorithm.periods.length - 1] || '2081_2100')
      : model.scenario.id.split('_').slice(1).join('_');

    if (sspId && periodId) {
      const diffPath = getDiffPath(index, model.species.id, model.algorithm.id, sspId, periodId);
      if (diffPath) items.push({ label: 'Diferencias PNG', path: diffPath });
      const diffTablesPath = getDiffTablesPath(index, model.species.id, model.algorithm.id, periodId);
      if (diffTablesPath) items.push({ label: 'Tablas diferencias JSON', path: diffTablesPath });
    }

    return items;
  }

  async function downloadAll(items, model) {
    if (!items.length) return;
    statusEl.textContent = 'Generando ZIP, espera por favor...';
    statusEl.classList.remove('hidden');
    allBtn.disabled = true;

    const zip = new JSZip();
    let added = 0;

    await Promise.all(items.map(async ({ label, path }) => {
      try {
        const res = await fetch(path);
        if (!res.ok) {
          console.warn(`[Downloads] No disponible: ${path}`);
          return;
        }
        const blob = await res.blob();
        const filename = path.split('/').pop() || label;
        zip.file(filename, blob);
        added++;
      } catch (err) {
        console.warn(`[Downloads] Error descargando ${path}:`, err);
      }
    }));

    if (added === 0) {
      statusEl.textContent = 'No se pudieron descargar los archivos (posible problema de CORS).';
      statusEl.classList.replace('text-terra-accent', 'text-red-400');
      allBtn.disabled = false;
      return;
    }

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `terrapredict_${model.species.id}_${model.algorithm.id}_${model.scenario.id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      statusEl.textContent = `ZIP generado con ${added} archivo(s).`;
      statusEl.classList.replace('text-red-400', 'text-terra-accent');
    } catch (err) {
      console.error('[Downloads] Error generando ZIP:', err);
      statusEl.textContent = 'Error generando el ZIP.';
      statusEl.classList.replace('text-terra-accent', 'text-red-400');
    } finally {
      allBtn.disabled = false;
    }
  }

  let currentItems = [];
  let currentModel = null;

  function render(model) {
    currentModel = model;
    grid.innerHTML = '';
    currentItems = getDownloadItems(model);

    if (currentItems.length === 0) {
      info.classList.remove('hidden');
      allBtn.disabled = true;
    } else {
      info.classList.add('hidden');
      currentItems.forEach(({ label, path }) => grid.appendChild(makeCard(label, path)));
      allBtn.disabled = false;
    }
    statusEl.classList.add('hidden');
  }

  allBtn.addEventListener('click', () => {
    if (currentModel && currentItems.length) {
      downloadAll(currentItems, currentModel);
    }
  });

  window.addEventListener('model-changed', (e) => render(e.detail));
}
