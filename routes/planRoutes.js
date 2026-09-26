const express = require('express');
const router = express.Router();
const dbService = require('../db/dbService');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

// 1. GET ALL PLANS FOR CURRENT USER
router.get('/', async (req, res) => {
    try {
        const plans = await dbService.getPlansByUserId(req.user.id);
        return res.json({ plans });
    } catch (err) {
        console.error('Fetch plans error:', err);
        return res.status(500).json({ error: 'Failed to fetch plans: ' + err.message });
    }
});

// 2. GET CURRENT ACTIVE PLAN WITH MILESTONES & SNAPSHOT
router.get('/active', async (req, res) => {
    try {
        const result = await dbService.getActivePlan(req.user.id);
        if (!result || !result.plan) {
            return res.status(404).json({ error: 'No plan found for this account.' });
        }
        return res.json(result);
    } catch (err) {
        console.error('Fetch active plan error:', err);
        return res.status(500).json({ error: 'Failed to load active plan: ' + err.message });
    }
});

// 3. GET SPECIFIC PLAN BY ID
router.get('/:id', async (req, res) => {
    try {
        const result = await dbService.getPlanById(req.params.id, req.user.id);
        if (!result || !result.plan) {
            return res.status(404).json({ error: 'Plan not found.' });
        }
        return res.json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 4. CREATE A NEW NAMED PLAN
router.post('/new', async (req, res) => {
    try {
        const { plan_name, clone_from_id } = req.body;
        const result = await dbService.createPlan(req.user.id, plan_name, clone_from_id);

        return res.status(201).json({
            message: `Created plan "${result.planName}"!`,
            planId: result.planId,
            planName: result.planName
        });
    } catch (err) {
        console.error('Create plan error:', err);
        return res.status(500).json({ error: 'Failed to create plan: ' + err.message });
    }
});

// 5. SAVE / AUTO-SAVE PLAN (WITH ATOMIC MILESTONES & SNAPSHOT)
router.put('/:id', async (req, res) => {
    try {
        const planId = req.params.id;
        const { plan, milestones, snapshot } = req.body;

        const result = await dbService.savePlan(planId, req.user.id, plan, milestones, snapshot);
        if (!result) {
            return res.status(404).json({ error: 'Plan not found or unauthorized.' });
        }

        return res.json({
            success: true,
            message: 'Plan saved successfully.',
            updatedAt: result.updatedAt
        });
    } catch (err) {
        console.error('Save plan error:', err);
        return res.status(500).json({ error: 'Failed to save plan: ' + err.message });
    }
});

// 6. ACTIVATE A PLAN
router.put('/:id/activate', async (req, res) => {
    try {
        const planId = req.params.id;
        const success = await dbService.activatePlan(planId, req.user.id);
        if (!success) {
            return res.status(404).json({ error: 'Plan not found.' });
        }

        return res.json({ success: true, activePlanId: planId });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 7. RENAME A PLAN
router.put('/:id/rename', async (req, res) => {
    try {
        const planId = req.params.id;
        const { plan_name } = req.body;
        if (!plan_name || !plan_name.trim()) {
            return res.status(400).json({ error: 'Plan name is required.' });
        }
        await dbService.renamePlan(planId, req.user.id, plan_name.trim());
        return res.json({ success: true, planName: plan_name.trim() });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to rename plan: ' + err.message });
    }
});

// 8. DELETE A PLAN (must keep at least 1)
router.delete('/:id', async (req, res) => {
    try {
        const planId = req.params.id;
        await dbService.deletePlan(planId, req.user.id);
        return res.json({ success: true, message: 'Plan deleted.' });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

module.exports = router;
