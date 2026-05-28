/**
 * Genera una textura de hillshade a partir de elevaciones DEM.
 * Algoritmo: azimuth=315°, zenith=45° (iluminación estándar NW)
 */
export function createHillshadeTexture(elevations, width, height, exaggeration = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const d = imgData.data;

  const azimuth = 315 * (Math.PI / 180);
  const zenith = 45 * (Math.PI / 180);
  const cosZ = Math.cos(zenith);
  const sinZ = Math.sin(zenith);
  const cosA = Math.cos(azimuth);
  const sinA = Math.sin(azimuth);

  // Tamaño de celda en grados (aproximado del DEM original)
  const cellX = 1;
  const cellY = 1;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = row * width + col;

      // Vecinos (con clamp a bordes)
      const left = elevations[row * width + Math.max(0, col - 1)];
      const right = elevations[row * width + Math.min(width - 1, col + 1)];
      const up = elevations[Math.max(0, row - 1) * width + col];
      const down = elevations[Math.min(height - 1, row + 1) * width + col];

      const dzdx = ((right - left) * exaggeration) / (2 * cellX);
      const dzdy = ((up - down) * exaggeration) / (2 * cellY);

      const slope = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy));
      let aspect = Math.atan2(dzdy, -dzdx);
      if (aspect < 0) aspect += 2 * Math.PI;

      const hillshade = cosZ * Math.cos(slope) + sinZ * Math.sin(slope) * Math.cos(azimuth - aspect);
      const val = Math.max(0, Math.min(255, Math.round(hillshade * 255)));

      const pIdx = idx * 4;
      d[pIdx] = val;
      d[pIdx + 1] = val;
      d[pIdx + 2] = val;
      d[pIdx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
