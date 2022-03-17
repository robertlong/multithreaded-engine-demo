import GameWorker from "./GameWorker?worker";

async function main() {
  const canvas = document.getElementById("canvas");

  const interWorkerChannel = new MessageChannel();
  const renderWorkerPort = interWorkerChannel.port1;
  const gameWorkerPort = interWorkerChannel.port2;

  const gameWorker = new GameWorker();
  gameWorker.postMessage(["init", renderWorkerPort], [renderWorkerPort]);

  const useRenderWorker = window.OffscreenCanvas;
  let renderWorker;

  if (useRenderWorker) {
    console.info("Rendering in WebWorker");
    const { default: RenderWorker } = await import("./RenderWorker?worker");
    const renderWorker = new RenderWorker();
    const offscreenCanvas = canvas.transferControlToOffscreen();

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
    renderWorker = await import("./RenderWorker");
    renderWorker.init(
      interWorkerChannel.port2,
      canvas,
      canvas.clientWidth,
      canvas.clientHeight
    );
  }

  window.addEventListener("resize", () => {
    if (useRenderWorker) {
      renderWorker.postMessage([
        "resize",
        canvas.clientWidth,
        canvas.clientHeight,
      ]);
    } else {
      renderWorker.resize(canvas.clientWidth, canvas.clientHeight);
    }
  });
}

main().catch(console.error);
