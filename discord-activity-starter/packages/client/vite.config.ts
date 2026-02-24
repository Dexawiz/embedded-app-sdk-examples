import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
	envDir: '../../',
	server: {
		allowedHosts: true,
		port: 3000,
		strictPort: true,
		proxy: {
			'/api': {
				target: 'http://localhost:3001',
				changeOrigin: true,
				secure: false,
				ws: true,
			},
		},
		hmr: {
			protocol: 'ws',    
     		host: 'localhost',  
     		port: 3000,
		},
	},
});
