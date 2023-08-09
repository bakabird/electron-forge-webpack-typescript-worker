[english version](./README_en.md)

这个项目展示了，在基于 electron-forge 的 webpack-typescript 模板创建的项目中如何使用 Node 的 Workers。

*更新时间：2023年8月10日*

我在用 [electron-forge](https://www.electronforge.io/)!

我在用它们的 [webpack-typescript](https://www.electronforge.io/templates/typescript-+-webpack-template) 模板！

**我要用 index.js 中使用 [Worker](https://nodejs.org/dist/latest-v18.x/docs/api/worker_threads.html#worker-threads)！！！**

经过一系列的研究以及场景，在尝试过 [webpack5-WebWorker](https://webpack.js.org/guides/web-workers/)、[threads-plugin](https://github.com/andywer/threads-plugin) 之后，**我最终通过[worker-loader](https://github.com/webpack-contrib/worker-loader)完成了**。

## 重点： WebWroekr 以及 NodeJs中的Worker 并不一样。

* `WebWorker` 是浏览器环境中使用的。
* `NodeJs` 中的 `Worker` 则是 OS环境 中使用的。
* 全局环境中的 `Worker` 就是 `WebWorker`。
* `NodeJs` 中的 `Worker` 从 `node:worker_threads` module 中引入。
* 它们的接口也不一样。

正是由于这个原因，使得我们不能无脑地使用[webpack5-WebWorker](https://webpack.js.org/guides/web-workers/)以及[worker-loader](https://github.com/webpack-contrib/worker-loader)。

[threads-plugin](https://github.com/andywer/threads-plugin)? 完全搞不懂呢。

## 怎么做

在你通过 electron-forge 的 webpack-typescript 模板创建的项目，按照下面的步骤进行。

先安装 [worker-loader](https://github.com/webpack-contrib/worker-loader)。

然后基于 [worker-loader#integrating-with-typescript](https://github.com/webpack-contrib/worker-loader#integrating-with-typescript) 进行调整。

**`@types/worker-loader.d.ts`**

```ts
declare module "worker-loader!*" {
    import type { Worker } from "worker_threads"; // <----- 增加了这个
    // You need to change `Worker`, if you specified a different value for the `workerType` option
    class WebpackWorker extends Worker {
      constructor();
    }
  
    // Uncomment this if you set the `esModule` option to `false`
    // export = WebpackWorker;
    export default WebpackWorker;
  }
```

在这个文件中我们需要增加 `import type { Worker } from "worker_threads";` 用来在 ts 代码提示上将 `WebWorker` 替换为 `NodeJSWorker`。

**`my.worker.ts`**

```ts
import { parentPort as ctx } from "worker_threads";

// Post data to parent thread
ctx.postMessage({ foo: "foo" });

// Respond to message from parent thread
ctx.on("message", (msg) => console.log(msg));
```

在这个文件中，我们将 `const ctx: Worker = self as any;` 调整为 `import { parentPort as ctx } from "worker_threads";`。我们用 `parentPort` 而不是 `self` 来跟主线程沟通。

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

在这个文件中。我引入了 `WorkerShim.js`，这个文件是这样的。

**`WorkerShim.js`**

```js
const { Worker: NodeJSWorker } = require('worker_threads');
const { resolve: resolvePath } = require('path');

global.Worker = function NodeJSWorkerThreadsPathResolveWrap(path, options) {
    // this __dirname will travel into the bundle and only resolved at
    // runtime there, so it will be the path to the dist bin
    // and we can assume to find the worker there.
    // generally, this has to be an absolute path with NodeJS worker-threads,
    // so this is why we use resolve here and not join.
    console.log("WorkerShim.js: path: " + path + " options: " + options + "resolvedPath " + resolvePath(__dirname, path));
    return new NodeJSWorker(resolvePath(__dirname, path), options);
}
```

如代码所示，它重写了 `global.Worker`，使其实际上创建 `NodeJSWorker`。

**`webpack.main.config.ts`**

```js
  node: {
    __dirname: false, // this is important so that __dirname
                      // gets into bundle as vanilla and only resolved at runtime
  },
```

**[感谢他！](https://github.com/webpack-contrib/worker-loader/issues/301#issuecomment-741897272)**


## 我既想要用 NodeJSWorker 又想要用 WebWorker！

我猜这是OK的，因为我们对 `glboal.Worker` 的覆写只在主线程 `index.ts` 中完成。

在 `render.ts` 中使用的 `Worker` 依旧会是 `WebWorker`。

不过在代码提示上因为 `worker-loader.d.ts` 的修改可能会有额外的事项需要处理。

但我没有实践过，我也不确定。
