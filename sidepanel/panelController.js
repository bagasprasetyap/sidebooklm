import { sessionState } from "../state/sessionState.js";
import { showStatus, showProgress, resetStatus, showSpinner, hideSpinner, hideProgress } from "../state/status.js";
import { extractPdfText, computeDocumentMetadata, splitIntoChunks } from "../pdf/pdfExtractor.js";
import { generateSummary, generateQuiz, generateFlashcards, destroySession } from "../ai/model.js";
import {
  saveSession,
  loadSession,
  getLastSessionId
} from "../db/storage.js";
import { setupQuizView, renderQuizView, resetQuizSelections } from "./quizView.js";
import { setupFlashcardView, renderFlashcardView } from "./flashcardView.js";
import { renderSummaryView } from "./summaryView.js";
import { getQuizTargetCount, getFlashcardTargetCount } from "./studySettings.js";

const TAB_IDS = new Set(["summary", "quiz", "flashcard"]);

let abortController = null;
let persistTimeout = null;
let currentTab = "summary";

const generationState = {
  summary: "idle",
  quiz: "idle",
  flashcard: "idle"
};

let spinnerUsers = 0;
let hideProgressTimeout = null;

function acquireSpinner() {
  spinnerUsers += 1;
  showSpinner();
}

function releaseSpinner() {
  spinnerUsers = Math.max(0, spinnerUsers - 1);
  if (spinnerUsers === 0) {
    hideSpinner();
  }
}

function getTabButton(tabId) {
  return document.querySelector(`.tab-button[data-tab="${tabId}"]`);
}

function setGenerationStatus(tabKey, status) {
  generationState[tabKey] = status;
  const button = getTabButton(tabKey);
  if (button) {
    button.dataset.state = status;
  }
}

function resetGenerationStatuses() {
  setGenerationStatus("summary", "idle");
  setGenerationStatus("quiz", "idle");
  setGenerationStatus("flashcard", "idle");
}

function syncGenerationStatusesFromSession() {
  setGenerationStatus("summary", sessionState.summary ? "done" : "idle");
  setGenerationStatus("quiz", sessionState.quizItems.length ? "done" : "idle");
  setGenerationStatus("flashcard", sessionState.flashcards.length ? "done" : "idle");
}

function ensureSourceChunks() {
  if (Array.isArray(sessionState.sourceChunks) && sessionState.sourceChunks.length) {
    return sessionState.sourceChunks;
  }
  if (!sessionState.rawText) {
    return [];
  }
  const chunks = splitIntoChunks(sessionState.rawText);
  sessionState.setSourceText({
    text: sessionState.rawText,
    chunkCount: chunks.length,
    pageCount: sessionState.pageCount,
    chunks
  });
  return chunks;
}

function schedulePersist() {
  if (!sessionState.id) return;
  clearTimeout(persistTimeout);
  persistTimeout = setTimeout(() => {
    saveSession(sessionState).catch((error) => console.warn("Failed to persist session", error));
  }, 400);
}

function renderAllViews() {
  renderSummaryView({
    summary: sessionState.summary,
    pdfMeta: sessionState.pdfMeta,
    pageCount: sessionState.pageCount,
    isGenerating: generationState.summary === "pending",
    hasError: generationState.summary === "error"
  });

  renderQuizView({
    quizItems: sessionState.quizItems,
    currentIndex: sessionState.quizIndex,
    isGenerating: generationState.quiz === "pending",
    hasError: generationState.quiz === "error",
    isCompleted: sessionState.quizCompleted
  });

  renderFlashcardView({
    flashcards: sessionState.flashcards,
    currentIndex: sessionState.flashcardIndex,
    isGenerating: generationState.flashcard === "pending",
    hasError: generationState.flashcard === "error"
  });
}

function displaySessionStatus({ note } = {}) {
  const { pdfMeta, summary, quizItems, flashcards, updatedAt, createdAt } = sessionState;
  if (!pdfMeta) {
    resetStatus();
    return;
  }

  const lines = [];
  lines.push(pdfMeta.name || "Untitled PDF");

  lines.push(
    generationState.summary === "pending"
      ? "Summary generating…"
      : generationState.summary === "error"
        ? "Summary generation failed."
        : summary
          ? "Summary ready."
          : "Summary not generated."
  );

  lines.push(
    generationState.quiz === "pending"
      ? "Quiz generating…"
      : generationState.quiz === "error"
        ? "Quiz generation failed."
        : quizItems.length
          ? `Quiz ready (${quizItems.length} question${quizItems.length === 1 ? "" : "s"}).`
          : generationState.quiz === "done"
            ? "Quiz generation completed with no results."
            : "Quiz not generated."
  );

  lines.push(
    generationState.flashcard === "pending"
      ? "Flashcards generating…"
      : generationState.flashcard === "error"
        ? "Flashcard generation failed."
        : flashcards.length
          ? `Flashcards ready (${flashcards.length} item${flashcards.length === 1 ? "" : "s"}).`
          : generationState.flashcard === "done"
            ? "Flashcard generation completed with no results."
            : "Flashcards not generated."
  );

  const timestamp = new Date(updatedAt || createdAt || Date.now()).toLocaleString();
  lines.push(`Updated ${timestamp}`);
  if (note) {
    lines.push(note);
  }

  showStatus(lines.join("\n"));
}

async function loadSessionById(id) {
  const stored = await loadSession(id);
  if (!stored) return;
  sessionState.hydrate(stored);
  resetQuizSelections();
  if (sessionState.quizCompleted) {
    sessionState.setQuizCompleted(false);
  }
  syncGenerationStatusesFromSession();
  renderAllViews();
  displaySessionStatus();
}

function resetStatusDelayed() {
  setTimeout(() => resetStatus(), 1600);
}

async function runSummaryStep({ text, chunks, pageCount, meta, signal }) {
  setGenerationStatus("summary", "pending");
  renderAllViews();
  showStatus("Generating summary…");

  try {
    const summary = await generateSummary({
      text,
      chunks,
      pageCount,
      meta,
      signal,
      onStatus: (message) => {
        if (message) {
          showStatus(message);
        }
      }
    });

    sessionState.setSummary(summary);
    setGenerationStatus("summary", "done");
    renderAllViews();
    showProgress(60);

    let saveFailed = false;
    try {
      await saveSession(sessionState);
    } catch (error) {
      saveFailed = true;
      console.warn("Failed to save session", error);
    }

    const note = saveFailed
      ? "Saving summary failed; study data will not persist across reloads."
      : "Summary ready. Generating quiz…";
    displaySessionStatus({ note });
    return true;
  } catch (error) {
    if (error.name === "AbortError") {
      setGenerationStatus("summary", "idle");
      renderAllViews();
      throw error;
    }
    console.error("Failed to generate summary", error);
    setGenerationStatus("summary", "error");
    renderAllViews();
    showStatus(error.message || "Failed to generate summary.");
    displaySessionStatus();
    return false;
  }
}

async function runQuizStep({ text, chunks, pageCount, meta, signal }) {
  setGenerationStatus("quiz", "pending");
  renderAllViews();
  showStatus("Generating quiz questions…");

  try {
    const desiredCount = getQuizTargetCount();
    const quizItems = await generateQuiz({
      text,
      chunks: chunks.length ? chunks : ensureSourceChunks(),
      pageCount,
      meta,
      signal,
      desiredCount,
      onStatus: (message) => {
        if (message) {
          showStatus(message);
        }
      }
    });

    sessionState.setQuizItems(quizItems);
    resetQuizSelections();
    setGenerationStatus("quiz", "done");
    renderAllViews();
    showProgress(85);
    schedulePersist();

    const note = !quizItems.length
      ? "Quiz generation was unavailable for this PDF."
      : "Quiz ready. Generating flashcards…";
    displaySessionStatus({ note });
    return true;
  } catch (error) {
    if (error.name === "AbortError") {
      setGenerationStatus("quiz", "idle");
      renderAllViews();
      throw error;
    }
    console.error("Failed to generate quiz", error);
    setGenerationStatus("quiz", "error");
    renderAllViews();
    showStatus(error.message || "Failed to generate quiz questions.");
    displaySessionStatus();
    return false;
  }
}

async function runFlashcardStep({ text, chunks, pageCount, meta, signal }) {
  setGenerationStatus("flashcard", "pending");
  renderAllViews();
  showStatus("Generating flashcards…");

  try {
    const desiredCount = getFlashcardTargetCount();
    const flashcards = await generateFlashcards({
      text,
      chunks: chunks.length ? chunks : ensureSourceChunks(),
      pageCount,
      meta,
      signal,
      desiredCount,
      onStatus: (message) => {
        if (message) {
          showStatus(message);
        }
      }
    });

    sessionState.setFlashcards(flashcards);
    setGenerationStatus("flashcard", "done");
    renderAllViews();
    showProgress(100);
    schedulePersist();

    const note = !flashcards.length
      ? "Flashcard generation was unavailable for this PDF."
      : "Flashcards ready.";
    displaySessionStatus({ note });
    return true;
  } catch (error) {
    if (error.name === "AbortError") {
      setGenerationStatus("flashcard", "idle");
      renderAllViews();
      throw error;
    }
    console.error("Failed to generate flashcards", error);
    setGenerationStatus("flashcard", "error");
    renderAllViews();
    showStatus(error.message || "Failed to generate flashcards.");
    displaySessionStatus();
    return false;
  }
}

async function runGenerationQueue(params) {
  const summarySuccess = await runSummaryStep(params);
  if (!summarySuccess) {
    return;
  }

  await runQuizStep(params);
  await runFlashcardStep(params);
}

export async function loadInitialState() {
  setupQuizView({
    onPrevious: () => {
      sessionState.setQuizCompleted(false);
      sessionState.setQuizIndex(sessionState.quizIndex - 1);
      renderAllViews();
      schedulePersist();
    },
    onNext: () => {
      const total = sessionState.quizItems.length;
      if (!total) {
        return;
      }
      if (sessionState.quizIndex >= total - 1) {
        sessionState.setQuizCompleted(true);
        sessionState.setQuizIndex(total - 1);
        renderAllViews();
        schedulePersist();
        displaySessionStatus({ note: "Quiz complete. Review your results below." });
        return;
      }
      sessionState.setQuizCompleted(false);
      sessionState.setQuizIndex(sessionState.quizIndex + 1);
      renderAllViews();
      schedulePersist();
    },
    onReset: () => {
      sessionState.setQuizCompleted(false);
      sessionState.setQuizIndex(0);
      resetQuizSelections();
      renderAllViews();
      schedulePersist();
    },
    onShuffle: () => {
      const shuffled = [...sessionState.quizItems];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      sessionState.setQuizItems(shuffled);
      resetQuizSelections();
      sessionState.setQuizCompleted(false);
      renderAllViews();
      schedulePersist();
    },
    onOptionSelected: () => {
      if (sessionState.quizCompleted) {
        sessionState.setQuizCompleted(false);
      }
      renderAllViews();
      schedulePersist();
    },
    onRetake: () => {
      if (!sessionState.quizItems.length) {
        return;
      }
      const reshuffled = [...sessionState.quizItems];
      for (let i = reshuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [reshuffled[i], reshuffled[j]] = [reshuffled[j], reshuffled[i]];
      }
      sessionState.setQuizItems(reshuffled);
      resetQuizSelections();
      sessionState.setQuizCompleted(false);
      renderAllViews();
      schedulePersist();
      displaySessionStatus({ note: "Quiz reshuffled. Good luck!" });
    }
  });

  setupFlashcardView({
    onPrevious: () => {
      sessionState.setFlashcardIndex(sessionState.flashcardIndex - 1);
      renderAllViews();
      schedulePersist();
    },
    onNext: () => {
      sessionState.setFlashcardIndex(sessionState.flashcardIndex + 1);
      renderAllViews();
      schedulePersist();
    }
  });

  window.addEventListener("beforeunload", () => {
    destroySession();
  });

  const lastId = await getLastSessionId();
  if (lastId) {
    await loadSessionById(lastId);
  } else {
    renderAllViews();
    displaySessionStatus();
  }
  syncGenerationStatusesFromSession();
  renderAllViews();
  currentTab = "summary";
  updateTabSelection(currentTab);
}

export async function handleFileUpload(file) {
  abortController?.abort();
  abortController = new AbortController();
  currentTab = "summary";
  updateTabSelection("summary");

  resetGenerationStatuses();
  renderAllViews();

  try {
    clearTimeout(hideProgressTimeout);
    hideProgressTimeout = null;
    acquireSpinner();
    showProgress(0);
    showStatus("Extracting PDF text…");

    const extraction = await extractPdfText(file, {
      onPageProgress: ({ current, total }) => {
        const progressValue = Math.round((current / total) * 30);
        showStatus(`Extracting PDF text (${current} / ${total})…`);
        showProgress(progressValue);
      }
    });

    const { text, chunks, pageCount, data } = extraction;
    const meta = await computeDocumentMetadata(file, data);

    sessionState.reset();
    sessionState.setPdfMeta(meta);
    sessionState.setSourceText({
      text,
      chunkCount: chunks.length,
      pageCount,
      chunks
    });
    sessionState.setSummary("");
    sessionState.setQuizItems([]);
    sessionState.setFlashcards([]);
    resetQuizSelections();
    renderAllViews();

    await runGenerationQueue({
      text,
      chunks,
      pageCount,
      meta,
      signal: abortController.signal
    });
    hideProgressTimeout = setTimeout(() => hideProgress(), 1200);
  } catch (error) {
    if (error.name === "AbortError") {
      clearTimeout(hideProgressTimeout);
      hideProgressTimeout = null;
      hideProgress();
      showStatus("Generation cancelled.");
      resetStatusDelayed();
    } else {
      console.error("Failed to process PDF", error);
      clearTimeout(hideProgressTimeout);
      hideProgressTimeout = null;
      hideProgress();
      showStatus(error.message || "Failed to generate study materials.");
      resetStatusDelayed();
    }
  } finally {
    releaseSpinner();
    abortController = null;
    renderAllViews();
  }
}

function updateTabSelection(tabId) {
  const tabButtons = document.querySelectorAll(".tab-button");
  const views = document.querySelectorAll(".view");

  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  views.forEach((view) => {
    const viewKey = view.dataset.view || view.id.replace("-view", "");
    const isActive = viewKey === tabId;
    view.classList.toggle("is-active", isActive);
    view.setAttribute("aria-hidden", String(!isActive));
  });
}

export async function selectTab(tabId, { userInitiated = false } = {}) {
  if (!TAB_IDS.has(tabId)) {
    return;
  }

  currentTab = tabId;
  updateTabSelection(tabId);
  renderAllViews();

  if (tabId === "summary") {
    if (sessionState.summary) {
      displaySessionStatus();
    } else if (generationState.summary === "pending") {
      showStatus("Generating summary…");
    } else if (generationState.summary === "error" && userInitiated) {
      showStatus("Summary generation failed. Upload a PDF to retry.");
    } else if (userInitiated) {
      showStatus("Upload a PDF to generate a summary.");
    }
  } else if (tabId === "quiz") {
    if (generationState.quiz === "pending") {
      showStatus("Generating quiz questions…");
    } else if (generationState.quiz === "error" && userInitiated) {
      showStatus("Quiz generation failed. Upload a PDF to retry.");
    } else if (generationState.quiz === "done" && !sessionState.quizItems.length && userInitiated) {
      showStatus("Quiz generation completed with no results.");
    } else if (sessionState.quizCompleted) {
      showStatus("Quiz complete. Review your results below.");
    } else if (!sessionState.quizItems.length && userInitiated) {
      showStatus("Quiz not yet available. Upload a PDF to generate one.");
    }
  } else if (tabId === "flashcard") {
    if (generationState.flashcard === "pending") {
      showStatus("Generating flashcards…");
    } else if (generationState.flashcard === "error" && userInitiated) {
      showStatus("Flashcard generation failed. Upload a PDF to retry.");
    } else if (generationState.flashcard === "done" && !sessionState.flashcards.length && userInitiated) {
      showStatus("Flashcard generation completed with no results.");
    } else if (!sessionState.flashcards.length && userInitiated) {
      showStatus("Flashcards not yet available. Upload a PDF to generate them.");
    }
  }
}
