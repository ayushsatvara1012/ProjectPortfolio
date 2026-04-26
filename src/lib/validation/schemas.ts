import { z } from 'zod';

// Shared single source of truth for client-side form validation. Backend
// validates again — these schemas only exist to surface mistakes immediately
// and prevent obviously-bad payloads from going over the wire.

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .email('Enter a valid email address.');

export const urlSchema = z
  .string()
  .trim()
  .url('Enter a valid URL (https://…).');

// Lead capture: name + email (name optional but trimmed)
export const leadCaptureSchema = z.object({
  name: z.string().trim().max(100, 'Name is too long.').optional(),
  email: emailSchema,
});
export type LeadCaptureInput = z.infer<typeof leadCaptureSchema>;

// Human handoff: email required, message optional bounded
export const handoffSchema = z.object({
  email: emailSchema,
  message: z.string().trim().max(2000, 'Message is too long.').optional(),
});
export type HandoffInput = z.infer<typeof handoffSchema>;

// Training form: at least one of url / text / file present is enforced at the
// call site; this schema validates the URL / text inputs themselves when used.
export const trainUrlSchema = urlSchema;
export const trainTextSchema = z
  .string()
  .trim()
  .min(10, 'Provide at least 10 characters of text.')
  .max(50_000, 'Text is too long (max 50,000 chars).');

// Admin custom-plan config — coerces strings from form inputs into numbers.
export const customPlanConfigSchema = z.object({
  plan_name: z.string().trim().min(1, 'Plan name is required.').max(60),
  monthly_price_usd: z.coerce.number().nonnegative('Price must be ≥ 0.'),
  max_bots: z.coerce.number().int().nonnegative(),
  max_messages: z.coerce.number().int().nonnegative(),
  max_chunks: z.coerce.number().int().nonnegative(),
  gemini_model: z.string().optional(),
  max_output_tokens: z.union([z.coerce.number().int().positive(), z.literal('').transform(() => undefined)]).optional(),
  human_handoff: z.boolean().optional(),
  lead_capture: z.boolean().optional(),
  white_label: z.boolean().optional(),
  webhook: z.boolean().optional(),
  custom_logo: z.boolean().optional(),
  analytics: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});
export type CustomPlanConfig = z.infer<typeof customPlanConfigSchema>;

// Helper: returns the first issue message from a Zod parse failure.
type ParseResult = { success: true; data: unknown } | { success: false; error: { issues: { message: string }[] } };
export function firstIssue(result: ParseResult): string | null {
  if (result.success) return null;
  return result.error.issues[0]?.message ?? 'Invalid input.';
}
