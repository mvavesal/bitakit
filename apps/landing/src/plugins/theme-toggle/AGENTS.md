# Theme toggle playground plugin

Contributes one standard icon button to `shell.header.end`, after Quick Search and before
the activity badge. Depends on Shell and reads/writes its existing `shell.mode` setting
through `useSetting`. When mode is system, the click uses the current browser preference
to choose the opposite explicit mode. Disabling this plugin removes only its button.

Keep this sample small: no service, forwarding Action, theme provider or duplicate state.
Use the standard Button, Reicon Outline and matching English/German accessible labels.
Sun/Moon icons and their accessible labels describe the destination mode, as on the website.
The Shell-only slot keeps the control out of the standalone marketing return banner.

Shared app conventions are in `../../../AGENTS.md`. Verify with the landing typecheck and
exercise toggling, inspector synchronization and disable/enable in both Shell layouts.
