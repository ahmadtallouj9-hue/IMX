import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/socket.io': { target: 'http://localhost:8080', ws: true },
      '/auth': 'http://localhost:8080',
      '/users': 'http://localhost:8080',
      '/conversations': 'http://localhost:8080',
      '/groups': 'http://localhost:8080',
      '/uploads': 'http://localhost:8080',
      '/health': 'http://localhost:8080',
      '/search': 'http://localhost:8080',
      '/notifications': 'http://localhost:8080',
      '/friends': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
