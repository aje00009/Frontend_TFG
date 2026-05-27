import { getPaths, getCurvesPath, getDiffPath } from '../utils/config.js';

export function initDownloads(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <h2 class="text-3xl font-bold mb-2 text-center">Descargas</h2>
    <p class="text-center text-gray-400 mb-8">Archivos exportados por GEU para la especie y escenario seleccionados.</p>
    <div id="downloads-grid" class="flex flex-wrap justify-center gap-4"></div>
    <div id="downloads-info" class="mt-6 text-center text-gray-400 text-sm hidden">
      No hay archivos disponibles.
    </div>
  `;

  const grid = container.querySelector('#downloads-grid');
  const info = container.querySelector('#downloads-info');

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
        <div class="text-xs text-gray-500 truncate max-w-[200px]">${filename}</div>
      </div>
    `;
    return a;
  }

  function render(scenario) {
    grid.innerHTML = '';
    const paths = getPaths(scenario);
    const items = [];

    if (paths.tif) items.push(makeCard('GeoTIFF', paths.tif));
    if (paths.geojson) items.push(makeCard('GeoJSON', paths.geojson));
    if (paths.png) items.push(makeCard('Heatmap PNG', paths.png));
    if (paths.metrics) items.push(makeCard('Métricas JSON', paths.metrics));
    if (paths.config) items.push(makeCard('Config JSON', paths.config));

    // Archivos comunes (no dependen de escenario)
    items.push(makeCard('Curvas CSV', getCurvesPath()));
    items.push(makeCard('Diferencias PNG', getDiffPath()));

    if (items.length === 0) {
      info.classList.remove('hidden');
    } else {
      info.classList.add('hidden');
      items.forEach(el => grid.appendChild(el));
    }
  }

  window.addEventListener('scenario-changed', (e) => render(e.detail));
}
