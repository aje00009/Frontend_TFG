/**
 * Utilidades compartidas para picking y leyendas en MapViewer y Scene3D.
 */

const imageCache = new Map();

/**
 * Carga una imagen en un canvas offscreen y cachea el resultado.
 */
export async function loadImageToCanvas(url) {
  if (!url) return null;
  if (imageCache.has(url)) {
    const cached = imageCache.get(url);
    return cached;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const result = { canvas, ctx, width: img.width, height: img.height };
      imageCache.set(url, result);
      resolve(result);
    };
    img.onerror = () => {
      imageCache.set(url, null);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Lee el color de un píxel del canvas.
 */
export function samplePixel(ctx, x, y, width, height) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || ix >= width || iy < 0 || iy >= height) return null;
  const d = ctx.getImageData(ix, iy, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] };
}

/**
 * Convierte UV del terreno (Three.js) a lon/lat.
 * Asume uv en [0,1] con (0,0)=SW y (1,1)=NE.
 */
export function lonLatFromTerrainUV(uv, bbox) {
  const lon = bbox.west + uv.x * (bbox.east - bbox.west);
  const lat = bbox.south + uv.y * (bbox.north - bbox.south);
  return { lon, lat };
}

/**
 * Convierte lon/lat a coordenadas de píxel en una imagen PNG.
 * Asume PNG con origen (0,0) arriba-izquierda = NW.
 */
export function pixelCoordsFromLonLat(lon, lat, bbox, imgW, imgH) {
  const u = (lon - bbox.west) / (bbox.east - bbox.west);
  const v = (lat - bbox.south) / (bbox.north - bbox.south);
  const px = Math.floor(Math.max(0, Math.min(1, u)) * (imgW - 1));
  const py = Math.floor((1 - Math.max(0, Math.min(1, v))) * (imgH - 1));
  return { px, py };
}

/**
 * Formatea coordenadas en decimal y DMS.
 */
export function formatCoords(lat, lon) {
  const latAbs = Math.abs(lat);
  const lonAbs = Math.abs(lon);
  const latDeg = Math.floor(latAbs);
  const latMin = Math.floor((latAbs - latDeg) * 60);
  const latSec = ((latAbs - latDeg) * 60 - latMin) * 60;
  const lonDeg = Math.floor(lonAbs);
  const lonMin = Math.floor((lonAbs - lonDeg) * 60);
  const lonSec = ((lonAbs - lonDeg) * 60 - lonMin) * 60;

  const latHem = lat >= 0 ? 'N' : 'S';
  const lonHem = lon >= 0 ? 'E' : 'W';

  return {
    decimal: `${lat.toFixed(5)}°${latHem}, ${lon.toFixed(5)}°${lonHem}`,
    dms: `${latDeg}°${latMin}'${latSec.toFixed(1)}"${latHem} ${lonDeg}°${lonMin}'${lonSec.toFixed(1)}"${lonHem}`,
  };
}

/**
 * Formatea elevación.
 */
export function formatElevation(m) {
  if (m === null || m === undefined || isNaN(m)) return '—';
  return `${m.toFixed(1)} m`;
}

/**
 * Convierte RGB a HEX.
 */
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Paleta de referencia del colormap GEU.
 */
const GEU_PALETTE = [
  { r: 0,   g: 0,   b: 139, label: 'Muy baja / ausencia', range: '0.00 – 0.05' },
  { r: 0,   g: 191, b: 255, label: 'Baja', range: '0.05 – 0.15' },
  { r: 127, g: 255, b: 0,   label: 'Media-baja', range: '0.15 – 0.30' },
  { r: 255, g: 215, b: 0,   label: 'Media-alta', range: '0.30 – 0.60' },
  { r: 220, g: 0,   b: 0,   label: 'Alta probabilidad', range: '0.60 – 1.00' },
];

/**
 * Clasifica un color RGB según el colormap GEU devolviendo la categoría más cercana.
 */
export function classifyGEUColor(r, g, b) {
  let minDist = Infinity;
  let best = GEU_PALETTE[0];
  for (const p of GEU_PALETTE) {
    const d = (r - p.r) ** 2 + (g - p.g) ** 2 + (b - p.b) ** 2;
    if (d < minDist) {
      minDist = d;
      best = p;
    }
  }
  return best;
}

/**
 * Genera un canvas de leyenda (20×200) con el gradiente fijo del colormap GEU.
 * Alta probabilidad (rojo) arriba, baja (azul) abajo.
 */
export function createGEULegendCanvas() {
  const h = 200;
  const w = 20;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Stops del gradiente GEU (t de 0 a 1, donde 1 = alto arriba)
  const stops = [
    { t: 0.00, r: 0,   g: 0,   b: 139 }, // azul oscuro
    { t: 0.05, r: 0,   g: 191, b: 255 }, // cian
    { t: 0.15, r: 127, g: 255, b: 0   }, // verde
    { t: 0.30, r: 255, g: 215, b: 0   }, // amarillo
    { t: 0.60, r: 255, g: 69,  b: 0   }, // naranja-rojizo
    { t: 1.00, r: 220, g: 0,   b: 0   }, // rojo intenso
  ];

  for (let y = 0; y < h; y++) {
    const t = 1 - y / (h - 1); // 1.0 arriba, 0.0 abajo
    let lower = stops[0];
    let upper = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].t && t <= stops[i + 1].t) {
        lower = stops[i];
        upper = stops[i + 1];
        break;
      }
    }
    const range = upper.t - lower.t;
    const frac = range === 0 ? 0 : (t - lower.t) / range;
    const rr = Math.round(lower.r + (upper.r - lower.r) * frac);
    const gg = Math.round(lower.g + (upper.g - lower.g) * frac);
    const bb = Math.round(lower.b + (upper.b - lower.b) * frac);
    ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
    ctx.fillRect(0, y, w, 1);
  }

  return canvas;
}
