import {
  WebGLRenderer,
  Scene,
  Mesh,
  MeshBasicMaterial,
  BoxBufferGeometry,
  PerspectiveCamera,
  Quaternion,
  Euler,
  Clock,
} from "three";
import { TripleBuffer } from "./TripleBuffer";

if (typeof window === "undefined") {
  self.window = self;
  globalThis.addEventListener("message", onMainThreadMessage);
}

const state = {
  needsResize: true,
  canvasWidth: null,
  canvasHeight: null,
};

function onMainThreadMessage({ data: [type, ...args] }) {
  switch (type) {
    case "init":
      init(...args);
      break;
    case "resize":
      resize(...args);
      break;
  }
}

export function init(
  gameWorkerPort,
  canvas,
  initCanvasWidth,
  initCanvasHeight
) {
  console.log("RenderWorker initialized");
  state.canvasWidth = initCanvasWidth;
  state.canvasHeight = initCanvasHeight;

  const tripleBuffer = new TripleBuffer();

  const scene = new Scene();

  const boxMaterial = new MeshBasicMaterial({ color: 0xff0000 });
  const boxGeometry = new BoxBufferGeometry();
  const box = new Mesh(boxGeometry, boxMaterial);
  scene.add(box);

  const camera = new PerspectiveCamera(
    70,
    state.canvasWidth / state.canvasHeight,
    0.1,
    1000
  );
  camera.position.z = 5;

  const renderer = new WebGLRenderer({ antialias: true, canvas });

  const euler = new Euler();
  const quat = new Quaternion();

  const clock = new Clock();

  // Can likely scale this dynamically depending on worker frame rate
  // renderer.setPixelRatio() can be used to scale main thread frame rate
  const workerFrameRate = 5;

  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    const frameRate = 1 / dt;

    if (tripleBuffer.swapReadBuffers()) {
      const rotation = tripleBuffer.read();
      quat.setFromEuler(euler.fromArray(rotation));
    }

    if (state.needsResize) {
      camera.aspect = state.canvasWidth / state.canvasHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(state.canvasWidth, state.canvasHeight, false);
    }

    box.quaternion.slerp(quat, workerFrameRate / frameRate);
    renderer.render(scene, camera);
  });

  gameWorkerPort.postMessage(["start", workerFrameRate, tripleBuffer.buffers]);
}

export function resize(width, height) {
  state.needsResize = true;
  state.canvasWidth = width;
  state.canvasHeight = height;
}
