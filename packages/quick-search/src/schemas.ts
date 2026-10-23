import { z } from 'zod';
import type { SearchSource } from './types.js';

export const searchTextSchema = z.union([
  z.string(),
  z.object({ key: z.string(), fallback: z.string() }),
]);
export const searchSourceSchema = z.object({
  title: searchTextSchema,
  description: searchTextSchema,
  category: z.object({ id: z.string(), title: searchTextSchema }),
  defaultEnabled: z.boolean(),
  search: z.custom<SearchSource['search']>((value) => typeof value === 'function'),
  resolve: z.custom<SearchSource['resolve']>((value) => typeof value === 'function'),
});
export const searchResultSchema = z.union([
  z.object({
    id: z.string(),
    actionId: z.string(),
    keywords: z.array(z.string()).optional(),
    detail: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    title: z.string(),
    href: z.string(),
    description: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  }),
]);
export const historySchema = z.object({
  queries: z.array(z.object({ query: z.string(), organizationId: z.string().nullable() })),
  results: z.array(
    z.object({ sourceId: z.string(), resultId: z.string(), organizationId: z.string().nullable() }),
  ),
});
export type SearchHistory = z.infer<typeof historySchema>;
export const emptyHistory: SearchHistory = { queries: [], results: [] };
