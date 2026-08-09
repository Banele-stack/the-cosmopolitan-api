import { Body, Controller, Post } from "@nestjs/common";
import { AiService } from "./ai.service";
import { ChatDto } from "./dto/chat.dto";

@Controller("ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("chat")
  async chat(@Body() dto: ChatDto) {
    return this.aiService.chat(dto.message);
  }
}