const STORAGE_KEY = 'terrapredict-theme';

function getInitialTheme() {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (stored === 'dark' || stored === 'light') return stored;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

function getIconSvg(theme) {
  if (theme === 'dark') {
    return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`;
}

function renderButton(container, theme, onClick) {
  container.innerHTML = `
    <button type="button" class="theme-toggle-btn terra-btn-ghost p-2 rounded-lg" aria-label="Cambiar tema" title="Cambiar tema">
      <span class="theme-toggle-icon block w-5 h-5">${getIconSvg(theme)}</span>
    </button>
  `;
  const btn = container.querySelector('.theme-toggle-btn');
  if (btn) btn.addEventListener('click', onClick);
}

export function initThemeToggle(containerId = 'theme-toggle') {
  const ids = Array.isArray(containerId) ? containerId : [containerId];
  const containers = ids.map(id => document.getElementById(id)).filter(Boolean);
  if (containers.length === 0) return;

  let theme = getInitialTheme();
  applyTheme(theme);

  function updateAllIcons() {
    containers.forEach((c) => {
      const icon = c.querySelector('.theme-toggle-icon');
      if (icon) icon.innerHTML = getIconSvg(theme);
    });
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    updateAllIcons();
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme } }));
  }

  containers.forEach((c) => renderButton(c, theme, toggleTheme));
}
