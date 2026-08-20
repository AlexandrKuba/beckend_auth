import express from 'express'
import { readJSON, writeJSON } from '../utils/fileDb.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = express.Router()
const file = './data/users.json'

router.get('/all', requireAuth, requireRole('admin'), async (req, res) => {
  const users = await readJSON(file)
  res.json(users)
})

router.get('/:id', requireAuth, async (req, res) => {
  const users = await readJSON(file)
  const user = users.find((u) => u.id == req.params.id)
  if (!user) return res.sendStatus(404)
  res.json(user)
})

export default router

// Пагінований роут
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const users = await readJSON(file)
  const pageNum = parseInt(req.query.page) || 1
  const limitNum = parseInt(req.query.limit) || 10
  const totalItems = users.length
  const totalPages = Math.ceil(totalItems / limitNum)
  const startIdx = (pageNum - 1) * limitNum
  const endIdx = startIdx + limitNum
  const items = users.slice(startIdx, endIdx)
  res.json({
    items,
    page: pageNum,
    limit: limitNum,
    totalItems,
    totalPages,
  })
})
