import { TypedArrayConstructor } from "./types";
import { roundUpToMultiple4, roundUpToMultiple8 } from "./util";

const $cursor = Symbol('cursor');

export type StackBuffer = ArrayBuffer & { [$cursor]: number, cursor: number }

export const createStackBuffer = (
  buffer: ArrayBuffer = new ArrayBuffer(1e7 /*10MB*/)
): StackBuffer => {
  Object.defineProperties(buffer, {
    [$cursor]: {
      value: 0,
      configurable: false,
      enumerable: false,
    },
    cursor: {
      configurable: false,
      enumerable: true,
      writable: false,
      get() { return this[$cursor] },
    }
  });
  return buffer as StackBuffer;
}

export const roundCursor = <T extends TypedArrayConstructor>(buffer: StackBuffer, type: T) => {
  const { name } = type
  if (name === "Float32Array") buffer[$cursor] = roundUpToMultiple4(buffer[$cursor]);
  if (name === "Float64Array") buffer[$cursor] = roundUpToMultiple8(buffer[$cursor]);
}

export const alloc = <T extends TypedArrayConstructor>(buffer: StackBuffer, type: T, size: number): InstanceType<T> => {
  roundCursor(buffer, type);

  const store = new type(this, buffer[$cursor], size);
  buffer[$cursor] += size * store.BYTES_PER_ELEMENT;

  return store as InstanceType<T>;
}

export const allocAoA = <T extends TypedArrayConstructor>(buffer: StackBuffer, type: T, stride: number, size: number): InstanceType<T>[] => {
  const store = alloc<T>(buffer, type, size * stride);
  const array = Array(size);
  for (let i = 0; i < size; i++) {
    array[i] = store.subarray(i * stride, i * stride + stride);
  }
  return array;
}