# Revisión Corregida — Memoria del TFG (V2)

> **Archivo revisado:** `FRONT/MEMORIAS/Memoria_TFG_V2.pdf` (83 páginas, 2429 líneas de texto)  
> **Fecha:** 27 de mayo de 2026  

---

## 1. Verificación factual del documento

He extraído el texto completo del PDF con `pdftotext` y confirmo lo siguiente:

| Verificación | Resultado |
|---|---|
| **Capítulos presentes** | 1 (Intro), 2 (Estado del Arte), 3 (Planificación), 4 (Materiales), 5 (Análisis y Diseño) |
| **Capítulos ausentes** | 6 (Implementación), 7 (Resultados), 8 (Conclusiones) |
| **TerraPredict mencionada** | ✅ Sí, 12 veces |
| **TerraPredict con sección propia** | ❌ No |
| **Capítulo de implementación de GEU** | ❌ No existe |
| **Capítulo de implementación de TerraPredict** | ❌ No existe |
| **Resultados / métricas / capturas** | ❌ No existen |
| **Conclusiones y líneas futuras** | ❌ No existen |

**Conclusión inicial:** Mi revisión anterior tenía un error: **TerraPredict no está ausente, pero está subdesarrollada**. Solo aparece como referencias en la planificación (EDT, hitos) y en el diseño (requisitos, arquitectura), pero le falta todo el cuerpo de implementación, resultados y conclusiones.

---

## 2. Dónde aparece TerraPredict en el documento actual

He localizado las 12 apariciones de "TerraPredict" en el PDF:

| Ubicación | Contexto | Estado |
|---|---|---|
| **3.2 (EDT), T4.5** | "Subsistema frontend web: desarrollo de la plataforma TerraPredict (Vite/VanillaJS), integración del visor global (CesiumJS), gemelo digital local (Three.js) y gráficos analíticos (Plotly)." | ✅ Bien planificado |
| **3.3.1, Hito 3 (M3)** | "Despliegue de la plataforma web interactiva (TerraPredict) e integración visual del Gemelo Digital 3D" | ✅ Bien planificado |
| **4.3** | "Frontend (Visual Studio Code): la herramienta web (TerraPredict) se ha desarrollado utilizando JavaScript/TypeScript y herramientas de empaquetado (Vite)." | ✅ Mencionado |
| **5.1.1, ACT-02** | "Usuario final (frontend): es el usuario de la plataforma web TerraPredict." | ✅ Correcto |
| **5.1.2, Bloque 3 RF** | "Visualización e interfaz web (Frontend TerraPredict)" con RF-08 a RF-11 | ✅ Bien definido |
| **5.1.3, RNF** | RNF-02 (rendimiento frontend WebGL), RNF-04 (usabilidad TerraPredict) | ✅ Correcto |
| **5.2.1, i-Star** | "TerraPredict depende directamente de GEU para la obtención de recursos finales" | ✅ Correcto |
| **5.3** | "Diseño basado en dos capas (motor de procesamiento: GEU / aplicación web interactiva: TerraPredict)" | ✅ Correcto |
| **5.3.1, Diagrama de componentes** | "TerraPredict: actúa como la capa de presentación de la información. Consume los archivos generados por GEU." | ✅ Correcto |

**Veredicto:** La planificación y el diseño contemplan a TerraPredict correctamente como segunda capa del sistema. El problema es que **no hay contenido que materialice esa planificación**.

---

## 3. Errores y carencias confirmados

### 🔴 Críticos (bloqueantes para entrega)

| # | Problema | Evidencia en PDF | Qué hacer |
|---|---|---|---|
| 1 | **No existe Capítulo 6 (Implementación)** | El índice del PDF termina en 5.4.3 (Diagrama de Máquina de Estados) y pasa a Referencias. No hay capítulo 6. | Escribir capítulo 6 completo |
| 2 | **No existe Capítulo 7 (Resultados)** | No aparece en el índice ni en el cuerpo. | Escribir capítulo 7 completo |
| 3 | **No existe Capítulo 8 (Conclusiones)** | No aparece en el índice ni en el cuerpo. | Escribir capítulo 8 completo |
| 4 | **TerraPredict no tiene sección en Materiales** | En el índice, 4.3 tiene 4 subsecciones (4.3.1 a 4.3.4). No hay 4.3.5. | Añadir 4.3.5 sobre TerraPredict |
| 5 | **TerraPredict no tiene diagrama propio** | El diagrama de componentes (Ilustración 32) muestra GEU + TerraPredict + Capa de interoperabilidad, pero no hay diagrama de secuencia ni clases del frontend. | Añadir diagramas de TerraPredict |

### 🟡 Errores estructurales (quedan mal, pero no bloquean)

| # | Problema | Evidencia | Qué hacer |
|---|---|---|---|
| 6 | **Marcador roto en índice: 3.2.2** | En el índice (página 2): "3.2.2. Estructura de desglose de trabajo (EDT) ¡Error! Marcador no definido." | Arreglar el campo de Word/StackEdit |
| 7 | **Marcador roto en índice: 4.2.3** | En el índice (página 2): "4.2.3 Datos multisensoriales locales (UAV) ¡Error! Marcador no definido." | Arreglar o eliminar |
| 8 | **Numeración incorrecta de costes** | En el índice y cuerpo, dentro de 3.4 las subsecciones se numeran 3.3.1, 3.3.2, 3.3.3, 3.3.4 en lugar de 3.4.1, etc. | Corregir numeración |
| 9 | **Título duplicado 3.2.1** | Se llama "Gestión y análisis de riesgos" pero ya existe 3.1.3 con ese nombre. El 3.2.1 real es "Herramienta de seguimiento (Kanban)" | Renombrar |
| 10 | **Sección 2.3.3 marcada como Error** | En el índice: "2.3.3 Interactividad y tiempo real......¡Error! Marcador no definido." | Arreglar |

### 🟢 Cosas que están bien (mantener)

- Introducción completa y bien argumentada.
- Estado del arte sólido con fundamentos teóricos y comparativa MaxEnt vs RF.
- Planificación con EDT, Gantt, riesgos y costes bien calculados.
- Materiales: zona de estudio, GBIF y WorldClim muy bien descritos.
- Requisitos funcionales con MoSCoW bien definidos.
- Requisitos no funcionales concretos y medibles.
- Diagrama i-Star con análisis de dependencias completo.
- Diagrama de casos de uso con actores bien definidos.
- Patrones de diseño justificados (GoF + GRASP).
- Diagrama de clases, secuencia y máquina de estados completos.

---

## 4. Índice final recomendado (corregido y completo)

```text
1. INTRODUCCIÓN
   1.1 Motivación
   1.2 Contexto del problema y antecedentes
       1.2.1 Evolución y fundamentos de los SDM
       1.2.2 Tipos de Datos y el Desafío de la Observación
       1.2.3 La Transición hacia el Machine Learning
       1.2.4 Plataformas y Sistemas Colaborativos
       1.2.5 Marcos de Proyección Climática: CMIP6 y Escenarios SSP
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
       2.3.1 Gemelos Digitales y realismo geográfico
       2.3.2 Renderizado de información predictiva
       2.3.3 Interactividad y tiempo real
   2.4 Visualización web de datos geoespaciales  ← AÑADIR (justifica TerraPredict)
       2.4.1 CesiumJS y globos terráqueos virtuales
       2.4.2 Three.js y renderizado 3D en navegador
       2.4.3 Aplicaciones web de ciencia ciudadana

3. PLANIFICACIÓN Y COSTES
   3.1 Marco metodológico y gestión del proyecto
       3.1.1 Gestión del ciclo de vida y herramientas ALM
       3.1.2 Justificación desde la Ingeniería del Software
       3.1.3 Gestión y análisis de riesgos
   3.2 Identificación de tareas y roles
       3.2.1 Herramienta de seguimiento (Kanban)  ← RENOMBRAR (no "riesgos")
       3.2.2 Estructura de desglose de trabajo (EDT)
   3.3 Planificación temporal
       3.3.1 Calendario de hitos
       3.3.2 Diagrama de Gantt
   3.4 Estimación de costes
       3.4.1 Costes de recursos humanos  ← CORREGIR (era 3.3.1)
       3.4.2 Costes de hardware          ← CORREGIR (era 3.3.2)
       3.4.3 Costes de software          ← CORREGIR (era 3.3.3)
       3.4.4 Costes totales              ← CORREGIR (era 3.3.4)

4. MATERIALES Y HERRAMIENTAS
   4.1 Zona de estudio: Sierra Mágina y Puerto de la Mata
   4.2 Fuentes de datos
       4.2.1 GBIF
       4.2.2 WorldClim
       4.2.3 Datos multisensoriales locales (UAV)  ← ARREGLAR O ELIMINAR
   4.3 Entorno de desarrollo
       4.3.1 Lenguaje y entorno de programación (IDE)
       4.3.2 Arquitectura base: motor GEU
       4.3.3 Integración del módulo de simulación
       4.3.4 Librerías de terceros (GEU)
       4.3.5 Plataforma web de visualización: TerraPredict  ← AÑADIR

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
       5.4.1 Diseño estructural (Diagrama de Clases GEU)
       5.4.2 Diseño de comportamiento (Diagrama de Secuencia GEU)
       5.4.3 Diseño del ciclo de vida (Diagrama de Máquina de Estados GEU)
       5.4.4 Diseño de la arquitectura web (Diagrama de Componentes TerraPredict)  ← AÑADIR

6. IMPLEMENTACIÓN  ← NUEVO CAPÍTULO
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

7. RESULTADOS Y VALIDACIÓN  ← NUEVO CAPÍTULO
   7.1 Métricas de rendimiento del modelo
   7.2 Mapas de predicción: actual y escenarios futuros
   7.3 Visualización en TerraPredict: capturas y análisis
   7.4 Comparativa de escenarios: áreas de hábitat
   7.5 Rendimiento computacional y tiempos de ejecución
   7.6 Validación visual y análisis de expertos

8. CONCLUSIONES Y LÍNEAS FUTURAS  ← NUEVO CAPÍTULO
   8.1 Cumplimiento de objetivos
   8.2 Aportaciones del trabajo
   8.3 Limitaciones del sistema
   8.4 Líneas de trabajo futuro

REFERENCIAS BIBLIOGRÁFICAS
ANEXOS
```

---

## 5. Checklist de acciones antes de entregar

### Correcciones menores (1–2 horas)
- [ ] Arreglar el campo "¡Error! Marcador no definido" en 3.2.2 (EDT)
- [ ] Arreglar o eliminar el campo "¡Error! Marcador no definido" en 4.2.3 (UAV)
- [ ] Arreglar el campo "¡Error! Marcador no definido" en 2.3.3
- [ ] Renombrar 3.2.1 a "Herramienta de seguimiento (Kanban)"
- [ ] Corregir numeración de costes: 3.4.1, 3.4.2, 3.4.3, 3.4.4

### Añadidos necesarios (4–6 horas)
- [ ] Añadir sección 4.3.5 sobre TerraPredict (stack, propósito, relación con GEU)
- [ ] Añadir 2.4 sobre visualización web (CesiumJS, Three.js)
- [ ] Añadir diagrama de componentes/architectura de TerraPredict en 5.4.4

### Contenido nuevo obligatorio (15–20 horas)
- [ ] **Escribir Capítulo 6 completo** (GEU + TerraPredict + pipeline)
- [ ] **Escribir Capítulo 7 completo** (métricas, capturas, comparativas)
- [ ] **Escribir Capítulo 8 completo** (conclusiones, líneas futuras)

---

## 6. Material gráfico que necesitarás para los capítulos nuevos

| Capítulo | Figuras necesarias |
|---|---|
| 6.1 | Capturas de GEU (panel de entrenamiento, heatmap 2D, heatmap 3D, curvas de respuesta en ImPlot) |
| 6.2 | Capturas de TerraPredict (visor 2D, visor 3D, dashboard, diff, comparador lado a lado) |
| 6.3 | Diagrama de flujo de datos: GEU → exports → TerraPredict |
| 7.1 | Tabla de métricas (AUC, Accuracy, TSS, Kappa, Precision, Recall, F1) |
| 7.2 | Mapas de predicción (actual vs SSP1-2.6 vs SSP5-8.5) |
| 7.3 | Galería de capturas de TerraPredict con leyendas |
| 7.4 | Tabla comparativa de áreas (binaria, continua, balance) |
| 7.5 | Tabla de tiempos de ejecución |

---

*Revisión corregida tras análisis directo del PDF `Memoria_TFG_V2.pdf`.*
