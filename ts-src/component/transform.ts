import { StackBuffer, alloc, allocAoA } from '../allocator/fp'

export interface TransformComponent {
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

export const allocVector3 = (stackBuffer: StackBuffer, n: number) => allocAoA(stackBuffer, Float32Array, 3, n)
export const allocVector4 = (stackBuffer: StackBuffer, n: number) => allocAoA(stackBuffer, Float32Array, 4, n)
export const allocMatrix4 = (stackBuffer: StackBuffer, n: number) => allocAoA(stackBuffer, Float32Array, 16, n)

export const createTransform = (gameBuffer: StackBuffer, renderBuffer: StackBuffer, size: number): TransformComponent => ({
  position: allocVector3(renderBuffer, size),
  scale: allocVector3(renderBuffer, size),
  rotation: allocVector3(renderBuffer, size),
  quaternion: allocVector4(renderBuffer, size),

  localMatrix: allocMatrix4(renderBuffer, size),
  worldMatrix: allocMatrix4(renderBuffer, size),
  matrixAutoUpdate: alloc(renderBuffer, Uint8Array, size),
  worldMatrixNeedsUpdate: alloc(renderBuffer, Uint8Array, size),

  parent: alloc(gameBuffer, Uint32Array, size),
  firstChild: alloc(gameBuffer, Uint32Array, size),
  prevSibling: alloc(gameBuffer, Uint32Array, size),
  nextSibling: alloc(gameBuffer, Uint32Array, size),
});