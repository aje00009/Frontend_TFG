import Plotly from 'plotly.js-dist-min';

export async function initProbabilityHistogram(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <h2 class="text-3xl font-bold mb-2 text-center">Histograma de Probabilidad</h2>
    <p class="text-center text-gray-400 mb-8">Distribución de los valores de probabilidad de presencia en el área de estudio.</p>
    <div id="hist-plot" class="w-full h-[450px] rounded-xl overflow-hidden"></div>
    <div id="hist-info" class="mt-6 text-center text-gray-400 text-sm hidden">
      No se encontraron datos de probabilidad para el escenario seleccionado.
    </div>
  `;

  const plotDiv = container.querySelector('#hist-plot');
  const info = container.querySelector('#hist-info');

  async function load(model) {
    if (!model || !model.paths?.geojson) {
      info.classList.remove('hidden');
      Plotly.purge(plotDiv);
      return;
    }

    try {
      const geojson = await fetch(model.paths.geojson).then(r => r.ok ? r.json() : null);
      if (!geojson || !geojson.features?.length) {
        info.classList.remove('hidden');
        Plotly.purge(plotDiv);
        return;
      }

      const probs = geojson.features
        .map(f => f.properties?.probability)
        .filter(v => v != null && !isNaN(v));

      if (probs.length === 0) {
        info.classList.remove('hidden');
        Plotly.purge(plotDiv);
        return;
      }

      info.classList.add('hidden');

      // Histogram bins of 0.1
      const bins = new Array(10).fill(0);
      probs.forEach(p => {
        const bin = Math.min(9, Math.floor(p * 10));
        bins[bin]++;
      });

      const binLabels = bins.map((_, i) => `${(i / 10).toFixed(1)} - ${((i + 1) / 10).toFixed(1)}`);
      const binCenters = bins.map((_, i) => (i + 0.5) / 10);

      // Threshold from diff tables if available, default 0.5
      const threshold = model.algorithm?.threshold ?? 0.5;

      const trace = {
        x: binCenters,
        y: bins,
        type: 'bar',
        width: 0.08,
        marker: {
          color: bins.map((_, i) => {
            const center = (i + 0.5) / 10;
            // Color gradient from blue (low) to red (high) using GEU-like colors
            if (center < 0.3) return '#3b82f6'; // blue
            if (center < 0.5) return '#a855f7'; // purple
            if (center < 0.7) return '#f97316'; // orange
            return '#ef4444'; // red
          }),
          line: { color: 'rgba(255,255,255,0.1)', width: 1 },
        },
        hovertemplate: 'Probabilidad: %{x:.1f}<br>Píxeles: %{y}<extra></extra>',
      };

      const shapes = [];
      if (threshold != null) {
        shapes.push({
          type: 'line',
          x0: threshold,
          x1: threshold,
          y0: 0,
          y1: 1,
          yref: 'paper',
          line: { color: '#ffffff', width: 2, dash: 'dash' },
        });
      }

      const annotations = [];
      if (threshold != null) {
        annotations.push({
          x: threshold,
          y: 1.02,
          yref: 'paper',
          text: `Umbral = ${threshold}`,
          showarrow: false,
          font: { color: '#ffffff', size: 12 },
          xanchor: 'left',
        });
      }

      const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: '#2b2b2b',
        font: { color: '#e5e7eb' },
        margin: { t: 50, r: 20, b: 50, l: 60 },
        xaxis: {
          title: 'Probabilidad de presencia',
          range: [0, 1],
          gridcolor: '#404040',
          zerolinecolor: '#404040',
          tickmode: 'array',
          tickvals: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
          ticktext: ['0', '0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9', '1'],
        },
        yaxis: {
          title: 'Frecuencia (número de píxeles)',
          gridcolor: '#404040',
          zerolinecolor: '#404040',
        },
        shapes,
        annotations,
        bargap: 0.05,
        showlegend: false,
      };

      Plotly.newPlot(plotDiv, [trace], layout, { responsive: true, displayModeBar: false });
    } catch (err) {
      console.error('[ProbabilityHistogram] Error cargando datos:', err);
      info.classList.remove('hidden');
    }
  }

  window.addEventListener('model-changed', (e) => load(e.detail));
}
