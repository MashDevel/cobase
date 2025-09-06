import fs from "fs";
import path from "path";
import {
  ADD_FILE_PREFIX,
  DELETE_FILE_PREFIX,
  END_OF_FILE_PREFIX,
  MOVE_FILE_TO_PREFIX,
  MOVE_TO_PREFIX,
  PATCH_SUFFIX,
  UPDATE_FILE_PREFIX,
  HUNK_ADD_LINE_PREFIX,
  PATCH_PREFIX,
} from "./parseApplyPatch.js";

export const ActionType = {
  ADD: "add",
  DELETE: "delete",
  UPDATE: "update",
};

export function assemble_changes(orig, updatedFiles) {
  const commit = { changes: {} };
  for (const [p, newContent] of Object.entries(updatedFiles)) {
    const oldContent = orig[p];
    if (oldContent === newContent) {
      continue;
    }
    if (oldContent !== undefined && newContent !== undefined) {
      commit.changes[p] = {
        type: ActionType.UPDATE,
        old_content: oldContent,
        new_content: newContent,
      };
    } else if (newContent !== undefined) {
      commit.changes[p] = {
        type: ActionType.ADD,
        new_content: newContent,
      };
    } else if (oldContent !== undefined) {
      commit.changes[p] = {
        type: ActionType.DELETE,
        old_content: oldContent,
      };
    } else {
      throw new Error("Unexpected state in assemble_changes");
    }
  }
  return commit;
}

export class DiffError extends Error {}

class Parser {
  constructor(currentFiles, lines) {
    this.current_files = currentFiles;
    this.lines = lines;
    this.index = 0;
    this.patch = { actions: {} };
    this.fuzz = 0;
  }

  is_done(prefixes) {
    if (this.index >= this.lines.length) return true;
    return prefixes?.some(p => this.lines[this.index].startsWith(p.trim()));
  }

  startswith(prefix) {
    const prefixes = Array.isArray(prefix) ? prefix : [prefix];
    return prefixes.some(p => this.lines[this.index].startsWith(p));
  }

  read_str(prefix = "", returnEverything = false) {
    if (this.index >= this.lines.length) {
      throw new DiffError(`Reached end of patch unexpectedly. Make sure your patch is correctly terminated with '*** End Patch'`);
    }
    const prefixes = Array.isArray(prefix) ? prefix : [prefix];
    const matched = prefixes.find(p => this.lines[this.index].startsWith(p));
    if (matched !== undefined) {
      const text = returnEverything
        ? this.lines[this.index]
        : this.lines[this.index].slice(matched.length);
      this.index += 1;
      return text;
    }
    return "";
  }

  parse() {
    while (!this.is_done([PATCH_SUFFIX])) {
      let p = this.read_str(UPDATE_FILE_PREFIX);
      if (p) {
        if (this.patch.actions[p]) {
          throw new DiffError(`Update File Error: Duplicate Path: ${p}. Remove the duplicate '*** Update File: ${p}' entry.`);
        }
        const moveTo = this.read_str([MOVE_FILE_TO_PREFIX, MOVE_TO_PREFIX]);
        const text = this.current_files[p] || "";
        const action = this.parse_update_file(text);
        action.move_path = moveTo || undefined;
        this.patch.actions[p] = action;
        continue;
      }

      p = this.read_str(DELETE_FILE_PREFIX);
      if (p) {
        if (this.patch.actions[p]) {
          throw new DiffError(`Delete File Error: Duplicate Path: ${p}. Remove the duplicate '*** Delete File: ${p}' entry.`);
        }
        this.patch.actions[p] = { type: ActionType.DELETE, chunks: [] };
        continue;
      }

      p = this.read_str(ADD_FILE_PREFIX);
      if (p) {
        if (this.patch.actions[p]) {
          throw new DiffError(`Add File Error: Duplicate Path: ${p}. Remove the duplicate '*** Add File: ${p}' entry.`);
        }
        if (p in this.current_files) {
          throw new DiffError(`Add File Error: File already exists: ${p}. Use '*** Update File:' instead of '*** Add File:' if modifying.`);
        }
        this.patch.actions[p] = this.parse_add_file();
        continue;
      }

      throw new DiffError(`Unknown Line: ${this.lines[this.index]}. Expecting '*** Update File:', '*** Delete File:', or '*** Add File:'.`);
    }

    if (!this.startswith(PATCH_SUFFIX.trim())) {
      throw new DiffError("Missing End Patch. Ensure the patch ends with '*** End Patch'.");
    }
    this.index += 1;
  }

  parse_update_file(text) {
    const action = { type: ActionType.UPDATE, chunks: [] };
    const fileLines = text.split("\n");
    let index = 0;

    while (
      !this.is_done([
        PATCH_SUFFIX,
        UPDATE_FILE_PREFIX,
        DELETE_FILE_PREFIX,
        ADD_FILE_PREFIX,
        END_OF_FILE_PREFIX,
      ])
    ) {
      let defStr = this.read_str("@@ ");
      if (!defStr && this.lines[this.index] === "@@") {
        defStr = "@@";
        this.index += 1;
      }
      if (!defStr && index !== 0) {
        if (
          this.startswith([HUNK_ADD_LINE_PREFIX, "-", " "]) ||
          this.lines[this.index] === END_OF_FILE_PREFIX
        ) {
        } else {
          throw new DiffError(`Invalid hunk line: ${this.lines[this.index]}. Ensure hunks start with '@@' and lines with '+', '-', or space.`);
        }
      }

      if (defStr.trim()) {
        let found = false;
        const canonLocal = s =>
          s.normalize("NFC").replace(/./gu, c =>
            ({
              "-": "-",
              "\u2010": "-",
              "\u2011": "-",
              "\u2012": "-",
              "\u2013": "-",
              "\u2014": "-",
              "\u2212": "-",
              "\u0022": '"',
              "\u201C": '"',
              "\u201D": '"',
              "\u201E": '"',
              "\u00AB": '"',
              "\u00BB": '"',
              "\u0027": "'",
              "\u2018": "'",
              "\u2019": "'",
              "\u201B": "'",
              "\u00A0": " ",
              "\u202F": " ",
            }[c] || c)
          );

        if (
          !fileLines.slice(0, index).some(s => canonLocal(s) === canonLocal(defStr))
        ) {
          for (let i = index; i < fileLines.length; i++) {
            if (canonLocal(fileLines[i]) === canonLocal(defStr)) {
              index = i + 1;
              found = true;
              break;
            }
          }
        }

        if (
          !found &&
          !fileLines
            .slice(0, index)
            .some(s => canonLocal(s.trim()) === canonLocal(defStr.trim()))
        ) {
          for (let i = index; i < fileLines.length; i++) {
            if (canonLocal(fileLines[i].trim()) === canonLocal(defStr.trim())) {
              index = i + 1;
              this.fuzz += 1;
              found = true;
              break;
            }
          }
        }
      }

      const [nextChunkContext, chunks, endPatchIndex, eof] = peek_next_section(
        this.lines,
        this.index
      );
      const [newIndex, fuzz] = find_context(
        fileLines,
        nextChunkContext,
        index,
        eof
      );

      if (newIndex === -1) {
        const ctxText = nextChunkContext.join("\n");
        const hint = eof
          ? "Make sure your context lines match the last lines of the file exactly."
          : "Make sure the context lines you're modifying exist and are spelled/punctuated exactly as in the original file.";
        throw new DiffError(
          `Invalid ${eof ? "EOF " : ""}Context starting at line ${index}:\n${ctxText}\nHint: ${hint}`
        );
      }

      this.fuzz += fuzz;
      for (const ch of chunks) {
        ch.orig_index += newIndex;
        action.chunks.push(ch);
      }
      index = newIndex + nextChunkContext.length;
      this.index = endPatchIndex;
    }

    return action;
  }

  parse_add_file() {
    const lines = [];
    while (
      !this.is_done([
        PATCH_SUFFIX,
        UPDATE_FILE_PREFIX,
        DELETE_FILE_PREFIX,
        ADD_FILE_PREFIX,
      ])
    ) {
      const s = this.read_str();
      if (!s.startsWith(HUNK_ADD_LINE_PREFIX)) {
        throw new DiffError(`Invalid Add File Line: ${s}. Lines in added files must start with '+'`);
      }
      lines.push(s.slice(1));
    }
    return {
      type: ActionType.ADD,
      new_file: lines.join("\n"),
      chunks: [],
    };
  }
}

function find_context_core(lines, context, start) {
  const canon = s =>
    s.normalize("NFC").replace(/./gu, c =>
      ({
        "-": "-",
        "\u2010": "-",
        "\u2011": "-",
        "\u2012": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u2212": "-",
        "\u0022": '"',
        "\u201C": '"',
        "\u201D": '"',
        "\u201E": '"',
        "\u00AB": '"',
        "\u00BB": '"',
        "\u0027": "'",
        "\u2018": "'",
        "\u2019": "'",
        "\u201B": "'",
        "\u00A0": " ",
        "\u202F": " ",
      }[c] || c)
    );

  if (context.length === 0) return [start, 0];
  const canonicalContext = canon(context.join("\n"));

  for (let i = start; i < lines.length; i++) {
    const segment = canon(lines.slice(i, i + context.length).join("\n"));
    if (segment === canonicalContext) return [i, 0];
  }
  for (let i = start; i < lines.length; i++) {
    const segment = canon(lines.slice(i, i + context.length).map(s => s.trimEnd()).join("\n"));
    const ctx = canon(context.map(s => s.trimEnd()).join("\n"));
    if (segment === ctx) return [i, 1];
  }
  for (let i = start; i < lines.length; i++) {
    const segment = canon(lines.slice(i, i + context.length).map(s => s.trim()).join("\n"));
    const ctx = canon(context.map(s => s.trim()).join("\n"));
    if (segment === ctx) return [i, 100];
  }

  return [-1, 0];
}

function find_context(lines, context, start, eof) {
  if (eof) {
    let [newIndex, fuzz] = find_context_core(
      lines,
      context,
      lines.length - context.length
    );
    if (newIndex !== -1) return [newIndex, fuzz];
    [newIndex, fuzz] = find_context_core(lines, context, start);
    return [newIndex, fuzz + 10000];
  }
  return find_context_core(lines, context, start);
}

function peek_next_section(lines, initialIndex) {
  let index = initialIndex;
  const old = [];
  let delLines = [];
  let insLines = [];
  const chunks = [];
  let mode = "keep";

  while (index < lines.length) {
    const s = lines[index];
    if (
      ["@@", PATCH_SUFFIX, UPDATE_FILE_PREFIX, DELETE_FILE_PREFIX, ADD_FILE_PREFIX, END_OF_FILE_PREFIX].some(p =>
        s.startsWith(p.trim())
      )
    ) {
      break;
    }
    if (s === "***") break;
    if (s.startsWith("***")) {
      throw new DiffError(`Invalid Line: ${s}. Did you forget a valid patch directive (e.g., '*** Update File:')?`);
    }

    index += 1;
    const lastMode = mode;
    let line = s;
    if (line[0] === HUNK_ADD_LINE_PREFIX) {
      mode = "add";
    } else if (line[0] === "-") {
      mode = "delete";
    } else if (line[0] === " ") {
      mode = "keep";
    } else {
      mode = "keep";
      line = " " + line;
    }

    line = line.slice(1);

    if (mode === "keep" && lastMode !== mode) {
      if (insLines.length || delLines.length) {
        chunks.push({
          orig_index: old.length - delLines.length,
          del_lines: delLines,
          ins_lines: insLines,
        });
      }
      delLines = [];
      insLines = [];
    }

    if (mode === "delete") {
      delLines.push(line);
      old.push(line);
    } else if (mode === "add") {
      insLines.push(line);
    } else {
      old.push(line);
    }
  }

  if (insLines.length || delLines.length) {
    chunks.push({
      orig_index: old.length - delLines.length,
      del_lines: delLines,
      ins_lines: insLines,
    });
  }

  if (index < lines.length && lines[index] === END_OF_FILE_PREFIX) {
    index += 1;
    return [old, chunks, index, true];
  }
  return [old, chunks, index, false];
}

export function text_to_patch(text, orig) {
  const lines = text.trim().split("\n");
  if (
    lines.length < 2 ||
    !lines[0].startsWith(PATCH_PREFIX.trim()) ||
    lines[lines.length - 1] !== PATCH_SUFFIX.trim()
  ) {
    throw new DiffError("Invalid patch text. Patch must start with '*** Begin Patch' and end with '*** End Patch'");
  }
  const parser = new Parser(orig, lines);
  parser.index = 1;
  parser.parse();
  return [parser.patch, parser.fuzz];
}

export function identify_files_needed(text) {
  const lines = text.trim().split("\n");
  const result = new Set();
  for (const line of lines) {
    if (line.startsWith(UPDATE_FILE_PREFIX)) {
      result.add(line.slice(UPDATE_FILE_PREFIX.length));
    }
    if (line.startsWith(DELETE_FILE_PREFIX)) {
      result.add(line.slice(DELETE_FILE_PREFIX.length));
    }
  }
  return Array.from(result);
}

export function identify_files_added(text) {
  const lines = text.trim().split("\n");
  const result = new Set();
  for (const line of lines) {
    if (line.startsWith(ADD_FILE_PREFIX)) {
      result.add(line.slice(ADD_FILE_PREFIX.length));
    }
  }
  return Array.from(result);
}

function _get_updated_file(text, action, path) {
  if (action.type !== ActionType.UPDATE) {
    throw new Error("Expected UPDATE action");
  }
  const origLines = text.split("\n");
  const destLines = [];
  let origIndex = 0;
  for (const chunk of action.chunks) {
    if (chunk.orig_index > origLines.length) {
      throw new DiffError(
        `${path}: chunk.orig_index ${chunk.orig_index} > file length ${origLines.length}. Make sure your patch lines apply within the file.`
      );
    }
    if (origIndex > chunk.orig_index) {
      throw new DiffError(
        `${path}: chunk index out of order: current index ${origIndex} > chunk.orig_index ${chunk.orig_index}. Check your hunk positions.`
      );
    }
    destLines.push(...origLines.slice(origIndex, chunk.orig_index));
    origIndex = chunk.orig_index;
    if (chunk.ins_lines.length) {
      destLines.push(...chunk.ins_lines);
    }
    origIndex += chunk.del_lines.length;
  }
  destLines.push(...origLines.slice(origIndex));
  return destLines.join("\n");
}

export function patch_to_commit(patch, orig) {
  const commit = { changes: {} };
  for (const [pathKey, action] of Object.entries(patch.actions)) {
    if (action.type === ActionType.DELETE) {
      commit.changes[pathKey] = {
        type: ActionType.DELETE,
        old_content: orig[pathKey],
      };
    } else if (action.type === ActionType.ADD) {
      commit.changes[pathKey] = {
        type: ActionType.ADD,
        new_content: action.new_file || "",
      };
    } else if (action.type === ActionType.UPDATE) {
      const newContent = _get_updated_file(orig[pathKey] || "", action, pathKey);
      commit.changes[pathKey] = {
        type: ActionType.UPDATE,
        old_content: orig[pathKey],
        new_content: newContent,
        move_path: action.move_path,
      };
    }
  }
  return commit;
}

export function load_files(paths, openFn) {
  const orig = {};
  for (const p of paths) {
    try {
      orig[p] = openFn(p);
    } catch {
      throw new DiffError(`File not found: ${p}. Make sure this file exists and is readable before applying the patch.`);
    }
  }
  return orig;
}

export function apply_commit(commit, writeFn, removeFn) {
  for (const [p, change] of Object.entries(commit.changes)) {
    if (change.type === ActionType.DELETE) {
      removeFn(p);
    } else if (change.type === ActionType.ADD) {
      writeFn(p, change.new_content || "");
    } else if (change.type === ActionType.UPDATE) {
      if (change.move_path) {
        writeFn(change.move_path, change.new_content || "");
        removeFn(p);
      } else {
        writeFn(p, change.new_content || "");
      }
    }
  }
}

function split_patch_blocks(text) {
  const blocks = [];
  let start = text.indexOf(PATCH_PREFIX);
  while (start !== -1) {
    const end = text.indexOf(PATCH_SUFFIX, start + PATCH_PREFIX.length);
    if (end === -1) break;
    const block = text.slice(start, end + PATCH_SUFFIX.length);
    blocks.push(block);
    start = text.indexOf(PATCH_PREFIX, end + PATCH_SUFFIX.length);
  }
  return blocks;
}

export function process_patch(text, openFn, writeFn, removeFn) {
  const blocks = split_patch_blocks(text);
  if (!blocks.length) {
    throw new DiffError("Patch must start with '*** Begin Patch'.");
  }
  for (const block of blocks) {
    const paths = identify_files_needed(block);
    const orig = load_files(paths, openFn);
    const [patch, _fuzz] = text_to_patch(block, orig);
    const commit = patch_to_commit(patch, orig);
    apply_commit(commit, writeFn, removeFn);
  }
  return "Done!";
}

function open_file(p) {
  return fs.readFileSync(p, "utf8");
}

function write_file(p, content) {
  if (path.isAbsolute(p)) {
    throw new DiffError("We do not support absolute paths.");
  }
  const parent = path.dirname(p);
  if (parent !== ".") {
    fs.mkdirSync(parent, { recursive: true });
  }
  fs.writeFileSync(p, content, "utf8");
}

function remove_file(p) {
  fs.unlinkSync(p);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let patchText = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => (patchText += chunk));
  process.stdin.on("end", () => {
    if (!patchText) {
      console.error("Please pass patch text through stdin");
      process.exit(1);
    }
    try {
      const result = process_patch(
        patchText,
        open_file,
        write_file,
        remove_file
      );
      console.log(result);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
}
