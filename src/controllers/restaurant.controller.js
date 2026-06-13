const db = require('../db');

/**
 * Get Restaurants
 */
const getRestaurants = async (req, res) => {
    const { city, limit = 20, offset = 0 } = req.query;

    try {
        let queryStr = 'SELECT * FROM restaurants';
        const params = [];

        if (city) {
            queryStr += ' WHERE city = $1';
            params.push(city);

            queryStr += ' LIMIT $2 OFFSET $3';
            params.push(limit, offset);
        } else {
            queryStr += ' LIMIT $1 OFFSET $2';
            params.push(limit, offset);
        }

        const result = await db.query(queryStr, params);

        res.json({
            total: result.rowCount,
            restaurants: result.rows
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Failed to fetch restaurants'
        });
    }
};

/**
 * Get Restaurant Menu
 * Fixed N+1 Query Problem
 */
const getMenu = async (req, res) => {
    const { id } = req.params;

    console.log(
        `[Restaurant Controller] Fetching menu for Restaurant #${id}`
    );

    try {
        const result = await db.query(
            `
            SELECT
                mi.*,
                c.name AS category
            FROM menu_items mi
            LEFT JOIN categories c
                ON c.id = mi.category_id
            WHERE mi.restaurant_id = $1
              AND mi.is_available = TRUE
            `,
            [id]
        );

        res.json({
            restaurant_id: id,
            menu: result.rows
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Failed to fetch menu'
        });
    }
};

const getHealth = async (req, res) => {
    try {
        await db.query('SELECT 1');

        res.json({
            status: 'UP',
            database: 'connected'
        });
    } catch (err) {
        res.status(503).json({
            status: 'DOWN',
            database: 'disconnected'
        });
    }
};

module.exports = {
    getRestaurants,
    getMenu,
    getHealth
};