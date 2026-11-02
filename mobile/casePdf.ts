type PdfCase = { observations?: { date?: string; photoUri?: string }[] };
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export async function casePdfHtml(record: PdfCase, summary: string, language: 'en' | 'ha', readPhoto: (uri?: string) => Promise<string>) {
  const pages: string[] = [];
  let missing = 0;
  for (const [index, visit] of (record.observations || []).entries()) {
    const date = visit.date && Number.isFinite(Date.parse(visit.date)) ? new Date(visit.date).toISOString().slice(0, 10) : (language === 'ha' ? 'Ba a saka kwanan wata ba' : 'Date not recorded');
    let data;
    try { data = await readPhoto(visit.photoUri); } catch { /* Include a labelled placeholder. */ }
    const image = typeof data === 'string' && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(data);
    if (!image) missing++;
    pages.push(`<section class="photo-page"><h2>${language === 'ha' ? 'Ziyara' : 'Visit'} ${index + 1} · ${escape(date)}</h2>${image ? `<img src="${data}" alt="${language === 'ha' ? 'Hoton shuka' : 'Crop photo'} ${index + 1}">` : `<p>${language === 'ha' ? 'Ba a samu hoton wannan ziyara ba; ba a haɗa shi ba.' : 'The photo for this visit was unavailable and could not be included.'}</p>`}</section>`);
  }
  return { missing, html: `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>
    @page{size:A4;margin:18mm}body{font-family:sans-serif;font-size:11pt;line-height:1.45;color:#1e2e25}
    h1,h2{color:#214e37}h1{font-size:22pt}h2{font-size:16pt}.summary{white-space:pre-wrap;overflow-wrap:anywhere}
    .photo-page{page-break-before:always;break-before:page}img{display:block;max-width:100%;max-height:230mm;width:auto;height:auto;object-fit:contain}
    </style></head><body><h1>FIELDNOTE</h1><div class="summary">${escape(summary)}</div>${pages.join('')}</body></html>` };
}

export async function validateCasePdf(result: { uri?: string; numberOfPages?: number } | null | undefined, inspect: (uri: string) => Promise<{ exists: boolean; isDirectory?: boolean; size?: number }>, signature: (uri: string) => Promise<string>, phase: (step: string) => void = () => {}) {
  phase('validate-uri');
  if (typeof result?.uri !== 'string' || !/^file:\/\/\/[^?#]+$/.test(result.uri)) throw new Error('invalid-print-result');
  phase('validate-pages');
  if (!Number.isInteger(result.numberOfPages) || result.numberOfPages! < 1) throw new Error('invalid-print-result');
  phase('validate-file-info');
  const info = await inspect(result.uri);
  if (!info.exists || info.isDirectory) throw new Error('missing-pdf-file');
  phase('validate-size');
  if (!Number.isFinite(info.size) || info.size! < 5) throw new Error('invalid-pdf-size');
  phase('validate-signature');
  if (await signature(result.uri) !== '%PDF-') throw new Error('invalid-pdf-signature');
  return result.uri;
}

// Expo Print reads its own output when base64:true. In Expo Go its host-cache
// output can be outside FileSystem's experience-scoped read permissions.
// Decode only the first five bytes; never log or retain the PDF payload.
export function readPdfSignature(base64: unknown): string {
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]{7}[A-Za-z0-9+/=]$/.test(base64.slice(0, 8))) throw new Error('invalid-pdf-signature');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let bits = 0, value = 0, header = '';
  for (const char of base64.slice(0, 8)) {
    if (char === '=') break;
    value = (value << 6) | alphabet.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      header += String.fromCharCode((value >> bits) & 255);
      if (header.length === 5) break;
    }
  }
  return header;
}

export function pdfFailureDetail(error: unknown): string {
  if (error instanceof Error && ['invalid-print-result', 'missing-pdf-file', 'invalid-pdf-size', 'invalid-pdf-signature', 'invalid-share-uri', 'share-copy-unavailable', 'invalid-share-copy'].includes(error.message)) return error.message;
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^ERR_[A-Z_]{1,50}$/.test(error.code)) return error.code;
  return 'native-error';
}

export async function shareCasePdf(uri: string, share: (uri: string, options: { mimeType?: string; UTI?: string; dialogTitle?: string }) => Promise<void>, platform: string = 'android'): Promise<'closed' | 'cancelled'> {
  try {
    if (!/^file:\/\/\/[^?#]+$/.test(uri)) throw new Error('invalid-share-uri');
    await share(uri, platform === 'ios' ? { UTI: 'com.adobe.pdf' } : { mimeType: 'application/pdf', dialogTitle: 'Fieldnote case PDF' });
    // Android resolves on dismissal too; this is never confirmation of delivery.
    return 'closed';
  } catch (error) {
    if (error && typeof error === 'object' && (('name' in error && error.name === 'AbortError') || ('code' in error && ['ERR_CANCELED', 'ERR_CANCELLED'].includes(String(error.code))))) return 'cancelled';
    throw error;
  }
}
