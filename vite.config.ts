import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import gridLabs from './plugins/gridlabs';

export default defineConfig({
  plugins: [react(), gridLabs()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  define: {
    'process.env.VITE_COMMIT_SHA': JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA ?? ''
    ),
    'process.env.VITE_APP_NAME': JSON.stringify('GridLabs'),
  },
});
