const redis = require('./redis');

const invalidateRestaurantCache = async (city) => {
    try {
        const keys = await redis.keys(`restaurants:city=${city}:*`);

        if (keys.length > 0) {
            await redis.del(...keys);
            console.log(`[Cache] Invalidated ${keys.length} keys for city=${city}`);
        }

        const allKeys = await redis.keys('restaurants:city=all:*');
        if (allKeys.length > 0) {
            await redis.del(...allKeys);
            console.log(`[Cache] Invalidated ${allKeys.length} keys for all cities`);
        }
    } catch (err) {
        console.error('[Cache] Invalidation error (non-fatal):', err.message);
    }
};

module.exports = {
    invalidateRestaurantCache
};