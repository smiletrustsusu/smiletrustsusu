/**
 * Shrink data-URL images before persisting to localStorage (quota-safe member photos).
 */

const DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/i;

export function isStorageQuotaError(error) {
  if (!error) return false;
  if (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED") return true;
  if (error.code === 22 || error.code === 1014) return true;
  return /quota|exceeded|storage|setItem/i.test(String(error.message || error));
}

export function isDataUrlImage(value) {
  return typeof value === "string" && DATA_URL_RE.test(value.trim());
}

/**
 * Compress a data-URL image. Non-images and empty strings pass through.
 * Uses OffscreenCanvas when available, otherwise HTMLCanvasElement.
 */
export async function compressDataUrl(dataUrl, {
  maxEdge = 720,
  quality = 0.72,
  mime = "image/jpeg",
  maxBytes = 180_000
} = {}) {
  const raw = String(dataUrl || "").trim();
  if (!raw || !isDataUrlImage(raw)) return raw;
  if (raw.length <= maxBytes && !needsResize(raw, maxEdge)) return raw;

  if (typeof document === "undefined" && typeof OffscreenCanvas === "undefined") {
    return truncateDataUrl(raw, maxBytes);
  }

  try {
    const img = await loadImage(raw);
    const { width, height } = fitWithin(img.width || img.naturalWidth, img.height || img.naturalHeight, maxEdge);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return truncateDataUrl(raw, maxBytes);
    ctx.drawImage(img, 0, 0, width, height);

    let outMime = mime;
    if (raw.startsWith("data:image/png") && mime === "image/png") outMime = "image/png";
    let result = await canvasToDataUrl(canvas, outMime, quality);
    let q = quality;
    while (result && result.length > maxBytes && q > 0.4) {
      q -= 0.1;
      result = await canvasToDataUrl(canvas, "image/jpeg", q);
    }
    if (!result || result.length > maxBytes) {
      return raw.length <= maxBytes ? raw : "";
    }
    return result;
  } catch {
    return raw.length <= maxBytes ? raw : "";
  }
}

export async function compressMemberMediaBundle(media = {}) {
  const [
    passportPhoto,
    signatureData,
    idFrontImage,
    idBackImage
  ] = await Promise.all([
    compressDataUrl(media.passportPhoto, { maxEdge: 640, quality: 0.7, maxBytes: 140_000 }),
    compressDataUrl(media.signatureData, { maxEdge: 520, quality: 0.82, mime: "image/png", maxBytes: 90_000 }),
    compressDataUrl(media.idFrontImage, { maxEdge: 900, quality: 0.68, maxBytes: 160_000 }),
    compressDataUrl(media.idBackImage, { maxEdge: 900, quality: 0.68, maxBytes: 160_000 })
  ]);
  return { passportPhoto, signatureData, idFrontImage, idBackImage };
}

/**
 * Drop bulky ID scans from oldest customers first so a new registration can save.
 * Returns true if any field was cleared.
 */
export function reclaimCustomerMediaSpace(appState, { keepCustomerId = "" } = {}) {
  if (!appState?.customers?.length) return false;
  let changed = false;
  const ordered = [...appState.customers].sort((a, b) =>
    String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
  );

  const clearField = (customer, field) => {
    const value = customer[field];
    if (!value || String(value).length < 4_000) return false;
    if (keepCustomerId && customer.id === keepCustomerId && (field === "passportPhoto" || field === "signatureData")) {
      return false;
    }
    customer[field] = "";
    customer.mediaClearedForStorage = true;
    return true;
  };

  // Always prefer dropping ID scans (largest, least needed for daily collect).
  for (const customer of ordered) {
    for (const field of ["idFrontImage", "idBackImage"]) {
      if (clearField(customer, field)) changed = true;
    }
  }
  // Then older passport/signature except the member just saved.
  for (const customer of ordered) {
    if (customer.id === keepCustomerId) continue;
    for (const field of ["passportPhoto", "signatureData"]) {
      if (clearField(customer, field)) changed = true;
    }
  }
  return changed;
}

function needsResize(dataUrl, maxEdge) {
  // Heuristic: large base64 almost always exceeds edge after capture
  return dataUrl.length > 80_000 || maxEdge < 1200;
}

function truncateDataUrl(dataUrl, maxBytes) {
  if (dataUrl.length <= maxBytes) return dataUrl;
  return "";
}

function fitWithin(w, h, maxEdge) {
  const width = Math.max(1, Number(w) || 1);
  const height = Math.max(1, Number(h) || 1);
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function createCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function canvasToDataUrl(canvas, mime, quality) {
  if (typeof canvas.toDataURL === "function") {
    return canvas.toDataURL(mime, quality);
  }
  if (typeof canvas.convertToBlob === "function") {
    const blob = await canvas.convertToBlob({ type: mime, quality });
    return blobToDataUrl(blob);
  }
  return "";
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not encode image"));
    reader.readAsDataURL(blob);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    if (typeof Image === "undefined") {
      reject(new Error("No Image"));
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = dataUrl;
  });
}
