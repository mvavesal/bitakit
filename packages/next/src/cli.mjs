#!/usr/bin/env node
// Deprecated: use "bitakit generate" from @bitakit/cli. Kept so older scripts keep working.
import { generateBitaKit } from '@bitakit/discovery';
await generateBitaKit(process.cwd());
