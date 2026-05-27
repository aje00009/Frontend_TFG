# GEU Web - Predicción de Especies (SDM)

Web estática interactiva para visualizar los resultados del módulo de Predicción de Distribución de Especies (SDM) del motor GEU.

## Requisitos

- **Node.js** (versión LTS recomendada): https://nodejs.org/
- Conexión a Internet (para cargar los assets de CesiumJS y los mapas base).

## Instalación rápida

1. Abre una terminal en esta carpeta.
2. Ejecuta:
   ```bash
   npm install
   ```
3. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
4. Abre el enlace que aparece (normalmente `http://localhost:5173/`).

## Cómo añadir tus datos exportados de GEU

Copia los archivos que exporta GEU siguiendo **exactamente** esta estructura dentro de la carpeta `public/data/`:

```
public/data/species/
└── Pinus_sylvestris/          <-- nombre de la especie (igual que en main.js)
    ├── current/
    │   ├── Pinus_sylvestris_RF_Actual.tif          (convertido a COG, ver nota abajo)
    │   ├── Pinus_sylvestris_RF_Actual.geojson
    │   ├── Pinus_sylvestris_RF_Actual_heatmap.png
    │   ├── Pinus_sylvestris_RF_Metrics.json
    │   └── Pinus_sylvestris_RF_Config.json
    ├── future/
    │   ├── ssp245_2041_2060/
    │   │   ├── Pinus_sylvestris_RF_ssp245_2041_2060.tif
    │   │   ├── Pinus_sylvestris_RF_ssp245_2041_2060.geojson
    │   │   └── Pinus_sylvestris_RF_ssp245_2041_2060_heatmap.png
    │   └── ssp585_2081_2100/
    │       └── ... (mismo patrón para cada escenario)
    ├── curves/
    │   ├── Pinus_sylvestris_RF_ResponseCurves.csv
    │   ├── Pinus_sylvestris_RF_ResponseCurve_BIO1.png
    │   └── ... (otros PNGs de curvas)
    └── diff/
        └── Pinus_sylvestris_RF_Diferencias.png
```

**Nota importante:** Si tu especie o algoritmo tienen otro nombre, modifica las constantes al principio de `src/main.js`:

```javascript
const SPECIES_NAME = 'Pinus_sylvestris';  // <-- cámbialo
const ALGORITHM = 'RF';                   // <-- cámbialo (RF, MaxEnt, etc.)
```

### Convertir GeoTIFFs a COG (Cloud Optimized GeoTIFF)

Antes de copiar los `.tif`, conviértelos a COG para que CesiumJS los pueda leer más rápido:

```bash
gdal_translate -of COG -co COMPRESS=DEFLATE input.tif output.cog.tif
```

Si no tienes GDAL instalado, también puedes dejar el PNG del `heatmap.png` como capa de respaldo (la web intentará cargar el COG primero y, si falla, usará el heatmap).

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo con recarga automática |
| `npm run build` | Genera la versión optimizada en `dist/` |
| `npm run preview` | Previsualiza la versión de producción localmente |

## Despliegue (subir a Internet)

### Opción A: Vercel (recomendada)
1. Instala Vercel CLI: `npm i -g vercel`
2. Ejecuta: `vercel`
3. Sigue las instrucciones.

### Opción B: GitHub Pages
1. Sube este repositorio a GitHub.
2. Ejecuta: `npm run build`
3. Copia el contenido de `dist/` a la rama `gh-pages` (o usa GitHub Actions).

## Consejos sobre Cesium Ion (terreno 3D real)

Para ver el terreno real (montañas, valles) en lugar de un elipsoide plano, necesitas un **token gratuito** de Cesium Ion:

1. Ve a https://ion.cesium.com y regístrate.
2. Crea un token de acceso.
3. Pégalo en `src/components/MapViewer.js` y `src/components/Scene3D.js`:
   ```javascript
   Cesium.Ion.defaultAccessToken = 'tu_token_aqui';
   ```

## Estructura del proyecto

```
├── public/               # Archivos estáticos (datos, imágenes...)
│   └── data/
│       └── species/
├── src/
│   ├── components/       # Componentes de la interfaz
│   ├── utils/            # Utilidades de carga de datos
│   ├── main.js           # Punto de entrada
│   └── style.css         # Estilos base + Tailwind
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

## Tecnologías usadas

- [Vite](https://vitejs.dev/) - Bundler y dev server
- [Tailwind CSS](https://tailwindcss.com/) - Estilos
- [CesiumJS](https://cesium.com/platform/cesiumjs/) - Globo 3D y mapas
- [Plotly.js](https://plotly.com/javascript/) - Gráficas interactivas
- [PapaParse](https://www.papaparse.com/) - Parseo de CSV
