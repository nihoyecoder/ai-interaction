import { browser, defineBackground } from '#imports';

export default defineBackground(() => {
  // Make the toolbar button open the side panel.
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => console.error('Could not set side panel behavior', error));
});
