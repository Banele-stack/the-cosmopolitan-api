import { Injectable, Logger } from '@nestjs/common';

// Live Google Places lookups — used to show a real photo of a specific
// listing when we don't have one of our own (e.g. OSM-sourced businesses,
// which almost never carry a photo). Deliberately NOT used to store/
// republish Google's data: only a place's photo is fetched, on demand, and
// only the resolved place id + photo reference are cached (see
// business.entity.ts's googlePlaceId/googlePhotoRef) — never the photo
// bytes themselves, and never anything beyond what's needed to keep
// re-resolving the same listing from costing a fresh Text Search every
// view. That keeps this within Google's "display-only, no permanent
// re-publishing" terms for Places data.
//
// Entirely inert (no network calls, no cost) until GOOGLE_PLACES_API_KEY is
// set — every method below short-circuits to null/false without it, so
// shipping this code doesn't require anyone to have a key yet.
@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name);
  private readonly apiKey = process.env.GOOGLE_PLACES_API_KEY;

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  // Resolves a listing (by name + rough location) to a Google place id and
  // its first photo's resource name, via Places API (New) Text Search.
  async findPlacePhoto(input: {
    name: string;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
  }): Promise<{ placeId: string | null; photoName: string | null }> {
    if (!this.apiKey) return { placeId: null, photoName: null };

    try {
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'places.id,places.photos',
        },
        body: JSON.stringify({
          textQuery: [input.name, input.address].filter(Boolean).join(', '),
          // Nudges results toward the listing's own coordinates so a common
          // name (e.g. "Shoprite") resolves to the branch we actually mean,
          // not just the most prominent one nationally.
          ...(input.lat != null && input.lng != null
            ? {
                locationBias: {
                  circle: { center: { latitude: input.lat, longitude: input.lng }, radius: 500 },
                },
              }
            : {}),
          maxResultCount: 1,
        }),
      });

      if (!res.ok) {
        this.logger.warn(`Places text search failed (${res.status}) for "${input.name}"`);
        return { placeId: null, photoName: null };
      }

      const data = (await res.json()) as {
        places?: Array<{ id?: string; photos?: Array<{ name?: string }> }>;
      };
      const place = data.places?.[0];
      return {
        placeId: place?.id ?? null,
        photoName: place?.photos?.[0]?.name ?? null,
      };
    } catch (err) {
      this.logger.warn(`Places text search error for "${input.name}": ${(err as Error).message}`);
      return { placeId: null, photoName: null };
    }
  }

  // Streams the actual photo bytes server-side. Never construct a
  // client-visible URL containing the API key directly — anyone who saw it
  // (view-source, network tab) could harvest it and run up the account's
  // Google Cloud bill on an unrelated app.
  async fetchPhotoBytes(
    photoName: string,
    maxWidthPx = 800,
  ): Promise<{ body: Buffer; contentType: string } | null> {
    if (!this.apiKey) return null;

    try {
      const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${this.apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const contentType = res.headers.get('content-type') ?? 'image/jpeg';
      const body = Buffer.from(await res.arrayBuffer());
      return { body, contentType };
    } catch (err) {
      this.logger.warn(`Places photo fetch error: ${(err as Error).message}`);
      return null;
    }
  }
}
