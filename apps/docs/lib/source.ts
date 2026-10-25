import { llms, loader } from 'fumadocs-core/source';
import { docsRoute } from './shared';
import { defineDocs } from 'fumadocs-mdx/macro';
import { applyMdxPreset } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    // The default Fumadocs preset; ```npm blocks become npm/pnpm/yarn/bun tabs, and the reader's
    // choice is remembered across pages.
    mdxOptions: applyMdxPreset({ remarkNpmOptions: { persist: { id: 'package-manager' } } }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
});

export const docsLlms = llms(source, {
  renderPage: async (
    page,
  ) => `# ${page.data.title} (${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${page.url})

${await page.data.getText('processed')}`,
});
