import fs from 'fs'
import path from 'path'
import { configService } from './configService'

// ─── Max limits ───────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 64 * 1024        // 64 KB per file
const MAX_SEARCH_RESULTS = 30
const MAX_TREE_ENTRIES = 300

// ─── Ignore patterns (applied on top of .gitignore) ──────────────────────────

const ALWAYS_IGNORE = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  'coverage', '.cache', '__pycache__', '.mypy_cache', '.pytest_cache',
  'vendor', '.DS_Store', 'Thumbs.db', '*.min.js', '*.min.css',
])

function isIgnored(name: string): boolean {
  return ALWAYS_IGNORE.has(name) || name.startsWith('.')
}

// ─── Root validation ──────────────────────────────────────────────────────────

function getRoot(): string {
  const cfg = configService.readConfig()
  if (!cfg.sourceCodePath) {
    throw new Error('Source code path not configured. Open Settings → Code browsing to set it.')
  }
  const resolved = path.resolve(cfg.sourceCodePath)
  if (!fs.existsSync(resolved)) {
    throw new Error(`Source code path does not exist: ${resolved}`)
  }
  return resolved
}

function safePath(root: string, rel: string): string {
  const resolved = path.resolve(root, rel)
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error('Path traversal attempt blocked')
  }
  return resolved
}

// ─── Directory tree ───────────────────────────────────────────────────────────

export interface TreeEntry {
  path: string     // relative to project root
  type: 'file' | 'dir'
  size?: number
}

export function getTree(subDir = ''): TreeEntry[] {
  const root = getRoot()
  const startPath = subDir ? safePath(root, subDir) : root
  const entries: TreeEntry[] = []

  function walk(dir: string, depth: number) {
    if (depth > 6 || entries.length >= MAX_TREE_ENTRIES) return
    let items: fs.Dirent[]
    try {
      items = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const item of items) {
      if (isIgnored(item.name)) continue
      const abs = path.join(dir, item.name)
      const rel = path.relative(root, abs)
      if (item.isDirectory()) {
        entries.push({ path: rel, type: 'dir' })
        walk(abs, depth + 1)
      } else if (item.isFile()) {
        try {
          const { size } = fs.statSync(abs)
          entries.push({ path: rel, type: 'file', size })
        } catch {
          entries.push({ path: rel, type: 'file' })
        }
      }
      if (entries.length >= MAX_TREE_ENTRIES) break
    }
  }

  walk(startPath, 0)
  return entries
}

// ─── File read ────────────────────────────────────────────────────────────────

export interface FileResult {
  path: string
  content: string
  truncated: boolean
  size: number
}

export function readFile(rel: string): FileResult {
  const root = getRoot()
  const abs = safePath(root, rel)
  const { size } = fs.statSync(abs)
  const raw = fs.readFileSync(abs)

  const truncated = size > MAX_FILE_BYTES
  const content = truncated
    ? raw.slice(0, MAX_FILE_BYTES).toString('utf-8') + '\n\n[... file truncated — showing first 64 KB ...]'
    : raw.toString('utf-8')

  return { path: rel, content, truncated, size }
}

// ─── Search (grep) ────────────────────────────────────────────────────────────

export interface SearchMatch {
  file: string
  line: number
  text: string
}

export function searchCode(query: string, fileGlob?: string): SearchMatch[] {
  const root = getRoot()
  const results: SearchMatch[] = []
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(escaped, 'i')

  const extensions = fileGlob
    ? fileGlob.replace(/\*/g, '').split(',').map(e => e.trim())
    : []

  function walk(dir: string) {
    if (results.length >= MAX_SEARCH_RESULTS) return
    let items: fs.Dirent[]
    try {
      items = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const item of items) {
      if (isIgnored(item.name)) continue
      const abs = path.join(dir, item.name)
      if (item.isDirectory()) {
        walk(abs)
      } else if (item.isFile()) {
        if (extensions.length > 0 && !extensions.some(e => item.name.endsWith(e))) continue
        try {
          const { size } = fs.statSync(abs)
          if (size > MAX_FILE_BYTES * 2) continue // skip very large files
          const content = fs.readFileSync(abs, 'utf-8')
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
              results.push({
                file: path.relative(root, abs),
                line: i + 1,
                text: lines[i].trim().slice(0, 200),
              })
              if (results.length >= MAX_SEARCH_RESULTS) return
            }
          }
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  walk(root)
  return results
}
