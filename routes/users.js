import express from 'express'
import { readJSON, writeJSON } from '../utils/fileDb.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import bcrypt from 'bcrypt'

const router = express.Router()
const file = './data/users.json'

const SALT_ROUNDS = 12

// 1. Отримання ВСІХ користувачів (Тільки для admin)
router.get('/all', requireAuth, requireRole('admin'), async (req, res) => {
  const users = await readJSON(file)
  
  // Повертаємо масив, вирізаючи паролі, але залишаючи всі інші поля, включаючи isFired
  const usersResponse = users.map(({ password, ...userFields }) => ({
    ...userFields,
    isFired: !!userFields.isFired // гарантуємо true/false, навіть якщо у старих записах поля не було
  }))

  res.json(usersResponse)
})

// 2. Пагінований список усіх користувачів із міткою увільнення (Тільки для admin)
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const users = await readJSON(file)

  // Сортуємо: спочатку активні, звільнені — внизу списку
  const sortedUsers = [...users].sort((a, b) => Number(a.isFired || 0) - Number(b.isFired || 0))

  const pageNum = parseInt(req.query.page) || 1
  const limitNum = parseInt(req.query.limit) || 10
  const totalItems = sortedUsers.length
  const totalPages = Math.ceil(totalItems / limitNum)
  const startIdx = (pageNum - 1) * limitNum
  const endIdx = startIdx + limitNum
  
  // Робимо зріз для поточної сторінки
  const items = sortedUsers.slice(startIdx, endIdx).map(({ password, ...userFields }) => ({
    ...userFields,
    isFired: !!userFields.isFired
  }))
  
  res.json({
    items,
    page: pageNum,
    limit: limitNum,
    totalItems,
    totalPages,
  })
})

// 3. Отримання одного користувача за ID (Доступно всім авторизованим)
router.get('/:id', requireAuth, async (req, res) => {
  const users = await readJSON(file)
  const user = users.find((u) => u.id == req.params.id)
  if (!user) return res.sendStatus(404)

  // Повертаємо картку користувача без пароля, але з ознакою isFired
  const { password, ...userResponse } = user
  res.json({
    ...userResponse,
    isFired: !!userResponse.isFired
  })
})

// 4. ДОДАВАННЯ нового користувача (Тільки для admin)
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Ім’я, email та пароль є обов’язковими' })
    }

    const users = await readJSON(file)

    const emailExists = users.some((u) => u.email === email)
    if (emailExists) {
      return res.status(400).json({ message: 'Користувач з таким email вже існує' })
    }

    const maxId = users.reduce((max, u) => (Number(u.id) > max ? Number(u.id) : max), 0)
    const newId = maxId + 1

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

    const newUser = {
      id: newId,
      name,
      email,
      password: hashedPassword,
      role: role || 'user',
      isFired: false 
    }

    users.push(newUser)
    await writeJSON(file, users)

    const { password: _, ...userResponse } = newUser
    res.status(201).json({ ...userResponse, isFired: false })
  } catch (error) {
    res.status(500).json({ message: 'Помилка сервера', error: error.message })
  }
})

// 5. РЕДАГУВАННЯ користувача за ID (Тільки для admin)
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const userIdToUpdate = req.params.id
    const { name, email, password, role, isFired } = req.body 

    const users = await readJSON(file)
    const userIdx = users.findIndex((u) => u.id == userIdToUpdate)

    if (userIdx === -1) {
      return res.status(404).json({ message: 'Користувача не знайдено' })
    }

    if (email && email !== users[userIdx].email) {
      const emailExists = users.some((u) => u.email === email && u.id != userIdToUpdate)
      if (emailExists) {
        return res.status(400).json({ message: 'Цей email вже використовується іншим користувачем' })
      }
    }

    // Оновлюємо поля
    users[userIdx].name = name !== undefined ? name : users[userIdx].name
    users[userIdx].email = email !== undefined ? email : users[userIdx].email
    users[userIdx].role = role !== undefined ? role : users[userIdx].role
    
    // Дозволяємо адміну змінювати статус вручную (активувати або звільняти) через PUT запит
    users[userIdx].isFired = isFired !== undefined ? Boolean(isFired) : !!users[userIdx].isFired

    if (password !== undefined && password !== '') {
      users[userIdx].password = await bcrypt.hash(password, SALT_ROUNDS)
    }

    await writeJSON(file, users)

    const { password: _, ...userResponse } = users[userIdx]
    res.json({
      ...userResponse,
      isFired: !!userResponse.isFired
    })
  } catch (error) {
    res.status(500).json({ message: 'Помилка сервера', error: error.message })
  }
})

// 6. "М'ЯКЕ ВИДАЛЕННЯ" (Переведення в статус звільненого через DELETE)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const userIdToDelete = req.params.id
    const currentUser = req.user

    if (userIdToDelete == currentUser.id) {
      return res.status(400).json({ message: 'Ви не можете звільнити власний акаунт' })
    }

    const users = await readJSON(file)
    const userIdx = users.findIndex((u) => u.id == userIdToDelete)

    if (userIdx === -1) {
      return res.status(404).json({ message: 'Користувача не знайдено' })
    }

    if (users[userIdx].isFired) {
      return res.status(400).json({ message: 'Цей користувач уже має статус звільненого' })
    }

    users[userIdx].isFired = true
    await writeJSON(file, users)

    res.json({ message: 'Користувача успішно переведено в статус звільненого', id: users[userIdx].id, isFired: true })
  } catch (error) {
    res.status(500).json({ message: 'Помилка сервера', error: error.message })
  }
})

export default router
