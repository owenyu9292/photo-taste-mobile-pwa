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

const REASONS = ["얼굴", "분위기", "빛", "구도", "색감", "의상", "배경", "몸선", "표정", "전체 느낌", "프롬프트 후보"];
const STORE_KEY = "photo-taste-mobile-review-v1";

const state = {
  items: loadStore(),
  activeId: ""
};

const els = {
  chooseBtn: document.getElementById("chooseBtn"),
  clearBtn: document.getElementById("clearBtn"),
  exportBtn: document.getElementById("exportBtn"),
  fileInput: document.getElementById("fileInput"),
  status: document.getElementById("status"),
  imageStage: document.getElementById("imageStage"),
  activeImage: document.getElementById("activeImage"),
  activeTitle: document.getElementById("activeTitle"),
  sourceChips: document.getElementById("sourceChips"),
  tasteChips: document.getElementById("tasteChips"),
  reasonChips: document.getElementById("reasonChips"),
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
    .split(/[,\n\r\t]+/g)
    .map((tag) => tag.trim())
    .filter(Boolean);
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

async function previewDataUrl(file, maxSide = 720) {
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

async function addFiles(files) {
  for (const file of [...files].filter((item) => /^image\/(png|jpe?g|webp)$/i.test(item.type))) {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const item = {
      id,
      image_name: file.name,
      image_hash: await hashFile(file),
      size: file.size || 0,
      last_modified: file.lastModified || 0,
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

function renderReasonChips(item) {
  els.reasonChips.innerHTML = REASONS.map((reason) => (
    `<button class="${item?.reason_tags?.includes(reason) ? "good" : ""}" data-reason="${esc(reason)}" type="button">${esc(reason)}</button>`
  )).join("");
  els.reasonChips.querySelectorAll("[data-reason]").forEach((button) => {
    button.addEventListener("click", () => {
      const active = activeItem();
      if (!active) return;
      const set = new Set(active.reason_tags || []);
      if (set.has(button.dataset.reason)) set.delete(button.dataset.reason);
      else set.add(button.dataset.reason);
      active.reason_tags = [...set];
      active.reviewed_at = new Date().toISOString();
      saveStore();
      render();
    });
  });
}

function render() {
  const item = activeItem();
  els.status.textContent = `${state.items.length}장`;
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
  renderReasonChips(item);

  els.queue.innerHTML = state.items.length
    ? state.items.map((entry) => `
      <div class="queue-item ${entry.id === state.activeId ? "active" : ""}" data-id="${esc(entry.id)}">
        <img class="thumb" src="${esc(entry.preview || "")}" alt="">
        <div>
          <div>${esc(shortName(entry.image_name))}</div>
          <div class="sub">${esc(SOURCE_TYPES[entry.source_type] || SOURCE_TYPES.unknown)} · ${esc(TASTES[entry.taste] || "미선택")} · ${(entry.user_tags || []).length} tags</div>
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
  return {
    app_id: "photo-taste-app",
    package_type: "phone_review_patch",
    schema_version: 1,
    created_at: new Date().toISOString(),
    role: "phone_review",
    review_items: state.items.map((item) => ({
      image_name: item.image_name,
      image_hash: item.image_hash,
      source_type: item.source_type || "unknown",
      source_label: SOURCE_TYPES[item.source_type] || SOURCE_TYPES.unknown,
      taste: item.taste || "",
      reason_tags: item.reason_tags || [],
      user_tags: item.user_tags || [],
      note: item.note || "",
      reviewed_at: item.reviewed_at
    }))
  };
}

async function exportPatch() {
  const patch = buildPatch();
  const filename = `photo-taste-phone-patch-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const file = new File([JSON.stringify(patch, null, 2)], filename, { type: "application/json" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: "Photo Taste Patch" });
    return;
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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

