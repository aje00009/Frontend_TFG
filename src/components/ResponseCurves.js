import { loadCsv } from '../utils/dataLoader.js';
import { loadSpeciesIndex, getCurvesPath } from '../utils/config.js';
import Plotly from 'plotly.js-dist-min';

const BIO_DESCRIPTIONS = {
  'BIO1': 'Temperatura media anual (°C)',
  'BIO2': 'Rango diurno medio, mes más cálido (°C)',
  'BIO3': 'Isotermalidad (%)',
  'BIO4': 'Estacionalidad de la temperatura (desv. estándar × 100)',
  'BIO5': 'Temperatura máxima del mes más cálido (°C)',
  'BIO6': 'Temperatura mínima del mes más frío (°C)',
  'BIO7': 'Rango anual de temperatura (°C)',
  'BIO8': 'Temperatura media del trimestre más húmedo (°C)',
  'BIO9': 'Temperatura media del trimestre más seco (°C)',
  'BIO10': 'Temperatura media del trimestre más cálido (°C)',
  'BIO11': 'Temperatura media del trimestre más frío (°C)',
  'BIO12': 'Precipitación anual (mm)',
  'BIO13': 'Precipitación del mes más húmedo (mm)',
  'BIO14': 'Precipitación del mes más seco (mm)',
  'BIO15': 'Estacionalidad de la precipitación (%)',
  'BIO16': 'Precipitación del trimestre más húmedo (mm)',
  'BIO17': 'Precipitación del trimestre más seco (mm)',
  'BIO18': 'Precipitación del trimestre más cálido (mm)',
  'BIO19': 'Precipitación del trimestre más frío (mm)',
};

const BIO_UNITS = {
  'BIO1': '°C', 'BIO2': '°C', 'BIO3': '%', 'BIO4': 'desv. est.',
  'BIO5': '°C', 'BIO6': '°C', 'BIO7': '°C', 'BIO8': '°C',
  'BIO9': '°C', 'BIO10': '°C', 'BIO11': '°C', 'BIO12': 'mm',
  'BIO13': 'mm', 'BIO14': 'mm', 'BIO15': '%', 'BIO16': 'mm',
  'BIO17': 'mm', 'BIO18': 'mm', 'BIO19': 'mm',
};

function getBioDescription(varName) {
  if (!varName) return '';
  const key = varName.toUpperCase().trim();
  return BIO_DESCRIPTIONS[key] || '';
}

export async function initResponseCurves(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let index;
  try {
    index = await loadSpeciesIndex();
  } catch (err) {
    console.error('[ResponseCurves] Error cargando catálogo:', err);
  }

  container.innerHTML = `
    <h2 class="text-3xl font-bold mb-2 text-center">Curvas de Respuesta</h2>
    <p class="text-center text-gray-400 mb-6 max-w-2xl mx-auto">Muestra cómo cambia la probabilidad de presencia de la especie al variar una única variable bioclimática, manteniendo el resto en sus valores medios de entrenamiento. Selecciona una variable para explorar su efecto.</p>
    <div class="flex flex-col items-center mb-6 gap-2">
      <div class="flex justify-center">
        <select id="bio-select" class="geu-select min-w-[240px]">
          <option value="" disabled selected>Selecciona una variable BIO</option>
        </select>
      </div>
      <p id="bio-desc" class="text-sm text-stone-400 text-center max-w-lg min-h-[1.25rem] transition-opacity duration-200"></p>
    </div>
    <div id="plotly-curve" class="w-full h-[500px] rounded-xl overflow-hidden"></div>
    <div id="curves-info" class="mt-6 text-center text-gray-400 text-sm hidden">
      No se encontró el CSV de curvas de respuesta. Asegúrate de haber copiado los archivos exportados a <code>public/data/</code>.
    </div>
  `;

  const bioSelect = container.querySelector('#bio-select');
  const bioDesc = container.querySelector('#bio-desc');
  const plotDiv = container.querySelector('#plotly-curve');
  const info = container.querySelector('#curves-info');

  let allData = [];
  let currentVariable = null;
  let pendingModel = null;

  async function load(model) {
    if (!model) {
      info.classList.remove('hidden');
      return;
    }
    if (!index) {
      pendingModel = model;
      return;
    }
    pendingModel = null;
    const rows = await loadCsv(getCurvesPath(index, model.species.id, model.algorithm.id));
    if (!rows || rows.length === 0) {
      info.classList.remove('hidden');
      return;
    }
    info.classList.add('hidden');
    allData = rows;

    const variables = [...new Set(rows.map(r => r.Variable).filter(Boolean))];
    bioSelect.innerHTML = '<option value="" disabled selected>Selecciona una variable BIO</option>' +
      variables.map(v => `<option value="${v}">${v}</option>`).join('');

    if (variables.length > 0) {
      const target = currentVariable && variables.includes(currentVariable) ? currentVariable : variables[0];
      bioSelect.value = target;
      bioDesc.textContent = getBioDescription(target);
      draw(target);
    }
  }

  // Si index cargó tarde, procesar modelo pendiente
  if (!index) {
    const checkIndex = setInterval(() => {
      if (index && pendingModel) {
        clearInterval(checkIndex);
        load(pendingModel);
      }
    }, 100);
    setTimeout(() => clearInterval(checkIndex), 5000);
  }

  function draw(variable) {
    const rows = allData.filter(r => r.Variable === variable);
    if (rows.length === 0) return;

    const x = rows.map(r => r.Value);
    const y = rows.map(r => r.Probability);
    const meanRef = rows[0]?.MeanReference ?? null;

    const traces = [{
      x, y,
      mode: 'lines',
      name: 'Probabilidad',
      line: { color: '#3b82f6', width: 3 },
      hovertemplate: 'Valor: %{x:.2f}<br>Prob: %{y:.3f}<extra></extra>',
    }];

    const shapes = [];
    if (meanRef != null) {
      shapes.push({
        type: 'line',
        x0: meanRef, x1: meanRef,
        y0: 0, y1: 1,
        line: { color: '#ef4444', width: 2, dash: 'dash' },
      });
      traces.push({
        x: [meanRef], y: [null],
        mode: 'markers',
        name: 'Media entrenamiento',
        marker: { color: '#ef4444', size: 1 },
        showlegend: true,
        hoverinfo: 'skip',
      });
    }

    const layout = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: '#2b2b2b',
      font: { color: '#e5e7eb' },
      margin: { t: 40, r: 20, b: 50, l: 60 },
      xaxis: { title: variable + ' — ' + (BIO_UNITS[variable] || 'valor'), gridcolor: '#404040', zerolinecolor: '#404040' },
      yaxis: { title: 'Probabilidad de presencia', range: [0, 1], gridcolor: '#404040', zerolinecolor: '#404040' },
      shapes,
      legend: { x: 0.02, y: 0.98, bgcolor: 'rgba(43,43,43,0.8)' },
    };

    Plotly.newPlot(plotDiv, traces, layout, { responsive: true, displayModeBar: false });
  }

  bioSelect.addEventListener('change', () => {
    const val = bioSelect.value;
    bioDesc.textContent = getBioDescription(val);
    draw(val);
  });
  window.addEventListener('model-changed', (e) => load(e.detail));
}
