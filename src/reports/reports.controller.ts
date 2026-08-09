import { Body, Controller, Post, Req, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ReportsService } from "./reports.service";
import { CreateReportDto } from "./dto/create-report.dto";

@Controller("reports")
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateReportDto, @Req() req: any) {
    return this.reportsService.create(dto, req.user.sub);
  }
}
