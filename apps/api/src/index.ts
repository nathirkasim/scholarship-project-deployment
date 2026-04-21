import 'dotenv/config'
import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { prisma } from './lib/prisma'
import { logger } from './lib/logger'
import { startWorkers } from './jobs'
import { authenticate, isOfficer } from './middleware/auth'

// Routes
import authRoutes         from './routes/auth'
import applicationRoutes  from './routes/applications'
import programRoutes      from './routes/programs'
import ruleRoutes         from './routes/rules'
import verificationRoutes from './routes/verification'
import officerRoutes      from './routes/officer'
import reportRoutes       from './routes/reports'
import documentRoutes     from './routes/documents'
import adminRoutes        from './routes/admin'

const app  = express()
const PORT = process.env.PORT || 4000

//  MIDDLEWARE 
app.use(helmet())
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }))

// Rate limiter  200 requests per 15 minutes per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}))

// Auth routes have tighter rate limit
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }))

//  ROUTES 
app.use('/api/auth',          authRoutes)
app.use('/api/applications',  applicationRoutes)
app.use('/api/programs',      programRoutes)
app.use('/api/rules',         ruleRoutes)
app.use('/api/verification',  verificationRoutes)
app.use('/api/officer',       officerRoutes)
app.use('/api/reports',       reportRoutes)
app.use('/api/documents',     documentRoutes)
app.use('/api/admin',         adminRoutes)

// GET /api/verifiers  list users with role=verifier (for admin assignment UI)
app.get('/api/verifiers', authenticate, isOfficer, async (_req, res) => {
  const verifiers = await prisma.user.findMany({
    where: { role: 'verifier', is_active: true },
    select: { id: true, full_name: true, email: true, phone: true },
    orderBy: { full_name: 'asc' },
  })
  res.json({ verifiers })
})

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err.message, { stack: err.stack })
  res.status(500).json({ error: 'Internal server error' })
})

//  START 
async function start() {
  try {
    await prisma.$connect()
    logger.info('Database connected')

    startWorkers()
    logger.info('BullMQ workers started')

    app.listen(PORT, () => {
      logger.info(`API server running on port ${PORT}`)
    })
  } catch (err) {
    logger.error('Failed to start server', err)
    process.exit(1)
  }
}

start()
