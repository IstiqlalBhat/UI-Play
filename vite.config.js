import { defineConfig } from 'vite';
import typegpu from 'unplugin-typegpu/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [typegpu()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        switch: resolve(__dirname, 'switch.html'),
        slider: resolve(__dirname, 'slider.html'),
      },
    },
  },
});
