/**
 * Utilidades compartidas para picking y leyendas en MapViewer y Scene3D.
 */

const imageCache = new Map();

/**
 * Carga una imagen en un canvas offscreen y cachea el resultado.
 * Si flipY es true, dibuja la imagen volteada verticalmente.
 * Los PNGs de probabilidad son north-up (origen arriba-izquierda = NW);
 * por tanto Cesium y Three.js los muestran correctamente sin voltear.
 */
export async function loadImageToCanvas(url, { flipY = false } = {}) {
  if (!url) return null;
  const cacheKey = `${url}|flipY:${flipY}`;
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (flipY) {
        ctx.translate(0, img.height);
        ctx.scale(1, -1);
      }
      ctx.drawImage(img, 0, 0);
      const result = { canvas, ctx, width: img.width, height: img.height };
      imageCache.set(cacheKey, result);
      resolve(result);
    };
    img.onerror = () => {
      imageCache.set(cacheKey, null);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Carga una imagen, la voltea verticalmente y devuelve el canvas resultante.
 * Se usa directamente con Cesium para evitar el coste de generar data URLs
 * base64 de imágenes enormes.
 */
export async function getFlippedImageCanvas(url) {
  const data = await loadImageToCanvas(url, { flipY: true });
  return data?.canvas || null;
}

/**
 * @deprecated Usa getFlippedImageCanvas para evitar data URLs pesadas.
 */
export async function getFlippedImageUrl(url) {
  const canvas = await getFlippedImageCanvas(url);
  if (!canvas) return url;
  return canvas.toDataURL('image/png');
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
 * Calcula el bbox completo de un raster a partir de los puntos de su GeoJSON.
 * Los puntos suelen ser los centros de las celdas, así que expande medio paso
 * por cada lado para coincidir con el extent real del PNG/GeoTIFF.
 */
export function getRasterBBoxFromGeoJSON(geojson) {
  if (!geojson?.features?.length) return null;
  const coords = geojson.features
    .filter((f) => f.geometry?.type === 'Point')
    .map((f) => f.geometry.coordinates);
  if (coords.length === 0) return null;

  const lons = coords.map((c) => c[0]).sort((a, b) => a - b);
  const lats = coords.map((c) => c[1]).sort((a, b) => a - b);
  const lonStep = lons.length > 1 ? lons[1] - lons[0] : 0;
  const latStep = lats.length > 1 ? lats[1] - lats[0] : 0;

  return {
    west: lons[0] - lonStep / 2,
    south: lats[0] - latStep / 2,
    east: lons[lons.length - 1] + lonStep / 2,
    north: lats[lats.length - 1] + latStep / 2,
  };
}

/**
 * Carga el bbox preferente del archivo {scenario}_bbox.json extraído del GeoTIFF.
 * Si no existe, calcula el bbox a partir del GeoJSON como fallback.
 */
export async function loadRasterBBox(paths) {
  if (paths?.bbox) {
    try {
      const res = await fetch(paths.bbox);
      if (res.ok) {
        const meta = await res.json();
        if (meta && typeof meta.west === 'number') {
          return { west: meta.west, south: meta.south, east: meta.east, north: meta.north };
        }
      }
    } catch (err) {
      console.warn('[loadRasterBBox] No se pudo cargar bbox.json:', err);
    }
  }

  if (paths?.geojson) {
    try {
      const res = await fetch(paths.geojson);
      if (res.ok) return getRasterBBoxFromGeoJSON(await res.json());
    } catch (err) {
      console.warn('[loadRasterBBox] No se pudo cargar GeoJSON:', err);
    }
  }

  return null;
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
 * Los PNGs de probabilidad son north-up (origen arriba-izquierda = NW).
 * flipY=false usa esa convención directamente; flipY=true invierte la Y.
 */
export function pixelCoordsFromLonLat(lon, lat, bbox, imgW, imgH, flipY = false) {
  const u = (lon - bbox.west) / (bbox.east - bbox.west);
  const v = (lat - bbox.south) / (bbox.north - bbox.south);
  const px = Math.floor(Math.max(0, Math.min(1, u)) * (imgW - 1));
  const py = flipY
    ? Math.floor((1 - Math.max(0, Math.min(1, v))) * (imgH - 1))
    : Math.floor(Math.max(0, Math.min(1, v)) * (imgH - 1));
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
