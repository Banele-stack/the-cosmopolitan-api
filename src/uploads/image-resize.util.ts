import { promises as fs } from "fs";
import { randomBytes } from "crypto";

// Neither `import sharp from "sharp"` (this tsconfig has `esModuleInterop`
// off, so that resolves to a `.default` that doesn't exist at runtime) nor
// `import sharp = require("sharp")` (this sharp version's shipped types
// resolve, under this project's module-resolution setting, to its ESM
// `.d.mts` declarations rather than the callable CJS `export =` ones) type
// checks correctly here. A plain runtime require sidesteps the mismatch —
// the actual Node require of "sharp" is unaffected either way.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require("sharp") as (input: string) => {
  metadata(): Promise<{ format?: string }>;
  resize(opts: { width: number; withoutEnlargement: boolean }): any;
};

// Any wider than this is wasted bytes on a phone screen — 1600px covers
// even a large tablet's full-bleed hero image, and next/image on the
// frontend downsizes further per-tile from there anyway. Uploads were
// previously stored completely untouched (up to the 5MB multer limit),
// which is exactly why photos were slow/failing to load on mobile data:
// a full-resolution phone-camera JPEG easily hits several MB.
const MAX_WIDTH = 1600;

// Resizes and re-compresses an already-saved upload in place, keeping its
// original format and filename/path — so nothing downstream (the stored
// URL, the dedup hash check that reads the same path afterward) needs to
// change. GIFs are skipped: re-encoding through this single-frame pipeline
// would silently strip their animation.
export async function compressImageInPlace(path: string): Promise<void> {
  const image = sharp(path);
  const metadata = await image.metadata();

  if (metadata.format === "gif") {
    return;
  }

  let pipeline = image.resize({
    width: MAX_WIDTH,
    withoutEnlargement: true,
  });

  if (metadata.format === "png") {
    // compressionLevel alone is lossless re-encoding — it does NOT reliably
    // shrink a PNG that's already reasonably encoded, and measured cases
    // during testing actually came out *larger* than the original. `quality`
    // + `palette` turns on real (lossy, quantized) compression, the same way
    // pngquant does, which is what actually gets photographic PNGs smaller.
    pipeline = pipeline.png({ quality: 80, palette: true });
  } else if (metadata.format === "webp") {
    pipeline = pipeline.webp({ quality: 80 });
  } else {
    // jpeg, or anything else sharp can decode — the upload fileFilter only
    // allows jpeg/png/webp/gif in the first place, so in practice this is
    // always jpeg.
    pipeline = pipeline.jpeg({ quality: 80, mozjpeg: true });
  }

  const buffer = await pipeline.toBuffer();

  // NOT fs.writeFile(path, buffer) directly: on Windows, sharp/libvips can
  // still hold the source file open when toBuffer() resolves, and opening
  // the same path for writing then fails with EBUSY/UNKNOWN — reliably
  // reproduced during testing on every jpeg in the seed data. Writing to a
  // throwaway path and renaming over the original sidesteps that (and is
  // the standard fix — see sharp's own "can I overwrite the input file"
  // guidance), with the same behavior as a bonus: the file never exists in
  // a half-written state at its real path.
  const tmpPath = `${path}.${randomBytes(6).toString("hex")}.tmp`;
  await fs.writeFile(tmpPath, buffer);
  await fs.rename(tmpPath, path);
}

export async function compressImagesInPlace(
  paths: string[],
): Promise<void> {
  await Promise.all(paths.map((path) => compressImageInPlace(path)));
}
