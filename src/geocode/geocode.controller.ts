import { Controller, Get, Query } from "@nestjs/common";
import { GeocodeService } from "./geocode.service";

@Controller("geocode")
export class GeocodeController {
  constructor(private readonly geocodeService: GeocodeService) {}

  @Get("search")
  search(@Query("text") text: string) {
    return this.geocodeService.search(text ?? "");
  }

  @Get("reverse")
  reverse(@Query("lat") lat?: string, @Query("lng") lng?: string) {
    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return null;
    }

    return this.geocodeService.reverse(latNum, lngNum);
  }
}
