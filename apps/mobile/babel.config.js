module.exports = {
  presets: ["babel-preset-expo"],
  plugins: [
    [
      "module-resolver",
      {
        root: ["../../"],
        alias: {
          "@pokington/ui": "../../packages/ui/src/index.ts",
          "@pokington/network": "../../packages/network/src/index.ts",
          "@pokington/config": "../../packages/config/src/index.ts",
        },
      },
    ],
  ],
};
