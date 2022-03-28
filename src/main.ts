import GameWorker from "./GameWorker?worker&inline";
import { InputArray } from "./input/InputKeys";
import { bindInputEvents, createInputState, resetInputState } from "./input/InputManager";
import "./live-reload";
import { copyToWriteBuffer, createTripleBuffer, swapReadBuffer, swapWriteBuffer } from "./TripleBuffer";

async function main() {
  const canvas = document.getElementById("canvas");

  const gameWorker = new GameWorker();
  const useRenderWorker = (window as any).OffscreenCanvas;
  let renderWorker;

  const inputState = createInputState(InputArray);
  const inputTripleBuffer = createTripleBuffer(inputState.buffer.byteLength);

  const inputUpdateLoop = () => {
    requestAnimationFrame(inputUpdateLoop);
    copyToWriteBuffer(inputTripleBuffer, inputState.buffer);
    swapWriteBuffer(inputTripleBuffer);
  };

  bindInputEvents(inputState, canvas);

  inputUpdateLoop();

  if (useRenderWorker) {
    console.info("Rendering in WebWorker");
    const { default: RenderWorker } = await import("./RenderWorker?worker");
    renderWorker = new RenderWorker();
    const offscreenCanvas = (canvas as any).transferControlToOffscreen();

    const interWorkerChannel = new MessageChannel();
    const renderWorkerPort = interWorkerChannel.port1;
    const gameWorkerPort = interWorkerChannel.port2;

    gameWorker.postMessage(["init", inputTripleBuffer, renderWorkerPort], [renderWorkerPort]);

    renderWorker.postMessage(
      [
        "init",
        gameWorkerPort,
        offscreenCanvas,
        canvas.clientWidth,
        canvas.clientHeight,
      ],
      [gameWorkerPort, offscreenCanvas]
    );
  } else {
    console.info("Rendering on Main Thread");
    gameWorker.postMessage(["init", null]);
    renderWorker = await import("./RenderWorker");
    renderWorker.init(
      gameWorker,
      canvas,
      canvas.clientWidth,
      canvas.clientHeight
    );
  }

  window.addEventListener("resize", () => {
    renderWorker.postMessage(["resize", canvas.clientWidth, canvas.clientHeight]);
  });
}

main().catch(console.error);
