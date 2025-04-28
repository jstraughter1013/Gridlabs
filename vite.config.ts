import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import gridLabs from './plugins/gridlabs';

export default defineConfig({
  plugins: [react(), gridLabs()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
