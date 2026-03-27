mod patch;
mod prompts;

use ignore::WalkBuilder;
use notify::{recommended_watcher, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use regex::RegexBuilder;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fs;
use std::io::Read;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::thread;
use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow, WindowEvent};

const TOKEN_ESTIMATE_THRESHOLD: u64 = 64 * 1024;
const LINES_SAMPLE_THRESHOLD: u64 = 64 * 1024;
const TOGGLE_TERMINAL_MENU_ID: &str = "toggle-terminal";
const NEW_WINDOW_MENU_ID: &str = "new-window";

#[derive(Default)]
struct FolderTree {
    children: BTreeMap<String, FolderTree>,
}

struct AppState {
    windows: Mutex<HashMap<String, WindowState>>,
    focused_window: Mutex<Option<String>>,
    window_counter: Mutex<u64>,
    terminal_sessions: Mutex<HashMap<String, TerminalSession>>,
    terminal_session_counter: Mutex<u64>,
}

#[derive(Default)]
struct WindowState {
    opened_folder: Option<PathBuf>,
    watcher: Option<RecommendedWatcher>,
}

struct TerminalSession {
    writer: Mutex<Box<dyn Write + Send>>,
    master: Mutex<Box<dyn MasterPty + Send>>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            windows: Mutex::new(HashMap::new()),
            focused_window: Mutex::new(None),
            window_counter: Mutex::new(0),
            terminal_sessions: Mutex::new(HashMap::new()),
            terminal_session_counter: Mutex::new(0),
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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalDataPayload {
    session_id: String,
    data: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalExitPayload {
    session_id: String,
    code: Option<i32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TextFilePayload {
    path: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PathPayload {
    path: String,
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

fn opened_folder(state: &AppState, window_label: &str) -> Result<PathBuf, String> {
    state
        .windows
        .lock()
        .map_err(|_| "State lock failed".to_string())?
        .get(window_label)
        .and_then(|window_state| window_state.opened_folder.clone())
        .ok_or_else(|| "No folder is currently opened".to_string())
}

fn opened_text_file(state: &AppState, window_label: &str, path: &str) -> Result<PathBuf, String> {
    let canonical = opened_entry(state, window_label, path)?;
    if is_probably_binary(&canonical) {
        return Err("File is not a text file".to_string());
    }
    Ok(canonical)
}

fn opened_entry(state: &AppState, window_label: &str, path: &str) -> Result<PathBuf, String> {
    let base = opened_folder(state, window_label)?;
    let candidate = PathBuf::from(path);
    let canonical = fs::canonicalize(&candidate).map_err(|err| err.to_string())?;
    if !canonical.starts_with(&base) {
        return Err("Path is outside the opened folder".to_string());
    }
    Ok(canonical)
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

fn start_watcher(
    app: AppHandle,
    state: &AppState,
    window_label: String,
    folder: PathBuf,
) -> Result<(), String> {
    let watch_folder = folder.clone();
    let emit_target = window_label.clone();
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
            let _ = app.emit_to(
                emit_target.as_str(),
                event_name,
                path.to_string_lossy().to_string(),
            );
        }
    })
    .map_err(|err| err.to_string())?;
    watcher
        .watch(&folder, RecursiveMode::Recursive)
        .map_err(|err| err.to_string())?;
    let mut windows = state
        .windows
        .lock()
        .map_err(|_| "State lock failed".to_string())?;
    let window_state = windows.entry(window_label).or_default();
    window_state.watcher = Some(watcher);
    Ok(())
}

fn ensure_open_folder(
    window: &WebviewWindow,
    state: &AppState,
    folder: PathBuf,
) -> Result<String, String> {
    let window_label = window.label().to_string();
    let canonical = fs::canonicalize(&folder).unwrap_or(folder);
    let files = list_files(&canonical)?;
    let payload = file_payloads(&files);
    {
        let mut windows = state
            .windows
            .lock()
            .map_err(|_| "State lock failed".to_string())?;
        let window_state = windows.entry(window_label.clone()).or_default();
        window_state.opened_folder = Some(canonical.clone());
    }
    start_watcher(window.app_handle().clone(), state, window_label, canonical.clone())?;
    window
        .emit("files:initial", payload)
        .map_err(|err| err.to_string())?;
    let title = canonical
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| format!("{value} - Cobase"))
        .unwrap_or_else(|| "Cobase".to_string());
    let _ = window.set_title(&title);
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

fn terminal_working_dir(state: &AppState, window_label: &str, cwd: Option<String>) -> PathBuf {
    cwd
        .map(PathBuf::from)
        .filter(|path| path.is_dir())
        .or_else(|| opened_folder(state, window_label).ok())
        .unwrap_or_else(|| {
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .filter(|path| path.is_dir())
            .or_else(|| std::env::current_dir().ok().filter(|path| path.is_dir()))
            .unwrap_or_else(|| PathBuf::from("."))
        })
}

fn terminal_shell() -> String {
    std::env::var("SHELL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "/bin/zsh".to_string())
}

fn path_payload(path: PathBuf) -> PathPayload {
    PathPayload {
        path: path.to_string_lossy().to_string(),
    }
}

fn validate_new_name(name: &str) -> Result<&str, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Name cannot be empty".to_string());
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err("Name cannot contain path separators".to_string());
    }
    if trimmed == "." || trimmed == ".." {
        return Err("Name is not valid".to_string());
    }
    Ok(trimmed)
}

fn copy_directory_recursive(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir(target).map_err(|err| err.to_string())?;
    for entry in fs::read_dir(source).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if source_path.is_dir() {
            copy_directory_recursive(&source_path, &target_path)?;
        } else {
            fs::copy(&source_path, &target_path).map_err(|err| err.to_string())?;
        }
    }
    Ok(())
}

fn copy_entry(source: &Path, destination_dir: &Path) -> Result<PathBuf, String> {
    if !destination_dir.is_dir() {
        return Err("Destination is not a directory".to_string());
    }
    let name = source
        .file_name()
        .ok_or_else(|| "Path has no file name".to_string())?;
    let target = destination_dir.join(name);
    if target.exists() {
        return Err("A file or folder with that name already exists".to_string());
    }
    if source.is_dir() {
        copy_directory_recursive(source, &target)?;
    } else {
        fs::copy(source, &target).map_err(|err| err.to_string())?;
    }
    Ok(target)
}

fn open_in_system_impl(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let status = Command::new("open").arg(path).status();
    #[cfg(target_os = "windows")]
    let status = Command::new("explorer").arg(path).status();
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let status = Command::new("xdg-open").arg(path).status();
    let status = status.map_err(|err| err.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err("Failed to open path in system file manager".to_string())
    }
}

fn reveal_in_system_impl(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let status = Command::new("open").arg("-R").arg(path).status();
    #[cfg(target_os = "windows")]
    let status = Command::new("explorer")
        .arg(format!("/select,{}", path.to_string_lossy()))
        .status();
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let status = Command::new("xdg-open")
        .arg(path.parent().unwrap_or(path))
        .status();
    let status = status.map_err(|err| err.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err("Failed to reveal path in system file manager".to_string())
    }
}

fn next_window_label(state: &AppState) -> Result<String, String> {
    let mut counter = state
        .window_counter
        .lock()
        .map_err(|_| "State lock failed".to_string())?;
    *counter += 1;
    Ok(format!("window-{}", *counter))
}

fn clone_window_folder(state: &AppState, source_label: &str, target_label: &str) -> Result<(), String> {
    let source_folder = {
        let windows = state
            .windows
            .lock()
            .map_err(|_| "State lock failed".to_string())?;
        windows
            .get(source_label)
            .and_then(|window_state| window_state.opened_folder.clone())
    };
    let Some(source_folder) = source_folder else {
        return Ok(());
    };
    let mut windows = state
        .windows
        .lock()
        .map_err(|_| "State lock failed".to_string())?;
    let window_state = windows.entry(target_label.to_string()).or_default();
    window_state.opened_folder = Some(source_folder);
    Ok(())
}

fn create_window(app: &AppHandle, source_label: Option<&str>) -> Result<(), String> {
    let label = next_window_label(&app.state::<AppState>())?;
    let mut config = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .ok_or_else(|| "Missing window configuration".to_string())?;
    config.label = label.clone();
    tauri::WebviewWindowBuilder::from_config(app, &config)
        .map_err(|err| err.to_string())?
        .build()
        .map_err(|err| err.to_string())?;
    if let Some(source_label) = source_label {
        clone_window_folder(&app.state::<AppState>(), source_label, &label)?;
    }
    Ok(())
}

#[tauri::command]
fn get_opened_folder(window: WebviewWindow, state: State<'_, AppState>) -> Result<Option<String>, String> {
    Ok(opened_folder(&state, window.label())
        .ok()
        .map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
fn open_folder(window: WebviewWindow, state: State<'_, AppState>, path: String) -> Result<String, String> {
    ensure_open_folder(&window, &state, PathBuf::from(path))
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
fn terminal_start(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, AppState>,
    cwd: Option<String>,
) -> Result<String, String> {
    let shell = terminal_shell();
    let pty_system = native_pty_system();
    let pty_pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| err.to_string())?;
    let mut command = CommandBuilder::new(shell);
    command.arg("-i");
    command.cwd(terminal_working_dir(&state, window.label(), cwd));
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");
    let mut child = pty_pair
        .slave
        .spawn_command(command)
        .map_err(|err| err.to_string())?;
    let killer = child.clone_killer();
    let mut reader = pty_pair
        .master
        .try_clone_reader()
        .map_err(|err| err.to_string())?;
    let writer = pty_pair.master.take_writer().map_err(|err| err.to_string())?;
    let session_id = {
        let mut counter = state
            .terminal_session_counter
            .lock()
            .map_err(|_| "State lock failed".to_string())?;
        *counter += 1;
        format!("terminal-{}", *counter)
    };
    let data_session = session_id.clone();
    let data_app = app.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            let Ok(size) = reader.read(&mut buf) else {
                break;
            };
            if size == 0 {
                break;
            }
            let _ = data_app.emit(
                "terminal:data",
                TerminalDataPayload {
                    session_id: data_session.clone(),
                    data: String::from_utf8_lossy(&buf[..size]).to_string(),
                },
            );
        }
    });
    let exit_session = session_id.clone();
    let exit_app = app.clone();
    thread::spawn(move || {
        let code = child
            .wait()
            .ok()
            .and_then(|status| i32::try_from(status.exit_code()).ok());
        if let Ok(mut sessions) = exit_app.state::<AppState>().terminal_sessions.lock() {
            sessions.remove(&exit_session);
        }
        let _ = exit_app.emit(
            "terminal:exit",
            TerminalExitPayload {
                session_id: exit_session.clone(),
                code,
            },
        );
    });
    let mut sessions = state
        .terminal_sessions
        .lock()
        .map_err(|_| "State lock failed".to_string())?;
    sessions.insert(session_id.clone(), TerminalSession {
        writer: Mutex::new(writer),
        master: Mutex::new(pty_pair.master),
        killer: Mutex::new(killer),
    });
    Ok(session_id)
}

#[tauri::command]
fn terminal_write(state: State<'_, AppState>, session_id: String, data: String) -> Result<bool, String> {
    let sessions = state
        .terminal_sessions
        .lock()
        .map_err(|_| "State lock failed".to_string())?;
    let session = sessions.get(&session_id).ok_or_else(|| "Unknown terminal session".to_string())?;
    let mut writer = session
        .writer
        .lock()
        .map_err(|_| "Terminal lock failed".to_string())?;
    writer.write_all(data.as_bytes()).map_err(|err| err.to_string())?;
    Ok(true)
}

#[tauri::command]
fn terminal_resize(
    state: State<'_, AppState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<bool, String> {
    let sessions = state
        .terminal_sessions
        .lock()
        .map_err(|_| "State lock failed".to_string())?;
    let session = sessions.get(&session_id).ok_or_else(|| "Unknown terminal session".to_string())?;
    let master = session
        .master
        .lock()
        .map_err(|_| "Terminal lock failed".to_string())?;
    master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| err.to_string())?;
    Ok(true)
}

#[tauri::command]
fn terminal_close(state: State<'_, AppState>, session_id: String) -> Result<bool, String> {
    let session = {
        let mut sessions = state
            .terminal_sessions
            .lock()
            .map_err(|_| "State lock failed".to_string())?;
        sessions.remove(&session_id)
    };
    let Some(session) = session else {
        return Ok(true);
    };
    let mut killer = session
        .killer
        .lock()
        .map_err(|_| "Terminal lock failed".to_string())?;
    killer.kill().map_err(|err| err.to_string())?;
    Ok(true)
}

#[tauri::command]
fn read_text_file(window: WebviewWindow, state: State<'_, AppState>, path: String) -> Result<TextFilePayload, String> {
    let file = opened_text_file(&state, window.label(), &path)?;
    let content = fs::read_to_string(&file).map_err(|err| err.to_string())?;
    Ok(TextFilePayload {
        path: file.to_string_lossy().to_string(),
        content,
    })
}

#[tauri::command]
fn write_text_file(
    window: WebviewWindow,
    state: State<'_, AppState>,
    path: String,
    content: String,
) -> Result<TextFilePayload, String> {
    let file = opened_text_file(&state, window.label(), &path)?;
    fs::write(&file, content.as_bytes()).map_err(|err| err.to_string())?;
    let content = fs::read_to_string(&file).map_err(|err| err.to_string())?;
    Ok(TextFilePayload {
        path: file.to_string_lossy().to_string(),
        content,
    })
}

#[tauri::command]
fn reveal_path_in_system(window: WebviewWindow, state: State<'_, AppState>, path: String) -> Result<bool, String> {
    let entry = opened_entry(&state, window.label(), &path)?;
    reveal_in_system_impl(&entry)?;
    Ok(true)
}

#[tauri::command]
fn open_path_in_system(window: WebviewWindow, state: State<'_, AppState>, path: String) -> Result<bool, String> {
    let entry = opened_entry(&state, window.label(), &path)?;
    open_in_system_impl(&entry)?;
    Ok(true)
}

#[tauri::command]
fn rename_path(
    window: WebviewWindow,
    state: State<'_, AppState>,
    path: String,
    new_name: String,
) -> Result<PathPayload, String> {
    let entry = opened_entry(&state, window.label(), &path)?;
    let parent = entry
        .parent()
        .ok_or_else(|| "Path has no parent directory".to_string())?;
    let next_name = validate_new_name(&new_name)?;
    let target = parent.join(next_name);
    if target.exists() {
        return Err("A file or folder with that name already exists".to_string());
    }
    fs::rename(&entry, &target).map_err(|err| err.to_string())?;
    Ok(path_payload(target))
}

#[tauri::command]
fn delete_path(window: WebviewWindow, state: State<'_, AppState>, path: String) -> Result<bool, String> {
    let entry = opened_entry(&state, window.label(), &path)?;
    if entry.is_dir() {
        fs::remove_dir_all(&entry).map_err(|err| err.to_string())?;
    } else {
        fs::remove_file(&entry).map_err(|err| err.to_string())?;
    }
    Ok(true)
}

#[tauri::command]
fn copy_path_to(
    window: WebviewWindow,
    state: State<'_, AppState>,
    path: String,
    destination_dir: String,
) -> Result<PathPayload, String> {
    let entry = opened_entry(&state, window.label(), &path)?;
    let destination = opened_entry(&state, window.label(), &destination_dir)?;
    let target = copy_entry(&entry, &destination)?;
    Ok(path_payload(target))
}

#[tauri::command]
fn move_path_to(
    window: WebviewWindow,
    state: State<'_, AppState>,
    path: String,
    destination_dir: String,
) -> Result<PathPayload, String> {
    let entry = opened_entry(&state, window.label(), &path)?;
    let destination = opened_entry(&state, window.label(), &destination_dir)?;
    if !destination.is_dir() {
        return Err("Destination is not a directory".to_string());
    }
    let name = entry
        .file_name()
        .ok_or_else(|| "Path has no file name".to_string())?;
    let target = destination.join(name);
    if target.exists() {
        return Err("A file or folder with that name already exists".to_string());
    }
    fs::rename(&entry, &target).map_err(|err| err.to_string())?;
    Ok(path_payload(target))
}

#[tauri::command]
fn copy_selected_files_text(
    window: WebviewWindow,
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
    let base = opened_folder(&state, window.label())?;
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
fn git_copy_diff_text(window: WebviewWindow, state: State<'_, AppState>) -> Result<GitDiffCopyPayload, String> {
    let base = opened_folder(&state, window.label())?;
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
fn git_status(window: WebviewWindow, state: State<'_, AppState>) -> Result<GitStatusPayload, String> {
    let base = opened_folder(&state, window.label())?;
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
fn git_diff_file(window: WebviewWindow, state: State<'_, AppState>, path: String, staged: bool) -> Result<String, String> {
    let base = opened_folder(&state, window.label())?;
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
fn git_stage(window: WebviewWindow, state: State<'_, AppState>, paths: Vec<String>) -> Result<bool, String> {
    if paths.is_empty() {
        return Err("No paths".to_string());
    }
    let base = opened_folder(&state, window.label())?;
    let mut args = vec!["add".to_string(), "-A".to_string(), "--".to_string()];
    args.extend(paths);
    run_git_capture(&base, &args, false)?;
    Ok(true)
}

#[tauri::command]
fn git_unstage(window: WebviewWindow, state: State<'_, AppState>, paths: Vec<String>) -> Result<bool, String> {
    if paths.is_empty() {
        return Err("No paths".to_string());
    }
    let base = opened_folder(&state, window.label())?;
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
fn git_discard(window: WebviewWindow, state: State<'_, AppState>, paths: Vec<String>) -> Result<bool, String> {
    if paths.is_empty() {
        return Err("No paths".to_string());
    }
    let base = opened_folder(&state, window.label())?;
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
fn git_commit(window: WebviewWindow, state: State<'_, AppState>, message: String) -> Result<GitCommitPayload, String> {
    if message.trim().is_empty() {
        return Err("Commit message required".to_string());
    }
    let base = opened_folder(&state, window.label())?;
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
fn git_log(window: WebviewWindow, state: State<'_, AppState>, payload: GitLogParams) -> Result<Vec<GitLogEntry>, String> {
    let base = opened_folder(&state, window.label())?;
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
fn git_commit_details(window: WebviewWindow, state: State<'_, AppState>, sha: String) -> Result<GitCommitDetails, String> {
    let base = opened_folder(&state, window.label())?;
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
    window: WebviewWindow,
    state: State<'_, AppState>,
    path: String,
    rev: Option<String>,
) -> Result<Vec<GitBlameLine>, String> {
    let base = opened_folder(&state, window.label())?;
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
fn git_branches(window: WebviewWindow, state: State<'_, AppState>) -> Result<Vec<GitBranch>, String> {
    let base = opened_folder(&state, window.label())?;
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
    window: WebviewWindow,
    state: State<'_, AppState>,
    name: String,
    checkout: bool,
) -> Result<bool, String> {
    if name.trim().is_empty() {
        return Err("Branch name required".to_string());
    }
    let base = opened_folder(&state, window.label())?;
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
    window: WebviewWindow,
    state: State<'_, AppState>,
    name: String,
    force: bool,
) -> Result<bool, String> {
    if name.trim().is_empty() {
        return Err("Branch name required".to_string());
    }
    let base = opened_folder(&state, window.label())?;
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
    window: WebviewWindow,
    state: State<'_, AppState>,
    sha: String,
) -> Result<GitCopyTextPayload, String> {
    let base = opened_folder(&state, window.label())?;
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
    window: WebviewWindow,
    state: State<'_, AppState>,
    from: Option<String>,
    to: String,
    token_budget: usize,
) -> Result<GitRangePromptPayload, String> {
    if to.trim().is_empty() {
        return Err("Missing range".to_string());
    }
    let base = opened_folder(&state, window.label())?;
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
    window: WebviewWindow,
    state: State<'_, AppState>,
    sha: String,
    path: Option<String>,
) -> Result<String, String> {
    if sha.trim().is_empty() {
        return Err("Missing sha".to_string());
    }
    let base = opened_folder(&state, window.label())?;
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
    window: WebviewWindow,
    state: State<'_, AppState>,
    payload: SearchParams,
) -> Result<Vec<SearchResult>, String> {
    let base = opened_folder(&state, window.label())?;
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
fn apply_patch_text(window: WebviewWindow, state: State<'_, AppState>, patch_text: String) -> Result<bool, String> {
    let base = opened_folder(&state, window.label())?;
    patch::apply_patch(&base, &patch_text)?;
    Ok(true)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .on_window_event(|window, event| match event {
            WindowEvent::Focused(true) => {
                if let Ok(mut focused_window) = window.app_handle().state::<AppState>().focused_window.lock() {
                    *focused_window = Some(window.label().to_string());
                }
            }
            WindowEvent::Destroyed => {
                if let Ok(mut windows) = window.app_handle().state::<AppState>().windows.lock() {
                    windows.remove(window.label());
                }
                if let Ok(mut focused_window) = window.app_handle().state::<AppState>().focused_window.lock() {
                    if focused_window.as_deref() == Some(window.label()) {
                        *focused_window = None;
                    }
                }
            }
            _ => {}
        })
        .setup(|app| {
            let app_menu = SubmenuBuilder::new(app, "Cobase")
                .about(None)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;
            let file_menu = SubmenuBuilder::new(app, "File")
                .text(NEW_WINDOW_MENU_ID, "New Window")
                .separator()
                .close_window()
                .build()?;
            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;
            let view_menu = SubmenuBuilder::new(app, "View")
                .text(TOGGLE_TERMINAL_MENU_ID, "Show or Hide Terminal")
                .build()?;
            let window_menu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .build()?;
            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&window_menu)
                .build()?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id() == TOGGLE_TERMINAL_MENU_ID {
                let target = app
                    .state::<AppState>()
                    .focused_window
                    .lock()
                    .ok()
                    .and_then(|focused_window| focused_window.clone());
                if let Some(target) = target {
                    let _ = app.emit_to(target, "menu:toggle-terminal", ());
                }
            } else if event.id() == NEW_WINDOW_MENU_ID {
                let source_label = app
                    .state::<AppState>()
                    .focused_window
                    .lock()
                    .ok()
                    .and_then(|focused_window| focused_window.clone());
                let _ = create_window(app, source_label.as_deref());
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_opened_folder,
            open_folder,
            estimate_tokens,
            estimate_lines,
            terminal_start,
            terminal_write,
            terminal_resize,
            terminal_close,
            read_text_file,
            write_text_file,
            reveal_path_in_system,
            open_path_in_system,
            rename_path,
            delete_path,
            copy_path_to,
            move_path_to,
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
