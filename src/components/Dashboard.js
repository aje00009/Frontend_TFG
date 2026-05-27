import { loadJson } from '../utils/dataLoader.js';
import { getPaths } from '../utils/config.js';

const METRIC_META = [
  { key: 'auc', label: 'AUC', max: 1 },
  { key: 'accuracy', label: 'Accuracy', max: 1 },
  { key: 'tss', label: 'TSS', max: 1 },
  { key: 'kappa', label: 'Kappa', max: 1 },
  { key: 'precision', label: 'Precision', max: 1 },
  { key: 'recall', label: 'Recall', max: 1 },
  { key: 'f1Score', label: 'F1', max: 1 },
];

export function initDashboard(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <h2 class="text-3xl font-bold mb-8 text-center">Métricas del Modelo</h2>
    <div id="metrics-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"></div>
    <div id="metrics-info" class="mt-8 text-center text-gray-400 text-sm hidden">
      No se encontraron métricas. Asegúrate de haber copiado los archivos exportados a <code>public/data/</code>.
    </div>
  `;

  const grid = container.querySelector('#metrics-grid');
  const info = container.querySelector('#metrics-info');

  async function render() {
    // Usar siempre el escenario 'actual' para métricas (fijas)
    const paths = getPaths({ id: 'actual' });
    if (!paths.metrics) {
      info.classList.remove('hidden');
      return;
    }

    const data = await loadJson(paths.metrics);
    if (!data || !data.metrics) {
      info.classList.remove('hidden');
      return;
    }
    info.classList.add('hidden');

    const m = data.metrics;
    METRIC_META.forEach(meta => {
      const raw = m[meta.key];
      const val = typeof raw === 'number' ? raw : parseFloat(raw);
      const pct = ((val / meta.max) * 100).toFixed(1);
      const color = pct > 80 ? 'bg-green-500' : pct > 50 ? 'bg-geu-accent' : 'bg-geu-accent2';
      const display = Number.isFinite(val) ? val.toFixed(4) : 'N/A';

      const card = document.createElement('div');
      card.className = 'geu-card';
      card.innerHTML = `
        <div class="flex items-baseline justify-between mb-3">
          <span class="text-sm text-gray-400 font-medium">${meta.label}</span>
          <span class="text-2xl font-bold">${display}</span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div class="${color} h-2.5 rounded-full transition-all duration-700" style="width: ${Number.isFinite(val) ? pct : 0}%"></div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  render();
}
