import fs from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
      : useHttps;

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
      globals: true,
      setupFiles: ["./src/setupTests.ts"],
    },
  };
});
