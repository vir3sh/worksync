import { z } from "zod";

export const createProjectValidation = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Project name must be at least 2 characters")
      .max(120, "Project name cannot exceed 120 characters"),

    description: z
      .string()
      .trim()
      .max(2000, "Description cannot exceed 2000 characters")
      .optional()
      .default(""),

    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),

    startDate: z.coerce.date().nullable().optional().default(null),

    dueDate: z.coerce.date().nullable().optional().default(null),
  })
  .refine(
    (data) =>
      !data.startDate || !data.dueDate || data.dueDate >= data.startDate,
    {
      message: "Due date must be on or after the start date",
      path: ["dueDate"],
    },
  );
