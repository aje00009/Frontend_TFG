/**
 * Procesa el PNG del heatmap de GEU para que se vea profesional sobre el mapa base:
 * 1. Blur ligero para suavizar la pixelación de la grilla.
 * 2. Alpha variable: azules muy transparentes, rojos/amarillos más opacos.
 * 3. Fade-out en los bordes del rectángulo para evitar el corte nítido.
 */
export async function processHeatmapAdvanced(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const W = img.width;
      const H = img.height;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      // 1. Dibujar con blur para suavizar la pixelación
      ctx.filter = 'blur(1.2px)';
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';

      const imageData = ctx.getImageData(0, 0, W, H);
      const d = imageData.data;

      // 2. Alpha variable según "calidez" del color
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];

        // "Warmth": +1 = rojo puro, -1 = azul puro, 0 = gris/verde
        const warmth = (r - b) / 255;

        // Brightness para detectar negros
        const brightness = (r + g + b) / 3;

        let alpha;
        if (brightness < 30) {
          // Negros casi transparentes
          alpha = 0;
        } else if (warmth < -0.3) {
          // Azules fríos → muy transparentes (se ve el satélite)
          alpha = 30 + (warmth + 1) * 60; // 0.0-0.35 aprox
        } else if (warmth < 0.1) {
          // Cianes/verdes → semi-transparentes
          alpha = 80 + (warmth + 0.3) * 150;
        } else {
          // Amarillos/naranjas/rojos → más opacos
          alpha = 180 + warmth * 60;
        }

        // Limitar rango
        alpha = Math.max(0, Math.min(220, alpha));
        d[i + 3] = alpha;
      }

      ctx.putImageData(imageData, 0, 0);

      // 3. Fade-out en los bordes (margen de 18px)
      const margin = 18;
      const fadeCanvas = document.createElement('canvas');
      fadeCanvas.width = W;
      fadeCanvas.height = H;
      const fctx = fadeCanvas.getContext('2d');

      // Dibujar gradientes de máscara
      const gradTop = fctx.createLinearGradient(0, 0, 0, margin);
      gradTop.addColorStop(0, 'rgba(0,0,0,0)');
      gradTop.addColorStop(1, 'rgba(0,0,0,1)');
      fctx.fillStyle = gradTop;
      fctx.fillRect(0, 0, W, margin);

      const gradBot = fctx.createLinearGradient(0, H - margin, 0, H);
      gradBot.addColorStop(0, 'rgba(0,0,0,1)');
      gradBot.addColorStop(1, 'rgba(0,0,0,0)');
      fctx.fillStyle = gradBot;
      fctx.fillRect(0, H - margin, W, margin);

      const gradLeft = fctx.createLinearGradient(0, 0, margin, 0);
      gradLeft.addColorStop(0, 'rgba(0,0,0,0)');
      gradLeft.addColorStop(1, 'rgba(0,0,0,1)');
      fctx.fillStyle = gradLeft;
      fctx.fillRect(0, 0, margin, H);

      const gradRight = fctx.createLinearGradient(W - margin, 0, W, 0);
      gradRight.addColorStop(0, 'rgba(0,0,0,1)');
      gradRight.addColorStop(1, 'rgba(0,0,0,0)');
      fctx.fillStyle = gradRight;
      fctx.fillRect(W - margin, 0, margin, H);

      // Aplicar la máscara al canvas principal usando composite operation
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(fadeCanvas, 0, 0);
      ctx.globalCompositeOperation = 'source-over';

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (err) => reject(err);
    img.src = imageUrl;
  });
}
