Using Node Workers in an Electron Forge Project with webpack-typescript Template

*Last Updated: August 10, 2023*

I am working with [electron-forge](https://www.electronforge.io/)!

Specifically, I'm using their [webpack-typescript](https://www.electronforge.io/templates/typescript-+-webpack-template) template!

**I want to use [Worker](https://nodejs.org/dist/latest-v18.x/docs/api/worker_threads.html#worker-threads) in my `index.js` file!!!**

After various research and attempts, including trying [webpack5 WebWorker](https://webpack.js.org/guides/web-workers/) and [threads-plugin](https://github.com/andywer/threads-plugin), **I finally succeeded using [worker-loader](https://github.com/webpack-contrib/worker-loader).**

## Key Point: WebWorker vs. NodeJs Worker

- `WebWorker` is used in the browser environment.
- `NodeJs`'s `Worker` is used in the OS environment.
- The `Worker` in the global environment is the `WebWorker`.
- `NodeJs`'s `Worker` is imported from the `node:worker_threads` module.
- They have different interfaces.

Because of this difference, we can't blindly use [webpack5 WebWorker](https://webpack.js.org/guides/web-workers/) or [worker-loader](https://github.com/webpack-contrib/worker-loader).

As for [threads-plugin](https://github.com/andywer/threads-plugin), I find it quite confusing.

## What To Do

Follow the steps below for the project you created by webpack-typescript template of Electron-forge.

First of all, install [worker-loader](https://github.com/webpack-contrib/worker-loader).

Then, based on [worker-loader#integrating-with-typescript](https://github.com/webpack-contrib/worker-loader#integrating-with-typescript), make adjustments.

**`@types/worker-loader.d.ts`**

```ts
declare module "worker-loader!*" {
    import type { Worker } from "worker_threads"; // <----- Added this
    // You need to change `Worker` if you specified a different value for the `workerType` option
    class WebpackWorker extends Worker {
      constructor();
    }
  
    // Uncomment this if you set the `esModule` option to `false`
    // export = WebpackWorker;
    export default WebpackWorker;
}
```

In this file, we need to add `import type { Worker } from "worker_threads";` to replace `WebWorker` with `NodeJSWorker` for TypeScript code suggestions.

**`my.worker.ts`**

```ts
import { parentPort as ctx } from "worker_threads";

// Post data to the parent thread
ctx.postMessage({ foo: "foo" });

// Respond to messages from the parent thread
ctx.on("message", (msg) => console.log(msg));
```

In this file, we adjust `const ctx: Worker = self as any;` to `import { parentPort as ctx } from "worker_threads";`. We use `parentPort` instead of `self` to communicate with the main thread.

**`index.ts`**

```ts
require("./WorkerShim.js")
import myWorker from "worker-loader!./my.worker.ts";

const worker = new myWorker();
worker.on("message", (msg: any) => {
  console.log(msg);
});
worker.postMessage({ a: 1 });
```

In this file, I'm importing `WorkerShim.js`, which looks like this:

**`WorkerShim.js`**

```ts
const { Worker: NodeJSWorker } = require('worker_threads');
const { resolve: resolvePath } = require('path');

global.Worker = function NodeJSWorkerThreadsPathResolveWrap(path, options) {
    // This __dirname will travel into the bundle and only resolved at
    // runtime there, so it will be the path to the dist bin.
    // Generally, this has to be an absolute path with NodeJS worker-threads,
    // which is why we use resolve here and not join.
    console.log("WorkerShim.js: path: " + path + " options: " + options + " resolvedPath " + resolvePath(__dirname, path));
    return new NodeJSWorker(resolvePath(__dirname, path), options);
}
```

As shown, it rewrites `global.Worker` to actually create a `NodeJSWorker`.

**`webpack.main.config.ts`**

```js
  node: {
    __dirname: false, // this is important so that __dirname
                      // gets into bundle as vanilla and only resolved at runtime
  },
```

**[Big Thanks To He](https://github.com/webpack-contrib/worker-loader/issues/301#issuecomment-741897272)**

## Using Both NodeJSWorker and WebWorker

I assume this is possible since the override of `global.Worker` is done only in the main thread `index.ts`.

In `renderer.ts`, the `Worker` used will still be `WebWorker`.

However, due to the modifications in `worker-loader.d.ts`, there might be additional considerations for code suggestions.

But I haven't tried this, so I'm not certain.