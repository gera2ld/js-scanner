// @deno-types="https://unpkg.com/cac/mod.d.ts"
import { cac } from 'https://unpkg.com/cac/mod.js';
import { WebScanner } from './scanner.ts';

const cli = cac('appx-scanner');

cli.command('<entry>')
.action(async (entry: string) => {
  const scanner = new WebScanner(entry);
  await scanner.check();
});

cli.parse();
