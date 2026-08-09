import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UploadedImageHash } from "./entities/uploaded-image-hash.entity";
import { UploadHashService } from "./upload-hash.service";

@Module({
  imports: [TypeOrmModule.forFeature([UploadedImageHash])],
  providers: [UploadHashService],
  exports: [UploadHashService],
})
export class UploadsModule {}
