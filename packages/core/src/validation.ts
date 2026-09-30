import type { Fields } from './definitions.js';
export function validateFields(fields: Fields, input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object') throw new Error('Invalid form input.');
  const values: Record<string, string> = Object.create(null);
  for (const [name, field] of Object.entries(fields)) {
    const value = (input as Record<string, unknown>)[name];
    if (typeof value !== 'string' || (field.required && !value.trim()))
      throw new Error(`Invalid field: ${name}`);
    if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      throw new Error(`Invalid email: ${name}`);
    if (field.type === 'select' && !field.options?.some((option) => option.value === value))
      throw new Error(`Invalid option: ${name}`);
    values[name] = value;
  }
  return values;
}
