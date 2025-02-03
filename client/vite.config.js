import { defineConfig } from 'vite'
import { fileURLToPath } from 'url'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [tailwindcss()],
  root: 'src/web',
  base: './',
  build: {
    sourcemap: true,
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/web/index.html'),
        auth: path.resolve(__dirname, 'src/web/auth.html')
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
