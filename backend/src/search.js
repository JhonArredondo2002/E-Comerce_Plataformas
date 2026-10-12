// ─────────────────────────────────────────────────────────────────────────────
//  Búsqueda flexible para el Directorio
//
//  Hace que la búsqueda "perdone" al usuario:
//   • Ignora mayúsculas, tildes y signos   →  "cafe" encuentra "Café"
//   • Plurales                             →  "celulares" encuentra "celular"
//   • Palabras incompletas                 →  "repar" encuentra "Reparación"
//   • Errores de tipeo                     →  "pelukeria" encuentra "Peluquería"
//   • Palabras relacionadas (sinónimos)    →  "comida" encuentra restaurantes
//   • Busca también en los productos       →  "capuchino" encuentra Café Aroma
//  Los resultados se ordenan por relevancia.
//
//  Para agregar palabras relacionadas, edita SYNONYM_GROUPS (sin tildes, en minúscula).
// ─────────────────────────────────────────────────────────────────────────────

export const SYNONYM_GROUPS = [
  ['comida', 'restaurante', 'restaurant', 'almuerzo', 'corrientazo', 'comer', 'cena', 'desayuno', 'menu', 'cocina'],
  ['cafe', 'cafeteria', 'tinto', 'capuchino', 'espresso', 'latte'],
  ['pan', 'panaderia', 'reposteria', 'postre', 'torta', 'pastel', 'ponque', 'galleta'],
  ['comida rapida', 'hamburguesa', 'pizza', 'perro caliente', 'salchipapa', 'empanada', 'arepa'],
  ['bebida', 'jugo', 'licor', 'cerveza', 'bar', 'coctel', 'trago', 'gaseosa'],
  ['celular', 'telefono', 'movil', 'smartphone', 'iphone', 'android'],
  ['tecnologia', 'computador', 'pc', 'portatil', 'laptop', 'tablet', 'electronica', 'celular', 'accesorio'],
  ['reparacion', 'arreglo', 'mantenimiento', 'tecnico', 'reparar', 'arreglar', 'soporte'],
  ['domicilio', 'envio', 'delivery', 'entrega', 'a domicilio'],
  ['ropa', 'moda', 'vestido', 'camisa', 'pantalon', 'boutique', 'prenda', 'jean'],
  ['zapato', 'calzado', 'tenis', 'zapatilla', 'bota', 'sandalia'],
  ['belleza', 'peluqueria', 'barberia', 'salon', 'estetica', 'spa', 'maquillaje', 'corte', 'cabello', 'pelo'],
  ['manicure', 'pedicure', 'nail', 'esmalte', 'unas acrilicas'],
  ['mascota', 'perro', 'gato', 'veterinaria', 'veterinario', 'pet', 'concentrado'],
  ['ferreteria', 'herramienta', 'construccion', 'pintura', 'material', 'electrico', 'plomeria'],
  ['mercado', 'supermercado', 'minimercado', 'abarrotes', 'viveres', 'tienda', 'granero', 'fruver'],
  ['salud', 'drogueria', 'farmacia', 'medicamento', 'medico', 'clinica', 'consultorio'],
  ['odontologia', 'dentista', 'odontologo', 'dental'],
  ['carro', 'auto', 'vehiculo', 'automotriz', 'taller', 'mecanico', 'lavadero', 'moto', 'motocicleta'],
  ['gimnasio', 'gym', 'deporte', 'fitness', 'entrenamiento', 'crossfit'],
  ['educacion', 'curso', 'clase', 'academia', 'colegio', 'tutoria', 'escuela', 'capacitacion'],
  ['hogar', 'mueble', 'decoracion', 'casa', 'cocina', 'colchon'],
  ['papeleria', 'cuaderno', 'utiles', 'fotocopia', 'impresion', 'libreria'],
  ['wifi', 'internet'],
  ['regalo', 'detalle', 'flor', 'floristeria', 'ancheta'],
];

const STOPWORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'y', 'o', 'en', 'para', 'con', 'un', 'una', 'unos', 'unas', 'del', 'al', 'por',
  'que', 'mi', 'tu', 'su', 'a', 'se', 'lo', 'le', 'donde', 'busco', 'quiero', 'cerca', 'venden', 'vende', 'hay',
]);

/** Minúsculas, sin tildes, solo letras y números. */
export function normalize(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Raíz sencilla en español: quita plurales ("celulares" → "celular", "cafes" → "cafe"). */
export function stem(word) {
  if (word.length > 4 && /[^aeiou]es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

const tokenize = (text) => normalize(text).split(' ').filter(Boolean).map(stem);

/** Distancia de edición (Damerau-Levenshtein simplificada) con corte temprano. */
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = [], prev = [], cur = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev2.splice(0, prev2.length, ...prev);
    prev.splice(0, prev.length, ...cur);
  }
  return prev[b.length];
}

const allowedTypos = (len) => (len <= 3 ? 0 : len <= 6 ? 1 : 2);

// Índice de sinónimos: palabra (raíz) → todas las palabras relacionadas (raíces)
const SYNONYMS = new Map();
for (const group of SYNONYM_GROUPS) {
  const stems = [...new Set(group.flatMap(tokenize).filter((w) => w.length > 1 && !STOPWORDS.has(w)))];
  for (const w of stems) {
    const set = SYNONYMS.get(w) || new Set();
    stems.forEach((s) => s !== w && set.add(s));
    SYNONYMS.set(w, set);
  }
}

/**
 * Qué tan bien una palabra buscada coincide con una palabra del negocio (0 a 1).
 * strict = true para sinónimos: solo coincidencia exacta o palabra incompleta.
 */
function wordMatch(term, word, strict = false) {
  if (term === word) return 1;
  if (strict) return term.length >= 5 && word.startsWith(term) ? 0.85 : 0; // "pan" no debe encontrar "pantalla"
  if (term.length >= 3 && word.startsWith(term)) return 0.85; // palabra incompleta
  if (word.length >= 5 && word.length >= term.length * 0.75 && term.startsWith(word)) return 0.75;
  if (term.length >= 4 && word.includes(term)) return 0.6;
  const max = allowedTypos(Math.min(term.length, word.length));
  if (max && distance(term, word, max) <= max) return 0.55; // error de tipeo
  // palabra incompleta con error de tipeo: "pelukeri" ≈ "peluqueria"
  if (term.length >= 5 && word.length > term.length) {
    const head = word.slice(0, term.length);
    if (distance(term, head, 1) <= 1) return 0.45;
  }
  return 0;
}

/** Variantes de una palabra buscada: ella misma (peso 1) y sus relacionadas (peso 0.7). */
function variants(term) {
  const list = [[term, 1]];
  const direct = SYNONYMS.get(term);
  if (direct) direct.forEach((s) => list.push([s, 0.7]));
  else {
    // si el usuario escribió con error, también buscamos sinónimos de la palabra corregida
    for (const [key, set] of SYNONYMS) {
      const max = allowedTypos(term.length);
      if (max && distance(term, key, max) <= max) {
        list.push([key, 0.6]);
        set.forEach((s) => list.push([s, 0.5]));
        break;
      }
    }
  }
  return list;
}

const FIELD_WEIGHTS = { name: 5, category: 3, services: 3, products: 2, location: 2, description: 1 };

/**
 * Busca y ordena por relevancia.
 * @param {string} query texto del usuario
 * @param {Array} docs  [{ ...negocio, _fields: { name, category, services, products, location, description }, _products: [nombres] }]
 * @returns los documentos que coinciden, ordenados, con `relevance` y `matched_products`
 */
export function fuzzySearch(query, docs) {
  const all = tokenize(query);
  let terms = [...new Set(all.filter((t) => !STOPWORDS.has(t)))];
  if (!terms.length) terms = [...new Set(all)]; // ej. "uñas" → "una": si todo son palabras comunes, se usan igual
  if (!terms.length) return docs;
  const termVariants = terms.map(variants);

  const results = [];
  for (const doc of docs) {
    const fieldTokens = Object.fromEntries(Object.entries(doc._fields).map(([k, v]) => [k, [...new Set(tokenize(v))]]));
    let score = 0;
    let matched = 0;
    for (const vs of termVariants) {
      let best = 0;
      for (const [field, tokens] of Object.entries(fieldTokens)) {
        const weight = FIELD_WEIGHTS[field] || 1;
        for (const [v, vw] of vs) {
          for (const tok of tokens) {
            const m = wordMatch(v, tok, vw < 1) * vw * weight;
            if (m > best) best = m;
          }
        }
      }
      if (best > 0) { matched++; score += best; }
    }
    // Con varias palabras, exigimos que coincida al menos la mitad
    if (matched && matched >= Math.ceil(terms.length / 2)) {
      const matchedProducts = doc._products
        .filter((p) => termVariants.some((vs) => tokenize(p).some((tok) => vs.some(([v, vw]) => vw >= 0.7 && wordMatch(v, tok, vw < 1) >= 0.55))))
        .slice(0, 3);
      results.push({ doc, score: score + matched * 10, matchedProducts });
    }
  }
  results.sort((a, b) => b.score - a.score || a.doc.name.localeCompare(b.doc.name));
  return results.map(({ doc, score, matchedProducts }) => ({ ...doc, relevance: Math.round(score), matched_products: matchedProducts }));
}
