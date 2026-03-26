use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

const PATCH_PREFIX: &str = "*** Begin Patch";
const PATCH_SUFFIX: &str = "*** End Patch";
const ADD_FILE_PREFIX: &str = "*** Add File: ";
const DELETE_FILE_PREFIX: &str = "*** Delete File: ";
const UPDATE_FILE_PREFIX: &str = "*** Update File: ";
const MOVE_FILE_TO_PREFIX: &str = "*** Move File To: ";
const MOVE_TO_PREFIX: &str = "*** Move to: ";
const END_OF_FILE_PREFIX: &str = "*** End of File";

#[derive(Clone)]
struct Chunk {
    orig_index: usize,
    del_lines: Vec<String>,
    ins_lines: Vec<String>,
}

enum Action {
    Add {
        path: String,
        new_file: String,
    },
    Delete {
        path: String,
    },
    Update {
        path: String,
        move_path: Option<String>,
        chunks: Vec<Chunk>,
    },
}

struct Parser {
    lines: Vec<String>,
    index: usize,
    current_files: BTreeMap<String, String>,
}

impl Parser {
    fn is_done(&self) -> bool {
        self.index >= self.lines.len()
    }

    fn current(&self) -> Option<&str> {
        self.lines.get(self.index).map(String::as_str)
    }

    fn read_prefixed(&mut self, prefix: &str) -> Option<String> {
        let line = self.current()?.to_string();
        if line.starts_with(prefix) {
            self.index += 1;
            return Some(line[prefix.len()..].to_string());
        }
        None
    }

    fn parse(mut self) -> Result<Vec<Action>, String> {
        let mut actions = Vec::new();
        while !self.is_done() {
            if self.current() == Some(PATCH_SUFFIX) {
                self.index += 1;
                if !self.is_done() {
                    return Err("Unexpected content after '*** End Patch'".to_string());
                }
                return Ok(actions);
            }

            if let Some(path) = self.read_prefixed(ADD_FILE_PREFIX) {
                if self.current_files.contains_key(&path) {
                    return Err(format!("Add File Error: File already exists: {path}"));
                }
                let mut added = Vec::new();
                while let Some(line) = self.current() {
                    if is_directive(line) {
                        break;
                    }
                    if !line.starts_with('+') {
                        return Err(format!("Invalid Add File Line: {line}"));
                    }
                    added.push(line[1..].to_string());
                    self.index += 1;
                }
                actions.push(Action::Add {
                    path,
                    new_file: added.join("\n"),
                });
                continue;
            }

            if let Some(path) = self.read_prefixed(DELETE_FILE_PREFIX) {
                actions.push(Action::Delete { path });
                continue;
            }

            if let Some(path) = self.read_prefixed(UPDATE_FILE_PREFIX) {
                let move_path = self
                    .read_prefixed(MOVE_TO_PREFIX)
                    .or_else(|| self.read_prefixed(MOVE_FILE_TO_PREFIX));
                let current_text = self
                    .current_files
                    .get(&path)
                    .cloned()
                    .ok_or_else(|| format!("File not found: {path}"))?;
                let chunks = self.parse_update_file(&current_text)?;
                actions.push(Action::Update {
                    path,
                    move_path,
                    chunks,
                });
                continue;
            }

            let line = self.current().unwrap_or_default().to_string();
            return Err(format!("Unknown Line: {line}"));
        }
        Err("Missing End Patch".to_string())
    }

    fn parse_update_file(&mut self, text: &str) -> Result<Vec<Chunk>, String> {
        let file_lines = split_lines(text);
        let mut chunks = Vec::new();
        let mut file_index = 0usize;

        while let Some(line) = self.current().map(str::to_string) {
            if is_top_level_directive(&line) {
                break;
            }

            if line == END_OF_FILE_PREFIX {
                self.index += 1;
                break;
            }

            if line == "@@" {
                self.index += 1;
            } else if let Some(def_str) = self.read_prefixed("@@ ") {
                if !def_str.trim().is_empty() {
                    if let Some(found) = find_def_context(&file_lines, &def_str, file_index) {
                        file_index = found + 1;
                    }
                }
            } else if file_index != 0 && !starts_hunk_line(&line) {
                return Err(format!("Invalid hunk line: {line}"));
            }

            let (old, next_chunks, next_index, eof) = peek_next_section(&self.lines, self.index)?;
            let (found_at, _) = find_context(&file_lines, &old, file_index, eof)
                .ok_or_else(|| format!("Invalid Context starting at line {file_index}"))?;
            for mut chunk in next_chunks {
                chunk.orig_index += found_at;
                chunks.push(chunk);
            }
            file_index = found_at + old.len();
            self.index = next_index;
        }

        Ok(chunks)
    }
}

fn is_directive(line: &str) -> bool {
    matches!(line, PATCH_SUFFIX | END_OF_FILE_PREFIX)
        || line.starts_with(ADD_FILE_PREFIX)
        || line.starts_with(DELETE_FILE_PREFIX)
        || line.starts_with(UPDATE_FILE_PREFIX)
}

fn is_top_level_directive(line: &str) -> bool {
    line == PATCH_SUFFIX
        || line.starts_with(ADD_FILE_PREFIX)
        || line.starts_with(DELETE_FILE_PREFIX)
        || line.starts_with(UPDATE_FILE_PREFIX)
}

fn starts_hunk_line(line: &str) -> bool {
    line.starts_with('+') || line.starts_with('-') || line.starts_with(' ')
}

fn split_lines(text: &str) -> Vec<String> {
    text.split('\n')
        .map(|line| line.trim_end_matches('\r').to_string())
        .collect()
}

fn canon(text: &str) -> String {
    text.chars()
        .map(|ch| match ch {
            '\u{2010}' | '\u{2011}' | '\u{2012}' | '\u{2013}' | '\u{2014}' | '\u{2212}' => '-',
            '\u{201C}' | '\u{201D}' | '\u{201E}' | '\u{00AB}' | '\u{00BB}' => '"',
            '\u{2018}' | '\u{2019}' | '\u{201B}' => '\'',
            '\u{00A0}' | '\u{202F}' => ' ',
            other => other,
        })
        .collect()
}

fn find_def_context(file_lines: &[String], def_str: &str, start: usize) -> Option<usize> {
    let local = canon(def_str);
    for idx in start..file_lines.len() {
        if canon(&file_lines[idx]) == local {
            return Some(idx);
        }
    }
    let trimmed = canon(def_str.trim());
    for idx in start..file_lines.len() {
        if canon(file_lines[idx].trim()) == trimmed {
            return Some(idx);
        }
    }
    None
}

fn find_context_core(lines: &[String], context: &[String], start: usize) -> Option<(usize, usize)> {
    if context.is_empty() {
        return Some((start, 0));
    }
    let context_joined = canon(&context.join("\n"));
    for idx in start..=lines.len().saturating_sub(context.len()) {
        if canon(&lines[idx..idx + context.len()].join("\n")) == context_joined {
            return Some((idx, 0));
        }
    }
    let trimmed_end = canon(
        &context
            .iter()
            .map(|line| line.trim_end())
            .collect::<Vec<_>>()
            .join("\n"),
    );
    for idx in start..=lines.len().saturating_sub(context.len()) {
        let candidate = canon(
            &lines[idx..idx + context.len()]
                .iter()
                .map(|line| line.trim_end())
                .collect::<Vec<_>>()
                .join("\n"),
        );
        if candidate == trimmed_end {
            return Some((idx, 1));
        }
    }
    let trimmed = canon(
        &context
            .iter()
            .map(|line| line.trim())
            .collect::<Vec<_>>()
            .join("\n"),
    );
    for idx in start..=lines.len().saturating_sub(context.len()) {
        let candidate = canon(
            &lines[idx..idx + context.len()]
                .iter()
                .map(|line| line.trim())
                .collect::<Vec<_>>()
                .join("\n"),
        );
        if candidate == trimmed {
            return Some((idx, 100));
        }
    }
    None
}

fn find_context(
    lines: &[String],
    context: &[String],
    start: usize,
    eof: bool,
) -> Option<(usize, usize)> {
    if eof {
        let eof_start = lines.len().saturating_sub(context.len());
        if let Some(found) = find_context_core(lines, context, eof_start) {
            return Some(found);
        }
        return find_context_core(lines, context, start).map(|(idx, fuzz)| (idx, fuzz + 10000));
    }
    find_context_core(lines, context, start)
}

fn peek_next_section(
    lines: &[String],
    initial_index: usize,
) -> Result<(Vec<String>, Vec<Chunk>, usize, bool), String> {
    let mut index = initial_index;
    let mut old = Vec::new();
    let mut del_lines = Vec::new();
    let mut ins_lines = Vec::new();
    let mut chunks = Vec::new();
    let mut mode = "keep";

    while index < lines.len() {
        let current = &lines[index];
        if current == "@@"
            || current == PATCH_SUFFIX
            || current == END_OF_FILE_PREFIX
            || current.starts_with(ADD_FILE_PREFIX)
            || current.starts_with(DELETE_FILE_PREFIX)
            || current.starts_with(UPDATE_FILE_PREFIX)
        {
            break;
        }
        if current == "***" {
            break;
        }
        if current.starts_with("***") {
            return Err(format!("Invalid Line: {current}"));
        }

        index += 1;
        let last_mode = mode;
        let mut body = current.clone();
        if body.starts_with('+') {
            mode = "add";
        } else if body.starts_with('-') {
            mode = "delete";
        } else {
            mode = "keep";
            if !body.starts_with(' ') {
                body = format!(" {body}");
            }
        }

        let body = body[1..].to_string();
        if mode == "keep" && last_mode != mode && (!ins_lines.is_empty() || !del_lines.is_empty()) {
            chunks.push(Chunk {
                orig_index: old.len() - del_lines.len(),
                del_lines: del_lines.clone(),
                ins_lines: ins_lines.clone(),
            });
            del_lines.clear();
            ins_lines.clear();
        }

        if mode == "delete" {
            del_lines.push(body.clone());
            old.push(body);
        } else if mode == "add" {
            ins_lines.push(body);
        } else {
            old.push(body);
        }
    }

    if !ins_lines.is_empty() || !del_lines.is_empty() {
        chunks.push(Chunk {
            orig_index: old.len() - del_lines.len(),
            del_lines,
            ins_lines,
        });
    }

    let eof = lines
        .get(index)
        .map(|line| line == END_OF_FILE_PREFIX)
        .unwrap_or(false);
    let next_index = if eof { index + 1 } else { index };
    Ok((old, chunks, next_index, eof))
}

fn updated_file_contents(original: &str, chunks: &[Chunk], path: &str) -> Result<String, String> {
    let orig_lines = split_lines(original);
    let mut dest = Vec::new();
    let mut orig_index = 0usize;

    for chunk in chunks {
        if chunk.orig_index > orig_lines.len() {
            return Err(format!("{path}: chunk index out of range"));
        }
        if orig_index > chunk.orig_index {
            return Err(format!("{path}: chunk index out of order"));
        }
        dest.extend_from_slice(&orig_lines[orig_index..chunk.orig_index]);
        orig_index = chunk.orig_index;
        if !chunk.ins_lines.is_empty() {
            dest.extend(chunk.ins_lines.iter().cloned());
        }
        orig_index += chunk.del_lines.len();
    }

    dest.extend_from_slice(&orig_lines[orig_index..]);
    Ok(dest.join("\n"))
}

fn resolve_relative(base: &Path, rel: &str) -> Result<PathBuf, String> {
    let relative = Path::new(rel);
    if relative.is_absolute() {
        return Err("Absolute paths are not supported".to_string());
    }
    Ok(base.join(relative))
}

pub fn apply_patch(base: &Path, text: &str) -> Result<(), String> {
    let lines = split_lines(text.trim());
    if lines.first().map(String::as_str) != Some(PATCH_PREFIX) {
        return Err("Patch must start with '*** Begin Patch'".to_string());
    }
    if lines.last().map(String::as_str) != Some(PATCH_SUFFIX) {
        return Err("Patch must end with '*** End Patch'".to_string());
    }

    let mut needed = BTreeMap::new();
    for line in lines.iter().skip(1).take(lines.len().saturating_sub(2)) {
        if let Some(path) = line
            .strip_prefix(UPDATE_FILE_PREFIX)
            .or_else(|| line.strip_prefix(DELETE_FILE_PREFIX))
        {
            let full = resolve_relative(base, path)?;
            let content =
                fs::read_to_string(&full).map_err(|_| format!("File not found: {path}"))?;
            needed.insert(path.to_string(), content);
        }
    }

    let parser = Parser {
        lines,
        index: 1,
        current_files: needed,
    };
    let actions = parser.parse()?;

    for action in actions {
        match action {
            Action::Add { path, new_file } => {
                let full = resolve_relative(base, &path)?;
                if let Some(parent) = full.parent() {
                    fs::create_dir_all(parent).map_err(|err| err.to_string())?;
                }
                fs::write(full, new_file).map_err(|err| err.to_string())?;
            }
            Action::Delete { path } => {
                let full = resolve_relative(base, &path)?;
                fs::remove_file(full).map_err(|err| err.to_string())?;
            }
            Action::Update {
                path,
                move_path,
                chunks,
            } => {
                let source = resolve_relative(base, &path)?;
                let original = fs::read_to_string(&source).map_err(|err| err.to_string())?;
                let updated = updated_file_contents(&original, &chunks, &path)?;
                if let Some(new_path) = move_path {
                    let target = resolve_relative(base, &new_path)?;
                    if let Some(parent) = target.parent() {
                        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
                    }
                    fs::write(&target, updated).map_err(|err| err.to_string())?;
                    fs::remove_file(source).map_err(|err| err.to_string())?;
                } else {
                    fs::write(source, updated).map_err(|err| err.to_string())?;
                }
            }
        }
    }

    Ok(())
}
