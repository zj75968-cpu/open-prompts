import { promises as fs } from "node:fs";
import path from "node:path";
import { asString, asStringArray, isHttpUrl } from "./prompt-import-validation.mjs";

const WARN_IMAGE_BYTES = 10 * 1024 * 1024;
const MIN_RECOMMENDED_DIMENSION = 256;

function issue(level, recordIndex, label, message) {
  return { level, recordIndex, label, message };
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
    if (chunk === "VP8 ") {
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

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
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

export async function checkPromptImages(records, options) {
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