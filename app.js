const SOURCE_TYPES = {
  unknown: "분류 미정",
  own_photo: "내가 찍은 사진",
  liked_reference: "좋아해서 모은 사진",
  generated_image: "생성 이미지",
  reference: "참고용"
};

const TASTES = {
  like: "좋음",
  maybe: "애매",
  dislike: "별로",
  later: "다시보기"
};

const STORE_KEY = "photo-taste-mobile-review-v1";
const EXPORT_COUNTER_KEY = "photo-taste-mobile-export-counter-v1";

const state = {
  items: loadStore(),
  activeId: ""
};

const els = {
  chooseBtn: document.getElementById("chooseBtn"),
  clearBtn: document.getElementById("clearBtn"),
  exportBtn: document.getElementById("exportBtn"),
  exportSummary: document.getElementById("exportSummary"),
  fileInput: document.getElementById("fileInput"),
  status: document.getElementById("status"),
  imageStage: document.getElementById("imageStage"),
  activeImage: document.getElementById("activeImage"),
  activeTitle: document.getElementById("activeTitle"),
  sourceChips: document.getElementById("sourceChips"),
  tasteChips: document.getElementById("tasteChips"),
  tagInput: document.getElementById("tagInput"),
  noteInput: document.getElementById("noteInput"),
  queue: document.getElementById("queue")
};

function loadStore() {
  try {
    const value = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (_) {
    return [];
  }
}

function saveStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.items));
  } catch (_) {
    const compact = state.items.map((item) => ({ ...item, preview: "" }));
    localStorage.setItem(STORE_KEY, JSON.stringify(compact));
  }
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortName(name, max = 28) {
  const text = String(name || "");
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}

function activeItem() {
  return state.items.find((item) => item.id === state.activeId) || state.items[0] || null;
}

function parseTags(text) {
  return String(text || "")
    .split(/[,，、.\u3002;；/／|·•\n\r\t]+/g)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function tagPreview(tags, max = 4) {
  const list = (tags || []).filter(Boolean);
  if (!list.length) return "없음";
  const visible = list.slice(0, max).join(", ");
  const hidden = list.length - max;
  return hidden > 0 ? `${visible} 외 ${hidden}개` : visible;
}

async function hashFile(file) {
  try {
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch (_) {
    return "";
  }
}

function originalLocatorFromFile(file, sha256) {
  return {
    locator_version: 1,
    storage_policy: "converged_original_library",
    origin_hint: "phone_pwa",
    file_name: file.name || "",
    relative_path_hint: file.webkitRelativePath || file.name || "",
    size: file.size || 0,
    last_modified: file.lastModified || 0,
    sha256: sha256 || "",
    mime: file.type || ""
  };
}

async function previewDataUrl(file, maxSide = 768) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("이미지를 읽을 수 없어요."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error("이미지를 열 수 없어요."));
    image.onload = () => resolve(image);
    image.src = dataUrl;
  });
  const width = img.naturalWidth || img.width || 1;
  const height = img.naturalHeight || img.height || 1;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

function padNumber(value, length = 3) {
  return String(value).padStart(length, "0");
}

function safeZipName(value, fallback = "image") {
  return String(value || fallback)
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 96) || fallback;
}

function dataUrlToBytes(dataUrl) {
  const text = String(dataUrl || "");
  const comma = text.indexOf(",");
  if (comma < 0) return new Uint8Array();
  const binary = atob(text.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function addFiles(files) {
  for (const file of [...files].filter((item) => /^image\/(png|jpe?g|webp)$/i.test(item.type))) {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const sha256 = await hashFile(file);
    const item = {
      id,
      image_name: file.name,
      image_hash: sha256,
      size: file.size || 0,
      last_modified: file.lastModified || 0,
      original_locator: originalLocatorFromFile(file, sha256),
      preview: await previewDataUrl(file),
      source_type: "unknown",
      taste: "",
      reason_tags: [],
      user_tags: [],
      note: "",
      reviewed_at: new Date().toISOString()
    };
    state.items.push(item);
    if (!state.activeId) state.activeId = id;
  }
  saveStore();
  render();
}

function setActiveFields(item) {
  if (!item) return;
  item.user_tags = parseTags(els.tagInput.value);
  item.note = els.noteInput.value.trim();
  item.reviewed_at = new Date().toISOString();
  saveStore();
}

function renderChipGroup(root, values, selected, onClick, good = false) {
  root.innerHTML = Object.entries(values).map(([key, label]) => (
    `<button class="${selected.includes(key) ? (good ? "good" : "selected") : ""}" data-key="${esc(key)}" type="button">${esc(label)}</button>`
  )).join("");
  root.querySelectorAll("[data-key]").forEach((button) => {
    button.addEventListener("click", () => onClick(button.dataset.key));
  });
}

function render() {
  const item = activeItem();
  els.status.textContent = `${state.items.length}장`;
  els.exportSummary.textContent = `${state.items.length}장 패치 준비`;
  els.exportBtn.disabled = state.items.length === 0;
  if (!item) {
    els.imageStage.classList.remove("has-image");
    els.activeImage.removeAttribute("src");
    els.activeTitle.textContent = "선택 없음";
    els.tagInput.value = "";
    els.noteInput.value = "";
  } else {
    els.imageStage.classList.add("has-image");
    els.activeImage.src = item.preview || "";
    els.activeTitle.textContent = shortName(item.image_name);
    if (els.tagInput.value !== (item.user_tags || []).join(", ")) els.tagInput.value = (item.user_tags || []).join(", ");
    if (els.noteInput.value !== (item.note || "")) els.noteInput.value = item.note || "";
  }

  renderChipGroup(els.sourceChips, SOURCE_TYPES, [item?.source_type || "unknown"], (key) => {
    const active = activeItem();
    if (!active) return;
    active.source_type = key;
    active.reviewed_at = new Date().toISOString();
    saveStore();
    render();
  });
  renderChipGroup(els.tasteChips, TASTES, item?.taste ? [item.taste] : [], (key) => {
    const active = activeItem();
    if (!active) return;
    active.taste = active.taste === key ? "" : key;
    active.reviewed_at = new Date().toISOString();
    saveStore();
    render();
  }, true);

  els.queue.innerHTML = state.items.length
    ? state.items.map((entry) => `
      <div class="queue-item ${entry.id === state.activeId ? "active" : ""}" data-id="${esc(entry.id)}">
        <img class="thumb" src="${esc(entry.preview || "")}" alt="">
        <div>
          <div>${esc(shortName(entry.image_name))}</div>
          <div class="sub">출처: ${esc(SOURCE_TYPES[entry.source_type] || SOURCE_TYPES.unknown)} · 판정: ${esc(TASTES[entry.taste] || "미선택")}</div>
          <div class="sub">느낌: ${esc(tagPreview(entry.user_tags || []))}</div>
        </div>
      </div>`).join("")
    : `<div class="sub">선택한 이미지가 없어요.</div>`;
  els.queue.querySelectorAll("[data-id]").forEach((card) => {
    card.addEventListener("click", () => {
      setActiveFields(activeItem());
      state.activeId = card.dataset.id;
      render();
    });
  });
}

function buildPatch() {
  setActiveFields(activeItem());
  const previewEntries = [];
  const reviewItems = state.items.map((item, index) => {
      const previewPath = item.preview ? `previews/${padNumber(index + 1)}-${safeZipName(item.image_hash || item.id)}.jpg` : "";
      if (previewPath) {
        previewEntries.push({
          name: previewPath,
          content: dataUrlToBytes(item.preview)
        });
      }
      const sourceType = item.source_type || "unknown";
      const userTaste = {
        source_type: sourceType,
        source_label: SOURCE_TYPES[sourceType] || SOURCE_TYPES.unknown,
        taste: item.taste || "",
        reason_tags: item.reason_tags || [],
        user_tags: item.user_tags || [],
        note: item.note || "",
        reviewed_at: item.reviewed_at
      };
      return {
        image_name: item.image_name,
        image_hash: item.image_hash,
        source_type: userTaste.source_type,
        source_label: userTaste.source_label,
        taste: userTaste.taste,
        reason_tags: userTaste.reason_tags,
        user_tags: userTaste.user_tags,
        note: userTaste.note,
        user_taste: userTaste,
        original_locator: item.original_locator || {
          locator_version: 1,
          storage_policy: "converged_original_library",
          origin_hint: "phone_pwa",
          file_name: item.image_name,
          relative_path_hint: item.image_name,
          size: item.size || 0,
          last_modified: item.last_modified || 0,
          sha256: item.image_hash || "",
          mime: ""
        },
        preview_path: previewPath,
        preview_mime: previewPath ? "image/jpeg" : "",
        preview_max_side: previewPath ? 768 : 0,
        preview_role: previewPath ? "taste_review_preview" : "",
        reviewed_at: userTaste.reviewed_at
      };
    });
  return {
    patch: {
      app_id: "photo-taste-app",
      package_type: "phone_review_patch",
      schema_version: 3,
      created_at: new Date().toISOString(),
      role: "phone_taste_patch",
      contains_ai_analysis: false,
      data_layers: {
        user_taste: true,
        ai_analysis: false,
        original_locator: true,
        preview: true
      },
      preview_policy: {
        max_side: 768,
        format: "image/jpeg",
        quality: 0.86,
        fit: "contain",
        crop: false
      },
      review_items: reviewItems
    },
    previewEntries
  };
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function nextExportFilename() {
  const today = dateKey();
  let counter = { date: today, seq: 0 };
  try {
    const stored = JSON.parse(localStorage.getItem(EXPORT_COUNTER_KEY) || "{}");
    if (stored && stored.date === today && Number.isFinite(Number(stored.seq))) {
      counter = { date: today, seq: Number(stored.seq) };
    }
  } catch (_) {}
  counter.seq += 1;
  localStorage.setItem(EXPORT_COUNTER_KEY, JSON.stringify(counter));
  return `photo-taste-phone-patch-${today}-${String(counter.seq).padStart(3, "0")}.zip`;
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function writeUint16(target, value) {
  target.push(value & 255, (value >>> 8) & 255);
}

function writeUint32(target, value) {
  target.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

function createZip(files) {
  const encoder = new TextEncoder();
  const fileRecords = [];
  const chunks = [];
  let offset = 0;
  const { time, date } = dosDateTime();

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = file.content instanceof Uint8Array ? file.content : encoder.encode(file.content);
    const checksum = crc32(data);
    const local = [];
    writeUint32(local, 0x04034b50);
    writeUint16(local, 20);
    writeUint16(local, 2048);
    writeUint16(local, 0);
    writeUint16(local, time);
    writeUint16(local, date);
    writeUint32(local, checksum);
    writeUint32(local, data.length);
    writeUint32(local, data.length);
    writeUint16(local, nameBytes.length);
    writeUint16(local, 0);
    chunks.push(new Uint8Array(local), nameBytes, data);
    fileRecords.push({ nameBytes, checksum, size: data.length, offset });
    offset += local.length + nameBytes.length + data.length;
  }

  const centralStart = offset;
  for (const file of fileRecords) {
    const central = [];
    writeUint32(central, 0x02014b50);
    writeUint16(central, 20);
    writeUint16(central, 20);
    writeUint16(central, 2048);
    writeUint16(central, 0);
    writeUint16(central, time);
    writeUint16(central, date);
    writeUint32(central, file.checksum);
    writeUint32(central, file.size);
    writeUint32(central, file.size);
    writeUint16(central, file.nameBytes.length);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, 0);
    writeUint32(central, file.offset);
    chunks.push(new Uint8Array(central), file.nameBytes);
    offset += central.length + file.nameBytes.length;
  }

  const end = [];
  writeUint32(end, 0x06054b50);
  writeUint16(end, 0);
  writeUint16(end, 0);
  writeUint16(end, fileRecords.length);
  writeUint16(end, fileRecords.length);
  writeUint32(end, offset - centralStart);
  writeUint32(end, centralStart);
  writeUint16(end, 0);
  chunks.push(new Uint8Array(end));
  return new Blob(chunks, { type: "application/zip" });
}

function buildZipBlob(patch, previewEntries, filename) {
  const manifest = {
    app_id: patch.app_id,
    package_type: patch.package_type,
    schema_version: patch.schema_version,
    created_at: patch.created_at,
    file_name: filename,
    item_count: patch.review_items.length,
    json: "phone_review_patch.json",
    previews_dir: "previews",
    preview_count: previewEntries.length
  };
  return createZip([
    { name: "manifest.json", content: JSON.stringify(manifest, null, 2) },
    { name: "phone_review_patch.json", content: JSON.stringify(patch, null, 2) },
    ...previewEntries
  ]);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportPatch() {
  if (!state.items.length) return;
  const originalText = els.exportBtn.textContent;
  els.exportBtn.disabled = true;
  els.exportBtn.textContent = "생성 중";
  try {
    const { patch, previewEntries } = buildPatch();
    const filename = nextExportFilename();
    const zip = buildZipBlob(patch, previewEntries, filename);
    downloadBlob(zip, filename);
    els.exportSummary.textContent = `생성됨: ${filename}`;
  } catch (error) {
    console.error(error);
    els.exportSummary.textContent = "ZIP 생성 실패";
  } finally {
    els.exportBtn.textContent = originalText;
    els.exportBtn.disabled = state.items.length === 0;
  }
}

els.chooseBtn.addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", (event) => addFiles(event.target.files));
els.exportBtn.addEventListener("click", exportPatch);
els.clearBtn.addEventListener("click", () => {
  state.items = [];
  state.activeId = "";
  localStorage.removeItem(STORE_KEY);
  render();
});
els.tagInput.addEventListener("input", () => setActiveFields(activeItem()));
els.noteInput.addEventListener("input", () => setActiveFields(activeItem()));

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

render();
