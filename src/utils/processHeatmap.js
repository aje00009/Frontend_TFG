/**
 * Procesa el PNG del heatmap de GEU para aplicar fade-out suave en los bordes,
 * evitando el corte nítido del rectángulo sobre el terreno.
 */
export async function processHeatmapAdvanced(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const W = img.width;
      const H = img.height;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      // 1. Dibujar imagen original
      ctx.drawImage(img, 0, 0);

      // 2. Fade-out en los bordes (margen de 18px)
      const margin = 18;
      const fadeCanvas = document.createElement('canvas');
      fadeCanvas.width = W;
      fadeCanvas.height = H;
      const fctx = fadeCanvas.getContext('2d');

      // Fondo opaco para que el centro se mantenga
      fctx.fillStyle = 'rgba(0,0,0,1)';
      fctx.fillRect(0, 0, W, H);

      // Gradientes de máscara (transparente en el borde exterior → opaco hacia dentro)
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

      // Aplicar la máscara al canvas principal
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(fadeCanvas, 0, 0);
      ctx.globalCompositeOperation = 'source-over';

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (err) => reject(err);
    img.src = imageUrl;
  });
}
