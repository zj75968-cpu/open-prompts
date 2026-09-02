const imageCache = new Map();
const RATIO_OPTIONS = ["1:1", "3:4", "4:3", "9:16", "16:9"];
const ANALYSIS_IMAGE_MAX_EDGE = 1280;
const ANALYSIS_IMAGE_JPEG_QUALITY = 0.82;
const OPEN_PROMPTS_DRAFT_PARAM = "promptlensDraft";
const OPEN_PROMPTS_MESSAGE_SOURCE = "promptlens-extension";
const OPEN_PROMPTS_PAGE_SOURCE = "open-prompts";
const OPEN_PROMPTS_BRIDGE_ATTEMPTS = 30;
const OPEN_PROMPTS_BRIDGE_INTERVAL_MS = 300;

const state = {
  settings: null,
  hoverImage: null,
  panelImage: null,
  panelOpen: false,
  currentJob: null,
  panelData: createEmptyPanelData(),
  actionState: {
    analyze: false,
    generate: false,
    openPrompts: false
  }
};

const hoverTrigger = document.createElement("button");
hoverTrigger.id = "pg-hover-trigger";
hoverTrigger.type = "button";
hoverTrigger.title = "分析图片并生成提示词";

const panel = document.createElement("aside");
panel.id = "pg-panel";
panel.innerHTML = `
  <div class="pg-shell">
    <div class="pg-header">
      <div class="pg-title">
        <strong>灵感图镜 PromptLens</strong>
      </div>
      <div class="pg-header-actions">
        <button class="pg-close" id="pg-close" type="button">关闭</button>
      </div>
    </div>

    <div class="pg-row">
      <div class="pg-preview"><img id="pg-preview-image" alt="selected image preview" /></div>
      <div class="pg-title">
        <strong id="pg-image-title">当前图片</strong>
        <span id="pg-image-url">等待选择图片</span>
      </div>
    </div>

    <section class="pg-section pg-section-prompt">
      <div class="pg-section-head">
        <strong>提示词</strong>
        <div class="pg-chip-group">
          <button class="pg-chip" id="pg-detail-short" type="button">精简版</button>
          <button class="pg-chip is-active" id="pg-detail-full" type="button">完整版</button>
          <button class="pg-chip" id="pg-toggle-translation" type="button">翻译</button>
          <button class="pg-chip" id="pg-toggle-structure" type="button">查看结构</button>
        </div>
      </div>

      <textarea class="pg-textarea" id="pg-prompt-input" placeholder="这里会显示识别后的提示词，你可以直接修改。"></textarea>
      <div class="pg-negative-box">
        <div class="pg-negative-head">
          <strong>负面提示词</strong>
          <span>主要以“避免XXX；避免XXX”形式控制不想出现的内容</span>
        </div>
        <textarea class="pg-textarea pg-negative-textarea" id="pg-negative-input" placeholder="例如：避免低清晰度；避免画面模糊；避免水印"></textarea>
      </div>
      <div class="pg-structure pg-hidden" id="pg-structure">
        <div class="pg-structure-grid" id="pg-structure-grid"></div>
      </div>
      <div class="pg-meta">
        <span id="pg-status">就绪</span>
        <span id="pg-char-count">0 字</span>
      </div>

      <div class="pg-actions pg-actions-fixed">
        <button class="pg-action pg-fixed-control" id="pg-copy" type="button">复制提示词</button>
        <button class="pg-action pg-fixed-control" id="pg-analyze" type="button">重新识别</button>
        <button class="pg-action pg-open-prompts" id="pg-open-prompts" type="button">去 Open Prompts 生图</button>
      </div>
    </section>

    <section class="pg-section" id="pg-generate-section">
      <div class="pg-section-head">
        <strong>立刻生图</strong>
      </div>

      <div class="pg-generate-row">
        <label class="pg-select-wrap pg-fixed-control-wrap">
          <span>图片比例</span>
          <select class="pg-select pg-fixed-control" id="pg-ratio-select"></select>
        </label>
        <div class="pg-actions pg-actions-fixed">
          <button class="pg-action primary pg-fixed-control" id="pg-generate" type="button">立刻生图</button>
        </div>
      </div>

      <div class="pg-inline-preview" id="pg-inline-preview">
        <div class="pg-inline-stack" id="pg-inline-grid"></div>
      </div>
    </section>

    <p class="pg-credit">PromptLens · MIT License</p>
  </div>
`;

document.documentElement.append(hoverTrigger, panel);

const els = {
  previewImage: panel.querySelector("#pg-preview-image"),
  imageTitle: panel.querySelector("#pg-image-title"),
  imageUrl: panel.querySelector("#pg-image-url"),
  input: panel.querySelector("#pg-prompt-input"),
  negativeInput: panel.querySelector("#pg-negative-input"),
  status: panel.querySelector("#pg-status"),
  charCount: panel.querySelector("#pg-char-count"),
  analyze: panel.querySelector("#pg-analyze"),
  copy: panel.querySelector("#pg-copy"),
  openPrompts: panel.querySelector("#pg-open-prompts"),
  generate: panel.querySelector("#pg-generate"),
  close: panel.querySelector("#pg-close"),
  detailShort: panel.querySelector("#pg-detail-short"),
  detailFull: panel.querySelector("#pg-detail-full"),
  toggleTranslation: panel.querySelector("#pg-toggle-translation"),
  toggleStructure: panel.querySelector("#pg-toggle-structure"),
  structure: panel.querySelector("#pg-structure"),
  structureGrid: panel.querySelector("#pg-structure-grid"),
  generateSection: panel.querySelector("#pg-generate-section"),
  ratioSelect: panel.querySelector("#pg-ratio-select"),
  inlinePreview: panel.querySelector("#pg-inline-preview"),
  inlineGrid: panel.querySelector("#pg-inline-grid")
};

init();

async function init() {
  bindEvents();
  initOpenPromptsDraftBridge();
  state.panelData.detail = "full";

  try {
    const response = await sendMessage({ type: "get-settings" });
    state.settings = response;
    state.panelData.aspectRatio = state.settings.aspectRatio || "1:1";
    renderRatioSelect();
    syncGenerationVisibility();
    syncPromptControls();
  } catch (error) {
    console.error("[PromptLens] Failed to initialize content script.", error);
    state.panelData.aspectRatio = "1:1";
    renderRatioSelect();
    syncPromptControls();
  }
}

function createEmptyPanelData() {
  return {
    title: "",
    detail: "full",
    language: "zh",
    aspectRatio: "1:1",
    prompts: {
      short: {
        en: "",
        zh: ""
      },
      full: {
        en: "",
        zh: ""
      }
    },
    structuredPrompt: null,
    analysis: null,
    negativePrompt: "",
    structureOpen: false
  };
}

function bindEvents() {
  document.addEventListener("pointermove", handlePointerMove, true);
  document.addEventListener("scroll", updateHoverButtonPosition, true);
  window.addEventListener("resize", updateHoverButtonPosition);

  hoverTrigger.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const image = state.hoverImage || findEligibleImageNearPoint(event.clientX, event.clientY);
    if (!image) return;

    try {
      await openPanelForImage(image);
    } catch (error) {
      console.error("[PromptLens] Failed to open panel.", error);
      setStatus(error.message || "打开面板失败，请刷新当前网页后重试。", "error");
    }
  });

  els.close.addEventListener("click", closePanel);

  els.input.addEventListener("input", () => {
    state.panelData.prompts[state.panelData.detail][getCurrentLanguage()] = els.input.value;
    updateMeta();
    persistPanelImageCache();
  });

  els.negativeInput.addEventListener("input", () => {
    state.panelData.negativePrompt = els.negativeInput.value;
    persistPanelImageCache();
  });

  els.negativeInput.addEventListener("blur", () => {
    state.panelData.negativePrompt = normalizeNegativePromptForDisplay(els.negativeInput.value);
    els.negativeInput.value = state.panelData.negativePrompt;
    persistPanelImageCache();
  });

  els.detailShort.addEventListener("click", () => switchDetail("short"));
  els.detailFull.addEventListener("click", () => switchDetail("full"));
  els.toggleTranslation.addEventListener("click", togglePromptLanguage);
  els.toggleStructure.addEventListener("click", toggleStructureView);
  els.analyze.addEventListener("click", () => analyzeCurrentImage({ force: true }));

  els.ratioSelect.addEventListener("change", () => {
    state.panelData.aspectRatio = els.ratioSelect.value;
    persistPanelImageCache();
    setStatus(`生图比例已切换为 ${state.panelData.aspectRatio}`);
  });

  els.copy.addEventListener("click", async () => {
    const text = buildClipboardPrompt();
    if (!text) {
      setStatus("没有可复制的提示词。", "error");
      return;
    }
    await navigator.clipboard.writeText(text);
    setStatus("提示词已复制。", "success");
  });

  els.openPrompts.addEventListener("click", () => openCurrentPromptInOpenPrompts());
  els.generate.addEventListener("click", () => generateFromCurrentPrompt());
  els.inlineGrid.addEventListener("click", handleInlinePreviewClick);
}

function renderRatioSelect() {
  els.ratioSelect.innerHTML = RATIO_OPTIONS.map((ratio) => {
    const selected = ratio === state.panelData.aspectRatio ? " selected" : "";
    return `<option value="${ratio}"${selected}>${ratio}</option>`;
  }).join("");
}

function initOpenPromptsDraftBridge() {
  const draftId = new URLSearchParams(location.search).get(OPEN_PROMPTS_DRAFT_PARAM)?.trim() || "";
  if (!/^[a-zA-Z0-9-]{12,80}$/.test(draftId)) return;

  let draft = null;
  let attempts = 0;
  let acknowledged = false;
  let intervalId = null;

  const publishDraft = () => {
    if (!draft || acknowledged) return;
    attempts += 1;
    window.postMessage(
      {
        source: OPEN_PROMPTS_MESSAGE_SOURCE,
        type: "promptlens-draft",
        draftId,
        draft
      },
      location.origin
    );
  };

  const cleanup = () => {
    if (intervalId !== null) window.clearInterval(intervalId);
    window.removeEventListener("message", handlePageMessage);
  };

  const removeDraftParam = () => {
    const url = new URL(location.href);
    url.searchParams.delete(OPEN_PROMPTS_DRAFT_PARAM);
    history.replaceState(history.state, "", url.toString());
  };

  const handlePageMessage = async (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data;
    if (!message || message.source !== OPEN_PROMPTS_PAGE_SOURCE || message.draftId !== draftId) return;

    if (message.type === "promptlens-ready") {
      publishDraft();
      return;
    }

    if (message.type !== "promptlens-draft-accepted" || acknowledged) return;
    acknowledged = true;

    try {
      await sendMessage({
        type: "consume-open-prompts-draft",
        payload: { draftId }
      });
      removeDraftParam();
    } catch (error) {
      acknowledged = false;
      console.warn("[PromptLens] Failed to consume Open Prompts draft.", error);
      return;
    }

    cleanup();
  };

  window.addEventListener("message", handlePageMessage);

  sendMessage({ type: "get-open-prompts-draft", payload: { draftId } })
    .then((result) => {
      draft = result?.draft || null;
      if (!draft) throw new Error("PromptLens 草稿为空。");

      publishDraft();
      intervalId = window.setInterval(() => {
        if (acknowledged || attempts >= OPEN_PROMPTS_BRIDGE_ATTEMPTS) {
          cleanup();
          return;
        }
        publishDraft();
      }, OPEN_PROMPTS_BRIDGE_INTERVAL_MS);
    })
    .catch((error) => {
      cleanup();
      console.warn("[PromptLens] Unable to deliver Open Prompts draft.", error);
    });
}

async function openCurrentPromptInOpenPrompts() {
  const prompt = getCurrentPrompt().trim();
  if (!prompt) {
    setStatus("请先识别或输入提示词。", "error");
    return;
  }

  await runAction("openPrompts", "正在打开 Open Prompts...", async () => {
    const sourceImageUrl = state.panelImage?.currentSrc || state.panelImage?.src || "";
    await sendMessage({
      type: "open-open-prompts",
      payload: {
        prompt,
        negativePrompt: getCurrentNegativePrompt(),
        sourceImageUrl,
        sourcePageUrl: location.href
      }
    });
    setStatus("已打开 Open Prompts，请确认参数后手动生成。", "success");
  });
}

function handleInlinePreviewClick(event) {
  const action = event.target.closest("[data-role]");
  if (!action) return;

  const role = action.dataset.role;
  const index = Number(action.dataset.index);
  if (!Number.isFinite(index)) return;

  const src = getImageDataUrl(index);
  if (!src) return;

  if (role === "download") {
    triggerDownload(src, `promptlens-${index + 1}.png`);
    return;
  }

  if (role === "viewer") {
    const image = state.currentJob?.images?.[index];
    sendMessage({
      type: "open-viewer",
      payload: {
        prompt: getCurrentPrompt().trim(),
        negativePrompt: getCurrentNegativePrompt(),
        images: image ? [image] : []
      }
    }).catch((error) => {
      setStatus(error.message || "打开新页面失败。", "error");
    });
  }
}

function handlePointerMove(event) {
  if (state.panelOpen && panel.contains(event.target)) return;

  const image = event.target instanceof Element ? findEligibleImage(event.target, event.clientX, event.clientY) : null;
  if (!image) {
    if (!hoverTrigger.matches(":hover")) hideHoverButton();
    return;
  }

  state.hoverImage = image;
  updateHoverButtonPosition();
}

function findEligibleImage(startNode, clientX, clientY) {
  const directImage = findEligibleImageFromElement(startNode);
  if (directImage) return directImage;

  return findEligibleImageNearPoint(clientX, clientY);
}

function findEligibleImageFromElement(element) {
  const image = element.closest("img");
  return isEligibleImage(image) ? image : null;
}

function findEligibleImageNearPoint(clientX, clientY) {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

  const elements = document.elementsFromPoint(clientX, clientY);
  for (const element of elements) {
    const image = findEligibleImageFromElement(element);
    if (image) return image;

    const nestedImage = element.querySelector?.("img");
    if (isEligibleImage(nestedImage)) return nestedImage;
  }

  return null;
}

function isEligibleImage(image) {
  if (!(image instanceof HTMLImageElement)) return false;
  const rect = image.getBoundingClientRect();
  const src = image.currentSrc || image.src;
  return Boolean(src && rect.width >= 96 && rect.height >= 96);
}

function updateHoverButtonPosition() {
  if (!state.hoverImage || !document.documentElement.contains(state.hoverImage)) {
    hideHoverButton();
    return;
  }

  const rect = state.hoverImage.getBoundingClientRect();
  if (rect.width < 96 || rect.height < 96 || rect.bottom < 0 || rect.top > window.innerHeight) {
    hideHoverButton();
    return;
  }

  hoverTrigger.style.display = "flex";
  hoverTrigger.style.top = `${Math.max(10, rect.top + 8)}px`;
  hoverTrigger.style.left = `${Math.max(10, rect.left + 8)}px`;
}

function hideHoverButton() {
  state.hoverImage = null;
  hoverTrigger.style.display = "none";
}

async function openPanelForImage(image) {
  state.panelImage = image;
  state.panelOpen = true;
  panel.classList.add("pg-open");

  const imageUrl = image.currentSrc || image.src;
  els.previewImage.src = imageUrl;
  els.imageTitle.textContent = image.alt?.trim() || "网页图片";
  els.imageUrl.textContent = truncateMiddle(imageUrl, 52);
  state.currentJob = null;
  renderInlineImages([]);

  state.panelData = createEmptyPanelData();
  state.panelData.detail = "full";
  state.panelData.aspectRatio = state.settings?.aspectRatio || "1:1";
  renderRatioSelect();
  syncGenerationVisibility();
  syncPromptControls();
  setStatus("正在读取插件设置...");

  try {
    state.settings = await sendMessage({ type: "get-settings" });
  } catch (error) {
    console.error("[PromptLens] Failed to load settings.", error);
    syncGenerationVisibility();
    setStatus(error.message || "读取插件设置失败，请在扩展页查看错误并重新加载插件。", "error");
    return;
  }

  state.panelData.aspectRatio = state.settings?.aspectRatio || "1:1";
  renderRatioSelect();
  syncGenerationVisibility();
  syncPromptControls();

  const cached = imageCache.get(imageUrl);
  if (cached) {
    hydratePanelData(cached);
    return;
  }

  setStatus("等待识别...");

  if (state.settings?.autoAnalyze) {
    await analyzeCurrentImage({ force: false });
  }
}

function closePanel() {
  state.panelOpen = false;
  panel.classList.remove("pg-open");
}

async function analyzeCurrentImage({ force }) {
  if (!state.panelImage) return;

  const imageUrl = state.panelImage.currentSrc || state.panelImage.src;
  if (!imageUrl) return;

  if (!force && imageCache.has(imageUrl)) {
    hydratePanelData(imageCache.get(imageUrl));
    return;
  }

  await runAction("analyze", "正在识别图片内容...", async () => {
    const imageDataUrl = await captureImageDataUrl(state.panelImage);
    const screenshotCrop = getImageViewportCrop(state.panelImage);
    const result = await sendMessage({
      type: "analyze-image",
      payload: {
        imageUrl,
        imageDataUrl,
        screenshotCrop,
        pageUrl: location.href,
        alt: state.panelImage.alt || ""
      }
    });

    const cached = {
      title: result.title || "图片提示词",
      detail: state.panelData.detail || "full",
      language: state.panelData.language || "zh",
      aspectRatio: state.panelData.aspectRatio || state.settings?.aspectRatio || "1:1",
      structuredPrompt: result.structuredPrompt || null,
      analysis: result.analysis || null,
      negativePrompt: result.negativePrompt || result.negativePromptZh || "",
      structureOpen: state.panelData.structureOpen || false,
      prompts: {
        short: {
          en: result.enPromptShort || "",
          zh: result.zhPromptShort || ""
        },
        full: {
          en: result.enPromptFull || "",
          zh: result.zhPromptFull || ""
        }
      }
    };

    imageCache.set(imageUrl, cached);
    hydratePanelData(cached);
  });
}

function switchDetail(detail) {
  state.panelData.detail = detail;
  syncPromptControls();
}

function togglePromptLanguage() {
  const current = state.panelData.language || "zh";
  state.panelData.language = current === "en" ? "zh" : "en";
  syncPromptControls();
  renderStructureView();
  persistPanelImageCache();
}

function hydratePanelData(data) {
  state.panelData = {
    title: data.title || "图片提示词",
    detail: data.detail || "full",
    language: data.language || data.languageByDetail?.[data.detail || "full"] || "zh",
    aspectRatio: data.aspectRatio || state.settings?.aspectRatio || "1:1",
    structuredPrompt: data.structuredPrompt || null,
    analysis: data.analysis || null,
    negativePrompt: normalizeNegativePromptForDisplay(data.negativePrompt || data.negativePromptZh || ""),
    structureOpen: Boolean(data.structureOpen),
    prompts: {
      short: normalizePromptPair(data.prompts?.short),
      full: normalizePromptPair(data.prompts?.full)
    }
  };

  els.imageTitle.textContent = state.panelData.title || "图片提示词";
  renderRatioSelect();
  syncGenerationVisibility();
  syncPromptControls();
  renderStructureView();
  setStatus("识别完成，可直接编辑。", "success");
}

function syncPromptControls() {
  els.detailShort.classList.toggle("is-active", state.panelData.detail === "short");
  els.detailFull.classList.toggle("is-active", state.panelData.detail === "full");
  els.toggleTranslation.textContent = getCurrentLanguage() === "zh" ? "查看英文" : "查看中文";
  els.toggleStructure.textContent = state.panelData.structureOpen ? "隐藏结构" : "查看结构";
  els.toggleStructure.classList.toggle("is-active", state.panelData.structureOpen);
  els.input.value = getCurrentPrompt();
  els.negativeInput.value = state.panelData.negativePrompt || "";
  updateMeta();
}

function toggleStructureView() {
  state.panelData.structureOpen = !state.panelData.structureOpen;
  syncPromptControls();
  renderStructureView();
  persistPanelImageCache();
}

function getCurrentPrompt() {
  const detail = state.panelData.detail;
  const language = getCurrentLanguage();
  return state.panelData.prompts[detail]?.[language] || "";
}

function getCurrentNegativePrompt() {
  return normalizeNegativePromptForDisplay(state.panelData.negativePrompt || els.negativeInput.value || "");
}

function normalizeNegativePromptForDisplay(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

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
    .map((item) => `避免${item}`)
    .join("；");
}

function buildClipboardPrompt() {
  const prompt = getCurrentPrompt().trim();
  const negativePrompt = getCurrentNegativePrompt();
  return [prompt, negativePrompt ? `负面提示词：${negativePrompt}` : ""].filter(Boolean).join("\n\n");
}

function getCurrentLanguage() {
  return state.panelData.language || "zh";
}

function normalizePromptPair(value) {
  if (value && typeof value === "object") {
    return {
      en: String(value.en || "").trim(),
      zh: String(value.zh || "").trim()
    };
  }

  return {
    en: "",
    zh: String(value || "").trim()
  };
}

function renderStructureView() {
  const entries = getStructureEntries();
  const visible = state.panelData.structureOpen && entries.length > 0;
  els.structure.classList.toggle("pg-hidden", !visible);

  if (!visible) {
    els.structureGrid.innerHTML = "";
    return;
  }

  els.structureGrid.innerHTML = entries
    .map(
      (entry) => `
        <div class="pg-structure-row">
          <span class="pg-structure-label">${escapeHtml(entry.label)}</span>
          <p class="pg-structure-value">${escapeHtml(entry.value)}</p>
        </div>
      `
    )
    .join("");
}

function getStructureEntries() {
  const language = getCurrentLanguage();
  const prompt = language === "en" ? state.panelData.structuredPrompt?.enFull : state.panelData.structuredPrompt?.zhFull;
  const entries = parseStructuredPrompt(prompt);
  if (entries.length >= 6 && (language === "en" || entriesHaveChinese(entries))) return orderStructureEntries(entries);

  const fullPrompt = state.panelData.prompts.full?.[language] || "";
  const labeledEntries = parseStructuredPrompt(fullPrompt);
  if (labeledEntries.length >= 6 && (language === "en" || entriesHaveChinese(labeledEntries))) {
    return orderStructureEntries(labeledEntries);
  }

  const analysisEntries = buildStructureEntriesFromAnalysis(state.panelData.analysis);
  return analysisEntries;
}

function parseStructuredPrompt(prompt) {
  return String(prompt || "")
    .split(/[;；]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^([^:：]+)\s*[:：]\s*(.+)$/);
      if (!match) return null;

      const label = normalizeStructureLabel(match[1]);
      const value = match[2].trim();
      return label && value ? { label, value } : null;
    })
    .filter(Boolean);
}

function normalizeStructureLabel(label) {
  const rawLabel = String(label || "").trim();
  const normalized = rawLabel.toLowerCase().replace(/\s+/g, "");

  if (/^subject|主体/.test(normalized)) return "主体";
  if (/^style|风格/.test(normalized)) return "风格";
  if (/^lighting|光线|光影/.test(normalized)) return "光线";
  if (/^camera|镜头/.test(normalized)) return "镜头";
  if (/^environment|环境/.test(normalized)) return "环境";
  if (/^material|材质/.test(normalized)) return "材质";
  if (/^composition|构图/.test(normalized)) return "构图";
  if (/^color|色彩|颜色|调色/.test(normalized)) return "色彩";
  if (/^rendering|渲染/.test(normalized)) return "渲染";
  return "";
}

function orderStructureEntries(entries) {
  const labelOrder = ["主体", "风格", "光线", "镜头", "环境", "材质", "构图", "色彩", "渲染"];
  const entryMap = new Map();

  for (const entry of entries) {
    if (!entryMap.has(entry.label)) entryMap.set(entry.label, entry);
  }

  return labelOrder.map((label) => entryMap.get(label)).filter(Boolean);
}

function entriesHaveChinese(entries) {
  return entries.some((entry) => /[\u4e00-\u9fff]/.test(entry.value));
}

function buildStructureEntriesFromAnalysis(analysis) {
  if (!analysis || typeof analysis !== "object") return [];

  const rows = [
    ["主体", readAnalysisValue(analysis, ["subject", "main", "attributes", "action"])],
    ["风格", readAnalysisValue(analysis, ["style", "medium", "genre", "mood", "referenceLook"])],
    ["光线", readAnalysisValue(analysis, ["lighting", "direction", "quality", "effect", "timeOfDay"])],
    ["镜头", readAnalysisValue(analysis, ["camera", "focalLength", "aperture", "angle", "shotType", "depthOfField"])],
    ["环境", readAnalysisValue(analysis, ["environment", "sceneType", "backgroundMaterial", "spatialRelation"])],
    ["材质", readAnalysisValue(analysis, ["material", "surface", "microDetail", "opticalProperties"])],
    ["构图", readAnalysisValue(analysis, ["composition", "layout", "subjectPlacement", "foreground", "background", "leadingLines", "symmetry"])],
    ["色彩", readAnalysisValue(analysis, ["color", "colorGrade", "palette", "tone"])],
    ["渲染", readAnalysisValue(analysis, ["rendering", "colorGrade", "deviceLook", "priorityTerms"])]
  ];

  return rows
    .map(([label, value]) => ({ label, value }))
    .filter((entry) => entry.value);
}

function readAnalysisValue(analysis, keys) {
  const [sectionKey, ...childKeys] = keys;
  const section = analysis?.[sectionKey];

  if (isPrimitiveStructureValue(section) || Array.isArray(section)) {
    return stringifyStructureValue(section);
  }

  if (!section || typeof section !== "object") {
    return stringifyStructureValue(analysis?.[sectionKey]);
  }

  return joinValues(childKeys.map((key) => stringifyStructureValue(section[key])));
}

function isPrimitiveStructureValue(value) {
  return ["string", "number", "boolean"].includes(typeof value);
}

function stringifyStructureValue(value) {
  if (Array.isArray(value)) return joinValues(value.map((item) => stringifyStructureValue(item)));
  if (isPrimitiveStructureValue(value)) return String(value).trim();
  if (value && typeof value === "object") return joinValues(Object.values(value).map((item) => stringifyStructureValue(item)));
  return "";
}

function joinValues(values) {
  return values.map((value) => String(value || "").trim()).filter(Boolean).join("，");
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function generateFromCurrentPrompt() {
  if (!state.settings?.imageGenerationEnabled) {
    setStatus("生图功能当前已关闭。", "error");
    return;
  }

  const prompt = getCurrentPrompt().trim();
  if (!prompt) {
    setStatus("请先识别或输入提示词。", "error");
    return;
  }

  await runAction("generate", "正在生图，结果会显示在当前弹窗...", async () => {
    const result = await sendMessage({
      type: "generate-image",
      payload: {
        prompt,
        negativePrompt: getCurrentNegativePrompt(),
        aspectRatio: state.panelData.aspectRatio || state.settings?.aspectRatio || "1:1",
        count: state.settings?.imageCount || 1,
        openViewer: false
      }
    });

    state.currentJob = {
      images: result.images || []
    };

    renderInlineImages(state.currentJob.images);
    setStatus("生图完成，预览已更新。", "success");
  });
}

function persistPanelImageCache() {
  if (!state.panelImage) return;
  const imageUrl = state.panelImage.currentSrc || state.panelImage.src;
  if (!imageUrl) return;
  imageCache.set(imageUrl, structuredClone(state.panelData));
}

function renderInlineImages(images) {
  if (!images || images.length === 0) {
    els.inlinePreview.classList.remove("is-visible");
    els.inlineGrid.innerHTML = "";
    return;
  }

  els.inlinePreview.classList.add("is-visible");
  els.inlineGrid.innerHTML = images
    .map((image, index) => {
      const src = getGeneratedImageSrc(image);
      if (!src) return "";
      return `
        <article class="pg-preview-card">
          <div class="pg-preview-frame">
            <img src="${src}" alt="generated preview ${index + 1}" />
            <div class="pg-preview-overlay">
              <button class="pg-preview-action" data-role="download" data-index="${index}" type="button">下载图片</button>
              <button class="pg-preview-action" data-role="viewer" data-index="${index}" type="button">新页面打开</button>
            </div>
          </div>
        </article>
      `;
    })
    .filter(Boolean)
    .join("");
}

function getImageDataUrl(index) {
  const image = state.currentJob?.images?.[index];
  return getGeneratedImageSrc(image);
}

function getGeneratedImageSrc(image) {
  if (!image) return "";
  if (typeof image === "string") return image;
  if (image.url) return image.url;
  if (image.base64Data) {
    return `data:${image.mimeType || "image/png"};base64,${image.base64Data}`;
  }
  return "";
}

function triggerDownload(src, filename) {
  const link = document.createElement("a");
  link.href = src;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

function updateMeta() {
  const text = els.input.value || "";
  els.charCount.textContent = `${text.length} 字`;
}

async function runAction(actionName, statusText, task) {
  if (state.actionState[actionName]) return;

  state.actionState[actionName] = true;
  syncActionState();
  setStatus(statusText, "working");

  try {
    await task();
  } catch (error) {
    setStatus(error.message || "发生错误，请稍后重试。", "error");
  } finally {
    state.actionState[actionName] = false;
    syncActionState();
    updateMeta();
  }
}

function syncActionState() {
  els.analyze.classList.toggle("is-busy", state.actionState.analyze);
  els.generate.classList.toggle("is-busy", state.actionState.generate);
  els.openPrompts.classList.toggle("is-busy", state.actionState.openPrompts);
}

function syncGenerationVisibility() {
  const enabled = Boolean(state.settings?.imageGenerationEnabled);
  els.generateSection?.classList.toggle("pg-hidden", !enabled);
}

function setStatus(text, tone = "") {
  els.status.textContent = text;
  if (tone) {
    els.status.dataset.tone = tone;
  } else {
    delete els.status.dataset.tone;
  }
}

function truncateMiddle(text, maxLength) {
  if (text.length <= maxLength) return text;
  const head = Math.ceil(maxLength / 2) - 2;
  const tail = Math.floor(maxLength / 2) - 1;
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

async function captureImageDataUrl(image) {
  if (!(image instanceof HTMLImageElement)) return "";

  const src = image.currentSrc || image.src || "";

  try {
    const dataUrl = await renderImageElementForAnalysis(image);
    if (dataUrl) return dataUrl;
  } catch (_error) {
    // Cross-origin images may taint the canvas. Fallback to URL fetch in the background worker.
  }

  try {
    const response = await fetch(src, {
      credentials: "include"
    });
    if (response.ok) {
      const blob = await response.blob();
      return await renderBlobForAnalysis(blob);
    }
  } catch (_error) {
    // Some sites still block content-script fetches. The background worker keeps the final fallback path.
  }

  return src.startsWith("data:image/") ? src : "";
}

async function renderImageElementForAnalysis(image) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width <= 0 || height <= 0) return "";
  return renderScaledImageForAnalysis(image, width, height);
}

async function renderBlobForAnalysis(blob) {
  if (!blob || !blob.type?.startsWith("image/")) return "";
  const bitmap = await createImageBitmap(blob);
  try {
    return await renderScaledImageForAnalysis(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close?.();
  }
}

async function renderScaledImageForAnalysis(source, sourceWidth, sourceHeight) {
  if (typeof OffscreenCanvas === "undefined") return "";

  const { width, height } = fitImageSize(sourceWidth, sourceHeight, ANALYSIS_IMAGE_MAX_EDGE);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.drawImage(source, 0, 0, width, height);
  const blob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: ANALYSIS_IMAGE_JPEG_QUALITY
  });
  return await blobToDataUrl(blob);
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

function getImageViewportCrop(image) {
  if (!(image instanceof HTMLImageElement)) return null;

  const rect = image.getBoundingClientRect();
  const x = Math.max(0, rect.left);
  const y = Math.max(0, rect.top);
  const right = Math.min(window.innerWidth, rect.right);
  const bottom = Math.min(window.innerHeight, rect.bottom);
  const width = Math.max(1, right - x);
  const height = Math.max(1, bottom - y);

  if (width <= 1 || height <= 1) return null;

  return {
    x,
    y,
    width,
    height,
    devicePixelRatio: window.devicePixelRatio || 1
  };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read image blob."));
    reader.readAsDataURL(blob);
  });
}

async function sendMessage(message) {
  if (!hasExtensionContext()) {
    throw new Error("插件已重新加载，请刷新当前网页后再试。");
  }

  try {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.ok) {
      throw new Error(response?.error || "Extension request failed.");
    }
    return response.data;
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      throw new Error("插件上下文已失效，请刷新当前网页后再试。");
    }
    throw error;
  }
}

function hasExtensionContext() {
  try {
    return Boolean(chrome?.runtime?.id);
  } catch (_error) {
    return false;
  }
}

function isExtensionContextInvalidatedError(error) {
  return /Extension context invalidated/i.test(String(error?.message || error));
}
