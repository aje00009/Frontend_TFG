export function initHero(speciesName) {
  const container = document.getElementById('hero');
  if (!container) return;

  const displayName = speciesName.replace(/_/g, ' ');

  container.innerHTML = `
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-geu-panel via-geu-bg to-black opacity-80"></div>
    <div class="absolute inset-0" style="background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0); background-size: 40px 40px;"></div>
    
    <div class="relative z-10 text-center px-4">
      <h1 class="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
        Distribución de <span class="italic text-geu-accent">${displayName}</span>
      </h1>
      <p class="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
        Visualización interactiva de predicciones de distribución bajo escenarios climáticos futuros (SSP1-2.6 a SSP5-8.5).
      </p>
      <a href="#map-section" class="geu-btn text-lg inline-block">
        Explorar resultados
      </a>
    </div>

    <div class="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
      <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
      </svg>
    </div>
  `;

  // Smooth scroll para el botón
  container.querySelector('a[href="#map-section"]').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('map-section').scrollIntoView({ behavior: 'smooth' });
  });
}
