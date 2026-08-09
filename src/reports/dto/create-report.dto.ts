import { IsIn, IsInt, IsNotEmpty, IsString } from "class-validator";

export class CreateReportDto {
  @IsIn(["room", "business", "gig"])
  targetType: "room" | "business" | "gig";

  @IsInt()
  targetId: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
