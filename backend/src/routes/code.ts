import { Router } from 'express'
import { getTree, readFile, searchCode } from '../services/codeService'

const router = Router()

// GET /api/code/tree?subDir=src/components
router.get('/tree', (req, res) => {
  const subDir = typeof req.query.subDir === 'string' ? req.query.subDir : ''
  try {
    const tree = getTree(subDir)
    res.json(tree)
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// GET /api/code/file?path=src/services/foo.ts
router.get('/file', (req, res) => {
  const filePath = typeof req.query.path === 'string' ? req.query.path : ''
  if (!filePath) return res.status(400).json({ error: 'path query param required' })
  try {
    const result = readFile(filePath)
    res.json(result)
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// GET /api/code/search?q=filterCriteria&ext=.ts,.tsx
router.get('/search', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : ''
  const ext = typeof req.query.ext === 'string' ? req.query.ext : undefined
  if (!q) return res.status(400).json({ error: 'q query param required' })
  try {
    const matches = searchCode(q, ext)
    res.json(matches)
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

export default router
