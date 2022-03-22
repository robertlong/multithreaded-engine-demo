import { allocMatrix4, allocVector3, allocVector4 } from "./component/transform";
import { alloc, createStackBuffer } from './allocator/fp'
import { maxEntities } from "./config";
import { copyToWriteBuffer, swapWriteBuffer } from "./TripleBuffer";

const gameBuffer = createStackBuffer();
const renderableBuffer = createStackBuffer();

const entities = Array(maxEntities);

const Transform = {
  position: allocVector3(renderableBuffer, maxEntities),
  scale: allocVector3(renderableBuffer, maxEntities),
  rotation: allocVector3(renderableBuffer, maxEntities),
  quaternion: allocVector4(renderableBuffer, maxEntities),

  localMatrix: allocMatrix4(renderableBuffer, maxEntities),
  worldMatrix: allocMatrix4(renderableBuffer, maxEntities),
  matrixAutoUpdate: alloc(renderableBuffer, Uint8Array, maxEntities),
  worldMatrixNeedsUpdate: alloc(renderableBuffer, Uint8Array, maxEntities),

  parent: alloc(gameBuffer, Uint32Array, maxEntities),
  firstChild: alloc(gameBuffer, Uint32Array, maxEntities),
  prevSibling: alloc(gameBuffer, Uint32Array, maxEntities),
  nextSibling: alloc(gameBuffer, Uint32Array, maxEntities),
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
  entities[eid] = eid;
  const position = Transform.position[eid];
  position[0] = rndRange(-1000, 1000);
  position[1] = rndRange(-1000, 1000);
  position[2] = rndRange(-1000, 1000);
  state.renderWorkerPort.postMessage(['addEntity', eid]);
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
