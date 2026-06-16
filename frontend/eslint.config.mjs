import eslintConfigNext from "eslint-config-next";

export default [
  ...eslintConfigNext,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
