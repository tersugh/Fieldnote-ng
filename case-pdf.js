/* Local-only PDF generation. pdfmake and its fonts are bundled, never fetched from a CDN. */
(function (root) {
  const date = value => Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().slice(0, 10) : 'Date not recorded';
  function filename(record) {
    const crop = String(record.crop || 'crop').replace(/[^a-z0-9]+/gi, '-').slice(0, 35);
    const id = String(record.id || 'case').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
    return `fieldnote-${crop}-${id}.pdf`;
  }
  async function localPhoto(blob) {
    if (!(blob instanceof Blob) || !blob.size || !['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) throw new Error('Photo unavailable');
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Photo could not be decoded');
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.85);
    } finally { URL.revokeObjectURL(url); }
  }
  async function documentDefinition(record, summary, language = 'en', readPhoto = localPhoto) {
    const ha = language === 'ha';
    const content = [{ text: 'FIELDNOTE', fontSize: 22, bold: true, color: '#214e37', margin: [0, 0, 0, 16] }, { text: summary }];
    let missing = 0;
    // Sequential processing preserves the saved visit order and limits image decoding memory.
    for (const [index, visit] of (record.observations || []).entries()) {
      const label = `${ha ? 'Ziyara' : 'Visit'} ${index + 1} · ${date(visit.date)}`;
      content.push({ text: label, fontSize: 16, bold: true, color: '#214e37', pageBreak: 'before', margin: [0, 0, 0, 16] });
      let data;
      try { data = await readPhoto(visit.photo); } catch { /* A missing photo must not lose the case summary. */ }
      if (typeof data === 'string' && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(data)) {
        content.push({ image: data, fit: [515, 620] });
      } else {
        missing++;
        content.push({ text: ha ? 'Ba a samu hoton wannan ziyara ba; ba a haɗa shi ba.' : 'The photo for this visit was unavailable and could not be included.' });
      }
    }
    return { missing, definition: {
      pageSize: 'A4', pageMargins: [40, 40, 40, 48], content,
      defaultStyle: { font: 'NotoSans', fontSize: 11, lineHeight: 1.25 },
      footer: (page, pages) => ({ text: `${page} / ${pages}`, alignment: 'center', fontSize: 9, color: '#69766d', margin: [0, 12, 0, 0] }),
      info: { title: 'Fieldnote case summary', author: 'Fieldnote' },
    } };
  }
  async function create(record, summary, language, readPhoto = localPhoto) {
    const { definition, missing } = await documentDefinition(record, summary, language, readPhoto);
    const blob = await new Promise((resolve, reject) => {
      try {
        // All assets are inline. The synchronous stream API lets failures reject
        // this promise instead of escaping pdfmake's callback-only getBlob API.
        const fonts = { NotoSans: { normal: 'NotoSans-Regular.ttf', bold: 'NotoSans-Bold.ttf', italics: 'NotoSans-Regular.ttf', bolditalics: 'NotoSans-Bold.ttf' } };
        const stream = root.pdfMake.createPdf(definition, undefined, fonts).getStream();
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(new Blob(chunks, { type: 'application/pdf' })));
        stream.end();
      } catch (error) { reject(error); }
    });
    return { file: new File([blob], filename(record), { type: 'application/pdf' }), missing };
  }
  function download(file) {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url; link.download = file.name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function canShareFile(file, platform = navigator) {
    let supported = false;
    try { supported = typeof platform.share === 'function' && platform.canShare?.({ files: [file] }); } catch { /* Download fallback. */ }
    return !!supported;
  }
  async function share(file, platform = navigator, save = download) {
    if (!canShareFile(file, platform)) { await save(file); return 'downloaded'; }
    try { await platform.share({ title: 'Fieldnote', files: [file] }); return 'opened'; }
    catch (error) { return error?.name === 'AbortError' ? 'cancelled' : 'failed'; }
  }
  const api = { filename, documentDefinition, create, download, canShareFile, share };
  if (typeof module !== 'undefined') module.exports = api;
  else root.FieldnotePdf = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
