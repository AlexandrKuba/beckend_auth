import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
dotenv.config()

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.split(' ')[1]
  if (!token) return res.sendStatus(401)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload
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
