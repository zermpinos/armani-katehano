const VENUE_MAP: Record<string, string> = {
  "Basketcity Arena": "https://maps.app.goo.gl/m4HwgEDNmE8TCwpD8",
};

export function getVenueUrl(venue: string): string {
  // eslint-disable-next-line security/detect-object-injection
  return Object.hasOwn(VENUE_MAP, venue) ? VENUE_MAP[venue] : `https://www.google.com/maps/search/${encodeURIComponent(venue)}`;
}
