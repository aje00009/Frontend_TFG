import * as Cesium from 'cesium';
import { processHeatmapAdvanced } from '../utils/processHeatmap.js';
import {
  loadImageToCanvas,
  samplePixel,
  pixelCoordsFromLonLat,
  formatCoords,
  formatElevation,
  rgbToHex,
  createGEULegendCanvas,
  classifyGEUColor,
} from '../utils/pickerUtils.js';
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
  let currentHeatmapBBox = null;
  let currentImgData = null;

  // === LEYENDA ===
  const legendDiv = document.createElement('div');
  legendDiv.className = 'absolute left-6 z-10 bg-black/60 backdrop-blur px-3 py-2 rounded-lg border border-white/10 pointer-events-none flex flex-col items-center gap-1';
  legendDiv.style.bottom = '200px';
  legendDiv.innerHTML = `
    <div class="text-[10px] text-gray-400 font-medium">Modelo</div>
    <div class="flex gap-1">
      <canvas id="map-legend-canvas" width="20" height="150" class="rounded border border-white/10"></canvas>
      <div class="flex flex-col justify-between text-[10px] text-gray-300 font-mono py-0.5">
        <span>1.0</span>
        <span>0.5</span>
        <span>0.0</span>
      </div>
    </div>
  `;
  container.appendChild(legendDiv);

  // === TOOLTIP DE PICKING ===
  const pickerDiv = document.createElement('div');
  pickerDiv.id = 'map-picker-card';
  pickerDiv.className = 'absolute bottom-6 right-6 z-10 bg-black/70 backdrop-blur px-3 py-2 rounded-lg border border-white/10 text-white text-xs hidden max-w-[220px]';
  pickerDiv.innerHTML = `
    <div class="font-semibold text-teal-400 mb-1">Punto seleccionado</div>
    <div id="map-picker-coords" class="font-mono text-[11px] text-gray-300 leading-tight"></div>
    <div id="map-picker-elev" class="font-mono text-[11px] text-gray-300 mt-1"></div>
    <div class="flex items-center gap-2 mt-1">
      <div id="map-picker-color" class="w-4 h-4 rounded border border-white/20 shrink-0"></div>
      <span id="map-picker-hex" class="font-mono text-[11px] text-gray-300"></span>
    </div>
  `;
  container.appendChild(pickerDiv);

  async function updateLegend() {
    const canvas = createGEULegendCanvas();
    const legendCanvas = document.getElementById('map-legend-canvas');
    if (canvas && legendCanvas) {
      const ctx = legendCanvas.getContext('2d');
      ctx.clearRect(0, 0, legendCanvas.width, legendCanvas.height);
      ctx.drawImage(canvas, 0, 0, legendCanvas.width, legendCanvas.height);
      legendDiv.classList.remove('hidden');
    } else {
      legendDiv.classList.add('hidden');
    }
  }

  async function handleMapClick(click) {
    const ray = viewer.camera.getPickRay(click.position);
    const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
    if (!cartesian) {
      pickerDiv.classList.add('hidden');
      return;
    }

    const carto = Cesium.Cartographic.fromCartesian(cartesian);
    const lat = Cesium.Math.toDegrees(carto.latitude);
    const lon = Cesium.Math.toDegrees(carto.longitude);
    const elev = viewer.scene.globe.getHeight(carto) ?? carto.height;

    const coords = formatCoords(lat, lon);

    let hex = '—';
    let probLabel = '';
    const colorBox = document.getElementById('map-picker-color');

    if (currentPngUrl && currentHeatmapBBox) {
      if (!currentImgData || currentImgData.url !== currentPngUrl) {
        currentImgData = await loadImageToCanvas(currentPngUrl);
        if (currentImgData) currentImgData.url = currentPngUrl;
      }
      if (currentImgData) {
        const { px, py } = pixelCoordsFromLonLat(lon, lat, currentHeatmapBBox, currentImgData.width, currentImgData.height);
        const col = samplePixel(currentImgData.ctx, px, py, currentImgData.width, currentImgData.height);
        if (col) {
          hex = rgbToHex(col.r, col.g, col.b);
          if (colorBox) colorBox.style.backgroundColor = hex;
          const cat = classifyGEUColor(col.r, col.g, col.b);
          probLabel = `${cat.label} (${cat.range})`;
        }
      }
    }

    document.getElementById('map-picker-coords').textContent = `${coords.decimal}\n${coords.dms}`;
    document.getElementById('map-picker-elev').textContent = `Elev: ${formatElevation(elev)}`;
    document.getElementById('map-picker-hex').textContent = hex + (probLabel ? `\n${probLabel}` : '');
    if (hex === '—' && colorBox) colorBox.style.backgroundColor = 'transparent';
    pickerDiv.classList.remove('hidden');
  }

  viewer.screenSpaceEventHandler.setInputAction(handleMapClick, Cesium.ScreenSpaceEventType.LEFT_CLICK);

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

  window.addEventListener('model-changed', async (e) => {
    const { paths } = e.detail;
    console.log('[MapViewer] model-changed', paths);

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
      currentHeatmapBBox = {
        west: Cesium.Math.toDegrees(rectangle.west),
        south: Cesium.Math.toDegrees(rectangle.south),
        east: Cesium.Math.toDegrees(rectangle.east),
        north: Cesium.Math.toDegrees(rectangle.north),
      };

      heatmapEntity = viewer.entities.add({
        rectangle: {
          coordinates: rectangle,
          material: createHeatmapMaterial(paths.png, alpha),
          classificationType: Cesium.ClassificationType.BOTH,
          clampToGround: true,
        }
      });

      // Precargar imagen para picking y regenerar leyenda
      currentImgData = await loadImageToCanvas(currentPngUrl);
      if (currentImgData) currentImgData.url = currentPngUrl;
      await updateLegend();

      console.log('[MapViewer] Heatmap entity creado:', heatmapEntity);
    } catch (err) {
      console.error('[MapViewer] Error cargando heatmap:', err);
    }
  });

  viewer.camera.flyTo({ destination: Cesium.Rectangle.fromDegrees(-10, 35, 5, 45), duration: 0 });
}
