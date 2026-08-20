import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import { delay } from './middleware/delay.js'

import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import postRoutes from './routes/posts.js'
import commentRoutes from './routes/comments.js'

dotenv.config()

const app = express()

// app.use(cors({ origin: 'http://localhost:5173/', credentials: true }))
app.use(cors({
  origin: function (origin, callback) {
    // Автоматично дозволяємо домен, з якого прийшов запит (як локальний, так і на Render)
    callback(null, true);
  },
  credentials: true, // Дозволяє куки та сесії
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200 // Важливо для застарілих браузерів та деяких preflight-запитів
}));

app.use(express.json())
app.use(cookieParser())
app.use(delay)

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/comments', commentRoutes)

app.listen(4000, () => console.log('API on http://localhost:4000'))
