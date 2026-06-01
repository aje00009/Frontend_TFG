export function initHero() {
  const container = document.getElementById('hero');
  if (!container) return;

  container.innerHTML = `
    <!-- Fondo decorativo -->
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-terra-surface-light via-terra-bg to-black opacity-80"></div>
    <div class="absolute inset-0" style="background-image: radial-gradient(circle at 1px 1px, rgba(45,212,160,0.06) 1px, transparent 0); background-size: 40px 40px;"></div>
    
    <div class="relative z-10 text-center px-4 max-w-4xl mx-auto">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-terra-accent/10 border border-terra-accent/20 text-terra-accent text-xs font-semibold tracking-wide uppercase mb-6 reveal">
        <span class="w-1.5 h-1.5 rounded-full bg-terra-accent animate-pulse"></span>
        Predicción de Distribución
      </div>
      
      <h1 class="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight reveal reveal-delay-1">
        <span class="text-gradient">TerraPredict</span>
      </h1>
      
      <p class="text-lg md:text-xl text-stone-400 mb-6 max-w-2xl mx-auto leading-relaxed reveal reveal-delay-2">
        Plataforma interactiva para la predicción de la distribución de especies forestales 
        bajo escenarios climáticos futuros. Visualiza, analiza y compara el impacto del cambio 
        climático en el hábitat de especies clave a escala regional.
      </p>

      <div class="flex flex-wrap justify-center gap-4 text-sm text-stone-500 reveal reveal-delay-3">
        <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-terra-accent"></span>Modelos SDM</span>
        <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-terra-accent-warm"></span>Escenarios SSP</span>
        <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-teal-400"></span>Visor 2D/3D</span>
        <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Análisis comparativo</span>
      </div>
      
      <a href="#visor" class="terra-btn text-base inline-flex items-center gap-2 mt-10 reveal reveal-delay-3">
        Explorar resultados
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
        </svg>
      </a>
    </div>

  `;

  const link = container.querySelector('a[href="#visor"]');
  if (link) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('visor').scrollIntoView({ behavior: 'smooth' });
    });
  }
}
