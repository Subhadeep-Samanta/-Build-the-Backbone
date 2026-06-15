const Redis = require('ioredis')

const redisOptions = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy(times) {
        return Math.min(times * 50, 2000)
      }
    }

const redis = new Redis(redisOptions)

redis.on('connect', () => console.log('[Redis] Connected'))
redis.on('error', (err) => console.error('[Redis] Error:', err.message))

module.exports = redis