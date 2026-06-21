# 6.5 Incremento V: Subsistema frontend web

     El quinto y último incremento materializa la capa de presentación del sistema: la aplicación web TerraPredict. Mientras que los incrementos anteriores se han centrado en el motor de procesamiento GEU (ingesta, entrenamiento, predicción y exportación), este incremento transforma los archivos generados en una interfaz accesible desde cualquier navegador moderno. TerraPredict no ejecuta modelos de Machine Learning; su función es visualizar, comparar y difundir los resultados espaciales exportados por GEU.

     La implementación sigue una arquitectura de Single Page Application (SPA) desacoplada del backend. Toda la lógica reside en el cliente, lo que permite desplegar la aplicación en servidores web estáticos sin necesidad de infraestructura de aplicaciones adicionales. A continuación, se describe la organización del código, el catálogo dinámico de datos, la orquestación de componentes y cada uno de los visores y paneles implementados.

## 6.5.1 Estructura de la SPA y stack tecnológico

     El proyecto TerraPredict se encuentra en el directorio raíz `FRONT/`, separado del motor GEU. La estructura de carpetas refleja una división clara entre componentes visuales, utilidades compartidas y configuración del build:

```
FRONT/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.js
│   ├── style.css
│   ├── components/
│   │   ├── Hero.js
│   │   ├── ScenarioSelector.js
│   │   ├── MapViewer.js
│   │   ├── Scene3D.js
│   │   ├── Dashboard.js
│   │   ├── ResponseCurves.js
│   │   ├── ProbabilityHistogram.js
│   │   ├── DiffMap.js
│   │   ├── SideBySideComparator.js
│   │   └── Downloads.js
│   └── utils/
│       ├── config.js
│       ├── dataLoader.js
│       ├── pickerUtils.js
│       ├── terrainLoader.js
│       ├── pointCloudLoader.js
│       ├── hillshade.js
│       └── processHeatmap.js
```

     El stack tecnológico se ha detallado ya en el apartado 4.3.5; no obstante, conviene recordar que el build utiliza Vite 5 con soporte para ES Modules y recarga en caliente, los estilos se gestionan con Tailwind CSS 3 sobre un tema oscuro propio (`terra-bg`, `terra-surface`, `terra-accent`), y los visores se implementan con CesiumJS 1.118 (2D/global) y Three.js 0.184 (3D/local).

     Todas las dependencias se declaran en `package.json` (ver Tabla 12), y el arranque de desarrollo se realiza mediante `npm run dev`, mientras que la versión de producción se genera con `npm run build`, produciendo una carpeta `dist/` lista para desplegar en cualquier servidor web estático.

## 6.5.2 Catálogo dinámico de especies, algoritmos y escenarios

     Uno de los requisitos no funcionales del frontend es que debe escalar automáticamente cuando se añadan nuevas especies, algoritmos o escenarios climáticos. Para evitar modificar el código fuente cada vez que GEU exporta un nuevo modelo, TerraPredict lee un catálogo centralizado: `public/data/species/index.json`.

     El fichero `index.json` contiene, para cada especie, la lista de algoritmos disponibles, los SSPs soportados, los períodos futuros y el prefijo de los archivos exportados. La utilidad `src/utils/config.js` encapsula toda la lógica de consulta a este catálogo, ofreciendo funciones como `getSpecies()`, `getAlgorithms()`, `getScenarios()` y `getPaths()`.

     A partir de este catálogo, la ruta de cualquier archivo se resuelve dinámicamente mediante la expresión:

```
./data/species/{speciesId}/{algorithmId}/{scenario.folder}/{prefix}_{scenario.suffix}.{ext}
```

     donde `{scenario.folder}` puede ser `current` para el escenario actual o `future/{ssp}_{period}` para los escenarios futuros. Además, en la carpeta `current/` se espera el archivo `*_Occurrences.csv`, que contiene las coordenadas de presencia de la especie y que se utiliza para dibujar las marcas de ocurrencias en los visores 2D y 3D cuando el escenario seleccionado es el actual. Esta convención garantiza que, si GEU exporta una nueva especie siguiendo la misma estructura de carpetas, TerraPredict la mostrará sin necesidad de recompilar.

     La Tabla 21 resume las principales funciones de `config.js` y su responsabilidad.

| Función | Responsabilidad |
|---|---|
| `loadSpeciesIndex()` | Carga y cachea `index.json`. |
| `getSpecies(index)` | Devuelve el listado de especies. |
| `getAlgorithms(index, speciesId)` | Devuelve los algoritmos disponibles para una especie. |
| `getScenarios(...)` | Genera el array de escenarios (actual + SSPs) para una combinación especie/algoritmo/período. |
| `getPaths(...)` | Resuelve las rutas de GeoJSON, PNG, GeoTIFF, métricas y configuración. |
| `getOccurrencesPath(...)` | Resuelve la ruta del CSV de ocurrencias de presencia. |
| `getDiffPath(...)` / `getDiffTablesPath(...)` | Resuelven rutas del mapa de diferencias y tablas asociadas. |
| `getPointCloudIndexUrl(...)` | Devuelve la URL del índice de nubes de puntos PLY. |

Tabla 21 : Funciones principales de utils/config.js

## 6.5.3 Orquestación de componentes y evento model-changed

     El punto de entrada de la aplicación es `src/main.js`. Su labor es inicializar todos los componentes, gestionar el modo 2D/3D, exponer los botones de exportación PNG/GLB y coordinar la navegación de la SPA (menú móvil, scroll suave, panel explicativo SSP y animaciones reveal).

     La comunicación entre componentes se basa en un único `CustomEvent` denominado `model-changed`, disparado sobre el objeto `window`. El payload del evento contiene la especie, algoritmo, período, escenario y las rutas resueltas a los archivos:

```json
{
  "species":    { "id": "Pinus_uncinata", "label": "Pinus uncinata" },
  "algorithm":  { "id": "Random_Forest", "label": "Random Forest", ... },
  "period":     { "id": "2081_2100", "label": "2081-2100" },
  "scenario":   { "id": "ssp585_2081_2100", "label": "SSP5-8.5 (2081-2100)", ... },
  "paths":      { "geojson": "...", "png": "...", "tif": "...", "metrics": "...", "config": "..." }
}
```

     `ScenarioSelector.js` es el único emisor de este evento. Cuando el usuario cambia cualquiera de los cuatro selectores (especie, algoritmo, período, escenario), el componente reconstruye el objeto de modelo y lo emite. Todos los demás componentes (`MapViewer`, `Scene3D`, `Dashboard`, `ResponseCurves`, `ProbabilityHistogram`, `DiffMap`, `Downloads`) se suscriben al evento y actualizan su contenido de forma independiente.

     Este patrón publicador/suscriptor (Ilustración 55) mantiene los componentes desacoplados: el visor 2D no conoce la existencia del histograma, y un fallo en el visor 3D no afecta al dashboard. Además, facilita la extensión futura con nuevos paneles analíticos, ya que basta con suscribirse a `model-changed`.

Ilustración 55 : Flujo del evento model-changed entre ScenarioSelector y el resto de componentes (autor)

     El listado de inicialización en `main.js` es el siguiente:

1. `initHero()` — renderiza la pantalla de bienvenida.
2. `initScenarioSelector(onChange)` — crea los selectores y registra el callback que emite `model-changed`.
3. `initMapViewer('map-container')` — instancia el visor Cesium.
4. `initDashboard('dashboard')` — prepara el panel de métricas.
5. `initResponseCurves('curves')` — prepara las curvas de respuesta con Plotly.
6. `initDiffMap('diff')` — prepara el mapa de diferencias.
7. `initProbabilityHistogram('histogram')` — prepara el histograma.
8. `initSideBySideComparator('comparator', currentModel)` — instancia los dos viewers sincronizados.
9. `initScene3D('scene3d', currentModel)` — instancia la escena Three.js.
10. `initDownloads('downloads')` — prepara el panel de descargas.

## 6.5.4 Visor geoespacial 2D con CesiumJS

     El visor 2D está implementado en `src/components/MapViewer.js`. Utiliza CesiumJS para mostrar un globo terráqueo virtual sobre el que se superpone el heatmap generado por GEU como una entidad rectangular texturizada.

     Al producirse un evento `model-changed`, el componente realiza los siguientes pasos:

1. Descarga el GeoJSON correspondiente para calcular el bounding box del área de estudio.
2. Vuela la cámara hasta dicho rectángulo con una animación de 1,5 segundos.
3. Crea una entidad `Rectangle` en Cesium con el PNG del heatmap como material, aplicando transparencia y clasificación sobre el terreno.
4. Precarga la imagen en un canvas interno para habilitar el picking de color y probabilidad.

     El usuario puede interactuar con el mapa mediante dos controles superpuestos: un selector de capa base (CartoDB, OSM, ESRI Satellite, etc.), un deslizador de opacidad del heatmap y un interruptor para mostrar u ocultar las ocurrencias de la especie. Cuando el escenario seleccionado es el actual, el visor carga automáticamente el CSV `*_Occurrences.csv` ubicado en la carpeta `current/` y dibuja un punto amarillo por cada coordenada de presencia. Si se cambia a un escenario futuro, las marcas se ocultan, ya que las ocurrencias históricas solo tienen sentido en el contexto del modelo actual.

     Además, al hacer clic sobre el mapa se muestra un tooltip con coordenadas geográficas, elevación del terreno, color del píxel y rango de probabilidad asociado.

     El picking de probabilidad se realiza muestreando el canvas del heatmap. Dado un punto `(lon, lat)` y el bounding box del heatmap, se calculan las coordenadas de píxel `(px, py)` mediante una interpolación lineal:

```
px = (lon - west) / (east - west) * width
py = (north - lat) / (north - south) * height
```

     y posteriormente se clasifica el color RGB con la paleta GEU compartida (`utils/pickerUtils.js`). La Ilustración 56 muestra el visor 2D con el heatmap superpuesto y el tooltip de picking activo.

Ilustración 56 : Visor 2D de TerraPredict con heatmap, capa base ESRI y tooltip de picking (autor)

## 6.5.5 Visor 3D local con Three.js

     El visor 3D, implementado en `src/components/Scene3D.js`, representa el Gemelo Digital local de la zona de estudio. A diferencia del visor 2D, que muestra la Tierra completa, la escena Three.js se centra exclusivamente en el área del DEM cargado.

     El proceso de inicialización consta de tres fases:

1. **Carga del terreno**: `terrainLoader.js` lee `terrain.json` y `terrain.bin` y construye una `PlaneGeometry` cuyos vértices se desplazan verticalmente según la elevación real, aplicando un factor de exageración vertical de 1,8 para mejorar la percepción del relieve.

2. **Aplicación del heatmap**: se genera un segundo mesh que coincide con la geometría del terreno pero utiliza un `ShaderMaterial` personalizado. El shader mezcla dos texturas (`uTex1` y `uTex2`) mediante un factor `uMixRatio` y aplica una curva de atenuación de brillo para evitar que los colores saturados dominen la escena:

```glsl
col.rgb = pow(col.rgb, vec3(1.25)) * 0.8;
```

3. **Carga de nubes de puntos**: mediante `pointCloudLoader.js` se leen archivos PLY generados por GEU. Dado que las nubes pueden contener millones de puntos, se aplica un downsampling adaptativo: se muestra 1 de cada N puntos según el tamaño total, garantizando una tasa de refresco fluida en el navegador.

     El visor 3D ofrece controles de órbita, picking con raycaster (distinguiendo entre click y drag mediante un umbral de píxeles), cuatro modos de textura (heatmap, satélite, hillshade y sólido), animación de serie temporal y, al igual que el visor 2D, un interruptor para mostrar las ocurrencias de la especie en el escenario actual. Cada ocurrencia se representa mediante un cono amarillo situado en la coordenada geográfica correspondiente sobre el terreno DEM.

     La serie temporal permite recorrer automáticamente los escenarios futuros en dos modos: temporal (fijo un SSP, varían los períodos) o de escenarios (fijo un período, varían los SSPs). Las texturas se precargan en un mapa interno y la transición entre ellas utiliza una interpolación suave (`smoothstep`) de duración configurable.

     Finalmente, el visor permite exportar el modelo 3D como GLB. Para ello, clona el terreno, invierte la coordenada V de las UV (igual que en el heatmap overlay) y aplica la textura actual mediante `GLTFExporter` de Three.js.

Ilustración 57 : Visor 3D de TerraPredict con DEM texturizado, nube de puntos y panel de serie temporal (autor)

## 6.5.6 Componentes analíticos: métricas, curvas de respuesta e histograma

     Además de la visualización espacial, TerraPredict incluye tres componentes analíticos orientados a la interpretación del modelo entrenado.

### Dashboard de métricas

     `Dashboard.js` carga el archivo `*_Metrics.json` del escenario actual y representa cada métrica (AUC, Accuracy, TSS, Kappa, Precision, Recall, F1) como una tarjeta con barra de progreso y descripción desplegable. El componente solo muestra métricas para el escenario actual, ya que la validación cruzada se ejecuta únicamente en ese contexto.

### Curvas de respuesta

     `ResponseCurves.js` utiliza Plotly.js para representar las curvas de respuesta exportadas por GEU en el CSV `*_ResponseCurves.csv`. El usuario selecciona una variable bioclimática (BIO1–BIO19) y el componente dibuja la probabilidad de presencia en función del valor de dicha variable. Si el CSV incluye la media de entrenamiento (`MeanReference`), se añade una línea vertical discontinua como referencia.

### Histograma de probabilidad

     `ProbabilityHistogram.js` lee el GeoJSON del escenario seleccionado, extrae la propiedad `probability` de cada punto y construye un histograma de 10 intervalos (0,0–0,1, 0,1–0,2, ..., 0,9–1,0). Cada barra se colorea con la paleta GEU y se superpone una línea vertical en el umbral del modelo, facilitando la interpretación de la distribución de probabilidades.

Ilustración 58 : Panel de análisis con métricas, curvas de respuesta e histograma de probabilidad (autor)

## 6.5.7 Comparativa de escenarios: mapa de diferencias y visor lado a lado

     Para analizar el impacto del cambio climático, TerraPredict ofrece dos vistas comparativas.

### Mapa de diferencias

     `DiffMap.js` muestra el PNG de diferencias generado por GEU (`*_Diferencias.png`), donde el rojo indica pérdida de hábitat, el verde ganancia y el gris estabilidad. El usuario puede seleccionar el período y el SSP de interés mediante dos desplegables. Además, el componente carga el JSON `*_DifferenceTables.json` y renderiza tres tablas: área por umbral, área continua ponderada y balance de hábitat continuo (pérdida, ganancia, estable y cambio neto).

### Comparador lado a lado

     `SideBySideComparator.js` instancia dos viewers de Cesium sincronizados horizontalmente. Cada panel tiene su propio selector de escenario, de modo que el usuario puede comparar, por ejemplo, el escenario actual con un SSP futuro. La sincronización de cámaras se implementa mediante listeners del evento `camera.changed`: cuando se mueve una cámara, la otra adopta la misma posición, orientación y heading.

Ilustración 59 : Comparador lado a lado de TerraPredict con dos escenarios climáticos sincronizados (autor)

## 6.5.8 Panel de descargas

     `Downloads.js` genera dinámicamente una cuadrícula de tarjetas descargables para el escenario seleccionado. Los archivos disponibles son:

- GeoTIFF del heatmap.
- GeoJSON de puntos de predicción.
- PNG del heatmap.
- JSON de métricas (solo escenario actual).
- JSON de configuración (solo escenario actual).
- CSV de curvas de respuesta.
- PNG de diferencias (para el SSP/período derivado del escenario actual o futuro).

     Cada tarjeta es un enlace `<a>` con el atributo `download`, de forma que el navegador inicie la descarga directa del archivo estático correspondiente.

Ilustración 60 : Panel de descargas de TerraPredict con los archivos exportados por GEU (autor)

## 6.5.9 Estilos, responsive y despliegue

     La interfaz utiliza Tailwind CSS 3 con un tema oscuro propio definido en `tailwind.config.js` y `src/style.css`. Se han definido colores semánticos como `terra-bg` (#080c0a), `terra-surface` (#111815), `terra-accent` (#2dd4a0) y `terra-accent-warm` (#fbbf24), que mantienen la coherencia visual con el módulo GEU.

     El diseño es responsive: en escritorio se muestra la barra de navección completa, mientras que en dispositivos móviles se activa un menú hamburguesa. Las secciones utilizan un sistema de cuadrícula (`grid`) que se adapta de una a dos columnas según el ancho de pantalla.

     Para mejorar la experiencia de usuario se han añadido animaciones de entrada (`reveal`) mediante `IntersectionObserver`, scroll suave entre secciones y un panel colapsable con la explicación de los escenarios SSP.

     El despliegue es sencillo gracias a Vite. Ejecutando `npm run build` se genera la carpeta `dist/` con los assets optimizados. Esta carpeta puede publicarse en cualquier servidor web estático (Apache, Nginx, GitHub Pages, Vercel, Netlify, etc.), lo que facilita la difusión de los resultados entre gestores e investigadores.

Ilustración 61 : Vista responsive de TerraPredict en dispositivo móvil (autor)
