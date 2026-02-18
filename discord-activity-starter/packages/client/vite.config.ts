import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
	envDir: '../../',
	server: {
		allowedHosts: [
      'optimization-stated-buck-interventions.trycloudflare.com'
    ],
		port: 3000,
		proxy: {
			'/api': {
				target: 'http://localhost:3001',
				changeOrigin: true,
				secure: false,
				ws: true,
			},
		},
		hmr: {
			clientPort: 443,
		},
	},
});
