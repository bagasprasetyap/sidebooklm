const summaryContainer = document.querySelector(".summary-container");

export function renderSummaryView({
  summary,
  pdfMeta,
  pageCount,
  isGenerating = false,
  hasError = false
}) {
  if (!summaryContainer) {
    return;
  }

  summaryContainer.innerHTML = "";

  if (isGenerating) {
    summaryContainer.classList.add("empty-state");
    summaryContainer.innerHTML = "<p>Generating summary…</p>";
    return;
  }

  if (hasError) {
    summaryContainer.classList.add("empty-state");
    summaryContainer.innerHTML = "<p>Summary generation failed. Try uploading the PDF again.</p>";
    return;
  }

  if (!summary) {
    summaryContainer.classList.add("empty-state");
    summaryContainer.innerHTML = "<p>No summary yet. Upload a PDF to get started.</p>";
    return;
  }

  summaryContainer.classList.remove("empty-state");

  const content = document.createElement("div");
  content.className = "summary-content";
  content.textContent = summary;

  summaryContainer.appendChild(content);

  if (pdfMeta?.name || pageCount) {
    const metadata = document.createElement("p");
    metadata.className = "summary-metadata";
    const details = [];
    if (pdfMeta?.name) {
      details.push(pdfMeta.name);
    }
    if (pageCount) {
      details.push(`${pageCount} page${pageCount === 1 ? "" : "s"}`);
    }
    metadata.textContent = details.join(" • ");
    summaryContainer.appendChild(metadata);
  }
}
