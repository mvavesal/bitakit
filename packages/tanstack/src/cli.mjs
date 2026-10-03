#!/usr/bin/env node
// Deprecated: use "bitakit generate" from @bitakit/cli. Kept so older scripts keep working.
import { generateFoundation } from '@bitakit/discovery';
await generateFoundation(process.cwd());
