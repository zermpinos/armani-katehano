/**
 * lib/redis.js
 * Explicit KV client -- passes url/token directly so Vercel's
 * auto-detection can't fail regardless of how the database was connected.
 */
import { createClient } from "@vercel/kv";

const kv = createClient({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default kv;
