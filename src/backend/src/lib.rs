mod patch;
mod prompts;

use ignore::WalkBuilder;
use notify::{recommended_watcher, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use regex::RegexBuilder;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

const TOKEN_ESTIMATE_THRESHOLD: u64 = 64 * 1024;
const LINES_SAMPLE_THRESHOLD: u64 = 64 * 1024;

#[derive(Default)]
struct FolderTree {
    children: BTreeMap<String, FolderTree>,
}

struct AppState {
    opened_folder: Mutex<Option<PathBuf>>,
    watcher: Mutex<Option<RecommendedWatcher>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            opened_folder: Mutex::new(None),
            watcher: Mutex::new(None),
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FilePayload {
    full_path: String,
    name: String,
    tokens: usize,
    lines: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitDiffCopyPayload {
    diff: String,
    diff_length: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitStatusFile {
    path: String,
    status: String,
    from: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitStatusPayload {
    branch: Option<String>,
    upstream: Option<String>,
    ahead: usize,
    behind: usize,
    detached: bool,
    merging: bool,
    staged: Vec<GitStatusFile>,
    unstaged: Vec<GitStatusFile>,
    untracked: Vec<GitStatusFile>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitCommitPayload {
    sha: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitLogEntry {
    sha: String,
    parents: Vec<String>,
    author_name: String,
    author_email: String,
    date: String,
    subject: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitCommitDetails {
    sha: String,
    parents: Vec<String>,
    author_name: String,
    author_email: String,
    date: String,
    subject: String,
    files: Vec<GitStatusFile>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitBlameLine {
    sha: String,
    author: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitBranch {
    name: String,
    sha: String,
    head: bool,
    upstream: Option<String>,
    ahead: usize,
    behind: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitCopyTextPayload {
    text: String,
    length: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitRangePromptPayload {
    text: String,
    tokens: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchResult {
    path: String,
    line: usize,
    preview: String,
    ranges: Vec<(usize, usize)>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitLogParams {
    skip: Option<usize>,
    limit: Option<usize>,
    author: Option<String>,
    grep: Option<String>,
    path: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchParams {
    query: String,
    regex: Option<bool>,
    case_sensitive: Option<bool>,
    word: Option<bool>,
    per_file: Option<usize>,
    max_results: Option<usize>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CopySelectedFilesParams {
    paths: Vec<String>,
    include_tree: bool,
    prompt_type: String,
    instructions: String,
}

fn opened_folder(state: &AppState) -> Result<PathBuf, String> {
    state
        .opened_folder
        .lock()
        .map_err(|_| "State lock failed".to_string())?
        .clone()
        .ok_or_else(|| "No folder is currently opened".to_string())
}

fn binary_extension(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|ext| ext.to_str()).map(|ext| ext.to_ascii_lowercase()),
        Some(ext) if matches!(
            ext.as_str(),
            "png" | "jpg" | "jpeg" | "gif" | "bmp" | "webp" | "ico" | "icns" | "pdf" | "zip" | "gz" | "tgz"
                | "bz2" | "xz" | "7z" | "rar" | "mp3" | "mp4" | "m4a" | "m4v" | "mov" | "avi" | "mkv"
                | "wav" | "flac" | "ogg" | "webm" | "ttf" | "otf" | "woff" | "woff2" | "eot" | "jar"
                | "class" | "o" | "so" | "dll" | "dylib" | "exe" | "bin" | "dmg" | "iso" | "img"
        )
    )
}

fn statically_ignored(path: &Path) -> bool {
    path.components().any(|component| {
        let value = component.as_os_str().to_string_lossy();
        matches!(value.as_ref(), ".git" | "node_modules")
    }) || matches!(
        path.file_name().and_then(|name| name.to_str()),
        Some("package-lock.json") | Some(".env") | Some("poetry.lock")
    )
}

fn is_probably_binary(path: &Path) -> bool {
    if binary_extension(path) {
        return true;
    }
    let Ok(mut file) = fs::File::open(path) else {
        return true;
    };
    let mut buf = [0u8; 8192];
    let Ok(read) = file.read(&mut buf) else {
        return true;
    };
    let bytes = &buf[..read];
    bytes.contains(&0) || std::str::from_utf8(bytes).is_err()
}

fn estimate_tokens_inner(path: &Path) -> usize {
    let Ok(metadata) = fs::metadata(path) else {
        return 0;
    };
    if metadata.len() <= TOKEN_ESTIMATE_THRESHOLD {
        let Ok(content) = fs::read_to_string(path) else {
            return 0;
        };
        return content.len().div_ceil(4);
    }
    metadata.len().div_ceil(4) as usize
}

fn estimate_lines_inner(path: &Path) -> usize {
    let Ok(metadata) = fs::metadata(path) else {
        return 0;
    };
    if metadata.len() <= LINES_SAMPLE_THRESHOLD {
        let Ok(content) = fs::read_to_string(path) else {
            return 0;
        };
        if content.is_empty() {
            return 0;
        }
        let newline_count = content.bytes().filter(|byte| *byte == b'\n').count();
        return if content.ends_with('\n') {
            newline_count
        } else {
            newline_count + 1
        };
    }
    let Ok(mut file) = fs::File::open(path) else {
        return 0;
    };
    let mut buf = vec![0u8; LINES_SAMPLE_THRESHOLD as usize];
    let Ok(bytes_read) = file.read(&mut buf) else {
        return 0;
    };
    if bytes_read == 0 {
        return 0;
    }
    let newline_count = buf[..bytes_read]
        .iter()
        .filter(|byte| **byte == b'\n')
        .count();
    let density = newline_count as f64 / bytes_read as f64;
    let estimate = (density * metadata.len() as f64).ceil() as usize;
    if estimate > 0 {
        estimate
    } else {
        1
    }
}

fn list_files(folder: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    let walker = WalkBuilder::new(folder)
        .hidden(false)
        .git_ignore(true)
        .git_exclude(true)
        .git_global(true)
        .ignore(true)
        .parents(true)
        .build();

    for entry in walker {
        let entry = entry.map_err(|err| err.to_string())?;
        if !entry
            .file_type()
            .map(|kind| kind.is_file())
            .unwrap_or(false)
        {
            continue;
        }
        let path = entry.path().to_path_buf();
        if statically_ignored(&path) || is_probably_binary(&path) {
            continue;
        }
        files.push(path);
    }

    files.sort();
    Ok(files)
}

fn file_payloads(paths: &[PathBuf]) -> Vec<FilePayload> {
    paths
        .iter()
        .map(|path| FilePayload {
            full_path: path.to_string_lossy().to_string(),
            name: path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_string(),
            tokens: estimate_tokens_inner(path),
            lines: estimate_lines_inner(path),
        })
        .collect()
}

fn start_watcher(app: AppHandle, state: &AppState, folder: PathBuf) -> Result<(), String> {
    let watch_folder = folder.clone();
    let mut watcher = recommended_watcher(move |result: notify::Result<Event>| {
        let Ok(event) = result else {
            return;
        };
        let event_name = match event.kind {
            EventKind::Create(_) => Some("file-added"),
            EventKind::Modify(_) => Some("file-changed"),
            EventKind::Remove(_) => Some("file-removed"),
            _ => None,
        };
        let Some(event_name) = event_name else {
            return;
        };
        for path in event.paths {
            if !path.starts_with(&watch_folder) || statically_ignored(&path) {
                continue;
            }
            if event_name != "file-removed" && is_probably_binary(&path) {
                continue;
            }
            let _ = app.emit(event_name, path.to_string_lossy().to_string());
        }
    })
    .map_err(|err| err.to_string())?;
    watcher
        .watch(&folder, RecursiveMode::Recursive)
        .map_err(|err| err.to_string())?;
    let mut slot = state
        .watcher
        .lock()
        .map_err(|_| "State lock failed".to_string())?;
    *slot = Some(watcher);
    Ok(())
}

fn ensure_open_folder(
    app: &AppHandle,
    state: &AppState,
    folder: PathBuf,
) -> Result<String, String> {
    let canonical = fs::canonicalize(&folder).unwrap_or(folder);
    let files = list_files(&canonical)?;
    let payload = file_payloads(&files);
    {
        let mut opened = state
            .opened_folder
            .lock()
            .map_err(|_| "State lock failed".to_string())?;
        *opened = Some(canonical.clone());
    }
    start_watcher(app.clone(), state, canonical.clone())?;
    app.emit("files:initial", payload)
        .map_err(|err| err.to_string())?;
    if let Some(window) = app.get_webview_window("main") {
        let title = canonical
            .file_name()
            .and_then(|value| value.to_str())
            .map(|value| format!("{value} - Cobase"))
            .unwrap_or_else(|| "Cobase".to_string());
        let _ = window.set_title(&title);
    }
    Ok(canonical.to_string_lossy().to_string())
}

fn run_git_capture(
    folder: &Path,
    args: &[String],
    accept_stdout_on_failure: bool,
) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(folder)
        .output()
        .map_err(|err| err.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if output.status.success() || (accept_stdout_on_failure && !stdout.is_empty()) {
        Ok(stdout)
    } else {
        Err(if stderr.trim().is_empty() {
            "Git command failed".to_string()
        } else {
            stderr.trim().to_string()
        })
    }
}

fn parse_name_status(text: &str) -> Vec<GitStatusFile> {
    text.lines()
        .filter_map(|line| {
            if line.trim().is_empty() {
                return None;
            }
            let parts = line.split('\t').collect::<Vec<_>>();
            let code = *parts.first()?;
            if code.starts_with('R') || code.starts_with('C') {
                Some(GitStatusFile {
                    path: parts.get(2).unwrap_or(&"").to_string(),
                    status: code.to_string(),
                    from: parts.get(1).map(|value| value.to_string()),
                })
            } else {
                Some(GitStatusFile {
                    path: parts.get(1).unwrap_or(&"").to_string(),
                    status: code.to_string(),
                    from: None,
                })
            }
        })
        .collect()
}

fn render_tree(paths: &[String], base: &Path) -> String {
    let mut root = FolderTree::default();
    for full_path in paths {
        let relative = Path::new(full_path)
            .strip_prefix(base)
            .unwrap_or_else(|_| Path::new(full_path));
        let parts = relative
            .components()
            .map(|component| component.as_os_str().to_string_lossy().to_string())
            .collect::<Vec<_>>();
        let mut node = &mut root;
        for part in parts {
            node = node.children.entry(part).or_default();
        }
    }
    let mut lines = Vec::new();
    render_tree_node(&root, "", &mut lines);
    format!("# File Tree\n{}\n\n", lines.join("\n"))
}

fn render_tree_node(node: &FolderTree, prefix: &str, lines: &mut Vec<String>) {
    let names = node.children.keys().cloned().collect::<Vec<_>>();
    for (index, name) in names.iter().enumerate() {
        let is_last = index + 1 == names.len();
        lines.push(format!(
            "{prefix}{}{}",
            if is_last { "└─ " } else { "├─ " },
            name
        ));
        if let Some(child) = node.children.get(name) {
            let next_prefix = format!("{prefix}{}", if is_last { "   " } else { "│  " });
            render_tree_node(child, &next_prefix, lines);
        }
    }
}

fn prompt_guidelines(prompt_type: &str) -> &'static str {
    match prompt_type {
        "Patch" => prompts::CREATE_PATCH,
        "Question" => prompts::QUESTION,
        "Blank" => prompts::BLANK,
        _ => "",
    }
}

fn approx_tokens(text: &str) -> usize {
    text.len().div_ceil(4)
}

fn read_folder_text_files(folder: &Path) -> Result<Vec<PathBuf>, String> {
    list_files(folder)
}

#[tauri::command]
fn open_folder(app: AppHandle, state: State<'_, AppState>, path: String) -> Result<String, String> {
    ensure_open_folder(&app, &state, PathBuf::from(path))
}

#[tauri::command]
fn estimate_tokens(path: String) -> usize {
    estimate_tokens_inner(Path::new(&path))
}

#[tauri::command]
fn estimate_lines(path: String) -> usize {
    estimate_lines_inner(Path::new(&path))
}

#[tauri::command]
fn copy_selected_files_text(
    state: State<'_, AppState>,
    paths: Vec<String>,
    include_tree: bool,
    prompt_type: String,
    instructions: String,
) -> Result<String, String> {
    let params = CopySelectedFilesParams {
        paths,
        include_tree,
        prompt_type,
        instructions,
    };
    let base = opened_folder(&state)?;
    let mut parts = Vec::new();
    if params.include_tree {
        parts.push(render_tree(&params.paths, &base));
    }
    let mut contents = Vec::new();
    for full_path in &params.paths {
        let path = Path::new(full_path);
        let relative = path
            .strip_prefix(&base)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();
        let content = fs::read_to_string(path).map_err(|err| err.to_string())?;
        contents.push(format!("# ./{relative}\n{content}"));
    }
    parts.push(contents.join("\n\n"));
    let guidelines = prompt_guidelines(&params.prompt_type).trim().to_string();
    if !guidelines.is_empty() {
        parts.push(format!("\nGuidelines:\n{guidelines}"));
    }
    if !params.instructions.trim().is_empty() {
        parts.push(format!("\nInstructions:\n{}", params.instructions.trim()));
    }
    Ok(parts.join(""))
}

#[tauri::command]
fn git_copy_diff_text(state: State<'_, AppState>) -> Result<GitDiffCopyPayload, String> {
    let base = opened_folder(&state)?;
    let tracked = run_git_capture(&base, &["diff".to_string()], true)?;
    let untracked = run_git_capture(
        &base,
        &[
            "ls-files".to_string(),
            "--others".to_string(),
            "--exclude-standard".to_string(),
        ],
        false,
    )?;
    let mut diff = tracked;
    for file in untracked.lines().filter(|line| !line.trim().is_empty()) {
        diff.push_str(&run_git_capture(
            &base,
            &[
                "diff".to_string(),
                "--no-index".to_string(),
                "--".to_string(),
                "/dev/null".to_string(),
                file.to_string(),
            ],
            true,
        )?);
    }
    if diff.trim().is_empty() {
        return Err("Working tree is clean - nothing to diff".to_string());
    }
    Ok(GitDiffCopyPayload {
        diff_length: diff.len(),
        diff,
    })
}

#[tauri::command]
fn git_status(state: State<'_, AppState>) -> Result<GitStatusPayload, String> {
    let base = opened_folder(&state)?;
    let branch_info = run_git_capture(
        &base,
        &[
            "status".to_string(),
            "--porcelain=2".to_string(),
            "--branch".to_string(),
        ],
        false,
    )?;
    let mut branch = None;
    let mut upstream = None;
    let mut ahead = 0usize;
    let mut behind = 0usize;
    let mut detached = false;
    for line in branch_info.lines() {
        if let Some(value) = line.strip_prefix("# branch.head ") {
            if value == "(detached)" {
                detached = true;
            } else {
                branch = Some(value.to_string());
            }
        } else if let Some(value) = line.strip_prefix("# branch.upstream ") {
            upstream = Some(value.to_string());
        } else if let Some(value) = line.strip_prefix("# branch.ab ") {
            let parts = value.split_whitespace().collect::<Vec<_>>();
            if let Some(raw) = parts.first() {
                if let Some(num) = raw.strip_prefix('+') {
                    ahead = num.parse().unwrap_or(0);
                }
            }
            if let Some(raw) = parts.get(1) {
                if let Some(num) = raw.strip_prefix('-') {
                    behind = num.parse().unwrap_or(0);
                }
            }
        }
    }
    let merging = run_git_capture(
        &base,
        &[
            "rev-parse".to_string(),
            "-q".to_string(),
            "--verify".to_string(),
            "REBASE_HEAD".to_string(),
        ],
        true,
    )
    .map(|value| !value.trim().is_empty())
    .unwrap_or(false)
        || run_git_capture(
            &base,
            &[
                "rev-parse".to_string(),
                "-q".to_string(),
                "--verify".to_string(),
                "MERGE_HEAD".to_string(),
            ],
            true,
        )
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    let staged = parse_name_status(&run_git_capture(
        &base,
        &[
            "diff".to_string(),
            "--name-status".to_string(),
            "--cached".to_string(),
        ],
        false,
    )?);
    let unstaged = parse_name_status(&run_git_capture(
        &base,
        &["diff".to_string(), "--name-status".to_string()],
        false,
    )?);
    let untracked = run_git_capture(
        &base,
        &[
            "ls-files".to_string(),
            "--others".to_string(),
            "--exclude-standard".to_string(),
        ],
        false,
    )?
    .lines()
    .filter(|line| !line.trim().is_empty())
    .map(|path| GitStatusFile {
        path: path.to_string(),
        status: "U".to_string(),
        from: None,
    })
    .collect::<Vec<_>>();
    Ok(GitStatusPayload {
        branch,
        upstream,
        ahead,
        behind,
        detached,
        merging,
        staged,
        unstaged,
        untracked,
    })
}

#[tauri::command]
fn git_diff_file(state: State<'_, AppState>, path: String, staged: bool) -> Result<String, String> {
    let base = opened_folder(&state)?;
    let args = if staged {
        vec![
            "diff".to_string(),
            "--cached".to_string(),
            "--".to_string(),
            path.clone(),
        ]
    } else {
        vec!["diff".to_string(), "--".to_string(), path.clone()]
    };
    let diff = run_git_capture(&base, &args, false)?;
    if !diff.trim().is_empty() {
        return Ok(diff);
    }
    let untracked = run_git_capture(
        &base,
        &[
            "ls-files".to_string(),
            "--others".to_string(),
            "--exclude-standard".to_string(),
        ],
        false,
    )?;
    if untracked.lines().any(|line| line == path) {
        return run_git_capture(
            &base,
            &[
                "diff".to_string(),
                "--no-index".to_string(),
                "--".to_string(),
                "/dev/null".to_string(),
                path,
            ],
            true,
        );
    }
    Ok(diff)
}

#[tauri::command]
fn git_stage(state: State<'_, AppState>, paths: Vec<String>) -> Result<bool, String> {
    if paths.is_empty() {
        return Err("No paths".to_string());
    }
    let base = opened_folder(&state)?;
    let mut args = vec!["add".to_string(), "-A".to_string(), "--".to_string()];
    args.extend(paths);
    run_git_capture(&base, &args, false)?;
    Ok(true)
}

#[tauri::command]
fn git_unstage(state: State<'_, AppState>, paths: Vec<String>) -> Result<bool, String> {
    if paths.is_empty() {
        return Err("No paths".to_string());
    }
    let base = opened_folder(&state)?;
    let mut args = vec![
        "restore".to_string(),
        "--staged".to_string(),
        "--".to_string(),
    ];
    args.extend(paths);
    run_git_capture(&base, &args, false)?;
    Ok(true)
}

#[tauri::command]
fn git_discard(state: State<'_, AppState>, paths: Vec<String>) -> Result<bool, String> {
    if paths.is_empty() {
        return Err("No paths".to_string());
    }
    let base = opened_folder(&state)?;
    let tracked = run_git_capture(&base, &["ls-files".to_string()], false)?;
    let tracked_set = tracked
        .lines()
        .map(|line| line.to_string())
        .collect::<BTreeSet<_>>();
    let tracked_paths = paths
        .iter()
        .filter(|path| tracked_set.contains(*path))
        .cloned()
        .collect::<Vec<_>>();
    let untracked_paths = paths
        .iter()
        .filter(|path| !tracked_set.contains(*path))
        .cloned()
        .collect::<Vec<_>>();
    if !tracked_paths.is_empty() {
        let mut args = vec![
            "restore".to_string(),
            "--worktree".to_string(),
            "--".to_string(),
        ];
        args.extend(tracked_paths);
        run_git_capture(&base, &args, false)?;
    }
    if !untracked_paths.is_empty() {
        let mut args = vec!["clean".to_string(), "-f".to_string(), "--".to_string()];
        args.extend(untracked_paths);
        run_git_capture(&base, &args, false)?;
    }
    Ok(true)
}

#[tauri::command]
fn git_commit(state: State<'_, AppState>, message: String) -> Result<GitCommitPayload, String> {
    if message.trim().is_empty() {
        return Err("Commit message required".to_string());
    }
    let base = opened_folder(&state)?;
    run_git_capture(
        &base,
        &["commit".to_string(), "-m".to_string(), message],
        false,
    )?;
    let sha = run_git_capture(&base, &["rev-parse".to_string(), "HEAD".to_string()], false)?;
    Ok(GitCommitPayload {
        sha: sha.trim().to_string(),
    })
}

#[tauri::command]
fn git_log(state: State<'_, AppState>, payload: GitLogParams) -> Result<Vec<GitLogEntry>, String> {
    let base = opened_folder(&state)?;
    let mut args = vec![
        "log".to_string(),
        format!("--skip={}", payload.skip.unwrap_or(0)),
        "-n".to_string(),
        payload.limit.unwrap_or(50).to_string(),
        "--date=iso".to_string(),
        "--pretty=format:%H\x1f%P\x1f%an\x1f%ae\x1f%ad\x1f%s\x1e".to_string(),
    ];
    if let Some(author) = payload.author.filter(|value| !value.is_empty()) {
        args.push(format!("--author={author}"));
    }
    if let Some(grep) = payload.grep.filter(|value| !value.is_empty()) {
        args.push(format!("--grep={grep}"));
    }
    if let Some(path) = payload.path.filter(|value| !value.is_empty()) {
        args.push("--".to_string());
        args.push(path);
    }
    let output = run_git_capture(&base, &args, false)?;
    Ok(output
        .split('\x1e')
        .filter(|entry| !entry.trim().is_empty())
        .map(|entry| {
            let parts = entry.split('\x1f').collect::<Vec<_>>();
            GitLogEntry {
                sha: parts.first().copied().unwrap_or_default().to_string(),
                parents: parts
                    .get(1)
                    .copied()
                    .unwrap_or_default()
                    .split_whitespace()
                    .map(str::to_string)
                    .collect(),
                author_name: parts.get(2).copied().unwrap_or_default().to_string(),
                author_email: parts.get(3).copied().unwrap_or_default().to_string(),
                date: parts.get(4).copied().unwrap_or_default().to_string(),
                subject: parts.get(5).copied().unwrap_or_default().to_string(),
            }
        })
        .collect())
}

#[tauri::command]
fn git_commit_details(state: State<'_, AppState>, sha: String) -> Result<GitCommitDetails, String> {
    let base = opened_folder(&state)?;
    let meta = run_git_capture(
        &base,
        &[
            "show".to_string(),
            "-s".to_string(),
            "--format=%H%x1f%P%x1f%an%x1f%ae%x1f%ad%x1f%s".to_string(),
            "--date=iso".to_string(),
            sha.clone(),
        ],
        false,
    )?;
    let parts = meta.trim().split('\x1f').collect::<Vec<_>>();
    let files = parse_name_status(&run_git_capture(
        &base,
        &[
            "show".to_string(),
            "--name-status".to_string(),
            "--pretty=format:".to_string(),
            "--no-color".to_string(),
            sha,
        ],
        false,
    )?);
    Ok(GitCommitDetails {
        sha: parts.first().copied().unwrap_or_default().to_string(),
        parents: parts
            .get(1)
            .copied()
            .unwrap_or_default()
            .split_whitespace()
            .map(str::to_string)
            .collect(),
        author_name: parts.get(2).copied().unwrap_or_default().to_string(),
        author_email: parts.get(3).copied().unwrap_or_default().to_string(),
        date: parts.get(4).copied().unwrap_or_default().to_string(),
        subject: parts.get(5).copied().unwrap_or_default().to_string(),
        files,
    })
}

#[tauri::command]
fn git_blame(
    state: State<'_, AppState>,
    path: String,
    rev: Option<String>,
) -> Result<Vec<GitBlameLine>, String> {
    let base = opened_folder(&state)?;
    let mut args = vec!["blame".to_string(), "-p".to_string()];
    if let Some(rev) = rev.filter(|value| !value.is_empty()) {
        args.push(rev);
    }
    args.push("--".to_string());
    args.push(path);
    let output = run_git_capture(&base, &args, false)?;
    let lines = output.lines().collect::<Vec<_>>();
    let mut result = Vec::new();
    let mut index = 0usize;
    while index < lines.len() {
        let header = lines[index];
        index += 1;
        if header.trim().is_empty() {
            continue;
        }
        let sha = header
            .split_whitespace()
            .next()
            .unwrap_or_default()
            .to_string();
        let mut author = String::new();
        let mut content = String::new();
        while index < lines.len() {
            let line = lines[index];
            index += 1;
            if line.starts_with("author ") {
                author = line[7..].to_string();
            }
            if let Some(value) = line.strip_prefix('\t') {
                content = value.to_string();
                break;
            }
        }
        result.push(GitBlameLine {
            sha,
            author,
            content,
        });
    }
    Ok(result)
}

#[tauri::command]
fn git_branches(state: State<'_, AppState>) -> Result<Vec<GitBranch>, String> {
    let base = opened_folder(&state)?;
    let output = run_git_capture(
        &base,
        &[
            "for-each-ref".to_string(),
            "--format=%(HEAD)%00%(refname:short)%00%(objectname)%00%(upstream:short)%00%(upstream:trackshort)".to_string(),
            "refs/heads".to_string(),
        ],
        false,
    )?;
    Ok(output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            let parts = line.split('\0').collect::<Vec<_>>();
            let track = parts.get(4).copied().unwrap_or_default();
            let ahead = regex::Regex::new(r"ahead ([0-9]+)")
                .ok()
                .and_then(|re| re.captures(track))
                .and_then(|cap| cap.get(1))
                .and_then(|value| value.as_str().parse::<usize>().ok())
                .unwrap_or(0);
            let behind = regex::Regex::new(r"behind ([0-9]+)")
                .ok()
                .and_then(|re| re.captures(track))
                .and_then(|cap| cap.get(1))
                .and_then(|value| value.as_str().parse::<usize>().ok())
                .unwrap_or(0);
            GitBranch {
                name: parts.get(1).copied().unwrap_or_default().to_string(),
                sha: parts.get(2).copied().unwrap_or_default().to_string(),
                head: parts.first().copied().unwrap_or_default() == "*",
                upstream: parts
                    .get(3)
                    .copied()
                    .filter(|value| !value.is_empty())
                    .map(str::to_string),
                ahead,
                behind,
            }
        })
        .collect())
}

#[tauri::command]
fn git_branch_create(
    state: State<'_, AppState>,
    name: String,
    checkout: bool,
) -> Result<bool, String> {
    if name.trim().is_empty() {
        return Err("Branch name required".to_string());
    }
    let base = opened_folder(&state)?;
    let args = if checkout {
        vec!["switch".to_string(), "-c".to_string(), name]
    } else {
        vec!["branch".to_string(), name]
    };
    run_git_capture(&base, &args, false)?;
    Ok(true)
}

#[tauri::command]
fn git_switch_branch(
    state: State<'_, AppState>,
    name: String,
    force: bool,
) -> Result<bool, String> {
    if name.trim().is_empty() {
        return Err("Branch name required".to_string());
    }
    let base = opened_folder(&state)?;
    if !force {
        let dirty = run_git_capture(
            &base,
            &["status".to_string(), "--porcelain".to_string()],
            false,
        )?;
        if !dirty.trim().is_empty() {
            return Err("Working tree has uncommitted changes".to_string());
        }
    }
    run_git_capture(&base, &["switch".to_string(), name], false)?;
    Ok(true)
}

#[tauri::command]
fn git_copy_commit_patch_text(
    state: State<'_, AppState>,
    sha: String,
) -> Result<GitCopyTextPayload, String> {
    let base = opened_folder(&state)?;
    let text = run_git_capture(
        &base,
        &[
            "format-patch".to_string(),
            "-1".to_string(),
            "--stdout".to_string(),
            sha,
        ],
        false,
    )?;
    Ok(GitCopyTextPayload {
        length: text.len(),
        text,
    })
}

#[tauri::command]
fn git_copy_range_prompt_text(
    state: State<'_, AppState>,
    from: Option<String>,
    to: String,
    token_budget: usize,
) -> Result<GitRangePromptPayload, String> {
    if to.trim().is_empty() {
        return Err("Missing range".to_string());
    }
    let base = opened_folder(&state)?;
    let range = from
        .filter(|value| !value.is_empty())
        .map(|from| format!("{from}..{to}"))
        .unwrap_or(to);
    let list = run_git_capture(
        &base,
        &[
            "log".to_string(),
            "--reverse".to_string(),
            "--pretty=format:%H%x1f%an%x1f%ad%x1f%s".to_string(),
            "--date=iso".to_string(),
            range,
        ],
        false,
    )?;
    let mut text = String::new();
    for line in list.lines().filter(|line| !line.trim().is_empty()) {
        let sha = line.split('\x1f').next().unwrap_or_default().to_string();
        let meta = run_git_capture(
            &base,
            &[
                "show".to_string(),
                "-s".to_string(),
                "--format=%H%x1f%an%x1f%ad%x1f%s".to_string(),
                "--date=iso".to_string(),
                sha.clone(),
            ],
            false,
        )?;
        let patch = run_git_capture(
            &base,
            &[
                "format-patch".to_string(),
                "-1".to_string(),
                "--stdout".to_string(),
                sha,
            ],
            false,
        )?;
        let parts = meta.trim().split('\x1f').collect::<Vec<_>>();
        text.push_str(&format!(
            "Commit {}\nAuthor: {}\nDate: {}\nSubject: {}\n\n{}\n\n",
            parts.first().copied().unwrap_or_default(),
            parts.get(1).copied().unwrap_or_default(),
            parts.get(2).copied().unwrap_or_default(),
            parts.get(3).copied().unwrap_or_default(),
            patch
        ));
    }
    if approx_tokens(&text) > token_budget {
        let mut cut = text.len();
        while cut > 0 && approx_tokens(&text[..cut]) > token_budget {
            cut -= 1;
        }
        text = format!("{}\n\n[Truncated due to token budget]", &text[..cut]);
    }
    Ok(GitRangePromptPayload {
        tokens: approx_tokens(&text),
        text,
    })
}

#[tauri::command]
fn git_show_patch(
    state: State<'_, AppState>,
    sha: String,
    path: Option<String>,
) -> Result<String, String> {
    if sha.trim().is_empty() {
        return Err("Missing sha".to_string());
    }
    let base = opened_folder(&state)?;
    let mut args = vec![
        "show".to_string(),
        "--patch".to_string(),
        "--no-color".to_string(),
        "--pretty=format:".to_string(),
        sha,
    ];
    if let Some(path) = path.filter(|value| !value.is_empty()) {
        args.push("--".to_string());
        args.push(path);
    }
    run_git_capture(&base, &args, false)
}

#[tauri::command]
fn search_run(
    state: State<'_, AppState>,
    payload: SearchParams,
) -> Result<Vec<SearchResult>, String> {
    let base = opened_folder(&state)?;
    let query = payload.query;
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let regex = payload.regex.unwrap_or(false);
    let case_sensitive = payload.case_sensitive.unwrap_or(false);
    let word = payload.word.unwrap_or(false);
    let per_file = payload.per_file.unwrap_or(3).clamp(1, 1000);
    let max_total = payload.max_results.unwrap_or(500).clamp(1, 10000);
    let pattern = if regex {
        query
    } else if word {
        format!(r"\b{}\b", regex::escape(&query))
    } else {
        regex::escape(&query)
    };
    let regex = RegexBuilder::new(&pattern)
        .case_insensitive(!case_sensitive)
        .build()
        .map_err(|_| "Invalid regular expression".to_string())?;
    let mut results = Vec::new();
    for file in read_folder_text_files(&base)? {
        if results.len() >= max_total {
            break;
        }
        let Ok(content) = fs::read_to_string(&file) else {
            continue;
        };
        let mut added = 0usize;
        for (line_index, line) in content.lines().enumerate() {
            if results.len() >= max_total {
                break;
            }
            let ranges = regex
                .find_iter(line)
                .take(100)
                .map(|found| (found.start(), found.end()))
                .collect::<Vec<_>>();
            if ranges.is_empty() {
                continue;
            }
            let relative = file
                .strip_prefix(&base)
                .unwrap_or(&file)
                .to_string_lossy()
                .to_string();
            results.push(SearchResult {
                path: relative,
                line: line_index + 1,
                preview: line.to_string(),
                ranges,
            });
            added += 1;
            if added >= per_file {
                break;
            }
        }
    }
    Ok(results)
}

#[tauri::command]
fn apply_patch_text(state: State<'_, AppState>, patch_text: String) -> Result<bool, String> {
    let base = opened_folder(&state)?;
    patch::apply_patch(&base, &patch_text)?;
    Ok(true)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            open_folder,
            estimate_tokens,
            estimate_lines,
            copy_selected_files_text,
            git_copy_diff_text,
            git_status,
            git_diff_file,
            git_stage,
            git_unstage,
            git_discard,
            git_commit,
            git_log,
            git_commit_details,
            git_blame,
            git_branches,
            git_branch_create,
            git_switch_branch,
            git_copy_commit_patch_text,
            git_copy_range_prompt_text,
            git_show_patch,
            search_run,
            apply_patch_text
        ])
        .run(tauri::generate_context!())
        .expect("failed to run tauri application");
}
