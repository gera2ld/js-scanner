import { cac } from 'https://cdn.jsdelivr.net/npm/cac@6.7.1/mod.ts';
import { WebScanner } from './scanner.ts';

const cli = cac('appx-scanner');

cli.command('<entry>')
.option('-r, --root <subtree>', 'Render subtree', {
  type: [String],
})
.action(async (entry: string, options: {
  root: string[],
}) => {
  const scanner = new WebScanner(entry, {
    roots: options.root,
  });
  await scanner.check();
});

cli.parse();
