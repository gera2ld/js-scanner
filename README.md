# js-scanner

Scan dependencies among JavaScript packages.

This is useful to get the topological relation graph of packages in a monorepo.

## Usage

Make sure [Deno](https://deno.land/) is properly installed.

Run the command below:

```sh
$ deno run --unstable -A https://raw.githubusercontent.com/gera2ld/js-scanner/master/main.ts <packagesDir>
```

Note: `<packagesDir>` is the directory containing the packages to be scanned.
