import * as path from 'https://deno.land/std/path/mod.ts';
import { ensureDir } from 'https://deno.land/std/fs/mod.ts';

interface IPackage {
  entry: string;
  dependencies: string[];
}

interface IGraphNode {
  entry: string;
  name: string;
  weight: number;
}

export class WebScanner {
  root: string;
  packages: Map<string, IPackage>;
  roots: Set<string>;
  meta: {
    name?: string;
  };

  constructor(entry: string, options: {
    roots?: Iterable<string>;
  } = {}) {
    this.root = path.resolve(entry);
    this.packages = new Map();
    this.roots = new Set(options.roots ?? []);
    this.meta = {};
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
    if (!this.roots.size) this.roots = rootNodes;
    this.meta.name = rootPkgJson.name;
    await this.generateHierarchy();
    await this.analyze();
  }

  async generateHierarchy() {
    const rootNode = {
      v: this.meta.name,
      c: [],
      d: 0,
    };
    const rootPkg: IPackage = {
      entry: '',
      dependencies: Array.from(this.roots),
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
  
  async analyze() {
    const nodeMap = new Map<string, IGraphNode>();
    const links = [];
    for (const [, pkg] of this.packages) {
      const parts = pkg.entry.split('/');
      let name = parts.pop();
      if (name === 'index') name = parts.pop();
      nodeMap.set(pkg.entry, {
        name: name || '',
        entry: pkg.entry,
        weight: 0,
      });
      for (const dep of pkg.dependencies) {
        links.push([pkg.entry, dep]);
      }
    }
    for (const entries of links) {
      for (const entry of entries) {
        const node = nodeMap.get(entry);
        if (node) node.weight += 1;
      }
    }
    const nodes = Array.from(nodeMap.values());
    await this.render('graph', { nodes, links });
  }

  async render(key: string, data: any) {
    const template = await Deno.readTextFile(`templates/${key}.html`);
    await ensureDir('output');
    await Deno.writeTextFile(`output/${key}.html`, template.replace('{/* DATA */}', JSON.stringify(data)));
  }
}
