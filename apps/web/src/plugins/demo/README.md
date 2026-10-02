# Demo plugin without a database

The plugin brings its own components. The app only provides the shared dashboard slot and
the existing settings frame.

- `ui/slots/dashboard.content.tsx`: contribution to the `dashboard.content` slot.
- `ui/components/`: the plugin's own settings page.
- `setup.ts`: registers that page in the settings catalog under "Plugins"; the plugin scope
  removes it again.
- `actions/`: greeting, local toggle, dashboard link and settings link in the user menu.
- `services/preferences.ts`: local preference without a database; resets on reload.
- `locales/`: German and English texts.

`plugins.overrides.demo.enabled` in `apps/web/bitakit.config.ts` activates the plugin. With
`false` the card, the settings page and every menu entry disappear. Removing the plugin folder
removes the same discovered contributions.
