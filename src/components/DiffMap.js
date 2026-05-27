import { getDiffPath } from '../utils/config.js';

export function initDiffMap(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <h2 class="text-3xl font-bold mb-2 text-center">Mapa de Diferencias</h2>
    <p class="text-center text-gray-400 mb-8">Comparación futuro vs actual: <span class="text-red-400 font-medium">rojo = pérdida</span>, <span class="text-green-400 font-medium">verde = ganancia</span>.</p>
    <div class="relative w-full flex justify-center">
      <img id="diff-img" src="" alt="Mapa de diferencias" class="rounded-xl border border-white/10 max-w-full shadow-2xl hidden" />
      <div id="diff-placeholder" class="geu-card w-full max-w-4xl h-96 flex items-center justify-center text-gray-500">
        No se encontró el mapa de diferencias.
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
  const path = getDiffPath();

  fetch(path)
    .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
    .then(() => {
      img.src = path;
      img.classList.remove('hidden');
      placeholder.classList.add('hidden');
    })
    .catch(() => {
      img.classList.add('hidden');
      placeholder.classList.remove('hidden');
    });
}
