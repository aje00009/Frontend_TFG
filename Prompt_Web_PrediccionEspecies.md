# Prompt: Desarrollo de Web Interactiva para GEU Prediccion de Especies

## Contexto del Proyecto

GEU (GEU Engine) es un motor C++/OpenGL de visualizacion geoespacial que incluye un modulo de **Prediccion de Distribucion de Especies (SDM)**. El modulo entrena modelos de Machine Learning (Random Forest y MaxEnt) con datos de ocurrencia (GBIF) y variables bioclimaticas (WorldClim 2.1), y proyecta distribuciones bajo escenarios climaticos futuros (SSP1-2.6 a SSP5-8.5).

**YA EXPORTA** los siguientes datos listos para consumir en la web (todos se guardan en `DataPredictionSpecies/Exports/`):

| Archivo | Formato | Contenido |
|---------|---------|-----------|
| `*_Actual.tif` / `*_SSP_Periodo.tif` | GeoTIFF (COG) | Raster RGB de probabilidad con WGS84 |
| `*.geojson` | GeoJSON | Puntos de prediccion con propiedades (prob, species, scenario, metrics) |
| `*_ResponseCurves.csv` | CSV | Curvas de respuesta: Variable, Value, Probability, MeanReference |
| `*_ResponseCurve_BIO*.png` | PNG | Graficas de curvas de respuesta (900x550, estilo oscuro) |
| `*_Metrics.json` | JSON | Metricas del modelo: AUC, Accuracy, Precision, Recall, F1, TSS, Kappa |
| `*_Config.json` | JSON | Configuracion del modelo: algoritmo, hiperparametros, variables seleccionadas |
| `*_heatmap.png` | PNG | Heatmap 2D de probabilidades (colormap custom) |
| `*_Diferencias.png` | PNG | Mapa de diferencias futuro-actual (rojo=perdida, verde=ganancia) |

**Stack del cliente:** Windows, Visual Studio 2022, C++17, OpenGL 4.x. La web debe ser **independiente** (no conectarse al motor GEU), consumiendo solo los archivos exportados.

---

## Objetivo Principal

Crear una **web estatica interactiva** (HTML/CSS/JS) que sirva como:
1. **Visualizador de mapas** con los resultados de prediccion.
2. **Dashboard cientifico** con metricas, curvas de respuesta y tablas comparativas.
3. **Visualizador 3D** del terreno con probabilidades texturizadas y arboles instanciados.
4. **Narrativa / Storytelling** del cambio climatico sobre la distribucion de la especie.

---

## Stack Tecnologico Recomendado

**Frontend:**
- **CesiumJS** (obligatorio): mapa global 3D con terrain, capas raster, GeoJSON, y visualizacion de diferencias.
- **Three.js** (opcional, solo si quieres un modelo 3D custom fuera del globo): para escenas 3D independientes con instancing de arboles.
- **Plotly.js** o **Chart.js**: para las curvas de respuesta y graficas de metricas.
- **Tailwind CSS**: estilado rapido y responsive.
- **Vite**: bundler y dev server.

**Datos:**
- Los GeoTIFFs deben convertirse a **COG** (Cloud Optimized GeoTIFF) con `gdal_translate` antes de servirlos.
- Los GeoJSONs se sirven directamente via fetch.
- Los CSVs se parsean con PapaParse o manualmente.
- Los PNGs y JSONs se sirven estaticamente.

**Hosting:**
- **Vercel** o **GitHub Pages** (gratis).
- Los archivos de datos (COGs, GeoJSONs, PNGs) pueden ir en la misma web si no pesan mucho (>100MB), o en un bucket S3 con CORS habilitado.

---

## Requisitos Funcionales Detallados

### 1. Pagina de Inicio / Hero
- Titulo con nombre de la especie (ej. "Distribucion de *Pinus sylvestris* bajo escenarios climaticos futuros").
- Subtitulo descriptivo.
- Boton "Explorar resultados" que hace scroll a la seccion del mapa.
- Fondo: imagen del heatmap exportado o un render 3D del terrain.

### 2. Mapa Interactivo Principal (CesiumJS)
- **Globo 3D** centrado en el area de estudio (Spain/Iberian Peninsula por defecto, pero debe ser generico).
- **Capa base**: Cesium World Terrain o Mapbox satellite.
- **Overlay de probabilidad**: Cargar el GeoTIFF/COG de prediccion como capa raster sobre el terrain.
- **Puntos GeoJSON**: Cargar el GeoJSON de puntos. Al hacer click en un punto, popup con:
  - Probabilidad de presencia
  - Especie, algoritmo, escenario, periodo
  - Metricas del modelo (AUC, Accuracy)
- **Selector de escenarios**: Dropdown para cambiar entre:
  - Actual (Presente)
  - Futuro SSP1-2.6 2041-2060
  - Futuro SSP2-4.5 2041-2060
  - Futuro SSP3-7.0 2041-2060
  - Futuro SSP5-8.5 2041-2060
  - (y los demas periodos: 2061-2080, 2081-2100)
- **Comparador lado a lado**: Boton para dividir la pantalla en dos mitades (izquierda: escenario A, derecha: escenario B) con un slider sincronizado.

### 3. Mapa de Diferencias
- Mostrar el PNG del mapa de diferencias (rojo/verde/gris) como overlay en CesiumJS, o como imagen estatica grande con leyenda explicativa.
- Alternativamente, si se puede, calcular la diferencia en el cliente restando dos COGs (mas avanzado).

### 4. Dashboard de Metricas
- Tarjetas (cards) con las metricas del JSON:
  - AUC (con barra de progreso visual)
  - Accuracy
  - TSS
  - Kappa
  - Precision / Recall / F1
- Tabla comparativa de metricas entre escenarios (si hay multiples modelos).
- Grafico de barras con la **importancia de variables** (si se exporta).

### 5. Curvas de Respuesta
- Mostrar los PNGs exportados en una **galeria** o carousel.
- Alternativamente (mejor), parsear el CSV y generar graficas interactivas con **Plotly.js**:
  - Dropdown para seleccionar variable (BIO1, BIO8, BIO12, etc.).
  - Linea azul: probabilidad vs valor de la variable.
  - Linea vertical roja: media del training set.
  - Eje Y fijo [0, 1].
  - Tooltip con valor exacto al pasar el raton.
- Seccion explicativa debajo: "Otras variables se mantienen fijas en la media del entrenamiento."

### 6. Visualizacion 3D con Arboles (Feature Estrella)
El usuario quiere un **modelo 3D con textura y arboles pintados**.

**Opcion A — CesiumJS + Terrain (recomendada, mas facil):**
- Usar `Cesium.WorldTerrain` como base.
- Aplicar el heatmap de probabilidad como textura sobre el terrain (si Cesium lo soporta via material/imagery provider).
- Usar `Cesium3DTileset` o `Entity` con **billboards** de arbol en las zonas de alta probabilidad (>0.7).
- Para miles de arboles, usar `Cesium.PointPrimitiveCollection` o instanced 3D models.

**Opcion B — Three.js custom (mas trabajo, mas control):**
- Crear un **plane geometry** subdividido (ej. 256x256 segmentos).
- Usar el DEM como displacement map para elevar el terreno.
- Aplicar el heatmap como textura de color.
- **Instanciar arboles**: usar `THREE.InstancedMesh` con un modelo GLTF simple de arbol (cono + cilindro, o un GLTF real descargado de Quixel/Sketchfab).
  - Posicionar instancias solo donde la probabilidad > 0.6.
  - Variar escala y rotacion aleatoria para naturalidad.
  - Color del arbol puede variar ligeramente segun la probabilidad.
- Camara orbital (OrbitControls) con zoom, pan, rotate.
- Iluminacion direccional + ambient.

### 7. Narrativa / Storytelling (Scrollytelling)
- Seccion tipo "scroll-driven narrative":
  1. "Esta es la distribucion actual de [Especie]" → Mapa actual.
  2. "El modelo predice con AUC=0.92" → Dashboard de metricas.
  3. "La especie prefiere temperaturas frescas" → Curva de respuesta BIO8.
  4. "Bajo SSP2-4.5 en 2041-2060..." → Mapa futuro.
  5. "El habitat se contrae un X%" → Mapa de diferencias.
  6. "Conclusiones" → Resumen y enlaces a datos descargables.
- Usar **Scrollama** o **GSAP ScrollTrigger** para activar animaciones al hacer scroll.

### 8. Descargas
- Seccion con botones para descargar cada archivo exportado:
  - GeoTIFF, GeoJSON, CSV de curvas, PNGs, JSON de metricas.

---

## Estructura de Carpetas de Datos (que recibira la web)

```
public/
  data/
    species/
      Pinus_sylvestris/
        current/
          Pinus_sylvestris_RF_Actual.tif          (COG)
          Pinus_sylvestris_RF_Actual.geojson
          Pinus_sylvestris_RF_Actual_heatmap.png
          Pinus_sylvestris_RF_Metrics.json
          Pinus_sylvestris_RF_Config.json
        future/
          ssp245_2041_2060/
            Pinus_sylvestris_RF_SSP2-4.5_2041-2060.tif
            Pinus_sylvestris_RF_SSP2-4.5_2041-2060.geojson
            Pinus_sylvestris_RF_SSP2-4.5_2041-2060_heatmap.png
          ssp585_2081_2100/
            ...
        curves/
          Pinus_sylvestris_RF_ResponseCurves.csv
          Pinus_sylvestris_RF_ResponseCurve_BIO1.png
          Pinus_sylvestris_RF_ResponseCurve_BIO8.png
          ...
        diff/
          Pinus_sylvestris_RF_Diferencias.png
```

**Nota:** Los GeoTIFFs deben ser convertidos a COG antes de subirlos. El script de conversion:
```bash
gdal_translate -of COG -co COMPRESS=DEFLATE input.tif output.cog.tif
```

---

## Consideraciones de Diseno

- **Tema oscuro**: coherente con la UI de GEU (fondos #232323, texto claro, acentos azul/naranja).
- **Responsive**: debe verse bien en portatil (1366x768) y pantallas grandes (1920x1080). Movil es secundario.
- **Performance**: si hay miles de puntos GeoJSON, usar clusterizacion. Si hay miles de arboles 3D, usar InstancedMesh.
- **Accesibilidad**: textos alternativos en imagenes, contraste suficiente.

---

## Entregables Esperados

1. **Proyecto Vite** funcional con `npm run dev` y `npm run build`.
2. **Codigo fuente** en un repositorio Git.
3. **README.md** con instrucciones de como copiar los datos exportados de GEU a la carpeta `public/data/`.
4. **Deploy funcional** en Vercel/GitHub Pages (o instrucciones claras de como hacerlo).
5. **No usar backend**: todo debe ser estatico (HTML/CSS/JS + archivos de datos).

---

## Prioridades

1. **P0 (Imprescindible):** Mapa CesiumJS con selector de escenarios + GeoJSON + heatmap overlay.
2. **P0 (Imprescindible):** Dashboard de metricas + curvas de respuesta interactivas.
3. **P1 (Importante):** Mapa de diferencias.
4. **P1 (Importante):** Visualizacion 3D con terrain + arboles instanciados.
5. **P2 (Deseable):** Scrollytelling narrativo.
6. **P2 (Deseable):** Comparador lado a lado con slider.

---

## Ejemplo de Consumo de Datos

```javascript
// Cargar metricas
const metrics = await fetch('./data/species/Pinus_sylvestris/Pinus_sylvestris_RF_Metrics.json').then(r => r.json());
console.log(metrics.auc); // 0.9234

// Cargar curvas de respuesta
const curvesCsv = await fetch('./data/species/Pinus_sylvestris/curves/Pinus_sylvestris_RF_ResponseCurves.csv').then(r => r.text());
// Parsear con PapaParse o manualmente

// Cargar GeoJSON en Cesium
const geojson = await fetch('./data/species/Pinus_sylvestris/current/Pinus_sylvestris_RF_Actual.geojson').then(r => r.json());
const dataSource = await Cesium.GeoJsonDataSource.load(geojson);
viewer.dataSources.add(dataSource);
```

---

## Notas para el Desarrollador Web

- No tienes acceso al codigo fuente de GEU. Solo recibes los archivos exportados.
- Los nombres de archivo pueden incluir sufijos `(1)`, `(2)` si se exportan multiples veces. Elige el mas reciente o el que no tenga sufijo.
- Los valores de WorldClim estan en unidades especificas (temperaturas en °C x 10, precipitacion en mm). El CSV de curvas incluye los valores raw.
- Si necesitas convertir los COGs a tiles para Cesium, puedes usar `rio-cogeo` o `gdal2tiles.py`. Cesium soporta COGs directamente via `SingleTileImageryProvider` o `UrlTemplateImageryProvider` si los sirves con tierras.
