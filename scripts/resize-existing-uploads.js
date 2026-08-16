// One-off backfill: the upload endpoints now resize/recompress every new
// photo (see src/uploads/image-resize.util.ts), but that only applies going
// forward — files already on disk from before that change are still full,
// untouched originals (some multi-MB). This walks ./uploads (including
// ./uploads/business) and recompresses everything already there, in place,
// same filenames/URLs, so existing listings benefit immediately too.
//
// Safe to re-run: already-compressed files just get recompressed again at
// the same settings (a little redundant work, not lossy in a way that
// matters at quality 80/1600px, but there's no need to run it twice).
//
// Usage: node scripts/resize-existing-uploads.js

const path = require("path");
const fs = require("fs/promises");
const sharp = require("sharp");
const { randomBytes } = require("crypto");

const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const MAX_WIDTH = 1600;

async function listImageFilesRecursive(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listImageFilesRecursive(fullPath)));
    } else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

async function compressOne(filePath) {
  const before = (await fs.stat(filePath)).size;

  const image = sharp(filePath);
  const metadata = await image.metadata();

  if (metadata.format === "gif") {
    return { filePath, skipped: true };
  }

  let pipeline = image.resize({ width: MAX_WIDTH, withoutEnlargement: true });

  if (metadata.format === "png") {
    // quality+palette = real lossy quantized compression (pngquant-style).
    // compressionLevel alone is lossless and does NOT reliably shrink an
    // already-reasonably-encoded PNG — measured several going *larger*.
    pipeline = pipeline.png({ quality: 80, palette: true });
  } else if (metadata.format === "webp") {
    pipeline = pipeline.webp({ quality: 80 });
  } else {
    pipeline = pipeline.jpeg({ quality: 80, mozjpeg: true });
  }

  const buffer = await pipeline.toBuffer();

  // Not a direct write to filePath: on Windows, sharp can still hold the
  // source file open when toBuffer() resolves, so opening the same path
  // for writing fails (reliably reproduced on every jpeg in this dataset).
  // Write to a throwaway path and rename over the original instead.
  const tmpPath = `${filePath}.${randomBytes(6).toString("hex")}.tmp`;
  await fs.writeFile(tmpPath, buffer);
  await fs.rename(tmpPath, filePath);

  return { filePath, before, after: buffer.length, skipped: false };
}

async function main() {
  const files = await listImageFilesRecursive(UPLOADS_DIR);
  console.log(`Found ${files.length} image(s) under ${UPLOADS_DIR}\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  let skipped = 0;

  for (const filePath of files) {
    try {
      const result = await compressOne(filePath);

      if (result.skipped) {
        skipped++;
        console.log(`skip (gif)  ${path.relative(UPLOADS_DIR, filePath)}`);
        continue;
      }

      totalBefore += result.before;
      totalAfter += result.after;

      const savedPct = (
        (1 - result.after / result.before) *
        100
      ).toFixed(0);

      console.log(
        `${(result.before / 1024).toFixed(0)}KB -> ${(result.after / 1024).toFixed(0)}KB ` +
          `(-${savedPct}%)  ${path.relative(UPLOADS_DIR, filePath)}`,
      );
    } catch (err) {
      console.error(`FAILED  ${path.relative(UPLOADS_DIR, filePath)}: ${err.message}`);
    }
  }

  console.log(
    `\nDone. ${files.length - skipped} compressed, ${skipped} skipped (gif). ` +
      `Total: ${(totalBefore / 1024 / 1024).toFixed(1)}MB -> ${(totalAfter / 1024 / 1024).toFixed(1)}MB.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
