export function readShot(search) {
  const query = new URLSearchParams(search);
  const mode = query.get('shot');
  if (mode !== 'editor' && mode !== 'cover') return null;
  return {
    mode,
    layout: query.get('layout'),
    grade: query.get('grade'),
    size: query.get('size'),
    photo: query.get('photo'),
    caption: query.get('caption') ?? 'Paradise After Dark',
    subtitle: query.get('subtitle') ?? 'Somewhere on the South Coast',
  };
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

export async function presentShot(shot, prepare, exportPNG) {
  window.__shotReady = false;
  await prepare();
  if (shot.mode === 'cover') {
    const preview = new Image();
    preview.alt = 'Exported Vice City cover poster';
    const src = URL.createObjectURL(await exportPNG());
    try {
      preview.src = src;
      await preview.decode();
      document.body.classList.add('cover-only');
      document.body.replaceChildren(preview);
    } finally {
      URL.revokeObjectURL(src);
    }
  }
  await nextFrame();
  await nextFrame();
  window.__shotReady = true;
}
