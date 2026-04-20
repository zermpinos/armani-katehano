import { z } from "zod";

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword:     z.string().min(8).max(200),
});
