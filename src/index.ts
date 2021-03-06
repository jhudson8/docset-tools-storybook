import { Plugin, DocsetEntries, getKnownType } from "docset-tools-types";
import { existsSync } from "fs-extra";
import { join } from "path";

const DEFAULT_STORYBOOK_DIR = "storybook-static";

const plugin: Plugin = {
  execute: async function ({ include, pluginOptions }) {
    const docsetType = pluginOptions.docsetType
      ? getKnownType(pluginOptions.docsetType)
      : "Component";
    const storybookDir = pluginOptions.storybookDir || DEFAULT_STORYBOOK_DIR;
    try {
      await spawn("node", [
        join(
          process.cwd(),
          "node_modules/@storybook/react/dist/server/build.js"
        ),
        "-s",
        "public",
        "--docs",
      ]);
      await spawn("node", [
        join(process.cwd(), "node_modules/@storybook/cli/bin/index.js"),
        "extract",
      ]);
    } catch (e) {
      throw new Error(
        "Unable to get storybook output our metadata.\n\t" +
          "Make sure you have storybook >= 6 AND @storybook/react >= 6\n\t\t" +
          "Try running commands below directly and see if there are any errors and make sure you are using storybook >= 6\n\t\t" +
          "node node_modules/@storybook/react/dist/server/build.js -s public\n\t\t" +
          "node node_modules/@storybook/cli/bin/index.js extract\n\t" +
          "if extract doesn't work and you are behind a firewall, the PUPPETEER_ env variables will not work unless you modify `resolveExecutablePath` in puppeteer-core/lib/Launcher.js\n\t" +
          "change if block to `if (!launcher._isPuppeteerCore || true)` and set PUPPETEER_EXECUTABLE_PATH environment variable to Chrome executable location"
      );
    }

    const storybookDirPath = join(process.cwd(), storybookDir);
    const storybookMetaPath = join(storybookDirPath, "stories.json");
    const exists = existsSync(storybookMetaPath);
    if (!exists) {
      throw new Error("Could not create storybook artifacts");
    }
    const rtn: DocsetEntries = {
      [docsetType]: {},
    };

    const storybookMeta = require(storybookMetaPath) as any;
    const stories = Object.values(storybookMeta.stories);
    for (let i = 0; i < stories.length; i++) {
      const storyMeta = stories[i] as any;
      if (!storyMeta.kind.match(/Example\/Introduction/i)) {
        const url = `storybook/index.html?path=/story/${storyMeta.id}`;
        const path = `${storyMeta.kind.replace(/^examples?\//i, "")}/${
          storyMeta.name
        }`;
        (rtn as any)[docsetType][path] = url;
      }
    }

    const storybookSettings = `
    <script>
      sessionStorage.setItem('@storybook/ui/store', JSON.stringify({
        layout: {
          initialActive: 'canvas',
          isToolShown: true,
          isFullscreen: false,
          showPanel: true,
          showNav: false
        }
      }))
    </script>
    `;

    await include({
      path: storybookDirPath,
      remove: true,
      rootDirName: "storybook",
      appendToBottom: {
        ["index.html"]: storybookSettings,
        ["iframe.html"]: storybookSettings,
      },
    });

    return {
      entries: rtn,
    };
  },
};
export default plugin;

function spawn(exec: string, args: string[]) {
  const _spawn = require("child-process-promise").spawn;

  var promise = _spawn(exec, args);
  var childProcess = promise.childProcess;

  childProcess.stdout.on("data", function (data: any) {
    // console.log("[storybook]: ", data.toString());
  });
  childProcess.stderr.on("data", function (data: any) {
    // console.log("[storybook] error: ", data.toString());
  });
  return promise;
}
