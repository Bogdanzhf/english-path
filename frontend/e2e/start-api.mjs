// Запуск FastAPI для e2e-тестов с временной базой данных (реальные данные не трогаются).
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const port = process.argv[2] || '8799'
const root = resolve(import.meta.dirname, '..', '..')
const venvPython = process.platform === 'win32' ? join(root, '.venv', 'Scripts', 'python.exe') : join(root, '.venv', 'bin', 'python')
const python = existsSync(venvPython) ? venvPython : 'python'
const db = join(mkdtempSync(join(tmpdir(), 'english-path-e2e-')), 'e2e.db').replaceAll('\\', '/')

const child = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--app-dir', 'backend', '--port', port, '--log-level', 'warning'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ENGLISH_PATH_DB: `sqlite:///${db}`, PYTHONIOENCODING: 'utf-8' },
})
const stop = () => child.kill()
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
process.on('exit', stop)
child.on('exit', (code) => process.exit(code ?? 0))
