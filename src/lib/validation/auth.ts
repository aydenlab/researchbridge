import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your institutional email address.")
  .max(254, "That email address is too long.")
  .email("Enter a valid email address, for example name@example.edu.")
  .transform((value) => value.toLowerCase());

export const requestCodeSchema = z.object({
  email: emailSchema,
});

export const verifyCodeSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the six-digit verification code sent to your institutional email."),
});

export const roleChoiceSchema = z.object({
  role: z.enum(["student", "researcher"], {
    message: "Choose whether you are looking for research or recruiting for a project.",
  }),
});

export type RequestCodeInput = z.infer<typeof requestCodeSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
