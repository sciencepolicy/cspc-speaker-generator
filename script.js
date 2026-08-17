const canvas = document.getElementById('graphicCanvas');
const ctx = canvas.getContext('2d');

const photoInput = document.getElementById('photoInput');
const zoomRange = document.getElementById('zoomRange');
const resetCropButton = document.getElementById('resetCrop');
const cropControls = document.getElementById('cropControls');
const nameInput = document.getElementById('nameInput');
const titleInput = document.getElementById('titleInput');
const orgInput = document.getElementById('orgInput');
const downloadButton = document.getElementById('downloadButton');
const clearButton = document.getElementById('clearButton');
const status = document.getElementById('status');

const TEMPLATE_SIZE = { width: 1080, height: 1350 };

// Coordinates matched to the circular headshot placeholder in the supplied templates.
const PHOTO_CIRCLE = { x: 273, y: 825, r: 188 };

// Speaker details are placed in the open area to the right of the headshot.
const TEXT_BOX = {
  x: 505,
  y: 690,
  width: 455,
  nameMaxSize: 52,
  titleSize: 30,
  orgSize: 27,
  lineGap: 11
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
let dragging = false;
let dragStart = null;

function loadTemplate(language) {
  activeLanguage = language;
  templateImage = new Image();
  templateImage.onload = draw;
  templateImage.onerror = () => {
    status.textContent = 'Could not load the template image. Check that the assets folder is uploaded.';
  };
  templateImage.src = templates[language];
}

function fitFontSize(text, maxWidth, startingSize, minSize = 28, weight = 800) {
  let size = startingSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

function wrapText(text, maxWidth, font) {
  ctx.font = font;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${line} ${words[i]}`;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
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
  if (!name && !title && !org) return;

  const x = TEXT_BOX.x;
  let y = TEXT_BOX.y;
  const width = TEXT_BOX.width;

  // A subtle translucent plate keeps text readable against the wave background.
  ctx.save();
  ctx.fillStyle = 'rgba(10, 29, 65, 0.70)';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x - 22, y - 54, width + 44, 230, 18);
  } else {
    ctx.rect(x - 22, y - 54, width + 44, 230);
  }
  ctx.fill();

  if (name) {
    const nameSize = fitFontSize(name, width, TEXT_BOX.nameMaxSize, 31, 800);
    ctx.font = `800 ${nameSize}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.fillText(name, x, y);
    y += nameSize + 18;
  }

  if (title) {
    const font = `700 ${TEXT_BOX.titleSize}px Arial, Helvetica, sans-serif`;
    const lines = wrapText(title, width, font).slice(0, 2);
    ctx.font = font;
    ctx.fillStyle = '#bfd4ea';
    for (const line of lines) {
      ctx.fillText(line, x, y);
      y += TEXT_BOX.titleSize + TEXT_BOX.lineGap;
    }
  }

  if (org) {
    y += 4;
    const font = `600 ${TEXT_BOX.orgSize}px Arial, Helvetica, sans-serif`;
    const lines = wrapText(org, width, font).slice(0, 2);
    ctx.font = font;
    ctx.fillStyle = '#ffffff';
    for (const line of lines) {
      ctx.fillText(line, x, y);
      y += TEXT_BOX.orgSize + TEXT_BOX.lineGap;
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

canvas.addEventListener('pointerdown', (event) => {
  if (!headshot) return;
  const point = canvasPoint(event);
  if (!isInsidePhotoCircle(point)) return;
  dragging = true;
  canvas.classList.add('is-dragging');
  dragStart = { point, cropX: crop.x, cropY: crop.y };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const point = canvasPoint(event);
  crop.x = dragStart.cropX + (point.x - dragStart.point.x);
  crop.y = dragStart.cropY + (point.y - dragStart.point.y);
  draw();
});

function endDrag(event) {
  if (!dragging) return;
  dragging = false;
  canvas.classList.remove('is-dragging');
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
  loadTemplate('English');
  status.textContent = '';
});

loadTemplate('English');
