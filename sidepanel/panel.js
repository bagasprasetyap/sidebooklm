import { resetStatus } from "../state/status.js";
import { loadInitialState, handleFileUpload, selectTab } from "./panelController.js";
import { getStudySettings, updateStudySettings } from "./studySettings.js";

const THEME_STORAGE_KEY = "smartStudyTheme";

function applyTheme(theme) {
  const root = document.documentElement;
  const toggle = document.getElementById("theme-toggle");
  const normalized = theme === "dark" ? "dark" : "light";
  root.dataset.theme = normalized;
  localStorage.setItem(THEME_STORAGE_KEY, normalized);
  if (toggle) {
    toggle.dataset.state = normalized;
    toggle.setAttribute("aria-pressed", normalized === "dark" ? "true" : "false");
    toggle.setAttribute(
      "aria-label",
      normalized === "dark"
        ? "Switch to Stormtrooper mode"
        : "Switch to Darth Vader mode"
    );
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(storedTheme || "light");

  resetStatus();
  await loadInitialState();

  const fileInput = document.getElementById("pdf-input");
  const tabButtons = document.querySelectorAll(".tab-button");
  const themeToggle = document.getElementById("theme-toggle");

  fileInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await handleFileUpload(file);
    fileInput.value = "";
  });

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => selectTab(button.dataset.tab, { userInitiated: true }));
  });

  themeToggle?.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  });

  setupStudySettings();

  await selectTab("summary", { userInitiated: false });
});

function setupStudySettings() {
  const settingsButton = document.getElementById("settings-button");
  const settingsToast = document.getElementById("settings-toast");
  const settingsBackdrop = document.getElementById("settings-backdrop");
  if (!settingsButton || !settingsToast || !settingsBackdrop) {
    return;
  }

  const quizAutoRadio = settingsToast.querySelector("#quiz-count-auto");
  const quizCustomRadio = settingsToast.querySelector("#quiz-count-custom");
  const quizSelect = settingsToast.querySelector("#quiz-count-select");
  const flashAutoRadio = settingsToast.querySelector("#flashcard-count-auto");
  const flashCustomRadio = settingsToast.querySelector("#flashcard-count-custom");
  const flashSelect = settingsToast.querySelector("#flashcard-count-select");
  const closeButtons = settingsToast.querySelectorAll("[data-action=\"close-settings\"]");

  const focusableSelector =
    "button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex=\"-1\"])";

  function trapFocus(event) {
    if (event.key !== "Tab") {
      return;
    }
    const focusable = Array.from(settingsToast.querySelectorAll(focusableSelector));
    if (!focusable.length) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function syncControls() {
    const settings = getStudySettings();

    if (quizAutoRadio) {
      quizAutoRadio.checked = settings.quiz.mode === "auto";
    }
    if (quizCustomRadio) {
      quizCustomRadio.checked = settings.quiz.mode === "custom";
    }
    if (quizSelect) {
      quizSelect.value = String(settings.quiz.count);
      quizSelect.disabled = settings.quiz.mode !== "custom";
    }

    if (flashAutoRadio) {
      flashAutoRadio.checked = settings.flashcard.mode === "auto";
    }
    if (flashCustomRadio) {
      flashCustomRadio.checked = settings.flashcard.mode === "custom";
    }
    if (flashSelect) {
      flashSelect.value = String(settings.flashcard.count);
      flashSelect.disabled = settings.flashcard.mode !== "custom";
    }
  }

  function openSettings() {
    syncControls();
    settingsToast.classList.remove("hidden");
    settingsBackdrop.classList.remove("hidden");
    settingsButton.setAttribute("aria-expanded", "true");
    const focusTarget =
      settingsToast.querySelector("[data-initial-focus]") ||
      settingsToast.querySelector(focusableSelector);
    focusTarget?.focus();
    document.addEventListener("keydown", handleGlobalKeydown);
    settingsToast.addEventListener("keydown", trapFocus);
  }

  function closeSettings() {
    settingsToast.classList.add("hidden");
    settingsBackdrop.classList.add("hidden");
    settingsButton.setAttribute("aria-expanded", "false");
    settingsButton.focus();
    document.removeEventListener("keydown", handleGlobalKeydown);
    settingsToast.removeEventListener("keydown", trapFocus);
  }

  function handleGlobalKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSettings();
    }
  }

  settingsButton.addEventListener("click", () => {
    const isOpen = !settingsToast.classList.contains("hidden");
    if (isOpen) {
      closeSettings();
    } else {
      openSettings();
    }
  });

  settingsBackdrop.addEventListener("click", closeSettings);
  closeButtons.forEach((button) =>
    button.addEventListener("click", closeSettings)
  );

  quizAutoRadio?.addEventListener("change", (event) => {
    if (event.target.checked) {
      updateStudySettings({ quiz: { mode: "auto" } });
      syncControls();
    }
  });

  quizCustomRadio?.addEventListener("change", (event) => {
    if (event.target.checked) {
      updateStudySettings({ quiz: { mode: "custom" } });
      syncControls();
      quizSelect?.focus();
    }
  });

  quizSelect?.addEventListener("change", (event) => {
    updateStudySettings({
      quiz: { mode: "custom", count: Number.parseInt(event.target.value, 10) }
    });
    syncControls();
  });

  flashAutoRadio?.addEventListener("change", (event) => {
    if (event.target.checked) {
      updateStudySettings({ flashcard: { mode: "auto" } });
      syncControls();
    }
  });

  flashCustomRadio?.addEventListener("change", (event) => {
    if (event.target.checked) {
      updateStudySettings({ flashcard: { mode: "custom" } });
      syncControls();
      flashSelect?.focus();
    }
  });

  flashSelect?.addEventListener("change", (event) => {
    updateStudySettings({
      flashcard: { mode: "custom", count: Number.parseInt(event.target.value, 10) }
    });
    syncControls();
  });

  document.addEventListener("studysettingschange", () => {
    syncControls();
  });

  syncControls();
}
