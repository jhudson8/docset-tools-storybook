import { Plugin, DocsetEntries, getKnownType } from "docset-tools-types";
import { existsSync, mkdirSync, statSync, readdirSync, readFile, readFileSync, writeFileSync } from "fs-extra";
import { join } from "path";
import rimraf from 'rimraf';
import parseStoryModule, { StoryDetails } from "./storyParser";

const DEFAULT_STORYBOOK_BUILD_DIR = "storybook-static";
const DEFAULT_STORYBOOK_SOURCE_DIR = "stories";

const plugin: Plugin = {
  execute: async function ({ include, pluginOptions }) {
    const storybookDir = pluginOptions.storybookBuildDir || DEFAULT_STORYBOOK_BUILD_DIR;
    const storybookSrcDir = pluginOptions.storybookSrcDir || DEFAULT_STORYBOOK_SOURCE_DIR;
    const storybookTmpPath = join(process.cwd(), 'storybook-static');
    const storybookDirPath = join(process.cwd(), storybookDir);
    const storybookMetaPath = join(storybookDirPath, "stories.json");
    let storybookMetaRetrieved = false;

    let cliPath = 'node_modules/storybook/node_modules/@storybook/cli/bin/index.js';
    if (!existsSync(join(process.cwd(), cliPath))) {
      cliPath = join(process.cwd(), 'node_modules/@storybook/cli/bin/index.js');
    }

    try {
      const docsetType = pluginOptions.docsetType
        ? getKnownType(pluginOptions.docsetType)
        : "Component";

      try {
        // make the storybook-static dir
        if (!existsSync(storybookTmpPath)){
          mkdirSync(storybookTmpPath);
        }

        await spawn("node", [
          join(
            process.cwd(),
            "node_modules/@storybook/react/bin/build.js"
          ),
          "-o",
          "storybook-static"
        ]);

        // try {
        //   await spawn("node", [
        //     join(process.cwd(), cliPath),
        //     "extract",
        //   ]);
        //   storybookMetaRetrieved = true;
        // } catch (e) {
        //   // parse the file by hand
        //   const srcFolder = join(process.cwd(), storybookSrcDir);
        //   const stories = getStories(srcFolder);
        //   if (stories.length === 0 && !pluginOptions.force) {
        //     throw e;
        //   } else {
        //     const normalizePart = (s: string) => {
        //       return s.toLowerCase()
        //         .replace(/[\s]+/g, '-')
        //         .replace(/[^a-zA-Z0-9-_]/g, '')
        //         .replace(/-+/g, '-')
        //         .replace(/^-*/, '');
        //     }

        //     // create the json file
        //     const storyMeta = {
        //       stories: []
        //     } as any;
        //     for (const story of stories) {
        //       const { name, adds } = story;
        //       for (const add of adds) {
        //         storyMeta.stories.push({
        //           kind: name,
        //           id: `${normalizePart(name)}--${normalizePart(add)}`,
        //           name: add
        //         });
        //       }
        //     }
        //     writeFileSync(storybookMetaPath, JSON.stringify(storyMeta), { encoding: 'utf8' });
        //     storybookMetaRetrieved = true;
        //   }
        // }
      } catch (e) {
        throw new Error(
          "-----------------------------------\n\t" +
            "Unable to get storybook output our metadata - falling back to empty outline.\n\t" +
            "* Make sure you have storybook >= 6 AND @storybook/react >= 6\n\t\t" +
            "* Try running commands below directly and see if there are any errors and make sure you are using storybook >= 6\n\t\t" +
            "node node_modules/@storybook/react/bin/build.js -o storybook-static\n\t\t" +
            "node " + cliPath + " extract\n\t" +
            "if extract doesn't work and you are behind a firewall, the PUPPETEER_ env variables will not work unless you modify `resolveExecutablePath` in puppeteer-core/lib/Launcher.js\n\t" +
            "change if block to `if (!launcher._isPuppeteerCore || true)` and set PUPPETEER_EXECUTABLE_PATH environment variable to Chrome executable location\n" +
            "-----------------------------------"
        );
      }

      // const exists = !storybookMetaRetrieved || existsSync(storybookMetaPath);
      // if (!exists) {
      //   throw new Error("Could not create storybook artifacts");
      // }

      // I can no longer extract storybook metadata with storybook 6.x
      // https://github.com/storybookjs/storybook/issues/13561
      const rtn: DocsetEntries = {
        [docsetType]: {},
      };

      if (storybookMetaRetrieved) {
        const storybookMeta = require(storybookMetaPath) as any;
        const stories = Object.values(storybookMeta.stories);
        for (let i = 0; i < stories.length; i++) {
          const storyMeta = stories[i] as any;
          if (!storyMeta.kind.match(/Example\/Introduction/i)) {
            const url = `storybook/index.html?nav=0&path=/story/${storyMeta.id}`;
            const path = `${storyMeta.kind.replace(/^examples?\//i, "")}/${
              storyMeta.name
            }`;
            (rtn as any)[docsetType][path] = url;
          }
        }
      } else {
        (rtn as any)[docsetType].Storybooks = 'storybook/index.html';
      }

      const storybookSettings = storybookMetaRetrieved ? `` : ``;

      await include({
        path: storybookDirPath,
        remove: true,
        rootDirName: "storybook",
        // appendToBottom: {
        //   ["index.html"]: storybookSettings,
        //   ["iframe.html"]: storybookSettings,
        // },
      });

      return {
        entries: rtn,
      };
    } finally {
      rimraf.sync(storybookTmpPath);
    }
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

function getStories (path: string, storyDetails?: StoryDetails[]): StoryDetails[] {
  storyDetails = storyDetails || [];
  if (existsSync(path)) {
    const stat = statSync(path);
    if (stat.isDirectory()) {
      const children = readdirSync(path);
      for (const name of children) {
        getStories(join(path, name), storyDetails);
      }
    } else {
      if (path.endsWith('.stories.tsx') || path.endsWith('.stories.jsx')) {
        // it's a story file
        const contents = readFileSync(path, { encoding: 'utf8' });
        const stories = parseStoryModule(contents);
        storyDetails.push(...stories);
      }
    }
  }
  return storyDetails;
}