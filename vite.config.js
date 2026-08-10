import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

function copyRootAssets() {
  return {
    name: 'copy-root-assets',
    closeBundle() {
      const filesToCopy = ['manifest.json', 'sw.js'];
      for (const file of filesToCopy) {
        if (fs.existsSync(file)) {
          fs.copyFileSync(file, path.join('dist', file));
        }
      }
      if (fs.existsSync('assets')) {
        fs.cpSync('assets', path.join('dist', 'assets'), { recursive: true });
      }
    }
  };
}

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
  },
  plugins: [copyRootAssets()],
});
