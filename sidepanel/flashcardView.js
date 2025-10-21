const container = document.querySelector(".flashcard-container");
const prevButton = document.getElementById("flashcard-prev");
const nextButton = document.getElementById("flashcard-next");
const counterEl = document.getElementById("flashcard-counter");
const controlsContainer = document.querySelector(".flashcard-controls");
const statusContainer = document.querySelector(".flashcard-status");

let handlers = {};

export function setupFlashcardView(callbacks = {}) {
  handlers = callbacks;
  container.addEventListener("click", (event) => {
    const card = event.target.closest(".flashcard");
    if (!card) return;
    card.classList.toggle("is-flipped");
  });

  prevButton.addEventListener("click", () => handlers.onPrevious?.());
  nextButton.addEventListener("click", () => handlers.onNext?.());
}

export function renderFlashcardView({
  flashcards,
  currentIndex,
  isGenerating = false,
  hasError = false
}) {
  container.innerHTML = "";

  const toggleControls = (visible) => {
    controlsContainer?.classList.toggle("hidden", !visible);
    statusContainer?.classList.toggle("hidden", !visible);
  };

  if (isGenerating) {
    container.classList.add("empty-state");
    container.innerHTML = "<p>Generating flashcards…</p>";
    prevButton.disabled = true;
    nextButton.disabled = true;
    if (counterEl) {
      counterEl.textContent = "0 / 0";
    }
    toggleControls(false);
    return;
  }

  if (hasError) {
    container.classList.add("empty-state");
    container.innerHTML = "<p>Flashcard generation failed. Try uploading the PDF again.</p>";
    prevButton.disabled = true;
    nextButton.disabled = true;
    if (counterEl) {
      counterEl.textContent = "0 / 0";
    }
    toggleControls(false);
    return;
  }

  if (!flashcards?.length) {
    container.classList.add("empty-state");
    container.innerHTML = "<p>No flashcards yet. They will appear once generation completes.</p>";
    prevButton.disabled = true;
    nextButton.disabled = true;
    if (counterEl) {
      counterEl.textContent = "0 / 0";
    }
    toggleControls(false);
    return;
  }

  container.classList.remove("empty-state");
  const index = Math.max(0, Math.min(currentIndex, flashcards.length - 1));
  const cardData = flashcards[index];

  const card = document.createElement("article");
  card.className = "flashcard";
  card.setAttribute("tabindex", "0");
  card.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      card.classList.toggle("is-flipped");
    }
  });

  const questionFace = document.createElement("div");
  questionFace.className = "flashcard-inner flashcard-question";
  questionFace.innerHTML = `
    <div class="flashcard-text">${cardData.question}</div>
    <div class="flashcard-hint">Press to flip</div>
  `;

  const answerFace = document.createElement("div");
  answerFace.className = "flashcard-inner flashcard-answer";
  answerFace.innerHTML = `
    <div class="flashcard-text">${cardData.answer}</div>
  `;

  card.appendChild(questionFace);
  card.appendChild(answerFace);

  container.appendChild(card);

  toggleControls(true);

  prevButton.disabled = index === 0;
  prevButton.classList.toggle("hidden", index === 0);
  nextButton.disabled = index >= flashcards.length - 1;
  if (counterEl) {
    counterEl.textContent = `${index + 1} / ${flashcards.length}`;
  }
}
