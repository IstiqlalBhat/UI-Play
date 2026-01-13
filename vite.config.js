import { defineConfig } from 'vite';
import typegpu from 'unplugin-typegpu/vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [typegpu()],
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),

        switch: resolve(__dirname, 'switch.html'),
        slider: resolve(__dirname, 'slider.html'),
      },
    },
  },
});
