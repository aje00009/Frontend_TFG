import * as Cesium from 'cesium';
import { loadSpeciesIndex, getPaths, getScenarios } from '../utils/config.js';
import { getFlippedImageCanvas, loadRasterBBox } from '../utils/pickerUtils.js';
import 'cesium/Build/Cesium/Widgets/widgets.css';

async function createHeatmapMaterialCesium(imageUrl, alpha) {
  const flippedCanvas = await getFlippedImageCanvas(imageUrl);
  return new Cesium.ImageMaterialProperty({
    image: flippedCanvas || imageUrl,
    transparent: true,
    color: new Cesium.Color(1, 1, 1, alpha),
  });
}

async function createViewer2D(containerId) {
  Cesium.Ion.defaultAccessToken = '';

  const terrainProvider = new Cesium.EllipsoidTerrainProvider();

  const viewer = new Cesium.Viewer(containerId, {
    terrainProvider,
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    homeButton: false,
    geocoder: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
  });

  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#232323');

  // Capa base por defecto: ESRI Satellite
  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    })
  );

  return viewer;
}

async function loadHeatmap2D(viewer, paths, alpha = 0.8) {
  if (!viewer || !paths?.png || !paths?.geojson) return;

  const existing = viewer.entities.getById('heatmap-overlay');
  if (existing) viewer.entities.remove(existing);

  let rectangle = Cesium.Rectangle.fromDegrees(-10, 35, 5, 45);
  const rasterBBox = await loadRasterBBox(paths);
  if (rasterBBox) {
    rectangle = Cesium.Rectangle.fromDegrees(
      rasterBBox.west, rasterBBox.south,
      rasterBBox.east, rasterBBox.north
    );
  }

  viewer.entities.add({
    id: 'heatmap-overlay',
    rectangle: {
      coordinates: rectangle,
      material: await createHeatmapMaterialCesium(paths.png, alpha),
      classificationType: Cesium.ClassificationType.BOTH,
      clampToGround: true,
    }
  });

  viewer.camera.flyTo({ destination: rectangle, duration: 0 });
}

async function updateHeatmapAlpha2D(viewer, alpha) {
  if (!viewer) return;
  const entity = viewer.entities.getById('heatmap-overlay');
  if (!entity || !entity.rectangle) return;
  const currentMat = entity.rectangle.material;
  if (!currentMat) return;
  let imageUrl = null;
  if (typeof currentMat.image === 'string') {
    imageUrl = currentMat.image;
  } else if (currentMat.image && typeof currentMat.image.getValue === 'function') {
    imageUrl = currentMat.image.getValue();
  }
  if (imageUrl) {
    entity.rectangle.material = await createHeatmapMaterialCesium(imageUrl, alpha);
  }
}

function syncCameras(v1, v2) {
  let syncing = false;
  function sync(source, target) {
    if (syncing) return;
    syncing = true;
    target.camera.setView({
      destination: source.camera.position.clone(),
      orientation: {
        heading: source.camera.heading,
        pitch: source.camera.pitch,
        roll: source.camera.roll,
      }
    });
    syncing = false;
  }
  v1.camera.changed.addEventListener(() => sync(v1, v2));
  v2.camera.changed.addEventListener(() => sync(v2, v1));
}

function getAllScenarios(index, speciesId, algoId) {
  const algo = index?.species?.find(s => s.id === speciesId)?.algorithms?.find(a => a.id === algoId);
  if (!algo) return [];
  const scenarios = [
    { id: 'actual', label: 'Actual (Presente)', folder: 'current', suffix: 'Actual' },
  ];
  for (const period of algo.periods || []) {
    const periodScenarios = getScenarios(index, speciesId, algoId, period);
    scenarios.push(...periodScenarios.filter(s => s.id !== 'actual'));
  }
  return scenarios;
}

export async function initSideBySideComparator(containerId, initialModel) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <h2 class="text-3xl font-bold mb-2 text-center">Comparador Lado a Lado</h2>
    <p class="text-center text-gray-400 mb-6">Compara escenarios visualmente en 2D.</p>
    <div class="flex justify-center mb-4">
      <div class="bg-black/40 backdrop-blur px-4 py-2 rounded-lg border border-white/10 flex items-center gap-3">
        <label class="text-xs text-gray-400 uppercase tracking-wider font-medium">Opacidad heatmap:</label>
        <input id="comp-2d-alpha" type="range" min="0" max="1" step="0.05" value="0.8" class="w-40 accent-geu-accent cursor-pointer">
        <span id="comp-2d-alpha-value" class="text-xs text-gray-300 font-mono w-8 text-right">0.8</span>
      </div>
    </div>
    <div class="flex flex-col md:flex-row gap-2 h-auto md:h-[600px]">
      <div class="w-full md:w-1/2 h-[400px] md:h-full relative rounded-xl overflow-hidden border border-white/10">
        <div class="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2 max-w-[90%]">
          <select id="comp-2d-left-scenario" class="geu-select text-xs py-1 min-w-0 w-[220px] sm:w-[280px]"></select>
        </div>
        <div id="comp-2d-left-map" class="w-full h-full"></div>
      </div>
      <div class="w-full md:w-1/2 h-[400px] md:h-full relative rounded-xl overflow-hidden border border-white/10">
        <div class="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2 max-w-[90%]">
          <select id="comp-2d-right-scenario" class="geu-select text-xs py-1 min-w-0 w-[220px] sm:w-[280px]"></select>
        </div>
        <div id="comp-2d-right-map" class="w-full h-full"></div>
      </div>
    </div>
    <!-- Leyenda de colores -->
    <div class="flex flex-wrap justify-center gap-4 mt-4 text-sm text-gray-300">
      <div class="flex items-center gap-2"><span class="inline-block w-4 h-4 rounded" style="background: linear-gradient(to bottom, #00008B, #00BFFF);"></span> Baja probabilidad</div>
      <div class="flex items-center gap-2"><span class="inline-block w-4 h-4 rounded" style="background: linear-gradient(to bottom, #00BFFF, #7FFF00);"></span> Media-baja</div>
      <div class="flex items-center gap-2"><span class="inline-block w-4 h-4 rounded" style="background: linear-gradient(to bottom, #7FFF00, #FFD700);"></span> Media</div>
      <div class="flex items-center gap-2"><span class="inline-block w-4 h-4 rounded" style="background: linear-gradient(to bottom, #FFD700, #FF4500);"></span> Media-alta</div>
      <div class="flex items-center gap-2"><span class="inline-block w-4 h-4 rounded" style="background: linear-gradient(to bottom, #FF4500, #DC0000);"></span> Alta probabilidad</div>
    </div>
  `;

  let index;
  try {
    index = await loadSpeciesIndex();
  } catch (err) {
    console.error('[Comparator] Error cargando catálogo:', err);
    return;
  }

  let currentModel = null;
  const leftSel = container.querySelector('#comp-2d-left-scenario');
  const rightSel = container.querySelector('#comp-2d-right-scenario');
  let viewerLeft = null;
  let viewerRight = null;

  function populateSelector(sel, scenarios, defaultId) {
    if (!sel) return;
    sel.innerHTML = scenarios.map(s =>
      `<option value="${s.id}" ${s.id === defaultId ? 'selected' : ''}>${s.label}</option>`
    ).join('');
  }

  function keepSimilarScenario(prevId, scenarios, defaultId) {
    if (!prevId || !scenarios.length) return defaultId;
    if (scenarios.some(s => s.id === prevId)) return prevId;
    const prevSsp = prevId.split('_')[0];
    const sameSsp = scenarios.find(s => s.id.startsWith(prevSsp + '_'));
    return sameSsp?.id || defaultId;
  }

  function render(model) {
    if (!model) return;
    currentModel = model;
    const scenarios = getAllScenarios(index, model.species.id, model.algorithm.id);
    if (!scenarios.length) return;

    const prevLeft = leftSel?.value;
    const prevRight = rightSel?.value;
    const defaultRight = scenarios.find(s => s.id !== 'actual')?.id || scenarios[0]?.id;

    populateSelector(leftSel, scenarios, 'actual');
    populateSelector(rightSel, scenarios, defaultRight);

    // Mantener la selección anterior; si cambió el período, intentar conservar el mismo SSP
    leftSel.value = keepSimilarScenario(prevLeft, scenarios, 'actual');
    rightSel.value = keepSimilarScenario(prevRight, scenarios, defaultRight);

    // Recargar automáticamente ambos paneles ante cualquier cambio de modelo
    if (viewerLeft) updatePanel(viewerLeft, leftSel, getAlpha());
    if (viewerRight) updatePanel(viewerRight, rightSel, getAlpha());
  }

  window.addEventListener('model-changed', (e) => render(e.detail));
  if (initialModel) render(initialModel);

  try {
    viewerLeft = await createViewer2D('comp-2d-left-map');
    viewerRight = await createViewer2D('comp-2d-right-map');
    syncCameras(viewerLeft, viewerRight);
  } catch (err) {
    console.error('[Comparator] Error inicializando viewers 2D:', err);
  }

  async function updatePanel(viewer, scenarioSel, alpha = 0.8) {
    if (!currentModel || !viewer) return;
    const scenarioId = scenarioSel.value;
    const scenarios = getAllScenarios(index, currentModel.species.id, currentModel.algorithm.id);
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;
    const paths = getPaths(index, currentModel.species.id, currentModel.algorithm.id, scenario);
    await loadHeatmap2D(viewer, paths, alpha);
  }

  const alphaSlider = container.querySelector('#comp-2d-alpha');
  const alphaValue = container.querySelector('#comp-2d-alpha-value');

  function getAlpha() {
    return alphaSlider ? parseFloat(alphaSlider.value) : 0.8;
  }

  if (alphaSlider && alphaValue) {
    alphaSlider.addEventListener('input', (e) => {
      const alpha = parseFloat(e.target.value);
      alphaValue.textContent = alpha.toFixed(2);
      updateHeatmapAlpha2D(viewerLeft, alpha);
      updateHeatmapAlpha2D(viewerRight, alpha);
    });
  }

  if (viewerLeft && leftSel) {
    leftSel.addEventListener('change', () => updatePanel(viewerLeft, leftSel, getAlpha()));
    if (currentModel) updatePanel(viewerLeft, leftSel, getAlpha());
  }
  if (viewerRight && rightSel) {
    rightSel.addEventListener('change', () => updatePanel(viewerRight, rightSel, getAlpha()));
    if (currentModel) updatePanel(viewerRight, rightSel, getAlpha());
  }
}
