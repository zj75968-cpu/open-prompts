import { promises as fs } from "node:fs";
import path from "node:path";

const DEFAULT_INPUT =
  "/Users/xxx/.qoderwork/workspace/molmwhbpiuhabtq8/outputs/gpt-image2-prompts/prompts_data.json";
const DEFAULT_OUTPUT = "src/data/imports/gpt-image2-prompts.json";
const PUBLIC_IMAGES_DIRECTORY = "public/local_images/gpt-image2-prompts";
const PUBLIC_IMAGES_URL_BASE = "/local_images/gpt-image2-prompts";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const WARN_IMAGE_BYTES = 10 * 1024 * 1024;
const MIN_RECOMMENDED_DIMENSION = 256;

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function optionValue(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseArgs(args) {
  const valueFlags = new Set(["--limit", "--output", "--timeout", "--max-image-mb"]);
  let input;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (valueFlags.has(value)) {
      index += 1;
      continue;
    }
    if (!value.startsWith("-")) {
      input = value;
      break;
    }
  }

  const limitRaw = optionValue(args, "--limit");
  const timeoutRaw = optionValue(args, "--timeout");
  const maxImageMbRaw = optionValue(args, "--max-image-mb");
  const limit = limitRaw === undefined ? Number.POSITIVE_INFINITY : Number.parseInt(limitRaw, 10);
  const timeoutMs = timeoutRaw === undefined ? DEFAULT_TIMEOUT_MS : Number.parseInt(timeoutRaw, 10);
  const maxImageMb = maxImageMbRaw === undefined ? DEFAULT_MAX_IMAGE_BYTES / 1024 / 1024 : Number(maxImageMbRaw);

  if (limitRaw !== undefined && (!Number.isFinite(limit) || limit < 0)) {
    throw new Error("--limit must be a non-negative integer");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("--timeout must be a positive number of milliseconds");
  }
  if (!Number.isFinite(maxImageMb) || maxImageMb <= 0) {
    throw new Error("--max-image-mb must be a positive number");
  }

  return {
    help: args.includes("--help") || args.includes("-h"),
    fromExisting: args.includes("--from-existing"),
    skipDownload: args.includes("--skip-download"),
    strict: args.includes("--strict"),
    input,
    output: optionValue(args, "--output"),
    limit,
    timeoutMs,
    maxImageBytes: Math.round(maxImageMb * 1024 * 1024),
  };
}

function printHelp() {
  console.log(
    [
      "Usage:",
      "  node scripts/import-gpt-image2-prompts.mjs <input.json> [options]",
      "  node scripts/import-gpt-image2-prompts.mjs --from-existing [options]",
      "",
      "Options:",
      "  --from-existing       Use src/data/imports/gpt-image2-prompts.json as input",
      "  --output <path>       Write normalized JSON to a custom path",
      "  --limit N             Only process the first N records",
      "  --skip-download       Do not fetch remote images; inspect existing local files only",
      "  --strict              Exit non-zero and do not write output on validation/image errors",
      "  --timeout MS          Per-image request timeout (default: 15000)",
      "  --max-image-mb MB     Maximum accepted image size (default: 20)",
      "  -h, --help            Show this help",
    ].join("\n"),
  );
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter(Boolean);
}

function isHttpUrl(value) {
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
  const normalized = value.replaceAll("\\", "/");
  return !normalized.split("/").includes("..");
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
    issues.push(issue("error", index, label, "record must be an object"));
    return issues;
  }

  if (!asString(raw.title)) issues.push(issue("error", index, label, "title is required"));
  if (!asString(raw.prompt)) issues.push(issue("error", index, label, "prompt is required"));

  if (!Array.isArray(raw.images) || asStringArray(raw.images).length === 0) {
    issues.push(issue("error", index, label, "images must be a non-empty string array"));
  } else if (raw.images.some((value) => typeof value !== "string" || !value.trim())) {
    issues.push(issue("error", index, label, "images contains a non-string or empty value"));
  }

  if (raw.tags !== undefined) {
    if (!Array.isArray(raw.tags) || raw.tags.some((value) => typeof value !== "string" || !value.trim())) {
      issues.push(issue("error", index, label, "tags must be an array of non-empty strings"));
    }
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

  for (const imageRef of sourceImagesOf(raw)) {
    if (!isHttpUrl(imageRef) && !isSafeLocalImagePath(imageRef)) {
      issues.push(issue("error", index, label, `invalid image reference: ${imageRef}`));
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

function duplicateIssues(records) {
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
    // Fall back to JPEG when the source has no recognizable extension.
  }
  return ".jpg";
}

function normalizeRecord(item, index) {
  const title = asString(item.title);
  const originalImages = asStringArray(item.images);
  const remoteImages = asStringArray(item.remote_images);
  const sources = remoteImages.length ? remoteImages : originalImages;
  const providedLocal = asStringArray(item.local_images);
  const imageCount = Math.max(sources.length, providedLocal.length);
  const base = `${String(index + 1).padStart(2, "0")}_${slugify(title) || `prompt_${index + 1}`}`;

  const localImages = Array.from({ length: imageCount }, (_, imageIndex) => {
    const provided = providedLocal[imageIndex];
    if (provided) return provided;
    const source = sources[imageIndex] || originalImages[imageIndex] || "";
    if (source.startsWith(PUBLIC_IMAGES_URL_BASE)) return path.basename(source);
    const suffix = imageCount > 1 ? `_${imageIndex + 1}` : "";
    return `${base}${suffix}${extensionFromReference(source)}`;
  });

  return {
    ...item,
    remote_images: remoteImages.length ? remoteImages : sources.filter(isHttpUrl),
    local_images: localImages,
    images: localImages.map((filename) => `${PUBLIC_IMAGES_URL_BASE}/${filename}`),
  };
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function parseJpegDimensions(buffer) {
  let offset = 2;
  const startOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 1;
      continue;
    }
    if (offset + 2 >= buffer.length) break;
    const segmentLength = buffer.readUInt16BE(offset + 1);
    if (startOfFrameMarkers.has(marker) && offset + 7 < buffer.length) {
      return { width: buffer.readUInt16BE(offset + 6), height: buffer.readUInt16BE(offset + 4) };
    }
    if (segmentLength < 2) break;
    offset += segmentLength + 1;
  }
  return null;
}

function inspectImageBuffer(buffer) {
  if (!buffer.length) throw new Error("image file is empty");

  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { format: "png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  const signature = buffer.subarray(0, 6).toString("ascii");
  if (buffer.length >= 10 && (signature === "GIF87a" || signature === "GIF89a")) {
    return { format: "gif", width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (buffer.length >= 12 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    const dimensions = parseJpegDimensions(buffer);
    if (!dimensions) throw new Error("JPEG dimensions could not be decoded");
    return { format: "jpeg", ...dimensions };
  }
  if (buffer.length >= 30 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    const chunk = buffer.subarray(12, 16).toString("ascii");
    if (chunk === "VP8X") {
      return { format: "webp", width: readUInt24LE(buffer, 24) + 1, height: readUInt24LE(buffer, 27) + 1 };
    }
    if (chunk === "VP8 " && buffer.length >= 30) {
      return { format: "webp", width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
      const bits = buffer.readUInt32LE(21);
      return { format: "webp", width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    throw new Error("WebP dimensions could not be decoded");
  }

  throw new Error("unrecognized image signature; expected PNG, JPEG, GIF, or WebP");
}

function expectedExtensions(format) {
  return format === "jpeg" ? new Set([".jpg", ".jpeg"]) : new Set([`.${format}`]);
}

function imageWarnings(metadata, bytes, filename) {
  const warnings = [];
  if (Math.min(metadata.width, metadata.height) < MIN_RECOMMENDED_DIMENSION) {
    warnings.push(`low resolution ${metadata.width}x${metadata.height}`);
  }
  const ratio = Math.max(metadata.width / metadata.height, metadata.height / metadata.width);
  if (ratio > 5) warnings.push(`unusual aspect ratio ${metadata.width}:${metadata.height}`);
  if (bytes > WARN_IMAGE_BYTES) warnings.push(`large file ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  const extension = path.extname(filename).toLowerCase();
  if (extension && !expectedExtensions(metadata.format).has(extension)) {
    warnings.push(`extension ${extension} does not match ${metadata.format} content`);
  }
  return warnings;
}

async function inspectLocalImage(filePath, maxImageBytes) {
  const buffer = await fs.readFile(filePath);
  if (buffer.length > maxImageBytes) {
    throw new Error(`file exceeds ${(maxImageBytes / 1024 / 1024).toFixed(1)} MB limit`);
  }
  return { buffer, metadata: inspectImageBuffer(buffer) };
}

async function fetchImage(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
    if (contentType && !contentType.startsWith("image/")) {
      throw new Error(`unexpected content-type ${contentType}`);
    }
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > options.maxImageBytes) {
      throw new Error(`content-length exceeds ${(options.maxImageBytes / 1024 / 1024).toFixed(1)} MB limit`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > options.maxImageBytes) {
      throw new Error(`download exceeds ${(options.maxImageBytes / 1024 / 1024).toFixed(1)} MB limit`);
    }
    return { buffer, metadata: inspectImageBuffer(buffer) };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`request timed out after ${options.timeoutMs} ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function checkImages(records, options) {
  const issues = [];
  const failedRecords = new Set();
  const stats = { checked: 0, downloaded: 0, skipped: 0, warnings: 0, errors: 0 };
  if (!options.skipDownload) await fs.mkdir(options.publicImagesDir, { recursive: true });

  for (const record of records) {
    const label = asString(record.item.title) || `record ${record.index + 1}`;
    const localImages = asStringArray(record.item.local_images);
    const remoteImages = asStringArray(record.item.remote_images);

    for (let imageIndex = 0; imageIndex < localImages.length; imageIndex += 1) {
      const filename = localImages[imageIndex];
      const destination = path.resolve(options.publicImagesDir, filename);
      const relative = path.relative(options.publicImagesDir, destination);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        issues.push(issue("error", record.index, label, `unsafe image destination: ${filename}`));
        stats.errors += 1;
        failedRecords.add(record.index);
        continue;
      }

      try {
        let inspected;
        if (await fileExists(destination)) {
          inspected = await inspectLocalImage(destination, options.maxImageBytes);
        } else if (options.skipDownload) {
          stats.skipped += 1;
          stats.warnings += 1;
          issues.push(issue("warning", record.index, label, `image check skipped; local file is missing: ${filename}`));
          continue;
        } else {
          const remoteUrl = remoteImages[imageIndex];
          if (!remoteUrl || !isHttpUrl(remoteUrl)) throw new Error(`no remote URL available for ${filename}`);
          inspected = await fetchImage(remoteUrl, options);
          await fs.writeFile(destination, inspected.buffer);
          stats.downloaded += 1;
        }

        stats.checked += 1;
        for (const warning of imageWarnings(inspected.metadata, inspected.buffer.length, filename)) {
          stats.warnings += 1;
          issues.push(issue("warning", record.index, label, `${filename}: ${warning}`));
        }
      } catch (error) {
        stats.errors += 1;
        failedRecords.add(record.index);
        issues.push(issue("error", record.index, label, `${filename}: ${error?.message || error}`));
      }
    }
  }

  return { issues, failedRecords, stats };
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function printIssues(title, issues) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
  if (!issues.length) {
    console.log("none");
    return;
  }
  for (const item of issues) {
    console.log(`[${item.level.toUpperCase()}] #${item.recordIndex + 1} ${item.label}: ${item.message}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const inputPath = options.fromExisting
    ? path.resolve(process.cwd(), DEFAULT_OUTPUT)
    : path.resolve(process.cwd(), options.input || DEFAULT_INPUT);
  const outputPath = path.resolve(process.cwd(), options.output || DEFAULT_OUTPUT);
  const publicImagesDir = path.resolve(process.cwd(), PUBLIC_IMAGES_DIRECTORY);

  let data;
  try {
    data = JSON.parse(await fs.readFile(inputPath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read valid JSON from ${inputPath}\n${error?.message || error}`);
  }
  if (!Array.isArray(data)) throw new Error(`Expected JSON array, got ${typeof data}`);

  const sliced = Number.isFinite(options.limit) ? data.slice(0, options.limit) : data;
  const validationIssues = sliced.flatMap(validateRecord);
  const recordsWithoutStructureErrors = sliced
    .map((raw, index) => ({ raw, index }))
    .filter(({ index }) => !validationIssues.some((item) => item.recordIndex === index && item.level === "error"));
  validationIssues.push(...duplicateIssues(recordsWithoutStructureErrors));

  const normalizedRecords = recordsWithoutStructureErrors.map(({ raw, index }) => ({
    index,
    item: normalizeRecord(raw, index),
  }));
  const imageResult = await checkImages(normalizedRecords, {
    skipDownload: options.skipDownload,
    timeoutMs: options.timeoutMs,
    maxImageBytes: options.maxImageBytes,
    publicImagesDir,
  });

  const validationErrors = validationIssues.filter((item) => item.level === "error");
  const validationWarnings = validationIssues.filter((item) => item.level === "warning");
  const importedRecords = normalizedRecords.filter(({ index }) => !imageResult.failedRecords.has(index));

  printIssues("Validation issues", validationIssues);
  printIssues("Image issues", imageResult.issues);
  console.log("\nSummary");
  console.log("-------");
  console.log(`Records read: ${sliced.length}`);
  console.log(`Records accepted: ${importedRecords.length}`);
  console.log(`Validation errors: ${validationErrors.length}`);
  console.log(`Validation warnings: ${validationWarnings.length}`);
  console.log(`Images checked: ${imageResult.stats.checked}`);
  console.log(`Images downloaded: ${imageResult.stats.downloaded}`);
  console.log(`Images skipped: ${imageResult.stats.skipped}`);
  console.log(`Image warnings: ${imageResult.stats.warnings}`);
  console.log(`Image errors: ${imageResult.stats.errors}`);

  if (options.strict && (validationErrors.length > 0 || imageResult.stats.errors > 0)) {
    throw new Error("Strict import aborted; output was not written");
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(importedRecords.map(({ item }) => item), null, 2)}\n`, "utf8");
  console.log(`\nImported ${importedRecords.length} prompts -> ${path.relative(process.cwd(), outputPath)}`);
  console.log(options.skipDownload ? "Remote image downloads skipped" : `Images -> ${path.relative(process.cwd(), publicImagesDir)}/`);
}

main().catch((error) => {
  fail(error?.stack || error?.message || String(error));
});