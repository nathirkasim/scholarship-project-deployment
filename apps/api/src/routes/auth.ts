import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { signToken } from '../lib/jwt'
import { authenticate } from '../middleware/auth'

const router = Router()

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
  phone: z.string().optional(),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const body = RegisterSchema.safeParse(req.body)
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() })
    return
  }
  const { email, password, full_name, phone } = body.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ error: 'Email already registered' })
    return
  }

  const password_hash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { email, password_hash, full_name, phone, role: 'student' },
  })

  const token = signToken({ userId: user.id, email: user.email, role: user.role })
  res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 })
  res.status(201).json({ user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } })
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const body = LoginSchema.safeParse(req.body)
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() })
    return
  }
  const { email, password } = body.data

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !await bcrypt.compare(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }
  if (!user.is_active) {
    res.status(403).json({ error: 'Account deactivated' })
    return
  }

  await prisma.user.update({ where: { id: user.id }, data: { last_login: new Date() } })
  const token = signToken({ userId: user.id, email: user.email, role: user.role })
  res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 })
  res.json({ user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } })
})

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('token')
  res.json({ message: 'Logged out' })
})

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.userId },
    select: { id: true, email: true, full_name: true, role: true, phone: true, last_login: true },
  })
  res.json({ user })
})

export default router
