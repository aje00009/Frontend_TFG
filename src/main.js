import './style.css';
import { initHero } from './components/Hero.js';
import { initMapViewer } from './components/MapViewer.js';
import { initScenarioSelector } from './components/ScenarioSelector.js';
import { initDashboard } from './components/Dashboard.js';
import { initResponseCurves } from './components/ResponseCurves.js';
import { initDiffMap } from './components/DiffMap.js';
import { initScene3D } from './components/Scene3D.js';
import { initDownloads } from './components/Downloads.js';

(async function bootstrap() {
  initHero('Pinus uncinata');

  // Modelo actual (especie + algoritmo + período + escenario)
  let currentModel = null;
  await initScenarioSelector((model) => {
    currentModel = model;
    window.dispatchEvent(new CustomEvent('model-changed', { detail: model }));
  });

  await initMapViewer('map-container');
  initDashboard('dashboard');
  initResponseCurves('curves');
  initDiffMap('diff');
  await initScene3D('scene3d', currentModel);
  initDownloads('downloads');
})();
