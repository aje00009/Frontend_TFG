import { loadJson } from '../utils/dataLoader.js';
import { loadSpeciesIndex, getPaths, getScenarios } from '../utils/config.js';

const METRIC_META = [
  { key: 'auc', label: 'AUC', fullName: 'Área bajo la curva ROC', max: 1 },
  { key: 'accuracy', label: 'Accuracy', fullName: 'Precisión global', max: 1 },
  { key: 'tss', label: 'TSS', fullName: 'True Skill Statistic', max: 1 },
  { key: 'kappa', label: 'Kappa', fullName: 'Coeficiente de Cohen', max: 1 },
  { key: 'precision', label: 'Precision', fullName: 'Precisión ( positivos)', max: 1 },
  { key: 'recall', label: 'Recall', fullName: 'Sensibilidad / Recall', max: 1 },
  { key: 'f1Score', label: 'F1', fullName: 'Puntuación F1', max: 1 },
];

export async function initDashboard(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div id="metrics-grid" class="grid grid-cols-1 sm:grid-cols-2 gap-4"></div>
    <div id="metrics-info" class="mt-8 text-center text-gray-400 text-sm hidden">
      No se encontraron métricas. Asegúrate de haber copiado los archivos exportados a <code>public/data/</code>.
    </div>
  `;

  const grid = container.querySelector('#metrics-grid');
  const info = container.querySelector('#metrics-info');
  let index;
  try {
    index = await loadSpeciesIndex();
  } catch (err) {
    console.error('[Dashboard] Error cargando catálogo:', err);
    info.classList.remove('hidden');
    return;
  }

  async function render(model) {
    grid.innerHTML = '';
    if (!model) {
      info.classList.remove('hidden');
      return;
    }
    const actualScenario = getScenarios(index, model.species.id, model.algorithm.id, model.period.id).find(s => s.id === 'actual');
    if (!actualScenario) {
      info.classList.remove('hidden');
      return;
    }
    const paths = getPaths(index, model.species.id, model.algorithm.id, actualScenario);
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
      card.className = 'geu-card relative group';
      card.innerHTML = `
        <div class="flex items-baseline justify-between mb-3">
          <div class="flex items-center gap-1.5">
            <span class="text-sm text-gray-400 font-medium">${meta.label}</span>
            <span class="text-gray-600 hover:text-terra-accent cursor-help transition-colors" title="${meta.fullName}">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </span>
          </div>
          <span class="text-xl font-bold">${display}</span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div class="${color} h-2 rounded-full transition-all duration-700" style="width: ${Number.isFinite(val) ? pct : 0}%"></div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  window.addEventListener('model-changed', (e) => render(e.detail));
  render(null);
}
