import { loadJson } from '../utils/dataLoader.js';
import { loadSpeciesIndex, getPaths, getScenarios } from '../utils/config.js';

const METRIC_META = [
  { key: 'auc', label: 'AUC', fullName: 'Área bajo la curva ROC', max: 1, description: 'Mide la capacidad del modelo para distinguir entre celdas con presencia y ausencia de la especie. Un valor de 1.0 indica una clasificación perfecta; 0.5 es equivalente a una clasificación aleatoria. Se considera bueno por encima de 0.8.' },
  { key: 'accuracy', label: 'Accuracy', fullName: 'Precisión global', max: 1, description: 'Porcentaje total de celdas correctamente clasificadas (tanto presencias como ausencias) respecto al total. Es útil cuando las clases están equilibradas.' },
  { key: 'tss', label: 'TSS', fullName: 'True Skill Statistic', max: 1, description: 'Estadístico de habilidad verdadera. Varía entre -1 y 1, donde 1 es una predicción perfecta y 0 indica una predicción aleatoria. Es independiente del tamaño de la muestra y del umbral de corte.' },
  { key: 'kappa', label: 'Kappa', fullName: 'Coeficiente de Cohen', max: 1, description: 'Mide el grado de concordancia entre la predicción del modelo y la realidad, corrigiendo el acuerdo esperado por azar. Un valor de 1.0 es concordancia perfecta; valores ≤ 0 indican que el modelo no es mejor que el azar.' },
  { key: 'precision', label: 'Precision', fullName: 'Precisión (positivos)', max: 1, description: 'De todas las celdas que el modelo predice como presencia, ¿qué porcentaje realmente lo es? Indica la fiabilidad de las predicciones positivas. Alta cuando hay pocos falsos positivos.' },
  { key: 'recall', label: 'Recall', fullName: 'Sensibilidad / Recall', max: 1, description: 'De todas las celdas donde realmente existe la especie, ¿qué porcentaje detecta correctamente el modelo? También llamada sensibilidad. Alta cuando hay pocos falsos negativos.' },
  { key: 'f1Score', label: 'F1', fullName: 'Puntuación F1', max: 1, description: 'Media armónica entre Precision y Recall. Proporciona un balance único cuando ambas métricas son importantes. Es especialmente útil cuando las clases están desequilibradas.' },
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
    METRIC_META.forEach((meta, idx) => {
      const raw = m[meta.key];
      const val = typeof raw === 'number' ? raw : parseFloat(raw);
      const pctStr = ((val / meta.max) * 100).toFixed(1).replace(',', '.');
      const pctNum = parseFloat(pctStr);
      const color = pctNum > 80 ? 'bg-green-500' : pctNum > 50 ? 'bg-terra-accent' : 'bg-terra-accent-warm';
      const display = Number.isFinite(val) ? val.toFixed(4).replace(',', '.') : 'N/A';

      const card = document.createElement('div');
      card.className = 'geu-card relative';
      card.innerHTML = `
        <div class="flex items-baseline justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-400 font-medium">${meta.label}</span>
            <button class="metric-info-btn w-5 h-5 rounded-full bg-terra-accent/20 hover:bg-terra-accent text-terra-accent hover:text-terra-bg flex items-center justify-center transition-all" data-idx="${idx}" title="${meta.fullName}">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </button>
          </div>
          <span class="text-xl font-bold">${display}</span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div class="${color} h-2 rounded-full transition-all duration-700" style="width: ${Number.isFinite(val) ? pctStr : 0}%"></div>
        </div>
        <div class="metric-desc hidden mt-3 text-xs text-stone-400 leading-relaxed border-t border-terra-border pt-2" id="metric-desc-${idx}">
          ${meta.description}
        </div>
      `;
      grid.appendChild(card);
    });

    // Toggle descripciones
    grid.querySelectorAll('.metric-info-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.dataset.idx;
        const desc = grid.querySelector(`#metric-desc-${idx}`);
        if (desc) desc.classList.toggle('hidden');
      });
    });
  }

  window.addEventListener('model-changed', (e) => render(e.detail));
  render(null);
}
