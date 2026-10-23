import { defaultKeymap } from "@codemirror/commands";
// import type { MessageFromWorker, MessageToWorker } from "./message.ts";
import palette from "./palette/beach-day.ts";
// import Sandbox from "./sandbox.ts?worker";
import { javascript } from "@codemirror/lang-javascript";
import { keymap } from "@codemirror/view";
import { EditorView, basicSetup } from "codemirror";
import { dracula as theme } from "thememirror";
import recorder from "./record-gif.ts";
import asmSrc from "../asm/asm-template.ts?raw";
import { compile, type AsmModule } from "./asm.ts";

let asmModule: AsmModule | undefined;

const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 200;
const HALF_SCREEN_WIDTH = 160;

// let worker = new Sandbox();
// let wamicom_buffer = new ArrayBuffer(HALF_SCREEN_WIDTH * SCREEN_HEIGHT);
let editor: EditorView | undefined;

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

let FRAME_TIME_LENGTH = 4;
let FPS_FACTOR = FRAME_TIME_LENGTH * 1_000;
let frameTimes = [-Infinity, -Infinity, -Infinity, -Infinity];
let frameIdx = 0;
let fps = 0;
let t = 0;

const updateCanvas = () => {
  {
    frameTimes[frameIdx] = performance.now();
    const duration = frameTimes[frameIdx] - frameTimes[(frameIdx - 1) % FRAME_TIME_LENGTH];
    fps = FPS_FACTOR / duration;
    frameIdx++;
    frameIdx %= FRAME_TIME_LENGTH;

    if (t % 500 === FRAME_TIME_LENGTH) {
      console.log(`FPS: ${fps.toFixed(2).padStart(8, " ")}`);
    }
  }

  if (asmModule == undefined) {
    setTimeout(updateCanvas);
    return;
  }

  try {
    asmModule.update_buffer(t++);
  } catch (e) {
    console.error(e);
    return;
  }

  let wamicom_buffer = asmModule.get_buffer();
  const ctx = getContext();
  if (ctx == undefined || wamicom_buffer == undefined || wamicom_buffer.byteLength === 0) {
    return;
  }

  const img = ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
  const buf = img.data;
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let xh = 0; xh < HALF_SCREEN_WIDTH; xh++) {
      const x = xh * 2;
      const j = y * HALF_SCREEN_WIDTH + xh;
      const i = (y * SCREEN_WIDTH + x) * 4;

      const highNibble = wamicom_buffer[j] >>> 4;
      const lowNibble = wamicom_buffer[j] & 0xf;
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
  setTimeout(updateCanvas);
  if (recorder.isRecording()) {
    recorder.capture(ctx);
  }
};

const defaultScript = asmSrc;

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

const params = new URLSearchParams(window.location.search);
if (params.get("data")) {
  const url = new URL(window.location.origin);
  window.location.replace(`${url}#${params.get("data")}`);
}

let fromHash = tryAtoB(window.location.hash.slice(1));
if (fromHash) {
  script_ = fromHash;
}

function updateScript() {
  // let message: MessageToWorker = {
  //   type: "update-script",
  //   script: script_,
  // };

  compile(script_)
    .then((m) => {
      asmModule = m;
    })
    .catch((e) => console.error(e));
  if (script_ === defaultScript) {
    window.location.hash = "";
  } else {
    window.location.hash = btoa(script_);
  }
  if (editor !== undefined && script_ !== editor.state.doc.toString()) {
    editor.dispatch({
      changes: {
        from: 0,
        to: editor.state.doc.length,
        insert: script_,
      },
    });
  }
  setTimeout(updateCanvas);
  // worker.postMessage(message);
}

const start = () => {
  const el = document.getElementById("code");
  editor = new EditorView({
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
    updateScript();
  });
  updateScript();
  setTimeout(updateCanvas);

  //   worker.onmessage = (e: MessageEvent<MessageFromWorker>) => {
  //     const { data } = e;
  //     switch (data.type) {
  //       case "error":
  //         console.error(data.error);
  //         break;

  //       case "update":
  //         wamicom_buffer = data.buffer;
  //         updateCanvas();
  //         break;
  //     }
  //   };

  //   let message: MessageToWorker;
  //   message = { type: "send-buffer", buffer: wamicom_buffer };
  //   worker.postMessage(message, [wamicom_buffer]);

  //   message = { type: "start" };
  //   worker.postMessage(message);

  //   message = { type: "update-script", script: script_ };
  //   worker.postMessage(message);
};

start();
