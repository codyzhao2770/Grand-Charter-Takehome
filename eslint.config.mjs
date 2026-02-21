import nextConfig from "eslint-config-next";

export default [
  ...nextConfig,
  {
    ignores: ["src/generated/**"],
  },
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "import/no-anonymous-default-export": "off",
    },
  },
];
