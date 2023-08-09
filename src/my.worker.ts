import { parentPort as ctx } from "worker_threads";

// Post data to parent thread
ctx.postMessage({ foo: "foo" });

// Respond to message from parent thread
ctx.on("message", (msg) => console.log(msg));