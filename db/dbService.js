const { getSupabaseClient, isSupabaseConfigured } = require('./supabaseClient');

let sqliteDb = null;
function getSqlite() {
    if (!sqliteDb) {
        try {
            sqliteDb = require('./database');
        } catch (err) {
            console.warn('[DB] SQLite engine warning:', err.message);
        }
    }
    return sqliteDb;
}

function normalizePlanRecord(plan) {
    if (!plan) return null;
    let retEnabled = 1;
    let isFirstTime = (plan.current_age === 0 || plan.current_age === null || plan.current_age === undefined) ? 1 : 0;

    if (plan.solver_mode && typeof plan.solver_mode === 'string' && plan.solver_mode.startsWith('{')) {
        try {
            const meta = JSON.parse(plan.solver_mode);
            if (meta.retirement_enabled !== undefined) retEnabled = meta.retirement_enabled ? 1 : 0;
            if (meta.is_first_time !== undefined) isFirstTime = meta.is_first_time ? 1 : 0;
            plan.solver_mode = meta.mode || 'custom';
        } catch (e) {}
    } else if (plan.retirement_enabled !== undefined) {
        retEnabled = plan.retirement_enabled ? 1 : 0;
    }
    if (plan.is_first_time !== undefined) {
        isFirstTime = plan.is_first_time ? 1 : isFirstTime;
    }

    plan.retirement_enabled = retEnabled;
    plan.is_first_time = isFirstTime;
    return plan;
}

function normalizeMilestones(milestones) {
    if (!Array.isArray(milestones)) return [];
    return milestones.map(m => {
        let activeAmount = m.active_amount !== undefined ? parseFloat(m.active_amount) : 0;
        let equityPct = m.equity_pct !== undefined ? parseFloat(m.equity_pct) : 80;
        let debtPct = m.debt_pct !== undefined ? parseFloat(m.debt_pct) : 20;
        let isEnabled = m.is_enabled !== undefined ? (m.is_enabled ? 1 : 0) : 1;
        let goalType = m.goal_type || 'lumpsum';

        if (goalType && typeof goalType === 'string' && goalType.startsWith('{')) {
            try {
                const meta = JSON.parse(goalType);
                goalType = meta.type || 'lumpsum';
                if (meta.active !== undefined) activeAmount = parseFloat(meta.active) || 0;
                if (meta.eq !== undefined) equityPct = parseFloat(meta.eq) || 80;
                if (meta.debt !== undefined) debtPct = parseFloat(meta.debt) || 20;
                if (meta.enabled !== undefined) isEnabled = meta.enabled ? 1 : 0;
            } catch (e) {}
        }

        return {
            ...m,
            goal_type: goalType,
            active_amount: activeAmount,
            equity_pct: equityPct,
            debt_pct: debtPct,
            is_enabled: isEnabled
        };
    });
}

const dbService = {
    isSupabaseConfigured,

    // ==========================================
    // USERS & AUTHENTICATION
    // ==========================================
    async getUserByPhone(phone) {
        if (isSupabaseConfigured()) {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('phone', phone)
                .maybeSingle();
            if (error) throw new Error('Database query error: ' + error.message);
            return data;
        }

        const db = getSqlite();
        return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) || null;
    },

    async getUserById(id) {
        if (isSupabaseConfigured()) {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from('users')
                .select('id, name, phone, role')
                .eq('id', id)
                .maybeSingle();
            if (error) throw new Error('Database query error: ' + error.message);
            return data;
        }

        const db = getSqlite();
        return db.prepare('SELECT id, name, phone, role FROM users WHERE id = ?').get(id) || null;
    },

    async createUser({ id, name, phone, pin_hash, role }) {
        const now = new Date().toISOString();
        const userId = id || ('usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
        const userRecord = {
            id: userId,
            name: name.trim(),
            phone,
            pin_hash,
            role: role || 'client',
            created_at: now,
            last_login_at: now
        };

        if (isSupabaseConfigured()) {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from('users')
                .insert(userRecord)
                .select()
                .single();
            if (error) throw new Error('User creation failed: ' + error.message);
            return data;
        }

        const db = getSqlite();
        db.prepare(`
            INSERT INTO users (id, name, phone, pin_hash, role, created_at, last_login_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userRecord.id, userRecord.name, userRecord.phone, userRecord.pin_hash, userRecord.role, now, now);
        return userRecord;
    },

    async updateLastLogin(id) {
        const now = new Date().toISOString();
        if (isSupabaseConfigured()) {
            const supabase = getSupabaseClient();
            await supabase.from('users').update({ last_login_at: now }).eq('id', id);
            return;
        }

        const db = getSqlite();
        db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, id);
    },

    async createInitialPlan(userId) {
        const planId = 'plan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const now = new Date().toISOString();
        const solverMeta = JSON.stringify({ mode: 'custom', is_first_time: 1, retirement_enabled: 1 });

        if (isSupabaseConfigured()) {
            const supabase = getSupabaseClient();
            const { error } = await supabase.from('plans').insert({
                id: planId,
                user_id: userId,
                plan_name: 'My Freedom Plan',
                current_age: 0,
                retirement_age: 0,
                life_expectancy: 100,
                current_expense: 0,
                initial_corpus: 0,
                initial_sip: 0,
                sip_step_up: 0,
                pre_ret_irr: 13.5,
                post_ret_irr: 8.0,
                inflation_rate: 6.5,
                initial_equity_pct: 80,
                glide_start_months: 108,
                glide_end_months: 12,
                pension_delay_yrs: 0,
                solver_mode: solverMeta,
                is_active: 1,
                created_at: now,
                updated_at: now
            });
            if (error) throw new Error('Initial plan setup failed: ' + error.message);
            return planId;
        }

        const db = getSqlite();
        db.prepare(`
            INSERT INTO plans (
                id, user_id, plan_name, current_age, retirement_age, life_expectancy,
                current_expense, initial_corpus, initial_sip, sip_step_up,
                pre_ret_irr, post_ret_irr, inflation_rate, initial_equity_pct,
                glide_start_months, glide_end_months, pension_delay_yrs, solver_mode,
                retirement_enabled, is_first_time,
                is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            planId, userId, 'My Freedom Plan', 0, 0, 100,
            0, 0, 0, 0,
            13.5, 8.0, 6.5, 80,
            108, 12, 0, solverMeta,
            1, 1,
            1, now, now
        );
        return planId;
    },

    // ==========================================
    // PLANS & SCENARIOS
    // ==========================================
    async getPlansByUserId(userId) {
        if (isSupabaseConfigured()) {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from('plans')
                .select('id, plan_name, is_active, current_age, retirement_age, initial_corpus, initial_sip, initial_equity_pct, updated_at')
                .eq('user_id', userId)
                .order('is_active', { ascending: false })
                .order('updated_at', { ascending: false });
            if (error) throw new Error('Failed to load scenarios: ' + error.message);
            return data || [];
        }

        const db = getSqlite();
        return db.prepare(`
            SELECT id, plan_name, is_active, current_age, retirement_age,
                   initial_corpus, initial_sip, initial_equity_pct, updated_at
            FROM plans
            WHERE user_id = ?
            ORDER BY is_active DESC, updated_at DESC
        `).all(userId);
    },

    async getActivePlan(userId) {
        if (isSupabaseConfigured()) {
            const supabase = getSupabaseClient();
            let { data: plan, error } = await supabase
                .from('plans')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', 1)
                .limit(1)
                .maybeSingle();

            if (error) throw new Error(error.message);

            if (!plan) {
                const fallback = await supabase
                    .from('plans')
                    .select('*')
                    .eq('user_id', userId)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                plan = fallback.data;
            }

            if (!plan) return null;

            const { data: milestones } = await supabase
                .from('milestone_goals')
                .select('*')
                .eq('plan_id', plan.id)
                .order('sort_order', { ascending: true })
                .order('target_age', { ascending: true });

            const { data: snapshot } = await supabase
                .from('plan_snapshots')
                .select('*')
                .eq('plan_id', plan.id)
                .maybeSingle();

            return {
                plan: normalizePlanRecord(plan),
                milestones: normalizeMilestones(milestones || []),
                snapshot: snapshot || null
            };
        }

        const db = getSqlite();
        let plan = db.prepare(`
            SELECT * FROM plans
            WHERE user_id = ? AND is_active = 1
            LIMIT 1
        `).get(userId);

        if (!plan) {
            plan = db.prepare(`
                SELECT * FROM plans
                WHERE user_id = ?
                ORDER BY updated_at DESC
                LIMIT 1
            `).get(userId);
        }

        if (!plan) return null;

        const milestones = db.prepare(`
            SELECT * FROM milestone_goals
            WHERE plan_id = ?
            ORDER BY sort_order ASC, target_age ASC
        `).all(plan.id);

        const snapshot = db.prepare(`
            SELECT * FROM plan_snapshots
            WHERE plan_id = ?
        `).get(plan.id);

        return {
            plan: normalizePlanRecord(plan),
            milestones: normalizeMilestones(milestones || []),
            snapshot: snapshot || null
        };
    },

    async getPlanById(planId, userId) {
        if (isSupabaseConfigured()) {
            const supabase = getSupabaseClient();
            const { data: plan, error } = await supabase
                .from('plans')
                .select('*')
                .eq('id', planId)
                .eq('user_id', userId)
                .maybeSingle();

            if (error) throw new Error(error.message);
            if (!plan) return null;

            const { data: milestones } = await supabase
                .from('milestone_goals')
                .select('*')
                .eq('plan_id', plan.id)
                .order('sort_order', { ascending: true })
                .order('target_age', { ascending: true });

            const { data: snapshot } = await supabase
                .from('plan_snapshots')
                .select('*')
                .eq('plan_id', plan.id)
                .maybeSingle();

            return {
                plan: normalizePlanRecord(plan),
                milestones: normalizeMilestones(milestones || []),
                snapshot: snapshot || null
            };
        }

        const db = getSqlite();
        const plan = db.prepare(`
            SELECT * FROM plans WHERE id = ? AND user_id = ?
        `).get(planId, userId);

        if (!plan) return null;

        const milestones = db.prepare(`
            SELECT * FROM milestone_goals
            WHERE plan_id = ?
            ORDER BY sort_order ASC, target_age ASC
        `).all(plan.id);

        const snapshot = db.prepare(`
            SELECT * FROM plan_snapshots
            WHERE plan_id = ?
        `).get(plan.id);

        return {
            plan: normalizePlanRecord(plan),
            milestones: normalizeMilestones(milestones || []),
            snapshot: snapshot || null
        };
    },

    async createPlan(userId, planName, cloneFromId) {
        const name = (planName && planName.trim()) || 'New Plan scenario';
        const newPlanId = 'plan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const now = new Date().toISOString();

        if (isSupabaseConfigured()) {
            const supabase = getSupabaseClient();
            await supabase.from('plans').update({ is_active: 0 }).eq('user_id', userId);

            let base = null;
            let baseGoals = [];
            if (cloneFromId) {
                const bRes = await supabase.from('plans').select('*').eq('id', cloneFromId).eq('user_id', userId).maybeSingle();
                base = bRes.data;
                if (base) {
                    const gRes = await supabase.from('milestone_goals').select('*').eq('plan_id', cloneFromId);
                    baseGoals = gRes.data || [];
                }
            }

            const record = base ? {
                id: newPlanId,
                user_id: userId,
                plan_name: name,
                current_age: base.current_age,
                retirement_age: base.retirement_age,
                life_expectancy: base.life_expectancy,
                current_expense: base.current_expense,
                initial_corpus: base.initial_corpus,
                initial_sip: base.initial_sip,
                sip_step_up: base.sip_step_up,
                pre_ret_irr: base.pre_ret_irr,
                post_ret_irr: base.post_ret_irr,
                inflation_rate: base.inflation_rate,
                initial_equity_pct: base.initial_equity_pct,
                glide_start_months: base.glide_start_months,
                glide_end_months: base.glide_end_months,
                pension_delay_yrs: base.pension_delay_yrs,
                solver_mode: base.solver_mode,
                is_active: 1,
                created_at: now,
                updated_at: now
            } : {
                id: newPlanId,
                user_id: userId,
                plan_name: name,
                current_age: 0,
                retirement_age: 0,
                life_expectancy: 100,
                current_expense: 0,
                initial_corpus: 0,
                initial_sip: 0,
                sip_step_up: 0,
                pre_ret_irr: 13.5,
                post_ret_irr: 8.0,
                inflation_rate: 6.5,
                initial_equity_pct: 80,
                glide_start_months: 108,
                glide_end_months: 12,
                pension_delay_yrs: 0,
                solver_mode: JSON.stringify({ mode: 'custom', is_first_time: 1, retirement_enabled: 1 }),
                is_active: 1,
                created_at: now,
                updated_at: now
            };

            const { error: insErr } = await supabase.from('plans').insert(record);
            if (insErr) throw new Error(insErr.message);

            if (baseGoals.length > 0) {
                const clones = baseGoals.map((m, idx) => ({
                    id: 'g_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 5),
                    plan_id: newPlanId,
                    goal_name: m.goal_name,
                    target_age: m.target_age,
                    present_value: m.present_value,
                    inflation_rate: m.inflation_rate,
                    goal_type: m.goal_type,
                    loan_rate: m.loan_rate,
                    loan_tenure_yrs: m.loan_tenure_yrs,
                    rec_step_up: m.rec_step_up,
                    rec_tenure_yrs: m.rec_tenure_yrs,
                    sort_order: m.sort_order,
                    created_at: now
                }));
                await supabase.from('milestone_goals').insert(clones);
            }

            return { planId: newPlanId, planName: name };
        }

        const db = getSqlite();
        let base = null;
        if (cloneFromId) {
            base = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(cloneFromId, userId);
        }

        db.prepare('UPDATE plans SET is_active = 0 WHERE user_id = ?').run(userId);

        if (base) {
            db.prepare(`
                INSERT INTO plans (
                    id, user_id, plan_name, current_age, retirement_age, life_expectancy,
                    current_expense, initial_corpus, initial_sip, sip_step_up,
                    pre_ret_irr, post_ret_irr, inflation_rate, initial_equity_pct,
                    glide_start_months, glide_end_months, pension_delay_yrs, solver_mode,
                    retirement_enabled, is_first_time,
                    is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            `).run(
                newPlanId, userId, name, base.current_age, base.retirement_age, base.life_expectancy,
                base.current_expense, base.initial_corpus, base.initial_sip, base.sip_step_up,
                base.pre_ret_irr, base.post_ret_irr, base.inflation_rate, base.initial_equity_pct,
                base.glide_start_months, base.glide_end_months, base.pension_delay_yrs, base.solver_mode,
                base.retirement_enabled !== undefined ? base.retirement_enabled : 1,
                0, // Cloned plan is not first time
                now, now
            );

            const milestones = db.prepare('SELECT * FROM milestone_goals WHERE plan_id = ?').all(cloneFromId);
            const insertMilestone = db.prepare(`
                INSERT INTO milestone_goals (
                    id, plan_id, goal_name, target_age, present_value, inflation_rate,
                    goal_type, loan_rate, loan_tenure_yrs, rec_step_up, rec_tenure_yrs,
                    active_amount, equity_pct, debt_pct, is_enabled, sort_order, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const m of milestones) {
                const mId = 'g_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
                insertMilestone.run(
                    mId, newPlanId, m.goal_name, m.target_age, m.present_value, m.inflation_rate,
                    m.goal_type, m.loan_rate, m.loan_tenure_yrs, m.rec_step_up, m.rec_tenure_yrs,
                    m.active_amount || 0, m.equity_pct || 80, m.debt_pct || 20, m.is_enabled !== undefined ? m.is_enabled : 1,
                    m.sort_order, now
                );
            }
        } else {
            const solverMeta = JSON.stringify({ mode: 'custom', is_first_time: 1, retirement_enabled: 1 });
            db.prepare(`
                INSERT INTO plans (
                    id, user_id, plan_name, current_age, retirement_age, life_expectancy,
                    current_expense, initial_corpus, initial_sip, sip_step_up,
                    pre_ret_irr, post_ret_irr, inflation_rate, initial_equity_pct,
                    glide_start_months, glide_end_months, pension_delay_yrs, solver_mode,
                    retirement_enabled, is_first_time,
                    is_active, created_at, updated_at
                ) VALUES (?, ?, ?, 0, 0, 100, 0, 0, 0, 0, 13.5, 8.0, 6.5, 80, 108, 12, 0, ?, 1, 1, 1, ?, ?)
            `).run(newPlanId, userId, name, solverMeta, now, now);
        }

        return { planId: newPlanId, planName: name };
    },

    async savePlan(planId, userId, planData, milestones, snapshot) {
        const now = new Date().toISOString();

        if (isSupabaseConfigured()) {
            const supabase = getSupabaseClient();
            const { data: existing } = await supabase.from('plans').select('id').eq('id', planId).eq('user_id', userId).maybeSingle();
            if (!existing) return null;

            if (planData) {
                const updateObj = { updated_at: now };
                if (planData.plan_name !== undefined) updateObj.plan_name = planData.plan_name;
                if (planData.current_age !== undefined) updateObj.current_age = parseInt(planData.current_age) || 0;
                if (planData.retirement_age !== undefined) updateObj.retirement_age = parseInt(planData.retirement_age) || 0;
                if (planData.life_expectancy !== undefined) updateObj.life_expectancy = parseInt(planData.life_expectancy) || 100;
                if (planData.current_expense !== undefined) updateObj.current_expense = parseFloat(planData.current_expense) || 0;
                if (planData.initial_corpus !== undefined) updateObj.initial_corpus = parseFloat(planData.initial_corpus) || 0;
                if (planData.initial_sip !== undefined) updateObj.initial_sip = parseFloat(planData.initial_sip) || 0;
                if (planData.sip_step_up !== undefined) updateObj.sip_step_up = parseFloat(planData.sip_step_up) || 0;
                if (planData.pre_ret_irr !== undefined) updateObj.pre_ret_irr = parseFloat(planData.pre_ret_irr) || 13.5;
                if (planData.post_ret_irr !== undefined) updateObj.post_ret_irr = parseFloat(planData.post_ret_irr) || 8.0;
                if (planData.inflation_rate !== undefined) updateObj.inflation_rate = parseFloat(planData.inflation_rate) || 6.5;
                if (planData.initial_equity_pct !== undefined) updateObj.initial_equity_pct = parseFloat(planData.initial_equity_pct) || 80;
                if (planData.glide_start_months !== undefined) updateObj.glide_start_months = parseInt(planData.glide_start_months) || 108;
                if (planData.glide_end_months !== undefined) updateObj.glide_end_months = parseInt(planData.glide_end_months) || 12;
                if (planData.pension_delay_yrs !== undefined) updateObj.pension_delay_yrs = parseInt(planData.pension_delay_yrs) || 0;

                const isFirstTime = planData.is_first_time !== undefined ? (planData.is_first_time ? 1 : 0) : 0;
                const retEnabled = planData.retirement_enabled !== undefined ? (planData.retirement_enabled ? 1 : 0) : 1;
                updateObj.solver_mode = JSON.stringify({
                    mode: planData.solver_mode || 'custom',
                    is_first_time: isFirstTime,
                    retirement_enabled: retEnabled
                });

                await supabase.from('plans').update(updateObj).eq('id', planId);
            }

            if (Array.isArray(milestones)) {
                await supabase.from('milestone_goals').delete().eq('plan_id', planId);
                if (milestones.length > 0) {
                    const mRecords = milestones.map((m, idx) => ({
                        id: m.id || ('g_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 5)),
                        plan_id: planId,
                        goal_name: (m.name || m.goal_name || 'Milestone Goal').trim(),
                        target_age: parseInt(m.age || m.target_age) || 50,
                        present_value: parseFloat(m.pv || m.present_value) || 0,
                        inflation_rate: parseFloat(m.inf || m.inflation_rate) || 7.0,
                        goal_type: JSON.stringify({
                            type: m.type || m.goal_type || 'lumpsum',
                            active: parseFloat(m.active_amount ?? m.activeAmount ?? 0),
                            eq: parseFloat(m.equity_pct ?? m.equityPct ?? 80),
                            debt: parseFloat(m.debt_pct ?? m.debtPct ?? 20),
                            enabled: (m.is_enabled !== undefined ? (m.is_enabled ? 1 : 0) : 1)
                        }),
                        loan_rate: parseFloat(m.equity_pct ?? m.equityPct ?? 80),
                        loan_tenure_yrs: parseInt(m.loanYears || m.loan_tenure_yrs) || 5,
                        rec_step_up: parseFloat(m.active_amount ?? m.activeAmount ?? 0),
                        rec_tenure_yrs: parseInt(m.recYears || m.rec_tenure_yrs) || 5,
                        sort_order: idx,
                        created_at: now
                    }));
                    await supabase.from('milestone_goals').insert(mRecords);
                }
            }

            if (snapshot) {
                await supabase.from('plan_snapshots').upsert({
                    id: 'snap_' + planId,
                    plan_id: planId,
                    target_corpus_at_ret: parseFloat(snapshot.target_corpus_at_ret) || 0,
                    monthly_pension_needed: parseFloat(snapshot.monthly_pension_needed) || 0,
                    freedom_status: snapshot.freedom_status || 'Calculated',
                    exhaustion_age: parseInt(snapshot.exhaustion_age) || null,
                    total_sip_invested: parseFloat(snapshot.total_sip_invested) || 0,
                    calculated_at: now
                }, { onConflict: 'plan_id' });
            }

            return { success: true, updatedAt: now };
        }

        const db = getSqlite();
        const existing = db.prepare('SELECT id FROM plans WHERE id = ? AND user_id = ?').get(planId, userId);
        if (!existing) return null;

        const saveTx = db.transaction(() => {
            if (planData) {
                const isFirstTime = planData.is_first_time !== undefined ? (planData.is_first_time ? 1 : 0) : 0;
                const retEnabled = planData.retirement_enabled !== undefined ? (planData.retirement_enabled ? 1 : 0) : 1;
                const solverMeta = JSON.stringify({
                    mode: planData.solver_mode || 'custom',
                    is_first_time: isFirstTime,
                    retirement_enabled: retEnabled
                });

                db.prepare(`
                    UPDATE plans SET
                        plan_name = COALESCE(?, plan_name),
                        current_age = ?,
                        retirement_age = ?,
                        life_expectancy = ?,
                        current_expense = ?,
                        initial_corpus = ?,
                        initial_sip = ?,
                        sip_step_up = ?,
                        pre_ret_irr = ?,
                        post_ret_irr = ?,
                        inflation_rate = ?,
                        initial_equity_pct = ?,
                        glide_start_months = ?,
                        glide_end_months = ?,
                        pension_delay_yrs = ?,
                        solver_mode = ?,
                        retirement_enabled = ?,
                        is_first_time = ?,
                        updated_at = ?
                    WHERE id = ?
                `).run(
                    planData.plan_name || null,
                    parseInt(planData.current_age) || 0,
                    parseInt(planData.retirement_age) || 0,
                    parseInt(planData.life_expectancy) || 100,
                    parseFloat(planData.current_expense) || 0,
                    parseFloat(planData.initial_corpus) || 0,
                    parseFloat(planData.initial_sip) || 0,
                    parseFloat(planData.sip_step_up) || 0,
                    parseFloat(planData.pre_ret_irr) || 13.5,
                    parseFloat(planData.post_ret_irr) || 8.0,
                    parseFloat(planData.inflation_rate) || 6.5,
                    parseFloat(planData.initial_equity_pct) || 80,
                    parseInt(planData.glide_start_months) || 108,
                    parseInt(planData.glide_end_months) || 12,
                    parseInt(planData.pension_delay_yrs) || 0,
                    solverMeta,
                    retEnabled,
                    isFirstTime,
                    now,
                    planId
                );
            }

            if (Array.isArray(milestones)) {
                db.prepare('DELETE FROM milestone_goals WHERE plan_id = ?').run(planId);
                const insertMilestone = db.prepare(`
                    INSERT INTO milestone_goals (
                        id, plan_id, goal_name, target_age, present_value, inflation_rate,
                        goal_type, loan_rate, loan_tenure_yrs, rec_step_up, rec_tenure_yrs,
                        active_amount, equity_pct, debt_pct, is_enabled,
                        sort_order, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                milestones.forEach((m, idx) => {
                    const mId = m.id || ('g_' + Date.now() + '_' + idx);
                    const activeAmount = parseFloat(m.active_amount ?? m.activeAmount ?? 0);
                    const equityPct = parseFloat(m.equity_pct ?? m.equityPct ?? 80);
                    const debtPct = parseFloat(m.debt_pct ?? m.debtPct ?? 20);
                    const isEnabled = (m.is_enabled !== undefined ? (m.is_enabled ? 1 : 0) : 1);
                    const goalType = m.type || m.goal_type || 'lumpsum';

                    insertMilestone.run(
                        mId,
                        planId,
                        (m.name || m.goal_name || 'Milestone Goal').trim(),
                        parseInt(m.age || m.target_age) || 50,
                        parseFloat(m.pv || m.present_value) || 0,
                        parseFloat(m.inf || m.inflation_rate) || 7.0,
                        goalType,
                        equityPct,
                        parseInt(m.loanYears || m.loan_tenure_yrs) || 5,
                        activeAmount,
                        parseInt(m.recYears || m.rec_tenure_yrs) || 5,
                        activeAmount,
                        equityPct,
                        debtPct,
                        isEnabled,
                        idx,
                        now
                    );
                });
            }

            if (snapshot) {
                const snapId = 'snap_' + planId;
                db.prepare(`
                    INSERT INTO plan_snapshots (
                        id, plan_id, target_corpus_at_ret, monthly_pension_needed,
                        freedom_status, exhaustion_age, total_sip_invested, calculated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(plan_id) DO UPDATE SET
                        target_corpus_at_ret = excluded.target_corpus_at_ret,
                        monthly_pension_needed = excluded.monthly_pension_needed,
                        freedom_status = excluded.freedom_status,
                        exhaustion_age = excluded.exhaustion_age,
                        total_sip_invested = excluded.total_sip_invested,
                        calculated_at = excluded.calculated_at
                `).run(
                    snapId,
                    planId,
                    parseFloat(snapshot.target_corpus_at_ret) || 0,
                    parseFloat(snapshot.monthly_pension_needed) || 0,
                    snapshot.freedom_status || 'Calculated',
                    parseInt(snapshot.exhaustion_age) || null,
                    parseFloat(snapshot.total_sip_invested) || 0,
                    now
                );
            }
        });

        saveTx();
        return { success: true, updatedAt: now };
    },

    async activatePlan(planId, userId) {
        if (isSupabaseConfigured()) {
            const supabase = getSupabaseClient();
            const { data: exists } = await supabase.from('plans').select('id').eq('id', planId).eq('user_id', userId).maybeSingle();
            if (!exists) return false;

            await supabase.from('plans').update({ is_active: 0 }).eq('user_id', userId);
            await supabase.from('plans').update({ is_active: 1 }).eq('id', planId).eq('user_id', userId);
            return true;
        }

        const db = getSqlite();
        const exists = db.prepare('SELECT id FROM plans WHERE id = ? AND user_id = ?').get(planId, userId);
        if (!exists) return false;

        db.prepare('UPDATE plans SET is_active = 0 WHERE user_id = ?').run(userId);
        db.prepare('UPDATE plans SET is_active = 1 WHERE id = ?').run(planId);
        return true;
    },

    async deletePlan(planId, userId) {
        if (isSupabaseConfigured()) {
            const supabase = getSupabaseClient();
            const { data: plans } = await supabase.from('plans').select('id').eq('user_id', userId);
            if (!plans || plans.length <= 1) {
                throw new Error('Cannot delete the only plan on your account.');
            }

            await supabase.from('plans').delete().eq('id', planId).eq('user_id', userId);
            const { data: remainingActive } = await supabase.from('plans').select('id').eq('user_id', userId).eq('is_active', 1).maybeSingle();
            if (!remainingActive) {
                const { data: remaining } = await supabase.from('plans').select('id').eq('user_id', userId).limit(1).maybeSingle();
                if (remaining) {
                    await supabase.from('plans').update({ is_active: 1 }).eq('id', remaining.id);
                }
            }
            return true;
        }

        const db = getSqlite();
        const userPlans = db.prepare('SELECT id FROM plans WHERE user_id = ?').all(userId);
        if (userPlans.length <= 1) {
            throw new Error('Cannot delete the only plan on your account.');
        }

        db.prepare('DELETE FROM plans WHERE id = ? AND user_id = ?').run(planId, userId);

        const remainingActive = db.prepare('SELECT id FROM plans WHERE user_id = ? AND is_active = 1').get(userId);
        if (!remainingActive) {
            const first = db.prepare('SELECT id FROM plans WHERE user_id = ? LIMIT 1').get(userId);
            if (first) {
                db.prepare('UPDATE plans SET is_active = 1 WHERE id = ?').run(first.id);
            }
        }
        return true;
    },

    // ==========================================
    // ADVISOR INTELLIGENCE DESK
    // ==========================================
    async getAdvisorOverview() {
        if (isSupabaseConfigured()) {
            const supabase = getSupabaseClient();
            const { count: totalClients } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'client');
            const { count: totalPlans } = await supabase.from('plans').select('*', { count: 'exact', head: true });
            const { count: totalGoals } = await supabase.from('milestone_goals').select('*', { count: 'exact', head: true });

            const { data: activePlans } = await supabase
                .from('plans')
                .select('current_age, retirement_age, initial_sip, initial_corpus, initial_equity_pct')
                .eq('is_active', 1);

            let avgCurrentAge = 40, avgRetirementAge = 60, avgSIP = 0, avgCorpus = 0, avgEquityPct = 80;
            if (activePlans && activePlans.length > 0) {
                const n = activePlans.length;
                avgCurrentAge = +(activePlans.reduce((s, p) => s + (p.current_age || 0), 0) / n).toFixed(1);
                avgRetirementAge = +(activePlans.reduce((s, p) => s + (p.retirement_age || 0), 0) / n).toFixed(1);
                avgSIP = Math.round(activePlans.reduce((s, p) => s + (p.initial_sip || 0), 0) / n);
                avgCorpus = Math.round(activePlans.reduce((s, p) => s + (p.initial_corpus || 0), 0) / n);
                avgEquityPct = +(activePlans.reduce((s, p) => s + (p.initial_equity_pct || 0), 0) / n).toFixed(1);
            }

            const { data: allGoals } = await supabase.from('milestone_goals').select('goal_type');
            const goalsMap = {};
            (allGoals || []).forEach(g => {
                const t = g.goal_type || 'lumpsum';
                goalsMap[t] = (goalsMap[t] || 0) + 1;
            });
            const goalsByType = Object.keys(goalsMap).map(k => ({ goal_type: k, count: goalsMap[k] }));

            const { data: allSnaps } = await supabase.from('plan_snapshots').select('freedom_status');
            const statusMap = {};
            (allSnaps || []).forEach(s => {
                const st = s.freedom_status || 'Calculated';
                statusMap[st] = (statusMap[st] || 0) + 1;
            });
            const freedomStatus = Object.keys(statusMap).map(k => ({ freedom_status: k, count: statusMap[k] }));

            return {
                metrics: {
                    totalClients: totalClients || 0,
                    totalPlans: totalPlans || 0,
                    totalGoals: totalGoals || 0,
                    avgCurrentAge,
                    avgRetirementAge,
                    avgSIP,
                    avgCorpus,
                    avgEquityPct
                },
                goalsByType,
                freedomStatus
            };
        }

        const db = getSqlite();
        const totalClients = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'client'").get().count;
        const totalPlans = db.prepare("SELECT COUNT(*) as count FROM plans").get().count;
        const totalGoals = db.prepare("SELECT COUNT(*) as count FROM milestone_goals").get().count;

        const avgStats = db.prepare(`
            SELECT 
                ROUND(AVG(current_age), 1) as avgCurrentAge,
                ROUND(AVG(retirement_age), 1) as avgRetirementAge,
                ROUND(AVG(initial_sip), 0) as avgSIP,
                ROUND(AVG(initial_corpus), 0) as avgCorpus,
                ROUND(AVG(initial_equity_pct), 1) as avgEquityPct
            FROM plans
            WHERE is_active = 1
        `).get();

        const goalsByType = db.prepare(`
            SELECT goal_type, COUNT(*) as count
            FROM milestone_goals
            GROUP BY goal_type
        `).all();

        const freedomStatus = db.prepare(`
            SELECT freedom_status, COUNT(*) as count
            FROM plan_snapshots
            GROUP BY freedom_status
        `).all();

        return {
            metrics: {
                totalClients,
                totalPlans,
                totalGoals,
                avgCurrentAge: avgStats.avgCurrentAge || 40,
                avgRetirementAge: avgStats.avgRetirementAge || 60,
                avgSIP: avgStats.avgSIP || 0,
                avgCorpus: avgStats.avgCorpus || 0,
                avgEquityPct: avgStats.avgEquityPct || 80
            },
            goalsByType,
            freedomStatus
        };
    },

    async getAdvisorClients() {
        if (isSupabaseConfigured()) {
            const supabase = getSupabaseClient();
            const { data: users } = await supabase
                .from('users')
                .select('id, name, phone, created_at, last_login_at')
                .eq('role', 'client')
                .order('last_login_at', { ascending: false });

            const { data: plans } = await supabase.from('plans').select('*');
            const { data: snapshots } = await supabase.from('plan_snapshots').select('*');
            const { data: milestones } = await supabase.from('milestone_goals').select('id, plan_id');

            const clientList = (users || []).map(u => {
                const userPlans = (plans || []).filter(p => p.user_id === u.id);
                const activePlan = userPlans.find(p => p.is_active === 1) || userPlans[0] || null;
                const snap = activePlan ? (snapshots || []).find(s => s.plan_id === activePlan.id) : null;
                const goalCount = activePlan ? (milestones || []).filter(m => m.plan_id === activePlan.id).length : 0;

                return {
                    userId: u.id,
                    clientName: u.name,
                    clientPhone: u.phone,
                    registeredAt: u.created_at,
                    lastActiveAt: u.last_login_at,
                    activePlanId: activePlan ? activePlan.id : null,
                    planName: activePlan ? activePlan.plan_name : 'No Plan',
                    currentAge: activePlan ? activePlan.current_age : null,
                    retirementAge: activePlan ? activePlan.retirement_age : null,
                    monthlyExpense: activePlan ? activePlan.current_expense : null,
                    initialCorpus: activePlan ? activePlan.initial_corpus : null,
                    initialSIP: activePlan ? activePlan.initial_sip : null,
                    initialEquityPct: activePlan ? activePlan.initial_equity_pct : null,
                    glideStartMonths: activePlan ? activePlan.glide_start_months : null,
                    glideEndMonths: activePlan ? activePlan.glide_end_months : null,
                    planUpdatedAt: activePlan ? activePlan.updated_at : null,
                    targetCorpusAtRet: snap ? snap.target_corpus_at_ret : null,
                    monthlyPensionNeeded: snap ? snap.monthly_pension_needed : null,
                    freedomStatus: snap ? snap.freedom_status : null,
                    exhaustionAge: snap ? snap.exhaustion_age : null,
                    totalPlansCount: userPlans.length,
                    milestoneGoalsCount: goalCount
                };
            });

            return clientList;
        }

        const db = getSqlite();
        return db.prepare(`
            SELECT 
                u.id as userId,
                u.name as clientName,
                u.phone as clientPhone,
                u.created_at as registeredAt,
                u.last_login_at as lastActiveAt,
                p.id as activePlanId,
                p.plan_name as planName,
                p.current_age as currentAge,
                p.retirement_age as retirementAge,
                p.current_expense as monthlyExpense,
                p.initial_corpus as initialCorpus,
                p.initial_sip as initialSIP,
                p.initial_equity_pct as initialEquityPct,
                p.glide_start_months as glideStartMonths,
                p.glide_end_months as glideEndMonths,
                p.updated_at as planUpdatedAt,
                s.target_corpus_at_ret as targetCorpusAtRet,
                s.monthly_pension_needed as monthlyPensionNeeded,
                s.freedom_status as freedomStatus,
                s.exhaustion_age as exhaustionAge,
                (SELECT COUNT(*) FROM plans WHERE user_id = u.id) as totalPlansCount,
                (SELECT COUNT(*) FROM milestone_goals WHERE plan_id = p.id) as milestoneGoalsCount
            FROM users u
            LEFT JOIN plans p ON u.id = p.user_id AND p.is_active = 1
            LEFT JOIN plan_snapshots s ON p.id = s.plan_id
            WHERE u.role = 'client'
            ORDER BY u.last_login_at DESC, u.created_at DESC
        `).all();
    },

    async getAdvisorPlanInspection(planId) {
        if (isSupabaseConfigured()) {
            const supabase = getSupabaseClient();
            const { data: plan, error } = await supabase.from('plans').select('*').eq('id', planId).maybeSingle();
            if (error) throw new Error(error.message);
            if (!plan) return null;

            const { data: user } = await supabase.from('users').select('name, phone').eq('id', plan.user_id).maybeSingle();
            plan.client_name = user ? user.name : 'Client';
            plan.client_phone = user ? user.phone : '';

            const { data: milestones } = await supabase
                .from('milestone_goals')
                .select('*')
                .eq('plan_id', plan.id)
                .order('sort_order', { ascending: true })
                .order('target_age', { ascending: true });

            const { data: snapshot } = await supabase
                .from('plan_snapshots')
                .select('*')
                .eq('plan_id', plan.id)
                .maybeSingle();

            return {
                plan: normalizePlanRecord(plan),
                milestones: normalizeMilestones(milestones || []),
                snapshot: snapshot || null
            };
        }

        const db = getSqlite();
        const plan = db.prepare(`
            SELECT p.*, u.name as client_name, u.phone as client_phone
            FROM plans p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ?
        `).get(planId);

        if (!plan) return null;

        const milestones = db.prepare(`
            SELECT * FROM milestone_goals
            WHERE plan_id = ?
            ORDER BY sort_order ASC, target_age ASC
        `).all(plan.id);

        const snapshot = db.prepare(`
            SELECT * FROM plan_snapshots
            WHERE plan_id = ?
        `).get(plan.id);

        return {
            plan: normalizePlanRecord(plan),
            milestones: normalizeMilestones(milestones || []),
            snapshot: snapshot || null
        };
    }
};

module.exports = dbService;
