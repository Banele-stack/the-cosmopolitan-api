import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";

export interface GeocodeResult {
  label: string;
  address: string;
  area: string;
  lat: number;
  lng: number;
}

interface CacheEntry {
  data: GeocodeResult[];
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MIN_REQUEST_GAP_MS = 1100; // Nominatim's usage policy: max 1 req/sec

@Injectable()
export class GeocodeService {
  private readonly logger = new Logger(GeocodeService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private lastRequestAt = 0;
  private requestQueue: Promise<void> = Promise.resolve();

  async search(text: string): Promise<GeocodeResult[]> {
    const query = text.trim();

    if (query.length < 3) {
      return [];
    }

    const cacheKey = query.toLowerCase();
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const results = await this.queueRequest(() => this.fetchFromNominatim(query));

    this.cache.set(cacheKey, {
      data: results,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return results;
  }

  // Turns a GPS pair into a human-readable area (e.g. "Cosmo City") so the
  // app can label an auto-detected location the same way it labels a
  // manually-picked one. Coordinates are rounded to ~110m for the cache key
  // since a few metres of GPS jitter shouldn't cost a fresh Nominatim call.
  async reverse(lat: number, lng: number): Promise<GeocodeResult | null> {
    const cacheKey = `rev:${lat.toFixed(3)},${lng.toFixed(3)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data[0] ?? null;
    }

    const result = await this.queueRequest(() =>
      this.fetchReverseFromNominatim(lat, lng),
    );

    this.cache.set(cacheKey, {
      data: result ? [result] : [],
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return result;
  }

  // Nominatim's usage policy caps the whole app at ~1 request/second — this
  // serializes every outgoing call through a single queue so concurrent
  // users never burst past that, regardless of how many requests land at
  // once.
  private queueRequest<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.requestQueue.then(async () => {
      const wait = MIN_REQUEST_GAP_MS - (Date.now() - this.lastRequestAt);

      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }

      this.lastRequestAt = Date.now();
    });

    this.requestQueue = run.catch(() => undefined);

    return run.then(fn);
  }

  private async fetchFromNominatim(query: string): Promise<GeocodeResult[]> {
    try {
      const response = await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
          params: {
            q: query,
            countrycodes: "za",
            format: "json",
            addressdetails: 1,
            limit: 6,
          },
          headers: {
            // Nominatim's usage policy requires a real identifying
            // User-Agent for every request.
            "User-Agent": "FindzaMarketplace/1.0 (https://cosmopolitan.co.za)",
          },
          timeout: 5000,
        },
      );

      return response.data.map((item: any) => this.toResult(item));
    } catch (error) {
      this.logger.warn(`Geocode search failed for "${query}": ${error}`);
      return [];
    }
  }

  private async fetchReverseFromNominatim(
    lat: number,
    lng: number,
  ): Promise<GeocodeResult | null> {
    try {
      const response = await axios.get(
        "https://nominatim.openstreetmap.org/reverse",
        {
          params: {
            lat,
            lon: lng,
            format: "json",
            addressdetails: 1,
          },
          headers: {
            "User-Agent": "FindzaMarketplace/1.0 (https://cosmopolitan.co.za)",
          },
          timeout: 5000,
        },
      );

      if (!response.data || response.data.error) {
        return null;
      }

      return this.toResult(response.data);
    } catch (error) {
      this.logger.warn(`Reverse geocode failed for (${lat}, ${lng}): ${error}`);
      return null;
    }
  }

  private toResult(item: any): GeocodeResult {
    const addr = item.address ?? {};

    const streetParts = [addr.house_number, addr.road].filter(Boolean);
    const area =
      addr.suburb ??
      addr.neighbourhood ??
      addr.village ??
      addr.town ??
      addr.city ??
      addr.county ??
      "";

    return {
      label: item.display_name,
      address: streetParts.length > 0 ? streetParts.join(" ") : (item.display_name as string).split(",")[0],
      area,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    };
  }
}
