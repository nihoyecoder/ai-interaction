import { defineUnlistedScript } from '#imports';
import { startInspector } from '@/inspector/inspector';

// Injected into one tab by the side panel, only after the user clicks Connect.
// It's an unlisted script, so it's never declared in the manifest.
export default defineUnlistedScript(() => {
  startInspector();
});
