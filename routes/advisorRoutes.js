const express = require('express');
const router = express.Router();
const dbService = require('../db/dbService');
const { authenticateToken, requireAdvisor } = require('../middleware/authMiddleware');

router.use(authenticateToken);
router.use(requireAdvisor);

// 1. ADVISOR OVERVIEW / INTELLIGENCE ANALYTICS
router.get('/overview', async (req, res) => {
    try {
        const overview = await dbService.getAdvisorOverview();
        return res.json(overview);
    } catch (err) {
        console.error('Advisor overview error:', err);
        return res.status(500).json({ error: 'Failed to load intelligence metrics: ' + err.message });
    }
});

// 2. CLIENT ROSTER WITH ACTIVE PLAN AND GOALS
router.get('/clients', async (req, res) => {
    try {
        const clients = await dbService.getAdvisorClients();
        return res.json({ clients });
    } catch (err) {
        console.error('Advisor clients error:', err);
        return res.status(500).json({ error: 'Failed to load clients: ' + err.message });
    }
});

// 3. INSPECT A SPECIFIC CLIENT'S FULL PLAN
router.get('/plans/:planId', async (req, res) => {
    try {
        const result = await dbService.getAdvisorPlanInspection(req.params.planId);
        if (!result || !result.plan) {
            return res.status(404).json({ error: 'Plan not found.' });
        }

        return res.json(result);
    } catch (err) {
        console.error('Advisor plan inspection error:', err);
        return res.status(500).json({ error: 'Failed to inspect plan: ' + err.message });
    }
});

module.exports = router;
