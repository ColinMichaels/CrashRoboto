import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const APP_CHUNK_BUDGET_KB = 500;
const PHASER_CHUNK_BUDGET_KB = 1_400;
const PHASER_CHUNK_NAME = 'phaser-runtime';

function getUtf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function enforceChunkBudgets(): Plugin {
  return {
    name: 'crash-roboto-chunk-budgets',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        const budgetKb = output.name === PHASER_CHUNK_NAME
          ? PHASER_CHUNK_BUDGET_KB
          : APP_CHUNK_BUDGET_KB;
        const sizeKb = getUtf8ByteLength(output.code) / 1_000;
        if (sizeKb > budgetKb) {
          this.error(
            `${output.fileName} is ${sizeKb.toFixed(2)} kB, exceeding its ${budgetKb} kB bundle budget.`,
          );
        }
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), enforceChunkBudgets()],
  build: {
    target: 'es2022',
    // Phaser is intentionally deferred until match launch. Its dedicated budget keeps
    // Vite's generic warning useful without allowing application chunks to grow unchecked.
    chunkSizeWarningLimit: PHASER_CHUNK_BUDGET_KB,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/phaser/')) return PHASER_CHUNK_NAME;
        },
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
