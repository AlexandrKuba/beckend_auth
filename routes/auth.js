import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { readJSON } from '../utils/fileDb.js'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

const usersFile = './data/users.json'

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ACCESS_EXPIRES }
  )
}

function generateRefreshToken(user) {
  return jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_EXPIRES,
  })
}

// Логін користувача

router.post('/login', async (req, res) => {
  // 1. Отримуємо email і password з тіла запиту
  const { email, password } = req.body
  // 2. Зчитуємо всіх користувачів з файлу
  const users = await readJSON(usersFile)
  // 3. Шукаємо користувача з таким email
  const user = users.find((u) => u.email == email)

  // 4. Якщо користувача не знайдено або пароль не співпадає — помилка
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  // 5. Генеруємо accessToken і refreshToken
  const accessToken = generateAccessToken(user)
  const refreshToken = generateRefreshToken(user)

  // 6. Відправляємо refreshToken у httpOnly cookie, а accessToken і дані користувача — у відповідь
  res
    .cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false, // у проді — true
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json({
      user: { id: user.id, email: user.email, role: user.role },
      accessToken,
    })
})

// Оновлення accessToken за допомогою refreshToken

router.post('/refresh', async (req, res) => {
  // 1. Отримуємо refreshToken з cookie
  const token = req.cookies.refreshToken
  if (!token) return res.sendStatus(401)
  try {
    // 2. Перевіряємо refreshToken
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET)
    // 3. Зчитуємо всіх користувачів з файлу
    const users = await readJSON(usersFile)
    // 4. Шукаємо користувача за id з токена
    const user = users.find((u) => u.id == payload.id)
    if (!user) return res.sendStatus(401)
    // 5. Генеруємо новий accessToken
    const accessToken = generateAccessToken(user)
    // 6. Відправляємо новий accessToken і дані користувача у відповідь
    res.json({
      user: { id: user.id, email: user.email, role: user.role },
      accessToken,
    })
  } catch {
    // Якщо refreshToken невалідний або прострочений
    return res.sendStatus(403)
  }
})

router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken')
  res.sendStatus(204)
})

export default router
