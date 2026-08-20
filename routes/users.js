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
  const usersResponse = users.map(({ password, ...userFields }) => ({
    ...userFields,
    isFired: !!userFields.isFired
  }))
  res.json(usersResponse)
})

// 2. Пагінований список усіх користувачів (Тільки для admin)
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const users = await readJSON(file)
  const sortedUsers = [...users].sort((a, b) => Number(a.isFired || 0) - Number(b.isFired || 0))

  const pageNum = parseInt(req.query.page) || 1
  const limitNum = parseInt(req.query.limit) || 10
  const totalItems = sortedUsers.length
  const totalPages = Math.ceil(totalItems / limitNum)
  const startIdx = (pageNum - 1) * limitNum
  const endIdx = startIdx + limitNum
  
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

  const { password, ...userResponse } = user
  res.json({
    ...userResponse,
    isFired: !!userResponse.isFired
  })
})

// 4. ДОДАВАННЯ нового користувача (Всього 2 обов'язкових поля: name та password)
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { name, password, role } = req.body

    // Валідація: лише ім'я та пароль
    if (!name || !password) {
      return res.status(400).json({ message: 'Ім’я та пароль є обов’язковими' })
    }

    const users = await readJSON(file)

    // Перевірка унікальності за ІМЕНЕМ (оскільки ім'я тепер замість пошти)
    const nameExists = users.some((u) => u.name.toLowerCase() === name.toLowerCase())
    if (nameExists) {
      return res.status(400).json({ message: 'Користувач з таким іменем вже існує' })
    }

    const maxId = users.reduce((max, u) => (Number(u.id) > max ? Number(u.id) : max), 0)
    const newId = maxId + 1

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

    const newUser = {
      id: newId,
      name,
      email: name, // Дублюємо ім'я в email, щоб старі роути постів (авторство) або входу не зламалися
      password: hashedPassword,
      role: role || 'user',
      isFired: false 
    }

    users.push(newUser)
    await writeJSON(file, users)

    const { password: _, ...userResponse } = newUser
    res.status(201).json(userResponse)
  } catch (error) {
    res.status(500).json({ message: 'Помилка сервера', error: error.message })
  }
})

// 5. РЕДАГУВАННЯ користувача за ID (Тільки 2 поля для вводу: name та password)
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const userIdToUpdate = req.params.id
    const { name, password, role, isFired } = req.body 

    const users = await readJSON(file)
    const userIdx = users.findIndex((u) => u.id == userIdToUpdate)

    if (userIdx === -1) {
      return res.status(404).json({ message: 'Користувача не знайдено' })
    }

    // Якщо змінюється ім'я, перевіряємо його унікальність серед інших
    if (name && name !== users[userIdx].name) {
      const nameExists = users.some((u) => u.name.toLowerCase() === name.toLowerCase() && u.id != userIdToUpdate)
      if (nameExists) {
        return res.status(400).json({ message: 'Це ім’я вже використовується іншим користувачем' })
      }
    }

    // Оновлюємо поля
    if (name !== undefined) {
      users[userIdx].name = name
      users[userIdx].email = name // також оновлюємо за кулісами
    }
    
    users[userIdx].role = role !== undefined ? role : users[userIdx].role
    users[userIdx].isFired = isFired !== undefined ? Boolean(isFired) : !!users[userIdx].isFired

    // Хешуємо новий пароль, якщо його передали
    if (password !== undefined && password !== '') {
      users[userIdx].password = await bcrypt.hash(password, SALT_ROUNDS)
    }

    await writeJSON(file, users)

    const { password: _, ...userResponse } = users[userIdx]
    res.json(userResponse)
  } catch (error) {
    res.status(500).json({ message: 'Помилка сервера', error: error.message })
  }
})

// 6. "М'ЯКЕ ВИДАЛЕННЯ" (Увільнення)
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
      return res.status(400).json({ message: 'Цей користувач уже уволений' })
    }

    users[userIdx].isFired = true
    await writeJSON(file, users)

    res.json({ message: 'Користувача успішно уволено', id: users[userIdx].id, isFired: true })
  } catch (error) {
    res.status(500).json({ message: 'Помилка сервера', error: error.message })
  }
})

export default router
