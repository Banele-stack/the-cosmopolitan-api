import { IsIn } from "class-validator";

export class UpdateReviewStatusDto {
  @IsIn(["approved", "rejected"])
  status: "approved" | "rejected";
}
