import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// See https://wxt.dev/guide/essentials/unit-testing.html
export default defineConfig({
  plugins: [WxtVitest()],
});
