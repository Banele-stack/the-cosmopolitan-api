import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UsePipes, ValidationPipe, Req, UseInterceptors, BadRequestException, UploadedFiles, Query, Res, Inject } from '@nestjs/common';
import { Response } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express/multer';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { UploadHashService } from 'src/uploads/upload-hash.service';
import { compressImageBuffer } from 'src/uploads/image-resize.util';
import { UPLOAD_STORAGE, UploadStorage } from 'src/uploads/storage/storage.interface';

// Without this, CreateRoomDto/UpdateRoomDto's class-validator decorators
// (including the required phoneNumber added for the contact-number fix)
// are never actually enforced — Nest only runs validation when a pipe is
// wired up. BusinessController already does this; Room was missing it.
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('room')
export class RoomController {
  constructor(
    private readonly roomService: RoomService,
    private readonly uploadHashService: UploadHashService,
    @Inject(UPLOAD_STORAGE) private readonly storage: UploadStorage,
  ) {}

@UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Post()
  create(
    @Body() dto: CreateRoomDto,
    @Req() req: any,
  ) {
    return this.roomService.create(dto, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      // Holds the file in memory instead of writing it to disk first — the
      // storage backend (local disk or S3, see UploadsModule) decides where
      // it ends up, so multer's job here is just to buffer the upload.
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(new BadRequestException('Invalid file type'), false);
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
        const filename = `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`;
        const url = await this.storage.save(compressed, filename, file.mimetype);
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

  @UseGuards(JwtAuthGuard)
  @Post('upload-videos')
  @UseInterceptors(
    FilesInterceptor('videos', 3, {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/3gpp'];
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(new BadRequestException('Invalid file type. Only MP4, MOV, WebM, AVI, and 3GP videos are allowed.'), false);
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
        const filename = `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`;
        return this.storage.save(file.buffer, filename, file.mimetype);
      }),
    );

    return { videoUrls };
  }

@Get()
findAll(
  @Query("location") location?: string,
  @Query("filter") filter?: string,
  @Query("tags") tags?: string | string[],
  @Query("lat") lat?: string,
  @Query("lng") lng?: string,
  @Query("page") page?: string,
  @Query("limit") limit?: string,
) {
  const tagArray = Array.isArray(tags)
    ? tags
    : tags
    ? [tags]
    : [];

  return this.roomService.findAll(
    {
      location,
      filter,
      activeTags: tagArray,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
    },
    { page, limit },
  );
}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomService.findOne(+id);
  }

  // See BusinessController's identical /business/:id/photo for why this
  // streams server-side rather than exposing a Google-hosted URL directly.
  @Get(':id/photo')
  async getPhoto(@Param('id') id: string, @Res() res: Response) {
    const photo = await this.roomService.getGooglePhotoBytes(+id);
    if (!photo) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', photo.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(photo.body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @Req() req: any,
  ) {
    return this.roomService.update(+id, updateRoomDto, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.roomService.remove(+id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Post(':id/reviews')
  addReview(
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
    @Req() req: any,
  ) {
    return this.roomService.addReview(+id, req.user.sub, dto);
  }

  // Public — anyone viewing/contacting a listing counts, not just logged-in
  // users. No ThrottlerGuard here deliberately: it's a plain increment with
  // no side effects worth rate-limiting, and would just add friction for a
  // visitor rapidly browsing several listings.
  @Patch(':id/view')
  recordView(@Param('id') id: string) {
    return this.roomService.recordView(+id);
  }

  @Patch(':id/contact-click')
  recordContactClick(@Param('id') id: string) {
    return this.roomService.recordContactClick(+id);
  }
}
