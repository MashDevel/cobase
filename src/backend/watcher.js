import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import ignore from 'ignore';
import { isBinaryFileSync, isBinaryFile } from './binary-check.js';

const to_ignore = ['package-lock.json', '.env', 'node_modules', '.git', 'poetry.lock'];
const binaryExtensions = new Set([
  'png','jpg','jpeg','gif','bmp','webp','ico','icns','pdf','zip','gz','tgz','bz2','xz','7z','rar',
  'mp3','mp4','m4a','m4v','mov','avi','mkv','wav','flac','ogg','webm',
  'ttf','otf','woff','woff2','eot',
  'jar','class','o','so','dll','dylib','exe','bin','dmg','iso','img',
]);

export class FolderWatcher {
  constructor() {
    this.watcher = null;
    this.ignorer = ignore();
    this.folderPath = '';
  }

  loadGitignore(folderPath) {
    this.folderPath = folderPath;
    this.ignorer = ignore();
    this.ignorer.add(to_ignore);
    const gitignorePath = path.join(folderPath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      this.ignorer.add(gitignoreContent);
    }
    const nestedPatterns = this.collectNestedGitignorePatterns(folderPath);
    if (nestedPatterns.length) {
      this.ignorer.add(nestedPatterns);
    }
  }

  collectNestedGitignorePatterns(folderPath) {
    const patterns = [];
    const stack = [folderPath];
    while (stack.length) {
      const dir = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '.git' || entry.name === 'node_modules') {
            continue;
          }
          stack.push(fullPath);
        } else if (entry.isFile() && entry.name === '.gitignore' && dir !== folderPath) {
          const relativeDir = path.relative(folderPath, dir);
          if (!relativeDir) {
            continue;
          }
          let scoped;
          try {
            scoped = this.scopeGitignore(fs.readFileSync(fullPath, 'utf8'), relativeDir);
          } catch {
            scoped = [];
          }
          if (scoped.length) {
            patterns.push(...scoped);
          }
        }
      }
    }
    return patterns;
  }

  scopeGitignore(content, relativeDir) {
    const prefix = relativeDir.split(path.sep).join('/');
    const lines = content.split(/\r?\n/);
    const scoped = [];
    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const negated = trimmed.startsWith('!');
      const body = negated ? trimmed.slice(1) : trimmed;
      const normalized = body.replace(/\\/g, '/');
      if (!normalized) {
        continue;
      }
      let pattern;
      if (normalized.startsWith('/')) {
        const target = normalized.slice(1);
        pattern = target ? `${prefix}/${target}` : prefix;
      } else if (normalized.includes('/')) {
        pattern = `${prefix}/${normalized}`;
      } else {
        pattern = `${prefix}/**/${normalized}`;
      }
      scoped.push(negated ? `!${pattern}` : pattern);
    }
    return scoped;
  }

  async listFiles(folderPath) {
    this.loadGitignore(folderPath);
    const results = [];

    async function walk(dir) {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath  = path.relative(folderPath, fullPath);

        if (relPath && (relPath.split(path.sep)[0] === '.git' || this.ignorer.ignores(relPath))) {
          continue;
        }

        if (entry.isDirectory()) {
          await walk.call(this, fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).slice(1).toLowerCase();
          if (binaryExtensions.has(ext)) continue;
          let binary = true;
          try {
            binary = await isBinaryFile(fullPath);
          } catch {}
          if (!binary) results.push(fullPath);
        }
      }
    }

    await walk.call(this, folderPath);
    return results;
  }

  start(folderPath, { onAdd, onChange, onUnlink } = {}) {
    this.stop();
    this.loadGitignore(folderPath);
    
    this.watcher = chokidar.watch(folderPath, {
      ignored: (filePath) => {
        const relativePath = path.relative(folderPath, filePath);
        if (!relativePath) return false;
        if (relativePath.split(path.sep)[0] === '.git') return true;
        if (this.ignorer.ignores(relativePath)) return true;
        const ext = path.extname(filePath).slice(1).toLowerCase();
        if (binaryExtensions.has(ext)) return true;
        try {
          const stat = fs.statSync(filePath);
          if (!stat.isFile()) return false;
          return isBinaryFileSync(filePath);
        } catch {
          return false;
        }
      },
      persistent: true,
      ignoreInitial: true,
    });
  
    if (onAdd) {
      this.watcher.on('add', (filePath) => {
        try {
          if (!isBinaryFileSync(filePath)) {
            onAdd(filePath);
          }
        } catch {
        }
      });
    }
  
    if (onChange) {
      this.watcher.on('change', (filePath) => {
        try {
          if (!isBinaryFileSync(filePath)) {
            onChange(filePath);
          }
        } catch {
        }
      });
    }
  
    if (onUnlink) {
      this.watcher.on('unlink', onUnlink);
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
