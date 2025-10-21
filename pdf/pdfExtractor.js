const PDF_CHUNK_SIZE = 6400;

let pdfjsLibPromise;

async function loadPdfJs() {
  if (pdfjsLibPromise) {
    return pdfjsLibPromise;
  }

  pdfjsLibPromise = new Promise(async (resolve, reject) => {
    try {
      if (globalThis.pdfjsLib) {
        resolve(globalThis.pdfjsLib);
        return;
      }

      const candidatePaths = [
        chrome.runtime?.getURL?.("pdf/lib/pdf.mjs"),
        chrome.runtime?.getURL?.("pdf/lib/pdf.min.mjs"),
        chrome.runtime?.getURL?.("pdf/lib/pdf.js")
      ].filter(Boolean);

      let module;
      for (const path of candidatePaths) {
        if (!path) continue;
        try {
          module = await import(path);
          break;
        } catch (error) {
          console.warn(`Failed to import PDF.js from ${path}`, error);
        }
      }

      if (module?.default) {
        resolve(module.default);
        return;
      }

      if (module?.pdfjsLib) {
        resolve(module.pdfjsLib);
        return;
      }

      if (module) {
        resolve(module);
        return;
      }

      reject(new Error("PDF.js library not found. Add pdfjs-dist build files under pdf/lib."));
    } catch (error) {
      reject(error);
    }
  });

  return pdfjsLibPromise;
}

async function readFileAsArrayBuffer(file) {
  if (file.arrayBuffer) {
    return file.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export async function extractPdfText(file, { onPageProgress } = {}) {
  const pdfjsLib = await loadPdfJs();
  if (!pdfjsLib || typeof pdfjsLib.getDocument !== "function") {
    throw new Error("PDF.js is not available. Ensure pdfjs-dist is bundled in pdf/lib.");
  }

  if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf/lib/pdf.worker.min.js");
  }

  const data = await readFileAsArrayBuffer(file);
  const loadingTask = pdfjsLib.getDocument({ data });
  const doc = await loadingTask.promise;
  const pageCount = doc.numPages;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean);
    const pageText = strings.join(" ").replace(/\s+/g, " ").trim();
    if (pageText) {
      pageTexts.push(pageText);
    }
    onPageProgress?.({
      current: pageNumber,
      total: pageCount
    });
  }

  const rawText = pageTexts.join("\n\n");
  return {
    text: rawText,
    chunks: splitIntoChunks(rawText),
    pageCount,
    data
  };
}

export async function computeDocumentMetadata(file, buffer) {
  const arrayBuffer = buffer || (await readFileAsArrayBuffer(file));
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return {
    id: hash,
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    mimeType: file.type || "application/pdf"
  };
}

export function splitIntoChunks(text, maxLength = PDF_CHUNK_SIZE) {
  if (!text) {
    return [];
  }

  const chunks = [];
  let remaining = text.trim();

  while (remaining.length > maxLength) {
    let breakpoint = remaining.lastIndexOf("\n\n", maxLength);
    if (breakpoint === -1 || breakpoint < maxLength * 0.6) {
      breakpoint = remaining.lastIndexOf(". ", maxLength);
    }
    if (breakpoint === -1 || breakpoint < maxLength * 0.6) {
      breakpoint = maxLength;
    }
    const chunk = remaining.slice(0, breakpoint).trim();
    chunks.push(chunk);
    remaining = remaining.slice(breakpoint).trim();
  }

  if (remaining.length) {
    chunks.push(remaining);
  }

  return chunks;
}
