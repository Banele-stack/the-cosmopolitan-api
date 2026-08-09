import { Injectable } from "@nestjs/common";
import axios from "axios";
import { RoomService } from "src/room/room.service";
import { BusinessService } from "src/business/business.service";
import { GigService } from "src/gigs/gig.service";
import { BusinessCategoryService } from "src/business-category/business-category.service";

@Injectable()
export class AiService {
  constructor(
    private readonly roomService: RoomService,
    private readonly businessService: BusinessService,
    private readonly gigService: GigService,
    private readonly businessCategoryService: BusinessCategoryService,
  ) {}

  // The category/subcategory tree barely changes at runtime, so it's
  // cached in-process rather than re-fetched on every chat message — it's
  // only there to ground the model's free-text "category" guesses in
  // vocabulary that actually exists in the data.
  private categoryVocabCache: string | null = null;

  private async getCategoryVocab(): Promise<string> {
    if (this.categoryVocabCache) return this.categoryVocabCache;

    const tree = await this.businessCategoryService.findAllTree();
    this.categoryVocabCache = tree
      .map(
        (c: any) =>
          `${c.name}: ${c.subcategories.map((s: any) => s.name).join(", ")}`,
      )
      .join("\n");

    return this.categoryVocabCache;
  }

  async chat(message: string) {
    const categoryVocab = await this.getCategoryVocab();

    // STEP 1: Ask AI to determine the user's intent
    const intentResponse = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/free",
        messages: [
          {
            role: "system",
            content: `
You are an AI intent extractor for a South African local-services marketplace
called Cosmopolitan. It has three kinds of listings:
- rooms (properties/accommodation to rent)
- businesses (local services and shops — a "salon", "mechanic", "plumber" etc. is a business)
- piece jobs (short one-off tasks, either someone needing help or someone offering to work — called "gigType"/"search_gigs" in the JSON protocol below, but always call them "piece jobs" in any plain-language reply)

Return ONLY valid JSON, no markdown, no explanation. Example:

{
  "intent": "search_businesses",
  "location": "Soweto",
  "category": "Hair Salon",
  "maxPrice": null,
  "bedrooms": null,
  "furnished": null,
  "wifi": null,
  "parking": null,
  "petsAllowed": null,
  "highlyRated": null,
  "deliveryAvailable": null,
  "onlineOnly": null,
  "openNow": null,
  "priceRange": null,
  "gigType": null
}

Field meaning:
- intent: one of search_rooms, count_rooms, search_businesses, count_businesses, search_gigs, count_gigs, general
- location: an area/township/suburb name mentioned by the user, else null
- category: for rooms, one of Apartment, Room, Bachelor, House, Guest House,
  Student Accommodation. For businesses/piece jobs, the closest matching name from
  this exact list of real categories and subcategories (use the subcategory
  name when the user is specific, e.g. "Hair Salon" not "Beauty"; use the
  category name when they're vague, e.g. "food"):
${categoryVocab}
  If nothing matches well, use null rather than inventing a category.
- maxPrice / bedrooms: rooms only. bedrooms means "at least this many".
- furnished / wifi / parking / petsAllowed: rooms only, true if explicitly asked for.
- highlyRated / deliveryAvailable / onlineOnly / openNow: businesses only, true if explicitly asked for.
- priceRange: businesses only, one of "$", "$$", "$$$", "$$$$" if the user mentions budget/cheap ($) vs expensive ($$$$).
- gigType: piece jobs only, "need_help" if the user wants to hire/find someone, "offering_work" if they're looking for work/offering a service themselves.
- Use "general" only for questions that aren't about finding/counting rooms, businesses, or piece jobs.

Never explain anything. Never wrap JSON in markdown.
`,
          },
          {
            role: "user",
            content: message,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Cosmopolitan",
        },
      },
    );

    const aiText = intentResponse.data.choices[0].message.content;

    let intent;

    try {
      // Free-tier models sometimes wrap the JSON in a ```json fence despite
      // being told not to — strip that before parsing rather than failing.
      const cleaned = aiText
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
      intent = JSON.parse(cleaned);
    } catch {
      return {
        message: "Sorry, I couldn't understand your request.",
      };
    }

    console.log(intent);

    switch (intent.intent) {
      case "search_rooms":
        return this.searchRooms(intent);

      case "count_rooms":
        return this.countRooms(intent);

      case "search_businesses":
        return this.searchBusinesses(intent);

      case "count_businesses":
        return this.countBusinesses(intent);

      case "search_gigs":
        return this.searchGigs(intent);

      case "count_gigs":
        return this.countGigs(intent);

      default:
        return this.generalChat(message);
    }
  }

  private async searchRooms(intent: any) {
    const rooms = await this.roomService.searchForAI({
      location: intent.location,
      maxPrice: intent.maxPrice,
      bedrooms: intent.bedrooms,
      category: intent.category,
      furnished: intent.furnished,
      wifi: intent.wifi,
      parking: intent.parking,
      petsAllowed: intent.petsAllowed,
    });

    if (!rooms.length) {
      return {
        message: "I couldn't find any matching rooms.",
      };
    }

    return {
      message: `I found ${rooms.length} room${
        rooms.length === 1 ? "" : "s"
      } that match what you're looking for:`,
      rooms,
    };
  }

  private async countRooms(intent: any) {
    const count = await this.roomService.countForAI({
      location: intent.location,
      maxPrice: intent.maxPrice,
      bedrooms: intent.bedrooms,
      category: intent.category,
      furnished: intent.furnished,
      wifi: intent.wifi,
      parking: intent.parking,
      petsAllowed: intent.petsAllowed,
    });

    return {
      message: `There ${
        count === 1 ? "is" : "are"
      } ${count} room${count === 1 ? "" : "s"} matching your search.`,
    };
  }

  private async searchBusinesses(intent: any) {
    const businesses = await this.businessService.searchForAI({
      location: intent.location,
      category: intent.category,
      highlyRated: intent.highlyRated,
      deliveryAvailable: intent.deliveryAvailable,
      onlineOnly: intent.onlineOnly,
      openNow: intent.openNow,
      priceRange: intent.priceRange,
    });

    if (!businesses.length) {
      return {
        message: "I couldn't find any matching businesses.",
      };
    }

    return {
      message: `I found ${businesses.length} business${
        businesses.length === 1 ? "" : "es"
      } that match what you're looking for:`,
      businesses,
    };
  }

  private async countBusinesses(intent: any) {
    const count = await this.businessService.countForAI({
      location: intent.location,
      category: intent.category,
      highlyRated: intent.highlyRated,
      deliveryAvailable: intent.deliveryAvailable,
      onlineOnly: intent.onlineOnly,
      openNow: intent.openNow,
      priceRange: intent.priceRange,
    });

    return {
      message: `There ${
        count === 1 ? "is" : "are"
      } ${count} business${count === 1 ? "" : "es"} matching your search.`,
    };
  }

  private async searchGigs(intent: any) {
    const gigs = await this.gigService.searchForAI({
      location: intent.location,
      category: intent.category,
      type: intent.gigType,
    });

    if (!gigs.length) {
      return {
        message: "I couldn't find any matching piece jobs.",
      };
    }

    return {
      message: `I found ${gigs.length} piece job${
        gigs.length === 1 ? "" : "s"
      } that match what you're looking for:`,
      gigs,
    };
  }

  private async countGigs(intent: any) {
    const count = await this.gigService.countForAI({
      location: intent.location,
      category: intent.category,
      type: intent.gigType,
    });

    return {
      message: `There ${
        count === 1 ? "is" : "are"
      } ${count} piece job${count === 1 ? "" : "s"} matching your search.`,
    };
  }

  private async generalChat(message: string) {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/free",
        messages: [
          {
            role: "system",
            content:
              "You are Northstar AI for Cosmopolitan, a South African local-services marketplace covering rooms to rent, local businesses, and short one-off piece jobs. Answer normally.",
          },
          {
            role: "user",
            content: message,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Cosmopolitan",
        },
      },
    );

    return {
      message: response.data.choices[0].message.content,
    };
  }
}
