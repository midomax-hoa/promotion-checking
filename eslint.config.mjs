import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Vendored internal import software, kept for reference only.
      "check-promotion/**",
      // Prisma generated client.
      "src/generated/**",
      // AI assistant workspaces - local tooling, not project source.
      ".claude/**",
      ".opencode/**",
      ".agents/**",
      ".agent/**",
      ".cursor/**",
    ],
  },
];

export default eslintConfig;
