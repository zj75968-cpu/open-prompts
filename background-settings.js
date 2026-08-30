export const PUBLIC_API_BASE_URL = "https://impro.n8nmydomain.com";

export const DEFAULT_SETTINGS = {
  apiBaseUrl: PUBLIC_API_BASE_URL,
  autoAnalyze: true,
  aspectRatio: "1:1",
  imageCount: 1,
  imageGenerationEnabled: true
};

const PUBLIC_SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);
const LEGACY_PUBLIC_API_BASE_URLS = new Set(["http://localhost:8787"]);
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
  return sanitizePublicSettings({ ...DEFAULT_SETTINGS, ...stored });
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
  const apiBaseUrl = String(existing.apiBaseUrl || "").trim().replace(/\/+$/g, "");
  if (LEGACY_PUBLIC_API_BASE_URLS.has(apiBaseUrl)) {
    return { apiBaseUrl: PUBLIC_API_BASE_URL };
  }
  return {};
}

function normalizeApiBaseUrl(value) {
  const normalized = String(value || "").trim().replace(/\/+$/g, "");
  return normalized || PUBLIC_API_BASE_URL;
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