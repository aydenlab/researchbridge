import { z } from "zod";

export function arrayField<T extends z.ZodTypeAny>(
  inner: T,
  options: { min?: number; max?: number; message?: string } = {},
) {
  let array = z.array(inner);
  if (options.min !== undefined) array = array.min(options.min, options.message);
  if (options.max !== undefined) array = array.max(options.max);

  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return [];
    return Array.isArray(value) ? value : [value];
  }, array);
}
