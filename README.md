# Cobase

Cobase is an Electron-based desktop application for browsing and selecting files from a codebase, viewing their approximate token counts, and copying file contents (with optional file tree context) into a clipboard-formatted prompt. It also supports applying unified-style patches to the project files directly, streamlining workflows for AI-assisted code reviews and edits.

## Table of Contents

* [Features](#features)
* [Getting Started](#getting-started)

  * [Prerequisites](#prerequisites)
  * [Installation](#installation)
  * [Development](#development)
  * [Production Build](#production-build)
* [Usage](#usage)

  * [Opening a Project Folder](#opening-a-project-folder)
  * [Browsing and Searching Files](#browsing-and-searching-files)
  * [Selecting Files and Viewing Token Counts](#selecting-files-and-viewing-token-counts)
  * [Copying File Context](#copying-file-context)
  * [Applying Patches](#applying-patches)
* [Project Structure](#project-structure)
* [Dependency Overview](#dependency-overview)
* [Scripts](#scripts)
* [Contributing](#contributing)
* [License](#license)

## Features

* **File Explorer**: Displays a tree view of your project files (ignoring patterns from `.gitignore`) with collapsible directories.
* **Token Counting**: Estimates token counts per file using `js-tiktoken`, helpful for crafting prompts within model limits.
* **Search & Filter**: Quickly search by filename to narrow down files in large repositories.
* **Select & Copy**: Select individual files or entire directories, include an ASCII file tree if desired, and copy concatenated contents into clipboard ready for prompt composition.
* **Prompt Templates**: Choose between a blank template, question template, or patch template when copying files.
* **Apply Patch**: Paste a unified-style patch into the built‑in modal to apply changes directly to your codebase using an intelligent context-based parser.
* **Dark Mode & Theming**: Toggle between light and dark themes with a single click.

## Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (v16.x or higher)
* npm (v8.x or higher) or yarn

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/cobase.git
   cd cobase
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

### Development

Start the development environment, which launches a Vite server and then Electron in development mode:

```bash
npm run start
# or
yarn start
```

* Runs `scripts/dev.js`:

  * Spawns the Vite dev server on [http://localhost:3000](http://localhost:3000).
  * Waits until it’s ready, then launches Electron pointing at the dev server.
  * Hot-reloads frontend on file changes; backend logs appear prefixed with `[electron]`.

### Production Build

To build for production and package the Electron app:

```bash
npm run build
# or
yarn build
```

* Runs `scripts/build.js`:

  1. Builds the frontend dist via Vite.
  2. Packages the Electron app with `electron-builder` (outputs in `release-builds/`).

To clean build artifacts:

```bash
npm run clean
```

## Usage

### Opening a Project Folder

1. Click **Open Folder** in the header and select a directory.
2. The last opened folder is remembered and auto-loaded on next launch.

### Browsing and Searching Files

* Use the sidebar to browse files grouped by directory.
* Search by filename in the sidebar search box to filter visible files in real time.

### Selecting Files and Viewing Token Counts

* Each file entry shows an estimated token count (approximate word count via `js-tiktoken`).
* Select individual files or entire folders (checkbox on folder toggles all nested files).
* The header of the grid view displays total selected files and cumulative token count.

### Copying File Context

1. Select files in the sidebar.
2. In the export bar at the bottom:

   * (Optional) Enter additional instructions.
   * Choose **Include File Tree** to prepend an ASCII tree of selected files.
   * Select a **Prompt Template**: Blank, Question, or Patch.
3. Click **Copy (N files)** to copy to clipboard:

   * Combines file contents and tree header (if chosen).
   * Appends template guidelines and your instructions.

### Applying Patches

1. Click **Apply Patch** in the header.
2. Paste a unified patch (`*** Begin Patch` ... `*** End Patch`).
3. Click **Apply** to run the parser (`applyPatch` handler):

   * Applies changes with robust context matching.
   * Errors (invalid context, missing files) are shown inline and can be copied.

## Project Structure

```
/ (root)
├─ package.json           # Project manifest & scripts
├─ .gitignore             # Ignored files
├─ index.html             # App entrypoint for Vite + Electron
├─ scripts/
│  ├─ dev.js              # Starts Vite + Electron for dev
│  └─ build.js            # Builds frontend then packages Electron
├─ src/
│  ├─ backend/
│  │  ├─ main.js          # Electron main process
│  │  ├─ preload.js       # Exposes safe IPC methods
│  │  ├─ applyPatch.js    # Patch parser & applier logic
│  │  ├─ parseApplyPatch.js
│  │  ├─ prompts.js       # Prompt templates for copy & patch
│  │  └─ watcher.js       # File watcher respecting .gitignore
│  └─ frontend/
│     ├─ main.tsx         # React entrypoint
│     ├─ App.tsx          # Root UI layout
│     ├─ components/      # UI components (Sidebar, Grid, Modals, etc.)
│     ├─ hooks/           # Custom React hooks (useNotify)
│     ├─ store.ts         # Zustand global state
│     └─ index.css        # Tailwind base styles
└─ tsconfig.json          # TypeScript configuration
```

## Dependency Overview

* **Electron**: Desktop shell for cross-platform apps
* **Vite**: Fast front-end build tool (with React plugin)
* **React**: UI library
* **Zustand**: Lightweight state management
* **Tailwind CSS**: Utility-first styling
* **js-tiktoken**: Tokenizer to estimate token counts
* **chokidar**: File system watcher
* **ignore**: Respect .gitignore patterns
* **electron-builder**: Packaging for Windows/macOS/Linux

## Scripts

| Command         | Description                                                |
| --------------- | ---------------------------------------------------------- |
| `npm run start` | Launch dev server + Electron in development                |
| `npm run build` | Build frontend and package Electron app                    |
| `npm run clean` | Remove generated `dist/` and `release-builds/` directories |
