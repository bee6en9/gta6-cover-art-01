import { layouts, palettes, paintCover, photoBounds, tiles } from './cover.js';
import { readShot, presentShot } from './shots.js';

const get = id => document.getElementById(id);
const canvas = get('cover');
const context = canvas.getContext('2d');
const fields = Object.fromEntries(['size', 'caption', 'subtitle', 'panel', 'source', 'zoom', 'hint', 'status']
  .map(id => [id, get(id)]));
const buttons = [...document.querySelectorAll('[data-layout], [data-grade]')];
const studio = { layout: 'hero', grade: 'sunset', photos: [], crops: [] };
let active = 0;
let selectionVisible = false;
let loading = 0;
let drag = null;
let frame = 0;

function snapshot() {
  return { ...studio, caption: fields.caption.value, subtitle: fields.subtitle.value };
}

function render() {
  frame = 0;
  const [width, height] = fields.size.value.split('x').map(Number);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  get('dimensions').textContent = width + ' × ' + height;
  paintCover(canvas, snapshot(), selectionVisible ? active : -1);
}

function queueRender() {
  if (!frame) frame = requestAnimationFrame(render);
}

function refreshControls() {
  const count = layouts[studio.layout].length;
  const crop = studio.crops[active];
  const hasPhotos = studio.photos.length > 0;
  fields.panel.replaceChildren(...Array.from({ length: count }, (_, i) => new Option('Panel ' + (i + 1), i)));
  fields.panel.value = active;
  fields.source.replaceChildren(...(hasPhotos
    ? studio.photos.map((photo, i) => new Option(photo.name, i))
    : [new Option('No photo')]));
  if (hasPhotos) fields.source.value = crop.photo;
  fields.zoom.value = crop.zoom;
  fields.source.disabled = fields.zoom.disabled = !hasPhotos;
  fields.hint.textContent = hasPhotos
    ? 'Panel ' + (active + 1) + ' of ' + count + ' · Drag to reposition'
    : 'Add photos or try the samples';
  for (const button of buttons) {
    const { layout, grade } = button.dataset;
    button.setAttribute('aria-pressed', String(layout === studio.layout || grade === studio.grade));
  }
}

function usePhotos(photos) {
  studio.photos = photos;
  studio.crops = [.5, .57, .82, .38].map((x, i) => ({
    x, y: .5, zoom: 1, photo: photos.length ? i % photos.length : -1,
  }));
  active = 0;
  selectionVisible = false;
  drag = null;
  refreshControls();
  queueRender();
}

async function decode(source, name) {
  const image = new Image();
  image.src = source;
  await image.decode();
  return { image, name };
}

function readLocal(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(reader.error));
    reader.addEventListener('abort', () => reject(new Error('Photo reading interrupted')));
    reader.readAsDataURL(file);
  });
}

const sampleNames = { pier: 'Sunset pier', boulevard: 'Palm boulevard' };
async function loadSamples(first = 'pier') {
  const request = ++loading;
  const names = first === 'boulevard' ? ['boulevard', 'pier'] : ['pier', 'boulevard'];
  const photos = await Promise.all(names.map(name => decode('./samples/' + name + '.jpg', sampleNames[name])));
  if (request !== loading) return;
  usePhotos(photos);
  fields.status.textContent = '';
}

get('files').addEventListener('change', async event => {
  const files = Array.from(event.target.files);
  event.target.value = '';
  if (!files.length) return;
  const request = ++loading;
  fields.status.textContent = 'Opening photos…';
  const results = await Promise.allSettled(files.map(async file => decode(await readLocal(file), file.name)));
  if (request !== loading) return;
  const photos = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  if (photos.length) usePhotos(photos);
  const failed = files.length - photos.length;
  fields.status.textContent = failed ? failed + ' could not be opened' : photos.length + ' loaded';
});

get('samples').addEventListener('click', () => {
  const expected = loading + 1;
  loadSamples().catch(() => {
    if (loading === expected) fields.status.textContent = 'Could not open the samples.';
  });
});

for (const button of buttons) {
  button.addEventListener('click', () => {
    const { layout, grade } = button.dataset;
    if (layout) {
      studio.layout = layout;
      active = Math.min(active, layouts[layout].length - 1);
      drag = null;
    }
    if (grade) studio.grade = grade;
    refreshControls();
    queueRender();
  });
}

function selectPanel(index) {
  active = index;
  selectionVisible = true;
  refreshControls();
  queueRender();
}

fields.panel.addEventListener('change', () => selectPanel(Number(fields.panel.value)));
fields.source.addEventListener('change', () => {
  studio.crops[active].photo = Number(fields.source.value);
  queueRender();
});
fields.zoom.addEventListener('input', () => {
  studio.crops[active].zoom = Number(fields.zoom.value);
  queueRender();
});
fields.size.addEventListener('change', () => {
  drag = null;
  queueRender();
});
fields.caption.addEventListener('input', queueRender);
fields.subtitle.addEventListener('input', queueRender);

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height,
  };
}

const clamp = value => Math.max(0, Math.min(1, value));
function pan(dx, dy) {
  const crop = studio.crops[active];
  const image = studio.photos[crop.photo]?.image;
  if (!image) return;
  const panel = tiles(canvas, studio.layout)[active];
  const scaled = photoBounds(image, panel, crop.zoom);
  const spareX = scaled.width - panel.width;
  const spareY = scaled.height - panel.height;
  if (spareX > .01) crop.x = clamp(crop.x - dx / spareX);
  if (spareY > .01) crop.y = clamp(crop.y - dy / spareY);
  queueRender();
}

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || drag || !studio.photos.length) return;
  const { x, y } = canvasPoint(event);
  const index = tiles(canvas, studio.layout).findIndex(tile => context.isPointInPath(tile.path, x, y));
  if (index < 0) return;
  selectPanel(index);
  canvas.setPointerCapture(event.pointerId);
  drag = { id: event.pointerId, x, y };
});
canvas.addEventListener('pointermove', event => {
  if (drag?.id !== event.pointerId) return;
  const point = canvasPoint(event);
  pan(point.x - drag.x, point.y - drag.y);
  Object.assign(drag, point);
});
canvas.addEventListener('lostpointercapture', event => {
  if (drag?.id === event.pointerId) drag = null;
});
const arrows = { ArrowUp: [0, -18], ArrowDown: [0, 18], ArrowLeft: [-18, 0], ArrowRight: [18, 0] };
canvas.addEventListener('keydown', event => {
  if (/^[1-4]$/.test(event.key) && Number(event.key) <= layouts[studio.layout].length) {
    selectPanel(Number(event.key) - 1);
  } else if (Object.hasOwn(arrows, event.key) && studio.photos.length) {
    event.preventDefault();
    selectionVisible = true;
    pan(...arrows[event.key]);
  }
});

function exportPNG() {
  const output = document.createElement('canvas');
  [output.width, output.height] = fields.size.value.split('x').map(Number);
  paintCover(output, snapshot());
  return new Promise((resolve, reject) => output.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new Error('PNG encoding failed'));
  }, 'image/png'));
}

get('download').addEventListener('click', async () => {
  const name = 'vice-city-cover-' + fields.size.value + '.png';
  try {
    const url = URL.createObjectURL(await exportPNG());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    fields.status.textContent = 'Exported ' + name;
  } catch {
    fields.status.textContent = 'Could not export the cover. Try again.';
  }
});

usePhotos([]);
const shot = readShot(location.search);
if (shot) {
  if (Object.hasOwn(layouts, shot.layout)) studio.layout = shot.layout;
  if (Object.hasOwn(palettes, shot.grade)) studio.grade = shot.grade;
  if (Array.from(fields.size.options).some(option => option.value === shot.size)) fields.size.value = shot.size;
  fields.caption.value = shot.caption;
  fields.subtitle.value = shot.subtitle;
  presentShot(shot, () => loadSamples(shot.photo), exportPNG).catch(error => {
    fields.status.textContent = 'Could not open the screenshot scene.';
    console.error(error);
  });
}
