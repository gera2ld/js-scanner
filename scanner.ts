import * as path from 'https://deno.land/std/path/mod.ts';
import { ensureDir } from 'https://deno.land/std/fs/mod.ts';

interface IPackage {
  entry: string;
  dependencies: string[];
}

export class WebScanner {
  root: string;
  packages: Map<string, IPackage>;
  roots: Set<string>;

  constructor(entry: string, options: {
    roots?: Iterable<string>;
  } = {}) {
    this.root = path.resolve(entry);
    this.packages = new Map();
    this.roots = new Set(options.roots ?? []);
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
        dependencies: Object.keys(packageJson.dependencies || {}),
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
      dependencies: Array.from(this.roots || rootNodes),
    };
    const cache = new Map();
    const queue: [{ pkg: IPackage, node: any, ancesters: Set<string> }] = [{
      pkg: rootPkg,
      node: rootNode,
      ancesters: new Set(),
    }];
    while (queue.length) {
      const { pkg, node, ancesters } = queue.shift()!;
      pkg.dependencies?.forEach(dep => {
        let childNode;
        const childDepth = node.d + 1;
        if (cache.has(dep)) {
          childNode = cache.get(dep);
        } else if (ancesters.has(dep)) {
          // Circular dependency detected
          childNode = {
            v: `<span class="danger">[Circular] ${dep}</span>`,
            c: [],
            d: childDepth,
          };
        } else {
          const child = this.packages.get(dep);
          if (child) {
            childNode = {
              v: dep,
              c: [],
              d: childDepth,
              p: { f: childDepth > 1 },
            };
            const childAncesters = new Set(ancesters);
            childAncesters.add(dep);
            queue.push({ pkg: child, node: childNode, ancesters: childAncesters });
          } else {
            // childNode = {
            //   v: `<span class="external">${dep}</span>`,
            //   c: [],
            //   d: childDepth,
            //   p: {
            //     f: true,
            //   },
            // };
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
