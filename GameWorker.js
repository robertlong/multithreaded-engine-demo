import { TripleBuffer } from "./TripleBuffer";

globalThis.addEventListener("message", onMainThreadMessage);

const state = {
  tripleBuffer: null,
  frameRate: null,
  then: 0,
  rotation: [0, 0, 0],
};

function onMainThreadMessage({ data: [type, ...args] }) {
  switch (type) {
    case "init":
      init(...args);
      break;
  }
}

function init(renderWorkerPort) {
  console.log("GameWorker initialized");
  renderWorkerPort.addEventListener("message", onRenderWorkerMessage);
  renderWorkerPort.start();
}

function onRenderWorkerMessage({ data: [type, ...args] }) {
  switch (type) {
    case "start":
      start(...args);
      break;
  }
}

function start(frameRate, sharedBuffers) {
  console.log("GameWorker loop started");
  state.frameRate = frameRate;
  state.tripleBuffer = new TripleBuffer(sharedBuffers);
  update();
}

function update() {
  const start = performance.now();
  const dt = (start - state.then) / 1000;
  state.then = start;

  state.rotation[0] += 0.5 * dt;
  state.rotation[1] += 0.5 * dt;

  state.tripleBuffer.write(state.rotation);
  state.tripleBuffer.swapWriteBuffers();

  const elapsed = performance.now() - state.then;
  const remainder = 1000 / state.frameRate - elapsed;

  if (remainder > 0) {
    setTimeout(update, remainder);
  } else {
    update();
  }
}
