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
            pre_ret_irr REAL NOT NULL DEFAULT 13.5,
            post_ret_irr REAL NOT NULL DEFAULT 8.0,
            inflation_rate REAL NOT NULL DEFAULT 6.5,
            initial_equity_pct REAL NOT NULL DEFAULT 80,
            glide_start_months INTEGER NOT NULL DEFAULT 108,
            glide_end_months INTEGER NOT NULL DEFAULT 12,
            pension_delay_yrs INTEGER NOT NULL DEFAULT 0,
            solver_mode TEXT NOT NULL DEFAULT 'custom',
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

        // Seed Sample Client 1: Rahul Sharma (Early Freedom Plan)
        const c1Id = 'usr_demo_rahul';
        const c1PinHash = bcrypt.hashSync('1234', 10);
        db.prepare(`
            INSERT OR IGNORE INTO users (id, name, phone, pin_hash, role, created_at, last_login_at)
            VALUES (?, ?, ?, ?, 'client', ?, ?)
        `).run(c1Id, 'Rahul Sharma', '9876543210', c1PinHash, now, now);

        const p1Id = 'plan_rahul_primary';
        db.prepare(`
            INSERT OR IGNORE INTO plans (
                id, user_id, plan_name, current_age, retirement_age, life_expectancy,
                current_expense, initial_corpus, initial_sip, sip_step_up,
                pre_ret_irr, post_ret_irr, inflation_rate, initial_equity_pct,
                glide_start_months, glide_end_months, pension_delay_yrs, solver_mode,
                is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            p1Id, c1Id, 'Early Retirement @ 55', 38, 55, 100,
            65000, 2500000, 45000, 10,
            13.5, 8.0, 6.5, 80,
            108, 12, 0, 'custom',
            1, now, now
        );

        // Rahul's Goals
        db.prepare(`
            INSERT OR IGNORE INTO milestone_goals (id, plan_id, goal_name, target_age, present_value, inflation_rate, goal_type, sort_order, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('g_r1', p1Id, 'Child Higher Education abroad', 50, 3000000, 8.0, 'lumpsum', 0, now);
        db.prepare(`
            INSERT OR IGNORE INTO milestone_goals (id, plan_id, goal_name, target_age, present_value, inflation_rate, goal_type, sort_order, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('g_r2', p1Id, 'Dream Villa Down Payment', 46, 2000000, 6.0, 'lumpsum', 1, now);

        db.prepare(`
            INSERT OR IGNORE INTO plan_snapshots (id, plan_id, target_corpus_at_ret, monthly_pension_needed, freedom_status, exhaustion_age, total_sip_invested, calculated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run('snap_r1', p1Id, 68500000, 192000, 'Fully Funded (Age 100+)', 100, 28500000, now);

        // Seed Sample Client 2: Priya Verma (Conservative Family Plan)
        const c2Id = 'usr_demo_priya';
        const c2PinHash = bcrypt.hashSync('1234', 10);
        db.prepare(`
            INSERT OR IGNORE INTO users (id, name, phone, pin_hash, role, created_at, last_login_at)
            VALUES (?, ?, ?, ?, 'client', ?, ?)
        `).run(c2Id, 'Priya Verma', '9811223344', c2PinHash, now, now);

        const p2Id = 'plan_priya_primary';
        db.prepare(`
            INSERT OR IGNORE INTO plans (
                id, user_id, plan_name, current_age, retirement_age, life_expectancy,
                current_expense, initial_corpus, initial_sip, sip_step_up,
                pre_ret_irr, post_ret_irr, inflation_rate, initial_equity_pct,
                glide_start_months, glide_end_months, pension_delay_yrs, solver_mode,
                is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            p2Id, c2Id, 'Balanced Family Blueprint', 42, 60, 100,
            40000, 1500000, 30000, 8,
            12.5, 7.5, 6.0, 70,
            96, 12, 0, 'custom',
            1, now, now
        );

        db.prepare(`
            INSERT OR IGNORE INTO milestone_goals (id, plan_id, goal_name, target_age, present_value, inflation_rate, goal_type, sort_order, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('g_p1', p2Id, 'Daughter Wedding Fund', 55, 2500000, 7.0, 'lumpsum', 0, now);

        db.prepare(`
            INSERT OR IGNORE INTO plan_snapshots (id, plan_id, target_corpus_at_ret, monthly_pension_needed, freedom_status, exhaustion_age, total_sip_invested, calculated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run('snap_p2', p2Id, 45200000, 124000, 'Fully Funded (Age 100+)', 100, 20100000, now);

        console.log('✔ Initial database initialized with Advisor & demo clients.');
    }
}

initSchema();

module.exports = db;
