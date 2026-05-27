import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import * as THREE from 'three';

/**
 * Carga una nube de puntos 3D desde distintos formatos soportados.
 * Soporta:
 *   - .ply  (parser manual robusto para ASCII y binary_little_endian)
 *   - .xyz  (texto: x y z [r g b] por línea)
 *   - .csv  (texto con columnas x,y,z o lon,lat,elevation)
 *   - .json (array de objetos [{x,y,z},...] o [[x,y,z],...])
 */

export async function loadPointCloud(url) {
  const ext = url.split('.').pop().toLowerCase();

  if (ext === 'ply') {
    return loadPLYManual(url);
  }
  if (ext === 'json') {
    return loadJSON(url);
  }
  if (ext === 'csv') {
    return loadCSV(url);
  }
  if (ext === 'xyz' || ext === 'txt') {
    return loadXYZ(url);
  }

  throw new Error(`Formato de nube de puntos no soportado: .${ext}. Usa .ply, .xyz, .csv o .json`);
}

/**
 * Parser manual de PLY. Soporta ASCII y binary_little_endian.
 * Es más robusto que el PLYLoader de Three.js para archivos con propiedades extra.
 */
async function loadPLYManual(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url}: ${res.status}`);

  const arrayBuffer = await res.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  // Leer header (ASCII hasta "end_header\n")
  let headerEnd = 0;
  for (let i = 0; i < uint8.length - 11; i++) {
    if (uint8[i] === 101 && uint8[i+1] === 110 && uint8[i+2] === 100 && // 'e','n','d'
        uint8[i+3] === 95 && uint8[i+4] === 104 && uint8[i+5] === 101 && // '_','h','e'
        uint8[i+6] === 97 && uint8[i+7] === 100 && uint8[i+8] === 101 && // 'a','d','e'
        uint8[i+9] === 114) {
      // Buscar el \n después de end_header
      for (let j = i + 10; j < uint8.length; j++) {
        if (uint8[j] === 10) { // '\n'
          headerEnd = j + 1;
          break;
        }
      }
      break;
    }
  }

  if (headerEnd === 0) throw new Error('No se encontró end_header en el PLY');

  const header = new TextDecoder().decode(uint8.slice(0, headerEnd));
  const lines = header.split(/\r?\n/);

  // Parsear header
  let format = null;
  let vertexCount = 0;
  const properties = [];
  let inVertexElement = false;

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'format') {
      format = parts[1];
    } else if (parts[0] === 'element' && parts[1] === 'vertex') {
      vertexCount = parseInt(parts[2], 10);
      inVertexElement = true;
    } else if (parts[0] === 'element' && parts[1] !== 'vertex') {
      inVertexElement = false;
    } else if (parts[0] === 'property' && inVertexElement) {
      const type = parts[1];
      const name = parts[2];
      properties.push({ type, name });
    }
  }

  if (!format) throw new Error('Formato PLY no especificado');
  if (vertexCount === 0) throw new Error('PLY sin vértices');

  // Calcular tamaño de cada vértice
  const typeSizes = {
    char: 1, uchar: 1, int8: 1, uint8: 1,
    short: 2, ushort: 2, int16: 2, uint16: 2,
    int: 4, uint: 4, int32: 4, uint32: 4,
    float: 4, float32: 4,
    double: 8, float64: 8,
  };

  let vertexSize = 0;
  for (const p of properties) {
    const sz = typeSizes[p.type];
    if (!sz) throw new Error(`Tipo PLY no soportado: ${p.type}`);
    vertexSize += sz;
  }

  // Crear BufferGeometry
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);

  const dataView = new DataView(arrayBuffer, headerEnd);

  // Índices de propiedades
  const xIdx = properties.findIndex(p => p.name === 'x');
  const yIdx = properties.findIndex(p => p.name === 'y');
  const zIdx = properties.findIndex(p => p.name === 'z');
  const rIdx = properties.findIndex(p => p.name === 'red' || p.name === 'r' || p.name === 'diffuse_red');
  const gIdx = properties.findIndex(p => p.name === 'green' || p.name === 'g' || p.name === 'diffuse_green');
  const bIdx = properties.findIndex(p => p.name === 'blue' || p.name === 'b' || p.name === 'diffuse_blue');

  if (xIdx === -1 || yIdx === -1 || zIdx === -1) {
    throw new Error('PLY no tiene propiedades x, y, z');
  }

  // Función para leer un valor según tipo y offset
  function readValue(view, offset, type, isLittleEndian) {
    switch (type) {
      case 'char': case 'int8': return view.getInt8(offset);
      case 'uchar': case 'uint8': return view.getUint8(offset);
      case 'short': case 'int16': return view.getInt16(offset, isLittleEndian);
      case 'ushort': case 'uint16': return view.getUint16(offset, isLittleEndian);
      case 'int': case 'int32': return view.getInt32(offset, isLittleEndian);
      case 'uint': case 'uint32': return view.getUint32(offset, isLittleEndian);
      case 'float': case 'float32': return view.getFloat32(offset, isLittleEndian);
      case 'double': case 'float64': return view.getFloat64(offset, isLittleEndian);
      default: return 0;
    }
  }

  const isLittleEndian = format === 'binary_little_endian';

  if (format === 'ascii') {
    // Parsear ASCII
    const text = new TextDecoder().decode(uint8.slice(headerEnd));
    const dataLines = text.trim().split(/\r?\n/);
    for (let i = 0; i < Math.min(vertexCount, dataLines.length); i++) {
      const vals = dataLines[i].trim().split(/\s+/).map(parseFloat);
      positions[i * 3] = vals[xIdx] || 0;
      positions[i * 3 + 1] = vals[yIdx] || 0;
      positions[i * 3 + 2] = vals[zIdx] || 0;
      colors[i * 3] = (vals[rIdx] !== undefined ? vals[rIdx] : 200) / 255;
      colors[i * 3 + 1] = (vals[gIdx] !== undefined ? vals[gIdx] : 200) / 255;
      colors[i * 3 + 2] = (vals[bIdx] !== undefined ? vals[bIdx] : 200) / 255;
    }
  } else if (format === 'binary_little_endian' || format === 'binary_big_endian') {
    for (let i = 0; i < vertexCount; i++) {
      const offset = i * vertexSize;
      let propOffset = 0;
      let x = 0, y = 0, z = 0, r = 200, g = 200, b = 200;

      for (let j = 0; j < properties.length; j++) {
        const p = properties[j];
        const val = readValue(dataView, offset + propOffset, p.type, isLittleEndian);
        propOffset += typeSizes[p.type];

        if (j === xIdx) x = val;
        else if (j === yIdx) y = val;
        else if (j === zIdx) z = val;
        else if (j === rIdx) r = val;
        else if (j === gIdx) g = val;
        else if (j === bIdx) b = val;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Si los colores son uchar (0-255), dividir por 255. Si son float (0-1), dejar así.
      const isUchar = rIdx !== -1 && properties[rIdx].type === 'uchar';
      const div = isUchar ? 255 : 1;
      colors[i * 3] = r / div;
      colors[i * 3 + 1] = g / div;
      colors[i * 3 + 2] = b / div;
    }
  } else {
    throw new Error(`Formato PLY no soportado: ${format}`);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  console.log(`[PLY] Parseados ${vertexCount} vértices desde ${url}`);
  return geometry;
}

async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url}`);
  const data = await res.json();

  if (Array.isArray(data)) {
    if (data.length > 0 && Array.isArray(data[0])) {
      return data.map(p => ({ x: p[0], y: p[1], z: p[2], r: p[3], g: p[4], b: p[5] }));
    } else if (data.length > 0 && typeof data[0] === 'object') {
      return data.map(p => ({
        x: p.x ?? p.X,
        y: p.y ?? p.Y,
        z: p.z ?? p.Z,
        r: p.r ?? p.R ?? p.red,
        g: p.g ?? p.G ?? p.green,
        b: p.b ?? p.B ?? p.blue,
      }));
    }
  }
  throw new Error('Formato JSON no reconocido');
}

async function loadCSV(url) {
  const text = await fetch(url).then(r => r.text());
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV vacío');

  const header = lines[0].toLowerCase().split(',').map(h => h.trim());
  const hasHeader = header.includes('x') || header.includes('lon');
  const startIdx = hasHeader ? 1 : 0;
  const points = [];

  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(',').map(v => parseFloat(v.trim()));
    if (parts.length < 3 || parts.some(isNaN)) continue;
    points.push({ x: parts[0], y: parts[1], z: parts[2], r: parts[3] ?? 255, g: parts[4] ?? 255, b: parts[5] ?? 255 });
  }
  return points;
}

async function loadXYZ(url) {
  const text = await fetch(url).then(r => r.text());
  const lines = text.trim().split(/\r?\n/);
  const points = [];
  for (const line of lines) {
    if (line.startsWith('#')) continue;
    const parts = line.trim().split(/\s+/).map(v => parseFloat(v));
    if (parts.length < 3 || parts.some(isNaN)) continue;
    points.push({ x: parts[0], y: parts[1], z: parts[2], r: parts[3] ?? 255, g: parts[4] ?? 255, b: parts[5] ?? 255 });
  }
  return points;
}

export function pointsToGeometry(points) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(points.length * 3);
  const colors = new Float32Array(points.length * 3);

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
    colors[i * 3] = (p.r ?? 200) / 255;
    colors[i * 3 + 1] = (p.g ?? 220) / 255;
    colors[i * 3 + 2] = (p.b ?? 200) / 255;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}
