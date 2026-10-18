export type MessageToWorker =
  | {
      type: "update-script";
      script: string;
    }
  | { type: "stop" }
  | { type: "start" }
  | { type: "send-buffer"; buffer: ArrayBuffer };

export type MessageFromWorker =
  | { type: "error"; error: string }
  | { type: "update"; buffer: ArrayBuffer };
