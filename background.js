import { PUBLIC_API_BASE_URL, getSettings, initializeSettings, saveSettings } from "./background-settings.js";

const VIEWER_DB_NAME = "promptlens-db";
const VIEWER_STORE_NAME = "viewer_payloads";
const VIEWER_RECORD_ID = "current";
const ANALYSIS_IMAGE_MAX_EDGE = 1280;
const ANALYSIS_IMAGE_JPEG_QUALITY = 0.82;

/**
 * @typedef {Object} GeneratedImage
 * @property {string} mimeType
 * @property {string} base64Data
 * @property {string} url
 */

chrome.runtime.onInstalled.addListener(() => {
  initializeSettings().catch((error) => {
    console.error("[PromptLens] Failed to initialize settings", error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => {
      console.error("[PromptLens]", error);
      sendResponse({ ok: false, error: error.message || "Unknown error" });
    });

  return true;
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case "get-settings":
      return getSettings();
    case "save-settings":
      return saveSettings(message.payload || {});
    case "analyze-image":
      return analyzeImage(message.payload || {}, sender);
    case "generate-image":
      return generateImage(message.payload || {});
    case "open-viewer":
      return openViewer(message.payload || {});
    default:
      throw new Error("Unsupported message type: " + message.type);
  }
}

async function analyzeImage(payload, sender) {
  const settings = await getSettings();
  const imageUrl = normalizeImageUrl(payload.imageUrl);
  const imageDataUrl = normalizeImageDataUrl(payload.imageDataUrl);
  const screenshotCrop = normalizeScreenshotCrop(payload.screenshotCrop);

  if (!imageUrl && !imageDataUrl) {
    throw new Error("Missing image URL.");
  }

  const image = await resolveInlineImage({
    imageUrl,
    imageDataUrl,
    pageUrl: payload.pageUrl || "",
    screenshotCrop,
    sender
  });

  const result = await callBackend(settings, "/api/analyze", {
    imageUrl,
    image,
    pageUrl: payload.pageUrl || "",
    alt: payload.alt || ""
  });

  return normalizeAnalyzeResult(result, imageUrl || imageDataUrl);
}

async function generateImage(payload) {
  const settings = await getSettings();
  const prompt = String(payload.prompt || "").trim();
  const negativePrompt = normalizeNegativePromptText(payload.negativePrompt || payload.negativePromptZh || "");
  const shouldOpenViewer = Boolean(payload.openViewer);

  if (!settings.imageGenerationEnabled) {
    throw new Error("生图功能当前已关闭。");
  }

  if (!prompt) {
    throw new Error("Missing prompt for generation.");
  }

  const result = await callBackend(settings, "/api/generate", {
    prompt,
    negativePrompt,
    aspectRatio: payload.aspectRatio || settings.aspectRatio,
    count: payload.count || settings.imageCount || 1
  });

  const images = normalizeGeneratedImages(result.images || []);
  if (images.length === 0) {
    throw new Error("Image generation returned no images.");
  }

  const viewer = await saveViewerImages(images, prompt, negativePrompt);
  if (shouldOpenViewer) {
    await openViewerTab();
  }

  return {
    ...result,
    images,
    negativePrompt,
    ...viewer
  };
}

async function openViewer(payload = {}) {
  const images = Array.isArray(payload.images) ? payload.images : [];
  const prompt = String(payload.prompt || "").trim();
  const negativePrompt = normalizeNegativePromptText(payload.negativePrompt || payload.negativePromptZh || "");

  if (images.length > 0 || prompt || negativePrompt) {
    await saveViewerImages(images, prompt, negativePrompt);
  }

  await openViewerTab();
  return { opened: true };
}

async function callBackend(settings, path, payload) {
  const endpoint = buildBackendUrl(settings.apiBaseUrl, path);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseApiResponse(response, endpoint);
}

function buildBackendUrl(apiBaseUrl, path) {
  const base = String(apiBaseUrl || PUBLIC_API_BASE_URL).trim().replace(/\/+$/g, "");
  if (!base) throw new Error("后端 API 地址为空。");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseApiResponse(response, endpoint = "") {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const preview = text.trim().slice(0, 220);
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_error) {
      const looksLikeHtml = /^<!doctype\s+html|^<html[\s>]/i.test(preview);
      const target = endpoint ? ` 请求地址：${endpoint}` : "";
      const responseType = contentType ? ` Content-Type：${contentType}。` : "";
      const hint = looksLikeHtml
        ? "后端返回了 HTML 页面，不是 JSON。请确认本地后端已启动，并且 API Base URL 指向后端根地址。"
        : "后端返回内容不是合法 JSON。请检查后端接口响应。";
      throw new Error(`${hint}${responseType}${target} 响应开头：${preview}`);
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        data?.message ||
        `Request failed with status ${response.status}${endpoint ? ` at ${endpoint}` : ""}.`
    );
  }

  return data;
}

async function resolveInlineImage({ imageUrl, imageDataUrl, pageUrl, screenshotCrop, sender }) {
  if (imageDataUrl) {
    return parseDataUrlImage(imageDataUrl);
  }

  try {
    return await fetchImageAsInlineData({ imageUrl, pageUrl });
  } catch (fetchError) {
    if (screenshotCrop && sender?.tab?.windowId !== undefined) {
      try {
        return await captureVisibleTabImagePart(sender.tab.windowId, screenshotCrop);
      } catch (captureError) {
        console.warn("[PromptLens] Failed to capture fallback image", captureError);
      }
    }

    console.warn("[PromptLens] Failed to inline image, backend will try imageUrl", fetchError);
    return null;
  }
}

async function fetchImageAsInlineData({ imageUrl, pageUrl }) {
  const fetchOptions = {
    credentials: "include"
  };
  const normalizedPageUrl = String(pageUrl || "").trim();
  if (/^https?:\/\//i.test(normalizedPageUrl)) {
    fetchOptions.referrer = normalizedPageUrl;
  }

  const response = await fetch(imageUrl, fetchOptions);
  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status}).`);
  }

  const blob = await response.blob();
  return inlineImageFromBlob(blob, imageUrl);
}

function normalizeAnalyzeResult(result, sourceImageUrl) {
  const structuredPrompt = isPlainObject(result.structuredPrompt) ? result.structuredPrompt : {};
  const drafts = isPlainObject(result.drafts) ? result.drafts : {};
  const displayPrompts = isPlainObject(result.displayPrompts) ? result.displayPrompts : {};
  const fallbackPrompt = String(result.prompt || "").trim();
  const negativePromptZh = normalizeNegativePromptText(
    result.negativePromptZh || result.negativePrompt?.zh || result.negativePrompt || ""
  );
  const negativePromptEn = normalizeNegativePromptText(result.negativePromptEn || result.negativePrompt?.en || "");

  return {
    title: String(result.title || "图片提示词").trim() || "图片提示词",
    analysis: isPlainObject(result.analysis) ? result.analysis : null,
    structuredPrompt,
    keywords: Array.isArray(result.keywords) ? result.keywords : [],
    drafts,
    displayPrompts,
    negativePrompt: negativePromptZh,
    negativePromptZh,
    negativePromptEn,
    enPromptShort: firstText(result.enPromptShort, displayPrompts.enShort, structuredPrompt.enShort, drafts.enShort),
    enPromptFull: firstText(result.enPromptFull, displayPrompts.enFull, structuredPrompt.enFull, drafts.enFull, fallbackPrompt),
    zhPromptShort: firstText(result.zhPromptShort, displayPrompts.zhShort, structuredPrompt.zhShort, drafts.zhShort),
    zhPromptFull: firstText(result.zhPromptFull, displayPrompts.zhFull, structuredPrompt.zhFull, drafts.zhFull, fallbackPrompt),
    sourceImageUrl
  };
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function normalizeNegativePromptText(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const english = /^avoid\b/i.test(raw) || !/[\u4e00-\u9fff]/.test(raw);
  const prefix = english ? "Avoid " : "避免";
  const separator = english ? "; " : "；";

  return Array.from(
    new Set(
      raw
        .split(/[;；\n,，]+/)
        .map((item) =>
          item
            .trim()
            .replace(/[。.!！]+$/g, "")
            .replace(/^(?:避免|不要|不出现|去除|排除|Avoid|No|Without)\s*[:：-]?\s*/i, "")
            .replace(/^(?:出现|生成|包含)/, "")
            .trim()
        )
        .filter(Boolean)
    )
  )
    .map((item) => `${prefix}${item}`)
    .join(separator);
}

function normalizeGeneratedImages(images) {
  return (Array.isArray(images) ? images : [])
    .map((image) => createGeneratedImage(image))
    .filter((image) => image.base64Data || image.url);
}

function createGeneratedImage(input) {
  if (typeof input === "string") {
    const dataUrlImage = parseGeneratedImageDataUrl(input);
    if (dataUrlImage) return dataUrlImage;
    return {
      mimeType: "image/png",
      base64Data: "",
      url: input.trim()
    };
  }

  const source = input && typeof input === "object" ? input : {};
  return {
    mimeType: String(source.mimeType || source.mime_type || "image/png").trim() || "image/png",
    base64Data: String(source.base64Data || source.b64_json || source.data || "").trim(),
    url: String(source.url || "").trim()
  };
}

function parseGeneratedImageDataUrl(value) {
  const match = String(value || "").trim().match(/^data:([^;,]+)?;base64,(.+)$/i);
  if (!match) return null;
  return {
    mimeType: match[1] || "image/png",
    base64Data: match[2],
    url: ""
  };
}

async function saveViewerImages(images, prompt, negativePrompt = "") {
  const normalizedImages = normalizeGeneratedImages(images);
  await writeViewerPayload({
    id: VIEWER_RECORD_ID,
    createdAt: Date.now(),
    prompt,
    negativePrompt: normalizeNegativePromptText(negativePrompt),
    images: normalizedImages
  });

  return {
    viewerUrl: chrome.runtime.getURL("viewer.html")
  };
}

async function openViewerTab() {
  await chrome.tabs.create({
    url: chrome.runtime.getURL("viewer.html")
  });
}

async function writeViewerPayload(payload) {
  const db = await openViewerDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(VIEWER_STORE_NAME, "readwrite");
    const store = tx.objectStore(VIEWER_STORE_NAME);
    const request = store.put(payload);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Failed to write viewer payload."));
  });
  db.close();
}

function openViewerDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(VIEWER_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VIEWER_STORE_NAME)) {
        db.createObjectStore(VIEWER_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open viewer database."));
  });
}

function normalizeImageUrl(url) {
  return String(url || "").trim();
}

function normalizeImageDataUrl(value) {
  const dataUrl = String(value || "").trim();
  return dataUrl.startsWith("data:image/") ? dataUrl : "";
}

function parseDataUrlImage(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?;base64,(.+)$/i);
  if (!match) {
    throw new Error("Unsupported inline image format.");
  }

  return {
    mimeType: match[1] || "image/png",
    base64Data: match[2]
  };
}

function normalizeScreenshotCrop(value) {
  if (!isPlainObject(value)) return null;

  const crop = {
    x: Number(value.x),
    y: Number(value.y),
    width: Number(value.width),
    height: Number(value.height),
    devicePixelRatio: Number(value.devicePixelRatio) || 1
  };

  if (
    !Number.isFinite(crop.x) ||
    !Number.isFinite(crop.y) ||
    !Number.isFinite(crop.width) ||
    !Number.isFinite(crop.height) ||
    crop.width <= 0 ||
    crop.height <= 0
  ) {
    return null;
  }

  return crop;
}

async function captureVisibleTabImagePart(windowId, crop) {
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
    format: "png"
  });
  return cropCapturedImage(dataUrl, crop);
}

async function cropCapturedImage(dataUrl, crop) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const scale = crop.devicePixelRatio || 1;
  const sx = Math.max(0, Math.floor(crop.x * scale));
  const sy = Math.max(0, Math.floor(crop.y * scale));
  const sw = Math.max(1, Math.min(bitmap.width - sx, Math.floor(crop.width * scale)));
  const sh = Math.max(1, Math.min(bitmap.height - sy, Math.floor(crop.height * scale)));

  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create canvas context for screenshot crop.");
  }

  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  const croppedBlob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: ANALYSIS_IMAGE_JPEG_QUALITY
  });
  return inlineImageFromBlob(croppedBlob, "");
}

async function inlineImageFromBlob(blob, sourceUrl) {
  const optimized = await optimizeImageBlobForAnalysis(blob);
  const buffer = await optimized.arrayBuffer();

  return {
    mimeType: optimized.type || blob.type || guessMimeType(sourceUrl),
    base64Data: arrayBufferToBase64(buffer)
  };
}

async function optimizeImageBlobForAnalysis(blob) {
  if (!blob || !blob.type?.startsWith("image/")) return blob;
  if (typeof createImageBitmap === "undefined" || typeof OffscreenCanvas === "undefined") return blob;

  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch (_error) {
    return blob;
  }

  try {
    const { width, height } = fitImageSize(bitmap.width, bitmap.height, ANALYSIS_IMAGE_MAX_EDGE);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;

    ctx.drawImage(bitmap, 0, 0, width, height);
    return await canvas.convertToBlob({
      type: "image/jpeg",
      quality: ANALYSIS_IMAGE_JPEG_QUALITY
    });
  } finally {
    bitmap.close?.();
  }
}

function fitImageSize(width, height, maxEdge) {
  const sourceWidth = Math.max(1, Number(width) || 1);
  const sourceHeight = Math.max(1, Number(height) || 1);
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale))
  };
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function guessMimeType(url) {
  const normalized = String(url || "").toLowerCase();
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}