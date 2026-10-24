# Lab

Pages that show Shell's other frames: `/lab` in `full-page`, `/lab/crash` for the error screen.

## Public contracts

- `lab.crash` links to `/lab/crash` in `shell.navigation`.
- `/lab/crash` throws on purpose after its button is pressed, so `src/ui/slots/screen.error.tsx`
  renders.

## Constraints and checks

The crash is intentional and logged to the console. Open `/lab/crash`, press "Break this page"
and expect "That did not work" with "Try again".
