/**
 * lib/redis.js
 * Upstash Redis client -- explicit url/token so there is no auto-detection ambiguity.
 * Uses KV_REST_API_URL and KV_REST_API_TOKEN which Vercel injects automatically
 * when an Upstash Redis database is connected to the project.
 */
import { Redis } from "@upstash/redis";

const kv = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default kv;
