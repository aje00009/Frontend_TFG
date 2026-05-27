import { SCENARIOS, getPaths } from '../utils/config.js';

export function initScenarioSelector(onChange) {
  const container = document.getElementById('scenario-selector');
  if (!container) return;

  container.innerHTML = `
    <div class="flex items-center gap-3 bg-geu-panel/90 backdrop-blur px-5 py-3 rounded-2xl border border-white/10 shadow-2xl">
      <label class="text-sm text-gray-400 font-medium">Escenario climático:</label>
      <select id="scenario-select" class="geu-select min-w-[300px]">
        ${SCENARIOS.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}
      </select>
    </div>
  `;

  const select = container.querySelector('#scenario-select');

  function emitCurrent() {
    const scenario = SCENARIOS.find(s => s.id === select.value);
    onChange({ ...scenario, paths: getPaths(scenario) });
  }

  select.addEventListener('change', emitCurrent);
  emitCurrent();
}
