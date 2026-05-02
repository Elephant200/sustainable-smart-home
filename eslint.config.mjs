import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "node_modules/**",
      ".local/**",
      ".cache/**",
      ".turbo/**",
      ".vercel/**",
      ".upm/**",
      ".config/**",
      "coverage/**",
      "public/**",
      "supabase/**",
      "next-env.d.ts",
      "tsconfig.tsbuildinfo",
    ],
  },
];

export default eslintConfig;
