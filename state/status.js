const statusMessageEl = () => document.getElementById("status-message");
const progressEl = () => document.getElementById("download-progress");
const spinnerEl = () => document.getElementById("status-spinner");

export function showStatus(message) {
  const el = statusMessageEl();
  if (el) {
    el.textContent = message;
  }
}

export function showProgress(value) {
  const el = progressEl();
  if (!el) {
    return;
  }
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  el.hidden = false;
  el.value = clamped;
}

export function hideProgress() {
  const el = progressEl();
  if (el) {
    el.hidden = true;
    el.value = 0;
  }
}

export function showSpinner() {
  const el = spinnerEl();
  if (el) {
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
  }
}

export function hideSpinner() {
  const el = spinnerEl();
  if (el) {
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
  }
}

export function resetStatus() {
  showStatus("Ready to generate study materials.");
  hideProgress();
  hideSpinner();
}
