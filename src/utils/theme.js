export function isDarkTheme() {
  if (typeof document === 'undefined') return true;
  return document.documentElement.classList.contains('dark');
}

export function getPlotlyThemeColors() {
  const dark = isDarkTheme();
  return {
    plotBg: dark ? '#2b2b2b' : '#f3f4f6',
    paperBg: 'rgba(0,0,0,0)',
    text: dark ? '#e5e7eb' : '#1f2937',
    grid: dark ? '#404040' : '#d1d5db',
    zeroline: dark ? '#404040' : '#9ca3af',
    legendBg: dark ? 'rgba(43,43,43,0.8)' : 'rgba(255,255,255,0.8)',
  };
}

export function getCesiumBackgroundColor() {
  const dark = isDarkTheme();
  return dark ? '#232323' : '#e5e7eb';
}
