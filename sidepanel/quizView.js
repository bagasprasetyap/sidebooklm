const quizContainer = document.getElementById("quiz-container");
const counterEl = document.getElementById("quiz-counter");
const prevButton = document.getElementById("quiz-prev");
const nextButton = document.getElementById("quiz-next");
const resetButton = document.getElementById("quiz-reset");
const shuffleButton = document.getElementById("quiz-shuffle");
const controlsContainer = document.querySelector(".quiz-controls");
const statusContainer = document.querySelector(".quiz-status");

let selections = new Map();
let handlers = {};

export function setupQuizView(callbacks = {}) {
  handlers = callbacks;

  prevButton.addEventListener("click", () => {
    handlers.onPrevious?.();
  });

  nextButton.addEventListener("click", () => {
    handlers.onNext?.();
  });

  resetButton.addEventListener("click", () => {
    selections = new Map();
    handlers.onReset?.();
  });

  shuffleButton.addEventListener("click", () => {
    selections = new Map();
    handlers.onShuffle?.();
  });
}

function renderOptions(question, options, correctAnswer, selectedOptionIndex) {
  const list = document.createElement("div");
  list.className = "quiz-options";

  options.forEach((option, index) => {
    const button = document.createElement("button");
    button.className = "quiz-option";
    button.textContent = option;
    button.dataset.index = String(index);

    if (typeof selectedOptionIndex === "number") {
      button.disabled = true;
      if (index === selectedOptionIndex) {
        const isCorrect = option.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
        button.classList.add(isCorrect ? "is-correct" : "is-incorrect");
      }
      if (
        option.toLowerCase().trim() === correctAnswer.toLowerCase().trim() &&
        index !== selectedOptionIndex
      ) {
        button.classList.add("is-correct");
      }
    } else {
      button.addEventListener("click", () => {
        const selection = {
          selectedIndex: index,
          correctAnswer,
          isCorrect: option.toLowerCase().trim() === correctAnswer.toLowerCase().trim()
        };
        selections.set(question, selection);
        handlers.onOptionSelected?.({
          question,
          selectedIndex: index,
          correct: option.toLowerCase().trim() === correctAnswer.toLowerCase().trim()
        });
      });
    }

    list.appendChild(button);
  });

  return list;
}

export function renderQuizView({
  quizItems,
  currentIndex,
  isGenerating = false,
  hasError = false,
  isCompleted = false
}) {
  quizContainer.innerHTML = "";

  const showControls = (visible) => {
    if (controlsContainer) {
      controlsContainer.classList.toggle("hidden", !visible);
    }
  };

  const setCounterVisible = (visible) => {
    if (statusContainer) {
      statusContainer.classList.toggle("hidden", !visible);
    }
  };

  if (isGenerating) {
    quizContainer.classList.add("empty-state");
    quizContainer.innerHTML = "<p>Generating quiz questions…</p>";
    counterEl.textContent = "";
    prevButton.disabled = true;
    nextButton.disabled = true;
    resetButton.disabled = true;
    shuffleButton.disabled = true;
    showControls(false);
    setCounterVisible(false);
    return;
  }

  if (hasError) {
    quizContainer.classList.add("empty-state");
    quizContainer.innerHTML = "<p>Quiz generation failed. Try uploading the PDF again.</p>";
    counterEl.textContent = "";
    prevButton.disabled = true;
    nextButton.disabled = true;
    resetButton.disabled = true;
    shuffleButton.disabled = true;
    showControls(false);
    setCounterVisible(false);
    return;
  }

  if (!quizItems?.length) {
    quizContainer.classList.add("empty-state");
    quizContainer.innerHTML = "<p>No quiz yet. It will appear once generation completes.</p>";
    counterEl.textContent = "";
    prevButton.disabled = true;
    nextButton.disabled = true;
    resetButton.disabled = true;
    shuffleButton.disabled = true;
    showControls(false);
    setCounterVisible(false);
    return;
  }

  const totalQuestions = quizItems.length;
  let correctCount = 0;
  let incorrectCount = 0;

  quizItems.forEach((item) => {
    const selection = selections.get(item.question);
    if (selection && typeof selection.selectedIndex === "number") {
      const selectedOption = item.options?.[selection.selectedIndex];
      const isCorrect =
        selectedOption &&
        selectedOption.toLowerCase().trim() === item.answer.toLowerCase().trim();
      if (isCorrect) {
        correctCount += 1;
      } else {
        incorrectCount += 1;
      }
    }
  });

  const answeredCount = correctCount + incorrectCount;
  const skippedCount = Math.max(0, totalQuestions - answeredCount);

  if (isCompleted) {
    quizContainer.classList.remove("empty-state");
    showControls(false);
    setCounterVisible(false);

    const accuracy = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const resultsCard = document.createElement("article");
    resultsCard.className = "quiz-results-card";

    const heading = document.createElement("h2");
    heading.className = "quiz-results-title";
    heading.textContent = "You did it! Quiz Complete.";

    const scoreLine = document.createElement("p");
    scoreLine.className = "quiz-results-score";
    scoreLine.textContent = `Score: ${correctCount} / ${totalQuestions}`;

    const accuracyLine = document.createElement("p");
    accuracyLine.className = "quiz-results-accuracy";
    accuracyLine.textContent = `Accuracy: ${accuracy}%`;

    const breakdown = document.createElement("div");
    breakdown.className = "quiz-results-breakdown";
    breakdown.innerHTML = `
      <span>Right: ${correctCount}</span>
      <span>Wrong: ${incorrectCount}</span>
      <span>Skipped: ${skippedCount}</span>
    `;

    const retakeButton = document.createElement("button");
    retakeButton.type = "button";
    retakeButton.className = "quiz-retake-button";
    retakeButton.textContent = "Retake Quiz";
    retakeButton.addEventListener("click", () => {
      handlers.onRetake?.();
    });

    resultsCard.appendChild(heading);
    resultsCard.appendChild(scoreLine);
    resultsCard.appendChild(accuracyLine);
    resultsCard.appendChild(breakdown);
    resultsCard.appendChild(retakeButton);

    quizContainer.appendChild(resultsCard);

    counterEl.textContent = "";
    prevButton.disabled = true;
    nextButton.disabled = true;
    resetButton.disabled = true;
    shuffleButton.disabled = true;
    return;
  }

  quizContainer.classList.remove("empty-state");
  const boundedIndex = Math.max(0, Math.min(currentIndex, quizItems.length - 1));
  const isLastQuestion = boundedIndex >= quizItems.length - 1;
  const quizItem = quizItems[boundedIndex];

  const card = document.createElement("article");
  card.className = "quiz-card";

  const question = document.createElement("h2");
  question.className = "quiz-question";
  question.textContent = quizItem.question;

  const selection = selections.get(quizItem.question);
  const optionsList = renderOptions(
    quizItem.question,
    quizItem.options,
    quizItem.answer,
    selection?.selectedIndex
  );

  card.appendChild(question);
  card.appendChild(optionsList);

  if (selection?.selectedIndex !== undefined && quizItem.explanation) {
    const explanation = document.createElement("p");
    explanation.className = "quiz-explanation";
    explanation.textContent = quizItem.explanation;
    card.appendChild(explanation);
  }

  quizContainer.appendChild(card);

  showControls(true);
  setCounterVisible(true);

  prevButton.disabled = boundedIndex === 0;
  prevButton.classList.toggle("hidden", boundedIndex === 0);

  nextButton.disabled = false;
  nextButton.textContent = isLastQuestion ? "Finish" : "Next →";
  resetButton.disabled = false;
  shuffleButton.disabled = false;
  counterEl.textContent = `${boundedIndex + 1} / ${quizItems.length}`;
  nextButton.classList.remove("hidden");
  resetButton.classList.remove("hidden");
  shuffleButton.classList.remove("hidden");
}

export function resetQuizSelections() {
  selections = new Map();
}
