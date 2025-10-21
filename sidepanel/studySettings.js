const SETTINGS_STORAGE_KEY = "smartStudyPreferences";

const DEFAULT_SETTINGS = {
  quiz: { mode: "auto", count: 6 },
  flashcard: { mode: "auto", count: 10 }
};

let cachedSettings = null;

function cloneSettings(settings) {
  return {
    quiz: { ...settings.quiz },
    flashcard: { ...settings.flashcard }
  };
}

function clampCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 1;
  }
  return Math.min(20, Math.max(1, parsed));
}

function coerceMode(value) {
  return value === "custom" ? "custom" : "auto";
}

function normalizeSettings(rawSettings) {
  const base = cloneSettings(DEFAULT_SETTINGS);
  if (!rawSettings || typeof rawSettings !== "object") {
    return base;
  }

  const quizSource = rawSettings.quiz ?? {};
  const flashSource = rawSettings.flashcard ?? {};

  base.quiz.mode = coerceMode(quizSource.mode);
  base.quiz.count = clampCount(quizSource.count ?? base.quiz.count);

  base.flashcard.mode = coerceMode(flashSource.mode);
  base.flashcard.count = clampCount(flashSource.count ?? base.flashcard.count);

  return base;
}

function readFromStorage() {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) {
      return cloneSettings(DEFAULT_SETTINGS);
    }
    const parsed = JSON.parse(stored);
    return normalizeSettings(parsed);
  } catch (error) {
    console.warn("Failed to read study settings; falling back to defaults.", error);
    return cloneSettings(DEFAULT_SETTINGS);
  }
}

function writeToStorage(settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn("Failed to persist study settings.", error);
  }
}

function ensureCachedSettings() {
  if (!cachedSettings) {
    cachedSettings = normalizeSettings(readFromStorage());
  }
  return cachedSettings;
}

function emitChange(settings) {
  document.dispatchEvent(
    new CustomEvent("studysettingschange", {
      detail: cloneSettings(settings)
    })
  );
}

export function getStudySettings() {
  const settings = ensureCachedSettings();
  return cloneSettings(settings);
}

export function setStudySettings(nextSettings) {
  const normalized = normalizeSettings(nextSettings);
  cachedSettings = normalized;
  writeToStorage(normalized);
  emitChange(normalized);
  return getStudySettings();
}

export function updateStudySettings(partialSettings) {
  const current = ensureCachedSettings();
  const merged = {
    quiz: { ...current.quiz, ...(partialSettings?.quiz ?? {}) },
    flashcard: { ...current.flashcard, ...(partialSettings?.flashcard ?? {}) }
  };
  return setStudySettings(merged);
}

export function getQuizTargetCount() {
  const { quiz } = ensureCachedSettings();
  return quiz.mode === "custom" ? quiz.count : null;
}

export function getFlashcardTargetCount() {
  const { flashcard } = ensureCachedSettings();
  return flashcard.mode === "custom" ? flashcard.count : null;
}

export function resetStudySettings() {
  cachedSettings = cloneSettings(DEFAULT_SETTINGS);
  writeToStorage(cachedSettings);
  emitChange(cachedSettings);
  return getStudySettings();
}
