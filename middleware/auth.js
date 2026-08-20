import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { readJSON } from '../utils/fileDb.js' // Імпортуємо утиліту для читання файлу

dotenv.config()

// Робимо функцію асинхронною (async), щоб читати файл БД
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.split(' ')[1]
  if (!token) return res.sendStatus(401)
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    
    // Перевіряємо актуальний статус користувача у базі даних
    const users = await readJSON('./data/users.json')
    const currentUser = users.find((u) => u.id == payload.id)

    // Якщо користувача взагалі видалили з файлу або він увільнений
    if (!currentUser || currentUser.isFired) {
      return res.status(403).json({ message: 'Доступ заборонено. Акаунт деактивовано.' })
    }

    // Записуємо актуальні дані користувача з бази (включаючи роль та статус)
    req.user = currentUser
    next()
  } catch {
    return res.sendStatus(401)
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role == role || req.user?.role == 'admin') {
      return next()
    }
    return res.sendStatus(403)
  }
}
