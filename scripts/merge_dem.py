#!/usr/bin/env python3
"""
Combina varios tiles DEM en un único GeoTIFF.
Uso:
  python scripts/merge_dem.py ruta/a/los/tiles/*.tif public/data/terrain/dem.tif
O con carpetas:
  python scripts/merge_dem.py public/data/terrain/tiles/ public/data/terrain/dem.tif
"""
import sys
import os
import glob
from osgeo import gdal


def merge_dem_tiles(input_pattern, output_path):
    """Combina tiles DEM usando GDAL."""
    # Buscar archivos
    if os.path.isdir(input_pattern):
        files = sorted(glob.glob(os.path.join(input_pattern, "*.tif"))) + \
                sorted(glob.glob(os.path.join(input_pattern, "*.TIF"))) + \
                sorted(glob.glob(os.path.join(input_pattern, "*.tiff"))) + \
                sorted(glob.glob(os.path.join(input_pattern, "*.asc")))
    else:
        files = sorted(glob.glob(input_pattern))

    if not files:
        print(f"No se encontraron archivos DEM en: {input_pattern}")
        sys.exit(1)

    print(f"Encontrados {len(files)} tiles:")
    for f in files:
        print(f"  - {f}")

    # Crear VRT (Virtual Raster) y traducir a GeoTIFF
    vrt_path = output_path.replace('.tif', '_mosaic.vrt')

    print(f"\nCreando mosaic VRT: {vrt_path}")
    vrt = gdal.BuildVRT(vrt_path, files)
    if vrt is None:
        print("Error creando VRT. Asegúrate de que GDAL está instalado.")
        sys.exit(1)
    vrt = None

    print(f"Escribiendo GeoTIFF combinado: {output_path}")
    translate_options = gdal.TranslateOptions(
        format='GTiff',
        creationOptions=['COMPRESS=DEFLATE', 'TILED=YES', 'BIGTIFF=IF_SAFER']
    )
    gdal.Translate(output_path, vrt_path, options=translate_options)

    # Limpiar VRT temporal
    if os.path.exists(vrt_path):
        os.remove(vrt_path)

    # Mostrar info del resultado
    ds = gdal.Open(output_path)
    if ds:
        band = ds.GetRasterBand(1)
        stats = band.GetStatistics(True, True)
        print(f"\n✅ DEM combinado creado: {output_path}")
        print(f"   Dimensiones: {ds.RasterXSize} x {ds.RasterYSize} píxeles")
        print(f"   CRS: {ds.GetProjection()}")
        gt = ds.GetGeoTransform()
        print(f"   Extensión: {gt[0]}, {gt[3]+gt[5]*ds.RasterYSize} -> {gt[0]+gt[1]*ds.RasterXSize}, {gt[3]}")
        print(f"   Elevación min: {stats[0]:.2f} m, max: {stats[1]:.2f} m")
        ds = None


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Uso: python merge_dem.py <input_pattern|folder> <output.tif>")
        print("Ejemplo: python merge_dem.py 'data/dem_tiles/*.tif' public/data/terrain/dem.tif")
        sys.exit(1)

    merge_dem_tiles(sys.argv[1], sys.argv[2])
