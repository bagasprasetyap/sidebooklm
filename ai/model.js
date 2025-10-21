import {
  SUMMARY_SCHEMA,
  QUIZ_SCHEMA,
  FLASHCARD_SCHEMA,
  normalizeSummary,
  normalizeQuizItems,
  normalizeFlashcards,
  createSummaryPrompt,
  createQuizPrompt,
  createFlashcardPrompt,
  buildContext,
  parseFlashcardsFromText
} from "./prompts.js";

const AVAILABILITY_OPTIONS = {
  expectedInputs: [
    { type: "text", languages: ["en"] }
  ],
  expectedOutputs: [
    { type: "text", languages: ["en"] }
  ]
};

let languageModelInterface;
let activeSession;

function clampDesiredCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return Math.min(20, Math.max(1, parsed));
}

function enforceItemCount(items, desiredCount) {
  const count = clampDesiredCount(desiredCount);
  if (!count || !Array.isArray(items)) {
    return items;
  }
  if (items.length > count) {
    return items.slice(0, count);
  }
  return items;
}

function resolveLanguageModel() {
  if (languageModelInterface) {
    return languageModelInterface;
  }
  if (typeof globalThis.LanguageModel !== "undefined") {
    languageModelInterface = globalThis.LanguageModel;
    return languageModelInterface;
  }
  if (globalThis.ai?.languageModel) {
    languageModelInterface = globalThis.ai.languageModel;
    return languageModelInterface;
  }
  throw new Error("Prompt API is not available in this context.");
}

export async function ensureSession({ onStatus, onDownloadProgress } = {}) {
  const LanguageModel = resolveLanguageModel();

  const availability = (await LanguageModel.availability?.(AVAILABILITY_OPTIONS)) ??
    (await LanguageModel.availability?.());

  if (availability === "unavailable" || availability === "no") {
    throw new Error("Gemini Nano language model is unavailable on this device.");
  }

  if (availability === "downloadable") {
    onStatus?.("Downloading Gemini Nano model…");
    onDownloadProgress?.(0);
  } else if (availability === "downloading") {
    onStatus?.("Gemini Nano model download in progress…");
    onDownloadProgress?.(0);
  } else {
    onStatus?.("Preparing Gemini Nano session…");
  }

  if (activeSession) {
    return activeSession;
  }

  const session = await LanguageModel.create({
    ...AVAILABILITY_OPTIONS,
    monitor(monitor) {
      monitor.addEventListener("downloadprogress", (event) => {
        if (typeof event.loaded === "number") {
          onDownloadProgress?.(Math.round(event.loaded * 100));
        }
      });
    }
  });

  activeSession = session;
  return session;
}

export async function destroySession() {
  try {
    await activeSession?.destroy?.();
  } catch (error) {
    console.warn("Failed to destroy session", error);
  } finally {
    activeSession = null;
  }
}

async function promptStructured({ prompt, schema, signal, onPartial }) {
  const session = await ensureSession();

  if (typeof session.promptStreaming === "function") {
    const stream = session.promptStreaming(prompt, {
      responseConstraint: schema,
      signal
    });

    let result = "";
    for await (const chunk of stream) {
      result += chunk;
      onPartial?.(chunk, result);
    }
    return result;
  }

  const result = await session.prompt(prompt, {
    responseConstraint: schema,
    signal
  });
  onPartial?.(result, result);
  return result;
}

async function promptFreeform({ prompt, signal, onPartial }) {
  const session = await ensureSession();

  if (typeof session.promptStreaming === "function") {
    const stream = session.promptStreaming(prompt, { signal });
    let result = "";
    for await (const chunk of stream) {
      result += chunk;
      onPartial?.(chunk, result);
    }
    return result;
  }

  const result = await session.prompt(prompt, { signal });
  onPartial?.(result, result);
  return result;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn("Failed to parse JSON response", error, text);
    return null;
  }
}

export async function generateSummary({
  text,
  chunks,
  pageCount,
  meta,
  signal,
  onStatus,
  onDownloadProgress
}) {
  const context = buildContext({ text, chunks, pageCount });

  await ensureSession({ onStatus, onDownloadProgress });

  onStatus?.("Generating summary…");
  const raw = await promptStructured({
    prompt: createSummaryPrompt(meta, context),
    schema: SUMMARY_SCHEMA,
    signal,
    onPartial: (chunk) => {
      if (chunk) {
        onStatus?.("Generating summary…");
      }
    }
  });

  const parsed = safeJsonParse(raw);
  const summary = normalizeSummary(parsed ?? raw);
  if (!summary) {
    throw new Error("Summary generation returned no content.");
  }
  onStatus?.("Summary ready.");
  return summary;
}

export async function generateQuiz({
  text,
  chunks,
  pageCount,
  meta,
  signal,
  onStatus,
  onDownloadProgress,
  desiredCount
}) {
  const context = buildContext({ text, chunks, pageCount });

  await ensureSession({ onStatus, onDownloadProgress });

  onStatus?.("Generating quiz questions…");
  const quizRaw = await promptStructured({
    prompt: createQuizPrompt(meta, context, { desiredCount }),
    schema: QUIZ_SCHEMA,
    signal,
    onPartial: (chunk) => {
      if (chunk) {
        onStatus?.("Generating quiz questions…");
      }
    }
  });

  const parsedQuiz = safeJsonParse(quizRaw);
  let quizItems = normalizeQuizItems(parsedQuiz ?? quizRaw);
  quizItems = enforceItemCount(quizItems, desiredCount);
  onStatus?.("Quiz generation complete.");
  return quizItems;
}

export async function generateFlashcards({
  text,
  chunks,
  pageCount,
  meta,
  signal,
  onStatus,
  onDownloadProgress,
  desiredCount
}) {
  const context = buildContext({ text, chunks, pageCount });

  await ensureSession({ onStatus, onDownloadProgress });

  onStatus?.("Generating flashcards…");
  const flashRaw = await promptStructured({
    prompt: createFlashcardPrompt(meta, context, { desiredCount }),
    schema: FLASHCARD_SCHEMA,
    signal,
    onPartial: (chunk) => {
      if (chunk) {
        onStatus?.("Generating flashcards…");
      }
    }
  });

  const parsedFlash = safeJsonParse(flashRaw);
  let flashcards = normalizeFlashcards(parsedFlash ?? flashRaw);
  flashcards = enforceItemCount(flashcards, desiredCount);

  if (!flashcards.length) {
    onStatus?.("Retrying flashcard generation with relaxed format…");
    const relaxedPrompt = `${createFlashcardPrompt(meta, context, { desiredCount })}\n\nRespond with a JSON array named flashcards, where each item has "question" and "answer" fields. If you cannot produce the requested amount, return as many unique items as possible without duplicating content.`;
    const relaxedRaw = await promptFreeform({
      prompt: relaxedPrompt,
      signal,
      onPartial: (chunk) => {
        if (chunk) {
          onStatus?.("Parsing flashcard responses…");
        }
      }
    });
    const parsedRelaxed = safeJsonParse(relaxedRaw);
    const relaxedCandidates = normalizeFlashcards(parsedRelaxed ?? relaxedRaw);
    flashcards =
      (relaxedCandidates.length ? relaxedCandidates : parseFlashcardsFromText(relaxedRaw));
    flashcards = enforceItemCount(flashcards, desiredCount);
  }

  onStatus?.("Flashcards ready.");
  return flashcards;
}
