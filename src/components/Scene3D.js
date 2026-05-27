import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadGeoJson } from '../utils/dataLoader.js';
import { getPaths } from '../utils/config.js';

export async function initScene3D(containerId, initialScenario) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `<div id="three-canvas" class="w-full h-full"></div>`;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#232323');

  const w = container.clientWidth;
  const h = container.clientHeight;
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.querySelector('#three-canvas').appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(40, 80, 40);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  scene.add(dirLight);

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let planeMesh = null;
  let trunkMesh = null;
  let crownMesh = null;

  async function loadScene(scenario) {
    const paths = getPaths(scenario);

    const [geojson, texture] = await Promise.all([
      loadGeoJson(paths.geojson),
      new Promise((resolve) => {
        const loader = new THREE.TextureLoader();
        loader.load(paths.png, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          resolve(tex);
        }, undefined, () => resolve(null));
      }),
    ]);

    if (!geojson) return;

    const coords = geojson.features
      .filter(f => f.geometry?.type === 'Point')
      .map(f => f.geometry.coordinates);
    if (coords.length === 0) return;

    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    const lonMin = Math.min(...lons), lonMax = Math.max(...lons);
    const latMin = Math.min(...lats), latMax = Math.max(...lats);

    // Limpiar
    while (worldGroup.children.length > 0) {
      const child = worldGroup.children[0];
      worldGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    }

    const baseSize = 100;
    const aspect = (lonMax - lonMin) / (latMax - latMin);
    const planeW = baseSize;
    const planeH = baseSize / aspect;

    // Plane PLANO con heatmap como textura (sin displacement absurdo)
    const planeGeom = new THREE.PlaneGeometry(planeW, planeH);
    const planeMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: 0.95,
    });
    planeMesh = new THREE.Mesh(planeGeom, planeMat);
    planeMesh.rotation.x = -Math.PI / 2;
    planeMesh.receiveShadow = true;
    worldGroup.add(planeMesh);

    // Árboles (prob > 0.7)
    const treeFeatures = geojson.features.filter(f => {
      const p = f.properties?.probability ?? f.properties?.prob ?? 0;
      return p > 0.7;
    });

    if (treeFeatures.length > 0) {
      const trunkGeom = new THREE.CylinderGeometry(0.12, 0.22, 1.2, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 1.0 });
      trunkMesh = new THREE.InstancedMesh(trunkGeom, trunkMat, treeFeatures.length);
      trunkMesh.castShadow = true;

      const crownGeom = new THREE.ConeGeometry(1.0, 2.2, 8);
      const crownMat = new THREE.MeshStandardMaterial({ color: 0x2E7D32, roughness: 0.8 });
      crownMesh = new THREE.InstancedMesh(crownGeom, crownMat, treeFeatures.length);
      crownMesh.castShadow = true;

      const dummy = new THREE.Object3D();

      for (let i = 0; i < treeFeatures.length; i++) {
        const f = treeFeatures[i];
        const [lon, lat] = f.geometry.coordinates;
        const prob = f.properties?.probability ?? f.properties?.prob ?? 0;
        const scale = 0.5 + (prob - 0.7) * 1.5;

        const x = ((lon - lonMin) / (lonMax - lonMin) - 0.5) * planeW;
        const z = ((lat - latMin) / (latMax - latMin) - 0.5) * planeH;

        // Tronco
        dummy.position.set(x, 0.6 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);

        // Copa
        dummy.position.set(x, 1.8 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
        dummy.updateMatrix();
        crownMesh.setMatrixAt(i, dummy.matrix);
      }

      trunkMesh.instanceMatrix.needsUpdate = true;
      crownMesh.instanceMatrix.needsUpdate = true;
      worldGroup.add(trunkMesh);
      worldGroup.add(crownMesh);
    }

    const maxDim = Math.max(planeW, planeH);
    controls.target.set(0, 0, 0);
    camera.position.set(maxDim * 0.6, maxDim * 0.9, maxDim * 0.6);
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.update();
  }

  if (initialScenario) {
    await loadScene(initialScenario);
  }

  window.addEventListener('scenario-changed', (e) => loadScene(e.detail));

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
