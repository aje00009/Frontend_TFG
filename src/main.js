import './style.css';
import { initHero } from './components/Hero.js';
import { initMapViewer } from './components/MapViewer.js';
import { initScenarioSelector } from './components/ScenarioSelector.js';
import { initDashboard } from './components/Dashboard.js';
import { initResponseCurves } from './components/ResponseCurves.js';
import { initDiffMap } from './components/DiffMap.js';
import { initScene3D } from './components/Scene3D.js';
import { initDownloads } from './components/Downloads.js';

const DISPLAY_NAME = 'Pinus uncinata';

(async function bootstrap() {
  initHero(DISPLAY_NAME);

  // Escenario actual (se actualiza cuando el usuario cambia el dropdown)
  let currentScenario = null;
  initScenarioSelector((scenario) => {
    currentScenario = scenario;
    window.dispatchEvent(new CustomEvent('scenario-changed', { detail: scenario }));
  });

  // Esperamos a que el primer escenario esté seleccionado (es síncrono, pero por si acaso)
  await new Promise(r => setTimeout(r, 50));

  await initMapViewer('map-container');
  initDashboard('dashboard');
  initResponseCurves('curves');
  initDiffMap('diff');
  await initScene3D('scene3d', currentScenario);
  initDownloads('downloads');
})();
