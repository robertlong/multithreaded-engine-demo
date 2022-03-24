import { addView, createCursorBuffer } from "./allocator/CursorBuffer";
import { addViewMatrix4, addViewVector3, addViewVector4 } from "./component/transform";
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
  Camera,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { createResourceManager, processRemoteResourceMessages, registerResourceLoader, ResourceManager } from "./ResourceManager";
import { createGLTFResourceLoader } from "./GLTFResourceLoader";

const objects: Object3D[] = [];

const boxMaterial = new MeshBasicMaterial({ wireframe: true });
const boxGeometry = new BoxBufferGeometry();

if (typeof (window as any) === "undefined") {
  self.window = self;
  globalThis.addEventListener("message", onMainThreadMessage);
}

const state: {
  needsResize: boolean,
  canvasWidth: number,
  canvasHeight: number,
  scene?: Object3D;
  resourceManager: ResourceManager
} = {
  needsResize: true,
  canvasWidth: null,
  canvasHeight: null,
  scene: null,
  resourceManager: null,
};

const addObject3DQueue = [];
const addCameraQueue = [];
const cameras = [];

function onMainThreadMessage({ data: [type, ...args] }) {
  switch (type) {
    case "init":
      init(args[0], args[1], args[2], args[3]);
      break;
    case "resize":
      resize(args[0], args[1]);
      break;
    case "addEntity": {
      const eid = args[0];
      addObject3DQueue.push(eid)
      break;
    }
    case "addCamera": {
      const eid = args[0];
      addCameraQueue.push(eid)
      break;
    }
    case "resourceCommands":
      processRemoteResourceMessages(state.resourceManager, args[0]);
      break;
  }
}

const addObject3D = (eid: number, obj: Object3D = new Mesh(boxGeometry, boxMaterial)) => {
  (obj as Object3D & { eid: number}).eid = eid;
  objects.push(obj);
  state.scene.add(obj);
}

const addCamera = (eid: number, obj: Camera = new PerspectiveCamera(
  70,
  state.canvasWidth / state.canvasHeight,
  0.1,
  1000
)) => {
  obj.eid = eid;
  objects.push(obj);
  cameras.push(obj);
  state.scene.add(obj);
}

export function resize(width, height) {
  state.needsResize = true;
  state.canvasWidth = width;
  state.canvasHeight = height;
}

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

export const init = async (
  gameWorkerPort,
  canvas,
  initCanvasWidth,
  initCanvasHeight
) => {

  gameWorkerPort.onmessage = onMainThreadMessage
  
  const size = maxEntities

  const tripleBuffer = createTripleBuffer();

  const TransformViews = tripleBuffer.buffers
    .map(buffer => createCursorBuffer(buffer))
    .map(buffer => ({
      position: addViewVector3(buffer, size),
      scale: addViewVector3(buffer, size),
      rotation: addViewVector3(buffer, size),
      quaternion: addViewVector4(buffer, size),
      
      localMatrix: addViewMatrix4(buffer, size),
      worldMatrix: addViewMatrix4(buffer, size),
      matrixAutoUpdate: addView(buffer, Uint8Array, size),
      worldMatrixNeedsUpdate: addView(buffer, Uint8Array, size),
    }));
  
    state.canvasWidth = initCanvasWidth;
    state.canvasHeight = initCanvasHeight;
  
    const scene = state.scene = new Scene();

    const resourceManager = createResourceManager();
    registerResourceLoader(resourceManager, createGLTFResourceLoader(scene));
    state.resourceManager = resourceManager;
  
    scene.add(new AmbientLight(0xffffff, 0.5));
  
    // const boxMaterial = new MeshBasicMaterial({ color: 0xff0000 });
    // const boxGeometry = new BoxBufferGeometry();
    // const box = new Mesh(boxGeometry, boxMaterial);
    // scene.add(box);
  
    const gltfLoader = new GLTFLoader();
  
    const { scene: box } = await gltfLoader.loadAsync("/OutdoorFestival.glb");
    scene.add(box);
  
    const renderer = new WebGLRenderer({ antialias: true, canvas });
  
    // const euler = new Euler();
    // const quat = new Quaternion();
    // const pos = new Vector3();

    const eulers = Array(maxEntities).fill(null).map(() => new Euler())
    const quats = Array(maxEntities).fill(null).map(() => new Quaternion())
    const poss = Array(maxEntities).fill(null).map(() => new Vector3())
  
    const clock = new Clock();
  
    // Can likely scale this dynamically depending on worker frame rate
    // renderer.setPixelRatio() can be used to scale main thread frame rate
    const workerFrameRate = 60;

    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta();
      const frameRate = 1 / dt;
      const lerpAlpha = clamp(workerFrameRate / frameRate, 0 , 1);

      while (addObject3DQueue.length) {
        addObject3D(addObject3DQueue.shift())
      }
  
      while (addCameraQueue.length) {
        addCamera(addCameraQueue.shift())
      }
  
      if (swapReadBuffer(tripleBuffer)) {
        const bufferIndex = getReadBufferIndex(tripleBuffer);
        const Transform = TransformViews[bufferIndex];

        for (let i = 0; i < objects.length; i++) {
          const obj = objects[i];
          const { eid } = obj as Object3D & { eid: number };
          const position = Transform.position[eid];
          const rotation = Transform.rotation[eid];
          const euler = eulers[eid];
          const quat = quats[eid];
          const pos = poss[eid];
          quat.setFromEuler(euler.fromArray(rotation as unknown as number[]));
          pos.fromArray(position);
        }

      }

      // todo: only sync matrices
      //  - decompose into components
      //  - lerp each component
      //  - recompose and apply matrix to object3d
      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        const { eid } = obj;

        const quat = quats[eid];
        const pos = poss[eid];

        obj.position.lerp(pos, lerpAlpha);
        obj.quaternion.slerp(quat, lerpAlpha);
      }

      const camera = cameras[0];
      if (camera) {

        if (state.needsResize) {
          camera.aspect = state.canvasWidth / state.canvasHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(state.canvasWidth, state.canvasHeight, false);
        }
        
        renderer.render(scene, camera);
      }
    });
    
    gameWorkerPort.postMessage(["start", workerFrameRate, tripleBuffer, resourceManager.buffer]);

    console.log("RenderWorker initialized");
}

// for when renderer is on main thread
export const postMessage = (data) => onMainThreadMessage({data});