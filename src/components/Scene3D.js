import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadDEM, createTerrainGeometry, lonLatToMeters } from '../utils/terrainLoader.js';
import { loadPointCloud, pointsToGeometry } from '../utils/pointCloudLoader.js';
import {
  loadSpeciesIndex,
  getPaths,
  getPointCloudIndexUrl,
} from '../utils/config.js';
import { createHillshadeTexture } from '../utils/hillshade.js';
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

export async function initScene3D(containerId, initialModel) {
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
      <div id="terrain-info" class="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur text-white text-xs px-3 py-2 rounded-lg border border-white/10 pointer-events-none">
        Cargando...
      </div>
      <div class="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <div class="bg-black/60 backdrop-blur px-3 py-2 rounded-lg border border-white/10 flex items-center gap-2">
          <label class="text-xs text-gray-400">Nube:</label>
          <select id="cloud-select" class="geu-select text-xs py-1 min-w-[220px]">
            ${cloudOptions.map(o => `<option value="${o.url}">${o.label}</option>`).join('')}
          </select>
        </div>
        <div class="bg-black/60 backdrop-blur px-3 py-2 rounded-lg border border-white/10 flex items-center gap-2">
          <label class="text-xs text-gray-400">Textura:</label>
          <select id="texture-select" class="geu-select text-xs py-1 min-w-[160px]">
            <option value="heatmap">Heatmap modelo</option>
            <option value="satellite">ESRI Satellite</option>
            <option value="hillshade">Hillshade DEM</option>
            <option value="solid">Sólido (gris)</option>
          </select>
        </div>
      </div>
      <!-- Leyenda del heatmap -->
      <div id="scene3d-legend" class="absolute bottom-6 left-6 z-10 bg-black/60 backdrop-blur px-3 py-2 rounded-lg border border-white/10 pointer-events-none hidden">
        <div class="text-[10px] text-gray-400 font-medium text-center mb-1">Modelo</div>
        <div class="flex gap-1">
          <canvas id="scene3d-legend-canvas" width="20" height="150" class="rounded border border-white/10"></canvas>
          <div class="flex flex-col justify-between text-[10px] text-gray-300 font-mono py-0.5">
            <span>1.0</span>
            <span>0.5</span>
            <span>0.0</span>
          </div>
        </div>
      </div>
      <!-- Tooltip de picking -->
      <div id="scene3d-picker-card" class="absolute bottom-6 left-6 z-10 bg-black/70 backdrop-blur px-3 py-2 rounded-lg border border-white/10 text-white text-xs hidden max-w-[220px]" style="transform: translateX(100px);">
        <div class="font-semibold text-teal-400 mb-1">Punto seleccionado</div>
        <div id="scene3d-picker-coords" class="font-mono text-[11px] text-gray-300 leading-tight"></div>
        <div id="scene3d-picker-elev" class="font-mono text-[11px] text-gray-300 mt-1"></div>
        <div class="flex items-center gap-2 mt-1">
          <div id="scene3d-picker-color" class="w-4 h-4 rounded border border-white/20 shrink-0"></div>
          <span id="scene3d-picker-hex" class="font-mono text-[11px] text-gray-300"></span>
        </div>
      </div>
    </div>
  `;

  const infoEl = container.querySelector('#terrain-info');
  const cloudSelect = container.querySelector('#cloud-select');

  // === THREE.JS BASE ===
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#111111');

  const w = container.clientWidth;
  const h = container.clientHeight;
  const camera = new THREE.PerspectiveCamera(50, w / h, 1, 500000);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.querySelector('#three-canvas').appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;

  // === LUCES ===
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0xfff5e6, 1.6);
  sun.position.set(200, 400, 150);
  scene.add(sun);
  scene.add(new THREE.DirectionalLight(0xcceeff, 0.3).position.set(-150, 100, -150));

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let terrainMesh = null;
  let heatmapMesh = null;
  let pointCloudMesh = null;
  let currentBBox = null;
  let refLat = 42.5;
  let terrainMinElevation = 0;
  let terrainMaxElevation = 0;
  let demElevations = null;
  let demWidth = 0;
  let demHeight = 0;
  let currentCloudUrl = cloudOptions[0]?.url || '';
  let currentTextureType = 'heatmap';
  let currentScenarioPng = null;
  let currentImgData = null;
  let currentHeatmapBBox = null;

  const scene3dLegend = container.querySelector('#scene3d-legend');
  const scene3dPicker = container.querySelector('#scene3d-picker-card');

  // === CARGAR TERRENO ===
  async function loadTerrain() {
    try {
      const demData = await loadDEM();
      refLat = (demData.bbox.north + demData.bbox.south) / 2;
      currentBBox = demData.bbox;

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
      terrainMesh.receiveShadow = true;
      terrainMesh.castShadow = true;
      worldGroup.add(terrainMesh);

      terrainMinElevation = minElevation;
      terrainMaxElevation = maxElevation;
      demElevations = demData.elevations;
      demWidth = demData.width;
      demHeight = demData.height;
      const range = maxElevation - minElevation;
      infoEl.innerHTML = `
        <div class="font-semibold text-teal-400 mb-1">Terreno DEM cargado</div>
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
      return null;
    }
  }

  // === CARGAR HEATMAP ===
  async function loadHeatmap(model) {
    if (!terrainMesh || !currentBBox || !index) return;
    const paths = getPaths(index, model.species.id, model.algorithm.id, model.scenario);
    if (!paths.png) return;

    if (heatmapMesh) {
      worldGroup.remove(heatmapMesh);
      heatmapMesh.geometry.dispose();
      heatmapMesh.material.map?.dispose();
      heatmapMesh.material.dispose();
      heatmapMesh = null;
    }

    const texture = await new Promise((resolve) => {
      new THREE.TextureLoader().load(
        paths.png,
        (tex) => { tex.colorSpace = THREE.SRGBColorSpace; resolve(tex); },
        undefined,
        () => resolve(null)
      );
    });
    if (!texture) return;

    const geo = terrainMesh.geometry.clone();
    // Voltear UV verticalmente porque PNG origen=arriba, Three.js UV origen=abajo
    const uvs = geo.attributes.uv.array;
    for (let i = 1; i < uvs.length; i += 2) {
      uvs[i] = 1 - uvs[i];
    }
    geo.attributes.uv.needsUpdate = true;

    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      opacity: 0.75,
      roughness: 1.0,
      metalness: 0.0,
      depthWrite: false,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -4.0,
      polygonOffsetUnits: -4.0,
    });

    heatmapMesh = new THREE.Mesh(geo, mat);
    heatmapMesh.rotation.x = -Math.PI / 2;
    heatmapMesh.position.y = 0.5;
    worldGroup.add(heatmapMesh);
  }

  // === CARGAR NUBE DE PUNTOS ===
  async function loadPointCloudScene() {
    const cloudInfo = infoEl.querySelector('#cloud-info');
    if (cloudInfo) cloudInfo.innerHTML = '<span class="text-gray-400">Cargando nube...</span>';

    try {
      const data = await loadPointCloud(currentCloudUrl);
      if (!data) {
        if (cloudInfo) cloudInfo.innerHTML = '<span class="text-gray-500">Sin nube</span>';
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
        const stride = totalPoints > 5000000 ? 100 : (totalPoints > 500000 ? 20 : 1);
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
        cloudInfo.innerHTML = `<div class="mt-1 text-teal-300">Nube: ${rawCount.toLocaleString()} pts mostrados</div>`;
      }
    } catch (err) {
      console.error('[Scene3D] Error cargando nube:', err);
      if (cloudInfo) cloudInfo.innerHTML = `<div class="mt-1 text-red-400">Nube: error</div>`;
    }
  }

  // === INICIALIZACIÓN ===
  const terrainInfo = await loadTerrain();
  if (terrainInfo) {
    if (initialModel) await loadHeatmap(initialModel);
    if (cloudOptions.some(o => o.url)) await loadPointCloudScene();
  }

  // === APLICAR TEXTURA AL TERRENO ===
  async function applyTerrainTexture(type, scenario) {
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
      terrainMesh.material.color.setHex(0x888888);
      terrainMesh.material.needsUpdate = true;
      return;
    }

    if (type === 'hillshade') {
      const canvas = createHillshadeTexture(demElevations, demWidth, demHeight, 2.5);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      terrainMesh.material.map = tex;
      terrainMesh.material.color.setHex(0xffffff);
      terrainMesh.material.needsUpdate = true;
      return;
    }

    if (type === 'satellite') {
      const bbox = currentBBox;
      const w = Math.min(2048, Math.round(demWidth * 2));
      const h = Math.min(2048, Math.round(demHeight * 2));
      const url = `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}&bboxSR=4326&imageSR=4326&size=${w},${h}&format=png&f=image`;
      const tex = await new Promise((resolve) => {
        new THREE.TextureLoader().load(url, (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          resolve(t);
        }, undefined, () => resolve(null));
      });
      if (tex) {
        terrainMesh.material.map = tex;
        terrainMesh.material.color.setHex(0xffffff);
        terrainMesh.material.needsUpdate = true;
      } else {
        console.warn('[Scene3D] No se pudo cargar satellite');
      }
      return;
    }

    // heatmap: usar overlay flotante (loadHeatmap) en lugar de textura base
    if (scenario) {
      terrainMesh.material.map = null;
      terrainMesh.material.color.setHex(0x888888);
      terrainMesh.material.needsUpdate = true;
      await loadHeatmap(scenario);
    }
  }

  async function updateLegend() {
    const canvas = createGEULegendCanvas();
    const legendCanvas = container.querySelector('#scene3d-legend-canvas');
    if (canvas && legendCanvas && scene3dLegend) {
      const ctx = legendCanvas.getContext('2d');
      ctx.clearRect(0, 0, legendCanvas.width, legendCanvas.height);
      ctx.drawImage(canvas, 0, 0, legendCanvas.width, legendCanvas.height);
      scene3dLegend.classList.remove('hidden');
    } else if (scene3dLegend) {
      scene3dLegend.classList.add('hidden');
    }
  }

  function getElevationAtUV(uv) {
    if (!demElevations || !demWidth || !demHeight) return null;
    if (!uv || uv.x < 0 || uv.x > 1 || uv.y < 0 || uv.y > 1) return null;
    const col = Math.floor(uv.x * (demWidth - 1));
    const row = Math.floor(uv.y * (demHeight - 1));
    const idx = row * demWidth + col;
    const v = demElevations[idx];
    if (isNaN(v) || v <= -9999) return null;
    return v;
  }

  function getElevationFromPoint(point) {
    // Fallback: deshacer la exageración aplicada en createTerrainGeometry
    if (!terrainMesh || terrainMinElevation === undefined) return null;
    // La geometría local tiene z = (elev - minEl) * exaggeration
    // El mesh está rotado -90° en X, por lo que la coordenada Y del mundo
    // corresponde a la Z local (elevación escalada).
    const localZ = point.y;
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
      return;
    }

    const hit = intersects[0];
    const uv = hit.uv;
    if (!uv || uv.x < 0 || uv.x > 1 || uv.y < 0 || uv.y > 1) {
      console.warn('[Scene3D] UV fuera de rango:', uv);
      if (scene3dPicker) scene3dPicker.classList.add('hidden');
      return;
    }

    // NOTA: Se invierte uv.y en latitud porque el DEM se carga con row=0=norte
    // pero PlaneGeometry uv.y=0 corresponde a la fila inferior (sur).
    const lon = currentBBox.west + uv.x * (currentBBox.east - currentBBox.west);
    const lat = currentBBox.north - uv.y * (currentBBox.north - currentBBox.south);
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
      const { px, py } = pixelCoordsFromLonLat(lon, lat, bboxForPng, currentImgData.width, currentImgData.height);
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
    if (scene3dPicker) {
      if (scene3dLegend && !scene3dLegend.classList.contains('hidden')) {
        scene3dPicker.style.left = '110px';
        scene3dPicker.style.transform = 'none';
      } else {
        scene3dPicker.style.left = '24px';
        scene3dPicker.style.transform = 'none';
      }
      scene3dPicker.classList.remove('hidden');
    }
  }

  renderer.domElement.addEventListener('click', handleSceneClick);

  async function updateHeatmapBBoxFromScenario(model) {
    if (!index) return;
    const paths = getPaths(index, model.species.id, model.algorithm.id, model.scenario);
    if (!paths.geojson) return;
    try {
      const geojson = await fetch(paths.geojson).then(r => r.ok ? r.json() : null);
      if (geojson && geojson.features?.length > 0) {
        const coords = geojson.features
          .filter(f => f.geometry?.type === 'Point')
          .map(f => f.geometry.coordinates);
        if (coords.length > 0) {
          const lons = coords.map(c => c[0]);
          const lats = coords.map(c => c[1]);
          currentHeatmapBBox = {
            west: Math.min(...lons),
            south: Math.min(...lats),
            east: Math.max(...lons),
            north: Math.max(...lats),
          };
        }
      }
    } catch (err) {
      console.warn('[Scene3D] No se pudo calcular BBox del heatmap:', err);
      currentHeatmapBBox = null;
    }
  }

  window.addEventListener('model-changed', async (e) => {
    const model = e.detail;
    if (!model) return;
    currentModel = model;

    // Recargar nubes solo si cambió especie o algoritmo
    const speciesChanged = model.species?.id !== currentSpeciesId;
    const algoChanged = model.algorithm?.id !== currentAlgoId;
    if ((speciesChanged || algoChanged) && model.species && model.algorithm) {
      currentSpeciesId = model.species.id;
      currentAlgoId = model.algorithm.id;
      const newOptions = await loadCloudOptions(currentSpeciesId, currentAlgoId);
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
      }
    }

    currentScenarioPng = model.paths?.png || null;
    await updateHeatmapBBoxFromScenario(model);
    if (currentScenarioPng) {
      currentImgData = await loadImageToCanvas(currentScenarioPng);
      if (currentImgData) currentImgData.url = currentScenarioPng;
      await updateLegend();
    }
    if (currentTextureType === 'heatmap') {
      await loadHeatmap(model);
    } else {
      if (heatmapMesh) {
        worldGroup.remove(heatmapMesh);
        heatmapMesh.geometry.dispose();
        heatmapMesh.material.map?.dispose();
        heatmapMesh.material.dispose();
        heatmapMesh = null;
      }
      await applyTerrainTexture(currentTextureType, model);
    }
  });

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
    });
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
    renderer.setSize(cw, ch);
  });
}
