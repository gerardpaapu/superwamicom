import { encode } from "modern-gif";
import workerUrl from "modern-gif/worker?url";

interface Frame {
  data: BufferSource | CanvasImageSource;
  delay: number;
}

interface Recording {
  frames: Frame[];
}

let recording: Recording | undefined;

const WIDTH = 320;
const HEIGHT = 200;
const MAX_FRAMES = 60 * 5;
let onGifUrl: undefined | ((url: string) => void);
let onGifError: undefined | ((error: string) => void);

function startRecording() {
  recording = {
    frames: [],
  };
}

async function captureFrame(ctx: CanvasRenderingContext2D) {
  if (recording == undefined) {
    return;
  }

  if (recording.frames.length < MAX_FRAMES) {
    recording.frames.push({
      data: ctx.getImageData(0, 0, WIDTH, HEIGHT).data.buffer,
      delay: Math.floor(1000 / 30),
    });
  } else {
    const { frames } = recording;
    recording = undefined;
    const buffer = await encode({
      width: WIDTH,
      height: HEIGHT,
      workerUrl,
      frames,
    });

    const blob = new Blob([buffer], { type: "image/gif" });
    const url = URL.createObjectURL(blob);
    return url;
  }
}

const recorder = {
  isRecording() {
    return recording != undefined;
  },

  onUrl(f: (url: string) => void) {
    onGifUrl = f;
  },

  onError(f: (error: string) => void) {
    onGifError = f;
  },

  start() {
    startRecording();
  },

  capture(ctx: CanvasRenderingContext2D) {
    captureFrame(ctx)
      .then((url) => {
        if (url) {
          onGifUrl?.(url);
        }
      })
      .catch((e) => onGifError?.(String(e)));
  },
};

export default recorder;
