const jwt = require('jsonwebtoken');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'SRP_PRIME_WEALTH_SECRET_KEY_2026_FREEDOM_PLANNER';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = db.prepare('SELECT id, name, phone, role FROM users WHERE id = ?').get(decoded.userId);
        if (!user) {
            return res.status(403).json({ error: 'User session expired or not found.' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired session token.' });
    }
}

function requireAdvisor(req, res, next) {
    if (!req.user || req.user.role !== 'advisor') {
        return res.status(403).json({ error: 'Access denied: Advisor privileges required.' });
    }
    next();
}

module.exports = {
    authenticateToken,
    requireAdvisor,
    JWT_SECRET
};
