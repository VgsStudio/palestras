// Editor visual local para os decks de palestra.
// Zero build, zero dependência — File System Access API (Chrome/Edge only).
//
// Modelo: lemos o index.html original UMA vez em `sourceDoc` (nunca
// executado, nunca tocado pelo chassis.js) — é dele que salvamos. O
// <iframe> mostra uma CÓPIA (`previewDoc`) com scripts removidos, imagens
// locais trocadas por blob URLs, e uma <style> extra forçando todo
// conteúdo "reveal" a aparecer (sem animação, mas sem nada escondido
// esperando scroll). Como as duas árvores são estruturalmente idênticas,
// pareamos os elementos folha de texto/imagem por ordem de travessia —
// editar no preview grava direto no par correspondente do sourceDoc.

const SKIP_DIRS = new Set(['.git', '.github', '.claude', '_editor', 'scripts', 'dist', 'node_modules']);
const INLINE_TAGS = new Set(['EM', 'STRONG', 'B', 'I', 'BR']);

const els = {
  btnOpen: document.getElementById('btn-open'),
  talkPicker: document.getElementById('talk-picker'),
  editMode: document.getElementById('edit-mode'),
  btnSave: document.getElementById('btn-save'),
  status: document.getElementById('status'),
  slideNav: document.getElementById('slide-nav'),
  preview: document.getElementById('preview'),
  zoomOut: document.getElementById('zoom-out'),
  zoomIn: document.getElementById('zoom-in'),
  zoomReset: document.getElementById('zoom-reset'),
  zoomLevel: document.getElementById('zoom-level'),
};

let rootHandle = null;
let talkHandle = null;
let sourceDoc = null;
let docPrefix = ''; // whatever text (if any) came before <html> in the original file
let slidePairs = []; // [{sourceSlide, previewSlide, label}]
let currentSlide = 0;
let dirty = false;
let talks = []; // [{label, path, dirHandle}]
let zoomFactor = 1; // multiplier on top of the auto fit-to-iframe scale

function computeFitScale() {
  const win = els.preview.contentWindow;
  if (!win) return 1;
  return Math.min(win.innerWidth / 1920, win.innerHeight / 1080);
}

function applyZoom() {
  const doc = els.preview.contentDocument;
  if (!doc) return;
  const scale = computeFitScale() * zoomFactor;
  doc.documentElement.style.setProperty('--slide-scale', scale);
  els.zoomLevel.textContent = `${Math.round(zoomFactor * 100)}%`;
}

function setStatus(text, kind) {
  els.status.textContent = text;
  els.status.className = 'status' + (kind ? ' ' + kind : '');
}

function markDirty() {
  dirty = true;
  els.btnSave.disabled = false;
  setStatus('alterações não salvas', '');
}

// ---------- Discover talk folders ----------

async function findTalks(dir) {
  const found = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== 'directory' || SKIP_DIRS.has(name)) continue;
    if (name === '_rascunhos') {
      for await (const [subName, subHandle] of handle.entries()) {
        if (subHandle.kind !== 'directory') continue;
        if (await hasIndexHtml(subHandle)) {
          found.push({ label: `[rascunho] ${subName}`, path: `_rascunhos/${subName}`, dirHandle: subHandle });
        }
      }
      continue;
    }
    if (await hasIndexHtml(handle)) {
      found.push({ label: name, path: name, dirHandle: handle });
    }
  }
  found.sort((a, b) => a.label.localeCompare(b.label));
  return found;
}

async function hasIndexHtml(dirHandle) {
  try {
    await dirHandle.getFileHandle('index.html');
    return true;
  } catch {
    return false;
  }
}

// ---------- Image resolution (source-relative path -> blob URL) ----------

async function readFileAt(dirHandle, relPath) {
  const parts = relPath.split('/').filter(Boolean);
  let dir = dirHandle;
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i]);
  }
  const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);
  return fileHandle.getFile();
}

async function writeFileAt(dirHandle, relPath, fileOrBlob) {
  const parts = relPath.split('/').filter(Boolean);
  let dir = dirHandle;
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i], { create: true });
  }
  const fileHandle = await dir.getFileHandle(parts[parts.length - 1], { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(fileOrBlob);
  await writable.close();
}

// ---------- Field model ----------

function isLeafTextEl(el) {
  if (el.tagName === 'IMG' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return false;
  const kids = Array.from(el.children);
  const leafByChildren = kids.length === 0 || kids.every((c) => INLINE_TAGS.has(c.tagName));
  return leafByChildren && el.textContent.trim().length > 0;
}

// Walks a slide, collecting: leaf text elements, <img> elements, and
// empty `.slot.empty` placeholders (candidates to receive a first image).
function collectFields(slideEl) {
  const texts = [];
  const images = [];
  const emptySlots = [];
  (function walk(node) {
    for (const child of Array.from(node.children)) {
      if (child.tagName === 'IMG') {
        images.push(child);
        continue;
      }
      if (child.classList && child.classList.contains('slot') && child.classList.contains('empty')) {
        emptySlots.push(child);
        continue; // don't descend into the hint span
      }
      if (isLeafTextEl(child)) {
        texts.push(child);
        continue;
      }
      walk(child);
    }
  })(slideEl);
  return { texts, images, emptySlots };
}

function sanitizeInline(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  (function clean(node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== 1) continue;
      if (!INLINE_TAGS.has(child.tagName)) {
        while (child.firstChild) node.insertBefore(child.firstChild, child);
        node.removeChild(child);
        continue;
      }
      for (const attr of Array.from(child.attributes)) child.removeAttribute(attr.name);
      clean(child);
    }
  })(tmp);
  return tmp.innerHTML.trim();
}

// ---------- Opening a talk ----------

async function openTalk(entry) {
  talkHandle = entry.dirHandle;
  setStatus('carregando…', '');

  const fileHandle = await talkHandle.getFileHandle('index.html');
  const file = await fileHandle.getFile();
  const text = await file.text();

  const htmlStart = text.search(/<html[\s>]/i);
  docPrefix = htmlStart > 0 ? text.slice(0, htmlStart) : '';

  const parser = new DOMParser();
  sourceDoc = parser.parseFromString(text, 'text/html');

  const previewDoc = parser.parseFromString(text, 'text/html');
  previewDoc.querySelectorAll('script').forEach((s) => s.remove());
  const overrideStyle = previewDoc.createElement('style');
  overrideStyle.id = '__editor_preview_override';
  overrideStyle.textContent = `
    .reveal,.reveal-left,.reveal-right,.reveal-scale,.reveal-blur,.step{
      opacity:1 !important; transform:none !important; filter:none !important;
    }
    .slide-viewport{display:none !important;}
    .slide-viewport.__editor-active{display:block !important;}
    .nav-dots,.keyboard-hint,.chassis-credit,.chassis-cursor{display:none !important;}
    /* o deck original esconde o cursor real e desenha um falso via JS
       (chassis-cursor) — como a gente nunca roda esse JS aqui, sem isto
       o mouse fica invisível dentro do preview. */
    body.chassis-cursor-active, body.chassis-cursor-active *{cursor:auto !important;}
    html.__editor-edit-mode [data-editor-editable="true"]:hover{outline:2px dashed #ff6a21; outline-offset:2px; cursor:pointer !important;}
    html.__editor-edit-mode [data-editor-editable="true"][contenteditable="true"]:focus{outline:2px solid #ff6a21; outline-offset:2px; cursor:text !important;}
  `;
  previewDoc.head.appendChild(overrideStyle);

  for (const img of Array.from(previewDoc.querySelectorAll('img'))) {
    const src = img.getAttribute('src') || '';
    if (!src || /^https?:/i.test(src)) continue;
    try {
      const imgFile = await readFileAt(talkHandle, src);
      img.setAttribute('src', URL.createObjectURL(imgFile));
    } catch (err) {
      console.warn('could not load image', src, err);
    }
  }

  const blob = new Blob([docPrefix + previewDoc.documentElement.outerHTML], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  await new Promise((resolve) => {
    els.preview.onload = resolve;
    els.preview.src = url;
  });

  buildSlidePairs();
  renderSlideNav();
  currentSlide = 0;
  goToSlide(0);

  zoomFactor = 1;
  applyZoom();

  dirty = false;
  els.btnSave.disabled = true;
  els.editMode.disabled = false;
  els.editMode.checked = false;
  els.zoomOut.disabled = false;
  els.zoomIn.disabled = false;
  els.zoomReset.disabled = false;
  setStatus(`${entry.label} — ${slidePairs.length} slide(s)`, 'ok');
}

function buildSlidePairs() {
  const sourceSlides = Array.from(sourceDoc.querySelectorAll('.slide-viewport'));
  const previewSlides = Array.from(els.preview.contentDocument.querySelectorAll('.slide-viewport'));
  if (sourceSlides.length !== previewSlides.length) {
    console.warn('slide count mismatch between source and preview — editor may be unreliable for this deck');
  }
  slidePairs = sourceSlides.map((sourceSlide, i) => {
    const previewSlide = previewSlides[i];
    previewSlide.classList.toggle('__editor-active', i === 0);
    const heading = sourceSlide.querySelector('h1, h2, .eyebrow');
    const label = heading ? heading.textContent.trim().slice(0, 40) : `slide ${i + 1}`;
    return { sourceSlide, previewSlide, label };
  });
}

function renderSlideNav() {
  els.slideNav.innerHTML = '';
  slidePairs.forEach((pair, i) => {
    const btn = document.createElement('button');
    btn.innerHTML = `<span class="n">${String(i + 1).padStart(2, '0')}</span>${pair.label || '(vazio)'}`;
    btn.addEventListener('click', () => goToSlide(i));
    els.slideNav.appendChild(btn);
  });
}

function goToSlide(i) {
  if (!slidePairs[i]) return;
  slidePairs.forEach((pair, idx) => pair.previewSlide.classList.toggle('__editor-active', idx === i));
  Array.from(els.slideNav.children).forEach((btn, idx) => btn.classList.toggle('active', idx === i));
  currentSlide = i;
  wireCurrentSlideFields();
}

// ---------- Wiring edit interactions for the visible slide ----------

function wireCurrentSlideFields() {
  const pair = slidePairs[currentSlide];
  if (!pair) return;
  els.preview.contentDocument.documentElement.classList.toggle('__editor-edit-mode', els.editMode.checked);
  const sourceFields = collectFields(pair.sourceSlide);
  const previewFields = collectFields(pair.previewSlide);

  previewFields.texts.forEach((previewEl, i) => {
    const sourceEl = sourceFields.texts[i];
    if (!sourceEl) return;
    previewEl.dataset.editorEditable = 'true';
    previewEl.contentEditable = els.editMode.checked ? 'true' : 'false';
    previewEl.onblur = () => {
      const clean = sanitizeInline(previewEl.innerHTML);
      if (clean !== previewEl.innerHTML) previewEl.innerHTML = clean;
      if (sourceEl.innerHTML !== clean) {
        sourceEl.innerHTML = clean;
        markDirty();
      }
    };
  });

  previewFields.images.forEach((previewImg, i) => {
    const sourceImg = sourceFields.images[i];
    if (!sourceImg) return;
    previewImg.dataset.editorEditable = 'true';
    wireImageInteractions(previewImg, sourceImg);
  });

  previewFields.emptySlots.forEach((previewSlot, i) => {
    const sourceSlot = sourceFields.emptySlots[i];
    if (!sourceSlot) return;
    previewSlot.dataset.editorEditable = 'true';
    previewSlot.onclick = () => {
      if (!els.editMode.checked) return;
      fillEmptySlot(previewSlot, sourceSlot);
    };
  });
}

function wireImageInteractions(previewImg, sourceImg) {
  let dragStart = null;
  let moved = false;

  previewImg.onmousedown = (e) => {
    if (!els.editMode.checked) return;
    dragStart = { x: e.clientX, y: e.clientY };
    moved = false;
    e.preventDefault();
  };
  previewImg.onmousemove = (e) => {
    if (!dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    if (!moved) return;
    const rect = previewImg.getBoundingClientRect();
    const current = parseObjectPosition(previewImg.style.objectPosition);
    const nextX = clampPct(current.x + (dx / rect.width) * 100);
    const nextY = clampPct(current.y + (dy / rect.height) * 100);
    const pos = `${nextX.toFixed(0)}% ${nextY.toFixed(0)}%`;
    previewImg.style.objectPosition = pos;
    sourceImg.style.objectPosition = pos;
    dragStart = { x: e.clientX, y: e.clientY };
  };
  const endDrag = () => {
    if (moved) markDirty();
    dragStart = null;
  };
  previewImg.onmouseup = endDrag;
  previewImg.onmouseleave = endDrag;

  previewImg.onclick = async () => {
    if (!els.editMode.checked || moved) return;
    await swapImage(previewImg, sourceImg);
  };
}

function parseObjectPosition(value) {
  const m = /(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/.exec(value || '');
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 50, y: 50 };
}
function clampPct(n) {
  return Math.max(0, Math.min(100, n));
}

async function swapImage(previewImg, sourceImg) {
  let fileHandles;
  try {
    fileHandles = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: 'Imagens', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'] } }],
    });
  } catch {
    return; // user cancelled
  }
  const file = await fileHandles[0].getFile();
  const relPath = sourceImg.getAttribute('src');
  await writeFileAt(talkHandle, relPath, file);
  previewImg.src = URL.createObjectURL(file);
  markDirty();
  setStatus(`imagem "${relPath}" atualizada`, 'ok');
}

async function fillEmptySlot(previewSlot, sourceSlot) {
  let fileHandles;
  try {
    fileHandles = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: 'Imagens', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'] } }],
    });
  } catch {
    return;
  }
  const file = await fileHandles[0].getFile();
  const ext = file.name.slice(file.name.lastIndexOf('.'));
  const relPath = `images/${slugify(file.name.replace(ext, ''))}${ext}`;
  await writeFileAt(talkHandle, relPath, file);

  for (const [slot, doc] of [[sourceSlot, sourceDoc], [previewSlot, els.preview.contentDocument]]) {
    const img = doc.createElement('img');
    img.setAttribute('src', slot === sourceSlot ? relPath : URL.createObjectURL(file));
    img.setAttribute('alt', '');
    slot.querySelectorAll('.hint').forEach((h) => h.remove());
    slot.classList.remove('empty');
    slot.appendChild(img);
  }
  markDirty();
  setStatus(`imagem nova gravada em ${relPath}`, 'ok');
  wireCurrentSlideFields();
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents after NFD normalization
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------- Save ----------

async function saveTalk() {
  try {
    const html = docPrefix + sourceDoc.documentElement.outerHTML;
    await writeFileAt(talkHandle, 'index.html', new Blob([html], { type: 'text/html' }));
    dirty = false;
    els.btnSave.disabled = true;
    setStatus('salvo — confira com "git diff"', 'ok');
  } catch (err) {
    console.error(err);
    setStatus('erro ao salvar: ' + err.message, 'error');
  }
}

// ---------- Wiring top-level UI ----------

els.btnOpen.addEventListener('click', async () => {
  try {
    rootHandle = await window.showDirectoryPicker();
  } catch {
    return;
  }
  setStatus('procurando palestras…', '');
  talks = await findTalks(rootHandle);
  els.talkPicker.innerHTML = '';
  if (talks.length === 0) {
    els.talkPicker.innerHTML = '<option value="">nenhuma palestra encontrada</option>';
    setStatus('nenhuma pasta com index.html encontrada', 'error');
    return;
  }
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'escolher palestra…';
  els.talkPicker.appendChild(placeholder);
  talks.forEach((t, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = t.label;
    els.talkPicker.appendChild(opt);
  });
  els.talkPicker.disabled = false;
  setStatus(`${talks.length} palestra(s) encontrada(s)`, 'ok');
});

els.talkPicker.addEventListener('change', () => {
  const idx = els.talkPicker.value;
  if (idx === '') return;
  if (dirty && !confirm('Tem edição não salva. Trocar de palestra mesmo assim?')) {
    return;
  }
  openTalk(talks[Number(idx)]);
});

els.editMode.addEventListener('change', () => {
  wireCurrentSlideFields();
});

els.zoomIn.addEventListener('click', () => {
  zoomFactor = Math.min(3, zoomFactor + 0.15);
  applyZoom();
});
els.zoomOut.addEventListener('click', () => {
  zoomFactor = Math.max(0.3, zoomFactor - 0.15);
  applyZoom();
});
els.zoomReset.addEventListener('click', () => {
  zoomFactor = 1;
  applyZoom();
});

els.btnSave.addEventListener('click', saveTalk);

window.addEventListener('beforeunload', (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

if (!window.showDirectoryPicker) {
  setStatus('Esse navegador não suporta File System Access API — use Chrome ou Edge.', 'error');
  els.btnOpen.disabled = true;
}
