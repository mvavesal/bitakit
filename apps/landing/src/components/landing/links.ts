/** Where the docs are served. Set NEXT_PUBLIC_DOCS_URL in each deployment. */
export const docsUrl = (process.env.NEXT_PUBLIC_DOCS_URL ?? 'http://localhost:3002').replace(
  /\/$/,
  '',
);

export const links = {
  github: 'https://github.com/mvavesal/bitakit',
  quickstart: `${docsUrl}/docs/quickstart`,
  docs: `${docsUrl}/docs`,
  why: `${docsUrl}/docs/why-bitakit`,
  research: `${docsUrl}/docs/motivation`,
  samples: `${docsUrl}/docs/examples`,
  agents: `${docsUrl}/docs/guides/ai-agents`,
};
