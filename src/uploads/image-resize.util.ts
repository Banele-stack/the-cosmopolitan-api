// Neither `import sharp from "sharp"` (this tsconfig has `esModuleInterop`
// off, so that resolves to a `.default` that doesn't exist at runtime) nor
// `import sharp = require("sharp")` (this sharp version's shipped types
// resolve, under this project's module-resolution setting, to its ESM
// `.d.mts` declarations rather than the callable CJS `export =` ones) type
// checks correctly here. A plain runtime require sidesteps the mismatch —
// the actual Node require of "sharp" is unaffected either way.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require("sharp") as (input: Buffer) => {
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

// Resizes and re-compresses an in-memory upload, keeping its original
// format. Operates on buffers (not a saved-to-disk path) so it works the
// same way regardless of which UploadStorage ends up persisting the
// result — local disk or S3. GIFs are skipped: re-encoding through this
// single-frame pipeline would silently strip their animation.
export async function compressImageBuffer(
  buffer: Buffer,
  mimetype: string,
): Promise<Buffer> {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  if (metadata.format === "gif" || mimetype === "image/gif") {
    return buffer;
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

  return pipeline.toBuffer();
}

export async function compressImageBuffers(
  files: { buffer: Buffer; mimetype: string }[],
): Promise<Buffer[]> {
  return Promise.all(
    files.map((f) => compressImageBuffer(f.buffer, f.mimetype)),
  );
}
