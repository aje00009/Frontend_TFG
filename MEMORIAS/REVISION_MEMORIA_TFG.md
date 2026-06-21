# Revisión Crítica — Memoria del TFG

> **Autor:** Alberto Jiménez Expósito  
> **Título TFG:** *Simulación predictiva y visualización de escenarios naturales integrando información multisensorial*  
> **Fecha revisión:** 27 de mayo de 2026  
> **Revisor:** Kimi (asistente técnico)

---

## 1. Resumen ejecutivo de la revisión

Tu memoria tiene una **base sólida**: los capítulos 1–5 están bien estructurados, con buena fundamentación teórica, planificación rigurosa y diseño arquitectónico completo. Sin embargo, presenta **deficiencias estructurales críticas** que deben corregirse antes de la entrega:

| Problema | Severidad | ¿Bloqueante? |
|---|---|---|
| Faltan los capítulos 6 y 7 completos (Implementación y Conclusiones) | **Crítica** | Sí |
| La plataforma web **TerraPredict** no aparece en la memoria del TFG | **Crítica** | Sí |
| Errores de numeración y enlaces rotos en el índice | Media | No, pero queda muy mal |
| Sección 4.2.3 marcada como "PROVISIONAL" | Media | Sí, si se entrega así |
| Los costes tienen numeración inconsistente (3.3.x dentro de 3.4) | Baja | No, pero confunde |
| El capítulo 5 describe diseño pero no justifica decisiones clave de implementación | Media | No |

**Veredicto:** La memoria está aproximadamente al **60% de completitud**. Los capítulos escritos son de buena calidad, pero el TFG no puede entregarse sin los capítulos de implementación, resultados y conclusiones. Además, **debes incluir la plataforma web TerraPredict como parte del trabajo realizado**, ya que es un deliverable funcional que consume los datos del motor GEU y constituye la capa de "visualización" prometida en el título del TFG.

---

## 2. Análisis capítulo por capítulo

### 2.1 Capítulo 1 — Introducción ✅ (Bien)

**Fortalezas:**
- Motivación bien argumentada, con enfoque en cambio climático y gemelos digitales.
- Contexto del problema completo (SDMs, Machine Learning, plataformas colaborativas, CMIP6/SSP).
- Objetivos específicos (O1–O8) claros, medibles y alineados con el desarrollo real.
- Metodología incremental bien justificada.

**Puntos a pulir:**
- En 1.5.3, los incrementos técnicos (i–iv) mencionan "Interfaz de usuario web interactiva". Esto es coherente con TerraPredict, pero **no se menciona en ningún otro lugar de la memoria**.
- Considera acortar ligeramente la motivación si la memoria final supera el límite de páginas.

---

### 2.2 Capítulo 2 — Estado del Arte ✅ (Bien)

**Fortalezas:**
- Fundamentos teóricos de SDMs sólidos (niche de Hutchinson, evolución estadística → ML).
- Comparativa MaxEnt vs RandomForest completa con tabla.
- GDAL, OpenCV, mlpack y librerías de soporte bien descritas.
- Gemelos digitales y visualización 3D bien contextualizados.

**Puntos a pulir:**
- Faltan referencias a tecnologías web geoespaciales (CesiumJS, Three.js) que sí se usan en TerraPredict.
- Añade una subsección 2.3.4 o 2.4 sobre "Visualización web de datos científicos" para justificar el stack de TerraPredict.

---

### 2.3 Capítulo 3 — Planificación y Costes ⚠️ (Revisar)

**Errores estructurales:**
1. **Índice roto:** `3.2.2. Estructura de desglose de trabajo (EDT)` aparece como `¡Error! Marcador`.
2. **Duplicación de título:** `3.2.1` se llama "Gestión y análisis de riesgos" pero ya existe `3.1.3` con el mismo nombre. El `3.2.1` real debería ser "Herramienta de seguimiento (Kanban)" o similar.
3. **Numeración inconsistente de costes:** dentro de `3.4 Estimación de costes`, las subsecciones se numeran `3.3.1`, `3.3.2`, `3.3.3`, `3.3.4` en lugar de `3.4.1`, `3.4.2`, etc.

**Contenido:**
- La EDT está bien desglosada (PT1–PT6).
- El diagrama de Gantt se menciona pero no se ve en el texto extraído (asegúrate de que la figura esté en el PDF final).
- Los costes están bien calculados con amortización.

**Recomendación:** Corrige la numeración y los títulos duplicados antes de entregar.

---

### 2.4 Capítulo 4 — Materiales y Herramientas ⚠️ (Revisar)

**Fortalezas:**
- Zona de estudio (Sierra Mágina / Puerto de la Mata) muy bien descrita con orografía, meteorología y flora.
- GBIF y WorldClim explicados con detalle técnico (incluyendo fórmula de resolución espacial).

**Problemas:**
1. **Sección 4.2.3 "Datos multisensoriales locales (UAV)" está marcada como `//PROVISIONAL`** con apenas dos párrafos. Si finalmente NO usaste datos UAV en el proyecto, **elimina esta sección** y justifica por qué no fueron necesarios (por ejemplo: "se optó por usar datos globales de WorldClim dado que el objetivo era modelar a escala regional, no a escala de parcela"). Si SÍ los usaste, desarrolla la sección.

2. **Falta una sección sobre TerraPredict Web.** En 4.3 debería haber una subsección `4.3.5 Plataforma web de visualización (TerraPredict)` describiendo:
   - Stack tecnológico (Vite, Tailwind, CesiumJS, Three.js, Plotly.js).
   - Propósito: visualizar los exports de GEU de forma interactiva.
   - Relación con GEU: pipeline de datos GEU → exports → web.

3. **En 4.3.4 "Librerías de terceros"** faltan librerías críticas usadas según la memoria técnica: **mlpack**, **PCL**, **PROJ**, **Eigen**, **spdlog**. Aunque algunas se mencionan en el capítulo 2, deben aparecer también en la tabla de herramientas con su versión.

---

### 2.5 Capítulo 5 — Análisis y Diseño ✅ (Bien, con matices)

**Fortalezas:**
- Requisitos funcionales bien catalogados con priorización MoSCoW.
- Requisitos no funcionales concretos (FPS ≥ 30, error < 1m, compilación como .dll).
- Diagrama i-Star con análisis de dependencias.
- Diagrama de casos de uso con actores bien definidos.
- Patrones de diseño justificados (Singleton, Strategy, Facade + GRASP).
- Diagrama de clases, secuencia y máquina de estados completos.

**Puntos a pulir:**
- El diagrama de máquina de estados es excelente conceptualmente, pero **no refleja el estado real del código**. En la memoria técnica se menciona que `SimulationManager` tiene estados, pero la UI usa `runAsync()` con threads. Asegúrate de que el diagrama y la implementación coincidan.
- **Falta el diagrama de la arquitectura web.** Debería haber al menos un diagrama de componentes de TerraPredict mostrando cómo los datos fluyen desde `public/data/` hasta los visores 2D/3D.

---

### 2.6 Capítulo 6 — Implementación ❌ (AUSENTE)

**Este capítulo no existe en tu memoria.** Es el más importante después del diseño. Debe incluir:

**6.1 Implementación del módulo SDM en GEU:**
- Estructura de carpetas (`GEUModules/PrediccionEspecies/`).
- Decisiones de implementación clave:
  - ¿Por qué OpenCV `cv::ml::RTrees` en vez de scikit-learn o TensorFlow?
  - ¿Por qué una aproximación logística L2 para MaxEnt en vez del Java original?
  - ¿Por qué thinning espacial a 1 km?
  - ¿Por qué ensemble con jittering?
  - ¿Por qué se desactivó clamping por defecto?
- Flujo de `runPrediction()` paso a paso.
- Sistema de progreso asíncrono (threads).
- Sistema de localización (`GEU_langs.csv` → `locale_strings.h`).

**6.2 Implementación de TerraPredict Web:**
- Estructura del proyecto (Vite, Tailwind, componentes Vanilla JS).
- Arquitectura de eventos (`model-changed`).
- Visor 2D con CesiumJS (capas base, heatmap overlay, picking).
- Visor 3D con Three.js (DEM, heatmap shader, nubes de puntos PLY).
- Dashboard, curvas de respuesta, histograma, mapa de diferencias.
- Decisiones visuales: atenuación de brillo en 3D, inversión de UVs, z-fighting.

**6.3 Pipeline de integración GEU → TerraPredict:**
- ¿Qué exports genera GEU?
- ¿Cómo se transforman esos datos para la web?
- ¿Cómo se genera `terrain.bin` a partir del DEM?

---

### 2.7 Capítulo 7 — Resultados y Validación ❌ (AUSENTE)

Debe incluir:
- **7.1 Métricas del modelo:** Tabla con AUC, Accuracy, TSS, Kappa, etc. para Pinus uncinata (o la especie que hayas modelado).
- **7.2 Mapas de predicción:** Capturas de pantalla de GEU mostrando el heatmap 2D/3D.
- **7.3 Capturas de TerraPredict:** Visor 2D, visor 3D, dashboard, curvas de respuesta, mapa de diferencias.
- **7.4 Comparativa de escenarios:** Tabla comparativa de áreas (actual vs SSP1-2.6 vs SSP5-8.5).
- **7.5 Rendimiento:** Tiempo de entrenamiento, tiempo de predicción, FPS en GEU, FPS en TerraPredict 3D.
- **7.6 Validación visual:** Comparación del modelo con ortofotos o conocimiento de expertos.

---

### 2.8 Capítulo 8 — Conclusiones y Líneas Futuras ❌ (AUSENTE)

Debe incluir:
- **8.1 Conclusiones:** Revisión de objetivos O1–O8. ¿Cuáles se cumplieron? ¿En qué medida?
- **8.2 Aportaciones del trabajo:** Qué aporta este TFG frente a herramientas existentes.
- **8.3 Limitaciones:** MaxEnt aproximado, resolución 1 km de WorldClim, falta de bias file, ensemble size = 1, etc.
- **8.4 Líneas futuras:** Ensemble real (5–10 modelos), bias file para GBIF, PDA 2D, integración con GEE, más especies, versión móvil, etc.

---

## 3. Comparación con las memorias técnicas

### 3.1 ¿Qué hay en las memorias técnicas que debería estar en la memoria del TFG?

| Contenido (de las memorias técnicas) | ¿Está en el TFG? | Dónde debería ir |
|---|---|---|
| Stack tecnológico completo de GEU (C++17, OpenGL, ImGui, vcpkg) | Parcial (cap. 2 y 4) | 4.3.4 completo |
| Stack tecnológico de TerraPredict (Vite, CesiumJS, Three.js) | **No** | **Nueva sección 4.3.5** |
| Arquitectura del módulo (SimulationManager, ClimateDataHandler, etc.) | Parcial (cap. 5) | 5.3 + 6.1 |
| Flujo completo de predicción (runPrediction detallado) | **No** | **6.1** |
| Algoritmos RF y MaxEnt con hiperparámetros y justificaciones | Parcial (cap. 2) | 6.1 |
| Curvas de respuesta (cálculo y visualización) | **No** | **6.1** |
| Sistema de progreso asíncrono | **No** | **6.1** |
| Sistema de localización (LocaleStrings) | **No** | **6.1** |
| Exportación multiformato (GeoTIFF, GeoJSON, CSV, PNG, JSON, PLY) | **No** | **6.1** |
| Pipeline de datos GEU → TerraPredict | **No** | **6.3** |
| Atenuación de brillo en 3D, inversión UVs, z-fighting | **No** | **6.2** |
| Shader del heatmap en Three.js | **No** | **6.2** |
| Picking y detección de drag en 3D | **No** | **6.2** |
| Decisiones de diseño y justificaciones (sección 13 de memoria técnica) | **No** | **6.1** |
| Limitaciones conocidas y futuras | **No** | **8.3 y 8.4** |

### 3.2 Conclusión de la comparación

**La memoria del TFG es demasiado "alta" (diseño) y le falta lo "bajo" (implementación).** Las memorias técnicas que generamos contienen un nivel de detalle excelente que deberías trasladar al capítulo 6, adaptándolo al tono y formato de una memoria académica.

---

## 4. Reestructuración propuesta

### Opción A: Índice final recomendado (8 capítulos)

Esta estructura mantiene la coherencia con lo ya escrito y añade lo que falta:

```
1. INTRODUCCIÓN
   1.1 Motivación
   1.2 Contexto del problema y antecedentes
       1.2.1 Evolución y fundamentos de los SDM
       1.2.2 Tipos de datos y el desafío de la observación
       1.2.3 La transición hacia el Machine Learning
       1.2.4 Plataformas y sistemas colaborativos
       1.2.5 Marcos de proyección climática: CMIP6 y escenarios SSP
   1.3 Planteamiento del problema
       1.3.1 Limitaciones de los SIG tradicionales
       1.3.2 Solución al problema
   1.4 Objetivos
       1.4.1 Objetivo general
       1.4.2 Objetivos específicos
   1.5 Metodología de trabajo
       1.5.1 Evolución y contexto de las metodologías de trabajo
       1.5.2 Comparativa de metodologías
       1.5.3 Descripción de las fases del proyecto
   1.6 Estructura de la memoria

2. ESTADO DEL ARTE
   2.1 Modelos de distribución de especies (SDMs)
       2.1.1 Definición y fundamentos teóricos
       2.1.2 Evolución: de la estadística al Machine Learning
       2.1.3 MaxEnt vs RandomForest: análisis comparativo
       2.1.4 Otros algoritmos y enfoques relacionados
   2.2 Herramientas geoespaciales en C++
       2.2.1 GDAL
       2.2.2 OpenCV
       2.2.3 Librerías de Machine Learning en C++
       2.2.4 Otras librerías de soporte técnico
   2.3 Visualización 3D de datos científicos
       2.3.1 Gemelos digitales y realismo geográfico
       2.3.2 Renderizado de información predictiva
       2.3.3 Interactividad y tiempo real
   2.4 Visualización web de datos geoespaciales  ← NUEVO
       2.4.1 CesiumJS y globos terráqueos virtuales
       2.4.2 Three.js y renderizado 3D en navegador
       2.4.3 Aplicaciones web de ciencia ciudadana

3. PLANIFICACIÓN Y COSTES
   3.1 Marco metodológico y gestión del proyecto
       3.1.1 Gestión del ciclo de vida y herramientas ALM
       3.1.2 Justificación desde la Ingeniería del Software
       3.1.3 Gestión y análisis de riesgos
   3.2 Identificación de tareas y roles
       3.2.1 Herramienta de seguimiento (Kanban)
       3.2.2 Estructura de desglose de trabajo (EDT)
   3.3 Planificación temporal
       3.3.1 Calendario de hitos
       3.3.2 Diagrama de Gantt
   3.4 Estimación de costes
       3.4.1 Costes de recursos humanos
       3.4.2 Costes de hardware
       3.4.3 Costes de software
       3.4.4 Costes totales

4. MATERIALES Y HERRAMIENTAS
   4.1 Zona de estudio: Sierra Mágina y Puerto de la Mata
   4.2 Fuentes de datos
       4.2.1 GBIF
       4.2.2 WorldClim
       4.2.3 Datos multisensoriales locales (UAV)  [o eliminar]
   4.3 Entorno de desarrollo
       4.3.1 Lenguaje y entorno de programación (IDE)
       4.3.2 Arquitectura base: motor GEU
       4.3.3 Integración del módulo de simulación
       4.3.4 Librerías de terceros (GEU)
       4.3.5 Plataforma web de visualización: TerraPredict  ← NUEVO
   4.4 Hardware de desarrollo  [opcional, si cabe]

5. ANÁLISIS Y DISEÑO DEL SISTEMA
   5.1 Ingeniería de requisitos
       5.1.1 Identificación de actores
       5.1.2 Catálogo de requisitos funcionales (RF)
       5.1.3 Catálogo de requisitos no funcionales (RNF)
   5.2 Modelado de objetivos y funcionalidad
       5.2.1 Modelo de dependencias estratégicas (i-Star)
       5.2.2 Diagrama de casos de uso (UML)
   5.3 Arquitectura del sistema
       5.3.1 Diagrama de componentes (GEU + TerraPredict)
       5.3.2 Patrones de diseño aplicados y asignación de responsabilidades
   5.4 Diseño detallado
       5.4.1 Diseño estructural (Diagrama de Clases)
       5.4.2 Diseño de comportamiento (Diagrama de Secuencia)
       5.4.3 Diseño del ciclo de vida (Diagrama de Máquina de Estados)
       5.4.4 Diseño de la arquitectura web (Diagrama de Componentes)  ← NUEVO

6. IMPLEMENTACIÓN  ← NUEVO CAPÍTULO COMPLETO
   6.1 Módulo de Predicción de Especies (GEU)
       6.1.1 Estructura del código fuente
       6.1.2 Pipeline de predicción: de los datos al modelo
       6.1.3 Algoritmo Random Forest: hiperparámetros y calibración
       6.1.4 Algoritmo MaxEnt: regresión logística L2 con features cuadráticas
       6.1.5 Curvas de respuesta: cálculo del perfil de nicho ecológico
       6.1.6 Sistema de progreso asíncrono y concurrencia
       6.1.7 Sistema de localización e internacionalización
       6.1.8 Exportación multiformato: GeoTIFF, GeoJSON, CSV, PNG, JSON, PLY
   6.2 Plataforma web TerraPredict
       6.2.1 Arquitectura de la SPA y contrato de eventos
       6.2.2 Visor geoespacial 2D con CesiumJS
       6.2.3 Visor tridimensional con Three.js
       6.2.4 Dashboard de métricas y curvas de respuesta
       6.2.5 Mapa de diferencias y comparador de escenarios
   6.3 Pipeline de datos: de GEU a TerraPredict
       6.3.1 Formato de exports del motor
       6.3.2 Preprocesamiento del terreno para la web
       6.3.3 Catálogo dinámico de especies y escenarios

7. RESULTADOS Y VALIDACIÓN  ← NUEVO CAPÍTULO COMPLETO
   7.1 Métricas de rendimiento del modelo
   7.2 Mapas de predicción: actual y escenarios futuros
   7.3 Visualización en TerraPredict: capturas y análisis
   7.4 Comparativa de escenarios: áreas de hábitat
   7.5 Rendimiento computacional y tiempos de ejecución
   7.6 Validación visual y análisis de expertos

8. CONCLUSIONES Y LÍNEAS FUTURAS  ← NUEVO CAPÍTULO COMPLETO
   8.1 Cumplimiento de objetivos
   8.2 Aportaciones del trabajo
   8.3 Limitaciones del sistema
   8.4 Líneas de trabajo futuro

REFERENCIAS BIBLIOGRÁFICAS
ANEXOS
```

---

## 5. Checklist de acciones inmediatas

### Antes de continuar escribiendo:
- [ ] **Decidir si usaste datos UAV.** Si no, elimina 4.2.3 y justifica. Si sí, desarrolla.
- [ ] **Corregir numeración del capítulo 3:** 3.2.1 (Kanban), 3.2.2 (EDT), 3.4.x (costes).
- [ ] **Arreglar el índice** para que no aparezca "¡Error! Marcador".

### Contenido nuevo obligatorio:
- [ ] **Escribir sección 4.3.5** sobre TerraPredict (stack, propósito, relación con GEU).
- [ ] **Añadir diagrama de componentes web** en 5.3 o 5.4.4.
- [ ] **Escribir capítulo 6 completo** (GEU + TerraPredict + pipeline). Usa la memoria técnica como base pero adapta el tono académico.
- [ ] **Escribir capítulo 7 completo** con capturas de pantalla, tablas de métricas y comparativas.
- [ ] **Escribir capítulo 8 completo** con conclusiones y líneas futuras.

### Material gráfico necesario:
- [ ] Capturas de pantalla de GEU (entrenamiento, predicción, heatmap 2D, heatmap 3D, curvas de respuesta).
- [ ] Capturas de pantalla de TerraPredict (visor 2D, visor 3D, dashboard, diff, comparador).
- [ ] Diagrama de arquitectura web (componentes de TerraPredict).
- [ ] Tabla comparativa de métricas por escenario.
- [ ] Tabla comparativa de áreas (actual vs futuros).

---

## 6. Consejos de estilo para la redacción de los capítulos nuevos

### Capítulo 6 — Implementación
- **No pongas código fuente completo.** Extrae los fragmentos más ilustrativos (10–15 líneas máximo) y descríbelos.
- **Justifica cada decisión técnica.** No digas "se usó RF", di "se optó por Random Forest mediante `cv::ml::RTrees` porque OpenCV ya era dependencia de GEU, evitando integrar mlpack adicional y garantizando compatibilidad de compilación con MSVC 2022".
- **Usa tablas para hiperparámetros y configuraciones.** Son más legibles que párrafos.
- **Incluye diagramas de flujo simplificados** para el pipeline de predicción y la arquitectura de eventos de TerraPredict.

### Capítulo 7 — Resultados
- **Sé honesto con las métricas.** Si AUC = 0.65, dilo. Explica por qué puede ser bajo (pocos datos, alta variabilidad climática).
- **Usa figuras con leyendas descriptivas.** Cada captura debe tener título, fuente y breve interpretación.
- **Compara escenarios visualmente.** Una figura lado a lado (actual vs SSP5-8.5) tiene más impacto que dos separadas.

### Capítulo 8 — Conclusiones
- **Mapea cada objetivo (O1–O8) a una conclusión.** "O1 (Investigación): Se ha completado satisfactoriamente mediante la revisión de 25 referencias bibliográficas..."
- **Las limitaciones no son fracasos.** Son oportunidades de mejora. Frámalas como "El sistema actual no implementa X debido a restricciones temporales, pero la arquitectura está preparada para ello mediante Y".

---

*Fin de la revisión. Si necesitas que desarrolle alguna sección concreta (por ejemplo, redactar el capítulo 6 completo o una subsección específica), indícamelo.*
