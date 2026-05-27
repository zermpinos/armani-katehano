import { z } from "zod";

export const ResolveSchema = z.object({
  mode:         z.literal("resolve"),
  targetEmails: z.array(z.string().email()).min(1).max(500),
});

export const PreviewSendSchema = z.object({
  mode:         z.enum(["preview", "send"]),
  subject:      z.string().min(1).max(200),
  body:         z.string().min(1).max(50_000),
  targetEmails: z.array(z.string().email()).max(500).optional(),
});

export const BroadcastSchema = z.discriminatedUnion("mode", [ResolveSchema, PreviewSendSchema]);

export type ResolveInput     = z.infer<typeof ResolveSchema>;
export type PreviewSendInput = z.infer<typeof PreviewSendSchema>;
export type BroadcastInput   = z.infer<typeof BroadcastSchema>;
