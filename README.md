# SidebookLM

SidebookLM is a Chrome side panel extension that converts any PDF into study-ready material entirely on-device. It extracts the document with PDF.js, sends context-aware prompts to Gemini Nano through Chrome's built-in Prompt API, and returns a concise summary, a quiz, and flashcards without ever uploading the source file.

## Features
- Upload a PDF and receive an AI-generated summary, quiz questions, and flashcards in one flow.
- Runs on-device with Gemini Nano, so documents never leave the browser.
- Adjustable study settings for quiz and flashcard counts, plus light and dark theme toggle.
- Persists the latest study session locally using IndexedDB for quick resume.
- Optimized keyboard and screen reader support for the side panel experience.

## Tech Stack
- Manifest V3 side panel extension (`manifest.json`, `background/background.js`).
- Prompt API (Gemini Nano) session management and prompting (`ai/model.js`, `ai/prompts.js`).
- PDF ingestion powered by PDF.js builds located in `pdf/lib`.
- Vanilla web components, CSS, and IndexedDB for the front-end (`sidepanel/`, `state/`, `db/`).

## Prerequisites
- Chrome 138 or newer on Windows 10/11, macOS 13+, Linux, or Chromebook Plus (per Prompt API hardware guidance).
- Sufficient local resources for Gemini Nano (rough guidance: >4 GB VRAM for GPU or 16 GB RAM for CPU, and ~22 GB free disk space).
- Developer Mode enabled under `chrome://extensions`.
- Ensure Chrome has finished downloading the on-device language model. You can verify status via `chrome://on-device-internals` after triggering the model once.

> Tip: If `LanguageModel.availability()` reports `downloadable`, click any button in the side panel to grant user activation so Chrome can fetch the model.

## Setup
1. Clone the repository:
   ```bash
   git clone <your-fork-or-clone-url>
   cd sidebooklm-app
   ```
2. Install dependencies (PDF.js builds are already committed; this keeps `node_modules` in sync for development):
   ```bash
   npm install
   ```
3. No build step is required. All source files are plain ES modules loaded directly by Chrome.

## Run the Extension
1. Open `chrome://extensions` and toggle **Developer mode** on (top right).
2. Click **Load unpacked** and select the repository root (`sidebooklm-app`).
3. Chrome will register the SidebookLM action. Click the puzzle icon, pin it if desired, then press the SidebookLM icon to open the side panel.
4. Upload a PDF: the extension extracts text locally, prepares Gemini Nano context, and streams status updates while generating study content.

## Usage Guide
- **Summary tab**: Displays the condensed explanation of the uploaded PDF with metadata.
- **Quiz tab**: Presents multiple choice questions, tracks current question, and lets you mark answers to review later.
- **Flashcards tab**: Step through generated Q&A cards with navigation controls.
- **Study settings**: Open the gear icon to switch between auto and custom item counts for quizzes and flashcards. Preferences persist in local storage.
- **Theme toggle**: Switch between light and dark themes (stored per device).

All data (PDF text, AI responses, settings) is scoped to the user profile and stored in IndexedDB / `localStorage`. Clear Chrome storage to reset the app.

## Project Structure Highlights
- `background/` – Side panel registration and extension lifecycle handlers.
- `sidepanel/` – UI markup (`index.html`), styles, and interaction logic.
- `ai/` – Prompt builders, schema normalizers, and Gemini Nano session orchestration.
- `pdf/` – PDF.js loader and worker configuration for local text extraction.
- `db/` and `state/` – Local persistence and in-memory session management.
- `assets/`, `styles/`, `manifest.json` – Branding and Chrome metadata.

