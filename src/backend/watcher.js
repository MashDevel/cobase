import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import ignore from 'ignore';
import { isBinaryFileSync, isBinaryFile } from 'isbinaryfile';

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
  }

  loadGitignore(folderPath) {
    const gitignorePath = path.join(folderPath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      this.ignorer = ignore().add(gitignoreContent);
      this.ignorer.add(to_ignore);
    }
  }

  async listFiles(folderPath) {
    this.loadGitignore(folderPath);
    const results = [];

    async function walk(dir) {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath  = path.relative(folderPath, fullPath);

        // never ignore root itself
        if (relPath && (relPath.split(path.sep)[0] === '.git' || this.ignorer.ignores(relPath))) {
          continue;
        }

        if (entry.isDirectory()) {
          await walk.call(this, fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).slice(1).toLowerCase();
          if (binaryExtensions.has(ext)) continue;
          const isBinary = await isBinaryFile(fullPath);
          if (!isBinary) results.push(fullPath);
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
          // Ignore unreadable files
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
          // Ignore unreadable files
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
