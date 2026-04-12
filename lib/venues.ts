/**
 * lib/venues.ts
 *
 * Maps known venue names to their Google Maps short links.
 * When a venue name is typed in the admin schedule page, the app
 * uses this map to resolve the correct Maps URL instead of a generic search.
 */

export const VENUE_MAP: Record<string, string> = {
  "Basketcity Arena": "https://maps.app.goo.gl/m4HwgEDNmE8TCwpD8",
};

/** Returns the resolved Maps URL for a venue name. */
export function getVenueUrl(venue: string): string {
  return VENUE_MAP[venue] ?? `https://www.google.com/maps/search/${encodeURIComponent(venue)}`;
}
