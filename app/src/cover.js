function box(left, top, right, bottom) {
  return [[left, top], [right, top], [right, bottom], [left, bottom]];
}

export const layouts = {
  hero: [box(0, 0, .63, 1), box(.63, 0, 1, .43), box(.63, .43, 1, 1)],
  grid: [box(0, 0, .5, .5), box(.5, 0, 1, .5), box(0, .5, .5, 1), box(.5, .5, 1, 1)],
  split: [
    [[0, 0], [.40, 0], [.23, 1], [0, 1]],
    [[.40, 0], [.74, 0], [.56, 1], [.23, 1]],
    [[.74, 0], [1, 0], [1, 1], [.56, 1]],
  ],
  single: [box(0, 0, 1, 1)],
};

export const palettes = {
  sunset: {
    frame: '#241329', glow: '#ffab80', white: '#fff3d6', shadow: '#f06e9c',
    upper: '#ff874b', lower: '#b93785', filter: 'saturate(1.23) contrast(1.09)',
  },
  night: {
    frame: '#14122c', glow: '#8af7ed', white: '#eefaff', shadow: '#9a77fb',
    upper: '#17b8d3', lower: '#6236dc', filter: 'saturate(1.15) brightness(.77) contrast(1.14)',
  },
  dawn: {
    frame: '#41304a', glow: '#ffbec3', white: '#fff6e3', shadow: '#d28cbd',
    upper: '#ffd0a3', lower: '#a08bbd', filter: 'saturate(.76) brightness(1.12) contrast(.95)',
  },
};

export function tiles(canvas, layout) {
  const { width, height } = canvas;
  const margin = Math.min(width, height) * .025;
  return layouts[layout].map(vertices => {
    const points = vertices.map(([x, y]) => [
      margin + x * (width - 2 * margin), margin + y * (height - 2 * margin),
    ]);
    const path = new Path2D();
    path.moveTo(...points[0]);
    for (const point of points.slice(1)) path.lineTo(...point);
    path.closePath();
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    return { path, left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
  });
}

export function photoBounds(image, tile, zoom) {
  const fit = Math.max(tile.width / image.naturalWidth, tile.height / image.naturalHeight);
  return { width: image.naturalWidth * fit * zoom, height: image.naturalHeight * fit * zoom };
}

function ramp(ctx, top, bottom, ...colors) {
  const fill = ctx.createLinearGradient(0, top, 0, bottom);
  for (const [index, color] of colors.entries()) fill.addColorStop(index / (colors.length - 1), color);
  return fill;
}

function paintTile(ctx, tile, crop, image, colors) {
  const { path, left, top, width, height } = tile;
  const fill = () => ctx.fillRect(left, top, width, height);
  ctx.save();
  ctx.clip(path);
  if (image) {
    const scaled = photoBounds(image, tile, crop.zoom);
    ctx.filter = colors.filter;
    ctx.drawImage(image, left - (scaled.width - width) * crop.x,
      top - (scaled.height - height) * crop.y, scaled.width, scaled.height);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = ramp(ctx, top, top + height, colors.upper + 'b8', colors.shadow + '35', colors.lower + 'ee');
    fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = ramp(ctx, top, top + height, colors.frame + '0a', colors.upper + '13', colors.lower + '42');
    fill();
  } else {
    ctx.fillStyle = ramp(ctx, top, top + height, colors.frame, colors.lower, colors.upper);
    fill();
    ctx.fillStyle = colors.glow + '95';
    ctx.beginPath();
    ctx.arc(left + width * .54, top + height * .38, Math.min(width, height) * .22, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = colors.white + '24';
    for (let stripe = 0; stripe < 8; stripe++) {
      ctx.fillRect(left, top + height * (.57 + stripe * .038), width, 2);
    }
  }
  ctx.restore();
}

function titleLines(caption) {
  const words = caption.trim().toUpperCase().split(/\s+/);
  if (words.length < 2 || caption.length < 13) return [words.join(' ')];
  let best = [words.join(' ')];
  let gap = Infinity;
  for (let i = 1; i < words.length; i++) {
    const first = words.slice(0, i).join(' ');
    const second = words.slice(i).join(' ');
    const difference = Math.abs(first.length - second.length);
    if (difference < gap) {
      best = [first, second];
      gap = difference;
    }
  }
  return best;
}

function fitType(ctx, lines, initial, maxWidth, weight, tracking) {
  let size = initial;
  function apply() {
    ctx.font = weight + ' ' + size + 'px system-ui, sans-serif';
    ctx.letterSpacing = size * tracking + 'px';
  }
  apply();
  const widest = Math.max(...lines.map(line => ctx.measureText(line).width));
  if (widest > maxWidth) {
    size *= maxWidth / widest;
    apply();
  }
  return size;
}

function paintLettering(ctx, width, height, unit, state, colors) {
  const title = titleLines(state.caption);
  const subtitle = state.subtitle.trim().toUpperCase();
  if (!title[0] && !subtitle) return;
  const x = width / 2;
  const baseline = height * .829;
  const bottom = height - unit * .025;
  const size = fitType(ctx, title, unit * .177, width * .84, 'italic 950', .018);
  const start = baseline - title.length * size * .79 - unit * .105;
  ctx.fillStyle = ramp(ctx, start, bottom, colors.frame + '00', colors.frame + '84', colors.frame + 'f2');
  ctx.fillRect(unit * .025, start, width - unit * .05, bottom - start);
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * .115;
  ctx.strokeStyle = colors.frame;
  title.forEach((line, index) => {
    const y = baseline - (title.length - index - 1) * size * .82;
    ctx.strokeText(line, x, y + size * .095);
    ctx.fillStyle = colors.shadow;
    ctx.fillText(line, x, y + size * .075);
    ctx.strokeText(line, x, y);
    ctx.fillStyle = ramp(ctx, y - size * .75, y, colors.white, colors.white, colors.glow);
    ctx.fillText(line, x, y);
  });
  fitType(ctx, [subtitle], unit * .023, width * .78, '850', .23);
  ctx.fillStyle = colors.glow;
  ctx.fillText(subtitle, x, height * .904);
  ctx.fillRect(x - unit * .028, height * .928, unit * .056, unit * .003);
}

export function paintCover(canvas, state, selected = -1) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const unit = Math.min(width, height);
  const colors = palettes[state.grade];
  const panels = tiles(canvas, state.layout);
  ctx.save();
  ctx.fillStyle = colors.frame;
  ctx.fillRect(0, 0, width, height);
  panels.forEach((tile, i) => {
    const crop = state.crops[i];
    paintTile(ctx, tile, crop, state.photos[crop.photo]?.image, colors);
  });
  ctx.lineWidth = unit * .014;
  ctx.strokeStyle = colors.frame;
  for (const { path } of panels) ctx.stroke(path);
  paintLettering(ctx, width, height, unit, state, colors);
  ctx.strokeStyle = colors.glow;
  ctx.lineWidth = unit * .0025;
  const edge = unit * .0105;
  ctx.strokeRect(edge, edge, width - edge * 2, height - edge * 2);
  if (panels[selected]) {
    ctx.setLineDash([unit * .011, unit * .006]);
    ctx.strokeStyle = '#fff2df';
    ctx.stroke(panels[selected].path);
  }
  ctx.restore();
}
