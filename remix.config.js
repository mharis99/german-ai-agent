// require("dotenv").config();

// /** @type {import('@remix-run/dev').AppConfig} */
// module.exports = {
//   appDirectory: "app",
//   assetsBuildDirectory: "public/build",
//   publicPath: "/build/",
//   serverBuildPath: "build/index.js",
//   devServerPort: 8002,
//   ignoredRouteFiles: ["**/.*"],
// };

/** @type {import('@remix-run/dev').AppConfig} */
export default {
  ignoredRouteFiles: ["**/.*"],
  tailwind: true,
};