# Instrucciones: Terreno 3D + Nube de Puntos

## 1. Estructura de carpetas

Copia tus archivos a estas rutas dentro del proyecto:

```
public/
  data/
    terrain/
      dem.tif          ← DEM combinado (único archivo)
    pointcloud/
      points.xyz       ← Nube de puntos 3D (o .csv / .json)
    species/
      current/
        ...
```

## 2. Combinar los tiles DEM

### Opción A: Con GDAL (recomendado, más rápido)
Si tienes GDAL instalado (viene con QGIS):

```bash
# Si tus tiles están en una carpeta:
gdalbuildvrt public/data/terrain/mosaic.vrt ruta/a/tus/tiles/*.tif
gdal_translate public/data/terrain/mosaic.vrt public/data/terrain/dem.tif

# Limpia el VRT temporal:
rm public/data/terrain/mosaic.vrt
```

### Opción B: Con el script Python incluido
Requiere tener instalado `gdal` en Python:

```bash
pip install GDAL
python scripts/merge_dem.py "ruta/a/tus/tiles/*.tif" public/data/terrain/dem.tif
```

### Opción C: Manual con QGIS
1. Abre QGIS
2. `Raster` → `Miscelánea` → `Merge...`
3. Selecciona todos tus tiles
4. Guarda el resultado como `public/data/terrain/dem.tif`

## 3. Nube de puntos

El código acepta estos formatos (pon el archivo en `public/data/pointcloud/`):

| Formato | Ejemplo de contenido | Extensión |
|---------|----------------------|-----------|
| XYZ     | `x y z` (o `x y z r g b`) por línea | `.xyz`, `.txt` |
| CSV     | `x,y,z` (primera fila puede ser cabecera) | `.csv` |
| JSON    | `[[x,y,z], ...]` o `[{"x":1,"y":2,"z":3}, ...]` | `.json` |

**Si tu nube está en `.las` / `.laz`**, conviértela primero:

```bash
# Con pdal:
pdal translate input.laz output.xyz --writers.text.format="xyz"

# O con CloudCompare: exportar a ASC/XYZ
```

Renombra el resultado a `points.xyz` (o `points.csv`, `points.json`) y ponlo en `public/data/pointcloud/`.

> **Nota sobre coordenadas:** El código detecta automáticamente si tus puntos están en grados (lon/lat) o en metros. Si son grados, los convierte a metros. Si ya están proyectados (UTM, etc.), los usa directamente.

## 4. Arrancar y probar

```bash
npm run dev
```

Abre `http://localhost:5173/` y ve a la sección **3D**. Deberías ver:
- El terreno real con relieve (DEM)
- El heatmap de probabilidad pintado encima del terreno
- Si pusiste la nube de puntos, aparecerá como puntos blancos/color sobre el terreno
- Una info-box arriba a la izquierda con los datos del DEM cargado

## 5. Ajustes (si necesitas)

En `src/components/Scene3D.js` puedes tocar:
- `exaggeration: 1.8` → exageración vertical del relieve (súbelo si el terreno es muy plano)
- `heatmapMesh.position.y = 2.0` → altura del heatmap sobre el terreno (evita z-fighting)
- `opacity: 0.75` → transparencia del heatmap sobre el terreno 3D

## 6. Si algo no va

Abre la consola del navegador (F12) y busca mensajes que empiecen por `[Scene3D]`. Los errores más comunes:
- `"No se pudo cargar DEM"` → el archivo `dem.tif` no está en `public/data/terrain/`
- `"Formato de nube de puntos no soportado"` → usa `.xyz`, `.csv` o `.json`
- El terreno se ve negro/gris → el GeoTIFF puede tener un CRS raro; asegúrate de que esté en WGS84 (EPSG:4326) o proyectado métrico
