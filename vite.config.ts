import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/anakhebat/', // Important for GitHub Pages repository path
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
            input: {
                main: 'index.html',
                login: 'login.html',
                dashboard: 'dashboard.html'
            }
        }
    }
})
