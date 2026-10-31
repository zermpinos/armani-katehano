import { describe, it, expect } from "vitest";
import { PlayerWriteSchema } from "@/schemas/player";

const photo = (photoUrl: unknown) =>
  PlayerWriteSchema.safeParse({ name: "Petros", number: 7, position: "PG", photoUrl }).success;

describe("PlayerWriteSchema photoUrl", () => {
  it("accepts an image in the team's Cloudinary account", () => {
    expect(photo("https://res.cloudinary.com/dojn0rjjr/image/upload/v1712345678/players/petros.jpg")).toBe(true);
  });

  it("still accepts no photo", () => {
    expect(photo(null)).toBe(true);
    expect(photo(undefined)).toBe(true);
  });

  it.each([
    ["another Cloudinary account", "https://res.cloudinary.com/demo/image/upload/v1/players/a.jpg"],
    ["another host",               "https://example.com/players/a.jpg"],
    ["plain http",                 "http://res.cloudinary.com/dojn0rjjr/image/upload/v1/players/a.jpg"],
    ["a path out of the account",  "https://res.cloudinary.com/dojn0rjjr/../demo/image/upload/a.jpg"],
    ["a query string",             "https://res.cloudinary.com/dojn0rjjr/image/upload/v1/players/a.jpg?x=1"],
    ["text that is not a URL",     "not a url"],
  ])("rejects %s", (_label, url) => {
    expect(photo(url)).toBe(false);
  });
});
