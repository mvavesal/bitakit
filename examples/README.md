# Sample apps

Complete BitaKit apps, from the smallest feature to several plugins working together. Each
folder is a normal Next.js app created with `@bitakit/create-app`, plus the files its README
lists. Copy one folder anywhere, install and run it; it uses the published packages.

| App                    | You learn                                                                           | Plugins |
| ---------------------- | ----------------------------------------------------------------------------------- | ------- |
| [counter](counter)     | A plugin with a page, a service and two Actions                                     | 1       |
| [todo](todo)           | Lists, Actions with input, confirmation and messages, the Shell frame, Quick Search | 1       |
| [settings](settings)   | Plugin and app settings, the generated Settings page, a custom page body            | 1       |
| [theme](theme)         | App themes as JSON files and switching them                                         | 1       |
| [layouts](layouts)     | Layout families, a new family, your own not-found and error screens                 | 3       |
| [workspace](workspace) | Events, slots, interceptors and a search source across four plugins                 | 4       |

```sh
cd examples/todo
npm install
npm run dev
```

Every plugin folder has an `AGENTS.md` that introduces it: what it owns, the contracts it
offers or uses and how to check it (`CLAUDE.md` beside it only imports that file).

The documentation explains each idea step by step: [Sample apps](https://github.com/mvavesal/bitakit/blob/main/apps/docs/content/docs/examples.mdx).

Maintainers: `npm run verify:examples` installs every app from freshly packed packages and
checks type safety, doctor, the production build and a browser walk-through of its README.
