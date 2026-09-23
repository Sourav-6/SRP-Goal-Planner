const path = require('path');
const express = require('express');
const app = require('./app');

const PORT = process.env.PORT || 8080;

// Serve static frontend assets for local development
app.use(express.static(path.join(__dirname)));

// SPA Fallback for local development
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Local Server
const server = app.listen(PORT, () => {
    const { isSupabaseConfigured } = require('./db/supabaseClient');
    const engine = isSupabaseConfigured() ? 'Supabase Cloud (PostgreSQL)' : 'Local SQLite (better-sqlite3)';

    console.log(`\n=============================================================`);
    console.log(`[SRP] Prime Wealth Financial Freedom Planner & Advisor Engine`);
    console.log(`[HTTP] Local Server running at: http://localhost:${PORT}`);
    console.log(`[DB] Database Engine: ${engine}`);
    console.log(`[AUTH] Default Advisor Phone: 9999999999 | PIN: 7777`);
    console.log(`=============================================================\n`);
});

module.exports = server;
