import type { MessageToWorker, MessageFromWorker } from "./message.ts";
const SCREEN_HEIGHT = 200;
const HALF_SCREEN_WIDTH = 160;
const MS_PER_FRAME = Math.floor(1000 / 30);

self.XMLHttpRequest = undefined as any;
self.fetch = undefined as any;
self.WebSocket = undefined as any;
self.importScripts = undefined as any;

let buffer: undefined | ArrayBuffer;
let src: undefined | string;
let t = 0;

const update = () => {
  if (buffer == undefined || src == undefined || buffer.byteLength === 0) {
    return;
  }

  try {
    let { pixel } = (function () {
      // oxlint-disable-next-line typescript/no-implied-eval
      return new Function(`
      ${src};
      return { pixel };
    `)();
    })();

    let arr = new Uint8ClampedArray(buffer);
    for (let y = 0; y < SCREEN_HEIGHT; y++) {
      for (let xh = 0; xh < HALF_SCREEN_WIDTH; xh++) {
        const i = y * HALF_SCREEN_WIDTH + xh;
        const p1 = pixel(xh * 2 + 0, y, t) & 0xf;
        const p2 = pixel(xh * 2 + 1, y, t) & 0xf;
        arr[i] = (p1 << 4) | p2;
      }
    }

    t++;
  } catch (e) {
    clearInterval(token);
    token = undefined;
    let message: MessageFromWorker = {
      type: "error",
      error: String(e),
    };

    self.postMessage(message);
    return;
  }

  let message: MessageFromWorker = {
    type: "update",
    buffer,
  };

  self.postMessage(message, [buffer]);
};

let token: NodeJS.Timeout | undefined;

self.onmessage = (e: MessageEvent<MessageToWorker>) => {
  const { data } = e;
  switch (data.type) {
    case "send-buffer":
      buffer = data.buffer;
      break;

    case "update-script":
      src = data.script;
      if (!token) {
        token = setInterval(update, MS_PER_FRAME);
      }
      break;

    case "stop":
      clearInterval(token);
      token = undefined;
      break;

    case "start":
      token = setInterval(update, MS_PER_FRAME);
      break;
  }
};
