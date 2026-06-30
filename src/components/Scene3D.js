import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { loadDEM, createTerrainGeometry, lonLatToMeters } from '../utils/terrainLoader.js';
import { loadPointCloud, pointsToGeometry } from '../utils/pointCloudLoader.js';
import { loadCsv } from '../utils/dataLoader.js';
import {
  loadSpeciesIndex,
  getPaths,
  getOccurrencesPath,
  getPointCloudIndexUrl,
  getTerrainBase,
  getPeriods,
  getAlgorithm,
} from '../utils/config.js';
import { createHillshadeTexture } from '../utils/hillshade.js';
import {
  loadImageToCanvas,
  samplePixel,
  pixelCoordsFromLonLat,
  loadRasterBBox,
  formatCoords,
  formatElevation,
  rgbToHex,
  createGEULegendCanvas,
  classifyGEUColor,
} from '../utils/pickerUtils.js';
import { renderOverviewMap } from './OverviewMap.js';


export async function initScene3D(containerId, initialModel, options = {}) {
  const { disableGlobalEvents = false } = options;
  const container = document.getElementById(containerId);
  if (!container) return;

  // Cargar catálogo de especies
  let index;
  try {
    index = await loadSpeciesIndex();
  } catch (err) {
    console.error('[Scene3D] Error cargando catálogo:', err);
  }

  // Cargar lista de nubes disponibles dinámicamente según especie+algoritmo
  async function loadCloudOptions(speciesId, algoId) {
    if (!speciesId || !algoId) return [];
    try {
      const url = getPointCloudIndexUrl(speciesId, algoId);
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('[Scene3D] No se pudo cargar index.json de pointclouds:', e);
    }
    return [];
  }

  // Guardar referencia al modelo actual
  let currentModel = initialModel;
  let currentSpeciesId = initialModel?.species?.id;
  let currentAlgoId = initialModel?.algorithm?.id;

  let cloudOptions = currentModel
    ? await loadCloudOptions(currentSpeciesId, currentAlgoId)
    : [];
  if (!cloudOptions.length) {
    cloudOptions = [{ label: 'Sin nubes disponibles', url: '' }];
  }

  container.innerHTML = `
    <div id="three-canvas" class="w-full h-full relative">
      <div id="scene3d-loading" class="absolute inset-0 z-[9999] bg-terra-bg backdrop-blur flex flex-col items-center justify-center gap-3 text-terra-text transition-opacity duration-300 hidden" style="z-index: 9999;">
        <div class="w-10 h-10 border-4 border-terra-accent border-t-transparent rounded-full animate-spin"></div>
        <span class="text-sm font-medium">Cargando modelo...</span>
      </div>
      <div id="css2d-overlay" class="absolute inset-0 pointer-events-none overflow-hidden"></div>
      <div id="terrain-info" class="absolute top-3 left-3 z-10 bg-terra-overlay/60 backdrop-blur text-terra-text text-xs px-3 py-2 rounded-lg border border-terra-divider/10 pointer-events-none">
        Cargando...
      </div>
      <div class="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <div class="bg-terra-overlay/60 backdrop-blur px-3 py-2 rounded-lg border border-terra-divider/10 flex items-center gap-2">
          <label class="text-xs text-terra-muted">Textura:</label>
          <select id="texture-select" class="geu-select text-xs py-1 min-w-[160px]">
            <option value="heatmap">Heatmap modelo</option>
            <option value="satellite">ESRI Satellite</option>
            <option value="hillshade">Hillshade DEM</option>
            <option value="solid">Sólido (gris)</option>
          </select>
        </div>
        <div class="bg-terra-overlay/60 backdrop-blur px-3 py-2 rounded-lg border border-terra-divider/10 flex items-center gap-2">
          <button id="ts-toggle" class="text-xs text-terra-text font-medium bg-geu-accent/20 hover:bg-geu-accent/40 px-3 py-1.5 rounded transition-colors">
            ▶ Serie temporal
          </button>
        </div>
        <div class="bg-terra-overlay/60 backdrop-blur px-3 py-2 rounded-lg border border-terra-divider/10 flex items-center gap-2">
          <input id="show-occurrences-3d" type="checkbox" checked class="w-4 h-4 accent-geu-accent rounded border-terra-divider/30">
          <label for="show-occurrences-3d" class="text-xs text-terra-muted font-medium">Mostrar ocurrencias</label>
        </div>
        <div class="bg-terra-overlay/60 backdrop-blur px-3 py-2 rounded-lg border border-terra-divider/10 flex items-center gap-2">
          <label class="text-xs text-terra-muted font-medium">Opacidad heatmap:</label>
          <input id="heatmap-opacity-3d" type="range" min="0.1" max="1" step="0.05" value="0.7" class="w-24 accent-geu-accent">
          <span id="heatmap-opacity-3d-val" class="text-xs text-terra-accent font-mono w-8 text-right">70%</span>
        </div>
      </div>
      <!-- Panel de animación serie temporal -->
      <div id="ts-panel" class="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-terra-overlay/70 backdrop-blur px-4 py-3 rounded-xl border border-terra-divider/10 hidden min-w-[340px]">
        <div class="flex items-center justify-center gap-2 mb-2">
          <button id="ts-mode-temporal" class="ts-mode-btn flex-1 py-1.5 rounded text-xs font-medium bg-geu-accent text-terra-text">Temporal</button>
          <button id="ts-mode-scenarios" class="ts-mode-btn flex-1 py-1.5 rounded text-xs font-medium bg-terra-surface-light text-terra-muted hover:bg-gray-600">Escenarios</button>
        </div>
        <div class="flex items-center justify-between gap-3 mb-2">
          <span id="ts-param-label" class="text-[10px] uppercase tracking-wider text-terra-muted font-medium">SSP</span>
          <select id="ts-param" class="geu-select text-xs py-1 min-w-[160px]"></select>
        </div>
        <div class="flex items-center justify-center gap-2 mb-2">
          <button id="ts-prev" class="px-2 py-1 rounded bg-terra-surface-light hover:bg-gray-600 text-terra-text text-xs">◀ Ant</button>
          <button id="ts-play" class="px-3 py-1 rounded bg-geu-accent hover:bg-terra-accent-hover text-terra-text text-xs font-medium min-w-[70px]">▶ Play</button>
          <button id="ts-next" class="px-2 py-1 rounded bg-terra-surface-light hover:bg-gray-600 text-terra-text text-xs">Sig ▶</button>
        </div>
        <div id="ts-timeline" class="flex items-center gap-1"></div>
      </div>
      <!-- Leyenda del heatmap -->
      <div id="scene3d-legend" class="absolute bottom-6 left-6 z-10 bg-terra-overlay/60 backdrop-blur px-3 py-2 rounded-lg border border-terra-divider/10 pointer-events-none hidden">
        <div class="text-[10px] text-terra-muted font-medium text-center mb-1">Probabilidad</div>
        <div class="flex gap-1">
          <canvas id="scene3d-legend-canvas" width="20" height="150" class="rounded border border-terra-divider/10"></canvas>
          <div class="flex flex-col justify-between text-[10px] text-terra-muted font-mono py-0.5">
            <span>1.0</span>
            <span>0.5</span>
            <span>0.0</span>
          </div>
        </div>
        <div class="mt-2 flex items-center justify-center gap-2">
          <canvas id="scene3d-occurrence-icon" width="14" height="14" class="rounded-full"></canvas>
          <span class="text-[10px] text-terra-muted">Ocurrencias</span>
        </div>
      </div>
      <!-- Tooltip de picking -->
      <div id="scene3d-picker-card" class="absolute z-10 bg-terra-overlay/80 backdrop-blur px-3 py-2 rounded-lg border border-terra-divider/10 text-terra-text text-xs hidden max-w-[220px] pointer-events-none">
        <div class="font-semibold text-terra-accent mb-1">Punto seleccionado</div>
        <div id="scene3d-picker-coords" class="font-mono text-[11px] text-terra-muted leading-tight"></div>
        <div id="scene3d-picker-elev" class="font-mono text-[11px] text-terra-muted mt-1"></div>
        <div class="flex items-center gap-2 mt-1">
          <div id="scene3d-picker-color" class="w-4 h-4 rounded border border-terra-divider/20 shrink-0"></div>
          <span id="scene3d-picker-hex" class="font-mono text-[11px] text-terra-muted"></span>
        </div>
      </div>
      <!-- Mini mapa de situación -->
      <div id="scene3d-overview" class="absolute bottom-6 right-6 z-10 w-[240px] h-[160px] pointer-events-auto hidden sm:block"></div>
      <!-- Coordenadas del cursor -->
      <div id="scene3d-coords" class="absolute bottom-2 left-2 z-10 bg-terra-overlay/60 backdrop-blur px-2 py-1 rounded text-[10px] text-terra-muted font-mono pointer-events-none">
        Lat: —  Lon: —  Elev: —
      </div>
    </div>
  `;

  const infoEl = container.querySelector('#terrain-info');
  const loadingEl = container.querySelector('#scene3d-loading');
  const cloudSelect = container.querySelector('#cloud-select');
  const coords3dDiv = container.querySelector('#scene3d-coords');

  let loadingTimeout = null;
  function showLoading() {
    if (loadingEl) loadingEl.classList.remove('hidden');
    // Ocultar ocurrencias antiguas inmediatamente para que no se vean flotando
    // mientras se recarga el modelo.
    if (occurrenceGroup) occurrenceGroup.visible = false;
    // Seguridad: si algo se cuelga, ocultar el loading a los 12 segundos.
    if (loadingTimeout) clearTimeout(loadingTimeout);
    loadingTimeout = setTimeout(() => {
      console.warn('[Scene3D] Loading timeout: ocultando pantalla de carga por seguridad');
      hideLoading();
    }, 12000);
  }
  function hideLoading() {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      loadingTimeout = null;
    }
  }

  // === THREE.JS BASE ===
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#111111');

  const w = container.clientWidth;
  const h = container.clientHeight;
  const camera = new THREE.PerspectiveCamera(50, w / h, 1, 500000);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  container.querySelector('#three-canvas').appendChild(renderer.domElement);

  const css2dRenderer = new CSS2DRenderer();
  css2dRenderer.setSize(w, h);
  css2dRenderer.domElement.style.position = 'absolute';
  css2dRenderer.domElement.style.top = '0';
  css2dRenderer.domElement.style.left = '0';
  css2dRenderer.domElement.style.width = '100%';
  css2dRenderer.domElement.style.height = '100%';
  css2dRenderer.domElement.style.pointerEvents = 'none';
  container.querySelector('#css2d-overlay').appendChild(css2dRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;

  // === LUCES ===
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const sun = new THREE.DirectionalLight(0xfff5e6, 0.9);
  sun.position.set(200, 400, 150);
  scene.add(sun);
  scene.add(new THREE.DirectionalLight(0xcceeff, 0.15).position.set(-150, 100, -150));

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let terrainMesh = null;
  let heatmapMesh = null;
  let pointCloudMesh = null;
  let occurrenceGroup = null;
  let showOccurrences = true;
  let currentBBox = null;
  let refLat = 42.5;
  let terrainMinElevation = 0;
  let terrainMaxElevation = 0;
  let terrainWidthMeters = 0;
  let terrainHeightMeters = 0;
  let demElevations = null;
  let demWidth = 0;
  let demHeight = 0;
  let currentCloudUrl = cloudOptions[0]?.url || '';
  let currentTextureType = 'heatmap';
  let currentScenarioPng = null;
  let currentImgData = null;
  let currentHeatmapBBox = null;
  let currentHeatmapTexture = null;
  let cachedSatelliteTexture = null;
  let cachedSatelliteKey = null;

  // === ANIMACIÓN SERIE TEMPORAL ===
  let animationState = {
    isPlaying: false,
    mode: 'temporal', // 'temporal' | 'scenarios'
    sspId: null,      // fijo en modo temporal
    periodId: null,   // fijo en modo escenarios
    items: [],        // items del timeline (periods o ssps)
    itemIdx: 0,
    speedMs: 6000,
    transitionMs: 4000,
    textures: new Map(), // item.id -> Texture
    timer: null,
  };

  const scene3dLegend = container.querySelector('#scene3d-legend');
  const scene3dPicker = container.querySelector('#scene3d-picker-card');

  // Marcador visual para picking en 3D (anillo horizontal grueso, siempre encima)
  const pickerMarker = new THREE.Mesh(
    new THREE.TorusGeometry(500, 60, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, transparent: true, opacity: 0.95 })
  );
  pickerMarker.rotation.x = -Math.PI / 2;
  pickerMarker.renderOrder = 999;
  pickerMarker.visible = false;
  scene.add(pickerMarker);

  // === CARGAR TERRENO ===
  async function loadTerrain(baseUrl = './data/terrain') {
    try {
      const demData = await loadDEM(baseUrl);
      refLat = (demData.bbox.north + demData.bbox.south) / 2;
      currentBBox = demData.bbox;
      renderOverviewMap(container.querySelector('#scene3d-overview'), currentBBox);

      const { geometry, widthMeters, heightMeters, minElevation, maxElevation } =
        createTerrainGeometry(demData, 1.8);

      // FrontSide para no ver las paredes inferiores/laterales del terreno
      const terrainMat = new THREE.MeshStandardMaterial({
        color: 0xdddddd,
        roughness: 0.9,
        metalness: 0.05,
        flatShading: false,
        side: THREE.FrontSide,
      });

      terrainMesh = new THREE.Mesh(geometry, terrainMat);
      terrainMesh.rotation.x = -Math.PI / 2;
      worldGroup.add(terrainMesh);

      terrainMinElevation = minElevation;
      terrainMaxElevation = maxElevation;
      demElevations = demData.elevations;
      demWidth = demData.width;
      demHeight = demData.height;
      terrainWidthMeters = widthMeters;
      terrainHeightMeters = heightMeters;
      const range = maxElevation - minElevation;
      infoEl.innerHTML = `
        <div class="font-semibold text-terra-accent mb-1">Terreno DEM cargado</div>
        <div>${demData.width}×${demData.height} px</div>
        <div>Elev: ${minElevation.toFixed(0)} – ${maxElevation.toFixed(0)} m</div>
        <div>Δh: ${range.toFixed(0)} m</div>
        <div id="cloud-info"></div>
      `;

      const centerY = range * 0.5;
      const diag = Math.max(widthMeters, heightMeters);
      controls.target.set(0, centerY, 0);
      camera.position.set(diag * 0.5, diag * 0.7, diag * 0.5);
      controls.maxPolarAngle = Math.PI / 2 - 0.02;
      controls.minDistance = diag * 0.05;
      controls.maxDistance = diag * 5;
      controls.update();

      return { widthMeters, heightMeters, minElevation, maxElevation };
    } catch (err) {
      console.error('[Scene3D] Error cargando DEM:', err);
      infoEl.innerHTML = `<span class="text-red-400">Error DEM: ${err.message}</span>`;
      throw err;
    }
  }

  // Placeholder textura transparente 1x1
  const placeholderTex = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0,0,1,1);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  function createHeatmapMaterial(tex1, tex2) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTex1: { value: tex1 || placeholderTex },
        uTex2: { value: tex2 || placeholderTex },
        uMixRatio: { value: 0.0 },
        uOpacity: { value: 0.7 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTex1;
        uniform sampler2D uTex2;
        uniform float uMixRatio;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          vec4 c1 = texture2D(uTex1, vUv);
          vec4 c2 = texture2D(uTex2, vUv);
          vec4 col = mix(c1, c2, uMixRatio);
          // Atenuación del brillo en el visor 3D:
          // Curva suave que comprime los altos sin oscurecer los medios/bajos
          col.rgb = pow(col.rgb, vec3(1.25)) * 0.8;
          col.a *= uOpacity;
          if (col.a < 0.01) discard;
          gl_FragColor = col;
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -4.0,
      polygonOffsetUnits: -4.0,
    });
  }

  // === CARGAR HEATMAP ===
  async function loadHeatmap(model, opts = {}) {
    const { animate = false, duration = 4000, texture: preloadedTexture = null } = opts;
    if (!terrainMesh || !currentBBox || !index) return null;
    const paths = getPaths(index, model.species.id, model.algorithm.id, model.scenario);
    if (!paths.png) return null;

    const texture = preloadedTexture || await loadTexture(paths.png, { flipY: false });
    if (!texture) return null;
    // Los PNGs de probabilidad son south-up respecto a la geometría north-up;
    // flipY=false los alinea correctamente.
    texture.flipY = false;
    currentHeatmapTexture = texture;

    if (!heatmapMesh) {
      const geo = terrainMesh.geometry.clone();

      // Recortar el heatmap al bbox del DEM. Los PNGs son north-up, por lo que
      // las UVs del terreno (v=0 sur, v=1 norte) se mapean directamente.
      if (currentHeatmapBBox && currentBBox) {
        const uvs = geo.attributes.uv.array;
        const uMin = (currentBBox.west - currentHeatmapBBox.west) / (currentHeatmapBBox.east - currentHeatmapBBox.west);
        const uMax = (currentBBox.east - currentHeatmapBBox.west) / (currentHeatmapBBox.east - currentHeatmapBBox.west);
        const vMin = (currentBBox.south - currentHeatmapBBox.south) / (currentHeatmapBBox.north - currentHeatmapBBox.south);
        const vMax = (currentBBox.north - currentHeatmapBBox.south) / (currentHeatmapBBox.north - currentHeatmapBBox.south);
        for (let i = 0; i < uvs.length; i += 2) {
          const u = uvs[i];
          const v = uvs[i + 1];
          uvs[i] = uMin + u * (uMax - uMin);
          uvs[i + 1] = vMin + v * (vMax - vMin);
        }
        geo.attributes.uv.needsUpdate = true;
      }

      const mat = createHeatmapMaterial(texture, placeholderTex);
      heatmapMesh = new THREE.Mesh(geo, mat);
      heatmapMesh.rotation.x = -Math.PI / 2;
      heatmapMesh.position.y = 0.5;
      worldGroup.add(heatmapMesh);
      return texture;
    }

    const mat = heatmapMesh.material;
    if (animate) {
      // Transición suave (serie temporal)
      mat.uniforms.uTex2.value = texture;
      mat.uniforms.uMixRatio.value = 0.0;
      const start = performance.now();
      function step(now) {
        const t = Math.min((now - start) / duration, 1);
        const ease = t * t * (3 - 2 * t); // smoothstep
        mat.uniforms.uMixRatio.value = ease;
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          mat.uniforms.uTex1.value = texture;
          mat.uniforms.uMixRatio.value = 0.0;
          mat.uniforms.uTex2.value = placeholderTex;
        }
      }
      requestAnimationFrame(step);
    } else {
      // Cambio directo
      mat.uniforms.uTex1.value = texture;
      mat.uniforms.uMixRatio.value = 0.0;
      mat.uniforms.uTex2.value = placeholderTex;
    }
    return texture;
  }

  // Textura compartida para los markers de ocurrencias
  const occurrenceMarkerTexture = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Fondo transparente; todo lo demás opaco para que el billboard opaco se vea nítido
    ctx.clearRect(0, 0, 128, 128);

    // Cuerpo del pin (forma de gota), punta en el centro inferior del canvas
    ctx.beginPath();
    ctx.moveTo(64, 110);
    ctx.bezierCurveTo(20, 76, 20, 28, 64, 28);
    ctx.bezierCurveTo(108, 28, 108, 76, 64, 110);
    ctx.closePath();

    // Relleno blanco opaco
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Borde negro grueso para resaltar sobre cualquier fondo
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // Círculo interior naranja
    ctx.beginPath();
    ctx.arc(64, 52, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4500';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  function createOccurrenceLegendIcon() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(8, 14);
    ctx.bezierCurveTo(2.5, 9.5, 2.5, 3.5, 8, 3.5);
    ctx.bezierCurveTo(13.5, 3.5, 13.5, 9.5, 8, 14);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#333333';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8, 6.5, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4500';
    ctx.fill();
    return canvas;
  }

  // === CARGAR OCURRENCIAS (solo escenario actual) ===
  async function loadOccurrences3D(model) {
    if (occurrenceGroup) {
      worldGroup.remove(occurrenceGroup);
      occurrenceGroup.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      occurrenceGroup = null;
    }

    // Limpiar posibles markers HTML huérfanos del renderer 2D
    if (css2dRenderer) {
      css2dRenderer.domElement.querySelectorAll('.occurrence-marker-anchor').forEach((el) => el.remove());
    }

    if (!model || model.scenario.id !== 'actual' || !index || !currentBBox) return;

    const csvPath = getOccurrencesPath(index, model.species.id, model.algorithm.id);
    const rows = await loadCsv(csvPath);
    if (!rows || rows.length === 0) return;

    const lonKey =
      Object.keys(rows[0]).find((k) => k.toLowerCase().includes('lon')) || 'longitude';
    const latKey =
      Object.keys(rows[0]).find((k) => k.toLowerCase().includes('lat')) || 'latitude';

    occurrenceGroup = new THREE.Group();

    // Centrar las ocurrencias respecto al bbox del DEM, igual que el terreno.
    const centerLon = (currentBBox.west + currentBBox.east) / 2;
    const centerLat = (currentBBox.south + currentBBox.north) / 2;
    const centerM = lonLatToMeters(centerLon, centerLat, refLat);

    rows.forEach((row) => {
      const lon = parseFloat(row[lonKey]);
      const lat = parseFloat(row[latKey]);
      if (Number.isNaN(lon) || Number.isNaN(lat)) return;

      // Ignorar ocurrencias fuera del bbox del DEM
      if (
        lon < currentBBox.west ||
        lon > currentBBox.east ||
        lat < currentBBox.south ||
        lat > currentBBox.north
      ) {
        return;
      }

      const m = lonLatToMeters(lon, lat, refLat);
      const x = m.x - centerM.x;
      // El mesh del terreno está rotado -90° en X: el eje Y original (norte)
      // de la geometría se proyecta en -Z. Por eso latitud positiva (norte)
      // debe ir hacia Z negativo.
      const z = -(m.y - centerM.y);
      const elev = getElevationAtLonLat(lon, lat);
      const y = elev !== null ? (elev - terrainMinElevation) * 1.8 : 0;

      const anchor = document.createElement('div');
      anchor.className = 'occurrence-marker-anchor';
      anchor.innerHTML = `
        <div class="occurrence-marker-3d">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="white" stroke="black" stroke-width="1.5"/>
            <circle cx="12" cy="9" r="2.5" fill="#ff4500" stroke="black" stroke-width="1"/>
          </svg>
        </div>
      `;

      const marker = new CSS2DObject(anchor);
      marker.position.set(x, y, z);
      occurrenceGroup.add(marker);
    });

    occurrenceGroup.visible = showOccurrences;
    worldGroup.add(occurrenceGroup);
  }

  // === CARGAR NUBE DE PUNTOS ===
  async function loadPointCloudScene() {
    const cloudInfo = infoEl.querySelector('#cloud-info');
    if (cloudInfo) cloudInfo.innerHTML = '<span class="text-terra-muted">Cargando nube...</span>';

    try {
      const data = await loadPointCloud(currentCloudUrl);
      if (!data) {
        if (cloudInfo) cloudInfo.innerHTML = '<span class="text-terra-subtle">Sin nube</span>';
        return;
      }

      let geometry;
      let rawCount = 0;

      if (data instanceof THREE.BufferGeometry) {
        const posAttr = data.attributes.position;
        const positions = posAttr.array;
        const colAttr = data.attributes.color;
        const colors = colAttr ? colAttr.array : null;

        // Calcular bbox
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < positions.length; i += 3) {
          if (positions[i] < minX) minX = positions[i];
          if (positions[i] > maxX) maxX = positions[i];
          if (positions[i+1] < minY) minY = positions[i+1];
          if (positions[i+1] > maxY) maxY = positions[i+1];
          if (positions[i+2] < minZ) minZ = positions[i+2];
          if (positions[i+2] > maxZ) maxZ = positions[i+2];
        }

        const isRealGeo = minX > -10 && maxX < 10 && minY > 35 && maxY < 50;

        // Transformar coordenadas
        if (isRealGeo) {
          for (let i = 0; i < positions.length; i += 3) {
            const m = lonLatToMeters(positions[i], positions[i+1], refLat);
            const elev = (positions[i+2] - terrainMinElevation) * 1.8;
            positions[i] = m.x;
            positions[i+1] = elev;
            positions[i+2] = m.y;
          }
        } else {
          const demCenterLon = (currentBBox.west + currentBBox.east) / 2;
          const demCenterLat = (currentBBox.south + currentBBox.north) / 2;
          const plyCenterX = (minX + maxX) / 2;
          const plyCenterY = (minY + maxY) / 2;
          const offsetX = demCenterLon - plyCenterX;
          const offsetY = demCenterLat - plyCenterY;
          const zScale = (maxZ < 10) ? 1000 : 1;

          for (let i = 0; i < positions.length; i += 3) {
            const lon = positions[i] + offsetX;
            const lat = positions[i+1] + offsetY;
            const m = lonLatToMeters(lon, lat, refLat);
            const elev = (positions[i+2] * zScale - terrainMinElevation) * 1.8;
            positions[i] = m.x;
            positions[i+1] = elev;
            positions[i+2] = m.y;
          }
        }
        posAttr.needsUpdate = true;

        // Downsampling para nubes enormes: mostrar solo 1 de cada N puntos
        const totalPoints = posAttr.count;
        const stride = totalPoints > 2000000 ? 200 : (totalPoints > 500000 ? 50 : (totalPoints > 100000 ? 10 : 1));
        rawCount = totalPoints;

        if (stride > 1) {
          const sampledCount = Math.floor(totalPoints / stride);
          const sampledPositions = new Float32Array(sampledCount * 3);
          const sampledColors = colors ? new Float32Array(sampledCount * 3) : null;

          for (let i = 0, j = 0; i < totalPoints; i += stride, j++) {
            sampledPositions[j * 3] = positions[i * 3];
            sampledPositions[j * 3 + 1] = positions[i * 3 + 1];
            sampledPositions[j * 3 + 2] = positions[i * 3 + 2];
            if (sampledColors) {
              sampledColors[j * 3] = colors[i * 3];
              sampledColors[j * 3 + 1] = colors[i * 3 + 1];
              sampledColors[j * 3 + 2] = colors[i * 3 + 2];
            }
          }

          geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(sampledPositions, 3));
          if (sampledColors) {
            geometry.setAttribute('color', new THREE.BufferAttribute(sampledColors, 3));
          }
          rawCount = sampledCount;
        } else {
          geometry = data;
        }
      } else if (Array.isArray(data)) {
        rawCount = data.length;
        const converted = data.map(p => {
          const isGeo = Math.abs(p.x) < 180 && Math.abs(p.y) < 90;
          let mx, my;
          if (isGeo) {
            const m = lonLatToMeters(p.x, p.y, refLat);
            mx = m.x; my = m.y;
          } else {
            mx = p.x; my = p.y;
          }
          return { x: mx, y: (p.z || 0 - terrainMinElevation) * 1.8, z: my, r: p.r, g: p.g, b: p.b };
        });
        geometry = pointsToGeometry(converted);
      } else {
        console.warn('[Scene3D] Formato no reconocido');
        return;
      }

      const material = new THREE.PointsMaterial({
        size: 4.0,
        vertexColors: geometry.attributes.color != null,
        color: geometry.attributes.color != null ? 0xffffff : 0x00ff88,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      });

      pointCloudMesh = new THREE.Points(geometry, material);
      worldGroup.add(pointCloudMesh);

      if (cloudInfo) {
        cloudInfo.innerHTML = `<div class="mt-1 text-terra-accent">Nube: ${rawCount.toLocaleString()} pts mostrados</div>`;
      }
    } catch (err) {
      console.error('[Scene3D] Error cargando nube:', err);
      if (cloudInfo) cloudInfo.innerHTML = `<div class="mt-1 text-red-400">Nube: error</div>`;
    }
  }

  // === FUNCIONES DE ANIMACIÓN SERIE TEMPORAL ===
  function buildScenario(speciesId, algoId, sspId, periodId) {
    const algo = getAlgorithm(index, speciesId, algoId);
    const ssp = algo?.ssps?.find(s => s.id === sspId);
    if (!ssp || !periodId) return null;
    return {
      id: `${sspId}_${periodId}`,
      label: `${ssp.label} (${getPeriods().find(p => p.id === periodId)?.label || periodId})`,
      folder: `future/${sspId}_${periodId}`,
      suffix: `${ssp.suffix}_${periodId.replace('_', '-')}`,
    };
  }

  function getParamLabel() {
    return animationState.mode === 'temporal' ? 'SSP' : 'Período';
  }

  function getParamOptions(model) {
    const algo = model?.algorithm;
    if (animationState.mode === 'temporal') {
      return (algo?.ssps || []).map(s => ({ id: s.id, label: s.label }));
    } else {
      return getPeriods().filter(p => algo?.periods?.includes(p.id)).map(p => ({ id: p.id, label: p.label }));
    }
  }

  function getFixedParam() {
    return animationState.mode === 'temporal' ? animationState.sspId : animationState.periodId;
  }

  function setFixedParam(value) {
    if (animationState.mode === 'temporal') animationState.sspId = value;
    else animationState.periodId = value;
  }

  async function preloadForMode(model) {
    if (!index) return;
    const algo = model.algorithm;
    animationState.textures.clear();

    // Precargar escenario actual primero
    const actualScenario = { id: 'actual', label: 'Actual (Presente)', folder: 'current', suffix: 'Actual' };
    const actualPaths = getPaths(index, model.species.id, model.algorithm.id, actualScenario);
    const actualTex = await loadTexture(actualPaths.png, { flipY: false });
    if (actualTex) animationState.textures.set('actual', actualTex);

    if (animationState.mode === 'temporal') {
      const periods = getPeriods().filter(p => algo?.periods?.includes(p.id));
      animationState.items = [{ id: 'actual', label: 'Actual' }, ...periods];
      const sspId = animationState.sspId;
      for (const item of periods) {
        const scenario = buildScenario(model.species.id, model.algorithm.id, sspId, item.id);
        if (!scenario) continue;
        const paths = getPaths(index, model.species.id, model.algorithm.id, scenario);
        const tex = await loadTexture(paths.png, { flipY: false });
        if (tex) animationState.textures.set(item.id, tex);
      }
    } else {
      const ssps = (algo?.ssps || []).map(s => ({ id: s.id, label: s.label }));
      animationState.items = [{ id: 'actual', label: 'Actual' }, ...ssps];
      const periodId = animationState.periodId;
      for (const item of ssps) {
        const scenario = buildScenario(model.species.id, model.algorithm.id, item.id, periodId);
        if (!scenario) continue;
        const paths = getPaths(index, model.species.id, model.algorithm.id, scenario);
        const tex = await loadTexture(paths.png, { flipY: false });
        if (tex) animationState.textures.set(item.id, tex);
      }
    }
  }

  async function loadTexture(url, { flipY = false } = {}) {
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(
        url,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.flipY = flipY;
          t.magFilter = THREE.LinearFilter;
          t.minFilter = THREE.LinearFilter;
          t.anisotropy = renderer.capabilities.getMaxAnisotropy();
          resolve(t);
        },
        undefined,
        () => resolve(null)
      );
    });
  }

  async function goToItem(idx) {
    if (!animationState.items.length || !currentModel) return;
    animationState.itemIdx = ((idx % animationState.items.length) + animationState.items.length) % animationState.items.length;
    const item = animationState.items[animationState.itemIdx];

    let scenario;
    if (item.id === 'actual') {
      scenario = { id: 'actual', label: 'Actual (Presente)', folder: 'current', suffix: 'Actual' };
    } else if (animationState.mode === 'temporal') {
      scenario = buildScenario(currentModel.species.id, currentModel.algorithm.id, animationState.sspId, item.id);
    } else {
      scenario = buildScenario(currentModel.species.id, currentModel.algorithm.id, item.id, animationState.periodId);
    }
    if (!scenario) return;

    const model = {
      ...currentModel,
      period: item.id === 'actual' ? null : (animationState.mode === 'temporal' ? item : getPeriods().find(p => p.id === animationState.periodId)),
      scenario,
      paths: getPaths(index, currentModel.species.id, currentModel.algorithm.id, scenario),
    };

    currentScenarioPng = model.paths?.png || null;
    await updateHeatmapBBoxFromScenario(model);
    await updateLegend();

    if (currentTextureType === 'heatmap') {
      const precached = animationState.textures.get(item.id);
      await loadHeatmap(model, { animate: true, duration: animationState.transitionMs, texture: precached });
    }

    updateTimelineUI();
  }

  function playAnimation() {
    if (animationState.isPlaying) return;
    animationState.isPlaying = true;
    updatePlayButton();

    function tick() {
      if (!animationState.isPlaying) return;
      animationState.timer = setTimeout(async () => {
        if (!animationState.isPlaying) return;
        let nextIdx = (animationState.itemIdx + 1) % animationState.items.length;
        let attempts = 0;
        while (!animationState.textures.has(animationState.items[nextIdx].id) && attempts < animationState.items.length) {
          nextIdx = (nextIdx + 1) % animationState.items.length;
          attempts++;
        }
        if (animationState.textures.has(animationState.items[nextIdx].id)) {
          await goToItem(nextIdx);
        }
        tick();
      }, animationState.speedMs);
    }
    tick();
  }

  function stopAnimation() {
    animationState.isPlaying = false;
    if (animationState.timer) {
      clearTimeout(animationState.timer);
      animationState.timer = null;
    }
    updatePlayButton();
  }

  function updatePlayButton() {
    const btn = container.querySelector('#ts-play');
    if (btn) btn.textContent = animationState.isPlaying ? '⏸ Pausa' : '▶ Play';
  }

  function updateTimelineUI() {
    const timeline = container.querySelector('#ts-timeline');
    if (!timeline || !animationState.items.length) return;
    timeline.innerHTML = animationState.items.map((item, i) => {
      const hasData = animationState.textures.has(item.id);
      const active = i === animationState.itemIdx;
      return `
        <button class="ts-timeline-btn flex-1 py-2 rounded text-xs font-medium transition-colors ${active ? 'bg-geu-accent text-terra-text' : (hasData ? 'bg-terra-surface-light text-terra-muted hover:bg-gray-600' : 'bg-terra-surface text-terra-dim cursor-not-allowed')}" data-idx="${i}" ${!hasData ? 'disabled' : ''}>
          ${item.label}
        </button>
      `;
    }).join('');
    timeline.querySelectorAll('.ts-timeline-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        stopAnimation();
        goToItem(parseInt(btn.dataset.idx));
      });
    });
  }

  async function initAnimationForModel(model) {
    if (!model) return;
    stopAnimation();

    // Inferir parámetro fijo del modelo actual si no está seteado
    const inferredSsp = model.scenario?.id?.split('_')[0];
    const algo = model.algorithm;
    const ssps = algo?.ssps || [];
    const periods = getPeriods().filter(p => algo?.periods?.includes(p.id));

    if (animationState.mode === 'temporal') {
      if (!animationState.sspId || !ssps.find(s => s.id === animationState.sspId)) {
        animationState.sspId = (inferredSsp && ssps.find(s => s.id === inferredSsp)) ? inferredSsp : (ssps[0]?.id || null);
      }
      animationState.periodId = null;
    } else {
      if (!animationState.periodId || !periods.find(p => p.id === animationState.periodId)) {
        animationState.periodId = periods[periods.length - 1]?.id || null;
      }
      animationState.sspId = null;
    }

    await preloadForMode(model);
    animationState.itemIdx = animationState.items.length - 1;
    await goToItem(animationState.itemIdx);
    updateParamSelect(model);
    updateModeButtons();
  }

  function updateModeButtons() {
    const btnTemp = container.querySelector('#ts-mode-temporal');
    const btnSce = container.querySelector('#ts-mode-scenarios');
    if (!btnTemp || !btnSce) return;
    if (animationState.mode === 'temporal') {
      btnTemp.className = 'ts-mode-btn flex-1 py-1.5 rounded text-xs font-medium bg-geu-accent text-terra-text';
      btnSce.className = 'ts-mode-btn flex-1 py-1.5 rounded text-xs font-medium bg-terra-surface-light text-terra-muted hover:bg-gray-600';
    } else {
      btnTemp.className = 'ts-mode-btn flex-1 py-1.5 rounded text-xs font-medium bg-terra-surface-light text-terra-muted hover:bg-gray-600';
      btnSce.className = 'ts-mode-btn flex-1 py-1.5 rounded text-xs font-medium bg-geu-accent text-terra-text';
    }
    const label = container.querySelector('#ts-param-label');
    if (label) label.textContent = getParamLabel();
  }

  function updateParamSelect(model) {
    const select = container.querySelector('#ts-param');
    if (!select) return;
    const options = getParamOptions(model);
    const currentVal = getFixedParam();
    select.innerHTML = options.map(o =>
      `<option value="${o.id}" ${o.id === currentVal ? 'selected' : ''}>${o.label}</option>`
    ).join('');
    if (options.find(o => o.id === currentVal)) {
      select.value = currentVal;
    } else if (options.length) {
      select.value = options[0].id;
      setFixedParam(options[0].id);
    }
  }

  // === INICIALIZACIÓN ===
  let terrainInfo = null;
  const speciesTerrainBase = initialModel ? getTerrainBase(initialModel.species.id, initialModel.algorithm.id) : './data/terrain';
  try {
    terrainInfo = await loadTerrain(speciesTerrainBase);
  } catch (err) {
    console.warn(`[Scene3D] DEM específico no disponible en ${speciesTerrainBase}, usando DEM global.`);
    try {
      terrainInfo = await loadTerrain('./data/terrain');
    } catch (fallbackErr) {
      console.error('[Scene3D] No se pudo cargar ningún DEM:', fallbackErr);
    }
  }
  if (terrainInfo) {
    if (initialModel) {
      await updateHeatmapBBoxFromScenario(initialModel);
      await applyTerrainTexture('heatmap', initialModel);
    }
    if (cloudOptions.some(o => o.url)) await loadPointCloudScene();
  }

  // === CARGAR TEXTURA SATELITE (con caché y reintento) ===
  async function loadSatelliteTexture(attempt = 1) {
    if (!currentBBox || !demWidth || !demHeight) return null;
    const key = `${currentBBox.west.toFixed(6)},${currentBBox.south.toFixed(6)},${currentBBox.east.toFixed(6)},${currentBBox.north.toFixed(6)}|${demWidth}x${demHeight}`;
    if (cachedSatelliteTexture && cachedSatelliteKey === key) return cachedSatelliteTexture;

    const bbox = currentBBox;
    const w = Math.min(2048, Math.round(demWidth * 2));
    const h = Math.min(2048, Math.round(demHeight * 2));
    const url = `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}&bboxSR=4326&imageSR=4326&size=${w},${h}&format=png&f=image`;

    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(
        url,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          // Geometría north-up: uv.y=1 = norte. Las imágenes north-up se alinean
          // con el valor por defecto flipY=true.
          t.flipY = true;
          cachedSatelliteTexture = t;
          cachedSatelliteKey = key;
          console.log('[Scene3D] Satellite texture cargada:', url);
          resolve(t);
        },
        undefined,
        (err) => {
          console.warn(`[Scene3D] Error cargando satellite texture (intento ${attempt}):`, err);
          if (attempt < 2) {
            setTimeout(() => resolve(loadSatelliteTexture(attempt + 1)), 600);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  // === APLICAR TEXTURA AL TERRENO ===
  async function applyTerrainTexture(type, scenario, { skipHeatmap = false } = {}) {
    if (!terrainMesh || !demElevations) return;
    currentTextureType = type;

    // Siempre quitar overlay flotante si no estamos en modo heatmap
    if (type !== 'heatmap' && heatmapMesh) {
      worldGroup.remove(heatmapMesh);
      heatmapMesh.geometry.dispose();
      heatmapMesh.material.map?.dispose();
      heatmapMesh.material.dispose();
      heatmapMesh = null;
    }

    if (type === 'solid') {
      terrainMesh.material.map = null;
      terrainMesh.material.color.setHex(0x999999);
      terrainMesh.material.needsUpdate = true;
      return;
    }

    if (type === 'hillshade') {
      const canvas = createHillshadeTexture(demElevations, demWidth, demHeight, 2.5);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      // Geometría north-up: el hillshade generado a partir del DEM es north-up,
      // así que se alinea con flipY=true.
      tex.flipY = true;
      terrainMesh.material.map = tex;
      terrainMesh.material.color.setHex(0xffffff);
      terrainMesh.material.needsUpdate = true;
      return;
    }

    if (type === 'satellite') {
      const tex = await loadSatelliteTexture();
      if (tex) {
        terrainMesh.material.map = tex;
        terrainMesh.material.color.setHex(0xffffff);
        terrainMesh.material.needsUpdate = true;
      } else {
        console.warn('[Scene3D] No se pudo cargar satellite');
      }
      return;
    }

    // heatmap: terreno base de ESRI Satellite + overlay flotante
    if (scenario) {
      const satTex = await loadSatelliteTexture();
      if (satTex) {
        terrainMesh.material.map = satTex;
        terrainMesh.material.color.setHex(0xffffff);
      } else {
        // Fallback: si el satélite no carga, usar hillshade del DEM para no quedar en gris plano
        const hillCanvas = createHillshadeTexture(demElevations, demWidth, demHeight, 2.5);
        const hillTex = new THREE.CanvasTexture(hillCanvas);
        hillTex.colorSpace = THREE.SRGBColorSpace;
        hillTex.flipY = true;
        terrainMesh.material.map = hillTex;
        terrainMesh.material.color.setHex(0xffffff);
      }
      terrainMesh.material.needsUpdate = true;
      if (!skipHeatmap) {
        await loadHeatmap(scenario);
      }
    }
  }

  async function updateLegend() {
    const canvas = createGEULegendCanvas();
    const legendCanvas = container.querySelector('#scene3d-legend-canvas');
    const occurrenceIcon = container.querySelector('#scene3d-occurrence-icon');
    if (canvas && legendCanvas && scene3dLegend) {
      const ctx = legendCanvas.getContext('2d');
      ctx.clearRect(0, 0, legendCanvas.width, legendCanvas.height);
      ctx.drawImage(canvas, 0, 0, legendCanvas.width, legendCanvas.height);
      if (occurrenceIcon) {
        const iconCtx = occurrenceIcon.getContext('2d');
        iconCtx.clearRect(0, 0, occurrenceIcon.width, occurrenceIcon.height);
        iconCtx.drawImage(createOccurrenceLegendIcon(), 0, 0, occurrenceIcon.width, occurrenceIcon.height);
      }
      scene3dLegend.classList.remove('hidden');
    } else if (scene3dLegend) {
      scene3dLegend.classList.add('hidden');
    }
  }

  function getElevationAtUV(uv) {
    if (!demElevations || !demWidth || !demHeight) return null;
    if (!uv || uv.x < 0 || uv.x > 1 || uv.y < 0 || uv.y > 1) return null;
    // Geometría north-up: uv.y=1 es norte (fila 0 del DEM), uv.y=0 es sur.
    const col = Math.floor(uv.x * (demWidth - 1));
    const row = Math.floor((1 - uv.y) * (demHeight - 1));
    const idx = row * demWidth + col;
    const v = demElevations[idx];
    if (isNaN(v) || v <= -9999) return null;
    return v;
  }

  function getElevationAtLonLat(lon, lat) {
    if (!demElevations || !demWidth || !demHeight || !currentBBox) return null;
    const u = (lon - currentBBox.west) / (currentBBox.east - currentBBox.west);
    const v = (lat - currentBBox.south) / (currentBBox.north - currentBBox.south);
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    // Geometría north-up: uv.y=1 es norte (fila 0 del DEM), uv.y=0 es sur.
    const x = u * (demWidth - 1);
    const y = (1 - v) * (demHeight - 1);
    const x0 = Math.floor(x);
    const x1 = Math.min(x0 + 1, demWidth - 1);
    const y0 = Math.floor(y);
    const y1 = Math.min(y0 + 1, demHeight - 1);
    const fx = x - x0;
    const fy = y - y0;

    const idx00 = y0 * demWidth + x0;
    const idx10 = y0 * demWidth + x1;
    const idx01 = y1 * demWidth + x0;
    const idx11 = y1 * demWidth + x1;

    const vals = [demElevations[idx00], demElevations[idx10], demElevations[idx01], demElevations[idx11]];
    if (vals.some((val) => isNaN(val) || val <= -9999)) return null;

    const v0 = vals[0] * (1 - fx) + vals[1] * fx;
    const v1 = vals[2] * (1 - fx) + vals[3] * fx;
    return v0 * (1 - fy) + v1 * fy;
  }

  function getElevationFromPoint(point) {
    // Fallback: deshacer la exageración aplicada en createTerrainGeometry
    if (!terrainMesh || terrainMinElevation === undefined) return null;
    // La geometría local tiene z = (elev - minEl) * exaggeration
    const localPoint = terrainMesh.worldToLocal(point.clone());
    const localZ = localPoint.z;
    const exaggeration = 1.8;
    const elev = localZ / exaggeration + terrainMinElevation;
    return isNaN(elev) ? null : elev;
  }

  async function handleSceneClick(event) {
    if (!terrainMesh || !currentBBox || !currentScenarioPng) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    // Siempre intersectamos con el terreno base; el overlay (si existe) es transparente
    // para el picking y no afecta la coordenada geográfica.
    const intersects = raycaster.intersectObject(terrainMesh);
    if (intersects.length === 0) {
      if (scene3dPicker) scene3dPicker.classList.add('hidden');
      if (pickerMarker) pickerMarker.visible = false;
      return;
    }

    const hit = intersects[0];
    const uv = hit.uv;
    if (!uv || uv.x < 0 || uv.x > 1 || uv.y < 0 || uv.y > 1) {
      console.warn('[Scene3D] UV fuera de rango:', uv);
      if (scene3dPicker) scene3dPicker.classList.add('hidden');
      if (pickerMarker) pickerMarker.visible = false;
      return;
    }

    // uv.y=0 corresponde al sur del DEM y uv.y=1 al norte.
    const lon = currentBBox.west + uv.x * (currentBBox.east - currentBBox.west);
    const lat = currentBBox.south + uv.y * (currentBBox.north - currentBBox.south);
    let elev = getElevationAtUV(uv);
    if (elev === null) {
      elev = getElevationFromPoint(hit.point);
    }
    const coords = formatCoords(lat, lon);

    let hex = '—';
    let probLabel = '';
    const colorBox = container.querySelector('#scene3d-picker-color');

    const bboxForPng = currentHeatmapBBox || currentBBox;
    if (!currentImgData || currentImgData.url !== currentScenarioPng) {
      currentImgData = await loadImageToCanvas(currentScenarioPng);
      if (currentImgData) currentImgData.url = currentScenarioPng;
    }
    if (currentImgData) {
      const { px, py } = pixelCoordsFromLonLat(lon, lat, bboxForPng, currentImgData.width, currentImgData.height, false);
      const col = samplePixel(currentImgData.ctx, px, py, currentImgData.width, currentImgData.height);
      if (col) {
        hex = rgbToHex(col.r, col.g, col.b);
        if (colorBox) colorBox.style.backgroundColor = hex;
        const cat = classifyGEUColor(col.r, col.g, col.b);
        probLabel = `${cat.label} (${cat.range})`;
      }
    }

    container.querySelector('#scene3d-picker-coords').textContent = `${coords.decimal}\n${coords.dms}`;
    container.querySelector('#scene3d-picker-elev').textContent = `Elev: ${formatElevation(elev)}`;
    container.querySelector('#scene3d-picker-hex').textContent = hex + (probLabel ? `\n${probLabel}` : '');
    if (hex === '—' && colorBox) colorBox.style.backgroundColor = 'transparent';

    // Posicionar tooltip junto al click y mostrar marcador
    if (scene3dPicker) {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      scene3dPicker.style.left = Math.min(x + 16, rect.width - 240) + 'px';
      scene3dPicker.style.top = Math.min(y + 16, rect.height - 160) + 'px';
      scene3dPicker.style.bottom = 'auto';
      scene3dPicker.style.transform = 'none';
      scene3dPicker.classList.remove('hidden');
    }
    if (pickerMarker) {
      pickerMarker.position.copy(hit.point);
      pickerMarker.position.y += 80;
      pickerMarker.visible = true;
    }
  }

  // === DRAG DETECTION para evitar picking al orbitar ===
  let dragStartPos = null;
  let isDragging = false;
  const DRAG_THRESHOLD = 6;

  renderer.domElement.addEventListener('pointerdown', (e) => {
    dragStartPos = { x: e.clientX, y: e.clientY };
    isDragging = false;
  });

  renderer.domElement.addEventListener('pointermove', (e) => {
    if (dragStartPos) {
      const dx = e.clientX - dragStartPos.x;
      const dy = e.clientY - dragStartPos.y;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        isDragging = true;
      }
    }
  });

  renderer.domElement.addEventListener('pointerup', () => {
    dragStartPos = null;
  });

  // === BLOQUEAR SCROLL DE PÁGINA AL HACER ZOOM EN 3D ===
  renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
  }, { passive: false });

  // === COORDENADAS DEL CURSOR EN TIEMPO REAL ===
  let lastCoordsPick = 0;
  renderer.domElement.addEventListener('pointermove', (e) => {
    const now = performance.now();
    if (now - lastCoordsPick < 80) return;
    lastCoordsPick = now;
    if (!terrainMesh || !currentBBox || !coords3dDiv) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const mouse = new THREE.Vector2(x, y);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(terrainMesh);
    if (intersects.length === 0) {
      coords3dDiv.textContent = 'Lat: —  Lon: —  Elev: —';
      return;
    }
    const uv = intersects[0].uv;
    const lon = currentBBox.west + uv.x * (currentBBox.east - currentBBox.west);
    const lat = currentBBox.south + uv.y * (currentBBox.north - currentBBox.south);
    const elev = getElevationAtUV(uv);
    coords3dDiv.textContent = `Lat: ${lat.toFixed(4)}°  Lon: ${lon.toFixed(4)}°  Elev: ${formatElevation(elev)}`;
  });

  // Wrapper que ignora clicks que fueron parte de un drag
  function onSceneClickWrapper(event) {
    if (isDragging) {
      isDragging = false;
      return;
    }
    handleSceneClick(event);
  }

  renderer.domElement.addEventListener('click', onSceneClickWrapper);

  async function updateHeatmapBBoxFromScenario(model) {
    if (!index) return;
    const paths = getPaths(index, model.species.id, model.algorithm.id, model.scenario);
    const rasterBBox = await loadRasterBBox(paths);
    if (rasterBBox) {
      currentHeatmapBBox = rasterBBox;
    } else {
      currentHeatmapBBox = null;
    }
  }

  async function applyModel(model) {
    if (!model) return;
    const speciesChanged = model.species?.id !== currentSpeciesId;
    const algoChanged = model.algorithm?.id !== currentAlgoId;
    const isHeavyLoad = !terrainMesh || speciesChanged || algoChanged;
    console.log('[Scene3D] applyModel start', model.species?.id, model.algorithm?.id, model.scenario?.id, 'heavy=', isHeavyLoad);
    if (isHeavyLoad) showLoading();
    try {
      currentModel = model;

      // Recargar terreno y nubes solo si cambió especie o algoritmo
      const speciesOrAlgoChanged = speciesChanged || algoChanged;
      if (speciesOrAlgoChanged && model.species && model.algorithm) {
        currentSpeciesId = model.species.id;
        currentAlgoId = model.algorithm.id;
        console.log('[Scene3D] Recargando terreno y nubes...');

      // Recargar DEM específico para la nueva especie/algoritmo
      const newTerrainBase = getTerrainBase(currentSpeciesId, currentAlgoId);
      try {
        // Limpiar terreno y heatmap anteriores
        if (terrainMesh) {
          worldGroup.remove(terrainMesh);
          terrainMesh.geometry.dispose();
          terrainMesh.material.dispose();
          terrainMesh = null;
        }
        if (heatmapMesh) {
          worldGroup.remove(heatmapMesh);
          heatmapMesh.geometry.dispose();
          heatmapMesh.material.dispose();
          heatmapMesh = null;
        }
        await loadTerrain(newTerrainBase);
        console.log('[Scene3D] Terreno cargado');
      } catch (e) {
        console.warn(`[Scene3D] DEM específico no disponible en ${newTerrainBase}, usando DEM global.`);
        try {
          await loadTerrain('./data/terrain');
        } catch (fallbackErr) {
          console.error('[Scene3D] No se pudo cargar ningún DEM:', fallbackErr);
        }
      }

      const newOptions = await loadCloudOptions(currentSpeciesId, currentAlgoId);
      console.log('[Scene3D] Opciones nube:', newOptions.length);
      if (newOptions.length) {
        cloudOptions = newOptions;
        // Actualizar selector de nubes
        if (cloudSelect) {
          cloudSelect.innerHTML = cloudOptions.map(o => `<option value="${o.url}">${o.label}</option>`).join('');
          currentCloudUrl = cloudOptions[0]?.url || '';
          cloudSelect.value = currentCloudUrl;
        }
        // Eliminar nube anterior y cargar nueva
        if (pointCloudMesh) {
          worldGroup.remove(pointCloudMesh);
          pointCloudMesh.geometry.dispose();
          pointCloudMesh.material.dispose();
          pointCloudMesh = null;
        }
        await loadPointCloudScene();
        console.log('[Scene3D] Nube cargada');
      }
      // Resetear animación al cambiar especie/algoritmo
      stopAnimation();
      animationState.textures.clear();
    }

    console.log('[Scene3D] Aplicando textura...');
    currentScenarioPng = model.paths?.png || null;
    await updateHeatmapBBoxFromScenario(model);
    await updateLegend();
    const animPanelVisible = tsPanel && !tsPanel.classList.contains('hidden');

    // Aplicar siempre la textura base; si la animación está activa se omite el heatmap estático
    console.log('[Scene3D] applyTerrainTexture start');
    await applyTerrainTexture(currentTextureType, model, { skipHeatmap: animPanelVisible });
    console.log('[Scene3D] applyTerrainTexture end');

    // Si no estamos en modo heatmap, asegurar que no queda overlay flotante
    if (currentTextureType !== 'heatmap' && heatmapMesh) {
      worldGroup.remove(heatmapMesh);
      heatmapMesh.geometry.dispose();
      heatmapMesh.material.map?.dispose();
      heatmapMesh.material.dispose();
      heatmapMesh = null;
    }

    // Cargar/ocultar marcadores de ocurrencias
    console.log('[Scene3D] loadOccurrences3D start');
    await loadOccurrences3D(model);
    console.log('[Scene3D] loadOccurrences3D end');

    // Si el panel de animación está activo, sincronizar SSP y mostrar timeline
    if (animPanelVisible) {
      await initAnimationForModel(model);
    }
    console.log('[Scene3D] applyModel end');
    } catch (err) {
      console.error('[Scene3D] Error aplicando modelo:', err);
    } finally {
      if (isHeavyLoad) hideLoading();
    }
  }

  if (!disableGlobalEvents) {
    window.addEventListener('model-changed', async (e) => applyModel(e.detail));
  }

  if (cloudSelect) {
    let isLoadingCloud = false;
    cloudSelect.addEventListener('change', async (e) => {
      if (isLoadingCloud) return;
      isLoadingCloud = true;

      const selectedOption = cloudOptions.find(o => o.url === e.target.value);
      console.log('[Scene3D] Cambio de nube a:', e.target.value, 'escenario:', selectedOption?.scenarioId);
      currentCloudUrl = e.target.value;

      // Cambiar heatmap al escenario correspondiente
      if (selectedOption?.scenarioId) {
        // Emitir un evento interno para sincronizar el heatmap con la nube seleccionada
        // Nota: el evento real model-changed lo maneja ScenarioSelector.js
        // Aquí solo sincronizamos si el modelo actual coincide
        console.log('[Scene3D] Cambio de nube a escenario:', selectedOption.scenarioId);
      }

      if (pointCloudMesh) {
        console.log('[Scene3D] Eliminando nube anterior');
        worldGroup.remove(pointCloudMesh);
        pointCloudMesh.geometry.dispose();
        pointCloudMesh.material.dispose();
        pointCloudMesh = null;
      }
      await loadPointCloudScene();
      isLoadingCloud = false;
    });
  } else {
    console.warn('[Scene3D] No se encontró el selector de nube');
  }

  // Selector de textura del terreno
  const textureSelect = container.querySelector('#texture-select');
  if (textureSelect) {
    textureSelect.addEventListener('change', async (e) => {
      const type = e.target.value;
      await applyTerrainTexture(type, currentModel);
      const panel = container.querySelector('#ts-panel');
      if (panel) {
        if (type === 'heatmap') panel.classList.remove('hidden');
        else { panel.classList.add('hidden'); stopAnimation(); }
      }
    });
  }

  // Mostrar/ocultar ocurrencias en 3D
  const showOccurrencesCheck = container.querySelector('#show-occurrences-3d');
  if (showOccurrencesCheck) {
    showOccurrencesCheck.addEventListener('change', (e) => {
      showOccurrences = e.target.checked;
      if (occurrenceGroup) occurrenceGroup.visible = showOccurrences;
    });
  }

  // Opacidad del heatmap en 3D
  const heatmapOpacityInput = container.querySelector('#heatmap-opacity-3d');
  const heatmapOpacityVal = container.querySelector('#heatmap-opacity-3d-val');
  if (heatmapOpacityInput) {
    heatmapOpacityInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (heatmapMesh?.material?.uniforms?.uOpacity) {
        heatmapMesh.material.uniforms.uOpacity.value = val;
      }
      if (heatmapOpacityVal) heatmapOpacityVal.textContent = Math.round(val * 100) + '%';
    });
  }

  // Controles de animación serie temporal
  const tsToggle = container.querySelector('#ts-toggle');
  const tsPanel = container.querySelector('#ts-panel');
  const tsParam = container.querySelector('#ts-param');
  const tsPlay = container.querySelector('#ts-play');
  const tsPrev = container.querySelector('#ts-prev');
  const tsNext = container.querySelector('#ts-next');
  const tsModeTemp = container.querySelector('#ts-mode-temporal');
  const tsModeSce = container.querySelector('#ts-mode-scenarios');

  if (tsToggle && tsPanel) {
    tsToggle.addEventListener('click', async () => {
      if (tsPanel.classList.contains('hidden')) {
        tsPanel.classList.remove('hidden');
        if (textureSelect && textureSelect.value !== 'heatmap') {
          textureSelect.value = 'heatmap';
          await applyTerrainTexture('heatmap', currentModel);
        }
        if (currentModel) await initAnimationForModel(currentModel);
        tsToggle.textContent = '⏸ Ocultar serie';
        tsToggle.classList.add('bg-geu-accent/60');
      } else {
        tsPanel.classList.add('hidden');
        stopAnimation();
        tsToggle.textContent = '▶ Serie temporal';
        tsToggle.classList.remove('bg-geu-accent/60');
      }
    });
  }

  if (tsModeTemp) {
    tsModeTemp.addEventListener('click', async () => {
      if (animationState.mode === 'temporal') return;
      animationState.mode = 'temporal';
      if (currentModel) await initAnimationForModel(currentModel);
    });
  }

  if (tsModeSce) {
    tsModeSce.addEventListener('click', async () => {
      if (animationState.mode === 'scenarios') return;
      animationState.mode = 'scenarios';
      if (currentModel) await initAnimationForModel(currentModel);
    });
  }

  if (tsParam) {
    tsParam.addEventListener('change', async () => {
      stopAnimation();
      setFixedParam(tsParam.value);
      if (currentModel) {
        await preloadForMode(currentModel);
        animationState.itemIdx = animationState.items.length - 1;
        await goToItem(animationState.itemIdx);
        updateTimelineUI();
      }
    });
  }

  if (tsPlay) {
    tsPlay.addEventListener('click', () => {
      if (animationState.isPlaying) stopAnimation();
      else playAnimation();
    });
  }

  if (tsPrev) {
    tsPrev.addEventListener('click', () => {
      stopAnimation();
      goToItem(animationState.itemIdx - 1);
    });
  }

  if (tsNext) {
    tsNext.addEventListener('click', () => {
      stopAnimation();
      goToItem(animationState.itemIdx + 1);
    });
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    css2dRenderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
    renderer.setSize(cw, ch);
    css2dRenderer.setSize(cw, ch);
  });

  function exportPNG() {
    try {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    } catch (err) {
      console.error('[Scene3D] Error exportando PNG:', err);
      return null;
    }
  }

  async function exportGLB(filename) {
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
    const exporter = new GLTFExporter();

    // Construir grupo de exportación limpio (sin overlays duplicados)
    const exportGroup = new THREE.Group();

    // 1. Terreno con textura del heatmap aplicada directamente
    if (terrainMesh) {
      const terrainClone = terrainMesh.clone();
      if (currentHeatmapTexture) {
        // Las UVs ya están recortadas al bbox del DEM en el heatmapMesh clonado
        terrainClone.material = new THREE.MeshStandardMaterial({
          map: currentHeatmapTexture,
          roughness: 0.9,
          metalness: 0.05,
          side: THREE.FrontSide,
        });
      }
      exportGroup.add(terrainClone);
    }

    // 2. Nube de puntos (si existe)
    if (pointCloudMesh) {
      exportGroup.add(pointCloudMesh.clone());
    }

    return new Promise((resolve, reject) => {
      exporter.parse(
        exportGroup,
        (gltf) => {
          const blob = new Blob([gltf], { type: 'model/gltf-binary' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
          resolve();
        },
        (err) => {
          console.error('[Scene3D] GLTFExporter error:', err);
          reject(err);
        },
        { binary: true }
      );
    });
  }

  if (!initialModel) hideLoading();

  return { applyModel, exportPNG, exportGLB };
}
