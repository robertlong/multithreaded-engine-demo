import GameWorker from "./GameWorker?worker&inline";
import "./live-reload";

async function main() {
  const canvas = document.getElementById("canvas");

  const gameWorker = new GameWorker();
  const useRenderWorker = window.OffscreenCanvas;
  let renderWorker;

  if (useRenderWorker) {
    console.info("Rendering in WebWorker");
    const { default: RenderWorker } = await import("./RenderWorker?worker");
    renderWorker = new RenderWorker();
    const offscreenCanvas = (canvas as any).transferControlToOffscreen();

    const interWorkerChannel = new MessageChannel();
    const renderWorkerPort = interWorkerChannel.port1;
    const gameWorkerPort = interWorkerChannel.port2;

    gameWorker.postMessage(["init", renderWorkerPort], [renderWorkerPort]);

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
