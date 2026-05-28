import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { title, start_time, end_time, caldav_username, caldav_password } = req.body

  try {
    // TODO: Implement CalDAV sync with proper tsdav usage
    // For now, return success (frontend stores in localStorage)
    
    res.status(200).json({
      synced: true,
      message: 'Task saved. Manual sync to Apple Calendar coming soon.'
    })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
}