import fs from "node:fs";
import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import storybookTest from "@storybook/addon-vitest/vitest-plugin";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { playwright } from "@vitest/browser-playwright";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  const useHttps = process.env.HTTPS === "true";
  const certFile = process.env.SSL_CRT_FILE;
  const keyFile = process.env.SSL_KEY_FILE;

  const https =
    useHttps && certFile && keyFile
      ? {
          cert: fs.readFileSync(certFile),
          key: fs.readFileSync(keyFile),
        }
      : undefined;

  return {
    plugins: [react()],
    server: {
      host: process.env.HOST,
      port: process.env.PORT ? Number.parseInt(process.env.PORT, 10) : undefined,
      https,
      proxy: {
        "/api/peers/peerjs": {
          target: "http://localhost:3001",
          ws: true,
        },
        "/api": {
          target: "http://localhost:3001",
        },
      },
    },
    test: {
      environment: "node",
      globals: false,
      setupFiles: ["./src/setupTests.ts"],
      // Use `workspace` field in Vitest < 3.2
      projects: [
        {
          extends: true,
          plugins: [
            storybookTest({
              // The location of your Storybook config, main.js|ts
              configDir: path.join(dirname, ".storybook"),
              // This should match your package.json script to run Storybook
              // The --no-open flag will skip the automatic opening of a browser
              storybookScript: "npm run storybook -- --no-open",
            }),
          ],
          test: {
            name: "storybook",
            // Enable browser mode
            browser: {
              enabled: true,
              // Make sure to install Playwright
              provider: playwright({}),
              headless: true,
              instances: [{ browser: "chromium" }],
            },
            // setupFiles: ["./.storybook/vitest.setup.ts"],
          },
        },
      ],
    },
  } satisfies UserConfig;
});
