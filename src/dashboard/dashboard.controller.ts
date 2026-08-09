import { Controller, Get, Req, UseGuards } from "@nestjs/common";

import { DashboardService } from "./dashboard.service";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getDashboard(@Req() req: any) {
    return this.dashboardService.getDashboard(req.user.sub);
  }
}