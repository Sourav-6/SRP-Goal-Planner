const http = require('http');

async function runTests() {
    // Start server on test port
    process.env.PORT = 8089;
    const server = require('../server.js');

    // Helper fetch wrapper
    async function request(path, method = 'GET', body = null, token = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`http://localhost:8089${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });
        const data = await res.json();
        return { status: res.status, data };
    }

    // Wait a brief moment for server to bind
    await new Promise(r => setTimeout(r, 600));

    console.log('--- TEST 1: Health Check (Express) ---');
    const health = await request('/api/health');
    console.log('Health:', health.status, health.data);
    if (health.status !== 200) throw new Error('Health check failed');

    console.log('\n--- TEST 2: Client Registration ---');
    const regPhone = '9' + Math.floor(100000000 + Math.random() * 900000000);
    const regRes = await request('/api/auth/register', 'POST', {
        name: 'Arjun Mehta',
        phone: regPhone,
        pin: '4321'
    });
    console.log('Register status:', regRes.status, regRes.data.message || regRes.data.error);
    if (regRes.status !== 201) throw new Error('Client registration failed');
    const clientToken = regRes.data.token;

    console.log('\n--- TEST 3: Client Login ---');
    const loginRes = await request('/api/auth/login', 'POST', {
        phone: regPhone,
        pin: '4321'
    });
    console.log('Login status:', loginRes.status, loginRes.data.user);
    if (loginRes.status !== 200) throw new Error('Client login failed');

    console.log('\n--- TEST 4: Fetch Active Plan ---');
    const planRes = await request('/api/plans/active', 'GET', null, clientToken);
    console.log('Plan fetched:', planRes.data.plan.plan_name, 'ID:', planRes.data.plan.id);
    const activePlanId = planRes.data.plan.id;

    console.log('\n--- TEST 5: Auto-Save Plan with Milestone Goals ---');
    const saveRes = await request(`/api/plans/${activePlanId}`, 'PUT', {
        plan: {
            plan_name: 'Arjun Retirement & Overseas Education',
            current_age: 36,
            retirement_age: 58,
            initial_corpus: 1800000,
            initial_sip: 35000,
            initial_equity_pct: 75,
            glide_start_months: 108,
            glide_end_months: 12
        },
        milestones: [
            { name: 'Son College Abroad', age: 48, pv: 4000000, inf: 8, type: 'lumpsum' },
            { name: 'Family Holiday Home', age: 52, pv: 3000000, inf: 6, type: 'lumpsum' }
        ],
        snapshot: {
            target_corpus_at_ret: 85000000,
            monthly_pension_needed: 165000,
            freedom_status: 'Fully Funded (Age 100+)',
            exhaustion_age: 100,
            total_sip_invested: 32000000
        }
    }, clientToken);
    console.log('Save response:', saveRes.data);
    if (!saveRes.data.success) throw new Error('Plan save failed');

    console.log('\n--- TEST 6: Create Second Named Plan ---');
    const newPlanRes = await request('/api/plans/new', 'POST', {
        plan_name: 'Conservative Early Exit @ 50',
        clone_from_id: activePlanId
    }, clientToken);
    console.log('Created plan 2:', newPlanRes.data);

    const allPlansRes = await request('/api/plans', 'GET', null, clientToken);
    console.log('Client all plans count:', allPlansRes.data.plans.length);
    if (allPlansRes.data.plans.length !== 2) throw new Error('Expected 2 plans');

    console.log('\n--- TEST 7: Advisor Login ---');
    const advLogin = await request('/api/auth/login', 'POST', {
        phone: '9999999999',
        pin: '7777'
    });
    console.log('Advisor login:', advLogin.status, advLogin.data.user);
    if (advLogin.status !== 200 || advLogin.data.user.role !== 'advisor') throw new Error('Advisor login failed');
    const advToken = advLogin.data.token;

    console.log('\n--- TEST 8: Advisor Intelligence Overview ---');
    const overviewRes = await request('/api/advisor/overview', 'GET', null, advToken);
    console.log('Advisor overview metrics:', overviewRes.data.metrics);
    console.log('Goals by type:', overviewRes.data.goalsByType);

    console.log('\n--- TEST 9: Advisor Client Roster ---');
    const clientsRes = await request('/api/advisor/clients', 'GET', null, advToken);
    console.log(`Found ${clientsRes.data.clients.length} registered clients:`);
    clientsRes.data.clients.forEach(c => {
        console.log(` - ${c.clientName} (${c.clientPhone}): Age ${c.currentAge}->${c.retirementAge} | SIP: ₹${c.initialSIP} | Goals: ${c.milestoneGoalsCount} | Status: ${c.freedomStatus}`);
    });

    console.log('\n--- TEST 10: Direct Netlify Serverless Handler Emulation ---');
    const { handler } = require('../netlify/functions/api.js');
    const netlifyRes = await handler({
        httpMethod: 'GET',
        path: '/.netlify/functions/api/health',
        headers: {}
    }, {});
    console.log('Netlify handler status:', netlifyRes.statusCode);
    const parsedBody = JSON.parse(netlifyRes.body);
    console.log('Netlify handler body:', parsedBody);
    if (netlifyRes.statusCode !== 200 || parsedBody.status !== 'ok') {
        throw new Error('Netlify serverless handler execution failed');
    }

    console.log('\n✔ ALL 10 TESTS (LOCAL SERVER + NETLIFY FUNCTION HANDLER) PASSED PERFECTLY!\n');
    server.close();
    process.exit(0);
}

runTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
