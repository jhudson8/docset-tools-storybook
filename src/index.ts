import { Plugin, DocsetEntries } from "docset-tools-types";
import { existsSync } from "fs-extra";
import { join } from "path";
var exec = require("child-process-promise").exec;

const DEFAULT_STORYBOOK_DIR = "storybook-static";

const plugin: Plugin = {
  execute: async function ({ createTmpFolder, include, pluginOptions }) {
    const storybookDir = pluginOptions.storybookDir || DEFAULT_STORYBOOK_DIR;
    await exec(
      `node ${
        (join(process.cwd()),
        "node_modules/@storybook/react/dist/server/build.js")
      } -s public`
    );
    await exec(
      `node ${
        (join(process.cwd()), "node_modules/@storybook/cli/bin/index.js")
      } extract`
    );

    const storybookDirPath = join(process.cwd(), storybookDir);
    const storybookMetaPath = join(storybookDirPath, "stories.json");
    const exists = existsSync(storybookMetaPath);
    if (!exists) {
      throw new Error("Could not create storybook artifacts");
    }
    const rtn: DocsetEntries = {
      Component: {},
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
        rtn.Component[path] = url;
      }
    }

    await include({
      path: storybookDirPath,
      rootDirName: "storybook",
      appendToBottom: {
        ["index.html"]: `
          <style>
            .css-sqdry3, .css-sqdry3 + div {
              left: 0 !important;
              width: 100% !important;
            }
            .react-draggable {
              display: none !important;
          }
          </style>
          `,
      },
    });

    return {
      entries: rtn,
    };
  },
};
export default plugin;
