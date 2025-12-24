/**
 * Utilidades para manejo y normalización de texto
 */

// Mapa de caracteres Unicode fancy a ASCII normal
const UNICODE_TO_ASCII = {
    // Bold
    '𝐀': 'A', '𝐁': 'B', '𝐂': 'C', '𝐃': 'D', '𝐄': 'E', '𝐅': 'F', '𝐆': 'G',
    '𝐇': 'H', '𝐈': 'I', '𝐉': 'J', '𝐊': 'K', '𝐋': 'L', '𝐌': 'M', '𝐍': 'N',
    '𝐎': 'O', '𝐏': 'P', '𝐐': 'Q', '𝐑': 'R', '𝐒': 'S', '𝐓': 'T', '𝐔': 'U',
    '𝐕': 'V', '𝐖': 'W', '𝐗': 'X', '𝐘': 'Y', '𝐙': 'Z',
    '𝐚': 'a', '𝐛': 'b', '𝐜': 'c', '𝐝': 'd', '𝐞': 'e', '𝐟': 'f', '𝐠': 'g',
    '𝐡': 'h', '𝐢': 'i', '𝐣': 'j', '𝐤': 'k', '𝐥': 'l', '𝐦': 'm', '𝐧': 'n',
    '𝐨': 'o', '𝐩': 'p', '𝐪': 'q', '𝐫': 'r', '𝐬': 's', '𝐭': 't', '𝐮': 'u',
    '𝐯': 'v', '𝐰': 'w', '𝐱': 'x', '𝐲': 'y', '𝐳': 'z',
    // Italic
    '𝘈': 'A', '𝘉': 'B', '𝘊': 'C', '𝘋': 'D', '𝘌': 'E', '𝘍': 'F', '𝘎': 'G',
    '𝘏': 'H', '𝘐': 'I', '𝘑': 'J', '𝘒': 'K', '𝘓': 'L', '𝘔': 'M', '𝘕': 'N',
    '𝘖': 'O', '𝘗': 'P', '𝘘': 'Q', '𝘙': 'R', '𝘚': 'S', '𝘛': 'T', '𝘜': 'U',
    '𝘝': 'V', '𝘞': 'W', '𝘟': 'X', '𝘠': 'Y', '𝘡': 'Z',
    '𝘢': 'a', '𝘣': 'b', '𝘤': 'c', '𝘥': 'd', '𝘦': 'e', '𝘧': 'f', '𝘨': 'g',
    '𝘩': 'h', '𝘪': 'i', '𝘫': 'j', '𝘬': 'k', '𝘭': 'l', '𝘮': 'm', '𝘯': 'n',
    '𝘰': 'o', '𝘱': 'p', '𝘲': 'q', '𝘳': 'r', '𝘴': 's', '𝘵': 't', '𝘶': 'u',
    '𝘷': 'v', '𝘸': 'w', '𝘹': 'x', '𝘺': 'y', '𝘻': 'z',
    // Bold Italic
    '𝘼': 'A', '𝘽': 'B', '𝘾': 'C', '𝘿': 'D', '𝙀': 'E', '𝙁': 'F', '𝙂': 'G',
    '𝙃': 'H', '𝙄': 'I', '𝙅': 'J', '𝙆': 'K', '𝙇': 'L', '𝙈': 'M', '𝙉': 'N',
    '𝙊': 'O', '𝙋': 'P', '𝙌': 'Q', '𝙍': 'R', '𝙎': 'S', '𝙏': 'T', '𝙐': 'U',
    '𝙑': 'V', '𝙒': 'W', '𝙓': 'X', '𝙔': 'Y', '𝙕': 'Z',
    '𝙖': 'a', '𝙗': 'b', '𝙘': 'c', '𝙙': 'd', '𝙚': 'e', '𝙛': 'f', '𝙜': 'g',
    '𝙝': 'h', '𝙞': 'i', '𝙟': 'j', '𝙠': 'k', '𝙡': 'l', '𝙢': 'm', '𝙣': 'n',
    '𝙤': 'o', '𝙥': 'p', '𝙦': 'q', '𝙧': 'r', '𝙨': 's', '𝙩': 't', '𝙪': 'u',
    '𝙫': 'v', '𝙬': 'w', '𝙭': 'x', '𝙮': 'y', '𝙯': 'z',
    // Monospace
    '𝙰': 'A', '𝙱': 'B', '𝙲': 'C', '𝙳': 'D', '𝙴': 'E', '𝙵': 'F', '𝙶': 'G',
    '𝙷': 'H', '𝙸': 'I', '𝙹': 'J', '𝙺': 'K', '𝙻': 'L', '𝙼': 'M', '𝙽': 'N',
    '𝙾': 'O', '𝙿': 'P', '𝚀': 'Q', '𝚁': 'R', '𝚂': 'S', '𝚃': 'T', '𝚄': 'U',
    '𝚅': 'V', '𝚆': 'W', '𝚇': 'X', '𝚈': 'Y', '𝚉': 'Z',
    '𝚊': 'a', '𝚋': 'b', '𝚌': 'c', '𝚍': 'd', '𝚎': 'e', '𝚏': 'f', '𝚐': 'g',
    '𝚑': 'h', '𝚒': 'i', '𝚓': 'j', '𝚔': 'k', '𝚕': 'l', '𝚖': 'm', '𝚗': 'n',
    '𝚘': 'o', '𝚙': 'p', '𝚚': 'q', '𝚛': 'r', '𝚜': 's', '𝚝': 't', '𝚞': 'u',
    '𝚟': 'v', '𝚠': 'w', '𝚡': 'x', '𝚢': 'y', '𝚣': 'z'
};

/**
 * Normaliza caracteres Unicode fancy a ASCII
 */
function normalizeUnicodeText(text) {
    if (!text) return text;
    
    let result = text;
    for (const [unicode, ascii] of Object.entries(UNICODE_TO_ASCII)) {
        result = result.replace(new RegExp(unicode, 'g'), ascii);
    }
    
    return result;
}

/**
 * Normaliza texto para comparación (keywords, búsqueda, etc.)
 * Convierte a minúsculas, normaliza Unicode, remueve espacios extras
 */
function normalizeForComparison(text) {
    if (!text) return '';
    
    let normalized = text;
    
    // 1. Normalizar caracteres fancy a ASCII
    normalized = normalizeUnicodeText(normalized);
    
    // 2. Normalizar Unicode (descomponer acentos)
    try {
        normalized = normalized.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) {
        console.warn('[TextUtils] Error normalizando Unicode:', e);
    }
    
    // 3. Convertir a minúsculas
    normalized = normalized.toLowerCase();
    
    // 4. Remover caracteres especiales y espacios extras
    normalized = normalized
        .replace(/[^\w\s]/gi, ' ') // Reemplazar caracteres especiales por espacio
        .replace(/\s+/g, ' ')       // Múltiples espacios a uno solo
        .trim();
    
    return normalized;
}

/**
 * Limpia título para mostrar en Discord
 */
function cleanStreamTitle(title, maxLength = 256) {
    if (!title) return 'Sin título';
    
    let cleaned = title;
    
    // Normalizar caracteres fancy (pero mantener el título original fancy)
    // Solo normalizamos para evitar problemas, no para mostrar
    
    // Remover caracteres de control
    cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    
    // Truncar longitud
    if (cleaned.length > maxLength) {
        cleaned = cleaned.substring(0, maxLength - 3) + '...';
    }
    
    return cleaned.trim() || 'Sin título';
}

/**
 * Verifica si un texto contiene una keyword (insensible a Unicode y mayúsculas)
 */
function containsKeyword(text, keyword) {
    const normalizedText = normalizeForComparison(text);
    const normalizedKeyword = normalizeForComparison(keyword);
    
    return normalizedText.includes(normalizedKeyword);
}

module.exports = {
    normalizeUnicodeText,
    normalizeForComparison,
    cleanStreamTitle,
    containsKeyword
};