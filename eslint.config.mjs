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
  {
    // These two rules ship with eslint-config-next v16 (React 19 compiler-aware
    // rules). The codebase has pre-existing violations that are tracked
    // separately and should be addressed in dedicated refactors. They are
    // downgraded to warnings here so `npm run lint` runs to completion and can
    // be used to enforce new rules going forward.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
    },
  },
];

export default eslintConfig;
