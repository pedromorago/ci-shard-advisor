#!/usr/bin/env -S npx tsx
import { readFileSync } from 'node:fs';
import { run } from './cli';

const exitCode = run(process.argv.slice(2), {
  readFile: (path) => readFileSync(path, 'utf8'),
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
});

process.exit(exitCode);
