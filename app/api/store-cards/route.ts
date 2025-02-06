import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '10 s')
})

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'
  const { success } = await ratelimit.limit(ip)
  
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const authToken = request.headers.get('Authorization')
  const data = await request.json()

  // Basic validation
  if (!authToken || authToken !== process.env.API_SECRET_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!data.username || !data.selectedCards?.length) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }

  try {
    const client = await MongoClient.connect(process.env.MONGODB_URI!)
    const db = client.db()
    
    const result = await db.collection('cards').insertOne({
      ...data,
      createdAt: new Date(),
      ip: ip
    })

    await client.close()
    
    return NextResponse.json({
      success: true,
      id: result.insertedId
    })
    
  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      { error: 'Database operation failed' },
      { status: 500 }
    )
  }
}