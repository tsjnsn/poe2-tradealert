import { defineConfig } from 'vite'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// const neutralino = () => {
//   let config;

//   return {
//     name: 'neutralino',

//     configResolved(resolvedConfig) {
//       config = resolvedConfig;
//     },

//     async transformIndexHtml(html) {
//       const regex =
//         /<script src="http:\/\/localhost:(\d+)\/__neutralino_globals\.js"><\/script>/;

//       if (config.mode === 'production') {
//         return html.replace(
//           regex,
//           '<script src="%PUBLIC_URL%/__neutralino_globals.js"></script>'
//         );
//       }

//       if (config.mode === 'development') {
//         const auth_info_file = await fs.readFile(
//           path.join(__dirname, 'auth_info.json'),
//           {
//             encoding: 'utf-8',
//           }
//         );

//         const auth_info = JSON.parse(auth_info_file);
//         const port = auth_info.port;

//         return html.replace(
//           regex,
//           `<script src="http://localhost:1240/__neutralino_globals.js"></script>`
//         );
//       }

//       return html;
//     },
//   };
// };

export default defineConfig({
  plugins: [],
  root: 'src/web',
  base: './',
  build: {
    sourcemap: true,
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
    }
  },
  server: {
    port: 1240,
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
