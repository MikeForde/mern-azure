// middlewares/rateLimiter.js
const rateLimit = require('express-rate-limit');

const jsonRateLimitHandler = (req, res) => {
    res.status(429).json({ error: 'Too many requests, please try again later.' });
};

// Baseline limiter applied to every request.
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonRateLimitHandler,
});

// Tighter limiter for destructive / expensive routes (mass delete, bulk insert, regex search).
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonRateLimitHandler,
});

module.exports = { generalLimiter, strictLimiter };
