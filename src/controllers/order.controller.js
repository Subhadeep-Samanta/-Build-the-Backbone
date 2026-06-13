const db = require('../db');
const emailService = require('../lib/emailService');

/**
 * Get Order History
 * Fixed N+1 Query Problem
 */
const getOrderHistory = async (req, res) => {
    const userId = req.user.id;

    console.log(`[Order Controller] Fetching history for User #${userId}`);

    try {
        const result = await db.query(
            `
            SELECT
                o.id,
                o.user_id,
                o.restaurant_id,
                o.total_amount,
                o.delivery_fee,
                o.order_date,
                json_agg(
                    json_build_object(
                        'item_id', oi.id,
                        'menu_item_id', oi.menu_item_id,
                        'quantity', oi.quantity,
                        'unit_price', oi.unit_price,
                        'subtotal', oi.subtotal,
                        'name', mi.name
                    )
                ) AS items
            FROM orders o
            JOIN order_items oi
                ON oi.order_id = o.id
            JOIN menu_items mi
                ON mi.id = oi.menu_item_id
            WHERE o.user_id = $1
            GROUP BY o.id
            ORDER BY o.order_date DESC
            `,
            [userId]
        );

        res.json({
            user_id: userId,
            total_orders: result.rows.length,
            orders: result.rows
        });

    } catch (err) {
        console.error('Error fetching order history:', err);

        res.status(500).json({
            error: 'Failed to fetch order history'
        });
    }
};

/**
 * Create Order
 * Fixed synchronous email bottleneck
 */
const createOrder = async (req, res) => {
    const { restaurant_id, items, delivery_fee } = req.body;
    const userId = req.user.id;

    if (!items || items.length === 0) {
        return res.status(400).json({
            error: 'No items in order'
        });
    }

    try {
        let total = 0;

        for (const item of items) {
            total += item.price * item.quantity;
        }

        total += delivery_fee;

        const orderResult = await db.query(
            `
            INSERT INTO orders
            (user_id, restaurant_id, total_amount, delivery_fee)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            `,
            [userId, restaurant_id, total, delivery_fee]
        );

        const orderId = orderResult.rows[0].id;

        for (const item of items) {
            await db.query(
                `
                INSERT INTO order_items
                (order_id, menu_item_id, quantity, unit_price, subtotal)
                VALUES ($1, $2, $3, $4, $5)
                `,
                [
                    orderId,
                    item.menu_item_id,
                    item.quantity,
                    item.price,
                    item.price * item.quantity
                ]
            );
        }

        // Send email asynchronously (non-blocking)
        emailService
            .sendConfirmation(orderId, req.user.email)
            .catch(err => {
                console.error('Email send failed:', err);
            });

        res.status(201).json({
            message: 'Order created successfully!',
            order_id: orderId
        });

    } catch (err) {
        console.error('Error creating order:', err);

        res.status(500).json({
            error: 'Failed to create order'
        });
    }
};

const getOrderById = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const result = await db.query(
            `
            SELECT *
            FROM orders
            WHERE id = $1
              AND user_id = $2
            `,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Order not found'
            });
        }

        res.json(result.rows[0]);

    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Failed to fetch order'
        });
    }
};

module.exports = {
    getOrderHistory,
    createOrder,
    getOrderById
};