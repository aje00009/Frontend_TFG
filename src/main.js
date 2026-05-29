import './style.css';
import { initHero } from './components/Hero.js';
import { initMapViewer } from './components/MapViewer.js';
import { initScenarioSelector } from './components/ScenarioSelector.js';
import { initDashboard } from './components/Dashboard.js';
import { initResponseCurves } from './components/ResponseCurves.js';
import { initDiffMap } from './components/DiffMap.js';
import { initScene3D } from './components/Scene3D.js';
import { initProbabilityHistogram } from './components/ProbabilityHistogram.js';
import { initSideBySideComparator } from './components/SideBySideComparator.js';
import { initDownloads } from './components/Downloads.js';

(async function bootstrap() {
  // ==========================================
  // 1. INICIALIZAR COMPONENTES
  // ==========================================
  initHero();

  let currentModel = null;
  await initScenarioSelector((model) => {
    currentModel = model;
    window.dispatchEvent(new CustomEvent('model-changed', { detail: model }));
  });

  const mapViewer = await initMapViewer('map-container');
  initDashboard('dashboard');
  initResponseCurves('curves');
  initDiffMap('diff');
  initProbabilityHistogram('histogram');
  await initSideBySideComparator('comparator', currentModel);
  const scene3D = await initScene3D('scene3d', currentModel);
  initDownloads('downloads');

  if (currentModel) {
    window.dispatchEvent(new CustomEvent('model-changed', { detail: currentModel }));
  }

  // ==========================================
  // 2. TOGGLE 2D / 3D
  // ==========================================
  const btn2d = document.getElementById('mode-btn-2d');
  const btn3d = document.getElementById('mode-btn-3d');
  const viewer2d = document.getElementById('viewer-2d');
  const viewer3d = document.getElementById('viewer-3d');

  const activeClass2D = 'bg-terra-accent text-terra-bg shadow-sm';
  const inactiveClass2D = 'text-stone-300 hover:text-white hover:bg-white/5';

  if (btn2d && btn3d && viewer2d && viewer3d) {
    btn2d.addEventListener('click', () => {
      viewer2d.classList.remove('invisible');
      viewer2d.classList.add('z-10');
      viewer2d.classList.remove('z-0');
      viewer3d.classList.add('invisible');
      viewer3d.classList.remove('z-10');
      viewer3d.classList.add('z-0');

      btn2d.className = `px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeClass2D}`;
      btn3d.className = `px-4 py-2 rounded-lg text-sm font-medium transition-all ${inactiveClass2D}`;
    });

    btn3d.addEventListener('click', () => {
      viewer3d.classList.remove('invisible');
      viewer3d.classList.add('z-10');
      viewer3d.classList.remove('z-0');
      viewer2d.classList.add('invisible');
      viewer2d.classList.remove('z-10');
      viewer2d.classList.add('z-0');

      btn3d.className = `px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeClass2D}`;
      btn2d.className = `px-4 py-2 rounded-lg text-sm font-medium transition-all ${inactiveClass2D}`;
    });
  }

  // ==========================================
  // 3. EXPORTAR PNG
  // ==========================================
  function formatFileName(ext) {
    const sp = currentModel?.species?.id || 'Especie';
    const algo = currentModel?.algorithm?.id || 'Algoritmo';
    const scen = currentModel?.scenario?.id || 'Escenario';
    return `TerraPredict_${sp}_${algo}_${scen}.${ext}`;
  }

  const btnExport = document.getElementById('btn-export-png');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const viewer3d = document.getElementById('viewer-3d');
      const is3D = viewer3d && !viewer3d.classList.contains('invisible');
      let dataURL = null;
      let filename = formatFileName('png');

      if (is3D && scene3D?.exportPNG) {
        dataURL = scene3D.exportPNG();
        filename = formatFileName('3D.png');
      } else if (mapViewer?.exportPNG) {
        dataURL = mapViewer.exportPNG();
        filename = formatFileName('2D.png');
      }

      if (dataURL) {
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = filename;
        a.click();
      } else {
        alert('No se pudo exportar la imagen.');
      }
    });
  }

  // ==========================================
  // 4. EXPORTAR GLB
  // ==========================================
  const btnExportGLB = document.getElementById('btn-export-glb');
  if (btnExportGLB && scene3D?.exportGLB) {
    btnExportGLB.addEventListener('click', async () => {
      try {
        await scene3D.exportGLB(formatFileName('glb'));
      } catch (err) {
        console.error('Error exportando GLB:', err);
        alert('No se pudo exportar el modelo 3D.');
      }
    });
  }

  // ==========================================
  // 5. NAVEGACIÓN: SCROLL SUAVE EN ANCLAS
  // ==========================================
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Cerrar menú móvil si está abierto
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
          mobileMenu.classList.add('hidden');
        }
      }
    });
  });

  // ==========================================
  // 6. MENÚ MÓVIL
  // ==========================================
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  // ==========================================
  // 7. NAVBAR: EFECTO AL HACER SCROLL
  // ==========================================
  const nav = document.getElementById('main-nav');
  if (nav) {
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const currentScroll = window.scrollY;
      if (currentScroll > 50) {
        nav.classList.add('shadow-lg', 'shadow-black/20');
        nav.classList.replace('bg-terra-bg/70', 'bg-terra-bg/90');
      } else {
        nav.classList.remove('shadow-lg', 'shadow-black/20');
        nav.classList.replace('bg-terra-bg/90', 'bg-terra-bg/70');
      }
      lastScroll = currentScroll;
    });
  }

  // ==========================================
  // 8. ANIMACIONES REVEAL (IntersectionObserver)
  // ==========================================
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

  // También observar tarjetas que se inyectan dinámicamente
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.reveal:not(.active)').forEach((el, i) => {
          setTimeout(() => el.classList.add('active'), i * 80);
        });
        sectionObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05 });

  document.querySelectorAll('section').forEach((sec) => sectionObserver.observe(sec));
})();
