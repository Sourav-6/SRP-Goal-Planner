-- ============================================================================
-- SRP PRIME WEALTH FINANCIAL FREEDOM PLANNER - SUPABASE POSTGRESQL SCHEMA
-- ============================================================================
-- INSTRUCTIONS FOR SETUP:
-- 1. Open your Supabase project dashboard (https://supabase.com/dashboard)
-- 2. Click on "SQL Editor" in the left sidebar
-- 3. Click "New query", paste the entire contents of this file, and click "Run" (Ctrl+Enter)
-- 4. That's it! All tables, indexes, policies, and demo data are initialized.
-- ============================================================================

-- 1. USERS TABLE (Clients & Wealth Advisors)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    pin_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'client',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PLANS TABLE (Multiple Named Scenarios per Client)
CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL DEFAULT 'Primary Plan',
    current_age INTEGER NOT NULL DEFAULT 40,
    retirement_age INTEGER NOT NULL DEFAULT 60,
    life_expectancy INTEGER NOT NULL DEFAULT 100,
    current_expense DOUBLE PRECISION NOT NULL DEFAULT 40000,
    initial_corpus DOUBLE PRECISION NOT NULL DEFAULT 1000000,
    initial_sip DOUBLE PRECISION NOT NULL DEFAULT 25000,
    sip_step_up DOUBLE PRECISION NOT NULL DEFAULT 10,
    pre_ret_irr DOUBLE PRECISION NOT NULL DEFAULT 13.5,
    post_ret_irr DOUBLE PRECISION NOT NULL DEFAULT 8.0,
    inflation_rate DOUBLE PRECISION NOT NULL DEFAULT 6.5,
    initial_equity_pct DOUBLE PRECISION NOT NULL DEFAULT 80,
    glide_start_months INTEGER NOT NULL DEFAULT 108,
    glide_end_months INTEGER NOT NULL DEFAULT 12,
    pension_delay_yrs INTEGER NOT NULL DEFAULT 0,
    solver_mode TEXT NOT NULL DEFAULT 'custom',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. MILESTONE GOALS TABLE (Child Education, Home, Marriage, etc.)
CREATE TABLE IF NOT EXISTS milestone_goals (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    goal_name TEXT NOT NULL,
    target_age INTEGER NOT NULL,
    present_value DOUBLE PRECISION NOT NULL,
    inflation_rate DOUBLE PRECISION NOT NULL DEFAULT 7.0,
    goal_type TEXT NOT NULL DEFAULT 'lumpsum',
    loan_rate DOUBLE PRECISION DEFAULT 8.5,
    loan_tenure_yrs INTEGER DEFAULT 5,
    rec_step_up DOUBLE PRECISION DEFAULT 0,
    rec_tenure_yrs INTEGER DEFAULT 5,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PLAN SNAPSHOTS TABLE (Calculated KPIs for Fast Advisor Analytics)
CREATE TABLE IF NOT EXISTS plan_snapshots (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL UNIQUE REFERENCES plans(id) ON DELETE CASCADE,
    target_corpus_at_ret DOUBLE PRECISION,
    monthly_pension_needed DOUBLE PRECISION,
    freedom_status TEXT,
    exhaustion_age INTEGER,
    total_sip_invested DOUBLE PRECISION,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_id);
CREATE INDEX IF NOT EXISTS idx_milestones_plan ON milestone_goals(plan_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_plan ON plan_snapshots(plan_id);

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- Enable RLS for data protection
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow unrestricted access for API backend calls (Netlify Serverless Function with Service Role or Anon Key)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Api Backend Access Users') THEN
        CREATE POLICY "Api Backend Access Users" ON users FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plans' AND policyname = 'Api Backend Access Plans') THEN
        CREATE POLICY "Api Backend Access Plans" ON plans FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'milestone_goals' AND policyname = 'Api Backend Access Milestones') THEN
        CREATE POLICY "Api Backend Access Milestones" ON milestone_goals FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plan_snapshots' AND policyname = 'Api Backend Access Snapshots') THEN
        CREATE POLICY "Api Backend Access Snapshots" ON plan_snapshots FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;

-- 7. SEED DATA (Default Wealth Advisor & Demo Clients)
-- Advisor: Phone 9999999999 | PIN 7777 (bcrypt hash: $2b$10$ZDFM/FK4Nj3rQQguUnthFOqMPyYwE9Wr/2Ei979e10kcnJZhKDbJi)
INSERT INTO users (id, name, phone, pin_hash, role, created_at, last_login_at)
VALUES (
    'adv_srp_master',
    'SRP Wealth Advisor Desk',
    '9999999999',
    '$2b$10$ZDFM/FK4Nj3rQQguUnthFOqMPyYwE9Wr/2Ei979e10kcnJZhKDbJi',
    'advisor',
    NOW(),
    NOW()
)
ON CONFLICT (phone) DO NOTHING;

-- Demo Client 1: Rahul Sharma (PIN: 1234)
INSERT INTO users (id, name, phone, pin_hash, role, created_at, last_login_at)
VALUES (
    'usr_demo_rahul',
    'Rahul Sharma',
    '9876543210',
    '$2b$10$vtpiw4i1c46zPgXFBih1xu9IA8lexByoe0IQgw51NBDuJGW5XkdNy',
    'client',
    NOW(),
    NOW()
)
ON CONFLICT (phone) DO NOTHING;

-- Rahul's Primary Plan
INSERT INTO plans (
    id, user_id, plan_name, current_age, retirement_age, life_expectancy,
    current_expense, initial_corpus, initial_sip, sip_step_up,
    pre_ret_irr, post_ret_irr, inflation_rate, initial_equity_pct,
    glide_start_months, glide_end_months, pension_delay_yrs, solver_mode,
    is_active, created_at, updated_at
) VALUES (
    'plan_rahul_primary',
    'usr_demo_rahul',
    'Early Retirement @ 55',
    38, 55, 100,
    65000, 2500000, 45000, 10,
    13.5, 8.0, 6.5, 80,
    108, 12, 0, 'custom',
    1, NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Rahul's Goals
INSERT INTO milestone_goals (id, plan_id, goal_name, target_age, present_value, inflation_rate, goal_type, sort_order, created_at)
VALUES 
    ('g_r1', 'plan_rahul_primary', 'Child Higher Education Abroad', 50, 3000000, 8.0, 'lumpsum', 0, NOW()),
    ('g_r2', 'plan_rahul_primary', 'Dream Villa Down Payment', 46, 2000000, 6.0, 'lumpsum', 1, NOW())
ON CONFLICT (id) DO NOTHING;

-- Rahul's Snapshot
INSERT INTO plan_snapshots (id, plan_id, target_corpus_at_ret, monthly_pension_needed, freedom_status, exhaustion_age, total_sip_invested, calculated_at)
VALUES ('snap_r1', 'plan_rahul_primary', 68500000, 192000, 'Fully Funded (Age 100+)', 100, 28500000, NOW())
ON CONFLICT (plan_id) DO NOTHING;

-- Demo Client 2: Priya Verma (PIN: 1234)
INSERT INTO users (id, name, phone, pin_hash, role, created_at, last_login_at)
VALUES (
    'usr_demo_priya',
    'Priya Verma',
    '9811223344',
    '$2b$10$vtpiw4i1c46zPgXFBih1xu9IA8lexByoe0IQgw51NBDuJGW5XkdNy',
    'client',
    NOW(),
    NOW()
)
ON CONFLICT (phone) DO NOTHING;

-- Priya's Primary Plan
INSERT INTO plans (
    id, user_id, plan_name, current_age, retirement_age, life_expectancy,
    current_expense, initial_corpus, initial_sip, sip_step_up,
    pre_ret_irr, post_ret_irr, inflation_rate, initial_equity_pct,
    glide_start_months, glide_end_months, pension_delay_yrs, solver_mode,
    is_active, created_at, updated_at
) VALUES (
    'plan_priya_primary',
    'usr_demo_priya',
    'Balanced Family Blueprint',
    42, 60, 100,
    40000, 1500000, 30000, 8,
    12.5, 7.5, 6.0, 70,
    96, 12, 0, 'custom',
    1, NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Priya's Goals
INSERT INTO milestone_goals (id, plan_id, goal_name, target_age, present_value, inflation_rate, goal_type, sort_order, created_at)
VALUES 
    ('g_p1', 'plan_priya_primary', 'Daughter Wedding Fund', 55, 2500000, 7.0, 'lumpsum', 0, NOW())
ON CONFLICT (id) DO NOTHING;

-- Priya's Snapshot
INSERT INTO plan_snapshots (id, plan_id, target_corpus_at_ret, monthly_pension_needed, freedom_status, exhaustion_age, total_sip_invested, calculated_at)
VALUES ('snap_p2', 'plan_priya_primary', 45200000, 124000, 'Fully Funded (Age 100+)', 100, 20100000, NOW())
ON CONFLICT (plan_id) DO NOTHING;

-- Done!
