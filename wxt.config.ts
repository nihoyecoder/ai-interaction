import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  // Import WXT APIs explicitly from '#imports' so every file shows where names come from.
  imports: false,
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'AI Interaction',
    description: 'See an interaction you love. Capture it. Recreate it with AI.',
    // The toolbar button. Clicking it opens the side panel (see background.ts).
    action: {
      default_title: 'Open AI Interaction',
    },
    permissions: ['sidePanel'],
  },
});
