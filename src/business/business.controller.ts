import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Req,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Query,
  Res,
  Inject,
} from '@nestjs/common';
import { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { UploadHashService } from "src/uploads/upload-hash.service";
import { compressImageBuffer } from "src/uploads/image-resize.util";
import { UPLOAD_STORAGE, UploadStorage } from "src/uploads/storage/storage.interface";


@Controller('business')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class BusinessController {
  constructor(
    private readonly businessService: BusinessService,
    private readonly uploadHashService: UploadHashService,
    @Inject(UPLOAD_STORAGE) private readonly storage: UploadStorage,
  ) {}

  @Post()
    @UseGuards(JwtAuthGuard, ThrottlerGuard)
  create(
    @Body() dto: CreateBusinessDto,
    @Req() req: any,
  ) {
    return this.businessService.create(
      dto,
      req.user.sub,
    );
  }

  @Post('upload')
    @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      // Holds the file in memory instead of writing it to disk first — the
      // storage backend (local disk or S3, see UploadsModule) decides where
      // it ends up, so multer's job here is just to buffer the upload.
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'),
            false
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No images provided');
    }

    // Resize/recompress before anything downstream (the URL response, the
    // dedup hash below) touches these bytes — this is what actually fixes
    // slow/failing photo loads on mobile: uploads used to be stored
    // completely untouched, up to the full 5MB multer limit. Then hand the
    // result to whichever storage backend is active (local disk or S3).
    const saved = await Promise.all(
      files.map(async (file) => {
        const compressed = await compressImageBuffer(file.buffer, file.mimetype);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const filename = `business-${uniqueSuffix}${extname(file.originalname)}`;
        const url = await this.storage.save(compressed, filename, file.mimetype, 'business');
        return { buffer: compressed, url };
      }),
    );

    const imageUrls = saved.map((file) => file.url);

    const duplicateWarnings = await this.uploadHashService.recordAndCheck(
      saved.map((file) => ({ buffer: file.buffer, url: file.url })),
      req.user.sub,
    );

    return { imageUrls, duplicateWarnings };
  }

  @Post('upload-videos')
    @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('videos', 3, {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/3gpp'];
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Invalid file type. Only MP4, MOV, WebM, AVI, and 3GP videos are allowed.'),
            false
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  )
  async uploadVideos(
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No videos provided');
    }

    const videoUrls = await Promise.all(
      files.map((file) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const filename = `business-video-${uniqueSuffix}${extname(file.originalname)}`;
        return this.storage.save(file.buffer, filename, file.mimetype, 'business');
      }),
    );

    return { videoUrls };
  }

@Get()
findAll(
  @Query("location") location?: string,
  @Query("categorySlug") categorySlug?: string,
  @Query("subcategorySlug") subcategorySlug?: string,
  @Query("search") search?: string,
  @Query("openNow") openNow?: string,
  @Query("deliveryAvailable") deliveryAvailable?: string,
  @Query("onlineOnly") onlineOnly?: string,
  @Query("nearby") nearby?: string,
  @Query("highlyRated") highlyRated?: string,
  @Query("priceRange") priceRange?: string,
  @Query("lat") lat?: string,
  @Query("lng") lng?: string,
  @Query("page") page?: string,
  @Query("limit") limit?: string,
) {
  return this.businessService.findAll(
    {
      location,
      categorySlug,
      subcategorySlug,
      search,
      openNow: openNow === "true",
      deliveryAvailable: deliveryAvailable === "true",
      onlineOnly: onlineOnly === "true",
      nearby: nearby === "true",
      highlyRated: highlyRated === "true",
      priceRange,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
    },
    { page, limit },
  );
}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.businessService.findOne(+id);
  }

  // Public, unauthenticated — same visibility as the listing itself.
  // Streams a live Google Places photo server-side (never exposes the API
  // key to the client) for a listing with no photos of its own; 404s if
  // Google has nothing or the feature isn't configured, so the frontend's
  // <img onError> just falls back to the category placeholder.
  @Get(':id/photo')
  async getPhoto(@Param('id') id: string, @Res() res: Response) {
    const photo = await this.businessService.getGooglePhotoBytes(+id);
    if (!photo) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', photo.contentType);
    // Repeat views (same browser) skip the round trip entirely for a day —
    // keeps cost down without caching so long that a listing that gains a
    // Google presence stays stuck on a stale/missing result.
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(photo.body);
  }

  @Patch(':id')
    @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessDto,
    @Req() req: any,
  ) {
    return this.businessService.update(+id, dto, req.user.sub);
  }

  @Delete(':id')
    @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.businessService.remove(+id, req.user.sub);
  }

  // Public — anyone viewing/contacting a listing counts, not just logged-in
  // users. No ThrottlerGuard here deliberately: it's a plain increment with
  // no side effects worth rate-limiting, and would just add friction for a
  // visitor rapidly browsing several listings.
  @Patch(':id/view')
  recordView(@Param('id') id: string) {
    return this.businessService.recordView(+id);
  }

  @Patch(':id/contact-click')
  recordContactClick(@Param('id') id: string) {
    return this.businessService.recordContactClick(+id);
  }
}