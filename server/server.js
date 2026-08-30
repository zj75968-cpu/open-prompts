import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFile(resolve(__dirname, ".env"));

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8787);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-this-admin-password";
const SETTINGS_FILE = resolve(__dirname, process.env.SETTINGS_FILE || "./data/settings.json");
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const ANALYZE_MAX_OUTPUT_TOKENS = 900;
const ANALYZE_TEMPERATURE = 0.2;

const DEFAULT_SETTINGS = {
  promptProvider: "openai-compatible",
  promptBaseUrl: "https://api.openai.com/v1",
  promptModel: "gpt-5.5",
  promptApiKey: "",
  imageProvider: "openai-compatible",
  imageBaseUrl: "https://api.openai.com/v1",
  imageModel: "gpt-image-2",
  imageApiKey: "",
  imageGenerationEnabled: true,
  maxImageCount: 4
};

const IMAGE_SIZE_BY_RATIO = {
  "1:1": "1024x1024",
  "3:4": "1024x1536",
  "4:3": "1536x1024",
  "9:16": "1024x1792",
  "16:9": "1792x1024"
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  try {
    if (req.method === "OPTIONS") return sendCors(res);
    if (url.pathname === "/health" && req.method === "GET") return sendJson(res, { ok: true });
    if (url.pathname === "/api/analyze" && req.method === "POST") return handleAnalyze(req, res);
    if (url.pathname === "/api/generate" && req.method === "POST") return handleGenerate(req, res);
    if (url.pathname === "/admin" && req.method === "GET") return handleAdminPage(req, res, url);
    if (url.pathname === "/admin/login" && req.method === "POST") return handleAdminLogin(req, res);
    if (url.pathname === "/admin/logout" && req.method === "POST") return handleAdminLogout(res);
    if (url.pathname === "/admin/settings" && req.method === "POST") return handleAdminSettings(req, res);
    return sendText(res, "Not Found", 404);
  } catch (error) {
    console.error("[PromptLens Server]", error);
    return sendJson(res, { error: { message: error.message || "Internal server error" } }, 500);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[PromptLens Server] listening on http://${HOST}:${PORT}`);
});

async function handleAnalyze(req, res) {
  const settings = getSettings();
  const payload = await readJson(req);
  const image = await resolveImage(payload);
  if (!image) throw new Error("Missing image payload.");

  const rawText = await analyzeWithProvider(settings, image, payload);
  const parsed = parseJsonFromModel(rawText);
  return sendJson(res, normalizeAnalyzeResult(parsed));
}

async function handleGenerate(req, res) {
  const settings = getSettings();
  const payload = await readJson(req);
  if (!settings.imageGenerationEnabled) throw new Error("Image generation is disabled by administrator.");

  const prompt = String(payload.prompt || "").trim();
  if (!prompt) throw new Error("Missing prompt for generation.");

  const negativePrompt = normalizeNegativePromptText(payload.negativePrompt || "");
  const count = clamp(Number(payload.count || 1), 1, settings.maxImageCount || 4);
  const aspectRatio = normalizeAspectRatio(payload.aspectRatio);
  const finalPrompt = combinePositiveAndNegativePrompt(prompt, negativePrompt);
  const images = await generateWithProvider(settings, {
    prompt: finalPrompt,
    aspectRatio,
    count
  });

  return sendJson(res, {
    images: normalizeGeneratedImages(images),
    negativePrompt
  });
}

async function handleAdminPage(req, res, url) {
  if (!isAuthenticated(req)) return sendHtml(res, renderLoginPage());
  return sendHtml(res, renderSettingsPage(getSettings(), url.searchParams.get("saved") === "1"));
}

async function handleAdminLogin(req, res) {
  const body = await readForm(req);
  if (String(body.password || "") !== ADMIN_PASSWORD) {
    return sendHtml(res, renderLoginPage("管理员密码错误。"), 401);
  }

  const token = createSessionToken();
  return redirect(res, "/admin", {
    "Set-Cookie": `il_admin=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`
  });
}

function handleAdminLogout(res) {
  return redirect(res, "/admin", {
    "Set-Cookie": "il_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
  });
}

async function handleAdminSettings(req, res) {
  if (!isAuthenticated(req)) return sendText(res, "Unauthorized", 401);

  const body = await readForm(req);
  const current = getSettings();
  const next = sanitizeSettings({
    ...current,
    promptProvider: body.promptProvider,
    promptBaseUrl: body.promptBaseUrl,
    promptModel: body.promptModel,
    promptApiKey: body.promptApiKey ? body.promptApiKey : current.promptApiKey,
    imageProvider: body.imageProvider,
    imageBaseUrl: body.imageBaseUrl,
    imageModel: body.imageModel,
    imageApiKey: body.imageApiKey ? body.imageApiKey : current.imageApiKey,
    imageGenerationEnabled: body.imageGenerationEnabled === "on",
    maxImageCount: Number(body.maxImageCount || current.maxImageCount)
  });

  saveSettings(next);
  return redirect(res, "/admin?saved=1");
}

async function analyzeWithProvider(settings, image, payload) {
  const prompt = buildAnalyzePrompt(payload);
  if (settings.promptProvider === "gemini") {
    ensureApiKey(settings.promptApiKey, "识图 Gemini API Key 未配置。");
    const data = await callGeminiGenerateContent({
      baseUrl: settings.promptBaseUrl,
      apiKey: settings.promptApiKey,
      model: settings.promptModel,
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: image.mimeType, data: image.base64Data } }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: ANALYZE_MAX_OUTPUT_TOKENS,
        temperature: ANALYZE_TEMPERATURE
      }
    });
    return extractTextFromGemini(data);
  }

  ensureApiKey(settings.promptApiKey, "识图 OpenAI Compatible API Key 未配置。");
  const data = await callOpenAICompatibleChatCompletion({
    baseUrl: settings.promptBaseUrl,
    apiKey: settings.promptApiKey,
    model: settings.promptModel,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.base64Data}` } }
        ]
      }
    ],
    response_format: { type: "json_object" },
    temperature: ANALYZE_TEMPERATURE,
    max_tokens: ANALYZE_MAX_OUTPUT_TOKENS
  });
  return extractTextFromOpenAICompatible(data);
}

async function generateWithProvider(settings, payload) {
  if (settings.imageProvider === "gemini") {
    ensureApiKey(settings.imageApiKey, "生图 Gemini API Key 未配置。");
    const data = await callGeminiGenerateContent({
      baseUrl: settings.imageBaseUrl,
      apiKey: settings.imageApiKey,
      model: settings.imageModel,
      contents: [{ parts: [{ text: payload.prompt }] }],
      generationConfig: {
        responseModalities: ["Image"],
        imageConfig: { aspectRatio: payload.aspectRatio }
      }
    });
    return extractImagesFromGemini(data);
  }

  ensureApiKey(settings.imageApiKey, "生图 OpenAI Compatible API Key 未配置。");
  const data = await callOpenAICompatibleImagesGenerate({
    baseUrl: settings.imageBaseUrl,
    apiKey: settings.imageApiKey,
    model: settings.imageModel,
    prompt: payload.prompt,
    n: payload.count,
    size: IMAGE_SIZE_BY_RATIO[payload.aspectRatio] || IMAGE_SIZE_BY_RATIO["1:1"]
  });
  return extractImagesFromOpenAICompatible(data);
}

async function callGeminiGenerateContent({ baseUrl, apiKey, model, contents, generationConfig }) {
  const endpoint = buildUrl(baseUrl, `/models/${encodeURIComponent(model)}:generateContent`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({ contents, ...(generationConfig ? { generationConfig } : {}) })
  });
  return parseApiResponse(response, endpoint);
}

async function callOpenAICompatibleChatCompletion({ baseUrl, apiKey, ...payload }) {
  const endpoint = buildUrl(baseUrl, "/chat/completions");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, endpoint);
}

async function callOpenAICompatibleImagesGenerate({ baseUrl, apiKey, ...payload }) {
  const endpoint = buildUrl(baseUrl, "/images/generations");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, endpoint);
}

async function parseApiResponse(response, endpoint) {
  const text = await response.text();
  const preview = text.trim().slice(0, 220);
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_error) {
      throw new Error(`上游接口返回的不是 JSON。请求地址：${endpoint}。响应开头：${preview}`);
    }
  }

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `上游请求失败：${response.status} ${endpoint}`);
  }

  return data;
}

function buildUrl(baseUrl, path) {
  return new URL(path.replace(/^\//, ""), `${String(baseUrl || "").replace(/\/+$/g, "")}/`).toString();
}

async function resolveImage(payload) {
  const direct = normalizeInlineImage(payload.image);
  if (direct) return direct;

  const imageUrl = String(payload.imageUrl || "").trim();
  if (!/^https?:\/\//i.test(imageUrl)) return null;

  const response = await fetch(imageUrl, {
    headers: payload.pageUrl ? { Referer: String(payload.pageUrl) } : undefined
  });
  if (!response.ok) throw new Error(`后端拉取图片失败：${response.status}`);

  const contentType = response.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error(`图片地址返回的不是图片：${contentType}`);

  const buffer = await response.arrayBuffer();
  return {
    mimeType: contentType.split(";")[0],
    base64Data: Buffer.from(buffer).toString("base64")
  };
}

function normalizeInlineImage(image) {
  if (!image || typeof image !== "object") return null;
  const mimeType = String(image.mimeType || image.mime_type || "image/png").trim();
  const base64Data = String(image.base64Data || image.data || "").trim();
  if (!base64Data) return null;
  return { mimeType, base64Data };
}

function buildAnalyzePrompt(payload) {
  return [
    "请快速分析图片，输出严格 JSON，不要 Markdown，不要解释。",
    "目标：给图片生成可编辑、可复制、可直接用于生图的中英文提示词。",
    "优先识别画面中确定可见的信息；不要扩写无关背景。",
    "字段要求：full 适合直接生图，short 不超过 35 个英文词或 60 个中文字符。",
    "negativePrompt.zh 使用“避免XXX；避免XXX”，negativePrompt.en 使用“Avoid XXX; Avoid XXX”。",
    "JSON 格式：",
    '{"title":"","structuredPrompt":{"enFull":"","enShort":"","zhFull":"","zhShort":""},"negativePrompt":{"zh":"","en":""},"analysis":{"subject":"","style":"","lighting":"","composition":"","environment":"","color":""},"keywords":[]}',
    `页面地址：${payload.pageUrl || "unknown"}`,
    `图片 alt：${payload.alt || "none"}`
  ].join("\n");
}

function parseJsonFromModel(rawText) {
  const text = String(rawText || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const jsonText = extractFirstJsonObject(candidate);
  return JSON.parse(jsonText);
}

function extractFirstJsonObject(text) {
  const source = String(text || "");
  const start = source.indexOf("{");
  if (start < 0) return source;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = inString;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  return source.slice(start);
}

function normalizeAnalyzeResult(result) {
  const structuredPrompt = asObject(result.structuredPrompt);
  const drafts = asObject(result.drafts);
  const displayPrompts = asObject(result.displayPrompts);
  const negativePromptZh = normalizeNegativePromptText(result.negativePromptZh || result.negativePrompt?.zh || result.negativePrompt || "");
  const negativePromptEn = normalizeNegativePromptText(result.negativePromptEn || result.negativePrompt?.en || "");

  return {
    title: String(result.title || "图片提示词").trim() || "图片提示词",
    analysis: asObject(result.analysis),
    structuredPrompt,
    keywords: Array.isArray(result.keywords) ? result.keywords : [],
    drafts,
    displayPrompts,
    negativePrompt: negativePromptZh,
    negativePromptZh,
    negativePromptEn,
    enPromptShort: firstText(result.enPromptShort, displayPrompts.enShort, structuredPrompt.enShort, drafts.enShort),
    enPromptFull: firstText(result.enPromptFull, displayPrompts.enFull, structuredPrompt.enFull, drafts.enFull, result.prompt),
    zhPromptShort: firstText(result.zhPromptShort, displayPrompts.zhShort, structuredPrompt.zhShort, drafts.zhShort),
    zhPromptFull: firstText(result.zhPromptFull, displayPrompts.zhFull, structuredPrompt.zhFull, drafts.zhFull, result.prompt)
  };
}

function extractTextFromGemini(data) {
  return (data?.candidates?.[0]?.content?.parts || [])
    .map((part) => part?.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractTextFromOpenAICompatible(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((part) => part?.text || "").filter(Boolean).join("\n").trim();
  return "";
}

function extractImagesFromGemini(data) {
  return (Array.isArray(data?.candidates) ? data.candidates : [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => {
      const raw = part?.inlineData?.data || part?.inline_data?.data;
      if (!raw) return null;
      return {
        mimeType: part?.inlineData?.mimeType || part?.inline_data?.mime_type || "image/png",
        base64Data: raw,
        url: ""
      };
    })
    .filter(Boolean);
}

function extractImagesFromOpenAICompatible(data) {
  return (Array.isArray(data?.data) ? data.data : [])
    .map((item) => {
      if (item?.b64_json) return { mimeType: item?.mime_type || "image/png", base64Data: item.b64_json, url: "" };
      if (item?.url) return { mimeType: item?.mime_type || "image/png", base64Data: "", url: item.url };
      return null;
    })
    .filter(Boolean);
}

function normalizeGeneratedImages(images) {
  return (Array.isArray(images) ? images : [])
    .map((image) => {
      if (typeof image === "string") return parseGeneratedImageString(image);
      const source = image && typeof image === "object" ? image : {};
      return {
        mimeType: String(source.mimeType || source.mime_type || "image/png").trim() || "image/png",
        base64Data: String(source.base64Data || source.b64_json || source.data || "").trim(),
        url: String(source.url || "").trim()
      };
    })
    .filter((image) => image.base64Data || image.url);
}

function parseGeneratedImageString(value) {
  const text = String(value || "").trim();
  const match = text.match(/^data:([^;,]+)?;base64,(.+)$/i);
  if (!match) return { mimeType: "image/png", base64Data: "", url: text };
  return { mimeType: match[1] || "image/png", base64Data: match[2], url: "" };
}

function getSettings() {
  if (!existsSync(SETTINGS_FILE)) return DEFAULT_SETTINGS;
  try {
    return sanitizeSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(SETTINGS_FILE, "utf8")) });
  } catch (_error) {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings) {
  mkdirSync(dirname(SETTINGS_FILE), { recursive: true });
  writeFileSync(SETTINGS_FILE, `${JSON.stringify(sanitizeSettings(settings), null, 2)}\n`);
}

function sanitizeSettings(settings) {
  const providerSet = new Set(["gemini", "openai-compatible"]);
  return {
    promptProvider: providerSet.has(settings.promptProvider) ? settings.promptProvider : DEFAULT_SETTINGS.promptProvider,
    promptBaseUrl: nonEmptyString(settings.promptBaseUrl, DEFAULT_SETTINGS.promptBaseUrl),
    promptModel: nonEmptyString(settings.promptModel, DEFAULT_SETTINGS.promptModel),
    promptApiKey: String(settings.promptApiKey || ""),
    imageProvider: providerSet.has(settings.imageProvider) ? settings.imageProvider : DEFAULT_SETTINGS.imageProvider,
    imageBaseUrl: nonEmptyString(settings.imageBaseUrl, DEFAULT_SETTINGS.imageBaseUrl),
    imageModel: nonEmptyString(settings.imageModel, DEFAULT_SETTINGS.imageModel),
    imageApiKey: String(settings.imageApiKey || ""),
    imageGenerationEnabled: Boolean(settings.imageGenerationEnabled),
    maxImageCount: clamp(Number(settings.maxImageCount || DEFAULT_SETTINGS.maxImageCount), 1, 4)
  };
}

function renderLoginPage(error = "") {
  return renderLayout(`
    <section class="card narrow">
      <p class="eyebrow">PromptLens Server</p>
      <h1>管理员登录</h1>
      <p class="muted">配置 API Key、模型和 Base URL。普通扩展用户不会看到这些设置。</p>
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
      <form method="post" action="/admin/login" class="stack">
        <label>管理员密码<input name="password" type="password" autocomplete="current-password" required /></label>
        <button type="submit">登录</button>
      </form>
    </section>
  `);
}

function renderSettingsPage(settings, saved) {
  return renderLayout(`
    <section class="card">
      <div class="topbar">
        <div>
          <p class="eyebrow">PromptLens Server</p>
          <h1>后台设置</h1>
          <p class="muted">敏感配置只保存在服务器端，扩展端只请求后端 API。</p>
        </div>
        <form method="post" action="/admin/logout"><button class="secondary" type="submit">退出</button></form>
      </div>
      ${saved ? '<p class="success">设置已保存。</p>' : ""}
      ${ADMIN_PASSWORD === "change-this-admin-password" ? '<p class="warning">当前仍使用默认 ADMIN_PASSWORD，请在 .env 中修改。</p>' : ""}
      <form method="post" action="/admin/settings" class="grid-form">
        <fieldset>
          <legend>识图</legend>
          ${providerSelect("promptProvider", settings.promptProvider)}
          ${input("promptBaseUrl", "识图 Base URL", settings.promptBaseUrl)}
          ${input("promptModel", "识图模型", settings.promptModel)}
          ${input("promptApiKey", "识图 API Key", "", "password", settings.promptApiKey ? "留空则保留当前 Key" : "请输入 API Key")}
        </fieldset>
        <fieldset>
          <legend>生图</legend>
          ${providerSelect("imageProvider", settings.imageProvider)}
          ${input("imageBaseUrl", "生图 Base URL", settings.imageBaseUrl)}
          ${input("imageModel", "生图模型", settings.imageModel)}
          ${input("imageApiKey", "生图 API Key", "", "password", settings.imageApiKey ? "留空则保留当前 Key" : "请输入 API Key")}
          <label class="checkbox"><input name="imageGenerationEnabled" type="checkbox" ${settings.imageGenerationEnabled ? "checked" : ""} /> 开启生图功能</label>
          ${input("maxImageCount", "单次最大张数", settings.maxImageCount, "number")}
        </fieldset>
        <button type="submit">保存设置</button>
      </form>
    </section>
  `);
}

function renderLayout(content) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PromptLens Server Admin</title>
  <style>
    :root{color-scheme:dark;--bg:#08111f;--card:rgba(255,255,255,.07);--border:rgba(255,255,255,.13);--text:#f8fbff;--muted:rgba(230,238,255,.68);--accent:#60a5fa;--danger:#fca5a5;--ok:#86efac;--warn:#fde68a}*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;color:var(--text);background:radial-gradient(circle at 20% 0%,rgba(96,165,250,.24),transparent 30%),linear-gradient(135deg,#08111f,#111827)}main{width:min(960px,calc(100vw - 32px));margin:0 auto;padding:40px 0}.card{padding:28px;border:1px solid var(--border);border-radius:24px;background:var(--card);box-shadow:0 24px 80px rgba(0,0,0,.28);backdrop-filter:blur(22px)}.narrow{max-width:460px;margin:8vh auto}.eyebrow{margin:0 0 8px;color:var(--muted);font-size:12px;letter-spacing:.18em;text-transform:uppercase}h1{margin:0 0 10px;font-size:34px}.muted{color:var(--muted);line-height:1.7}.stack,.grid-form,fieldset{display:grid;gap:16px}.grid-form{grid-template-columns:1fr 1fr;margin-top:22px}@media(max-width:760px){.grid-form{grid-template-columns:1fr}}fieldset{margin:0;padding:18px;border:1px solid var(--border);border-radius:18px}legend{padding:0 8px;color:var(--muted)}label{display:grid;gap:8px;font-weight:650}.checkbox{display:flex;align-items:center;gap:10px}input,select,button{min-height:44px;border-radius:14px;border:1px solid var(--border);font:inherit}input,select{width:100%;padding:0 12px;color:var(--text);background:rgba(255,255,255,.06)}button{padding:0 16px;color:white;background:linear-gradient(180deg,#2563eb,#0ea5e9);cursor:pointer}.secondary{background:rgba(255,255,255,.08)}.topbar{display:flex;align-items:start;justify-content:space-between;gap:16px}.error{color:var(--danger)}.success{color:var(--ok)}.warning{color:var(--warn)}
  </style>
</head>
<body><main>${content}</main></body>
</html>`;
}

function providerSelect(name, value) {
  return `<label>服务商<select name="${name}">
    <option value="openai-compatible" ${value === "openai-compatible" ? "selected" : ""}>OpenAI Compatible</option>
    <option value="gemini" ${value === "gemini" ? "selected" : ""}>Gemini</option>
  </select></label>`;
}

function input(name, label, value, type = "text", placeholder = "") {
  return `<label>${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" /></label>`;
}

async function readJson(req) {
  const text = await readBody(req);
  return text ? JSON.parse(text) : {};
}

async function readForm(req) {
  const text = await readBody(req);
  return Object.fromEntries(new URLSearchParams(text));
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 30 * 1024 * 1024) {
        req.destroy();
        reject(new Error("Request body too large."));
      }
    });
    req.on("end", () => resolveBody(data));
    req.on("error", reject);
  });
}

function sendCors(res) {
  res.writeHead(204, getCorsHeaders());
  res.end();
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { ...getCorsHeaders(), "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendHtml(res, html, status = 200) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function sendText(res, text, status = 200) {
  res.writeHead(status, { ...getCorsHeaders(), "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, ...headers });
  res.end();
}

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
  };
}

function createSessionToken() {
  const timestamp = String(Date.now());
  const signature = sign(timestamp);
  return Buffer.from(`${timestamp}.${signature}`).toString("base64url");
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies.il_admin;
  if (!token) return false;

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [timestamp, signature] = decoded.split(".");
    if (!timestamp || !signature) return false;
    if (Date.now() - Number(timestamp) > SESSION_MAX_AGE_SECONDS * 1000) return false;
    return safeEqual(signature, sign(timestamp));
  } catch (_error) {
    return false;
  }
}

function sign(value) {
  return createHmac("sha256", ADMIN_PASSWORD).update(value).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseCookies(header) {
  return Object.fromEntries(
    String(header || "")
      .split(";")
      .map((item) => item.trim().split("="))
      .filter(([key, value]) => key && value)
  );
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

function ensureApiKey(apiKey, message) {
  if (!apiKey) throw new Error(message);
}

function normalizeAspectRatio(value) {
  const ratio = String(value || "1:1").trim();
  return IMAGE_SIZE_BY_RATIO[ratio] ? ratio : "1:1";
}

function combinePositiveAndNegativePrompt(prompt, negativePrompt) {
  return [prompt, negativePrompt ? `Negative prompt: ${negativePrompt}` : ""].filter(Boolean).join("\n\n");
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

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function nonEmptyString(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function clamp(value, min, max) {
  const number = Number.isFinite(value) ? Math.trunc(value) : min;
  return Math.max(min, Math.min(max, number));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}