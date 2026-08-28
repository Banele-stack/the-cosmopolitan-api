// Injection token for whichever UploadStorage implementation is active.
// A string (not a class) because the choice between the two implementations
// is made at runtime (see upload-storage.provider.ts), not by importing a
// concrete class.
export const UPLOAD_STORAGE = 'UPLOAD_STORAGE';

// Implemented by LocalStorageService (writes to ./uploads, used in local
// dev) and S3StorageService (uploads to AWS S3, used in production). Every
// controller that handles a file upload depends on this interface only —
// it never knows or cares which implementation is actually wired in.
export interface UploadStorage {
  /**
   * Persists a file's bytes and returns the URL it's reachable at.
   *
   * @param buffer   the file's raw bytes (already resized/compressed, if applicable)
   * @param filename the file's final name, e.g. "business-1234-99.jpg"
   * @param mimetype the file's content type, e.g. "image/jpeg"
   * @param folder   optional subfolder, e.g. "business" — omit for the uploads root
   */
  save(
    buffer: Buffer,
    filename: string,
    mimetype: string,
    folder?: string,
  ): Promise<string>;
}
