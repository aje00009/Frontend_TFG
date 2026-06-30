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
import { initThemeToggle } from './components/ThemeToggle.js';

(async function bootstrap() {
  // ==========================================
  // 1. INICIALIZAR COMPONENTES
  // ==========================================
  initThemeToggle(['theme-toggle', 'theme-toggle-mobile']);
  initHero();

  let currentModel = null;

  try {
    await initScenarioSelector((model) => {
      currentModel = model;
      window.dispatchEvent(new CustomEvent('model-changed', { detail: model }));
    });
  } catch (err) {
    console.error('[Bootstrap] Error en ScenarioSelector:', err);
  }

  let mapViewer;
  try {
    mapViewer = await initMapViewer('map-container');
  } catch (err) {
    console.error('[Bootstrap] Error en MapViewer:', err);
  }

  try { initDashboard('dashboard'); } catch (err) { console.error('[Bootstrap] Error en Dashboard:', err); }
  try { initResponseCurves('curves'); } catch (err) { console.error('[Bootstrap] Error en ResponseCurves:', err); }
  try { initDiffMap('diff'); } catch (err) { console.error('[Bootstrap] Error en DiffMap:', err); }
  try { initProbabilityHistogram('histogram'); } catch (err) { console.error('[Bootstrap] Error en ProbabilityHistogram:', err); }

  try {
    await initSideBySideComparator('comparator', currentModel);
  } catch (err) {
    console.error('[Bootstrap] Error en SideBySideComparator:', err);
  }

  let scene3D;
  try {
    scene3D = await initScene3D('scene3d', currentModel);
  } catch (err) {
    console.error('[Bootstrap] Error en Scene3D:', err);
  }

  try { initDownloads('downloads'); } catch (err) { console.error('[Bootstrap] Error en Downloads:', err); }

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
  const inactiveClass2D = 'text-terra-muted hover:text-terra-text hover:bg-terra-text/5';

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
  // 7. PANEL EXPLICATIVO SSP
  // ==========================================
  const sspToggle = document.getElementById('ssp-info-toggle');
  const sspPanel = document.getElementById('ssp-info-panel');
  const sspChevron = document.getElementById('ssp-chevron');
  if (sspToggle && sspPanel) {
    sspToggle.addEventListener('click', () => {
      sspPanel.classList.toggle('hidden');
      if (sspChevron) sspChevron.classList.toggle('rotate-180');
    });
  }

  // ==========================================
  // 8. NAVBAR: EFECTO AL HACER SCROLL
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
