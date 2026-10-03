import { z } from 'zod';

/** A theme preset: CSS a host or package ships under `[data-theme-preset="<id>"]`. */
export type ShellPreset = { id: string; label?: string };
export type ShellOptions = {
  /** Navigation action groups the frame renders, in order. Default `['navigation']`. */
  groups?: readonly string[];
  /** Theme presets offered next to `default` in the Appearance settings. */
  presets?: readonly ShellPreset[];
};

/**
 * The Shell options, for example as the schema of `configs/shell.ts`. Unknown keys are
 * rejected, so options that no longer exist fail with their name.
 */
export const shellOptions: z.ZodType<ShellOptions, ShellOptions> = z.strictObject({
  groups: z.array(z.string()).readonly().optional(),
  presets: z
    .array(z.strictObject({ id: z.string(), label: z.string().optional() }))
    .readonly()
    .optional(),
});

/** Validates the factory input and names the first invalid key. */
export function parseShellOptions(options: unknown): ShellOptions {
  const result = shellOptions.safeParse(options ?? {});
  if (result.success) return result.data;
  const issue = result.error.issues[0]!;
  const path = issue.path.map(String).join('.');
  if (issue.code === 'unrecognized_keys') {
    const keys = issue.keys.map((key) => `"${path ? `${path}.` : ''}${key}"`).join(', ');
    throw new Error(
      `Unknown Shell option ${keys}.${path ? '' : ' Supported options: groups, presets.'}`,
    );
  }
  throw new Error(
    path
      ? `Invalid Shell option "${path}": ${issue.message}`
      : `Invalid Shell options: ${issue.message}`,
  );
}
