import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Req,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { GigService } from "./gig.service";
import { CreateGigDto } from "./dto/create-gig.dto";
import { UpdateGigDto } from "./dto/update-gig.dto";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";

@Controller("gigs")
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class GigController {
  constructor(private readonly gigService: GigService) {}

  @Post()
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  create(@Body() dto: CreateGigDto, @Req() req: any) {
    return this.gigService.create(dto, req.user.sub);
  }

  @Get()
  findAll(
    @Query("type") type?: "need_help" | "offering_work",
    @Query("categorySlug") categorySlug?: string,
    @Query("subcategorySlug") subcategorySlug?: string,
    @Query("urgency") urgency?: "today" | "this_week" | "flexible",
    @Query("location") location?: string,
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.gigService.findAll(
      {
        type,
        categorySlug,
        subcategorySlug,
        urgency,
        location,
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
      },
      { page, limit },
    );
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.gigService.findOne(+id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  update(
    @Param("id") id: string,
    @Body() dto: UpdateGigDto,
    @Req() req: any,
  ) {
    return this.gigService.update(+id, dto, req.user.sub);
  }

  @Patch(":id/status")
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Param("id") id: string,
    @Body() body: { status: "active" | "filled" },
    @Req() req: any,
  ) {
    return this.gigService.updateOwnStatus(+id, req.user.sub, body.status);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  remove(@Param("id") id: string, @Req() req: any) {
    return this.gigService.remove(+id, req.user.sub);
  }

  // Public — anyone viewing/contacting a post counts, not just logged-in
  // users. No ThrottlerGuard here deliberately: it's a plain increment with
  // no side effects worth rate-limiting, and would just add friction for a
  // visitor rapidly browsing several posts.
  @Patch(":id/view")
  recordView(@Param("id") id: string) {
    return this.gigService.recordView(+id);
  }

  @Patch(":id/contact-click")
  recordContactClick(@Param("id") id: string) {
    return this.gigService.recordContactClick(+id);
  }
}
