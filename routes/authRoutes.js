const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dbService = require('../db/dbService');
const { authenticateToken, JWT_SECRET } = require('../middleware/authMiddleware');

// Standardize Indian 10-digit mobile numbers
function cleanPhone(p) {
    if (!p) return '';
    return p.toString().replace(/[^0-9]/g, '').slice(-10);
}

// 1. REGISTER CLIENT
router.post('/register', async (req, res) => {
    try {
        const { name, phone, pin } = req.body;

        if (!name || name.trim().length < 2) {
            return res.status(400).json({ error: 'Please enter your full name.' });
        }

        const sanitizedPhone = cleanPhone(phone);
        if (sanitizedPhone.length !== 10) {
            return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
        }

        const pinStr = pin ? pin.toString().trim() : '';
        if (pinStr.length !== 4 || !/^\d{4}$/.test(pinStr)) {
            return res.status(400).json({ error: 'PIN must be exactly 4 digits.' });
        }

        // Check if phone already exists
        const existing = await dbService.getUserByPhone(sanitizedPhone);
        if (existing) {
            return res.status(400).json({ error: 'This mobile number is already registered. Please sign in.' });
        }

        const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const pinHash = bcrypt.hashSync(pinStr, 10);

        // Create User
        await dbService.createUser({
            id: userId,
            name: name.trim(),
            phone: sanitizedPhone,
            pin_hash: pinHash,
            role: 'client'
        });

        // Create First Master Plan
        const planId = await dbService.createInitialPlan(userId);

        const token = jwt.sign({ userId, role: 'client' }, JWT_SECRET, { expiresIn: '90d' });

        return res.status(201).json({
            message: 'Registration successful!',
            token,
            user: { id: userId, name: name.trim(), phone: sanitizedPhone, role: 'client' },
            activePlanId: planId
        });
    } catch (err) {
        console.error('Registration error:', err);
        return res.status(500).json({ error: 'Registration failed. ' + err.message });
    }
});

// 2. LOGIN (CLIENT OR ADVISOR)
router.post('/login', async (req, res) => {
    try {
        const { phone, pin } = req.body;
        const sanitizedPhone = cleanPhone(phone);
        const pinStr = pin ? pin.toString().trim() : '';

        if (!sanitizedPhone || sanitizedPhone.length !== 10) {
            return res.status(400).json({ error: 'Please enter your 10-digit mobile number.' });
        }
        if (!pinStr) {
            return res.status(400).json({ error: 'Please enter your 4-digit PIN.' });
        }

        const user = await dbService.getUserByPhone(sanitizedPhone);
        if (!user) {
            return res.status(401).json({ error: 'Account not found. Please register first.' });
        }

        const isMatch = bcrypt.compareSync(pinStr, user.pin_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect 4-digit PIN. Please try again.' });
        }

        // Update last login
        await dbService.updateLastLogin(user.id);

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '90d' });

        return res.json({
            message: 'Signed in successfully!',
            token,
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Login failed: ' + err.message });
    }
});

// 3. GET CURRENT USER
router.get('/me', authenticateToken, async (req, res) => {
    return res.json({ user: req.user });
});

module.exports = router;
