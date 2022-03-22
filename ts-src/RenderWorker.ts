import { alloc, createStackBuffer } from "./allocator/fp";
import { allocMatrix4, allocVector3, allocVector4 } from "./component/transform";
import { createTripleBuffer, swapReadBuffer, getReadBufferIndex } from "./TripleBuffer";
import { maxEntities } from './config';
import {
  AmbientLight,
  WebGLRenderer,
  Scene,
  Mesh,
  Object3D,
  MeshBasicMaterial,
  BoxBufferGeometry,
  PerspectiveCamera,
  Quaternion,
  Euler,
  Clock,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

const objects: Object3D[] = [];

const boxMaterial = new MeshBasicMaterial({ wireframe: true });
const boxGeometry = new BoxBufferGeometry();

if (typeof (window as any) === "undefined") {
  self.window = self;
  globalThis.addEventListener("message", onMainThreadMessage);
}

const state = {
  needsResize: true,
  canvasWidth: null,
  canvasHeight: null,
  scene: null,
};

function onMainThreadMessage({ data: [type, ...args] }) {
  switch (type) {
    case "init":
      init(args[0], args[1], args[2], args[3]);
      break;
    case "resize":
      resize(args[0], args[1]);
      break;
    case "addEntity": {
      const eid = args[1];
      addObject3D(eid, new Mesh(boxGeometry, boxMaterial));
      break;
    }
  }
}

const addObject3D = (eid: number, obj: Object3D) => {
  obj.eid = eid;
  objects.push(obj);
  state.scene.add(obj);
}

export function resize(width, height) {
  state.needsResize = true;
  state.canvasWidth = width;
  state.canvasHeight = height;
}

export const init = async (
  gameWorkerPort,
  canvas,
  initCanvasWidth,
  initCanvasHeight
) => {
  
  const size = maxEntities

  const tripleBuffer = createTripleBuffer();
  
  const TransformViews = tripleBuffer.buffers
    .map(buffer => createStackBuffer(buffer))
    .map(buffer => ({
      position: allocVector3(buffer, size),
      scale: allocVector3(buffer, size),
      rotation: allocVector3(buffer, size),
      quaternion: allocVector4(buffer, size),
      
      localMatrix: allocMatrix4(buffer, size),
      worldMatrix: allocMatrix4(buffer, size),
      matrixAutoUpdate: alloc(buffer, Uint8Array, size),
      worldMatrixNeedsUpdate: alloc(buffer, Uint8Array, size),
    }));
  
    state.canvasWidth = initCanvasWidth;
    state.canvasHeight = initCanvasHeight;
  
    const scene = state.scene = new Scene();
  
    scene.add(new AmbientLight(0xffffff, 0.5));
  
    // const boxMaterial = new MeshBasicMaterial({ color: 0xff0000 });
    // const boxGeometry = new BoxBufferGeometry();
    // const box = new Mesh(boxGeometry, boxMaterial);
    // scene.add(box);
  
    const gltfLoader = new GLTFLoader();
  
    // const { scene: box } = await gltfLoader.loadAsync("/OutdoorFestival.glb");
    // scene.add(box);
  
    const camera = new PerspectiveCamera(
      70,
      state.canvasWidth / state.canvasHeight,
      0.1,
      1000
    );
    camera.position.y = 1.6;
    camera.position.z = 5;
  
    const renderer = new WebGLRenderer({ antialias: true, canvas });
  
    const euler = new Euler();
    const quat = new Quaternion();
    const pos = new Vector3();
  
    const clock = new Clock();
  
    // Can likely scale this dynamically depending on worker frame rate
    // renderer.setPixelRatio() can be used to scale main thread frame rate
    const workerFrameRate = 60;
  
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta();
      const frameRate = 1 / dt;
  
      if (swapReadBuffer(tripleBuffer)) {
        const bufferIndex = getReadBufferIndex(tripleBuffer);
        const Transform = TransformViews[bufferIndex];

        // todo: only sync matrices
        //  - decompose into components
        //  - lerp each component
        //  - recompose and apply matrix to object3d
        for (let i = 0; i < objects.length; i++) {
          const obj = objects[i];
          const { eid } = obj;
          const position = Transform.position[eid];
          const rotation = Transform.rotation[eid];
          quat.setFromEuler(euler.fromArray(rotation));
          pos.fromArray(position);
          obj.position.lerp(pos);
          obj.quaternion.slerp(quat, workerFrameRate / frameRate);
        }

      }
  
      if (state.needsResize) {
        camera.aspect = state.canvasWidth / state.canvasHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(state.canvasWidth, state.canvasHeight, false);
      }
  
      renderer.render(scene, camera);
    });
    
    gameWorkerPort.postMessage(["start", workerFrameRate, tripleBuffer]);
    
    console.log("RenderWorker initialized");
}