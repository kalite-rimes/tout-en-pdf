/* Tout en PDF : conversion de fichiers en PDF, entièrement dans le navigateur. */
(() => {
  'use strict';
  const { PDFDocument } = PDFLib;

  // ---------- Types de fichiers ----------
  const EXT = {
    image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'avif', 'ico', 'jfif', 'heic', 'heif', 'tif', 'tiff'],
    pdf: ['pdf'],
    docx: ['docx', 'docm', 'dotx'],
    sheet: ['xlsx', 'xlsm', 'xls', 'xlsb', 'ods', 'csv', 'tsv'],
    pptx: ['pptx', 'pptm', 'ppsx'],
    markdown: ['md', 'markdown'],
    html: ['html', 'htm', 'xhtml'],
    oldoffice: ['doc', 'ppt', 'odt', 'odp', 'rtf', 'pages', 'key', 'numbers'],
  };
  const COLORS = { image: '#2b8a6e', pdf: '#d6452f', docx: '#2b5797', sheet: '#1e7145', pptx: '#c43e1c',
    markdown: '#555', html: '#e0681f', text: '#6b6b70', unknown: '#999' };

  const ext = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');
  function kindOf(file) {
    const e = ext(file.name);
    for (const k in EXT) if (EXT[k].includes(e)) return k;
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.startsWith('text/') || /json|xml|javascript/.test(file.type)) return 'text';
    return 'sniff'; // décidé à la lecture
  }

  const PAGE = { A4: [595.28, 841.89], Letter: [612, 792] };
  const MARGIN = 28; // points, autour des images
  const VMARGIN = 42; // points, marges haute et basse des pages de documents

  // ---------- État et interface ----------
  const state = { items: [], busy: false, lastUrl: null };
  const $ = (id) => document.getElementById(id);
  const dz = $('dropzone'), input = $('fileInput'), list = $('fileList');
  let uid = 0;

  const fmtSize = (b) => b < 1024 ? b + ' o' : b < 1048576 ? (b / 1024).toFixed(0) + ' Ko' : (b / 1048576).toFixed(1).replace('.', ',') + ' Mo';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function addFiles(files) {
    for (const f of files) {
      const kind = kindOf(f);
      const item = { id: ++uid, file: f, kind, status: '', statusClass: '' };
      if (kind === 'oldoffice') {
        item.status = 'Format pas encore pris en charge : enregistrez-le en .docx, .pptx ou PDF.';
        item.statusClass = 'err';
      }
      if (kind === 'image') { try { item.thumb = URL.createObjectURL(f); } catch (e) {} }
      state.items.push(item);
    }
    if (state.items.length && $('fileName').dataset.touched !== '1') {
      const first = state.items[0].file.name.replace(/\.[^.]+$/, '');
      $('fileName').value = (first || 'mon-document').slice(0, 80);
    }
    render();
  }

  function render() {
    $('workspace').hidden = state.items.length === 0;
    $('count').textContent = state.items.length ? `(${state.items.length})` : '';
    list.innerHTML = '';
    state.items.forEach((it, i) => {
      const li = document.createElement('li');
      li.className = 'file';
      li.draggable = !state.busy;
      li.dataset.id = it.id;
      const e = ext(it.file.name).toUpperCase().slice(0, 4) || '?';
      const color = COLORS[it.kind] || COLORS.unknown;
      li.innerHTML = `
        <div class="thumb" style="background:${color}">${it.thumb ? `<img src="${it.thumb}" alt="">` : esc(e)}</div>
        <div class="f-info"><div class="f-name" title="${esc(it.file.name)}">${esc(it.file.name)}</div>
          <div class="f-meta ${it.statusClass}">${esc(it.status || fmtSize(it.file.size))}</div></div>
        <div class="f-btns">
          <button class="icon-btn" data-act="up" title="Monter" aria-label="Monter" ${i === 0 || state.busy ? 'disabled' : ''}>↑</button>
          <button class="icon-btn" data-act="down" title="Descendre" aria-label="Descendre" ${i === state.items.length - 1 || state.busy ? 'disabled' : ''}>↓</button>
          <button class="icon-btn" data-act="del" title="Retirer" aria-label="Retirer" ${state.busy ? 'disabled' : ''}>✕</button>
        </div>`;
      if (it.thumb) li.querySelector('img').onerror = function () { this.remove(); };
      list.appendChild(li);
    });
  }

  list.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn || state.busy) return;
    const id = +btn.closest('.file').dataset.id;
    const i = state.items.findIndex((x) => x.id === id);
    const act = btn.dataset.act;
    if (act === 'del') { const [it] = state.items.splice(i, 1); if (it.thumb) URL.revokeObjectURL(it.thumb); }
    if (act === 'up' && i > 0) [state.items[i - 1], state.items[i]] = [state.items[i], state.items[i - 1]];
    if (act === 'down' && i < state.items.length - 1) [state.items[i + 1], state.items[i]] = [state.items[i], state.items[i + 1]];
    hideResult(); render();
  });

  // Réorganisation par glisser-déposer
  let dragId = null;
  list.addEventListener('dragstart', (ev) => {
    const li = ev.target.closest('.file'); if (!li) return;
    dragId = +li.dataset.id; li.classList.add('dragging');
    ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', String(dragId));
  });
  list.addEventListener('dragend', () => { dragId = null; render(); });
  list.addEventListener('dragover', (ev) => {
    if (dragId == null) return;
    ev.preventDefault();
    const li = ev.target.closest('.file');
    list.querySelectorAll('.file').forEach((x) => x.classList.remove('drop-before', 'drop-after'));
    if (!li || +li.dataset.id === dragId) return;
    const r = li.getBoundingClientRect();
    li.classList.add(ev.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
  });
  list.addEventListener('drop', (ev) => {
    if (dragId == null) return;
    ev.preventDefault(); ev.stopPropagation();
    const li = ev.target.closest('.file');
    if (li && +li.dataset.id !== dragId) {
      const after = li.classList.contains('drop-after');
      const from = state.items.findIndex((x) => x.id === dragId);
      const [moved] = state.items.splice(from, 1);
      let to = state.items.findIndex((x) => x.id === +li.dataset.id);
      state.items.splice(after ? to + 1 : to, 0, moved);
      hideResult();
    }
    dragId = null; render();
  });

  // Zone de dépôt
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach((t) => window.addEventListener(t, (e) => {
    if (dragId != null) return;
    if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); dz.classList.add('over'); }
  }));
  ['dragleave', 'drop'].forEach((t) => window.addEventListener(t, (e) => {
    if (t === 'dragleave' && e.relatedTarget) return;
    dz.classList.remove('over');
  }));
  window.addEventListener('drop', (e) => {
    if (dragId != null) return;
    if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); if (!state.busy) addFiles(e.dataTransfer.files); }
  });
  // Coller une image depuis le presse-papiers
  window.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length && !state.busy) addFiles(files);
  });

  $('fileName').addEventListener('input', (e) => { e.target.dataset.touched = '1'; });
  $('clearBtn').addEventListener('click', () => {
    if (state.busy) return;
    state.items.forEach((it) => it.thumb && URL.revokeObjectURL(it.thumb));
    state.items = []; $('fileName').dataset.touched = ''; hideResult(); render();
  });

  function hideResult() { $('result').hidden = true; }
  function setProgress(frac, text) {
    $('progress').hidden = false;
    $('bar').style.width = Math.round(Math.min(1, frac) * 100) + '%';
    $('progressText').textContent = text;
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));

  // ---------- Conversion ----------
  $('convertBtn').addEventListener('click', convertAll);

  async function convertAll() {
    if (state.busy || !state.items.length) return;
    const mode = document.querySelector('input[name=mode]:checked').value;
    const size = document.querySelector('input[name=size]:checked').value;
    const baseName = ($('fileName').value.trim() || 'mon-document').replace(/[\\/:*?"<>|]+/g, '-');
    state.busy = true; $('convertBtn').disabled = true; hideResult();
    state.items.forEach((it) => { if (it.kind !== 'oldoffice') { it.status = 'En attente…'; it.statusClass = ''; } });
    render();

    const results = []; const errors = [];
    const merged = mode === 'merge' ? await PDFDocument.create() : null;
    const todo = state.items.filter((it) => it.kind !== 'oldoffice');
    state.items.filter((it) => it.kind === 'oldoffice').forEach((it) => errors.push([it.file.name, it.status]));

    for (let i = 0; i < todo.length; i++) {
      const it = todo[i];
      it.status = 'Conversion…'; render();
      setProgress(i / todo.length, `Fichier ${i + 1} sur ${todo.length} : ${it.file.name}`);
      await tick();
      try {
        const doc = merged || await PDFDocument.create();
        const before = doc.getPageCount();
        await convertFile(it, doc, size, (f) => setProgress((i + f) / todo.length, `Fichier ${i + 1} sur ${todo.length} : ${it.file.name}`));
        const added = doc.getPageCount() - before;
        if (!added) throw new Error('Le fichier semble vide.');
        it.status = `✓ ${added} page${added > 1 ? 's' : ''}`; it.statusClass = 'ok';
        if (!merged) results.push([it.file.name.replace(/\.[^.]+$/, '') + '.pdf', doc]);
      } catch (err) {
        console.error(err);
        it.status = '✕ ' + (err.userMessage || err.message || 'Conversion impossible'); it.statusClass = 'err';
        errors.push([it.file.name, it.status.slice(2)]);
      }
      render();
    }

    setProgress(1, 'Finalisation…'); await tick();
    let blob = null, outName = '';
    try {
      if (merged && merged.getPageCount()) {
        setMeta(merged, baseName);
        blob = new Blob([await merged.save()], { type: 'application/pdf' }); outName = baseName + '.pdf';
      } else if (results.length === 1) {
        setMeta(results[0][1], baseName);
        blob = new Blob([await results[0][1].save()], { type: 'application/pdf' }); outName = baseName + '.pdf';
      } else if (results.length > 1) {
        const zip = new JSZip(); const used = new Set();
        for (const [n, d] of results) {
          let name = n, k = 2; while (used.has(name)) name = n.replace(/\.pdf$/, ` (${k++}).pdf`);
          used.add(name); setMeta(d, name.replace(/\.pdf$/, ''));
          zip.file(name, await d.save());
        }
        blob = await zip.generateAsync({ type: 'blob' }); outName = baseName + '.zip';
      }
    } catch (err) { console.error(err); errors.push(['', 'Impossible de créer le fichier final.']); }

    showResult(blob, outName, errors);
    $('progress').hidden = true;
    state.busy = false; $('convertBtn').disabled = false; render();
  }

  function setMeta(doc, title) {
    doc.setTitle(title); doc.setProducer('Tout en PDF'); doc.setCreator('Tout en PDF');
    doc.setCreationDate(new Date()); doc.setModificationDate(new Date());
  }

  function showResult(blob, name, errors) {
    const box = $('result');
    if (state.lastUrl) URL.revokeObjectURL(state.lastUrl);
    let html = '';
    if (blob) {
      state.lastUrl = URL.createObjectURL(blob);
      html += `<strong>Votre fichier est prêt.</strong> (${fmtSize(blob.size)})<br>
        <a class="btn" href="${state.lastUrl}" download="${esc(name)}">⬇ Télécharger ${esc(name)}</a>`;
      box.className = 'result ok';
    } else {
      html += '<strong>Aucun PDF n\'a pu être créé.</strong>'; box.className = 'result';
    }
    if (errors.length) html += `<ul>${errors.map(([n, m]) => `<li>${n ? `<b>${esc(n)}</b> : ` : ''}${esc(m)}</li>`).join('')}</ul>`;
    box.innerHTML = html; box.hidden = false;
    if (blob) box.querySelector('a').click(); // téléchargement automatique
  }

  const userError = (msg) => Object.assign(new Error(msg), { userMessage: msg });

  async function convertFile(it, doc, size, onProg) {
    const buf = await it.file.arrayBuffer();
    let kind = it.kind;
    if (kind === 'sniff') kind = sniff(buf);
    switch (kind) {
      case 'pdf': return addPdf(doc, buf);
      case 'image': return addImage(doc, it.file, size);
      case 'docx': return addDocx(doc, buf, size, onProg);
      case 'sheet': return addSheet(doc, buf, it.file.name, size, onProg);
      case 'pptx': return addPptx(doc, buf, onProg);
      case 'markdown': return addHtml(doc, docCss() + `<div class="doc">${marked.parse(decodeText(buf))}</div>`, size, onProg);
      case 'html': return addHtml(doc, cleanHtml(decodeText(buf)), size, onProg, true);
      case 'text': return addHtml(doc, docCss() + `<pre class="plain">${esc(decodeText(buf))}</pre>`, size, onProg);
      default: throw userError('Format non reconnu. Essayez une image, un PDF, un document Office ou un fichier texte.');
    }
  }

  function sniff(buf) {
    const b = new Uint8Array(buf.slice(0, 4096));
    const s = String.fromCharCode(...b.slice(0, 5));
    if (s.startsWith('%PDF')) return 'pdf';
    if (b[0] === 0xff && b[1] === 0xd8) return 'image';
    if (b[0] === 0x89 && s.slice(1, 4) === 'PNG') return 'image';
    if (s.startsWith('GIF8')) return 'image';
    if (b[0] === 0x50 && b[1] === 0x4b) {
      const head = new TextDecoder('latin1').decode(b);
      if (head.includes('word/')) return 'docx';
      if (head.includes('xl/')) return 'sheet';
      if (head.includes('ppt/')) return 'pptx';
      return 'unknown';
    }
    if (b.includes(0)) return 'unknown';
    return 'text';
  }

  function decodeText(buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
    catch (e) { return new TextDecoder('windows-1252').decode(buf); }
  }

  // PDF existant : on recopie ses pages
  async function addPdf(doc, buf) {
    let src;
    try { src = await PDFDocument.load(buf, { ignoreEncryption: true }); }
    catch (e) { throw userError('PDF illisible ou endommagé.'); }
    if (src.isEncrypted) throw userError('Ce PDF est protégé par un mot de passe.');
    const pages = await doc.copyPages(src, src.getPageIndices());
    pages.forEach((p) => doc.addPage(p));
  }

  // Images : redessinées sur un canevas (orientation des photos respectée, tous formats lus par le navigateur)
  async function addImage(doc, file, size) {
    const url = URL.createObjectURL(file);
    let img;
    try {
      img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    } catch (e) {
      URL.revokeObjectURL(url);
      const e2 = ext(file.name);
      throw userError(['heic', 'heif'].includes(e2) ? 'Les photos HEIC (iPhone) ne sont pas lues par ce navigateur. Essayez avec Safari, ou exportez-la en JPG.'
        : ['tif', 'tiff'].includes(e2) ? 'Les images TIFF ne sont pas lues par ce navigateur. Exportez-la en PNG ou JPG.' : 'Image illisible.');
    }
    let w = img.naturalWidth || 1000, h = img.naturalHeight || 1000;
    const isSvg = ext(file.name) === 'svg' || file.type === 'image/svg+xml';
    if (isSvg && Math.max(w, h) < 1600) { const k = 1600 / Math.max(w, h); w *= k; h *= k; }
    const MAX = 5000;
    if (Math.max(w, h) > MAX) { const k = MAX / Math.max(w, h); w *= k; h *= k; }
    w = Math.round(w); h = Math.round(h);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const keepPng = /png|gif|svg|webp|ico|bmp|avif/.test(file.type) || ['png', 'gif', 'svg', 'webp', 'ico', 'bmp', 'avif'].includes(ext(file.name));
    if (!keepPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const usePng = keepPng && hasAlpha(ctx, w, h);
    const blob = await new Promise((r) => c.toBlob(r, usePng ? 'image/png' : 'image/jpeg', 0.92));
    if (!usePng && keepPng) {} // fond déjà opaque
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const emb = usePng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    // Taille physique : 96 ppp => 0,75 pt par pixel d'origine
    const natW = (img.naturalWidth || w) * 0.75, natH = (img.naturalHeight || h) * 0.75;
    if (size === 'fit') {
      const page = doc.addPage([natW, natH]);
      page.drawImage(emb, { x: 0, y: 0, width: natW, height: natH });
      return;
    }
    let [pw, ph] = PAGE[size];
    if (w > h) [pw, ph] = [ph, pw];
    const page = doc.addPage([pw, ph]);
    const k = Math.min((pw - 2 * MARGIN) / natW, (ph - 2 * MARGIN) / natH, 1.0 * Infinity);
    const dw = natW * k, dh = natH * k;
    page.drawImage(emb, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
  }

  function hasAlpha(ctx, w, h) {
    // échantillonnage rapide des pixels transparents
    const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 40000)));
    const d = ctx.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (d[(y * w + x) * 4 + 3] < 250) return true;
    return false;
  }

  // ---------- Rendu HTML -> pages ----------
  function docCss(extra = '') {
    return `<style>
      html,body{margin:0;background:#fff;color:#1d1d1f}
      body{padding:0 68px;font:15px/1.55 Georgia,"Times New Roman",serif;word-wrap:break-word;overflow-wrap:anywhere}
      .doc h1,.doc h2,.doc h3,.doc h4{font-family:Arial,Helvetica,sans-serif;line-height:1.25;margin:1.2em 0 .5em}
      .doc h1{font-size:28px}.doc h1.title{font-size:34px;margin-top:0}.doc>:first-child{margin-top:0}.doc h2{font-size:22px}.doc h3{font-size:18px}
      .doc p{margin:0 0 .8em}.doc img{max-width:100%;height:auto}
      .doc table{border-collapse:collapse;margin:.6em 0;max-width:100%}
      .doc td,.doc th{border:1px solid #bbb;padding:4px 7px;vertical-align:top}
      .doc pre,.doc code{font-family:Consolas,Menlo,monospace;font-size:13px;background:#f3f3f3}
      .doc pre{padding:10px;white-space:pre-wrap}
      .doc blockquote{border-left:3px solid #ccc;margin:0 0 .8em;padding-left:12px;color:#555}
      pre.plain{margin:0;font:12.5px/1.5 Consolas,Menlo,"Courier New",monospace;white-space:pre-wrap;word-break:break-word}
      ${extra}</style>`;
  }

  function cleanHtml(src) {
    // supprime scripts, redirections et <base> ; le rendu se fait dans un cadre isolé sans JavaScript
    return src.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<meta[^>]+http-equiv\s*=\s*["']?refresh[^>]*>/gi, '')
      .replace(/<base[^>]*>/gi, '');
  }

  function makeFrame(width) {
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-same-origin');
    f.style.cssText = `width:${width}px;height:1200px;border:0;background:#fff`;
    $('renderHost').appendChild(f);
    return f;
  }

  async function loadFrame(f, html) {
    await new Promise((res) => { f.onload = res; f.srcdoc = html; setTimeout(res, 8000); });
    const d = f.contentDocument;
    // attendre images et polices
    await Promise.all([...d.images].map((im) => im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; setTimeout(r, 6000); })));
    if (d.fonts && d.fonts.ready) await Promise.race([d.fonts.ready, new Promise((r) => setTimeout(r, 3000))]);
    return d;
  }

  /** Rend du HTML (document complet ou fragment) et l'ajoute en pages au PDF. */
  async function addHtml(doc, html, size, onProg = () => {}, isFullDoc = false) {
    const [pw, ph] = PAGE[size] || PAGE.A4;
    const baseW = Math.round(pw / 0.75); // 794 px pour A4
    const f = makeFrame(baseW);
    try {
      const d = await loadFrame(f, isFullDoc ? html : `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`);
      if (isFullDoc && !getComputedStyle(d.body).backgroundColor.match(/rgba?\((?!0, 0, 0, 0)/)) d.documentElement.style.background = '#fff';
      // contenu plus large que la page (grand tableau) : on élargit puis on réduit à l'impression
      let width = Math.max(baseW, Math.ceil(d.documentElement.scrollWidth), Math.ceil(d.body.scrollWidth));
      width = Math.min(width, baseW * 4);
      f.style.width = width + 'px';
      f.style.height = '0px';
      await tick();
      const total = Math.max(1, Math.ceil(Math.max(d.documentElement.scrollHeight, d.body.scrollHeight)));
      f.style.height = total + 'px';
      await rasterizeToPages(doc, d.documentElement, width, total, pw, ph, onProg);
    } finally { f.remove(); }
  }

  async function rasterizeToPages(doc, root, width, total, pw, ph, onProg) {
    const scale = width > 1600 ? 1.5 : 2;
    const pageCss = width * (ph - 2 * VMARGIN) / pw; // hauteur utile d'une page en px CSS
    const chunkCss = Math.max(pageCss, Math.floor(12000 / scale)); // limite de taille des canevas
    let y = 0;
    while (y < total - 1) {
      const h = Math.min(chunkCss, total - y);
      const isLast = y + h >= total - 1;
      const canvas = await html2canvas(root, {
        scale, backgroundColor: '#ffffff', useCORS: true, logging: false,
        x: 0, y, width, height: h, windowWidth: width, windowHeight: total, scrollX: 0, scrollY: 0,
      });
      const pageC = pageCss * scale * (canvas.width / (width * scale));
      let local = 0;
      while (local < canvas.height - 2) {
        const remaining = canvas.height - local;
        let cut;
        if (remaining <= pageC) { if (!isLast) break; cut = canvas.height; }
        else cut = findCut(canvas, local, local + pageC);
        await addSlice(doc, canvas, local, cut, pw, ph, pageC);
        local = cut;
      }
      const advanced = local / (canvas.height / h);
      y += advanced > 0 ? advanced : h;
      onProg(Math.min(0.99, y / total));
      await tick();
    }
  }

  // Cherche une ligne blanche juste avant la fin de page pour ne pas couper le texte en deux
  function findCut(canvas, start, target) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const t = Math.floor(target), minY = Math.floor(target - (target - start) * 0.18);
    const w = canvas.width;
    const data = ctx.getImageData(0, minY, w, t - minY).data;
    for (let row = t - minY - 1; row >= 0; row--) {
      const off = row * w * 4;
      const r0 = data[off], g0 = data[off + 1], b0 = data[off + 2];
      let uniform = true;
      for (let x = 0; x < w; x += 2) {
        const i = off + x * 4;
        if (Math.abs(data[i] - r0) > 12 || Math.abs(data[i + 1] - g0) > 12 || Math.abs(data[i + 2] - b0) > 12) { uniform = false; break; }
      }
      if (uniform) return minY + row + 1;
    }
    return t;
  }

  async function addSlice(doc, canvas, y0, y1, pw, ph, pageC) {
    const hh = Math.max(1, Math.round(y1 - y0));
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = hh;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, hh);
    ctx.drawImage(canvas, 0, Math.round(y0), canvas.width, hh, 0, 0, canvas.width, hh);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    const emb = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const page = doc.addPage([pw, ph]);
    const drawH = (ph - 2 * VMARGIN) * (hh / pageC);
    page.drawImage(emb, { x: 0, y: ph - VMARGIN - drawH, width: pw, height: drawH });
  }

  // ---------- Word ----------
  async function addDocx(doc, buf, size, onProg) {
    let res;
    try { res = await mammoth.convertToHtml({ arrayBuffer: buf }, { styleMap: ["p[style-name='Title'] => h1.title:fresh", "p[style-name='Subtitle'] => h2:fresh"] }); }
    catch (e) { throw userError('Document Word illisible (seul le format .docx est pris en charge).'); }
    await addHtml(doc, docCss() + `<div class="doc">${res.value || ''}</div>`, size, onProg);
  }

  // ---------- Excel / CSV ----------
  async function addSheet(doc, buf, name, size, onProg) {
    const e = ext(name);
    let wb;
    try {
      wb = (e === 'csv' || e === 'tsv')
        ? XLSX.read(decodeText(buf), { type: 'string', FS: e === 'tsv' ? '\t' : undefined, raw: false })
        : XLSX.read(buf, { type: 'array', cellDates: true });
    } catch (err) { throw userError('Classeur illisible.'); }
    const sheets = wb.SheetNames.filter((n) => wb.Sheets[n] && wb.Sheets[n]['!ref']);
    if (!sheets.length) throw userError('Le classeur est vide.');
    for (let i = 0; i < sheets.length; i++) {
      const ws = wb.Sheets[sheets[i]];
      let table = XLSX.utils.sheet_to_html(ws, { header: '', footer: '' });
      const css = docCss(`body{padding:0 40px;font:12px/1.35 Arial,Helvetica,sans-serif}
        h2{font:bold 16px Arial,sans-serif;margin:0 0 12px}
        table{border-collapse:collapse}td{border:1px solid #c8c8c8;padding:3px 6px;white-space:nowrap;vertical-align:top}
        tr:first-child td{background:#f0f0f0;font-weight:bold}`);
      const title = sheets.length > 1 || !['csv', 'tsv'].includes(e) ? `<h2>${esc(sheets[i])}</h2>` : '';
      await addHtml(doc, css + title + table, size, (f) => onProg((i + f) / sheets.length));
    }
  }

  // ---------- PowerPoint ----------
  const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
  const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const EMU_PT = 12700;

  async function addPptx(doc, buf, onProg) {
    let zip;
    try { zip = await JSZip.loadAsync(buf); } catch (e) { throw userError('Présentation illisible (seul le format .pptx est pris en charge).'); }
    const xml = async (p) => { const f = zip.file(p); return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null; };
    const rels = async (p) => {
      const dir = p.slice(0, p.lastIndexOf('/'));
      const r = await xml(`${dir}/_rels/${p.slice(p.lastIndexOf('/') + 1)}.rels`);
      const m = {};
      if (r) for (const el of r.getElementsByTagName('Relationship')) {
        m[el.getAttribute('Id')] = { target: resolvePath(dir, el.getAttribute('Target')), type: el.getAttribute('Type') || '' };
      }
      return m;
    };
    const pres = await xml('ppt/presentation.xml');
    if (!pres) throw userError('Présentation illisible.');
    const sz = pres.getElementsByTagNameNS(NS_P, 'sldSz')[0];
    const cx = +(sz?.getAttribute('cx') || 12192000), cy = +(sz?.getAttribute('cy') || 6858000);
    const presRels = await rels('ppt/presentation.xml');
    const slidePaths = [...pres.getElementsByTagNameNS(NS_P, 'sldId')].map((el) => presRels[el.getAttributeNS(NS_R, 'id')]?.target).filter(Boolean);
    if (!slidePaths.length) throw userError('La présentation ne contient aucune diapositive.');

    const W = 1280, H = Math.round(W * cy / cx), k = W / cx; // px par EMU
    const pw = 841.89, ph = pw * cy / cx;
    const mediaCache = {};
    const media = async (path) => {
      if (mediaCache[path]) return mediaCache[path];
      const f = zip.file(path); if (!f) return null;
      const e = ext(path); const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', bmp: 'image/bmp', webp: 'image/webp' }[e];
      if (!mime) return null; // emf/wmf non affichables
      return (mediaCache[path] = `data:${mime};base64,${await f.async('base64')}`);
    };

    for (let s = 0; s < slidePaths.length; s++) {
      const sp = slidePaths[s];
      const slide = await xml(sp); if (!slide) continue;
      const sRels = await rels(sp);
      const layoutPath = Object.values(sRels).find((r) => r.type.endsWith('/slideLayout'))?.target;
      const layout = layoutPath ? await xml(layoutPath) : null;
      const lRels = layoutPath ? await rels(layoutPath) : {};
      const masterPath = Object.values(lRels).find((r) => r.type.endsWith('/slideMaster'))?.target;
      const master = masterPath ? await xml(masterPath) : null;
      const inherit = (type, idx) => {
        for (const src of [layout, master]) {
          if (!src) continue;
          for (const ph of src.getElementsByTagNameNS(NS_P, 'ph')) {
            const t = ph.getAttribute('type') || 'body', i = ph.getAttribute('idx');
            if ((idx != null && i === idx) || (t === type)) {
              let shape = ph; while (shape && shape.localName !== 'sp') shape = shape.parentNode;
              const x = xfrmOf(shape); if (x) return x;
            }
          }
        }
        return null;
      };

      let bg = '#ffffff';
      const bgClr = slide.getElementsByTagNameNS(NS_P, 'bg')[0]?.getElementsByTagNameNS(NS_A, 'srgbClr')[0];
      if (bgClr) bg = '#' + bgClr.getAttribute('val');

      let body = '';
      const spTree = slide.getElementsByTagNameNS(NS_P, 'spTree')[0];
      const shapes = spTree ? [...spTree.querySelectorAll('*')].filter((n) => n.namespaceURI === NS_P && (n.localName === 'sp' || n.localName === 'pic')) : [];
      let z = 0;
      for (const shp of shapes) {
        z++;
        const ph = shp.getElementsByTagNameNS(NS_P, 'ph')[0];
        const phType = ph ? (ph.getAttribute('type') || 'body') : null;
        let box = xfrmOf(shp) || (ph ? inherit(phType, ph.getAttribute('idx')) : null);
        if (!box) box = { x: cx * 0.06, y: cy * (phType === 'title' || phType === 'ctrTitle' ? 0.05 : 0.25), w: cx * 0.88, h: cy * 0.6 };
        const pos = `left:${box.x * k}px;top:${box.y * k}px;width:${box.w * k}px;height:${box.h * k}px;z-index:${z}`;
        if (shp.localName === 'pic') {
          const blip = shp.getElementsByTagNameNS(NS_A, 'blip')[0];
          const rid = blip?.getAttributeNS(NS_R, 'embed');
          const src = rid && sRels[rid] ? await media(sRels[rid].target) : null;
          if (src) body += `<img style="position:absolute;${pos};object-fit:contain" src="${src}">`;
          continue;
        }
        const fill = shp.getElementsByTagNameNS(NS_P, 'spPr')[0]?.getElementsByTagNameNS(NS_A, 'solidFill')[0]?.getElementsByTagNameNS(NS_A, 'srgbClr')[0];
        const isTitle = phType === 'title' || phType === 'ctrTitle';
        const defPt = isTitle ? 36 : phType === 'subTitle' ? 22 : ph ? 20 : 18;
        const bullets = phType === 'body' || phType === 'obj' || (ph && !isTitle && phType !== 'subTitle' && phType !== 'sldNum' && phType !== 'dt' && phType !== 'ftr');
        if (phType === 'sldNum' || phType === 'dt' || phType === 'ftr') continue;
        const anchor = shp.getElementsByTagNameNS(NS_A, 'bodyPr')[0]?.getAttribute('anchor');
        const vAlign = anchor === 'ctr' ? 'center' : anchor === 'b' ? 'flex-end' : isTitle ? 'center' : 'flex-start';
        let paras = '';
        for (const p of shp.getElementsByTagNameNS(NS_A, 'p')) {
          const pPr = p.getElementsByTagNameNS(NS_A, 'pPr')[0];
          const lvl = +(pPr?.getAttribute('lvl') || 0);
          const algn = { ctr: 'center', r: 'right', just: 'justify' }[pPr?.getAttribute('algn')] || (phType === 'ctrTitle' || phType === 'subTitle' ? 'center' : 'left');
          let runs = '';
          let firstPt = null;
          for (const r of p.childNodes) {
            if (r.namespaceURI !== NS_A) continue;
            if (r.localName === 'br') { runs += '<br>'; continue; }
            if (r.localName !== 'r' && r.localName !== 'fld') continue;
            const t = r.getElementsByTagNameNS(NS_A, 't')[0]?.textContent || '';
            const rPr = r.getElementsByTagNameNS(NS_A, 'rPr')[0];
            const pt = rPr?.getAttribute('sz') ? +rPr.getAttribute('sz') / 100 : defPt;
            if (firstPt == null) firstPt = pt;
            const clr = rPr?.getElementsByTagNameNS(NS_A, 'srgbClr')[0]?.getAttribute('val');
            const st = [`font-size:${pt * EMU_PT * k}px`];
            if (rPr?.getAttribute('b') === '1' || isTitle) st.push('font-weight:bold');
            if (rPr?.getAttribute('i') === '1') st.push('font-style:italic');
            if (rPr?.getAttribute('u') && rPr.getAttribute('u') !== 'none') st.push('text-decoration:underline');
            if (clr) st.push('color:#' + clr);
            runs += `<span style="${st.join(';')}">${esc(t)}</span>`;
          }
          const hasText = runs.replace(/<[^>]+>/g, '').trim();
          const noBullet = pPr?.getElementsByTagNameNS(NS_A, 'buNone')[0];
          const bu = hasText && bullets && !noBullet ? '<span style="margin-right:.5em">•</span>' : '';
          const fs = (firstPt || defPt) * EMU_PT * k;
          paras += `<p style="margin:0 0 ${fs * 0.3}px ${lvl * fs * 1.2}px;text-align:${algn};font-size:${fs}px;line-height:1.2">${bu}${runs || '&nbsp;'}</p>`;
        }
        if (!paras.replace(/<[^>]+>|&nbsp;/g, '').trim() && !fill) continue;
        body += `<div style="position:absolute;${pos};display:flex;flex-direction:column;justify-content:${vAlign};padding:${0.1 * 72 * EMU_PT * k}px;box-sizing:border-box;overflow:hidden;${fill ? `background:#${fill.getAttribute('val')};` : ''}">${paras}</div>`;
      }

      const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:${bg}}
        body{width:${W}px;height:${H}px;position:relative;overflow:hidden;font-family:Calibri,Carlito,Arial,Helvetica,sans-serif;color:#222}</style></head><body>${body}</body></html>`;
      const f = makeFrame(W); f.style.height = H + 'px';
      try {
        const d = await loadFrame(f, html);
        const canvas = await html2canvas(d.documentElement, { scale: 1.5, backgroundColor: bg, useCORS: true, logging: false, width: W, height: H, windowWidth: W, windowHeight: H });
        const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
        const emb = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        doc.addPage([pw, ph]).drawImage(emb, { x: 0, y: 0, width: pw, height: ph });
      } finally { f.remove(); }
      onProg((s + 1) / slidePaths.length);
      await tick();
    }
  }

  function xfrmOf(shape) {
    if (!shape) return null;
    const x = [...shape.getElementsByTagNameNS(NS_A, 'xfrm')][0];
    const off = x?.getElementsByTagNameNS(NS_A, 'off')[0], ex = x?.getElementsByTagNameNS(NS_A, 'ext')[0];
    if (!off || !ex) return null;
    return { x: +off.getAttribute('x'), y: +off.getAttribute('y'), w: +ex.getAttribute('cx'), h: +ex.getAttribute('cy') };
  }

  function resolvePath(dir, target) {
    if (target.startsWith('/')) return target.slice(1);
    const parts = (dir + '/' + target).split('/'); const out = [];
    for (const p of parts) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
    return out.join('/');
  }
})();
