export class TripleBuffer {
  constructor(buffers) {
    if (!buffers) {
      this.buffers = [
        new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT),
        new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 3),
        new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 3),
        new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 3),
      ];
    } else {
      this.buffers = buffers;
    }

    this.flagsBuffer = this.buffers[0];

    /**
     * readBufferChanged: 0b01000000
     * tempBufferIndex:   0b00xx0000
     * writeBufferIndex:  0b0000xx00
     * readBufferIndex:   0b000000xx
     */
    this.flags = new Uint8Array(this.flagsBuffer);

    // Initially:
    // readBufferChanged = false
    // tempBufferIndex = 0
    // writeBufferIndex = 1
    // readBufferIndex = 2
    this.flags[0] = 0x6;

    this.views = [
      new Float32Array(this.buffers[1]),
      new Float32Array(this.buffers[2]),
      new Float32Array(this.buffers[3]),
    ];
  }

  read() {
    return this.views[Atomics.load(this.flags, 0) & 0x3];
  }

  write(value) {
    return this.views[(Atomics.load(this.flags, 0) & 0x30) >> 4].set(value);
  }

  swapReadBuffers() {
    const flags = Atomics.load(this.flags, 0);

    do {
      if (!readBufferChanged(flags)) {
        return false;
      }
    } while (
      Atomics.compareExchange(this.flags, 0, flags, swapReadWithTemp(flags)) ===
      flags
    );

    return true;
  }

  swapWriteBuffers() {
    const flags = Atomics.load(this.flags, 0);

    while (
      Atomics.compareExchange(
        this.flags,
        0,
        flags,
        swapWriteWithTempAndMarkChanged(flags)
      ) === flags
    );
  }
}

function readBufferChanged(flags) {
  return (flags & 0x40) !== 0;
}

function swapReadWithTemp(flags) {
  return (flags & 0x30) | ((flags & 0x3) << 2) | ((flags & 0xc) >> 2);
}

function swapWriteWithTempAndMarkChanged(flags) {
  return 0x40 | ((flags & 0xc) << 2) | ((flags & 0x30) >> 2) | (flags & 0x3);
}
