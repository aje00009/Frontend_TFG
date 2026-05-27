import Papa from 'papaparse';

export async function loadJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('No se pudo cargar JSON:', url, e);
    return null;
  }
}

export async function loadCsv(url) {
  try {
    const text = await fetch(url).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    });
    return new Promise((resolve) => {
      Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
      });
    });
  } catch (e) {
    console.warn('No se pudo cargar CSV:', url, e);
    return null;
  }
}

export async function loadGeoJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('No se pudo cargar GeoJSON:', url, e);
    return null;
  }
}
