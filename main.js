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
import Worker from "./worker?worker";
import { TripleBuffer } from "./TripleBuffer";

const worker = new Worker();
const tripleBuffer = new TripleBuffer();

const scene = new Scene();

const boxMaterial = new MeshBasicMaterial({ color: 0xff0000 });
const boxGeometry = new BoxBufferGeometry();
const box = new Mesh(boxGeometry, boxMaterial);
scene.add(box);

const camera = new PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 5;

const renderer = new WebGLRenderer({ antialias: true });
document.body.appendChild(renderer.domElement);

let needsResize = true;

window.addEventListener("resize", () => {
  needsResize = true;
});

const euler = new Euler();
const quat = new Quaternion();

const clock = new Clock();

// Can likely scale this dynamically depending on worker frame rate
// renderer.setPixelRatio() can be used to scale main thread frame rate
const workerFrameRate = 60;

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  const frameRate = 1 / dt;

  if (tripleBuffer.swapReadBuffers()) {
    const rotation = tripleBuffer.read();
    quat.setFromEuler(euler.fromArray(rotation));
  }

  if (needsResize) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  box.quaternion.slerp(quat, workerFrameRate / frameRate);
  renderer.render(scene, camera);
});

worker.postMessage([0, workerFrameRate, tripleBuffer.buffers]);
