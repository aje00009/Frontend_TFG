# Secciones TerraPredict — Listas para copiar en la memoria del TFG

> Contenido redactado para integrarse directamente en los capítulos 2, 4 y 5 de la memoria.

---

## 2.4 Visualización web de datos geoespaciales

*(Insertar después de 2.3.3 y antes del cierre del capítulo 2)*

La proliferación de datos geoespaciales de alta resolución ha impulsado el desarrollo de tecnologías web capaces de representar información geográfica compleja directamente en el navegador, sin necesidad de instalar software de escritorio. Esta capacidad resulta especialmente relevante en el ámbito de la divulgación científica y la toma de decisiones ambientales, donde los resultados de modelos predictivos deben ser accesibles para gestores, investigadores y público general. A continuación, se describen las tecnologías web seleccionadas para la capa de visualización de este trabajo.

### 2.4.1 CesiumJS y globos terráqueos virtuales

CesiumJS es una biblioteca de código abierto basada en WebGL que permite la visualización de datos geoespaciales en un globo terráqueo virtual tridimensional [63]. A diferencia de los visores de mapas tradicionales en dos dimensiones, CesiumJS representa la Tierra como un elipsoide geodésico, lo que garantiza una precisión cartográfica correcta a cualquier escala. Entre sus características más destacadas se encuentran:

- **Renderizado de imágenes satelitales y capas ráster**: permite superponer ortofotos, mapas de calor y modelos digitales del terreno (MDT) sobre la superficie del globo.
- **Soporte nativo para GeoJSON, KML y CZML**: posibilita la carga de datos vectoriales con atributos asociados, esenciales para representar puntos de predicción y sus probabilidades.
- **Navegación interactiva**: zoom, rotación, inclinación y vuelo animado entre ubicaciones.
- **Terrain provider**: integración con Cesium World Terrain o datos propios para representar el relieve real.

En el contexto de este proyecto, CesiumJS se ha elegido como motor del visor geoespacial 2D/2.5D de TerraPredict porque permite representar de forma inmediata los archivos GeoJSON y PNG generados por GEU, sin requerir preprocesamiento adicional en servidor.

### 2.4.2 Three.js y renderizado 3D en navegador

Three.js es una biblioteca JavaScript de alto nivel que abstrae la API WebGL para facilitar la creación de escenas tridimensionales interactivas directamente en el navegador [64]. Si bien CesiumJS ofrece un globo completo, Three.js resulta más adecuado cuando se desea un control exhaustivo sobre una escena 3D localizada, como es el caso del modelo de terreno de Sierra Mágina generado a partir del MDT.

Las capacidades de Three.js empleadas en este trabajo incluyen:

- **Geometría personalizada**: generación de mallas a partir de datos DEM mediante `PlaneGeometry` con vértices desplazados por elevación.
- **Shaders personalizados**: uso de `ShaderMaterial` para aplicar texturas de heatmap con transiciones suaves entre escenarios y atenuación de brillo en colores saturados.
- **Nubes de puntos**: renderizado eficiente de grandes volúmenes de puntos PLY mediante `THREE.Points` con colores por vértice.
- **Controles de cámara**: `OrbitControls` para navegación orbital alrededor del modelo.
- **Post-procesado y tone mapping**: `ACESFilmicToneMapping` para una reproducción de color más realista y controlada.

La combinación de CesiumJS (contexto geográfico global) y Three.js (visualización detallada del terreno local) ofrece una experiencia híbrida que cubre tanto el análisis cartográfico como la exploración inmersiva del área de estudio.

### 2.4.3 Aplicaciones web de ciencia ciudadana y divulgación

Las plataformas web interactivas han demostrado ser vehículos efectivos para la comunicación de resultados científicos a audiencias no especializadas. Herramientas como BioModelos [7] o Google Earth Engine [6] combinan datos abiertos con interfaces accesibles, permitiendo que investigadores, gestores y ciudadanos exploren escenarios complejos sin conocimientos técnicos avanzados.

En este TFG, la capa web TerraPredict persigue un objetivo dual:

1. **Análisis técnico**: proporcionar a los investigadores gráficos de métricas, curvas de respuesta, histogramas y comparativas de escenarios que faciliten la interpretación de los modelos entrenados.
2. **Divulgación y comunicación**: ofrecer una visualización inmersiva del cambio climático sobre un ecosistema real (Sierra Mágina), transformando resultados numéricos en evidencia visual comprensible.

La elección de un stack exclusivamente frontend (HTML5, CSS3, JavaScript ES Modules) responde a la necesidad de desplegar la aplicación en cualquier servidor web estático, eliminando dependencias de backend y facilitando su distribución entre los stakeholders del proyecto.

---

## 4.3.5 Plataforma web de visualización: TerraPredict

*(Insertar después de 4.3.4 y antes del cierre del capítulo 4)*

Además del motor de procesamiento GEU, este proyecto contempla el desarrollo de una aplicación web independiente denominada **TerraPredict**, cuya función es visualizar e interactuar con los resultados espaciales exportados por el módulo de Predicción de Especies. TerraPredict no realiza cálculos de Machine Learning; su propósito es servir como capa de presentación y análisis visual de los datos generados en GEU.

### Stack tecnológico

La plataforma se ha desarrollado como una **Single Page Application (SPA)** utilizando las siguientes tecnologías:

| Capa | Tecnología | Función |
|---|---|---|
| Bundler y servidor de desarrollo | Vite 5 | Empaquetado de módulos ES6, recarga en caliente y optimización de build |
| Estilos | Tailwind CSS 3 + PostCSS | Framework de utilidades CSS para diseño responsive y tema oscuro |
| Lógica de aplicación | Vanilla JavaScript (ES Modules) | Gestión de estado, eventos y componentes sin dependencia de frameworks de UI |
| Visor geoespacial 2D | CesiumJS 1.118 | Globo terráqueo virtual con capas de heatmap, GeoJSON y terrain provider |
| Visor 3D local | Three.js 0.184 | Escena tridimensional del DEM texturizado con heatmap y nubes de puntos PLY |
| Gráficos analíticos | Plotly.js 2.33 | Curvas de respuesta e histogramas de probabilidad interactivos |
| Parseo de CSV | PapaParse 5.4 | Lectura del archivo de curvas de respuesta exportado por GEU |

### Arquitectura general

TerraPredict consume exclusivamente archivos estáticos ubicados en la carpeta `public/data/` del proyecto. Estos archivos son los mismos que GEU exporta tras ejecutar una simulación:

- `*_Actual.geojson` y `*_SSP_Periodo.geojson`: puntos de predicción con propiedades (probabilidad, especie, escenario, métricas).
- `*_Actual.png` y `*_SSP_Periodo.png`: mapas de calor RGB con la paleta de probabilidad GEU.
- `*_Actual.tif`: raster GeoTIFF para análisis en GIS externos.
- `*_ResponseCurves.csv`: curvas de respuesta de cada variable bioclimática.
- `*_Metrics.json`: métricas de rendimiento del modelo.
- `*_Config.json`: configuración del modelo (hiperparámetros, variables seleccionadas).
- `*_Diferencias.png`: mapa visual de pérdida/ganancia de hábitat.
- `*.ply`: nubes de puntos 3D para el visor tridimensional.
- `terrain.json` + `terrain.bin`: modelo digital del terreno preprocesado para Three.js.

El desacoplamiento entre GEU (procesamiento) y TerraPredict (visualización) permite que ambos sistemas evolucionen de forma independiente. GEU genera los archivos una sola vez; TerraPredict los lee dinámicamente mediante `fetch()` y los presenta al usuario sin requerir conexión con el motor.

### Funcionalidades principales

TerraPredict se organiza en una única página con secciones diferenciadas mediante anclas:

1. **Hero / presentación**: introducción al proyecto sin necesidad de conocimientos técnicos previos.
2. **Visor geoespacial**: alternancia entre modo 2D (CesiumJS) y modo 3D (Three.js), con selector de especie, algoritmo, período y escenario climático.
3. **Análisis del modelo**: dashboard de métricas, curvas de respuesta interactivas con Plotly e histograma de probabilidad.
4. **Cambio climático**: mapa de diferencias futuro vs actual y comparador lado a lado de escenarios.
5. **Descargas**: enlaces directos a todos los archivos exportados por GEU.

### Despliegue

Al tratarse de una aplicación 100% estática, TerraPredict puede desplegarse en cualquier servidor web (Apache, Nginx, GitHub Pages, Vercel, Netlify). El build de producción se genera ejecutando `npm run build`, que produce una carpeta `dist/` lista para publicar. Esta simplicidad de despliegue es una ventaja clave para la divulgación de resultados entre los agentes implicados en la gestión de Sierra Mágina.

---

## 5.4.4 Diseño de la arquitectura web

*(Insertar después de 5.4.3 y antes del cierre del capítulo 5)*

Como se ha introducido en el apartado 4.3.5, TerraPredict constituye la capa de presentación del sistema. Aunque no procesa datos, su diseño arquitectónico requiere una organización clara que permita gestionar múltiples visualizaciones sincronizadas a partir de un único estado de modelo seleccionado.

### Descripción del diagrama de componentes web

La arquitectura de TerraPredict sigue un patrón de componentes desacoplados comunicados mediante eventos personalizados. El diagrama de componentes (Ilustración X) representa los elementos siguientes:

**1. Contenedor principal (`index.html`)**
- Estructura semántica de la SPA con secciones: Hero, Visor, Análisis, Cambio Climático, Descargas.
- Incluye los contenedores DOM sobre los que se montan los componentes JavaScript.

**2. Punto de entrada (`main.js`)**
- Orquesta la inicialización de todos los componentes.
- Gestiona el modo 2D/3D, la exportación de PNG/GLB, el menú móvil y las animaciones de scroll.

**3. Selector de escenario (`ScenarioSelector.js`)**
- Carga el catálogo dinámico (`data/species/index.json`).
- Renderiza cuatro selects en cascada: Especie → Algoritmo → Período → Escenario.
- Emite el evento `model-changed` con el objeto de modelo seleccionado.

**4. Visor 2D (`MapViewer.js`)**
- Instancia de `Cesium.Viewer`.
- Escucha `model-changed` para cargar el GeoJSON y el PNG de heatmap del escenario seleccionado.
- Proporciona picking (coordenadas, elevación, probabilidad) y selector de capa base.

**5. Visor 3D (`Scene3D.js`)**
- Escena Three.js con DEM (`terrain.json` + `terrain.bin`), heatmap texturizado y nube de puntos PLY.
- Incluye controles de órbita, picking con raycaster, transiciones entre texturas y exportación GLB.

**6. Componentes analíticos**
- `Dashboard.js`: métricas del modelo desde `*_Metrics.json`.
- `ResponseCurves.js`: gráficas Plotly a partir de `*_ResponseCurves.csv`.
- `ProbabilityHistogram.js`: histograma de distribución de probabilidades a partir del GeoJSON.

**7. Componentes comparativos**
- `DiffMap.js`: muestra el PNG de diferencias y tablas de áreas.
- `SideBySideComparator.js`: dos instancias de Cesium sincronizadas para comparar escenarios.

**8. Utilidades compartidas (`utils/`)**
- `config.js`: carga del catálogo y resolución de rutas dinámicas.
- `pickerUtils.js`: funciones de picking, leyendas y paleta GEU compartidas entre 2D y 3D.
- `terrainLoader.js`, `pointCloudLoader.js`, `dataLoader.js`: carga de DEM, nubes de puntos y datos tabulares.

### Contrato de comunicación: evento `model-changed`

El mecanismo de comunicación entre componentes es un único `CustomEvent` denominado `model-changed`, disparado sobre el objeto `window`. Su payload contiene:

```json
{
  "species":    { "id": "Pinus_uncinata", "label": "Pinus uncinata" },
  "algorithm":  { "id": "Random_Forest", "label": "Random Forest", ... },
  "period":     { "id": "2081_2100", "label": "2081-2100" },
  "scenario":   { "id": "ssp585_2081_2100", "label": "SSP5-8.5 (2081-2100)", ... },
  "paths":      { "geojson": "...", "png": "...", "tif": "...", "metrics": "...", "config": "..." }
}
```

Cada componente implementa su propio listener de `model-changed` y decide si debe recargar sus datos. Esta decisión de diseño evita el acoplamiento directo entre componentes: el visor 2D no conoce la existencia del histograma, y viceversa.

### Diagrama de secuencia típico: cambio de escenario

El flujo de interacción más frecuente es el cambio de escenario por parte del usuario:

1. El usuario selecciona un nuevo escenario en `ScenarioSelector.js`.
2. `ScenarioSelector` construye el objeto de modelo y dispara `model-changed`.
3. `MapViewer` recibe el evento, elimina la capa anterior y carga el nuevo GeoJSON + PNG en Cesium.
4. `Scene3D` recibe el evento, precarga la textura y ejecuta una transición suave entre el heatmap anterior y el nuevo.
5. `Dashboard` carga el `Metrics.json` correspondiente (si el escenario es "actual").
6. `ResponseCurves`, `ProbabilityHistogram`, `DiffMap` y `Downloads` actualizan su contenido.
7. Todos los componentes permanecen sincronizados con el mismo escenario sin comunicación directa entre ellos.

Este patrón publicador/suscriptor (Publisher-Subscriber) simplifica la incorporación de nuevos componentes visuales en futuras versiones de TerraPredict.

### Justificación del diseño

- **Desacoplamiento**: cada componente es autónomo. Un fallo en el visor 3D no afecta al dashboard.
- **Escalabilidad**: añadir un nuevo gráfico analítico solo requiere suscribirse a `model-changed`.
- **Reutilización**: el mismo evento y payload se usan en todos los componentes.
- **Mantenibilidad**: los cambios en un componente no propagan efectos secundarios al resto.

---

## Anexo: Cómo crear el Diagrama de Componentes de TerraPredict en Visual Paradigm

A continuación se detallan los pasos para reproducir el diagrama de componentes de la arquitectura web en Visual Paradigm, de forma coherente con los diagramas UML ya incluidos en la memoria.

### Paso 1: Crear un nuevo diagrama
1. Abre Visual Paradigm y carga tu proyecto `TFG.vpp`.
2. En el explorador de diagramas, haz clic derecho sobre el modelo donde deseas añadirlo (por ejemplo, dentro de la carpeta "Diseño").
3. Selecciona **New Diagram** → **UML Diagrams** → **Component Diagram**.
4. Asigna un nombre: `Diagrama de Componentes - Arquitectura Web TerraPredict`.

### Paso 2: Añadir el componente contenedor principal
1. Arrastra un **Component** desde la barra de herramientas al lienzo.
2. Cambia su nombre a **`TerraPredict SPA`**.
3. Haz doble clic en el componente y marca la opción **Draw as stereotype icon** si deseas que se vea como una caja con dos pequeños rectángulos sobresaliendo a la izquierda (icono estándar UML de componente).

### Paso 3: Añadir los subsistemas principales (componentes anidados)
Dentro del componente `TerraPredict SPA`, añade los siguientes componentes (puedes arrastrarlos dentro del componente padre para que queden anidados):

| Componente | Nombre en el diagrama | Responsabilidad breve |
|---|---|---|
| `main.js` | `Bootstrap (main.js)` | Inicialización y orquestación |
| `ScenarioSelector.js` | `ScenarioSelector` | Selector de especie/algoritmo/escenario |
| `MapViewer.js` | `Visor 2D (CesiumJS)` | Mapa global con heatmap |
| `Scene3D.js` | `Visor 3D (Three.js)` | Terreno DEM + heatmap 3D + PLY |
| `Dashboard.js` | `Dashboard de Métricas` | Métricas del modelo |
| `ResponseCurves.js` | `Curvas de Respuesta` | Gráficas Plotly |
| `ProbabilityHistogram.js` | `Histograma de Probabilidad` | Distribución de probabilidades |
| `DiffMap.js` | `Mapa de Diferencias` | Pérdida/ganancia de hábitat |
| `SideBySideComparator.js` | `Comparador Lado a Lado` | Dos mapas Cesium sincronizados |
| `Downloads.js` | `Panel de Descargas` | Enlaces a archivos exportados |

### Paso 4: Añadir los componentes de utilidades
Fuera o dentro del contenedor principal (según prefieras), añade un paquete o componente llamado **`Utilidades Compartidas`** que contenga:

- `config.js` (resolución de rutas)
- `pickerUtils.js` (picking y leyendas)
- `terrainLoader.js` (carga DEM)
- `pointCloudLoader.js` (carga PLY)
- `dataLoader.js` (JSON/CSV)

Conecta cada componente visual que lo necesite con una línea de dependencia hacia estas utilidades.

### Paso 5: Añadir la fuente de datos externa
1. Arrastra un **Artifact** o un **Component** estereotipado como `<<File>>`.
2. Nómbralo **`Archivos exportados por GEU`**.
3. Dentro, lista los archivos: GeoJSON, PNG, CSV, JSON, PLY, terrain.bin.
4. Dibuja líneas de dependencia desde este artifact hacia `MapViewer`, `Scene3D`, `Dashboard`, `ResponseCurves`, `DiffMap` y `Downloads` para indicar que todos consumen estos datos.

### Paso 6: Representar el evento `model-changed`
1. Crea una **Interface** (pequeño círculo con semicírculo) y nómbrala **`model-changed`**.
2. Colócala en el centro del diagrama.
3. Dibuja líneas de realización/provisión desde `ScenarioSelector` hacia la interfaz (ScenarioSelector la "emite").
4. Dibuja líneas de uso/dependencia desde todos los demás componentes hacia la interfaz (los demás la "escuchan").
5. Opcionalmente, añade una nota (Note) adjunta con el payload del evento (species, algorithm, period, scenario, paths).

### Paso 7: Estilizar el diagrama
1. Usa colores consistentes con los diagramas anteriores de tu memoria:
   - Azul oscuro para componentes de GEU/backend.
   - Verde para componentes de TerraPredict/frontend.
   - Gris para utilidades compartidas.
   - Naranja para interfaces/eventos.
2. Agrupa los componentes analíticos con un **Package** llamado `Componentes Analíticos`.
3. Agrupa los visores dentro de un paquete `Visualización`.
4. Asegúrate de que las etiquetas sean legibles y no se solapen.

### Paso 8: Exportar
1. Ve a **File** → **Export** → **Active Diagram as Image**.
2. Elige formato PNG o SVG (SVG es mejor para imprimir sin pérdida de calidad).
3. Guarda en la carpeta de figuras de tu memoria.
4. Inserta en el documento con la leyenda: *"Ilustración X : Diagrama de componentes de la arquitectura web TerraPredict (autor)"*.

### Esquema visual de referencia (textual)

```
+-------------------------------------------------------------+
|                    TerraPredict SPA                         |
|  +-----------------+       +-------------------------+      |
|  | ScenarioSelector|------>|    model-changed        |      |
|  |   (emisor)      |       |    (interfaz/evento)    |      |
|  +-----------------+       +------------+------------+      |
|                                         |                   |
|        +----------------+----------------+----------+       |
|        |                |                |          |       |
|   +----v----+     +-----v-----+    +-----v----+   +v------v+|
|   |Visor 2D |     | Visor 3D  |    | Dashboard|   |Curvas | |
|   |CesiumJS |     | Three.js  |    | Métricas |   |Resp.  | |
|   +---------+     +-----------+    +----------+   +-------+ |
|        |                |                |          |       |
|        +----------------+----------------+----------+       |
|                         |                                   |
|                  +------v-------+                           |
|                  | Utilidades   |                           |
|                  | Compartidas  |                           |
|                  +--------------+                           |
+-------------------------------------------------------------+
            |
            | consume
            v
+-------------------------------------------------------------+
|         Archivos exportados por GEU                         |
|  GeoJSON | PNG heatmap | CSV | JSON | PLY | terrain.bin     |
+-------------------------------------------------------------+
```

---

## Referencias a añadir en la bibliografía

Si aún no las tienes, añade estas referencias al final de tu memoria:

```
[63] "CesiumJS", Cesium. Accedido: 3 de junio de 2026. [En línea]. Disponible en: https://cesium.com/platform/cesiumjs/

[64] "Three.js — JavaScript 3D Library". Accedido: 3 de junio de 2026. [En línea]. Disponible en: https://threejs.org/

[65] "Separation of Concerns", MDN Web Docs. Accedido: 3 de junio de 2026. [En línea]. Disponible en: https://developer.mozilla.org/en-US/docs/Glossary/Separation_of_concerns

[66] R. C. Martin, "The Single Responsibility Principle", en Agile Software Development, Principles, Patterns, and Practices, Prentice Hall, 2002.
```

*(Nota: Si ya tienes asignados los números [63] y [64] a otras referencias, ajusta la numeración para mantener la secuencia. Lo importante es que las referencias de CesiumJS y Three.js aparezcan citadas en el texto.)*
