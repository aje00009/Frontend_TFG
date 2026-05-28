import { loadCsv } from '../utils/dataLoader.js';
import { loadSpeciesIndex, getCurvesPath } from '../utils/config.js';
import Plotly from 'plotly.js-dist-min';

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
    <p class="text-center text-gray-400 mb-8">Probabilidad de presencia en función de cada variable bioclimática (otras variables fijas en la media del entrenamiento).</p>
    <div class="flex justify-center mb-6">
      <select id="bio-select" class="geu-select min-w-[200px]">
        <option value="" disabled selected>Selecciona una variable BIO</option>
      </select>
    </div>
    <div id="plotly-curve" class="w-full h-[500px] rounded-xl overflow-hidden"></div>
    <div id="curves-info" class="mt-6 text-center text-gray-400 text-sm hidden">
      No se encontró el CSV de curvas de respuesta. Asegúrate de haber copiado los archivos exportados a <code>public/data/</code>.
    </div>
  `;

  const bioSelect = container.querySelector('#bio-select');
  const plotDiv = container.querySelector('#plotly-curve');
  const info = container.querySelector('#curves-info');

  let allData = [];
  let currentVariable = null;

  async function load(model) {
    if (!model) {
      info.classList.remove('hidden');
      return;
    }
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
      draw(target);
    }
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
      xaxis: { title: variable, gridcolor: '#404040', zerolinecolor: '#404040' },
      yaxis: { title: 'Probabilidad de presencia', range: [0, 1], gridcolor: '#404040', zerolinecolor: '#404040' },
      shapes,
      legend: { x: 0.02, y: 0.98, bgcolor: 'rgba(43,43,43,0.8)' },
    };

    Plotly.newPlot(plotDiv, traces, layout, { responsive: true, displayModeBar: false });
  }

  bioSelect.addEventListener('change', () => draw(bioSelect.value));
  window.addEventListener('model-changed', (e) => load(e.detail));
}
