/**
 * Mini mapa de situación interactivo para el visor 3D.
 * Dibuja un thumbnail satelital (ESRI) con el rectángulo de la zona de estudio resaltado.
 * Permite acercar/alejar con botones o rueda del ratón.
 */

const ESRI_EXPORT = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export';

function expandBBox(bbox, factor = 0.25) {
  const dx = (bbox.east - bbox.west) * factor;
  const dy = (bbox.north - bbox.south) * factor;
  return {
    west: bbox.west - dx,
    south: bbox.south - dy,
    east: bbox.east + dx,
    north: bbox.north + dy,
  };
}

function bboxToUrl(bbox, width, height) {
  const params = new URLSearchParams({
    bbox: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
    bboxSR: '4326',
    imageSR: '4326',
    size: `${width},${height}`,
    format: 'png',
    f: 'image',
  });
  return `${ESRI_EXPORT}?${params.toString()}`;
}

function isValidBBox(bbox) {
  return bbox &&
    !isNaN(bbox.west) && !isNaN(bbox.south) && !isNaN(bbox.east) && !isNaN(bbox.north) &&
    bbox.east > bbox.west && bbox.north > bbox.south;
}

function sameBBox(a, b) {
  if (!a || !b) return false;
  return (
    Math.abs(a.west - b.west) < 1e-8 &&
    Math.abs(a.south - b.south) < 1e-8 &&
    Math.abs(a.east - b.east) < 1e-8 &&
    Math.abs(a.north - b.north) < 1e-8
  );
}

function formatBounds(bbox) {
  return `N${bbox.north.toFixed(2)}° W${bbox.west.toFixed(2)}° / S${bbox.south.toFixed(2)}° E${bbox.east.toFixed(2)}°`;
}

function drawFallback(ctx, width, height) {
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  const step = 20;
  for (let x = 0; x <= width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#888';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Mapa no disponible', width / 2, height / 2);
}

function drawStudyRect(ctx, bbox, viewBBox, width, height) {
  const x = ((bbox.west - viewBBox.west) / (viewBBox.east - viewBBox.west)) * width;
  const y = ((viewBBox.north - bbox.north) / (viewBBox.north - viewBBox.south)) * height;
  const w = ((bbox.east - bbox.west) / (viewBBox.east - viewBBox.west)) * width;
  const h = ((bbox.north - bbox.south) / (viewBBox.north - viewBBox.south)) * height;

  // Relleno semitransparente
  ctx.fillStyle = 'rgba(45, 212, 160, 0.25)';
  ctx.fillRect(x, y, w, h);

  // Borde brillante
  ctx.strokeStyle = '#2dd4a0';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function drawLabels(ctx, bbox, width, height) {
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 3;

  ctx.fillStyle = '#fff';
  ctx.font = '600 9px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ZONA DE ESTUDIO', width / 2, height / 2 + 3);

  ctx.font = '9px Inter, sans-serif';
  ctx.fillText(formatBounds(bbox), width / 2, height - 6);

  ctx.shadowBlur = 0;
}

function drawScale(ctx, viewBBox, width) {
  const distKm = approximateDistanceKm(viewBBox.west, viewBBox.south, viewBBox.east, viewBBox.south);
  if (!distKm || distKm <= 0) return;
  const rawKm = (distKm / width) * 80;
  const scaleKm = Math.max(0.5, Math.round(rawKm * 2) / 2);
  const scalePx = (scaleKm / distKm) * width;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(8, 8, Math.min(scalePx, width - 16), 6);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(8, 8, Math.min(scalePx, width - 16), 6);
  ctx.fillStyle = '#fff';
  ctx.font = '600 9px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${scaleKm} km`, 8, 24);
}

function approximateDistanceKm(lon1, lat1, lon2, lat2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function renderOverviewMap(container, bbox) {
  if (!container || !bbox) return;
  if (!isValidBBox(bbox)) {
    console.warn('[OverviewMap] BBox inválido:', bbox);
    return;
  }

  const width = 240;
  const height = 160;
  const minZoom = 0.5;
  const maxZoom = 6;
  const zoomStep = 1.4;

  const storedBBox = (() => {
    try {
      const raw = container.dataset.bbox;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  // Si cambió el bbox, reconstruir el wrapper para evitar datos obsoletos
  let wrapper = container.querySelector('.overview-wrapper');
  if (wrapper && storedBBox && !sameBBox(storedBBox, bbox)) {
    wrapper.remove();
    wrapper = null;
  }

  container.dataset.bbox = JSON.stringify(bbox);
  let zoom = parseFloat(container.dataset.zoom) || 3.0;
  zoom = Math.max(minZoom, Math.min(maxZoom, zoom));
  container.dataset.zoom = zoom.toFixed(2);

  let canvas, ctx;
  let currentImage = null;

  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'overview-wrapper relative w-full h-full';
    wrapper.innerHTML = `
      <canvas width="${width}" height="${height}" class="w-full h-full rounded-lg border border-terra-divider/20 shadow-lg"></canvas>
      <div class="absolute top-1.5 right-1.5 flex flex-col gap-1">
        <button type="button" class="overview-zoom-in w-6 h-6 rounded bg-terra-overlay/80 hover:bg-terra-overlay text-terra-text flex items-center justify-center text-xs font-bold border border-terra-divider/20 shadow" title="Acercar">+</button>
        <button type="button" class="overview-zoom-out w-6 h-6 rounded bg-terra-overlay/80 hover:bg-terra-overlay text-terra-text flex items-center justify-center text-xs font-bold border border-terra-divider/20 shadow" title="Alejar">−</button>
      </div>
    `;
    container.innerHTML = '';
    container.appendChild(wrapper);

    canvas = wrapper.querySelector('canvas');
    ctx = canvas.getContext('2d');

    wrapper.querySelector('.overview-zoom-in').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      zoom = Math.max(minZoom, zoom / zoomStep);
      container.dataset.zoom = zoom.toFixed(2);
      draw();
    });
    wrapper.querySelector('.overview-zoom-out').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      zoom = Math.min(maxZoom, zoom * zoomStep);
      container.dataset.zoom = zoom.toFixed(2);
      draw();
    });

    wrapper.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.deltaY < 0) {
        zoom = Math.max(minZoom, zoom / 1.25);
      } else {
        zoom = Math.min(maxZoom, zoom * 1.25);
      }
      container.dataset.zoom = zoom.toFixed(2);
      draw();
    }, { passive: false });
  } else {
    canvas = wrapper.querySelector('canvas');
    ctx = canvas.getContext('2d');
  }

  function getBBox() {
    try {
      return JSON.parse(container.dataset.bbox);
    } catch {
      return bbox;
    }
  }

  function draw() {
    const currentBbox = getBBox();
    ctx.clearRect(0, 0, width, height);

    if (currentImage) {
      currentImage.onload = null;
      currentImage.onerror = null;
      currentImage.src = '';
      currentImage = null;
    }

    const viewBBox = expandBBox(currentBbox, zoom);
    if (!isValidBBox(viewBBox)) {
      drawFallback(ctx, width, height);
      drawStudyRect(ctx, currentBbox, currentBbox, width, height);
      drawLabels(ctx, currentBbox, width, height);
      return;
    }

    const url = bboxToUrl(viewBBox, width, height);
    console.log('[OverviewMap] Dibujando zoom=', zoom.toFixed(2), 'bbox=', formatBounds(currentBbox), 'view=', formatBounds(viewBBox));

    const img = new Image();
    img.crossOrigin = 'anonymous';
    currentImage = img;
    img.onload = () => {
      if (currentImage !== img) return;
      ctx.drawImage(img, 0, 0, width, height);
      drawStudyRect(ctx, currentBbox, viewBBox, width, height);
      drawScale(ctx, viewBBox, width);
      drawLabels(ctx, currentBbox, width, height);
    };
    img.onerror = () => {
      if (currentImage !== img) return;
      console.warn('[OverviewMap] Error cargando imagen ESRI:', url);
      drawFallback(ctx, width, height);
      drawStudyRect(ctx, currentBbox, viewBBox, width, height);
      drawLabels(ctx, currentBbox, width, height);
    };
    img.src = url;
  }

  draw();
}
