import path from "node:path";

export const PUBLIC_IMAGES_URL_BASE = "/local_images/gpt-image2-prompts";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter(Boolean);
}

export function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isSafeLocalImagePath(value) {
  if (!value || value.includes("\0")) return false;
  if (/^https?:\/\//i.test(value)) return false;
  return !value.replaceAll("\\", "/").split("/").includes("..");
}

function sourceUrlOf(item) {
  return asString(item.source_url) || asString(item.sourceUrl);
}

function sourceImagesOf(item) {
  const remoteImages = asStringArray(item.remote_images);
  return remoteImages.length ? remoteImages : asStringArray(item.images);
}

function issue(level, recordIndex, label, message) {
  return { level, recordIndex, label, message };
}

function validateRecord(raw, index) {
  const label = isRecord(raw) ? asString(raw.title) || `record ${index + 1}` : `record ${index + 1}`;
  const issues = [];
  if (!isRecord(raw)) {
    return [issue("error", index, label, "record must be an object")];
  }

  if (!asString(raw.title)) issues.push(issue("error", index, label, "title is required"));
  if (!asString(raw.prompt)) issues.push(issue("error", index, label, "prompt is required"));

  if (!Array.isArray(raw.images) || asStringArray(raw.images).length === 0) {
    issues.push(issue("error", index, label, "images must be a non-empty string array"));
  } else if (raw.images.some((value) => typeof value !== "string" || !value.trim())) {
    issues.push(issue("error", index, label, "images contains a non-string or empty value"));
  }

  if (
    raw.tags !== undefined &&
    (!Array.isArray(raw.tags) || raw.tags.some((value) => typeof value !== "string" || !value.trim()))
  ) {
    issues.push(issue("error", index, label, "tags must be an array of non-empty strings"));
  }

  for (const field of ["model", "provider"]) {
    if (raw[field] !== undefined && !asString(raw[field])) {
      issues.push(issue("error", index, label, `${field} must be a non-empty string when provided`));
    }
  }

  const sourceUrl = sourceUrlOf(raw);
  if (sourceUrl && !isHttpUrl(sourceUrl)) {
    issues.push(issue("error", index, label, "source URL must use http or https"));
  }

  for (const imageReference of sourceImagesOf(raw)) {
    if (!isHttpUrl(imageReference) && !isSafeLocalImagePath(imageReference)) {
      issues.push(issue("error", index, label, `invalid image reference: ${imageReference}`));
    }
  }

  const localImages = asStringArray(raw.local_images);
  for (const filename of localImages) {
    if (!isSafeLocalImagePath(filename) || path.basename(filename) !== filename) {
      issues.push(issue("error", index, label, `local image must be a safe filename: ${filename}`));
    }
  }

  const remoteImages = asStringArray(raw.remote_images);
  if (remoteImages.some((url) => !isHttpUrl(url))) {
    issues.push(issue("error", index, label, "remote_images must contain only http/https URLs"));
  }
  if (localImages.length && remoteImages.length && localImages.length !== remoteImages.length) {
    issues.push(issue("warning", index, label, "local_images and remote_images have different lengths"));
  }

  return issues;
}

function findDuplicateIssues(records) {
  const issues = [];
  const sourceOwners = new Map();
  const imageOwners = new Map();

  records.forEach(({ raw, index }) => {
    const label = asString(raw.title) || `record ${index + 1}`;
    const sourceUrl = sourceUrlOf(raw);
    if (sourceUrl) {
      const first = sourceOwners.get(sourceUrl);
      if (first !== undefined) {
        issues.push(issue("warning", index, label, `duplicate source URL (first used by record ${first + 1})`));
      } else {
        sourceOwners.set(sourceUrl, index);
      }
    }

    for (const imageUrl of sourceImagesOf(raw)) {
      const first = imageOwners.get(imageUrl);
      if (first !== undefined) {
        issues.push(issue("warning", index, label, `duplicate image reference (first used by record ${first + 1}): ${imageUrl}`));
      } else {
        imageOwners.set(imageUrl, index);
      }
    }
  });

  return issues;
}

function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function extensionFromReference(reference) {
  try {
    const url = new URL(reference, "https://local.invalid");
    const extension = path.extname(url.pathname).toLowerCase();
    if (/^\.(?:jpe?g|png|gif|webp)$/.test(extension)) return extension === ".jpeg" ? ".jpg" : extension;
  } catch {
    // Use JPEG when the source has no recognizable extension.
  }
  return ".jpg";
}

function normalizeRecord(item, index) {
  const title = asString(item.title);
  const originalImages = asStringArray(item.images);
  const existingRemoteImages = asStringArray(item.remote_images);
  const sources = existingRemoteImages.length ? existingRemoteImages : originalImages;
  const providedLocalImages = asStringArray(item.local_images);
  const imageCount = Math.max(sources.length, providedLocalImages.length);
  const base = `${String(index + 1).padStart(2, "0")}_${slugify(title) || `prompt_${index + 1}`}`;

  const localImages = Array.from({ length: imageCount }, (_, imageIndex) => {
    const provided = providedLocalImages[imageIndex];
    if (provided) return provided;
    const source = sources[imageIndex] || originalImages[imageIndex] || "";
    if (source.startsWith(PUBLIC_IMAGES_URL_BASE)) return path.basename(source);
    const suffix = imageCount > 1 ? `_${imageIndex + 1}` : "";
    return `${base}${suffix}${extensionFromReference(source)}`;
  });

  return {
    ...item,
    remote_images: existingRemoteImages.length ? existingRemoteImages : sources.filter(isHttpUrl),
    local_images: localImages,
    images: localImages.map((filename) => `${PUBLIC_IMAGES_URL_BASE}/${filename}`),
  };
}

export function validateAndNormalizePromptRecords(rawRecords) {
  const validationIssues = rawRecords.flatMap(validateRecord);
  const recordsWithoutErrors = rawRecords
    .map((raw, index) => ({ raw, index }))
    .filter(({ index }) => !validationIssues.some((item) => item.recordIndex === index && item.level === "error"));

  validationIssues.push(...findDuplicateIssues(recordsWithoutErrors));

  return {
    validationIssues,
    normalizedRecords: recordsWithoutErrors.map(({ raw, index }) => ({
      index,
      item: normalizeRecord(raw, index),
    })),
  };
}