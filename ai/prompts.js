const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "is",
  "are",
  "was",
  "were",
  "be",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "as",
  "that",
  "this",
  "it",
  "by",
  "from",
  "at",
  "about",
  "into",
  "over",
  "after",
  "than",
  "because",
  "through",
  "during",
  "before",
  "under",
  "around"
]);

export const SUMMARY_SCHEMA = {
  type: "object",
  required: ["summary"],
  additionalProperties: false,
  properties: {
    summary: { type: "string", minLength: 50, maxLength: 1600 }
  }
};

export const QUIZ_SCHEMA = {
  type: "array",
  minItems: 1,
  maxItems: 20,
  items: {
    type: "object",
    required: ["question", "options", "answer"],
    additionalProperties: false,
    properties: {
      question: { type: "string", minLength: 8 },
      options: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: { type: "string", minLength: 1 }
      },
      answer: { type: "string", minLength: 1 },
      explanation: { type: "string" }
    }
  }
};

export const FLASHCARD_SCHEMA = {
  type: "array",
  minItems: 1,
  maxItems: 20,
  items: {
    type: "object",
    required: ["question", "answer"],
    properties: {
      question: { type: "string", minLength: 6 },
      answer: { type: "string", minLength: 10 },
      tags: {
        type: "array",
        items: { type: "string" }
      }
    }
  }
};

export function createSummaryPrompt(meta, context) {
  return [
    `You are an experienced educator summarizing a document for study preparation.`,
    `Document title: ${meta.name}`,
    `Pages: ${context.pageCount}, Chunks analyzed: ${context.chunkCount}`,
    `Key topics: ${context.keyTerms.join(", ")}`,
    ``,
    `Write a cohesive summary under 200 words that captures the central ideas, goals, and supporting evidence from the material.`,
    `Prioritize clarity over detail, avoid bullet points, and keep the tone neutral and informative.`,
    ``,
    `Return only JSON matching the provided schema.`,
    ``,
    `Reference material you can cite:`,
    context.previewText
  ].join("\n");
}

function normalizeDesiredCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return Math.min(20, Math.max(1, parsed));
}

export function createQuizPrompt(meta, context, options = {}) {
  const normalizedCount = normalizeDesiredCount(options.desiredCount);
  const questionLabel = normalizedCount === 1 ? "question" : "questions";
  const countInstruction = normalizedCount
    ? `Create exactly ${normalizedCount} multiple-choice ${questionLabel} that assess important facts and reasoning.`
    : `Create 6 to 8 multiple-choice questions that assess important facts and reasoning.`;

  return [
    `You are a skilled instructional designer generating high-quality multiple choice questions based on a document.`,
    `Document title: ${meta.name}`,
    `Pages: ${context.pageCount}, Extracted chunks: ${context.chunkCount}`,
    `Key topics: ${context.keyTerms.join(", ")}`,
    `Summary:\n${context.summary}`,
    ``,
    countInstruction,
    `Rules:`,
    `- Each question must have exactly four options.`,
    `- Only one option should be correct.`,
    `- Do not include phrases like "Option A" or "All of the above".`,
    `- Provide a short explanation for the correct answer (<= 2 sentences).`,
    `- Avoid repeating questions or using identical wording.`,
    ``,
    `Return only JSON matching the provided schema.`,
    ``,
    `Reference material you can cite:`,
    context.previewText
  ].join("\n");
}

export function createFlashcardPrompt(meta, context, options = {}) {
  const normalizedCount = normalizeDesiredCount(options.desiredCount);
  const flashcardLabel = normalizedCount === 1 ? "flashcard" : "flashcards";
  const countInstruction = normalizedCount
    ? `Create exactly ${normalizedCount} ${flashcardLabel}. Each card should pair a concise question with a detailed answer that reinforces understanding.`
    : `Create between 8 and 12 flashcards. Each card should pair a concise question with a detailed answer that reinforces understanding.`;

  return [
    `You are an expert tutor extracting flashcards from study material.`,
    `Document title: ${meta.name}`,
    `Pages: ${context.pageCount}, Chunks analyzed: ${context.chunkCount}`,
    `Key topics: ${context.keyTerms.join(", ")}`,
    `Summary:\n${context.summary}`,
    ``,
    countInstruction,
    `Prefer conceptual prompts ("What is...", "How does...") and avoid yes/no questions. Keep the output strictly in JSON format.`,
    `Keep answers under 80 words and focus on clarity.`,
    ``,
    `Return only JSON matching the provided schema.`,
    ``,
    `Reference material you can cite:`,
    context.previewText
  ].join("\n");
}

export function buildContext({ text, chunks, pageCount }) {
  const summary = summarizeText(text);
  const keyTerms = extractKeyTerms(text, 12);
  const previewText = (chunks || []).slice(0, 3).join("\n\n");

  return {
    summary,
    keyTerms,
    previewText,
    chunkCount: chunks?.length ?? 0,
    pageCount: pageCount ?? 0
  };
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function extractKeyTerms(text, limit) {
  if (!text) {
    return [];
  }
  const frequencies = new Map();
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    if (STOP_WORDS.has(token) || token.length <= 3) continue;
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }

  return [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}

function summarizeText(text, sentencesLimit = 6) {
  if (!text) {
    return "No textual content extracted.";
  }

  const sentences = text
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]+/g) || [text];

  const trimmed = sentences.slice(0, sentencesLimit).map((sentence) => sentence.trim());
  return trimmed.join(" ");
}

export function normalizeSummary(raw) {
  if (!raw) {
    return "";
  }

  let summaryText = "";
  if (typeof raw === "string") {
    summaryText = raw;
  } else if (typeof raw === "object") {
    const candidateKeys = ["summary", "result", "content", "text", "value"];
    for (const key of candidateKeys) {
      if (typeof raw[key] === "string") {
        summaryText = raw[key];
        break;
      }
    }
  }

  summaryText = normalizeWhitespace(summaryText || "");
  if (!summaryText) {
    return "";
  }

  const words = summaryText.split(/\s+/);
  if (words.length > 200) {
    summaryText = words.slice(0, 200).join(" ");
  }

  return summaryText;
}

export function normalizeQuizItems(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const question = normalizeWhitespace(item.question ?? "");
      const options = Array.isArray(item.options) ? item.options.map(normalizeWhitespace) : [];
      const answer = normalizeWhitespace(item.answer ?? "");
      const explanation = item.explanation ? normalizeWhitespace(item.explanation) : "";
      if (!question || options.length !== 4 || !answer) {
        return null;
      }
      return { question, options, answer, explanation };
    })
    .filter(Boolean);
}

export function unwrapFlashcardPayload(raw) {
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return unwrapFlashcardPayload(parsed);
    } catch {
      return [];
    }
  }
  if (typeof raw === "object") {
    const candidateKeys = ["flashcards", "cards", "items", "data", "set"];
    for (const key of candidateKeys) {
      if (key in raw) {
        const unwrapped = unwrapFlashcardPayload(raw[key]);
        if (unwrapped.length) {
          return unwrapped;
        }
      }
    }
    // Some models respond with numbered keys (e.g., { "0": {...}, "1": {...} }).
    const numericKeys = Object.keys(raw).filter((key) => /^[0-9]+$/.test(key));
    if (numericKeys.length) {
      return numericKeys.map((key) => raw[key]);
    }
  }
  return [];
}

export function normalizeFlashcards(raw) {
  const payload = unwrapFlashcardPayload(raw);
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const questionValue =
        item.question ??
        item.prompt ??
        item.front ??
        item.frontText ??
        item.q ??
        item.term ??
        "";
      const answerValue =
        item.answer ??
        item.response ??
        item.back ??
        item.backText ??
        item.a ??
        item.definition ??
        "";
      const question = normalizeWhitespace(questionValue);
      const answer = normalizeWhitespace(answerValue);
      const tags = Array.isArray(item.tags) ? item.tags.map(normalizeWhitespace) : [];
      if (!question || !answer) {
        return null;
      }
      return { question, answer, tags };
    })
    .filter(Boolean);
}

export function parseFlashcardsFromText(text) {
  if (!text) {
    return [];
  }
  const candidates = [];

  // Try to extract JSON array substring from free-form text.
  const jsonStart = text.indexOf("[");
  const jsonEnd = text.lastIndexOf("]");
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    const maybeJson = text.slice(jsonStart, jsonEnd + 1);
    try {
      const parsed = JSON.parse(maybeJson);
      const normalized = normalizeFlashcards(parsed);
      if (normalized.length) {
        return normalized;
      }
    } catch {
      // fall through to text parsing
    }
  }

  // Parse simple text format: Question: ... Answer: ...
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  for (const block of blocks) {
    const questionMatch = block.match(/(?:Q(?:uestion)?|Front)\s*[:\-]\s*(.+)/i);
    const answerMatch = block.match(/(?:A(?:nswer)?|Back)\s*[:\-]\s*(.+)/i);
    if (questionMatch && answerMatch) {
      candidates.push({
        question: normalizeWhitespace(questionMatch[1]),
        answer: normalizeWhitespace(answerMatch[1]),
        tags: []
      });
      continue;
    }

    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length >= 2) {
      const question = lines[0];
      const answer = lines.slice(1).join(" ");
      candidates.push({
        question: normalizeWhitespace(question),
        answer: normalizeWhitespace(answer),
        tags: []
      });
    }
  }

  return candidates.filter((card) => card.question && card.answer);
}
