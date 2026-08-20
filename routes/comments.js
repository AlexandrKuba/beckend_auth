import express from 'express'
import { readJSON, writeJSON } from '../utils/fileDb.js'
import { requireAuth } from '../middleware/auth.js'
import { v4 as uuid } from 'uuid'

const router = express.Router()
const file = './data/comments.json'
const fileUsers = './data/users.json'

router.get('/', async (req, res) => {
  const { postId } = req.query
  const comments = await readJSON(file)
  const users = await readJSON(fileUsers)

  function getAuthorName(authorId) {
    const user = users.find((u) => u.id == authorId)
    return user ? user.name : 'Unknown'
  }

  let filteredComments = comments
  if (postId) {
    filteredComments = comments.filter((comment) => comment.postId == postId)
  }

  // Зворотний порядок
  filteredComments = [...filteredComments].reverse()

  const enrichedComments = filteredComments.map((comment) => ({
    ...comment,
    authorName: getAuthorName(comment.authorId),
  }))

  res.json(enrichedComments)
})

router.post('/', requireAuth, async (req, res) => {
  const comments = await readJSON(file)
  const newComment = {
    id: uuid(),
    postId: req.body.postId,
    text: req.body.text,
    authorId: req.user.id,
  }
  comments.push(newComment)
  await writeJSON(file, comments)
  res.status(201).json(newComment)
})

export default router

// Видалення коментаря
router.delete('/:id', requireAuth, async (req, res) => {
  const comments = await readJSON(file)
  const commentIdx = comments.findIndex((c) => c.id == req.params.id)
  if (commentIdx == -1) return res.sendStatus(404)
  const [deleted] = comments.splice(commentIdx, 1)
  await writeJSON(file, comments)
  res.json(deleted)
})
