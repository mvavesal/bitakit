#!/usr/bin/env node
import { generateFoundationHost } from '@bitakit/core/discovery';
await generateFoundationHost(process.cwd());
