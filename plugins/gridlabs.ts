// plugins/gridlabs.ts
import { Plugin, normalizePath } from 'vite';
import fg from 'fast-glob';
import path from 'node:path';

const VIRTUAL_ID = 'virtual:gridlabs-map';
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID;

export interface GridItem {
  id: number;
  file: string;          // absolute path
  route: string;         // /__grid/preview?id={id}
  name: string;          // component / file name
}

export default function gridLabs(): Plugin {
  let root = '';
  let items: GridItem[] = [];

  const scanFiles = async () => {
    // look for any .tsx/.jsx under src excluding __grid itself
    const files = await fg('src/**/!(__grid)/**/*.{tsx,jsx}', { cwd: root });
    items = files.map((f, i) => ({
      id: i,
      file: normalizePath(path.join(root, f)),
      route: `/__grid/preview?id=${i}`,
      name: path.basename(f),
    }));
    return `export default ${JSON.stringify(items, null, 2)};`;
  };

  return {
    name: 'vite-plugin-gridlabs',
    enforce: 'pre',

    configResolved(cfg) {
      root = cfg.root;
    },

    async resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
    },

    async load(id) {
      if (id === RESOLVED_VIRTUAL_ID) {
        return await scanFiles();
      }
    },

    async handleHotUpdate(ctx) {
      const { file, server } = ctx;
      if (!/\.(tsx|jsx)$/.test(file)) return;

      // Re-scan, update the virtual module, and trigger HMR
      const code = await scanFiles();
      server.moduleGraph.invalidateModule(
        server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID)!
      );
      return [
        server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID)!,
        ...ctx.modules,
      ].map((m) => ({ ...ctx, file: m.id!, modules: [m] }));
    },
  };
}