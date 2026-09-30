#!/usr/bin/env node
import { generateFoundation } from './generate.mjs';
await generateFoundation(process.cwd());
