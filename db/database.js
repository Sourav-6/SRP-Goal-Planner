const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Ensure data folder exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'planner.db');
const db = new Database(dbPath);

// Enable WAL mode & Foreign Keys for integrity & performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL UNIQUE,
            pin_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'client',
            created_at TEXT NOT NULL,
            last_login_at TEXT
        );

        CREATE TABLE IF NOT EXISTS plans (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            plan_name TEXT NOT NULL DEFAULT 'Primary Plan',
            current_age INTEGER NOT NULL DEFAULT 40,
            retirement_age INTEGER NOT NULL DEFAULT 60,
            life_expectancy INTEGER NOT NULL DEFAULT 100,
            current_expense REAL NOT NULL DEFAULT 40000,
            initial_corpus REAL NOT NULL DEFAULT 1000000,
            initial_sip REAL NOT NULL DEFAULT 25000,
            sip_step_up REAL NOT NULL DEFAULT 10,
            pre_ret_irr REAL NOT NULL DEFAULT 12.0,
            post_ret_irr REAL NOT NULL DEFAULT 6.0,
            inflation_rate REAL NOT NULL DEFAULT 6.5,
            initial_equity_pct REAL NOT NULL DEFAULT 80,
            glide_start_months INTEGER NOT NULL DEFAULT 108,
            glide_end_months INTEGER NOT NULL DEFAULT 12,
            pension_delay_yrs INTEGER NOT NULL DEFAULT 0,
            solver_mode TEXT NOT NULL DEFAULT 'custom',
            retirement_enabled INTEGER NOT NULL DEFAULT 1,
            is_first_time INTEGER NOT NULL DEFAULT 1,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS milestone_goals (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            goal_name TEXT NOT NULL,
            target_age INTEGER NOT NULL,
            present_value REAL NOT NULL,
            inflation_rate REAL NOT NULL DEFAULT 7.0,
            goal_type TEXT NOT NULL DEFAULT 'lumpsum',
            loan_rate REAL DEFAULT 8.5,
            loan_tenure_yrs INTEGER DEFAULT 5,
            rec_step_up REAL DEFAULT 0,
            rec_tenure_yrs INTEGER DEFAULT 5,
            active_amount REAL DEFAULT 0,
            equity_pct REAL DEFAULT 80,
            debt_pct REAL DEFAULT 20,
            is_enabled INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS plan_snapshots (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL UNIQUE,
            target_corpus_at_ret REAL,
            monthly_pension_needed REAL,
            freedom_status TEXT,
            exhaustion_age INTEGER,
            total_sip_invested REAL,
            calculated_at TEXT NOT NULL,
            FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_id);
        CREATE INDEX IF NOT EXISTS idx_milestones_plan ON milestone_goals(plan_id);
    `);

    // Safe dynamic column migrations for existing SQLite tables
    try {
        const planCols = db.prepare("PRAGMA table_info(plans)").all().map(c => c.name);
        if (!planCols.includes('retirement_enabled')) {
            db.exec("ALTER TABLE plans ADD COLUMN retirement_enabled INTEGER NOT NULL DEFAULT 1;");
        }
        if (!planCols.includes('is_first_time')) {
            db.exec("ALTER TABLE plans ADD COLUMN is_first_time INTEGER NOT NULL DEFAULT 1;");
        }

        const goalCols = db.prepare("PRAGMA table_info(milestone_goals)").all().map(c => c.name);
        if (!goalCols.includes('active_amount')) {
            db.exec("ALTER TABLE milestone_goals ADD COLUMN active_amount REAL DEFAULT 0;");
        }
        if (!goalCols.includes('equity_pct')) {
            db.exec("ALTER TABLE milestone_goals ADD COLUMN equity_pct REAL DEFAULT 80;");
        }
        if (!goalCols.includes('debt_pct')) {
            db.exec("ALTER TABLE milestone_goals ADD COLUMN debt_pct REAL DEFAULT 20;");
        }
        if (!goalCols.includes('is_enabled')) {
            db.exec("ALTER TABLE milestone_goals ADD COLUMN is_enabled INTEGER DEFAULT 1;");
        }
    } catch (migErr) {
        console.warn('[DB Migration Warning]:', migErr.message);
    }

    seedInitialData();
}

function seedInitialData() {
    const checkAdvisor = db.prepare("SELECT id FROM users WHERE phone = ?").get('9999999999');
    if (!checkAdvisor) {
        const advisorId = 'adv_' + Date.now();
        const advisorPinHash = bcrypt.hashSync('7777', 10);
        const now = new Date().toISOString();

        db.prepare(`
            INSERT INTO users (id, name, phone, pin_hash, role, created_at, last_login_at)
            VALUES (?, ?, ?, ?, 'advisor', ?, ?)
        `).run(advisorId, 'SRP Wealth Advisor Desk', '9999999999', advisorPinHash, now, now);

        console.log('✔ Initial database initialized with Advisor account.');
    }
}

initSchema();

module.exports = db;
