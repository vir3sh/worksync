import { z } from "zod";

export const addProjectMemberValidation = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid user ID"),

  role: z.enum(["lead", "member"]).default("member"),
});
