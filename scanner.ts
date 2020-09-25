import * as path from 'https://deno.land/std/path/mod.ts';
import { ensureDir } from 'https://deno.land/std/fs/mod.ts';

interface IPackage {
  entry: string;
  dependencies: string[];
  external: boolean;
}

export class WebScanner {
  root: string;
  packages: Map<string, IPackage>;

  constructor(entry: string) {
    this.root = path.resolve(entry);
    this.packages = new Map();
  }

  async check() {
    for await (const item of Deno.readDir(this.root)) {
      let packageJson: any;
      try {
        packageJson = JSON.parse(await Deno.readTextFile(path.join(this.root, item.name, 'package.json')));
      } catch {
        // ignore
      }
      if (!packageJson) continue;
      this.packages.set(packageJson.name, {
        entry: packageJson.name,
        dependencies: Object.keys(packageJson.dependencies),
        external: false,
      });
    }
    const rootNodes = new Set(this.packages.keys());
    for (const item of this.packages.values()) {
      item.dependencies.forEach(name => {
        rootNodes.delete(name);
      });
    }
    let rootDir = this.root;
    let rootPkgJson;
    while (rootDir) {
      let text;
      try {
        text = await Deno.readTextFile(path.join(rootDir, 'package.json'));
      } catch {
        const parentDir = path.dirname(rootDir);
        if (rootDir === parentDir) break;
        rootDir = parentDir;
        continue;
      }
      rootPkgJson = JSON.parse(text);
      break;
    }
    const rootNode = {
      v: rootPkgJson?.name,
      c: [],
      d: 0,
    };
    const rootPkg: IPackage = {
      entry: '',
      dependencies: Array.from(rootNodes),
      external: false,
    };
    const cache = new Map();
    const queue: [{ pkg: IPackage, node: any }] = [{ pkg: rootPkg, node: rootNode }];
    while (queue.length) {
      const { pkg, node } = queue.shift()!;
      pkg.dependencies?.forEach(dep => {
        let childNode;
        if (cache.has(dep)) {
          childNode = cache.get(dep);
        } else {
          const child = this.packages.get(dep);
          if (child) {
            const { entry } = child;
            childNode = {
              v: entry,
              c: [],
              d: node.d + 1,
            };
            queue.push({ pkg: child, node: childNode });
          }
        }
        if (childNode) node.c.push(childNode);
      });
    }
    await this.render('hierarchy', rootNode);
  }

  async render(key: string, data: any) {
    const template = await Deno.readTextFile(`templates/${key}.html`);
    await ensureDir('output');
    await Deno.writeTextFile(`output/${key}.html`, template.replace('{/* DATA */}', JSON.stringify(data)));
  }
}
