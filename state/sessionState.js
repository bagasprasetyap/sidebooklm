class SessionState {
  constructor() {
    this.reset();
  }

  reset() {
    this.id = null;
    this.pdfMeta = null;
    this.rawText = "";
    this.sourceChunks = [];
    this.chunkCount = 0;
    this.pageCount = 0;
    this.summary = "";
    this.quizItems = [];
    this.quizCompleted = false;
    this.flashcards = [];
    this.quizIndex = 0;
    this.flashcardIndex = 0;
    this.createdAt = null;
    this.updatedAt = null;
  }

  hydrate(serialized) {
    if (!serialized) {
      this.reset();
      return;
    }
    this.id = serialized.id ?? null;
    this.pdfMeta = serialized.pdfMeta ?? null;
    this.rawText = serialized.rawText ?? "";
    this.sourceChunks = Array.isArray(serialized.sourceChunks) ? serialized.sourceChunks : [];
    this.chunkCount = serialized.chunkCount ?? 0;
    this.pageCount = serialized.pageCount ?? 0;
    this.summary = serialized.summary ?? "";
    this.quizItems = Array.isArray(serialized.quizItems) ? serialized.quizItems : [];
    this.quizCompleted = Boolean(serialized.quizCompleted);
    this.flashcards = Array.isArray(serialized.flashcards) ? serialized.flashcards : [];
    this.quizIndex = serialized.quizIndex ?? 0;
    this.flashcardIndex = serialized.flashcardIndex ?? 0;
    this.createdAt = serialized.createdAt ?? null;
    this.updatedAt = serialized.updatedAt ?? null;
  }

  setPdfMeta(meta) {
    this.pdfMeta = meta;
    this.id = meta?.id ?? this.id;
    this.touch();
  }

  setSourceText({ text, chunkCount, pageCount, chunks }) {
    this.rawText = text;
    this.chunkCount = chunkCount ?? this.chunkCount;
    this.pageCount = pageCount ?? this.pageCount;
    this.sourceChunks = Array.isArray(chunks) ? chunks : this.sourceChunks;
    this.touch();
  }

  setSummary(summary) {
    this.summary = summary ?? "";
    this.touch();
  }

  setQuizItems(items) {
    this.quizItems = Array.isArray(items) ? items : [];
    this.quizIndex = 0;
    this.quizCompleted = false;
    this.touch();
  }

  setFlashcards(cards) {
    this.flashcards = Array.isArray(cards) ? cards : [];
    this.flashcardIndex = 0;
    this.touch();
  }

  setQuizIndex(index) {
    this.quizIndex = Math.max(0, Math.min(index, this.quizItems.length - 1));
    this.touch();
  }

  setQuizCompleted(value) {
    this.quizCompleted = Boolean(value);
    this.touch();
  }

  setFlashcardIndex(index) {
    this.flashcardIndex = Math.max(0, Math.min(index, this.flashcards.length - 1));
    this.touch();
  }

  touch() {
    const now = new Date().toISOString();
    this.updatedAt = now;
    if (!this.createdAt) {
      this.createdAt = now;
    }
  }

  toJSON() {
    return {
      id: this.id,
      pdfMeta: this.pdfMeta,
      rawText: this.rawText,
      sourceChunks: this.sourceChunks,
      chunkCount: this.chunkCount,
      pageCount: this.pageCount,
      summary: this.summary,
      quizItems: this.quizItems,
      quizCompleted: this.quizCompleted,
      flashcards: this.flashcards,
      quizIndex: this.quizIndex,
      flashcardIndex: this.flashcardIndex,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

export const sessionState = new SessionState();
