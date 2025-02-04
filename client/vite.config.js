import { defineConfig } from 'vite'
import { fileURLToPath } from 'url'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [tailwindcss()],
  root: 'src/web',
  base: './',
  publicDir: 'dist',
  build: {
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: 'terser',
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/web/index.html'),
        auth: path.resolve(__dirname, 'src/web/auth.html')
      },
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          const ext = path.extname(assetInfo.name).slice(1)
          if (/html/i.test(ext)) {
            return '[name].[ext]'
          }
          return `assets/[name].[hash].[ext]`
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  optimizeDeps: {
    include: ['@tailwindcss/vite'],
    exclude: []
  }
})
