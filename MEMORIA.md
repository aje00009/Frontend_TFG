# Memoria Técnica — TerraPredict Web

> Plataforma interactiva de predicción de distribución de especies (SDM) bajo escenarios climáticos futuros.
> Proyecto: `C:\Users\alber\FRONT`  
> Última actualización de esta memoria: 2026-05-27

---

## Tabla de contenidos

1. [Visión general](#1-visión-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Estructura de archivos](#3-estructura-de-archivos)
4. [Configuración del proyecto](#4-configuración-del-proyecto)
5. [Tema visual y CSS](#5-tema-visual-y-css)
6. [HTML principal (index.html)](#6-html-principal-indexhtml)
7. [Punto de entrada (main.js)](#7-punto-de-entrada-mainjs)
8. [Arquitectura de eventos](#8-arquitectura-de-eventos)
9. [Componentes](#9-componentes)
10. [Utilidades](#10-utilidades)
11. [Datos y assets requeridos](#11-datos-y-assets-requeridos)
12. [Detalles de implementación críticos](#12-detalles-de-implementación-críticos)
13. [Build y despliegue](#13-build-y-despliegue)
14. [Notas sobre compatibilidad GEU legacy](#14-notas-sobre-compatibilidad-geu-legacy)

---

## 1. Visión general

TerraPredict es una **Single Page Application (SPA)** construida con **Vite** que permite visualizar resultados de modelos de Distribución de Especies (SDM, *Species Distribution Models*) generados por el motor GEU. La aplicación consume datos estáticos (GeoTIFF, PNG, GeoJSON, CSV, PLY, JSON) alojados en `public/data/` y los presenta a través de múltiples visualizaciones interactivas:

- **Visor 2D**: Mapa CesiumJS con capa base satelital y overlay de heatmap de probabilidad.
- **Visor 3D**: Terreno DEM con elevación real + heatmap texturizado + nubes de puntos 3D, renderizado con Three.js.
- **Dashboard de métricas**: Barras de progreso con valores de rendimiento del modelo.
- **Curvas de respuesta**: Gráficas Plotly.js de probabilidad vs variables bioclimáticas (BIO).
- **Histograma de probabilidad**: Distribución de valores de probabilidad con paleta GEU.
- **Mapa de diferencias**: Comparación futuro vs actual (pérdida/ganancia de hábitat).
- **Comparador lado a lado**: Dos visores Cesium sincronizados para comparar escenarios.
- **Descargas**: Enlaces directos a todos los archivos exportados.

La interfaz sigue un **diseño dark theme** con acentos en verde esmeralda (`#2dd4a0`) y ámbar (`#fbbf24`), tipografía Inter, y animaciones de entrada suaves.

---

## 2. Stack tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| **Vite** | 5.3.0 | Bundler y dev server (`npm run dev` → `localhost:5173`) |
| **Tailwind CSS** | 3.4.4 | Framework de utilidades CSS |
| **PostCSS** | 8.4.38 | Procesador CSS (con Autoprefixer) |
| **Vanilla JavaScript (ES Modules)** | — | Lógica de toda la aplicación, sin framework de UI |
| **CesiumJS** | 1.118.0 | Globo terráqueo 3D, mapas 2D, terrain provider |
| **Three.js** | 0.184.0 | Renderizado 3D del terreno DEM, heatmaps y point clouds |
| **Plotly.js** | 2.33.0 (dist-min) | Gráficas interactivas (curvas de respuesta, histograma) |
| **PapaParse** | 5.4.1 | Parseo de CSV de curvas de respuesta |
| **GeoTIFF** | 3.0.5 | Lectura de GeoTIFFs (reserva, no usado activamente) |
| **GLTFExporter** (Three.js) | built-in | Exportación de modelos 3D a formato GLB |

**Nota**: CesiumJS carga sus assets desde CDN (`unpkg.com`), configurado en `index.html` mediante `window.CESIUM_BASE_URL`.

---

## 3. Estructura de archivos

```
FRONT/
├── index.html                    # HTML principal, estructura de la SPA
├── package.json                  # Dependencias y scripts npm
├── vite.config.js                # Config Vite (base: './')
├── tailwind.config.js            # Config Tailwind + paleta TerraPredict
├── postcss.config.js             # PostCSS (tailwindcss + autoprefixer)
├── MEMORIA.md                    # Este documento
├── README.md                     # README para usuarios humanos
├── Prompt_Web_PrediccionEspecies.md
├── INSTRUCCIONES_3D.md
│
├── src/
│   ├── main.js                   # Punto de entrada: bootstrap de todos los componentes
│   ├── style.css                 # Estilos globales, @tailwind, componentes, utilidades
│   │
│   ├── components/
│   │   ├── Hero.js               # Sección hero de bienvenida
│   │   ├── ScenarioSelector.js   # Selector de especie/algoritmo/periodo/escenario
│   │   ├── MapViewer.js          # Visor 2D con Cesium
│   │   ├── Scene3D.js            # Visor 3D con Three.js
│   │   ├── Dashboard.js          # Métricas del modelo
│   │   ├── ResponseCurves.js     # Curvas de respuesta con Plotly
│   │   ├── ProbabilityHistogram.js  # Histograma de probabilidad con Plotly
│   │   ├── DiffMap.js            # Mapa de diferencias + tablas
│   │   ├── SideBySideComparator.js  # Dos mapas Cesium sincronizados
│   │   └── Downloads.js          # Enlaces de descarga de archivos
│   │
│   └── utils/
│       ├── config.js             # Catálogo de especies, rutas dinámicas, legacy API
│       ├── dataLoader.js         # Helpers fetch JSON/CSV/GeoJSON
│       ├── pickerUtils.js        # Picking, leyendas, paleta GEU, coordenadas
│       ├── terrainLoader.js      # Carga DEM (terrain.json + terrain.bin)
│       ├── pointCloudLoader.js   # Carga PLY/XYZ/CSV/JSON de nubes de puntos
│       ├── hillshade.js          # Generación de textura hillshade desde DEM
│       └── processHeatmap.js     # Procesamiento de bordes del heatmap (fade-out)
│
├── public/                       # Assets estáticos servidos tal cual
│   ├── data/
│   │   ├── species/index.json    # Catálogo maestro de especies/algoritmos
│   │   ├── species/{especie}/{algoritmo}/
│   │   │   ├── current/          # Escenario actual (presente)
│   │   │   ├── future/{ssp}_{periodo}/  # Escenarios futuros
│   │   │   ├── curves/           # CSV + PNGs de curvas de respuesta
│   │   │   └── diff/             # PNGs de diferencias + JSON de tablas
│   │   ├── pointcloud/{especie}/{algoritmo}/
│   │   │   ├── *.ply             # Nubes de puntos 3D
│   │   │   └── index.json        # Índice de nubes disponibles
│   │   └── terrain/
│   │       ├── terrain.json      # Metadatos DEM (bbox, width, height)
│   │       ├── terrain.bin       # Elevaciones DEM en Float32Array
│   │       ├── dem.tif           # DEM original
│   │       └── mosaic.vrt        # Referencia GDAL
│   └── models/                   # (vacío, reservado)
│
├── scripts/                      # Scripts de procesamiento
│   ├── merge_dem.py
│   ├── migrate-data.cjs
│   └── process-dem.cjs
│
└── dist/                         # Build de producción (generado por Vite)
```

---

## 4. Configuración del proyecto

### 4.1 package.json

```json
{
  "name": "geu-web-sdm",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "cesium": "^1.118.0",
    "geotiff": "^3.0.5",
    "papaparse": "^5.4.1",
    "plotly.js-dist-min": "^2.33.0",
    "three": "^0.184.0"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "vite": "^5.3.0"
  }
}
```

### 4.2 vite.config.js

Solo define `base: './'` para que los paths relativos funcionen al desplegar en subdirectorios.

### 4.3 tailwind.config.js

Define la **paleta TerraPredict** bajo `theme.extend.colors`:

| Token | Valor | Uso |
|---|---|---|
| `terra-bg` | `#080c0a` | Fondo principal |
| `terra-surface` | `#111815` | Fondos de tarjetas |
| `terra-surface-light` | `#1a211e` | Selects, inputs |
| `terra-accent` | `#2dd4a0` | Verde esmeralda (CTAs, acentos) |
| `terra-accent-hover` | `#22c28e` | Hover del acento |
| `terra-accent-warm` | `#fbbf24` | Ámbar (alertas, métricas bajas) |
| `terra-border` | `rgba(45,212,160,0.12)` | Bordes sutiles |

También mantiene clases legacy `geu-*` para compatibilidad con componentes antiguos.

El `content` incluye `"./src/style.css"` para que Tailwind procese las clases definidas en `@layer components`.

### 4.4 postcss.config.js

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

## 5. Tema visual y CSS

### 5.1 src/style.css

Importa la fuente **Inter** desde Google Fonts y define tres capas:

**`@layer base`**
- `scroll-behavior: smooth`
- `body`: fondo `#080c0a`, texto `#e7e5e4`, fuente Inter
- `::selection`: fondo semitransparente del acento

**`@layer components`**
Clases reutilizables que combinan utilidades Tailwind:

| Clase | Descripción |
|---|---|
| `.terra-card` | Tarjeta con fondo surface, bordes redondeados, sombra, borde sutil. Hover: levantamiento + brillo de borde. |
| `.terra-btn` | Botón primario (fondo acento, texto oscuro, sombra). |
| `.terra-btn-outline` | Botón outline (borde acento, texto acento). Hover: relleno. |
| `.terra-btn-ghost` | Botón nav (texto gris, hover acento). |
| `.terra-select` | Select estilizado con fondo oscuro, borde sutil, focus ring acento. |
| `.geu-card` | **Legacy** — equivalente a terra-card con estilos ligeramente diferentes. |
| `.geu-btn` / `.geu-btn-outline` / `.geu-select` | **Legacy** — mapeados a colores TerraPredict. |
| `.terra-section-header` | Encabezado de sección centrado con título grande y subtítulo. |

**`@layer utilities`**
- `.reveal` / `.reveal.active`: animación de entrada por desplazamiento Y + fade, activada vía IntersectionObserver.
- `.reveal-delay-{1,2,3,4}`: delays escalonados (0.1s–0.4s).
- `.text-gradient`: gradiente de texto de acento a acento-warm.

### 5.2 Convenciones de diseño

- **Dark theme** dominante con fondo casi negro.
- **Acento verde** para elementos primarios y estados positivos.
- **Acento ámbar** para alertas, valores bajos (< 50%) y curvas de respuesta.
- **Bordes redondeados** generosos (`rounded-2xl`, `rounded-xl`).
- **Backdrop blur** en overlays flotantes.
- **Pointer-events-none** en tooltips y leyendas para no interferir con la interacción.

---

## 6. HTML principal (index.html)

Estructura de una sola página con anclas:

```
#top → Hero (h-screen, centrado)
#visor → Visor Geoespacial (2D/3D toggle + SSP info panel)
#analisis → Análisis del Modelo (Dashboard + Curvas + Histograma)
#cambio-climatico → Cambio Climático (DiffMap + Comparador)
#descargas → Descargas de Datos
```

**Elementos clave en el HTML:**

- **Navbar sticky** (`#main-nav`): backdrop-blur, enlaces de scroll, menú móvil hamburguesa.
- **Toolbar del visor**: botones 2D/3D y exportar PNG/GLB **fuera** del canvas (encima del contenedor).
- **Panel SSP colapsable**: explicación de los 4 escenarios SSP con toggle.
- **Contenedor del visor**: `h-[70vh]` mobile / `h-[75vh]` desktop, bordes redondeados, shadow.
  - Dentro: selector de escenario flotante (z-30), viewer-2d (z-10), viewer-3d (z-0, invisible por defecto).
- **Footer**: solo copyright "© 2025 TerraPredict".

**Cesium base URL** se carga vía script tag en `<head>`:
```html
<script>window.CESIUM_BASE_URL = 'https://unpkg.com/cesium@1.118.0/Build/Cesium/';</script>
```

---

## 7. Punto de entrada (main.js)

`bootstrap()` es una IIFE async que:

1. **Inicializa todos los componentes** en orden:
   - `initHero()`
   - `initScenarioSelector(onChange)` → al cambiar, dispara `model-changed`
   - `initMapViewer('map-container')`
   - `initDashboard('dashboard')`
   - `initResponseCurves('curves')`
   - `initDiffMap('diff')`
   - `initProbabilityHistogram('histogram')`
   - `initSideBySideComparator('comparator', currentModel)`
   - `initScene3D('scene3d', currentModel)`
   - `initDownloads('downloads')`

2. **Toggle 2D/3D**: intercambia clases `z-10`/`z-0` e `invisible` entre los dos viewers. Actualiza estilos de los botones.

3. **Exportar PNG**: detecta qué visor está activo y llama a `exportPNG()` del correspondiente. Genera nombre de archivo con formato `TerraPredict_{sp}_{algo}_{escenario}.png`.

4. **Exportar GLB**: delega a `scene3D.exportGLB()`.

5. **Navegación suave**: intercepta clicks en `a[href^="#"]` y hace `scrollIntoView({ behavior: 'smooth' })`.

6. **Menú móvil**: toggle de `hidden` en `#mobile-menu`.

7. **Panel SSP**: toggle de `hidden` en `#ssp-info-panel` + rotación de chevron.

8. **Navbar scroll**: añade/quita sombra y cambia opacidad del fondo según scrollY.

9. **Animaciones reveal**: dos IntersectionObservers:
   - Uno para elementos `.reveal` individuales (threshold 0.08).
   - Otro para `<section>` que activa `.reveal` hijos con delay escalonado (80ms).

---

## 8. Arquitectura de eventos

### 8.1 Contrato `model-changed`

Es el **único mecanismo de comunicación** entre componentes. Es un `CustomEvent` disparado en `window` con `detail`:

```js
{
  species:    { id, label },
  algorithm:  { id, label, prefix, ssps, periods },
  period:     { id, label },
  scenario:   { id, label, folder, suffix },
  paths:      { geojson, png, tif, metrics, config }
}
```

**Quién lo dispara:** `ScenarioSelector.js` (al cambiar cualquier select) y `main.js` (al inicio si hay modelo inicial).

**Quién lo escucha:** MapViewer, Scene3D, Dashboard, ResponseCurves, DiffMap, ProbabilityHistogram, Downloads, SideBySideComparator.

Cada componente tiene su propia función `render(model)` o `load(model)` que se ejecuta al recibir el evento.

### 8.2 Patrón de inicialización

Todos los componentes siguen el patrón:
```js
export async function initXxx(containerId, initialModel, options) {
  const container = document.getElementById(containerId);
  if (!container) return;
  // Inyectar HTML interno
  // Cargar catálogo / datos
  // Escuchar model-changed
  // Retornar API pública (exportPNG, etc.)
}
```

---

## 9. Componentes

### 9.1 Hero.js

- Inyecta HTML en `#hero`.
- Fondo decorativo: radial gradient + patrón de puntos sutiles.
- Badge animado "Predicción de Distribución" con pulso.
- Título grande con gradiente `.text-gradient`.
- Descripción del proyecto.
- Tags decorativos (SDM, SSP, Visor 2D/3D, Análisis).
- CTA "Explorar resultados" con scroll suave a `#visor`.
- **No muestra nombre de especie** (genérico, centrado en la plataforma).

### 9.2 ScenarioSelector.js

- Carga `/data/species/index.json` vía `config.js`.
- Inyecta una barra flotante con **4 selects** en línea horizontal (con scroll si no cabe):
  1. **Especie**: lista dinámica desde catálogo.
  2. **Algoritmo**: actualizado al cambiar especie.
  3. **Período**: 2021-2040, 2041-2060, 2061-2080, 2081-2100.
  4. **Escenario**: actual + SSPs disponibles para el período.

- **Lógica de cascada**: cambiar especie → recarga algoritmos → recarga escenarios. Cambiar período → recarga escenarios intentando mantener el mismo SSP.
- Dispara `model-changed` con el objeto completo del modelo seleccionado.
- Usa clases `geu-select` y fondo `bg-geu-panel/90`.

### 9.3 MapViewer.js (Visor 2D)

**Motor**: CesiumJS.

- Inicializa `Cesium.Viewer` con:
  - `terrainProvider`: Cesium World Terrain (fallback a elipsoide).
  - Todos los widgets UI desactivados excepto `homeButton`.
  - `depthTestAgainstTerrain = true`.
  - Fondo `#232323`.

- **Capas base disponibles** (selector inferior izquierdo):
  - `esri-satellite` (default)
  - `cartodb-dark`, `cartodb-voyager`, `cartodb-positron`
  - `osm`, `esri-street`, `opentopomap`, `cesium-default`

- **Heatmap overlay**: `Cesium.Rectangle` con `ImageMaterialProperty` transparente. Se posiciona usando el BBox calculado desde el GeoJSON del escenario.

- **Leyenda**: gradiente vertical GEU flotante en la esquina inferior izquierda (arriba de los controles).

- **Picking**:
  - Restringido al BBox del heatmap (si click fuera, se oculta tooltip).
  - Lee el PNG del heatmap en un canvas offscreen (`pickerUtils.js`).
  - Muestra: coordenadas (decimal + DMS), elevación, color HEX, categoría GEU (probabilidad).
  - **Marcador**: punto verde (`#2dd4a0`) en la ubicación del click.
  - Tooltip posicionado **junto al click** (no fijo en esquina).

- **Opacidad**: slider 0.1–1.0 (default 0.55) con label porcentual.

- **Exportar PNG**: `viewer.canvas.toDataURL('image/png')`.

### 9.4 Scene3D.js (Visor 3D)

**Motor**: Three.js (WebGLRenderer + OrbitControls).

**Escena**:
- Fondo `#111111`.
- `ACESFilmicToneMapping` + `toneMappingExposure = 0.6`.
- Luces: AmbientLight(0xffffff, 0.25) + DirectionalLight(0xfff5e6, 0.7) + DirectionalLight(0xcceeff, 0.15).

**Terreno**:
- Carga DEM desde `terrain.json` + `terrain.bin` (`terrainLoader.js`).
- Crea `PlaneGeometry` con segmentos = resolución DEM.
- Desplaza vértices Z según elevación × exageración 1.8.
- Material base: `MeshStandardMaterial(color: 0xdddddd, roughness: 0.9)`.
- `FrontSide` para no ver paredes inferiores.

**Heatmap**:
- Overlay flotante (`heatmapMesh`) a Y=0.5 sobre el terreno.
- Usa `ShaderMaterial` con uniforms `uTex1`, `uTex2`, `uMixRatio`, `uOpacity`.
- **Fragment shader**: `texture2D` → `mix` → `pow(rgb, 1.25) * 0.8` (atenuación de brillo) → alpha.
- `transparent: true`, `depthWrite: false`, `polygonOffset: -4` (evita z-fighting).
- **UVs invertidas en Y** para alinear con el DEM.
- Transiciones suaves entre escenarios con `smoothstep` ease.

**Nube de puntos**:
- Carga PLY desde `public/data/pointcloud/` vía `pointCloudLoader.js`.
- Parse manual robusto (ASCII y binary little endian).
- Transforma coordenadas geo a metros locales (`lonLatToMeters`).
- Escalado de elevación con exageración 1.8.
- **Downsampling**: si > 5M puntos → stride 100; si > 500K → stride 20.
- `PointsMaterial` con `vertexColors`, `size: 4.0`, `opacity: 0.6`.

**Controles**:
- OrbitControls con damping, maxPolarAngle (evita ver desde abajo), min/maxDistance.
- **Drag detection**: si el mouse se mueve > 6px entre pointerdown y click, no ejecuta picking.
- **Wheel capture**: `preventDefault()` en wheel sobre el canvas para evitar scroll de página.

**Picking en 3D**:
- Raycaster contra `terrainMesh` (no contra heatmapMesh).
- Obtiene UV → lon/lat → samplea PNG del heatmap.
- Muestra tooltip posicionado junto al click.
- **Marcador**: `TorusGeometry(500, 60)` blanco, `renderOrder: 999`, `depthWrite: false`, siempre visible.

**Texturas alternativas** (selector superior derecho):
- Heatmap modelo
- ESRI Satellite (export ArcGIS MapServer)
- Hillshade DEM (generado en canvas vía `hillshade.js`)
- Sólido gris

**Animación serie temporal**:
- Panel inferior con timeline de botones.
- Modo **Temporal**: fija SSP, anima períodos (Actual → 2021-2040 → ... → 2081-2100).
- Modo **Escenarios**: fija período, anima SSPs.
- Precarga texturas en `Map`. Transición suave 4s con ease.
- Play/Pausa/Prev/Next.

**Leyenda**: gradiente GEU en esquina inferior izquierda (dentro del canvas).

**Exportar**:
- PNG: `renderer.domElement.toDataURL()`
- GLB: `GLTFExporter` con `binary: true`. Clona terreno + nube de puntos. Invierte UVs Y en el terreno clonado para que la textura se oriente correctamente en el export.

### 9.5 Dashboard.js

- Carga `Metrics.json` del escenario **actual** (siempre presente).
- Muestra **7 métricas** en grid 2 columnas:
  - AUC, Accuracy, TSS, Kappa, Precision, Recall, F1.
- Cada métrica: label, valor formateado (4 decimales), barra de progreso.
- **Colores de barra**:
  - `bg-green-500` si > 80%
  - `bg-terra-accent` si > 50%
  - `bg-terra-accent-warm` si < 50%
- **Botón ⓘ**: toggle descripción detallada debajo de cada métrica.
- `max: 1` en todas las métricas (barras como porcentaje).
- Fix de comas decimales: `.replace(',', '.')` para compatibilidad CSS.

### 9.6 ResponseCurves.js

- Carga CSV de curvas vía PapaParse.
- **Selector de variable BIO**: dropdown dinámico con variables disponibles.
- **Descripción BIO**: diccionario `BIO_DESCRIPTIONS` con descripción + unidad (°C, mm, %).
- Muestra descripción debajo del select al cambiar.
- **Gráfica Plotly**:
  - Línea azul de probabilidad vs valor.
  - Línea roja punteada en `MeanReference` (media de entrenamiento).
  - Layout dark con fondo `#2b2b2b`.
  - Título eje X: `{variable} — {unidad}`.
- **Fix race condition**: si `index` no está cargado al iniciar, guarda `pendingModel` y lo procesa cuando el índice esté disponible.

### 9.7 ProbabilityHistogram.js

- Carga GeoJSON del escenario seleccionado.
- Extrae `properties.probability` de cada feature.
- **10 bins** de ancho 0.1 (0.0–0.1, 0.1–0.2, ..., 0.9–1.0).
- **Colores sincronizados con paleta GEU** (función `geuColor(t)`):
  - Azul oscuro → cian → verde → amarillo → naranja → rojo.
  - **Sin púrpura** (eliminado de la paleta original).
- **Línea de umbral**: línea blanca punteada + anotación con el valor de threshold.
- Layout dark, barras con borde blanco sutil.

### 9.8 DiffMap.js

- Selector de **Período** y **SSP** (independientes del selector principal).
- Muestra **PNG de diferencias** (rojo = pérdida, verde = ganancia, gris = sin cambio).
- Si no existe el archivo, muestra placeholder con mensaje explicativo.

**Tres tablas comparativas** con texto descriptivo encima:

1. **Área por umbral** (`threshold`): píxeles con probabilidad ≥ threshold. Explica que representa el área donde el modelo considera probable encontrar la especie.
2. **Área continua ponderada**: suma de todas las probabilidades sin umbral. Explica que cuenta tanto píxeles con alta como baja probabilidad ponderada.
3. **Balance de hábitat continuo**: pérdida, ganancia, estable, cambio neto. Explica la comparación actual vs futuro.

- Formato numérico español (`Intl.NumberFormat('es-ES')`).
- Colores condicionales: rojo para negativo, verde para positivo.

### 9.9 SideBySideComparator.js

- Dos instancias de `Cesium.Viewer` en paneles 50/50.
- **Cámaras sincronizadas**: `syncCameras(v1, v2)` — cuando una se mueve, la otra sigue.
- Selectores de escenario flotantes en la parte superior de cada mapa.
- Capa base por defecto: ESRI Satellite.
- Slider de opacidad compartido.
- **Leyenda de colores** debajo de los mapas con 5 franjas del gradiente GEU.

### 9.10 Downloads.js

- Genera tarjetas de descarga con icono + nombre de archivo.
- Archivos disponibles:
  - GeoTIFF (`.tif`)
  - GeoJSON (`.geojson`)
  - Heatmap PNG (`.png`)
  - Métricas JSON (`.json`)
  - Config JSON (`.json`)
  - Curvas CSV (`.csv`)
  - Diferencias PNG (`.png`)
- Cada enlace usa atributo `download` para descarga directa.

---

## 10. Utilidades

### 10.1 config.js

**Catálogo dinámico** desde `/data/species/index.json`. Estructura del catálogo:

```json
{
  "species": [
    {
      "id": "Pinus_uncinata",
      "label": "Pinus uncinata",
      "algorithms": [
        {
          "id": "Random_Forest",
          "label": "Random Forest",
          "prefix": "Pinus_uncinata_Ramond_ex_DC._Random_Forest",
          "periods": ["2081_2100"],
          "ssps": [
            { "id": "ssp126", "label": "SSP1-2.6 (Sostenibilidad)", "suffix": "SSP1-2.6_(Sostenibilidad)" },
            ...
          ]
        }
      ]
    }
  ]
}
```

**Funciones principales**:
- `loadSpeciesIndex()`: carga y cachea el catálogo.
- `getSpecies()`, `getAlgorithms()`, `getAlgorithm()`: navegación por catálogo.
- `getPeriods()`: retorna los 4 períodos fijos.
- `getScenarios()`: genera array de escenarios (actual + SSP×período) para una combinación.
- `getPaths()`: construye rutas relativas a los archivos de un escenario.
- `getCurvesPath()`, `getDiffPath()`, `getDiffTablesPath()`: rutas específicas.
- `getPointCloudIndexUrl()`: ruta al `index.json` de nubes.

**API Legacy**: `SCENARIOS`, `getPathsLegacy()`, etc. Mantenidos por compatibilidad.

### 10.2 dataLoader.js

- `loadJson(url)`: fetch + JSON.
- `loadCsv(url)`: fetch + PapaParse con `header: true`, `dynamicTyping: true`.
- `loadGeoJson(url)`: fetch + JSON.

### 10.3 pickerUtils.js

- `loadImageToCanvas(url)`: carga imagen en canvas offscreen, cachea en `Map`.
- `samplePixel(ctx, x, y, w, h)`: lee RGBA de un píxel.
- `pixelCoordsFromLonLat(lon, lat, bbox, imgW, imgH)`: convierte geo a píxeles (origen NW).
- `formatCoords(lat, lon)`: decimal (5 decimales) + DMS.
- `formatElevation(m)`: con 1 decimal.
- `rgbToHex(r, g, b)`: `#RRGGBB`.
- `classifyGEUColor(r, g, b)`: distancia euclidiana al color más cercano de `GEU_PALETTE`.
- `createGEULegendCanvas()`: genera canvas 20×200px con gradiente vertical de la paleta GEU (6 stops).

**Paleta GEU** (5 categorías, 6 stops para interpolación):
| Probabilidad | Color | Label |
|---|---|---|
| 0.00–0.05 | `#00008B` | Muy baja / ausencia |
| 0.05–0.15 | `#00BFFF` | Baja |
| 0.15–0.30 | `#7FFF00` | Media-baja |
| 0.30–0.60 | `#FFD700` | Media-alta |
| 0.60–1.00 | `#DC0000` | Alta probabilidad |

### 10.4 terrainLoader.js

- `loadDEM()`: carga `terrain.json` (metadatos) + `terrain.bin` (Float32Array de elevaciones) vía `Promise.all`.
- Retorna: `{ width, height, elevations, bbox, minElevation, maxElevation }`.
- `lonLatToMeters(lon, lat, refLat)`: proyección equirectangular aproximada.
- `createTerrainGeometry(demData, exaggeration)`: genera `PlaneGeometry` con vértices desplazados en Z según elevación. Calcula min/max el y dimensiones en metros.

### 10.5 pointCloudLoader.js

- `loadPointCloud(url)`: despacha por extensión (`.ply`, `.json`, `.csv`, `.xyz`/`.txt`).
- `loadPLYManual()`: parser manual de PLY ASCII y binary little endian.
  - Lee header buscando `end_header\n` byte a byte.
  - Soporta propiedades x/y/z y red/green/blue (o r/g/b, diffuse_red, etc.).
  - Detecta si colores son uchar (÷255) o float.
  - Retorna `BufferGeometry` con `position` y `color`.
- `loadJSON()`, `loadCSV()`, `loadXYZ()`: parsers simples.
- `pointsToGeometry(points)`: convierte array de puntos a `BufferGeometry`.

### 10.6 hillshade.js

- `createHillshadeTexture(elevations, width, height, exaggeration)`:
  - Algoritmo estándar: azimuth 315°, zenith 45°.
  - Calcula slope y aspect desde vecinos.
  - Genera canvas en escala de grises.

### 10.7 processHeatmap.js

- `processHeatmapAdvanced(imageUrl)`: aplica fade-out de 18px en los 4 bordes del PNG usando gradientes de máscara + `destination-in`.
- **Actualmente no se usa activamente** en el flujo principal (el heatmap se carga directo vía `TextureLoader`).

---

## 11. Datos y assets requeridos

### 11.1 Catálogo maestro

**`public/data/species/index.json`** — define qué especies, algoritmos, períodos y SSPs están disponibles. Sin este archivo, toda la aplicación falla al cargar.

### 11.2 Estructura por especie/algoritmo

```
public/data/species/{species_id}/{algorithm_id}/
├── current/
│   ├── {prefix}_Actual.geojson      # Puntos con properties.probability
│   ├── {prefix}_Actual.png          # Heatmap visual (colormap GEU)
│   ├── {prefix}_Actual.tif          # GeoTIFF (reserva)
│   ├── {prefix}_Config.json         # Configuración del modelo
│   └── {prefix}_Metrics.json        # Métricas de rendimiento
├── future/
│   └── {ssp_id}_{period_id}/
│       ├── {prefix}_{ssp_suffix}_{period}.geojson
│       ├── {prefix}_{ssp_suffix}_{period}.png
│       └── {prefix}_{ssp_suffix}_{period}.tif
├── curves/
│   ├── {prefix}_ResponseCurves.csv      # CSV con columnas: Variable, Value, Probability, MeanReference
│   └── {prefix}_ResponseCurve_BIO{n}.png # Imágenes estáticas (reserva)
└── diff/
    ├── {prefix}_{period}_DifferenceTables.json  # Tablas comparativas
    └── {prefix}_{ssp_suffix}_{period}_Diferencias.png  # Mapa visual diff
```

### 11.3 Terreno

```
public/data/terrain/
├── terrain.json   # { width, height, bbox: {west,south,east,north}, minElevation, maxElevation }
├── terrain.bin    # Float32Array plano con width×height elevaciones
├── dem.tif        # DEM original (no usado en runtime, referencia)
└── mosaic.vrt     # Referencia GDAL
```

El `terrain.bin` se genera previamente (vía script) a partir del DEM para evitar parsear GeoTIFF en el navegador.

### 11.4 Nubes de puntos

```
public/data/pointcloud/{species_id}/{algorithm_id}/
├── index.json     # Array: [{ label, url, scenarioId? }]
└── *.ply          # Nubes de puntos en formato PLY
```

### 11.5 Notas sobre disponibilidad

- Los **diff PNGs** solo están disponibles para el período **2081-2100**. Otros períodos muestran placeholder.
- El catálogo `index.json` debe reflejar exactamente las carpetas existentes; de lo contrario, las rutas generadas apuntarán a archivos inexistentes.

---

## 12. Detalles de implementación críticos

### 12.1 Inversión de UVs en el heatmap 3D

El DEM carga sus datos con row=0 = norte, pero `PlaneGeometry` de Three.js tiene v=0 = sur. Por eso se invierte la coordenada V de las UVs en el `heatmapMesh`:
```js
for (let i = 1; i < uvs.length; i += 2) uvs[i] = 1 - uvs[i];
```
Esto mismo se replica en `exportGLB()` para que la textura se vea correcta en el modelo exportado.

### 12.2 Atenuación de brillo en 3D

El heatmap original tiene colores muy saturados (verdes y amarillos puros). Para evitar que se vean "quemados" en el visor 3D, el fragment shader aplica:
```glsl
col.rgb = pow(col.rgb, vec3(1.25)) * 0.8;
```
Esto comprime los tonos altos y reduce el brillo global un 20%.

### 12.3 Tone mapping y color space

- Renderer: `ACESFilmicToneMapping` con `toneMappingExposure = 0.6`.
- Texturas cargadas con `SRGBColorSpace`.
- No se configura `outputColorSpace` explícitamente (usa default de Three.js r184).

### 12.4 Z-fighting entre terreno y heatmap

El `heatmapMesh` usa `polygonOffset: true, polygonOffsetFactor: -4.0, polygonOffsetUnits: -4.0` para renderizar ligeramente por encima del terreno base (que está en Y=0). Además se posiciona en Y=0.5.

### 12.5 Picking en 3D

El raycaster intersecta **solo** el `terrainMesh`, no el `heatmapMesh`. Esto garantiza que la coordenada geográfica sea correcta sin depender de la transparencia del overlay. El color se obtiene sampleando el PNG del heatmap por separado.

### 12.6 Detección de drag

Para distinguir entre un click de picking y un drag de órbita, se guarda la posición en `pointerdown` y se compara en `click`. Si la distancia euclidiana > 6px, se ignora el click.

### 12.7 Precarga de texturas en animación

El panel de serie temporal precarga todas las texturas PNG en un `Map` antes de empezar la animación, evitando parpadeos al cambiar de frame.

### 12.8 Formato de números

Se usa `.replace(',', '.')` en valores que van a atributos `style` (como `width` de barras de progreso) para evitar que el formato español con coma decimal rompa el CSS.

### 12.9 CSP y CORS

- Las texturas del heatmap se cargan desde el mismo origen (`./data/...`), sin problemas CORS.
- La imagen satelital de ESRI se carga desde `services.arcgisonline.com` (CORS permitido).
- Para el picking, las imágenes del heatmap se cargan con `crossOrigin = 'anonymous'` en `pickerUtils.js`.

---

## 13. Build y despliegue

### 13.1 Scripts npm

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo en `localhost:5173` con HMR |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Previsualización del build de producción |

### 13.2 Proceso de build

Vite:
1. Procesa `index.html`.
2. Empaqueta JS (Tree-shaking de Three.js, Cesium, Plotly).
3. Compila Tailwind CSS desde `src/style.css` → `dist/assets/index-*.css`.
4. Copia `public/` tal cual a `dist/` (incluyendo todos los datos).

### 13.3 Despliegue

- **Opción recomendada**: cualquier hosting estático (Vercel, Netlify, GitHub Pages, Apache, Nginx).
- Dado que `vite.config.js` tiene `base: './'`, funciona correctamente en subdirectorios.
- **Tamaño crítico**: la carpeta `public/data/` puede ser muy pesada (GeoTIFFs, PLYs). Asegurar que el hosting soporte archivos grandes.

---

## 14. Notas sobre compatibilidad GEU legacy

Durante la migración de la marca "GEU" a "TerraPredict", se mantuvieron clases CSS legacy para no romper componentes antiguos:

| Legacy | Mapea a |
|---|---|
| `.geu-card` | `.terra-card` (ligeras diferencias de rounding) |
| `.geu-btn` / `.geu-btn-outline` | `.terra-btn` / `.terra-btn-outline` |
| `.geu-select` | `.terra-select` (menor padding) |
| `bg-geu-panel` | `bg-terra-surface` |
| `bg-geu-accent` / `text-geu-accent` | `bg-terra-accent` / `text-terra-accent` |
| `bg-geu-accent2` | `bg-terra-accent-warm` |

Todas estas clases están definidas en `src/style.css` y apuntan a los mismos colores TerraPredict. En el código JS aún aparecen strings como `bg-geu-accent` en templates HTML inyectados dinámicamente.

El prefijo de archivos `_GEU_` o similares en los datos exportados no afecta a la aplicación, que usa el `prefix` definido en `index.json`.

---

*Fin de la memoria técnica.*
