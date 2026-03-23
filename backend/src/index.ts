import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Routes
import configRouter from './routes/config'
import chatRouter from './routes/chat'
import jiraRouter from './routes/jira'
import codeRouter from './routes/code'

app.use('/api/config', configRouter)
app.use('/api/chat', chatRouter)
app.use('/api/jira', jiraRouter)
app.use('/api/code', codeRouter)

app.listen(PORT, () => {
  console.log(`Sprint Genie backend running on http://localhost:${PORT}`)
})

export default app
