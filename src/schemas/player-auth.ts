import { z } from "zod";

export const LoginSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-z]+(\.[a-z]+)?[0-9]*$/, "invalid username shape"),
  password: z.string().min(12).max(200),
});

export const EnrollSchema = z.object({
  token: z.string().length(64),
  password: z.string().min(12).max(200),
});

export const CreateInviteSchema = z.object({
  playerId: z.string().min(1),
});

export const InviteInfoQuerySchema = z.object({
  token: z.string().length(64),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type EnrollInput = z.infer<typeof EnrollSchema>;
export type CreateInviteInput = z.infer<typeof CreateInviteSchema>;
