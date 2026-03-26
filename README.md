# Cobase

Cobase is a desktop app for exploring a codebase, selecting files, estimating token usage, copying prompt-ready context, inspecting Git state, running project-wide search, and applying patch envelopes directly to the local workspace.

The app is built with Tauri 2, a Rust backend, and a React + Vite frontend.

## Features

* Browse a project tree while respecting `.gitignore`, `.git/info/exclude`, and global Git ignore rules
* Estimate tokens and line counts for files and selected groups
* Copy selected files with optional instructions and prompt templates
* Include file tree context in copied output
* Apply `*** Begin Patch` / `*** End Patch` patches directly in the app
* Inspect Git status, diffs, history, blame, branches, and commit details
* Copy working tree diffs and commit patches
* Search across the project with regex and result limits
* Toggle between light and dark themes

## Stack

* Tauri 2
* Rust
* React 18
* Vite
* TypeScript
* Zustand

## Getting Started

### Prerequisites

* Node.js
* npm
* Rust toolchain
* Platform requirements for Tauri builds

On macOS, that typically means Xcode Command Line Tools are installed. On Linux and Windows, install the system dependencies required by Tauri 2 for your target platform.

### Install

```bash
npm install
```

### Development

```bash
npm run start
```

This runs:

* `tauri dev --config src/backend/tauri.conf.json`
* Vite on `http://localhost:3040`
* The desktop app against that dev server

### Production Build

```bash
npm run build
```

This runs:

* `tauri build --config src/backend/tauri.conf.json`
* `vite build` via Tauri's `beforeBuildCommand`
* Native app packaging through Tauri

Build outputs are written under:

```text
src/backend/target/release/bundle/
```

### Clean

```bash
npm run clean
```

This removes:

```text
dist/
src/backend/target/
```

## Usage

### Explorer

Open a folder to load the project tree. Cobase tracks file selection, estimates tokens and lines, and lets you copy prompt-ready file contents with optional instructions and file tree context.

### Git

The Git view surfaces working tree status and supports diff inspection, stage and unstage actions, discard, commit, branch switching and creation, history browsing, blame, commit patch copying, and range-based prompt generation.

### Search

The Search view runs project-wide text search with regex, case sensitivity, whole-word matching, per-file limits, and max result limits.

### Patches

The Patches view accepts patch envelopes in the `*** Begin Patch` format and applies them directly to the currently opened project.

### Settings

The Settings view currently exposes theme switching.

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm run start` | Start the Tauri development app |
| `npm run build` | Build and package the production app |
| `npm run build:web` | Build the frontend only with Vite |
| `npm run clean` | Remove `dist/` and `src/backend/target/` |
