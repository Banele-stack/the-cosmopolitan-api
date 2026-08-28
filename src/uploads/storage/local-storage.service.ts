import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { UploadStorage } from './storage.interface';

// Default driver (STORAGE_DRIVER unset or "local") — used for local
// development so nobody needs AWS credentials just to run the app.
// Writes into the same ./uploads folder Express already serves statically
// in main.ts, so behavior for anyone on this driver is unchanged from
// before the S3 migration.
@Injectable()
export class LocalStorageService implements UploadStorage {
  async save(
    buffer: Buffer,
    filename: string,
    _mimetype: string,
    folder = '',
  ): Promise<string> {
    const dir = join(process.cwd(), 'uploads', folder);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(join(dir, filename), buffer);
    return folder ? `/uploads/${folder}/${filename}` : `/uploads/${filename}`;
  }
}
