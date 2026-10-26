import { z } from "zod";

export const addWorkspaceMemberValidation = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(254)
    .transform((email) => email.toLowerCase()),

  role: z.enum(["admin", "manager", "employee"]).default("employee"),
});
