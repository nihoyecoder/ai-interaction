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
    // The toolbar button. Clicking it opens the side panel and grants temporary access to the tab (see background.ts).
    action: {
      default_title: 'Open AI Interaction',
    },
    // sidePanel: show our panel.
    // activeTab: temporary access to a tab, granted only when the user clicks our toolbar button.
    // scripting: inject the inspector into that tab when the user clicks Connect.
    permissions: ['sidePanel', 'activeTab', 'scripting'],
  },
});
