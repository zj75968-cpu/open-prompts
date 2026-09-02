export const PUBLIC_API_BASE_URL = "https://impro.n8nmydomain.com";
export const DEFAULT_OPEN_PROMPTS_CREATE_URL = "https://open-prompts.com/zh/create";

export const DEFAULT_SETTINGS = {
  apiBaseUrl: PUBLIC_API_BASE_URL,
  openPromptsCreateUrl: DEFAULT_OPEN_PROMPTS_CREATE_URL,
  autoAnalyze: true,
  aspectRatio: "1:1",
  imageCount: 1,
  imageGenerationEnabled: true
};

const PUBLIC_SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);
const LEGACY_PUBLIC_API_BASE_URLS = new Set(["http://localhost:8787"]);
const LEGACY_OPEN_PROMPTS_CREATE_URLS = new Set([
  "http://localhost:3000/zh/create",
  "http://127.0.0.1:3000/zh/create",
  "http://localhost:3002/zh/create",
  "http://127.0.0.1:3002/zh/create",
  "https://www.open-prompts.com/zh/create"
]);
const LEGACY_PRIVATE_SETTING_KEYS = [
  "provider",
  "promptProvider",
  "imageProvider",
  "apiMode",
  "promptApiKey",
  "promptModel",
  "promptBaseUrl",
  "imageApiKey",
  "imageModel",
  "imageBaseUrl",
  "geminiBaseUrl",
  "openaiBaseUrl",
  "geminiApiKey",
  "geminiTextModel",
  "geminiImageModel",
  "customProxyUrl",
  "customProxyToken",
  "providerProfiles",
  "promptProviderProfiles",
  "imageProviderProfiles",
  "publicApiBaseUrl"
];

export async function initializeSettings() {
  await removeLegacyPrivateSettings();

  const existing = await chrome.storage.local.get(PUBLIC_SETTING_KEYS);
  const missing = Object.fromEntries(
    Object.entries(DEFAULT_SETTINGS).filter(([key]) => !(key in existing))
  );
  const migrated = getPublicSettingMigrations(existing);
  const updates = { ...missing, ...migrated };

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
}

export async function getSettings() {
  await removeLegacyPrivateSettings();

  const stored = await chrome.storage.local.get(PUBLIC_SETTING_KEYS);
  const migrated = getPublicSettingMigrations(stored);
  if (Object.keys(migrated).length > 0) {
    await chrome.storage.local.set(migrated);
  }
  return sanitizePublicSettings({ ...DEFAULT_SETTINGS, ...stored, ...migrated });
}

export async function saveSettings(payload = {}) {
  const current = await getSettings();
  const next = sanitizePublicSettings({ ...current, ...pickPublicSettings(payload) });
  await chrome.storage.local.set(next);
  return next;
}

function sanitizePublicSettings(settings) {
  return {
    apiBaseUrl: normalizeApiBaseUrl(settings.apiBaseUrl),
    openPromptsCreateUrl: normalizeOpenPromptsCreateUrl(settings.openPromptsCreateUrl),
    autoAnalyze: Boolean(settings.autoAnalyze),
    aspectRatio: normalizeAspectRatio(settings.aspectRatio),
    imageCount: clampImageCount(settings.imageCount),
    imageGenerationEnabled: Boolean(settings.imageGenerationEnabled)
  };
}

function pickPublicSettings(payload) {
  const next = {};
  for (const key of PUBLIC_SETTING_KEYS) {
    if (key in payload) next[key] = payload[key];
  }
  return next;
}

function getPublicSettingMigrations(existing) {
  const updates = {};
  const apiBaseUrl = String(existing.apiBaseUrl || "").trim().replace(/\/+$/g, "");
  if (LEGACY_PUBLIC_API_BASE_URLS.has(apiBaseUrl)) {
    updates.apiBaseUrl = PUBLIC_API_BASE_URL;
  }

  const openPromptsCreateUrl = String(existing.openPromptsCreateUrl || "").trim().replace(/\/+$/g, "");
  if (LEGACY_OPEN_PROMPTS_CREATE_URLS.has(openPromptsCreateUrl)) {
    updates.openPromptsCreateUrl = DEFAULT_OPEN_PROMPTS_CREATE_URL;
  }

  return updates;
}

function normalizeApiBaseUrl(value) {
  const normalized = String(value || "").trim().replace(/\/+$/g, "");
  return normalized || PUBLIC_API_BASE_URL;
}

function normalizeOpenPromptsCreateUrl(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return DEFAULT_OPEN_PROMPTS_CREATE_URL;

  let url;
  try {
    url = new URL(normalized);
  } catch (_error) {
    throw new Error("Open Prompts 地址必须是有效的 http/https URL。");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Open Prompts 地址只支持 http/https。");
  }

  url.hash = "";
  return url.toString();
}

function normalizeAspectRatio(value) {
  const supported = new Set(["1:1", "3:4", "4:3", "9:16", "16:9"]);
  const normalized = String(value || "").trim();
  return supported.has(normalized) ? normalized : DEFAULT_SETTINGS.aspectRatio;
}

function clampImageCount(value) {
  const count = Number(value) || DEFAULT_SETTINGS.imageCount;
  return Math.max(1, Math.min(4, Math.trunc(count)));
}

async function removeLegacyPrivateSettings() {
  await chrome.storage.local.remove(LEGACY_PRIVATE_SETTING_KEYS);
}