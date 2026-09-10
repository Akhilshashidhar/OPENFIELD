/// <reference lib="webworker" />

import { env, pipeline } from "@huggingface/transformers";
import {
  DEFAULT_WHISPER_MODEL,
  WHISPER_MODELS,
  isWhisperModelKey,
  type WhisperModelKey,
} from "./whisper-models";

// Host for the Whisper caption ONNX models. Configure via VITE_WHISPER_MODEL_URL
// (e.g. your own R2/CDN bucket that mirrors the ONNX-community Whisper models).
// There is intentionally NO OpenReel fallback — if this is unset, AI captions
// fail with a clear, actionable error instead of calling OpenReel infrastructure.
const MODEL_HOST = (import.meta.env.VITE_WHISPER_MODEL_URL as string | undefined) || "";

env.allowLocalModels = false;
env.allowRemoteModels = true;
if (MODEL_HOST) {
  env.remoteHost = MODEL_HOST;
}
env.remotePathTemplate = "{model}/resolve/{revision}/";
env.useBrowserCache = true;

interface WhisperOutput {
  text: string;
  chunks?: Array<{
    text: string;
    timestamp: [number | null, number | null];
  }>;
}

type WhisperPipeline = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<WhisperOutput | WhisperOutput[]>;
const createPipeline = pipeline as unknown as (
  task: string,
  model: string,
  options: Record<string, unknown>,
) => Promise<WhisperPipeline>;
interface LoadedWhisperModel {
  readonly transcriber: WhisperPipeline;
  readonly backend: "webgpu" | "wasm";
}

const transcriberPromises = new Map<
  WhisperModelKey,
  Promise<LoadedWhisperModel>
>();

function post(requestId: string, payload: Record<string, unknown>): void {
  self.postMessage({ requestId, ...payload });
}

function progressCallback(requestId: string) {
  return (event: Record<string, unknown>) => {
    post(requestId, {
      type: "model-progress",
      status: event.status,
      file: event.file,
      progress: event.progress,
      loaded: event.loaded,
      total: event.total,
    });
  };
}

async function createWhisperModel(
  requestId: string,
  modelKey: WhisperModelKey,
): Promise<LoadedWhisperModel> {
  const modelId = WHISPER_MODELS[modelKey].id;
  const canUseWebGPU = modelKey === "accurate" && "gpu" in navigator;

  if (canUseWebGPU) {
    try {
      const transcriber = await createPipeline(
        "automatic-speech-recognition",
        modelId,
        {
          device: "webgpu",
          dtype: "q4",
          progress_callback: progressCallback(requestId),
        },
      );
      return { transcriber, backend: "webgpu" };
    } catch (error) {
      console.warn("[Whisper] WebGPU unavailable; falling back to WASM", error);
    }
  }

  const transcriber = await createPipeline(
    "automatic-speech-recognition",
    modelId,
    {
      device: "wasm",
      dtype: "q4",
      progress_callback: progressCallback(requestId),
    },
  );
  return { transcriber, backend: "wasm" };
}

function loadModel(
  requestId: string,
  modelKey: WhisperModelKey,
): Promise<LoadedWhisperModel> {
  let modelPromise = transcriberPromises.get(modelKey);
  if (!modelPromise) {
    modelPromise = createWhisperModel(requestId, modelKey);
    transcriberPromises.set(modelKey, modelPromise);
    modelPromise.catch(() => {
      transcriberPromises.delete(modelKey);
    });
  }
  return modelPromise;
}

self.onmessage = async (
  event: MessageEvent<{
    requestId: string;
    type: "load" | "transcribe";
    audio?: Float32Array;
    language?: string;
    model?: WhisperModelKey;
  }>,
) => {
  const { requestId, type, audio, language } = event.data;
  const modelKey = isWhisperModelKey(event.data.model)
    ? event.data.model
    : DEFAULT_WHISPER_MODEL;
  try {
    if (!MODEL_HOST) {
      throw new Error(
        "AI captions are not configured: set VITE_WHISPER_MODEL_URL to a host " +
          "that serves the Whisper ONNX models (see .env.example / docs).",
      );
    }
    const { transcriber, backend } = await loadModel(requestId, modelKey);
    if (type === "load") {
      post(requestId, { type: "ready", model: modelKey, backend });
      return;
    }
    if (!audio?.length) throw new Error("The selected clip has no decodable audio.");

    post(requestId, { type: "transcription-progress", progress: 0.05 });
    const output = await transcriber(audio, {
      language,
      task: "transcribe",
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const result = Array.isArray(output) ? output[0] : output;
    post(requestId, {
      type: "result",
      text: result.text,
      chunks: result.chunks ?? [],
      model: modelKey,
      backend,
    });
  } catch (error) {
    post(requestId, {
      type: "error",
      message: error instanceof Error ? error.message : "Local transcription failed.",
    });
  }
};

export {};
