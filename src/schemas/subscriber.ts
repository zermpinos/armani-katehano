import { z } from "zod";

export const SubscribeSchema = z.object({
  email: z.string().email().max(254).transform(v => v.toLowerCase().trim()),
});

export const UnsubscribeSchema = z.object({
  token: z.string().min(32).max(128),
});

export const TokenSchema = z.object({
  token: z.string().min(32).max(128),
});
