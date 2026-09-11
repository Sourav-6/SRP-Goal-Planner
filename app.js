require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const planRoutes = require('./routes/planRoutes');
const advisorRoutes = require('./routes/advisorRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger for API calls
app.use((req, res, next) => {
    if (req.path && req.path.startsWith('/api')) {
        console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/advisor', advisorRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    const { isSupabaseConfigured } = require('./db/supabaseClient');
    res.json({
        status: 'ok',
        databaseEngine: isSupabaseConfigured() ? 'Supabase Cloud PostgreSQL' : 'Local SQLite',
        time: new Date().toISOString(),
        app: 'SRP Prime Wealth Financial Freedom Planner'
    });
});

module.exports = app;
