import * as Cesium from 'cesium';
import { processHeatmapAdvanced } from '../utils/processHeatmap.js';
import { loadCsv } from '../utils/dataLoader.js';
import { loadSpeciesIndex, getOccurrencesPath } from '../utils/config.js';
import {
  loadImageToCanvas,
  getFlippedImageCanvas,
  samplePixel,
  pixelCoordsFromLonLat,
  formatCoords,
  formatElevation,
  rgbToHex,
  createGEULegendCanvas,
  classifyGEUColor,
  loadRasterBBox,
} from '../utils/pickerUtils.js';
import { getCesiumBackgroundColor } from '../utils/theme.js';
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

async function createHeatmapMaterial(imageUrl, globalAlpha) {
  const flippedCanvas = await getFlippedImageCanvas(imageUrl);
  return new Cesium.ImageMaterialProperty({
    image: flippedCanvas || imageUrl,
    transparent: true,
    color: new Cesium.Color(1, 1, 1, globalAlpha),
  });
}

export async function initMapViewer(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let index;
  try {
    index = await loadSpeciesIndex();
  } catch (err) {
    console.error('[MapViewer] Error cargando catálogo:', err);
  }

  Cesium.Ion.defaultAccessToken = '';

  const terrainProvider = new Cesium.EllipsoidTerrainProvider();

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
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString(getCesiumBackgroundColor());

  let heatmapEntity = null;
  let currentPngUrl = null;
  let currentHeatmapBBox = null;
  let currentImgData = null;
  let occurrenceEntities = [];
  let showOccurrences = true;

  // === LEYENDA ===
  const legendDiv = document.createElement('div');
  legendDiv.className = 'absolute left-6 z-10 bg-terra-overlay/60 backdrop-blur px-3 py-2 rounded-lg border border-terra-divider/10 pointer-events-none flex flex-col items-center gap-1';
  legendDiv.style.bottom = '200px';
  legendDiv.innerHTML = `
    <div class="text-[10px] text-terra-muted font-medium">Probabilidad</div>
    <div class="flex gap-1">
      <canvas id="map-legend-canvas" width="20" height="150" class="rounded border border-terra-divider/10"></canvas>
      <div class="flex flex-col justify-between text-[10px] text-terra-muted font-mono py-0.5">
        <span>1.0</span>
        <span>0.5</span>
        <span>0.0</span>
      </div>
    </div>
    <div class="mt-2 flex items-center justify-center gap-2">
      <span class="inline-block w-3 h-3 rounded-full bg-amber-400 border border-terra-divider/30"></span>
      <span class="text-[10px] text-terra-muted">Ocurrencias</span>
    </div>
  `;
  container.appendChild(legendDiv);

  // === TOOLTIP DE PICKING (posición junto al click) ===
  const pickerDiv = document.createElement('div');
  pickerDiv.id = 'map-picker-card';
  pickerDiv.className = 'absolute z-10 bg-terra-overlay/80 backdrop-blur px-3 py-2 rounded-lg border border-terra-divider/10 text-terra-text text-xs hidden max-w-[220px] pointer-events-none';
  pickerDiv.innerHTML = `
    <div class="font-semibold text-terra-accent mb-1">Punto seleccionado</div>
    <div id="map-picker-coords" class="font-mono text-[11px] text-terra-muted leading-tight"></div>
    <div id="map-picker-elev" class="font-mono text-[11px] text-terra-muted mt-1"></div>
    <div class="flex items-center gap-2 mt-1">
      <div id="map-picker-color" class="w-4 h-4 rounded border border-terra-divider/20 shrink-0"></div>
      <span id="map-picker-hex" class="font-mono text-[11px] text-terra-muted"></span>
    </div>
  `;
  container.appendChild(pickerDiv);

  // Coordenadas del cursor en tiempo real
  const coordsDiv = document.createElement('div');
  coordsDiv.id = 'map-coords';
  coordsDiv.className = 'absolute bottom-2 right-2 z-10 bg-terra-overlay/60 backdrop-blur px-2 py-1 rounded text-[10px] text-terra-muted font-mono pointer-events-none';
  coordsDiv.textContent = 'Lat: —  Lon: —  Elev: —';
  container.appendChild(coordsDiv);

  // Indicador visual del punto seleccionado
  let pickerMarker = null;

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
      if (pickerMarker) { viewer.entities.remove(pickerMarker); pickerMarker = null; }
      return;
    }

    const carto = Cesium.Cartographic.fromCartesian(cartesian);
    const lat = Cesium.Math.toDegrees(carto.latitude);
    const lon = Cesium.Math.toDegrees(carto.longitude);
    const elev = viewer.scene.globe.getHeight(carto) ?? carto.height;

    // Solo permitir picking dentro del bbox del heatmap
    if (currentHeatmapBBox) {
      const inside = lon >= currentHeatmapBBox.west && lon <= currentHeatmapBBox.east &&
                     lat >= currentHeatmapBBox.south && lat <= currentHeatmapBBox.north;
      if (!inside) {
        pickerDiv.classList.add('hidden');
        if (pickerMarker) { viewer.entities.remove(pickerMarker); pickerMarker = null; }
        return;
      }
    }

    // Posicionar tooltip junto al click
    const x = click.position.x;
    const y = click.position.y;
    const offset = 16;
    pickerDiv.style.left = Math.min(x + offset, container.clientWidth - 240) + 'px';
    pickerDiv.style.top = Math.min(y + offset, container.clientHeight - 160) + 'px';
    pickerDiv.style.right = 'auto';
    pickerDiv.style.bottom = 'auto';

    // Actualizar o crear marcador
    if (pickerMarker) {
      pickerMarker.position = cartesian;
    } else {
      pickerMarker = viewer.entities.add({
        position: cartesian,
        point: { pixelSize: 10, color: Cesium.Color.fromCssColorString('#2dd4a0'), outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
      });
    }

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
        const { px, py } = pixelCoordsFromLonLat(lon, lat, currentHeatmapBBox, currentImgData.width, currentImgData.height, false);
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

  // Coordenadas del cursor en tiempo real
  const moveHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  moveHandler.setInputAction((movement) => {
    if (!coordsDiv) return;
    const ray = viewer.camera.getPickRay(movement.endPosition);
    const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
    if (!cartesian) {
      coordsDiv.textContent = 'Lat: —  Lon: —  Elev: —';
      return;
    }
    const carto = Cesium.Cartographic.fromCartesian(cartesian);
    const lat = Cesium.Math.toDegrees(carto.latitude);
    const lon = Cesium.Math.toDegrees(carto.longitude);
    const elev = viewer.scene.globe.getHeight(carto) ?? carto.height;
    coordsDiv.textContent = `Lat: ${lat.toFixed(4)}°  Lon: ${lon.toFixed(4)}°  Elev: ${formatElevation(elev)}`;
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // Controles superpuestos
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'absolute bottom-6 left-6 z-10 flex flex-col gap-3';
  controlsDiv.innerHTML = `
    <div class="bg-geu-panel/90 backdrop-blur px-4 py-2 rounded-xl border border-terra-divider/10 shadow-xl flex items-center gap-2">
      <label class="text-xs text-terra-muted font-medium">Mapa base:</label>
      <select id="base-layer-select" class="geu-select text-xs py-1 min-w-[160px]">
        ${Object.entries(BASE_LAYERS).map(([k, v]) => `<option value="${k}" ${k === 'esri-satellite' ? 'selected' : ''}>${v.label}</option>`).join('')}
      </select>
    </div>
    <div class="bg-geu-panel/90 backdrop-blur px-4 py-2 rounded-xl border border-terra-divider/10 shadow-xl flex items-center gap-2">
      <label class="text-xs text-terra-muted font-medium">Opacidad heatmap:</label>
      <input id="heatmap-alpha" type="range" min="0.1" max="1" step="0.05" value="0.55" class="w-32 accent-terra-accent">
      <span id="heatmap-alpha-val" class="text-xs text-terra-accent font-mono w-8 text-right">55%</span>
    </div>
    <div class="bg-geu-panel/90 backdrop-blur px-4 py-2 rounded-xl border border-terra-divider/10 shadow-xl flex items-center gap-2">
      <input id="show-occurrences" type="checkbox" checked class="w-4 h-4 accent-geu-accent rounded border-terra-divider/30">
      <label for="show-occurrences" class="text-xs text-terra-muted font-medium">Mostrar ocurrencias</label>
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

    async function updateHeatmapAlpha(val) {
    const a = parseFloat(val);
    if (heatmapEntity && currentPngUrl) {
      heatmapEntity.rectangle.material = await createHeatmapMaterial(currentPngUrl, a);
    }
    const label = document.getElementById('heatmap-alpha-val');
    if (label) label.textContent = Math.round(a * 100) + '%';
  }

  controlsDiv.querySelector('#base-layer-select').addEventListener('change', (e) => setBaseLayer(e.target.value));
  controlsDiv.querySelector('#heatmap-alpha').addEventListener('input', (e) => updateHeatmapAlpha(e.target.value));
  controlsDiv.querySelector('#show-occurrences').addEventListener('change', (e) => {
    showOccurrences = e.target.checked;
    occurrenceEntities.forEach((entity) => {
      entity.show = showOccurrences;
    });
  });
  setBaseLayer('esri-satellite');

  async function loadOccurrences(model, paths) {
    // Limpiar ocurrencias anteriores
    occurrenceEntities.forEach((entity) => viewer.entities.remove(entity));
    occurrenceEntities = [];

    if (!model || model.scenario.id !== 'actual' || !index) return;

    // Calcular bbox del heatmap para filtrar ocurrencias fuera del raster
    let bbox = null;
    if (paths) {
      bbox = await loadRasterBBox(paths);
    }

    const csvPath = getOccurrencesPath(index, model.species.id, model.algorithm.id);
    const rows = await loadCsv(csvPath);
    if (!rows || rows.length === 0) return;

    const lonKey =
      Object.keys(rows[0]).find((k) => k.toLowerCase().includes('lon')) || 'longitude';
    const latKey =
      Object.keys(rows[0]).find((k) => k.toLowerCase().includes('lat')) || 'latitude';

    rows.forEach((row) => {
      const lon = parseFloat(row[lonKey]);
      const lat = parseFloat(row[latKey]);
      if (Number.isNaN(lon) || Number.isNaN(lat)) return;

      // Ignorar ocurrencias fuera del bbox del heatmap
      if (bbox && (lon < bbox.west || lon > bbox.east || lat < bbox.south || lat > bbox.north)) {
        return;
      }

      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString('#fbbf24'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        description: `Ocurrencia de ${model.species.label}<br>Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`,
      });
      entity.show = showOccurrences;
      occurrenceEntities.push(entity);
    });
  }

  window.addEventListener('model-changed', async (e) => {
    const model = e.detail;
    const { paths } = model;
    console.log('[MapViewer] model-changed', paths);

    if (heatmapEntity) {
      viewer.entities.remove(heatmapEntity);
      heatmapEntity = null;
    }
    currentPngUrl = null;

    // Cargar/ocultar ocurrencias según escenario
    await loadOccurrences(model, paths);

    if (!paths.png) {
      console.warn('[MapViewer] No hay paths.png');
      return;
    }

    try {
      // Obtener bbox completo del raster preferentemente del GeoTIFF real
      let rectangle = Cesium.Rectangle.fromDegrees(-10, 35, 5, 45);
      const rasterBBox = await loadRasterBBox(paths);

      if (rasterBBox) {
        rectangle = Cesium.Rectangle.fromDegrees(
          rasterBBox.west, rasterBBox.south,
          rasterBBox.east, rasterBBox.north
        );
        viewer.camera.flyTo({ destination: rectangle, duration: 1.5 });
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
          material: await createHeatmapMaterial(paths.png, alpha),
          classificationType: Cesium.ClassificationType.BOTH,
          clampToGround: true,
        }
      });

      await updateLegend();

      console.log('[MapViewer] Heatmap entity creado:', heatmapEntity);
    } catch (err) {
      console.error('[MapViewer] Error cargando heatmap:', err);
    }
  });

  viewer.camera.flyTo({ destination: Cesium.Rectangle.fromDegrees(-10, 35, 5, 45), duration: 0 });

  window.addEventListener('theme-changed', () => {
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString(getCesiumBackgroundColor());
  });

  function exportPNG() {
    try {
      viewer.render();
      return viewer.canvas.toDataURL('image/png');
    } catch (err) {
      console.error('[MapViewer] Error exportando PNG:', err);
      return null;
    }
  }

  return { exportPNG };
}
