import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { createHash } from "crypto";
import { UploadedImageHash } from "./entities/uploaded-image-hash.entity";

@Injectable()
export class UploadHashService {
  constructor(
    @InjectRepository(UploadedImageHash)
    private readonly hashRepository: Repository<UploadedImageHash>,
  ) {}

  async recordAndCheck(
    files: { buffer: Buffer; url: string }[],
    uploaderId: number,
  ): Promise<string[]> {
    const duplicateWarnings: string[] = [];

    for (const file of files) {
      const hash = createHash("sha256").update(file.buffer).digest("hex");

      const existing = await this.hashRepository.findOne({
        where: { hash },
        relations: { uploader: true },
      });

      if (existing && existing.uploader.id !== uploaderId) {
        duplicateWarnings.push(
          `${file.url} matches an image already uploaded by another user.`,
        );
      }

      await this.hashRepository.save(
        this.hashRepository.create({
          hash,
          url: file.url,
          uploader: { id: uploaderId } as any,
        }),
      );
    }

    return duplicateWarnings;
  }
}
