const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
require('express-async-errors');

const authController = require('./controllers/auth.controller');
const restaurantController = require('./controllers/restaurant.controller');
const orderController = require('./controllers/order.controller');
const authMiddleware = require('./middleware/auth.middleware');
const rateLimiter = require('./middleware/rateLimiter.middleware');

const app = express();

const orderRateLimit = rateLimiter({
    maxRequests: 10,
    windowMs: 60 * 1000,
    keyFn: (req) => `user:${req.user.id}:orders`
});

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

// Public Routes
app.get('/api/health', restaurantController.getHealth);
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.get('/api/restaurants', restaurantController.getRestaurants);
app.get('/api/restaurants/:id/menu', restaurantController.getMenu);

// Restaurant mutation routes (protected)
app.post('/api/restaurants', authMiddleware, restaurantController.createRestaurant);
app.put('/api/restaurants/:id', authMiddleware, restaurantController.updateRestaurant);
app.delete('/api/restaurants/:id', authMiddleware, restaurantController.deleteRestaurant);

// Authenticated Order Routes
app.post('/api/orders', authMiddleware, orderRateLimit, orderController.createOrder);
app.get('/api/orders/history', authMiddleware, orderController.getOrderHistory);
app.get('/api/orders/:id', authMiddleware, orderController.getOrderById);

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('[Global Error]', err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
