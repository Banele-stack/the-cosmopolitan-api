import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";

// Generic, reusable SMS sender — the auth module has its own narrower
// sendSms() (src/auth/helpers/clickatell.helper.ts) hardcoded to the OTP
// message; this is the general version for anything else that needs to
// text a user (booking confirmations, status changes, etc.) without
// duplicating the same Clickatell HTTP call everywhere.
@Injectable()
export class ClickatellService {
  private readonly logger = new Logger(ClickatellService.name);

  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    try {
      await axios.get(
        `${process.env.CLICKATELL_BASE_URL}/messages/http/send`,
        {
          params: {
            apiKey: process.env.CLICKATELL_API_KEY,
            to: phoneNumber.replace("+", ""),
            content: message,
          },
        },
      );
      return true;
    } catch (err) {
      // Best-effort: a failed SMS should never fail the action that
      // triggered it (e.g. a booking is still valid even if the text
      // didn't send) — log and swallow rather than throw.
      this.logger.error(
        `Failed to send SMS to ${phoneNumber}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }
}
