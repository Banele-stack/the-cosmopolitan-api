import { Provider } from '@nestjs/common';
import { UPLOAD_STORAGE } from './storage.interface';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';

// The one place that reads STORAGE_DRIVER — everywhere else in the app just
// injects UPLOAD_STORAGE and gets whichever implementation this picked.
// Unset (or any value other than "s3") defaults to local disk, so local
// development never needs AWS credentials configured.
export const uploadStorageProvider: Provider = {
  provide: UPLOAD_STORAGE,
  useFactory: () => {
    return process.env.STORAGE_DRIVER === 's3'
      ? new S3StorageService()
      : new LocalStorageService();
  },
};
