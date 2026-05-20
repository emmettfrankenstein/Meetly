import os from "os";
import * as mediasoup from "mediasoup";
import type { types } from "mediasoup";

const workers: types.Worker[] = [];
let nextWorkerIndex = 0;

export async function initMediasoupWorkers() {
  const workerCount = Math.max(1, Math.min(2, os.cpus().length));

  for (let index = 0; index < workerCount; index += 1) {
    const worker = await mediasoup.createWorker({
      logLevel: "warn",
    });

    worker.on("died", () => {
      console.error(`mediasoup worker died [pid:${worker.pid}]`);
      process.exit(1);
    });

    workers.push(worker);

    console.log(`mediasoup worker created [pid:${worker.pid}]`);
  }
}

export function getNextWorker() {
  if (workers.length === 0) {
    throw new Error("mediasoup workers have not been initialized");
  }

  const worker = workers[nextWorkerIndex];

  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;

  return worker;
}
