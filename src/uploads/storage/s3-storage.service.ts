import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { UploadStorage } from './storage.interface';

// Production driver (STORAGE_DRIVER=s3), so an uploaded photo survives a
// Render redeploy/restart instead of living on that instance's disk. Only
// ever instantiated when STORAGE_DRIVER=s3 (see upload-storage.provider.ts)
// — local development never touches this class or needs AWS credentials.
@Injectable()
export class S3StorageService implements UploadStorage {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  // Optional override for when a CDN (e.g. CloudFront) sits in front of the
  // bucket later — set AWS_S3_PUBLIC_URL_BASE to that domain and returned
  // URLs switch over with no other code change. Falls back to the bucket's
  // own public S3 URL.
  private readonly publicUrlBase?: string;

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET ?? '';
    this.region = process.env.AWS_REGION ?? 'af-south-1';
    this.publicUrlBase = process.env.AWS_S3_PUBLIC_URL_BASE;

    if (!this.bucket) {
      // Fail loudly at startup rather than 500ing on the first upload —
      // STORAGE_DRIVER=s3 with no bucket configured is a deploy misconfig.
      throw new Error(
        'STORAGE_DRIVER=s3 but AWS_S3_BUCKET is not set. Check Render\'s environment variables.',
      );
    }

    // Credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) are picked up
    // automatically from the environment by the SDK's default credential
    // chain — nothing to pass explicitly here, and nothing to commit.
    this.client = new S3Client({ region: this.region });
  }

  async save(
    buffer: Buffer,
    filename: string,
    mimetype: string,
    folder = '',
  ): Promise<string> {
    const key = folder ? `${folder}/${filename}` : filename;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
        // Filenames already include a random unique suffix (see the
        // controllers), so a given key's bytes never change — safe to
        // cache for a year, same policy main.ts already applies to the
        // local /uploads static route.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    const base =
      this.publicUrlBase ??
      `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
    const url = `${base}/${key}`;

    this.logger.log(`Uploaded ${key} to S3`);
    return url;
  }
}
