import { TypedArrayConstructor } from './types'
import { roundUpToMultiple4, roundUpToMultiple8 } from './util'

export class StackAllocator extends ArrayBuffer {
  private _cursor: number

  constructor(size: number = 1e7 /*10MB*/) {
    super(size);
    this._cursor = 0;
  }

  private roundCursor<T extends TypedArrayConstructor>(type: T) {
    const { name } = type
    if (name === "Float32Array") this._cursor = roundUpToMultiple4(this._cursor);
    if (name === "Float64Array") this._cursor = roundUpToMultiple8(this._cursor);
  }

  alloc<T extends TypedArrayConstructor>(type: T, size: number): InstanceType<T> {
    this.roundCursor(type);

    const store = new type(this, this._cursor, size);
    this._cursor += size * store.BYTES_PER_ELEMENT;
  
    return store as InstanceType<T>;
  }

  allocAoA<T extends TypedArrayConstructor>(type: T, stride: number, size: number): InstanceType<T>[] {
    const store = this.alloc<T>(type, size * stride);
    const array = Array(size);
    for (let i = 0; i < size; i++) {
      array[i] = store.subarray(i * stride, i * stride + stride)
    }
    return array as InstanceType<T>[];
  }

  get cursor () {
    return this._cursor
  }
}
