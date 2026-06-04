module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // reanimated/worklets 플러그인은 SDK 54의 babel-preset-expo가 자동 처리하므로 추가하지 않음
    plugins: [],
  };
};
