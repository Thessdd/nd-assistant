import { z } from "zod";

export const ProfileSchema = z.object({
  neurotypes: z
    .array(z.enum(["adhd", "autism", "dyslexia", "anxiety", "unspecified"]))
    .max(5)
    .optional(),
  response_length: z.enum(["very_short", "normal", "detailed"]).optional(),
  name: z.string().trim().max(60).optional()
});

export type Profile = z.infer<typeof ProfileSchema>;

