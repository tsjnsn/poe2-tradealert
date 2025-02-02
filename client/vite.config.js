import { defineConfig } from 'vite'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const neutralino = () => {
  let config;

  return {
    name: 'neutralino',

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    async transformIndexHtml(html) {
      const regex =
        /<script src="http:\/\/localhost:(\d+)\/__neutralino_globals\.js"><\/script>/;

      if (config.mode === 'production') {
        return html.replace(
          regex,
          '<script src="%PUBLIC_URL%/__neutralino_globals.js"></script>'
        );
      }

      if (config.mode === 'development') {
        const auth_info_file = await fs.readFile(
          path.join(_dirname, '..', '.tmp', 'auth_info.json'),
          {
            encoding: 'utf-8',
          }
        );

        const auth_info = JSON.parse(auth_info_file);
        const port = auth_info.nlPort;

        return html.replace(
          regex,
          `<script src="http://localhost:${port}/__neutralino_globals.js"></script>`
        );
      }

      return html;
    },
  };
};

export default defineConfig({
  plugins: [neutralino()],
  root: 'src/web',
  base: './',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/web/index.html')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          if (/html/i.test(ext)) {
            return '[name].[ext]'
          }
          return 'assets/[name].[hash].[ext]'
        }
      }
    },
    define: {
      'window.NL_ARGS': JSON.stringify([]),
      'window.NL_PATH': JSON.stringify('/'),
      'window.NL_CVERSION': JSON.stringify('1.0.0')
    }
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      usePolling: true
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
}) 