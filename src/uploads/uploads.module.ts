import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UploadedImageHash } from "./entities/uploaded-image-hash.entity";
import { UploadHashService } from "./upload-hash.service";
import { uploadStorageProvider } from "./storage/upload-storage.provider";
import { UPLOAD_STORAGE } from "./storage/storage.interface";

@Module({
  imports: [TypeOrmModule.forFeature([UploadedImageHash])],
  providers: [UploadHashService, uploadStorageProvider],
  exports: [UploadHashService, UPLOAD_STORAGE],
})
export class UploadsModule {}
