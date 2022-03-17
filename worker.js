import { TripleBuffer } from "./TripleBuffer";
let tripleBuffer;
let frameRate;

function onMessage({ data }) {
  const type = data[0];

  if (type === 0) {
    frameRate = data[1];
    tripleBuffer = new TripleBuffer(data[2]);
    update();
  }
}

let then = 0;

const rotation = [0, 0, 0];

function update() {
  const start = performance.now();
  const dt = (start - then) / 1000;
  then = start;

  rotation[0] += 0.5 * dt;
  rotation[1] += 0.5 * dt;

  tripleBuffer.write(rotation);
  tripleBuffer.swapWriteBuffers();

  const elapsed = performance.now() - then;
  const remainder = 1000 / frameRate - elapsed;

  if (remainder > 0) {
    setTimeout(update, remainder);
  } else {
    update();
  }
}

globalThis.addEventListener("message", onMessage);
