import { IsIn } from "class-validator";

export class UpdateListingStatusDto {
  @IsIn(["active", "pending_review", "suspended"])
  status: "active" | "pending_review" | "suspended";
}
