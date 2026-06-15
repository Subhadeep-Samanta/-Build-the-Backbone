const db = require('../db');
const redis = require('../lib/redis');
const { invalidateRestaurantCache } = require('../lib/cacheInvalidation');

const CACHE_TTL = 300; // 5 minutes

const buildCacheKey = (query) => {
    const city = query.city || 'all';
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 20;
    const sort = query.sort || 'rating';
    const offset = query.offset !== undefined ? parseInt(query.offset, 10) : (page - 1) * limit;

    return `restaurants:city=${city}:page=${page}:limit=${limit}:offset=${offset}:sort=${sort}`;
};

const getRestaurants = async (req, res) => {
    const city = req.query.city || null;
    const limit = parseInt(req.query.limit, 10) || 20;
    const page = req.query.page !== undefined ? parseInt(req.query.page, 10) || 1 : 1;
    const offset = req.query.offset !== undefined
        ? parseInt(req.query.offset, 10)
        : (page - 1) * limit;
    const sort = req.query.sort || 'rating';
    const cacheKey = buildCacheKey({ ...req.query, page, limit, sort });

    try {
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            res.set('X-Cache', 'HIT');
            return res.json(JSON.parse(cachedData));
        }

        const orderBy = sort === 'name' ? 'r.name ASC' : 'avg_rating DESC';
        const result = await db.query(
            `SELECT r.*, COALESCE(AVG(rv.rating), 0) AS avg_rating
             FROM restaurants r
             LEFT JOIN reviews rv ON rv.restaurant_id = r.id
             WHERE ($1::text IS NULL OR r.city = $1)
               AND r.active = true
             GROUP BY r.id
             ORDER BY ${orderBy}
             LIMIT $2 OFFSET $3`,
            [city, limit, offset]
        );

        const data = {
            restaurants: result.rows,
            pagination: {
                city: city || 'all',
                page,
                limit,
                sort
            }
        };

        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
        res.set('X-Cache', 'MISS');
        return res.json(data);
    } catch (err) {
        console.error('[Restaurant] getRestaurants error:', err);
        res.status(500).json({ error: 'Failed to fetch restaurants' });
    }
};

const getMenu = async (req, res) => {
    const restaurantId = parseInt(req.params.id, 10);

    try {
        const restaurantResult = await db.query(
            'SELECT id, name, city, cuisine_type FROM restaurants WHERE id = $1 AND active = true',
            [restaurantId]
        );

        if (restaurantResult.rows.length === 0) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        const menuResult = await db.query(
            `SELECT c.id AS category_id,
                    c.name AS category_name,
                    COALESCE(
                      json_agg(
                        json_build_object(
                          'id', mi.id,
                          'name', mi.name,
                          'description', mi.description,
                          'price', mi.price,
                          'available', mi.available
                        )
                      ) FILTER (WHERE mi.id IS NOT NULL),
                      '[]'
                    ) AS items
             FROM categories c
             LEFT JOIN menu_items mi ON mi.category_id = c.id
             WHERE c.restaurant_id = $1
             GROUP BY c.id
             ORDER BY c.name ASC`,
            [restaurantId]
        );

        return res.json({
            restaurant: restaurantResult.rows[0],
            menu: menuResult.rows
        });
    } catch (err) {
        console.error('[Restaurant] getMenu error:', err);
        res.status(500).json({ error: 'Failed to fetch restaurant menu' });
    }
};

const getHealth = async (req, res) => {
    try {
        await db.query('SELECT 1');
        const redisStatus = await redis.ping();
        return res.json({ status: 'ok', redis: redisStatus === 'PONG' });
    } catch (err) {
        console.error('[Restaurant] health check failed:', err);
        return res.status(500).json({ status: 'error' });
    }
};

const createRestaurant = async (req, res) => {
    const { name, city, cuisine_type, description, active = true } = req.body;

    if (!name || !city) {
        return res.status(400).json({ error: 'Restaurant name and city are required' });
    }

    try {
        const result = await db.query(
            `INSERT INTO restaurants (name, city, cuisine_type, description, active)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [name, city, cuisine_type, description, active]
        );

        await invalidateRestaurantCache(city);

        return res.status(201).json({ restaurant: result.rows[0] });
    } catch (err) {
        console.error('[Restaurant] createRestaurant error:', err);
        return res.status(500).json({ error: 'Failed to create restaurant' });
    }
};

const updateRestaurant = async (req, res) => {
    const restaurantId = parseInt(req.params.id, 10);
    const { name, city, cuisine_type, description, active } = req.body;

    try {
        const current = await db.query('SELECT * FROM restaurants WHERE id = $1', [restaurantId]);
        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        const existing = current.rows[0];
        const updatedCity = city || existing.city;

        const result = await db.query(
            `UPDATE restaurants
             SET name = COALESCE($1, name),
                 city = COALESCE($2, city),
                 cuisine_type = COALESCE($3, cuisine_type),
                 description = COALESCE($4, description),
                 active = COALESCE($5, active)
             WHERE id = $6
             RETURNING *`,
            [name, city, cuisine_type, description, active, restaurantId]
        );

        await invalidateRestaurantCache(updatedCity);
        if (existing.city !== updatedCity) {
            await invalidateRestaurantCache(existing.city);
        }

        return res.json({ restaurant: result.rows[0] });
    } catch (err) {
        console.error('[Restaurant] updateRestaurant error:', err);
        return res.status(500).json({ error: 'Failed to update restaurant' });
    }
};

const deleteRestaurant = async (req, res) => {
    const restaurantId = parseInt(req.params.id, 10);

    try {
        const current = await db.query('SELECT * FROM restaurants WHERE id = $1', [restaurantId]);
        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        const city = current.rows[0].city;
        await db.query('UPDATE restaurants SET active = false WHERE id = $1', [restaurantId]);
        await invalidateRestaurantCache(city);

        return res.status(200).json({ message: 'Restaurant disabled and cache invalidated' });
    } catch (err) {
        console.error('[Restaurant] deleteRestaurant error:', err);
        return res.status(500).json({ error: 'Failed to delete restaurant' });
    }
};

module.exports = {
    getHealth,
    getRestaurants,
    getMenu,
    createRestaurant,
    updateRestaurant,
    deleteRestaurant
};