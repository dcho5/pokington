module.exports = {
  presets: ["babel-preset-expo"],
  plugins: [
    [
      "module-resolver",
      {
        root: ["../../"],
        alias: {
          "@pokington/ui": "../../packages/ui/src",
          "@pokington/ui/native": "../../packages/ui/src/native.ts",
          '@pokington/ui/web': '../../packages/ui/src/web.ts',
          "@pokington/network": "../../packages/network/src/index.ts",
          "@pokington/config": "../../packages/config/src/index.ts",
        },
      },
    ],
  ],
};
