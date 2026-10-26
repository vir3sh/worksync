import { z } from "zod";

export const createTaskValidation = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Task title must be at least 2 characters")
      .max(150, "Task title cannot exceed 150 characters"),

    description: z
      .string()
      .trim()
      .max(3000, "Description cannot exceed 3000 characters")
      .optional()
      .default(""),

    assignedTo: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Invalid assigned user ID")
      .nullable()
      .optional()
      .default(null),

    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),

    dueDate: z.coerce.date().nullable().optional().default(null),
  })
  .strict()
  .refine(
    (data) =>
      data.dueDate === null || data.dueDate.getTime() >= Date.now() - 60_000,
    {
      message: "Due date cannot be in the past",
      path: ["dueDate"],
    },
  );

export const updateTaskStatusValidation = z
  .object({
    status: z.enum(["todo", "in-progress", "in-review", "completed"]),
  })
  .strict();

export const updateTaskValidation = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Title must be at least 2 characters")
      .max(150)
      .optional(),

    description: z.string().trim().max(3000).optional(),

    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),

    assignedTo: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Invalid assigned user ID")
      .nullable()
      .optional(),

    dueDate: z.coerce.date().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });
