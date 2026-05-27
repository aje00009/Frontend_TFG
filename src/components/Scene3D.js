import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadDEM, createTerrainGeometry, lonLatToMeters } from '../utils/terrainLoader.js';
import { loadPointCloud, pointsToGeometry } from '../utils/pointCloudLoader.js';
import { getPaths } from '../utils/config.js';

const CLOUD_OPTIONS = [
  { label: 'nube.ply (3.9 MB)', url: '/data/pointcloud/nube.ply' },
  { label: 'nube126.ply (392 MB)', url: '/data/pointcloud/nube126.ply' },
  { label: 'nubeInterpolada.ply (392 MB)', url: '/data/pointcloud/nubeInterpolada.ply' },
];

export async function initScene3D(containerId, initialScenario) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div id="three-canvas" class="w-full h-full relative">
      <div id="terrain-info" class="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur text-white text-xs px-3 py-2 rounded-lg border border-white/10 pointer-events-none">
        Cargando...
      </div>
      <div class="absolute top-3 right-3 z-10 bg-black/60 backdrop-blur px-3 py-2 rounded-lg border border-white/10 flex items-center gap-2">
        <label class="text-xs text-gray-400">Nube:</label>
        <select id="cloud-select" class="geu-select text-xs py-1 min-w-[180px]">
          ${CLOUD_OPTIONS.map(o => `<option value="${o.url}">${o.label}</option>`).join('')}
        </select>
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
  let currentCloudUrl = CLOUD_OPTIONS[0].url;

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
  async function loadHeatmap(scenario) {
    if (!terrainMesh || !currentBBox) return;
    const paths = getPaths(scenario);
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
    if (initialScenario) await loadHeatmap(initialScenario);
    await loadPointCloudScene();
  }

  window.addEventListener('scenario-changed', async (e) => {
    if (e.detail) await loadHeatmap(e.detail);
  });

  if (cloudSelect) {
    cloudSelect.addEventListener('change', async (e) => {
      currentCloudUrl = e.target.value;
      if (pointCloudMesh) {
        worldGroup.remove(pointCloudMesh);
        pointCloudMesh.geometry.dispose();
        pointCloudMesh.material.dispose();
        pointCloudMesh = null;
      }
      await loadPointCloudScene();
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
