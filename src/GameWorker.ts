import { addViewMatrix4, addViewVector3, addViewVector4 } from "./component/transform";
import { addView, createCursorBuffer } from './allocator/CursorBuffer'
import { maxEntities } from "./config";
import { copyToWriteBuffer, swapWriteBuffer } from "./TripleBuffer";

globalThis.addEventListener("message", onMessage);

const gameBuffer = createCursorBuffer();
const renderableBuffer = createCursorBuffer();

const entities = [];

const Transform = {
  position: addViewVector3(renderableBuffer, maxEntities),
  scale: addViewVector3(renderableBuffer, maxEntities),
  rotation: addViewVector3(renderableBuffer, maxEntities),
  quaternion: addViewVector4(renderableBuffer, maxEntities),

  localMatrix: addViewMatrix4(renderableBuffer, maxEntities),
  worldMatrix: addViewMatrix4(renderableBuffer, maxEntities),
  matrixAutoUpdate: addView(renderableBuffer, Uint8Array, maxEntities),
  worldMatrixNeedsUpdate: addView(renderableBuffer, Uint8Array, maxEntities),

  parent: addView(gameBuffer, Uint32Array, maxEntities),
  firstChild: addView(gameBuffer, Uint32Array, maxEntities),
  prevSibling: addView(gameBuffer, Uint32Array, maxEntities),
  nextSibling: addView(gameBuffer, Uint32Array, maxEntities),
};

const state = {
  tripleBuffer: null,
  frameRate: null,
  renderWorkerPort: null,
  then: 0,
  rotation: [0, 0, 0],
};

function onMessage({ data: [type, ...args] }) {
  switch (type) {
    case "init":
      init(args[0]);
      break;
    case "start":
      start(args[0], args[1]);
      break;
  }
}

function init(renderWorkerPort) {
  console.log("GameWorker initialized");

  if (renderWorkerPort) {
    state.renderWorkerPort = renderWorkerPort;
    renderWorkerPort.addEventListener("message", onMessage);
    renderWorkerPort.start();
  }
}

const rndRange = (min, max) => { 
  return Math.random() * (max - min) + min;
}

const createEntity = (eid: number) => {
  entities.push(eid);
  const position = Transform.position[eid];
  position[0] = rndRange(-20, 20);
  position[1] = rndRange(-20, 20);
  position[2] = rndRange(-20, 20);

  if (state.renderWorkerPort) {
    state.renderWorkerPort.postMessage(['addEntity', eid]);
  } else {
    globalThis.postMessage(['addEntity', eid])
  }
}

function start(frameRate, tripleBuffer) {
  console.log("GameWorker loop started");
  state.frameRate = frameRate;
  state.tripleBuffer = tripleBuffer;

  for (let i = 0; i < maxEntities; i++) {
    createEntity(i);
  }

  update();
}

const rotationSystem = (dt) => {
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    const rotation = Transform.rotation[eid];
    rotation[0] += 0.5 * dt;
    rotation[1] += 0.5 * dt;
  }
}

const pipeline = (dt) => {
  rotationSystem(dt);
}

function update() {
  const start = performance.now();
  const dt = (start - state.then) / 1000;
  state.then = start;

  pipeline(dt);

  copyToWriteBuffer(state.tripleBuffer, renderableBuffer);
  swapWriteBuffer(state.tripleBuffer);

  const elapsed = performance.now() - state.then;
  const remainder = 1000 / state.frameRate - elapsed;

  if (remainder > 0) {
    // todo: call fixed timestep physics pipeline here
    setTimeout(update, remainder);
  } else {
    update();
  }
}
