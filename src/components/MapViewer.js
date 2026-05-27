import * as Cesium from 'cesium';
import { processHeatmapAdvanced } from '../utils/processHeatmap.js';
import 'cesium/Build/Cesium/Widgets/widgets.css';

const BASE_LAYERS = {
  'cartodb-dark': { label: 'CartoDB Dark', create: () => new Cesium.UrlTemplateImageryProvider({ url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' }) },
  'cartodb-voyager': { label: 'CartoDB Voyager', create: () => new Cesium.UrlTemplateImageryProvider({ url: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png' }) },
  'cartodb-positron': { label: 'CartoDB Positron', create: () => new Cesium.UrlTemplateImageryProvider({ url: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png' }) },
  'osm': { label: 'OpenStreetMap', create: () => new Cesium.UrlTemplateImageryProvider({ url: 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png' }) },
  'esri-satellite': { label: 'ESRI Satellite', create: () => new Cesium.UrlTemplateImageryProvider({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' }) },
  'esri-street': { label: 'ESRI Street', create: () => new Cesium.UrlTemplateImageryProvider({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}' }) },
  'opentopomap': { label: 'OpenTopoMap', create: () => new Cesium.UrlTemplateImageryProvider({ url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png' }) },
  'cesium-default': { label: 'Cesium Ion', create: () => null },
};

function createHeatmapMaterial(imageUrl, globalAlpha) {
  return new Cesium.ImageMaterialProperty({
    image: imageUrl,
    transparent: true,
    color: new Cesium.Color(1, 1, 1, globalAlpha),
  });
}

export async function initMapViewer(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  Cesium.Ion.defaultAccessToken = '';

  const terrainProvider = await Cesium.createWorldTerrainAsync()
    .catch(() => new Cesium.EllipsoidTerrainProvider());

  const viewer = new Cesium.Viewer(containerId, {
    terrainProvider,
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    homeButton: true,
    geocoder: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
  });

  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#232323');

  let heatmapEntity = null;
  let currentPngUrl = null;

  // Controles superpuestos
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'absolute bottom-6 left-6 z-10 flex flex-col gap-3';
  controlsDiv.innerHTML = `
    <div class="bg-geu-panel/90 backdrop-blur px-4 py-2 rounded-xl border border-white/10 shadow-xl flex items-center gap-2">
      <label class="text-xs text-gray-400 font-medium">Mapa base:</label>
      <select id="base-layer-select" class="geu-select text-xs py-1 min-w-[160px]">
        ${Object.entries(BASE_LAYERS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
      </select>
    </div>
    <div class="bg-geu-panel/90 backdrop-blur px-4 py-2 rounded-xl border border-white/10 shadow-xl flex items-center gap-2">
      <label class="text-xs text-gray-400 font-medium">Opacidad heatmap:</label>
      <input id="heatmap-alpha" type="range" min="0.1" max="1" step="0.05" value="0.55" class="w-32 accent-teal-400">
      <span id="heatmap-alpha-val" class="text-xs text-teal-400 font-mono w-8 text-right">55%</span>
    </div>
  `;
  container.appendChild(controlsDiv);

  function setBaseLayer(key) {
    while (viewer.imageryLayers.length > 0) viewer.imageryLayers.remove(viewer.imageryLayers.get(0));
    const factory = BASE_LAYERS[key];
    if (factory?.create) {
      const provider = factory.create();
      if (provider) viewer.imageryLayers.addImageryProvider(provider);
    }
  }

  function updateHeatmapAlpha(val) {
    const a = parseFloat(val);
    if (heatmapEntity && currentPngUrl) {
      heatmapEntity.rectangle.material = createHeatmapMaterial(currentPngUrl, a);
    }
    const label = document.getElementById('heatmap-alpha-val');
    if (label) label.textContent = Math.round(a * 100) + '%';
  }

  controlsDiv.querySelector('#base-layer-select').addEventListener('change', (e) => setBaseLayer(e.target.value));
  controlsDiv.querySelector('#heatmap-alpha').addEventListener('input', (e) => updateHeatmapAlpha(e.target.value));
  setBaseLayer('cartodb-dark');

  window.addEventListener('scenario-changed', async (e) => {
    const { paths } = e.detail;
    console.log('[MapViewer] scenario-changed', paths);

    if (heatmapEntity) {
      viewer.entities.remove(heatmapEntity);
      heatmapEntity = null;
    }
    currentPngUrl = null;

    if (!paths.png) {
      console.warn('[MapViewer] No hay paths.png');
      return;
    }

    try {
      // Obtener bbox del GeoJSON
      const geojson = await fetch(paths.geojson).then(r => r.ok ? r.json() : null);
      let rectangle = Cesium.Rectangle.fromDegrees(-10, 35, 5, 45);

      if (geojson && geojson.features?.length > 0) {
        const coords = geojson.features
          .filter(f => f.geometry?.type === 'Point')
          .map(f => f.geometry.coordinates);
        if (coords.length > 0) {
          const lons = coords.map(c => c[0]);
          const lats = coords.map(c => c[1]);
          rectangle = Cesium.Rectangle.fromDegrees(
            Math.min(...lons), Math.min(...lats),
            Math.max(...lons), Math.max(...lats)
          );
          viewer.camera.flyTo({ destination: rectangle, duration: 1.5 });
        }
      }

      console.log('[MapViewer] Cargando PNG:', paths.png);
      console.log('[MapViewer] Rectangle:', rectangle);

      const alpha = parseFloat(document.getElementById('heatmap-alpha').value);
      currentPngUrl = paths.png;

      heatmapEntity = viewer.entities.add({
        rectangle: {
          coordinates: rectangle,
          material: createHeatmapMaterial(paths.png, alpha),
          classificationType: Cesium.ClassificationType.BOTH,
          clampToGround: true,
        }
      });

      console.log('[MapViewer] Heatmap entity creado:', heatmapEntity);
    } catch (err) {
      console.error('[MapViewer] Error cargando heatmap:', err);
    }
  });

  viewer.camera.flyTo({ destination: Cesium.Rectangle.fromDegrees(-10, 35, 5, 45), duration: 0 });
}
