const canvas = document.getElementById('graphicCanvas');
const ctx = canvas.getContext('2d');

const photoInput = document.getElementById('photoInput');
const zoomRange = document.getElementById('zoomRange');
const resetCropButton = document.getElementById('resetCrop');
const cropControls = document.getElementById('cropControls');
const resetDetailsButton = document.getElementById('resetDetails');
const nameInput = document.getElementById('nameInput');
const titleInput = document.getElementById('titleInput');
const orgInput = document.getElementById('orgInput');
const downloadButton = document.getElementById('downloadButton');
const clearButton = document.getElementById('clearButton');
const status = document.getElementById('status');

const TEMPLATE_SIZE = { width: 1080, height: 1350 };
const PHOTO_CIRCLE = { x: 273, y: 825, r: 188 };

const TEXT_BOX = {
  x: 505,
  defaultY: 735,
  width: 455,
  paddingX: 22,
  paddingY: 20,
  minY: 620,
  maxBottom: 1080,
  nameMaxSize: 52,
  nameMinSize: 24,
  titleMaxSize: 32,
  titleMinSize: 18,
  orgMaxSize: 29,
  orgMinSize: 17,
  lineHeight: 1.12,
  sectionGap: 12
};

const templates = {
  English: 'assets/English.png',
  French: 'assets/French.png',
  Bilingual: 'assets/Bilingual.png'
};

let activeLanguage = 'English';
let templateImage = new Image();
let headshot = null;
let crop = { x: 0, y: 0, zoom: 1 };
let detailsOffset = 0;
let detailsY = TEXT_BOX.defaultY;
let dragMode = null;
let dragStart = null;
let lastTextBounds = null;

function loadTemplate(language) {
  activeLanguage = language;
  templateImage = new Image();
  templateImage.onload = draw;
  templateImage.onerror = () => {
    status.textContent = 'Could not load the template image. Check that the assets folder is uploaded.';
  };
  templateImage.src = templates[language];
}

function kelsonFont(size) {
  return `${size}px "Kelson Sans", Arial, Helvetica, sans-serif`;
}

function wrapText(text, maxWidth, font) {
  ctx.font = font;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) lines.push(line);

    // If a single token is wider than the box, break it safely instead of clipping.
    if (ctx.measureText(word).width > maxWidth) {
      let chunk = '';
      for (const char of word) {
        const test = chunk + char;
        if (ctx.measureText(test).width > maxWidth && chunk) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk = test;
        }
      }
      line = chunk;
    } else {
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function buildTextLayout(name, title, org) {
  const availableWidth = TEXT_BOX.width;
  const safeHeight = TEXT_BOX.maxBottom - TEXT_BOX.minY;
  // Keep some vertical travel available even for long bios. If the text is
  // lengthy, shrink it before using up the entire movable safe area.
  const minVerticalTravel = 140;
  const maxHeight = safeHeight - minVerticalTravel;

  // Scale all three text styles together until every line fits comfortably.
  for (let scale = 1; scale >= 0.42; scale -= 0.025) {
    const nameSize = Math.max(TEXT_BOX.nameMinSize, Math.round(TEXT_BOX.nameMaxSize * scale));
    const titleSize = Math.max(TEXT_BOX.titleMinSize, Math.round(TEXT_BOX.titleMaxSize * scale));
    const orgSize = Math.max(TEXT_BOX.orgMinSize, Math.round(TEXT_BOX.orgMaxSize * scale));

    const nameLines = name ? wrapText(name, availableWidth, kelsonFont(nameSize)) : [];
    const titleLines = title ? wrapText(title, availableWidth, kelsonFont(titleSize)) : [];
    const orgLines = org ? wrapText(org, availableWidth, kelsonFont(orgSize)) : [];

    const nameLineH = Math.round(nameSize * TEXT_BOX.lineHeight);
    const titleLineH = Math.round(titleSize * TEXT_BOX.lineHeight);
    const orgLineH = Math.round(orgSize * TEXT_BOX.lineHeight);

    let contentHeight = 0;
    if (nameLines.length) contentHeight += nameLines.length * nameLineH;
    if (titleLines.length) {
      if (contentHeight) contentHeight += TEXT_BOX.sectionGap;
      contentHeight += titleLines.length * titleLineH;
    }
    if (orgLines.length) {
      if (contentHeight) contentHeight += TEXT_BOX.sectionGap;
      contentHeight += orgLines.length * orgLineH;
    }

    const plateHeight = contentHeight + TEXT_BOX.paddingY * 2;
    if (plateHeight <= maxHeight || scale <= 0.445) {
      return {
        nameSize, titleSize, orgSize,
        nameLines, titleLines, orgLines,
        nameLineH, titleLineH, orgLineH,
        contentHeight, plateHeight
      };
    }
  }
}

function drawHeadshot() {
  if (!headshot) return;

  const diameter = PHOTO_CIRCLE.r * 2;
  const baseScale = Math.max(diameter / headshot.width, diameter / headshot.height);
  const scale = baseScale * crop.zoom;
  const drawW = headshot.width * scale;
  const drawH = headshot.height * scale;

  const centerX = PHOTO_CIRCLE.x + crop.x;
  const centerY = PHOTO_CIRCLE.y + crop.y;
  const drawX = centerX - drawW / 2;
  const drawY = centerY - drawH / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(PHOTO_CIRCLE.x, PHOTO_CIRCLE.y, PHOTO_CIRCLE.r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(headshot, drawX, drawY, drawW, drawH);
  ctx.restore();
}

function drawDetails() {
  const name = nameInput.value.trim();
  const title = titleInput.value.trim();
  const org = orgInput.value.trim();
  if (!name && !title && !org) {
    lastTextBounds = null;
    return;
  }

  const layout = buildTextLayout(name, title, org);
  const plateX = TEXT_BOX.x - TEXT_BOX.paddingX;
  const plateW = TEXT_BOX.width + TEXT_BOX.paddingX * 2;

  // Position is controlled by an OFFSET from a sensible default position.
  // Auto-sizing may change the box height, but it never resets the user's offset.
  const maxY = TEXT_BOX.maxBottom - layout.plateHeight;
  const baseY = Math.min(Math.max(TEXT_BOX.defaultY, TEXT_BOX.minY), maxY);
  const minOffset = TEXT_BOX.minY - baseY;
  const maxOffset = maxY - baseY;

  detailsOffset = Math.min(Math.max(detailsOffset, minOffset), maxOffset);
  detailsY = baseY + detailsOffset;

  const plateY = detailsY;
  lastTextBounds = { x: plateX, y: plateY, width: plateW, height: layout.plateHeight };

  ctx.save();
  ctx.fillStyle = 'rgba(10, 29, 65, 0.76)';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(plateX, plateY, plateW, layout.plateHeight, 18);
  } else {
    ctx.rect(plateX, plateY, plateW, layout.plateHeight);
  }
  ctx.fill();

  ctx.textBaseline = 'top';
  let y = plateY + TEXT_BOX.paddingY;
  const x = TEXT_BOX.x;

  if (layout.nameLines.length) {
    ctx.font = kelsonFont(layout.nameSize);
    ctx.fillStyle = '#ffffff';
    for (const line of layout.nameLines) {
      ctx.fillText(line, x, y);
      y += layout.nameLineH;
    }
  }

  if (layout.titleLines.length) {
    if (layout.nameLines.length) y += TEXT_BOX.sectionGap;
    ctx.font = kelsonFont(layout.titleSize);
    ctx.fillStyle = '#bfd4ea';
    for (const line of layout.titleLines) {
      ctx.fillText(line, x, y);
      y += layout.titleLineH;
    }
  }

  if (layout.orgLines.length) {
    if (layout.nameLines.length || layout.titleLines.length) y += TEXT_BOX.sectionGap;
    ctx.font = kelsonFont(layout.orgSize);
    ctx.fillStyle = '#ffffff';
    for (const line of layout.orgLines) {
      ctx.fillText(line, x, y);
      y += layout.orgLineH;
    }
  }

  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, TEMPLATE_SIZE.width, TEMPLATE_SIZE.height);
  if (templateImage.complete && templateImage.naturalWidth) {
    ctx.drawImage(templateImage, 0, 0, TEMPLATE_SIZE.width, TEMPLATE_SIZE.height);
  }
  drawHeadshot();
  drawDetails();
}

function resetCrop() {
  crop = { x: 0, y: 0, zoom: 1 };
  zoomRange.value = '1';
  draw();
}

function resetDetails() {
  detailsOffset = 0;
  detailsY = TEXT_BOX.defaultY;
  draw();
}

function readPhoto(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      headshot = img;
      cropControls.hidden = false;
      resetCrop();
      status.textContent = '';
    };
    img.onerror = () => {
      status.textContent = 'That image could not be opened. Try a JPG or PNG.';
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function isInsidePhotoCircle(point) {
  const dx = point.x - PHOTO_CIRCLE.x;
  const dy = point.y - PHOTO_CIRCLE.y;
  return dx * dx + dy * dy <= PHOTO_CIRCLE.r * PHOTO_CIRCLE.r;
}

function isInsideTextBox(point) {
  if (!lastTextBounds) return false;
  return point.x >= lastTextBounds.x && point.x <= lastTextBounds.x + lastTextBounds.width &&
    point.y >= lastTextBounds.y && point.y <= lastTextBounds.y + lastTextBounds.height;
}

canvas.addEventListener('pointermove', (event) => {
  // When not actively dragging, show the user what can be moved.
  if (!dragMode) {
    const point = canvasPoint(event);
    if (isInsideTextBox(point) || (headshot && isInsidePhotoCircle(point))) {
      canvas.style.cursor = 'grab';
    } else {
      canvas.style.cursor = 'default';
    }
  }
});

canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);

  if (headshot && isInsidePhotoCircle(point)) {
    dragMode = 'photo';
    dragStart = { point, cropX: crop.x, cropY: crop.y };
  } else if (isInsideTextBox(point)) {
    dragMode = 'details';
    dragStart = { point, detailsOffset };
  } else {
    return;
  }

  canvas.classList.add('is-dragging');
  canvas.style.cursor = 'grabbing';
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragMode) return;
  const point = canvasPoint(event);

  if (dragMode === 'photo') {
    crop.x = dragStart.cropX + (point.x - dragStart.point.x);
    crop.y = dragStart.cropY + (point.y - dragStart.point.y);
  } else if (dragMode === 'details') {
    detailsOffset = dragStart.detailsOffset + (point.y - dragStart.point.y);
  }
  draw();
});

function endDrag(event) {
  if (!dragMode) return;
  dragMode = null;
  canvas.classList.remove('is-dragging');
  canvas.style.cursor = 'default';
  if (event.pointerId !== undefined && canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

photoInput.addEventListener('change', () => readPhoto(photoInput.files[0]));
zoomRange.addEventListener('input', () => {
  crop.zoom = Number(zoomRange.value);
  draw();
});
resetCropButton.addEventListener('click', resetCrop);
resetDetailsButton.addEventListener('click', resetDetails);
[nameInput, titleInput, orgInput].forEach(el => el.addEventListener('input', draw));

document.querySelectorAll('input[name="language"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('.language-card').forEach(card => card.classList.remove('is-selected'));
    radio.closest('.language-card').classList.add('is-selected');
    loadTemplate(radio.value);
  });
});

downloadButton.addEventListener('click', () => {
  draw();
  const safeName = nameInput.value.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'speaker';
  const lang = activeLanguage.toLowerCase();
  const link = document.createElement('a');
  link.download = `CSPC2026-${safeName}-${lang}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  status.textContent = 'Your PNG has been generated.';
});

clearButton.addEventListener('click', () => {
  photoInput.value = '';
  headshot = null;
  cropControls.hidden = true;
  nameInput.value = '';
  titleInput.value = '';
  orgInput.value = '';
  document.querySelector('input[name="language"][value="English"]').checked = true;
  document.querySelectorAll('.language-card').forEach(card => card.classList.remove('is-selected'));
  document.querySelector('input[name="language"][value="English"]').closest('.language-card').classList.add('is-selected');
  resetCrop();
  resetDetails();
  loadTemplate('English');
  status.textContent = '';
});

// Wait for Kelson before the first render so preview and downloaded PNG match.
document.fonts.ready.then(() => loadTemplate('English'));
