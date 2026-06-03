import {existsSync} from "node:fs";

import {Config} from "@remotion/cli/config";

const localChromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

Config.setPublicDir("public");
Config.setForceNewStudioEnabled(true);
if (existsSync(localChromePath)) {
  Config.setBrowserExecutable(localChromePath);
}
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    extensionAlias: {
      ...config.resolve?.extensionAlias,
      ".js": [".ts", ".tsx", ".js"]
    }
  }
}));
