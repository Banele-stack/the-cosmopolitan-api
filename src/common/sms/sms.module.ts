import { Module } from "@nestjs/common";
import { ClickatellService } from "./clickatell.service";

@Module({
  providers: [ClickatellService],
  exports: [ClickatellService],
})
export class SmsModule {}
