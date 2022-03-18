import { Object3D, Quaternion, Vector3 } from "three";

/*************** Game Thread *******************/

interface TransformComponent {
  position: Float32Array[];
  rotation: Float32Array[];
  quaternion: Float32Array[];
  scale: Float32Array[];

  localMatrix: Float32Array[];
  worldMatrix: Float32Array[];
  matrixAutoUpdate: Uint8Array;
  worldMatrixNeedsUpdate: Uint8Array;

  parent: Uint32Array;
  firstChild: Uint32Array;
  prevSibling: Uint32Array;
  nextSibling: Uint32Array;
}

interface GameStateStore {
  transform: TransformComponent;
}

// Tag Component that signifies whether to copy transform data into the RenderStateStore
interface Dynamic {}

// Tag Component that signifies whether to copy
interface Renderable {}

// Synced to RenderBuffer
interface RenderTransform {
  worldPosition: Float32Array[];
  worldQuaternion: Float32Array[];
  worldScale: Float32Array[];
}

// Object3Ds etc. created by sending over postMessage

enum Command {
  CreateObject3D,
  CreateGeometry,
  CreateMaterial,
}

enum Object3DType {
  Mesh,
}

postMessage({
  frame: 0,
  commands: [
    {
      type: Command.CreateGeometry,
      eid: 1,
      attributes: {
        position: new Float32Array(new SharedArrayBuffer(24)),
      },
    },
    {
      type: Command.CreateMaterial,
      eid: 2,
    },
    {
      type: Command.CreateObject3D,
      eid: 0,
      object3D: Object3DType.Mesh,
      geometry: 1,
      material: 2,
    },
  ],
});

/**************** Triple Buffer ******************/

interface RenderTransformsStore {
  position: Float32Array[];
  rotation: Float32Array[];
  quaternion: Float32Array[];
  scale: Float32Array[];
  dynamic: Uint8Array[];
}

interface RenderStateStore {
  transforms: RenderTransformsStore;
}

const renderBuffer = new ArrayBuffer();
const f32 = new Float32Array(renderBuffer);

RenderTransform = {
  position: f32.subrarray(max * 0, max * 1),
  quaternion: f32.subrarray(max * 1, max * 2),
  scale: f32.subrarray(max * 2, max * 3),
};

TripleBuffer.write(renderBuffer);

/*************** Render Thread *******************/

const object3ds: Map<number, Object3D> = new Map();

const alpha = 0.5; // workerFrameRate / frameRate;
const vec = new Vector3();
const quat = new Quaternion();

for (const [eid, object] of object3ds) {
  vec.fromArray(store.transforms.position[eid]);
  object.position.lerp(vec, alpha);

  quat.fromArray(store.transforms.quaternion[eid]);
  object.quaternion.slerp(quat, alpha);
}

// export type TransformSoA = {
//   position: Vector3SoA
//   rotation: EulerSoA
//   scale: Vector3SoA
//   quaternion: QuaternionSoA
//   up: Vector3SoA,
// }

// export type TransformSoAoA = {
//   position: Float32Array[]
//   rotation: Float32Array[]
//   scale: Float32Array[]
//   quaternion: Float32Array[]
//   up: Float32Array[]
// }

// export type Object3DStoreBase = {
//   id: Uint32Array | Int32Array,
//   parent: Uint32Array | Int32Array,
//   firstChild: Uint32Array | Int32Array,
//   prevSibling: Uint32Array | Int32Array,
//   nextSibling: Uint32Array | Int32Array,
//   modelViewMatrix: Float32Array[],
//   normalMatrix: Float32Array[],
//   matrix: Float32Array[],
//   matrixWorld: Float32Array[],
//   matrixAutoUpdate: Uint8Array,
//   matrixWorldNeedsUpdate: Uint8Array,
//   layers: Uint32Array | Int32Array,
//   visible: Uint8Array,
//   castShadow: Uint8Array,
//   receiveShadow: Uint8Array,
//   frustumCulled: Uint8Array,
//   renderOrder: Float32Array,
// }

/*************** Main Thread *******************/

interface AudioState {}

postMessage({
  inputEvents: [],
  networkMessages: [],
});

/************** Allocator *******************/

const roundUpToMultiple = (mul: number) => (x: number) =>
  Math.ceil(x / mul) * mul;
const roundUpToMultiple4 = roundUpToMultiple(4);
const roundUpToMultiple8 = roundUpToMultiple(8);

type TypedArray =
  | Float32Array
  | Float64Array
  | Uint8Array
  | Int8Array
  | Uint16Array
  | Int16Array
  | Uint32Array
  | Int32Array
  | BigUint64Array
  | BigInt64Array;

type TypedArrayConstructor = new (
  buffer: ArrayBuffer,
  offset: number,
  length: number
) => TypedArray;

export const createAllocator = (
  buffer: ArrayBuffer = new SharedArrayBuffer(1e7 /*10MB*/)
) => {
  let cursor = 0;
  return (type: TypedArrayConstructor, length: number) => {
    if (type.name === "Float32Array") cursor = roundUpToMultiple4(cursor);
    if (type.name === "Float64Array") cursor = roundUpToMultiple8(cursor);
    const store = new type(buffer, cursor, length);
    cursor += length * store.BYTES_PER_ELEMENT;
    return store;
  };
};

const alloc = createAllocator();

export const createAoA = (
  type: TypedArrayConstructor,
  stride: number,
  size: number
) => {
  return Array(size)
    .fill(alloc(type, size * stride))
    .map((store, i) => store.subarray(i * stride, i * stride + stride));
};

const createVector3AoA = () => createAoA(Float32Array, 3, 1000);
const createVector4AoA = () => createAoA(Float32Array, 4, 1000);

const Transform = {
  position: createVector3AoA(),
  scale: createVector3AoA(),
  rotation: createVector3AoA(),
  quaternion: createVector3AoA(),
};

/**
 * RenderableStateWriter
 * Extends TripleBuffer
 * Instantiate in GameTread
 * Takes in SharedArrayBuffers as constructor argument
 *
 * RenderableStateReader
 * Extends TripleBuffer
 * Instantiate in RenderThread
 * Creates the SharedArrayBuffers and TypedArrayViews to read from
 *
 * TripleBuffer Contents:
 * Scene properties (fog, background, etc.)
 * Transforms for dynamic objects
 * Dynamic light properties
 * Dynamic material properties
 * Dynamic camera properties
 * Skinned mesh properties
 * Active LOD levels?
 * Animation state
 * Audio state
 */

/**
 * ResourceManager
 *
 * Resource Management:
 * Maintain an atomic counter for resource ids
 * Render thread can create resource ids for Textures/Meshes/Images/Materials/etc. when loading glTFs or other assets
 * Game thread can create resource ids when issuing commands to create a resource
 * Both ends maintain a map from resource id to resource info / representation
 * Game thread has an info map
 * Render thread has a map to the actual object
 * Render thread keeps around a reference counter that can be used to unload resources when it hits zero
 * Render thread is responsible for managing resources
 * Except... audio which can't me managed on the render thread.
 * We will need to design a resource management system that handles different threads for audio/renderer resources
 */

/**
 * PostMessage GameWorker -> RenderWorker:
 * CreateObject3D
 * DeleteObject3D
 * CreateMaterial
 * DeleteMaterial
 * CreateGeometry
 * DeleteGeometry
 * LoadGLTF
 */

/**
 * PostMessage MainThread -> RenderWorker:
 * OffscreenCanvas transfer
 * Screen resize events
 */

/**
 * PostMessage RenderWorker -> MainThread:
 * AudioState
 */

/**
 * PostMessage MainThread -> GameWorker:
 * GLTFLoader ECS representation
 * InputState
 * NetworkingMessages
 */

/**
 * PostMessage GameWorker -> MainThread:
 * NetworkingMessages
 * UI Events
 */
