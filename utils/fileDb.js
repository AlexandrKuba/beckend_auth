import fs from 'fs/promises'

export async function readJSON(file) {
  const data = await fs.readFile(file, 'utf-8')
  return JSON.parse(data)
}

export async function writeJSON(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2))
}
