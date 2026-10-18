import { defaultKeymap } from "@codemirror/commands";
import type { MessageFromWorker, MessageToWorker } from "./message.ts";
import palette from "./palette/beach-day.ts";
import Sandbox from "./sandbox.ts?worker";
import { javascript } from "@codemirror/lang-javascript";
import { keymap } from "@codemirror/view";
import { EditorView, basicSetup } from "codemirror";
import { dracula as theme } from "thememirror";
import recorder from "./record-gif.ts";

const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 200;
const HALF_SCREEN_WIDTH = 160;

let worker = new Sandbox();
let wamicom_buffer = new ArrayBuffer(HALF_SCREEN_WIDTH * SCREEN_HEIGHT);

const recordButton = document.getElementById("ButtonRecord") as HTMLInputElement;
recordButton.disabled = false;
recordButton?.addEventListener("click", (e) => {
  e.preventDefault();
  recorder.start();
  recordButton.disabled = true;
  recordButton.value = "Recording...";
});

recorder.onError((err) => {
  console.error(err);
  recordButton.disabled = false;
});

recorder.onUrl((url) => {
  recordButton.disabled = false;
  const link = document.createElement("a");
  try {
    link.style.visibility = "hidden";
    link.style.display = "none";
    document.body.appendChild(link);
    link.href = url;
    link.download = "wamicom.gif";
    link.click();
  } finally {
    link.remove();
  }
});

let ctx: CanvasRenderingContext2D | null;
const getCanvas = () => document.getElementById("WamicomCanvas") as null | HTMLCanvasElement;

const getContext = () => {
  if (ctx) {
    return ctx;
  }

  const canvas = getCanvas();
  if (canvas) {
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  }
  return ctx;
};

const updateCanvas = () => {
  const ctx = getContext();
  if (ctx == undefined || wamicom_buffer == undefined || wamicom_buffer.byteLength === 0) {
    return;
  }

  const img = ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
  const buf = img.data;
  const arr = new Uint8ClampedArray(wamicom_buffer);
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let xh = 0; xh < HALF_SCREEN_WIDTH; xh++) {
      const x = xh * 2;
      const j = y * HALF_SCREEN_WIDTH + xh;
      const i = (y * SCREEN_WIDTH + x) * 4;

      const highNibble = arr[j] >>> 4;
      const lowNibble = arr[j] & 0xf;
      const color_1 = palette[highNibble] as number;
      const color_2 = palette[lowNibble] as number;

      buf[i + 0] = (color_1 >>> 16) & 0xff;
      buf[i + 1] = (color_1 >>> 8) & 0xff;
      buf[i + 2] = (color_2 >>> 0) & 0xff;
      buf[i + 3] = 0xff; // alpha

      buf[i + 4] = (color_2 >>> 16) & 0xff;
      buf[i + 5] = (color_2 >>> 8) & 0xff;
      buf[i + 6] = (color_2 >>> 0) & 0xff;
      buf[i + 7] = 0xff; // alpha
    }
  }

  ctx.putImageData(img, 0, 0);
  if (recorder.isRecording()) {
    recorder.capture(ctx);
  }

  let message: MessageToWorker = {
    type: "send-buffer",
    buffer: wamicom_buffer,
  };
  worker.postMessage(message, [wamicom_buffer]);
};

const defaultScript = `const clamp = (a, n, x) => Math.min(Math.max(a, n), x);
const toColor = (x) => clamp(Math.floor(x), 0, 15);

const pixel = (x, y, t) => {
  const scaled_y = y / 200;
  const jitter = Math.sin(Math.PI * 10 * scaled_y) * 50 * scaled_y;
  const scaled_x = (Math.PI * x + jitter) / 160;

  const height = (Math.sin(scaled_x + t * 0.03) + 1) * 0.5;

  return toColor(16 * (scaled_y - height));
};`;

let script_ = defaultScript;

function tryAtoB(src: string | null | undefined) {
  if (!src) {
    return undefined;
  }
  try {
    return atob(src);
  } catch {
    return undefined;
  }
}

let fromHash = tryAtoB(window.location.hash.slice(1));
if (fromHash) {
  script_ = fromHash;
}

function updateScript() {
  let message: MessageToWorker = {
    type: "update-script",
    script: script_,
  };
  if (script_ === defaultScript) {
    window.location.hash = "";
  } else {
    window.location.hash = btoa(script_);
  }

  worker.postMessage(message);
}

const start = () => {
  const el = document.getElementById("code");
  new EditorView({
    doc: script_,
    parent: el!,
    extensions: [
      basicSetup,
      javascript({ typescript: true }),
      theme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          script_ = update.state.doc.toString();
        }
      }),
      keymap.of([
        ...defaultKeymap,
        {
          key: "Ctrl-s",
          run: () => {
            updateScript();
            return true;
          },
        },
      ]),
    ],
  });

  document.forms[0].addEventListener("submit", (e) => {
    e.preventDefault();
    updateScript();
  });

  document.forms[0].addEventListener("reset", (e) => {
    e.preventDefault();
    window.location.hash = "";
    script_ = defaultScript;
  });

  worker.onmessage = (e: MessageEvent<MessageFromWorker>) => {
    const { data } = e;
    switch (data.type) {
      case "error":
        console.error(data.error);
        break;

      case "update":
        wamicom_buffer = data.buffer;
        updateCanvas();
        break;
    }
  };

  let message: MessageToWorker;
  message = { type: "send-buffer", buffer: wamicom_buffer };
  worker.postMessage(message, [wamicom_buffer]);

  message = { type: "start" };
  worker.postMessage(message);

  message = { type: "update-script", script: script_ };
  worker.postMessage(message);
};

start();
