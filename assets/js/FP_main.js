/**
 * SRP Prime Wealth — Financial Freedom (Goal Planning) PWA
 * Highly Interactive Smartphone Experience
 */

function fmtINR_plain(val) {
    if (isNaN(val) || val === Infinity || val === -Infinity) return "₹0";
    let sym = val < 0 ? "-₹" : "₹";
    val = Math.abs(Math.round(val));
    return sym + val.toLocaleString('en-IN');
}

/**
 * Formats large amounts into readable Indian Lakhs / Crores
 */
function formatIndianCurrency(val) {
    if (isNaN(val) || val === Infinity || val === -Infinity) return "₹0";
    const absVal = Math.abs(Math.round(val));
    const prefix = val < 0 ? "-₹ " : "₹ ";
    
    if (absVal >= 10000000) {
        return prefix + (absVal / 10000000).toFixed(2) + " Cr";
    } else if (absVal >= 100000) {
        return prefix + (absVal / 100000).toFixed(2) + " Lakh";
    } else if (absVal >= 1000) {
        return prefix + absVal.toLocaleString('en-IN');
    }
    return prefix + absVal;
}

/**
 * Formats display value for stepper text
 */
function formatDisplayValue(id, val) {
    val = parseFloat(val) || 0;
    if (val === 0 && window.fpAuth && window.fpAuth.isFirstTime) {
        return "";
    }
    switch (id) {
        case 'inp-age':
        case 'inp-ret-age':
        case 'inp-exhaustion-expected':
            return val > 0 ? Math.round(val) + " Yrs" : (window.fpAuth && window.fpAuth.isFirstTime ? "" : "0 Yrs");
        case 'inp-pension-delay':
            return Math.round(val) + (val === 1 ? " Yr" : " Yrs");
        case 'inp-initial-corpus':
            return val > 0 ? formatIndianCurrency(val) : (window.fpAuth && window.fpAuth.isFirstTime ? "" : "₹ 0");
        case 'inp-initial-sip':
            return val > 0 ? formatIndianCurrency(val) + " / mo" : (window.fpAuth && window.fpAuth.isFirstTime ? "" : "₹ 0 / mo");
        case 'inp-stepup':
            return val.toFixed(1) + "% / yr";
        case 'inp-pre-irr':
        case 'inp-post-irr':
        case 'inp-inflation':
            return val.toFixed(1) + "% p.a.";
        case 'inp-init-equity':
            return Math.round(val) + "% Eq (" + (100 - Math.round(val)) + "% Dt)";
        case 'inp-glide-start':
            return Math.round(val) + " Mos (" + (val / 12).toFixed(1) + " Yrs)";
        case 'inp-glide-end':
            return Math.round(val) + " Mos (" + (val / 12).toFixed(1) + " Yrs)";
        case 'inp-expense':
            return val > 0 ? formatIndianCurrency(val) + " / mo" : (window.fpAuth && window.fpAuth.isFirstTime ? "" : "₹ 0 / mo");
        default:
            return val > 0 ? val.toString() : (window.fpAuth && window.fpAuth.isFirstTime ? "" : "0");
    }
}

/**
 * Direct Keyboard Typing Handler for .fp-stepper-input fields
 */
window.handleDirectTyping = function handleDirectTyping(inputId, rawVal) {
    const numInput = document.getElementById(inputId);
    if (!numInput) return;

    let cleaned = (rawVal || '').toString().trim().toLowerCase();
    cleaned = cleaned.replace(/₹/g, '').replace(/,/g, '').replace(/\s+/g, '');

    let multiplier = 1;
    if (cleaned.endsWith('cr') || cleaned.endsWith('crore') || cleaned.endsWith('crores')) {
        multiplier = 10000000;
        cleaned = cleaned.replace(/crores?|cr/g, '');
    } else if (cleaned.endsWith('l') || cleaned.endsWith('lakh') || cleaned.endsWith('lakhs')) {
        multiplier = 100000;
        cleaned = cleaned.replace(/lakhs?|l/g, '');
    } else if (cleaned.endsWith('k')) {
        multiplier = 1000;
        cleaned = cleaned.replace(/k/g, '');
    } else {
        cleaned = cleaned.replace(/[^0-9.]/g, '');
    }

    let val = parseFloat(cleaned);
    if (isNaN(val)) val = 0;
    val = val * multiplier;

    if (val < 0) val = 0;
    numInput.value = val;

    const sliderId = inputId.replace('inp-', 'slide-');
    const slider = document.getElementById(sliderId);
    if (slider) {
        slider.value = Math.max(parseFloat(slider.min) || 0, Math.min(parseFloat(slider.max) || 100, val));
        updateSliderVisual(slider);
    }

    const groupEl = numInput.closest('.fp-control-group');
    if (groupEl) {
        const chips = groupEl.querySelectorAll('.fp-chip');
        chips.forEach(chip => {
            const chipMatch = chip.getAttribute('onclick')?.includes(val.toString());
            if (chipMatch) chip.classList.add('active');
            else chip.classList.remove('active');
        });
    }

    if (!window.fpAuth.isFirstTime) {
        window.updateLiveFreedomSnapshot();
        updateGlideSummaryBanner();
    }
    if (typeof window.triggerDebouncedAutoSave === 'function') {
        window.triggerDebouncedAutoSave();
    }
};

/**
 * Format stepper display input on blur
 */
window.formatControlDisplay = function formatControlDisplay(inputId) {
    const numInput = document.getElementById(inputId);
    const dispId = inputId.replace('inp-', 'disp-');
    const disp = document.getElementById(dispId);
    if (!numInput || !disp) return;

    let val = parseFloat(numInput.value) || 0;
    if (numInput.min !== "") val = Math.max(parseFloat(numInput.min), val);
    if (numInput.max !== "") val = Math.min(parseFloat(numInput.max), val);
    numInput.value = val;

    const formatted = formatDisplayValue(inputId, val);
    if (disp.tagName === 'INPUT') {
        disp.value = formatted;
    } else {
        disp.innerText = formatted;
    }

    if (!window.fpAuth.isFirstTime) {
        window.updateLiveFreedomSnapshot();
    }
};

// ==========================================================================
// GLIDE PATH & ASSET ALLOCATION ENGINE
// ==========================================================================
function calcGlideAllocation(monthsLeft, initEquity = 80, startM = 108, endM = 12) {
    initEquity = Math.min(100, Math.max(0, parseFloat(initEquity) || 80));
    startM = Math.max(1, parseInt(startM) || 108);
    endM = Math.max(0, parseInt(endM) || 12);
    if (endM >= startM) endM = Math.max(0, startM - 1);

    if (monthsLeft >= startM) {
        return { equityPct: initEquity, debtPct: 100 - initEquity };
    }
    if (monthsLeft <= endM) {
        return { equityPct: 0, debtPct: 100 };
    }
    const progress = (monthsLeft - endM) / (startM - endM);
    const equityPct = Math.round(initEquity * progress * 10) / 10;
    const debtPct = Math.round((100 - equityPct) * 10) / 10;
    return { equityPct, debtPct };
}

function calcMilestoneMetrics(pv, inflation, yearsHorizon, initEquity, startM, endM, eqRate, debtRate) {
    pv = Math.max(0, parseFloat(pv) || 0);
    inflation = parseFloat(inflation) || 0;
    yearsHorizon = Math.max(1, parseInt(yearsHorizon) || 1);
    const monthsHorizon = yearsHorizon * 12;
    const fv = pv * Math.pow(1 + inflation, yearsHorizon);

    let sipAccumulator = 0;
    let lumpsumFactor = 1;

    for (let t = 0; t < monthsHorizon; t++) {
        const mLeft = monthsHorizon - t;
        const alloc = calcGlideAllocation(mLeft, initEquity, startM, endM);
        const rAnnual = (alloc.equityPct / 100) * eqRate + (alloc.debtPct / 100) * debtRate;
        const mRate = Math.pow(1 + rAnnual, 1 / 12) - 1;

        sipAccumulator = (sipAccumulator + 1) * (1 + mRate);
        lumpsumFactor = lumpsumFactor * (1 + mRate);
    }

    const reqSIP = sipAccumulator > 0 ? (fv / sipAccumulator) : (fv / monthsHorizon);
    const reqLumpsum = lumpsumFactor > 0 ? (fv / lumpsumFactor) : fv;
    const currentAlloc = calcGlideAllocation(monthsHorizon, initEquity, startM, endM);

    return {
        fv,
        reqSIP,
        reqLumpsum,
        currentEquityPct: currentAlloc.equityPct,
        currentDebtPct: currentAlloc.debtPct,
        monthsHorizon
    };
}

function updateGlideSummaryBanner() {
    const desc = document.getElementById('glide-banner-desc');
    if (!desc) return;
    const initEq = parseFloat(document.getElementById('inp-init-equity')?.value) || 80;
    const startM = parseInt(document.getElementById('inp-glide-start')?.value) || 108;
    const endM = parseInt(document.getElementById('inp-glide-end')?.value) || 12;
    desc.innerHTML = `<strong>Smart Glide Path Active:</strong> Initial allocation at <strong>${initEq}% Equity / ${100 - initEq}% Debt</strong>. Starts systematic de-risking <strong>${startM} months (${(startM / 12).toFixed(1)} Yrs)</strong> before target, reaching <strong>100% Debt</strong> by <strong>${endM} months (${(endM / 12).toFixed(1)} Yr)</strong> before target.`;
}

window.updateAllEventRowSummaries = function() {
    const rows = document.querySelectorAll('.event-row');
    if (!rows.length) return;
    const currentYear = new Date().getFullYear();
    const initEq = parseFloat(document.getElementById('inp-init-equity')?.value) || 80;
    const startM = parseInt(document.getElementById('inp-glide-start')?.value) || 108;
    const endM = parseInt(document.getElementById('inp-glide-end')?.value) || 12;
    const eqRate = (parseFloat(document.getElementById('inp-pre-irr')?.value) || 13.5) / 100;
    const debtRate = (parseFloat(document.getElementById('inp-post-irr')?.value) || 8.0) / 100;

    rows.forEach(row => {
        const targetYear = parseInt(row.querySelector('.ev-age')?.value) || (currentYear + 5);
        const pv = parseFloat(row.querySelector('.ev-pv')?.value) || 0;
        const inf = (parseFloat(row.querySelector('.ev-inf')?.value) || 0) / 100;
        const yearsHorizon = Math.max(1, targetYear - currentYear);
        const metrics = calcMilestoneMetrics(pv, inf, yearsHorizon, initEq, startM, endM, eqRate, debtRate);

        const fvEl = row.querySelector('.ev-fv-val');
        const sipEl = row.querySelector('.ev-sip-val');
        const mixEl = row.querySelector('.ev-mix-val');
        if (fvEl) fvEl.innerText = formatIndianCurrency(metrics.fv);
        if (sipEl) sipEl.innerText = fmtINR_plain(metrics.reqSIP) + " / mo";
        if (mixEl) mixEl.innerText = `${metrics.currentEquityPct.toFixed(0)}% Eq / ${metrics.currentDebtPct.toFixed(0)}% Dt`;
    });
};

// ==========================================================================
// REAL-TIME RETIREMENT SNAPSHOT ENGINE
// ==========================================================================
window.fpRetirementEnabled = true;

window.renderUncalculatedHeroState = function renderUncalculatedHeroState() {
    const retCorpusEl = document.getElementById('kpi-ret-corpus');
    if (retCorpusEl) retCorpusEl.innerText = '₹ --';

    const pensionEl = document.getElementById('kpi-monthly-pension');
    if (pensionEl) pensionEl.innerText = '₹ -- / mo';

    const totalInvestedEl = document.getElementById('kpi-total-invested');
    if (totalInvestedEl) totalInvestedEl.innerText = '₹ --';

    const yearsLeftEl = document.getElementById('kpi-years-left');
    if (yearsLeftEl) yearsLeftEl.innerText = '-- Yrs';

    const statusEl = document.getElementById('kpi-freedom-status');
    if (statusEl) {
        statusEl.className = 'kpi-freedom-badge badge-warning';
        statusEl.innerText = 'Awaiting Initial Submission';
    }

    const progressBar = document.getElementById('kpi-timeline-bar');
    if (progressBar) progressBar.style.width = '0%';

    const barStart = document.getElementById('kpi-bar-start');
    if (barStart) barStart.innerText = 'Enter Age';

    const barMid = document.getElementById('kpi-bar-mid');
    if (barMid) barMid.innerText = 'Retire @ --';

    const barEnd = document.getElementById('kpi-bar-end');
    if (barEnd) barEnd.innerText = 'Freedom: --';
};

window.toggleRetirementPlan = function toggleRetirementPlan(enabled) {
    window.fpRetirementEnabled = !!enabled;
    window.applyRetirementToggleUI(window.fpRetirementEnabled, true);
};

window.applyRetirementToggleUI = function applyRetirementToggleUI(enabled, triggerSave = true) {
    const retControls = document.getElementById('ret-planning-controls');
    const groupRetAge = document.getElementById('group-ret-age');
    const disabledBadge = document.getElementById('ret-age-disabled-badge');

    if (enabled) {
        if (retControls) retControls.classList.remove('fp-control-dimmed');
        if (groupRetAge) groupRetAge.classList.remove('fp-control-dimmed');
        if (disabledBadge) disabledBadge.style.display = 'none';
    } else {
        if (retControls) retControls.classList.add('fp-control-dimmed');
        if (groupRetAge) groupRetAge.classList.add('fp-control-dimmed');
        if (disabledBadge) disabledBadge.style.display = 'inline-block';
    }

    if (!window.fpAuth.isFirstTime) {
        window.updateLiveFreedomSnapshot();
    }

    if (triggerSave && typeof window.triggerDebouncedAutoSave === 'function') {
        window.triggerDebouncedAutoSave();
    }
};

window.updateLiveFreedomSnapshot = function updateLiveFreedomSnapshot() {
    if (window.fpAuth && window.fpAuth.isFirstTime) {
        window.renderUncalculatedHeroState();
        return;
    }

    const age = parseInt(document.getElementById('inp-age')?.value) || 0;
    const retAge = parseInt(document.getElementById('inp-ret-age')?.value) || 60;
    const initialCorpus = parseFloat(document.getElementById('inp-initial-corpus')?.value) || 0;
    const initialSIP = parseFloat(document.getElementById('inp-initial-sip')?.value) || 0;
    const stepUp = (parseFloat(document.getElementById('inp-stepup')?.value) || 0) / 100;
    const preIRR = (parseFloat(document.getElementById('inp-pre-irr')?.value) || 13.5) / 100;
    const postIRR = (parseFloat(document.getElementById('inp-post-irr')?.value) || 8) / 100;
    const retExpToday = parseFloat(document.getElementById('inp-expense')?.value) || 0;
    const inflation = (parseFloat(document.getElementById('inp-inflation')?.value) || 0) / 100;
    const pensionDelay = parseInt(document.getElementById('inp-pension-delay')?.value) || 0;
    const initEq = parseFloat(document.getElementById('inp-init-equity')?.value) || 80;
    const startM = parseInt(document.getElementById('inp-glide-start')?.value) || 108;
    const endM = parseInt(document.getElementById('inp-glide-end')?.value) || 12;
    const isRetOff = !window.fpRetirementEnabled;
    
    // Quick years remaining
    const effectiveRetAge = isRetOff ? Math.max(age + 20, 60) : retAge;
    const yearsLeft = isRetOff ? 'Goals Focus' : Math.max(0, retAge - age) + ' Yrs';
    const yearsLeftEl = document.getElementById('kpi-years-left');
    if (yearsLeftEl) yearsLeftEl.innerText = yearsLeft;

    // Fast simulation loop
    let corpus = initialCorpus;
    let totalInvested = initialCorpus;
    let corpusAtRetirement = 0;
    let exhaustionAge = null;
    const mPostRate = Math.pow(1 + postIRR, 1 / 12) - 1;
    const simStartAge = age > 0 ? age : 30;
    const totalRetMonths = Math.max(0, (effectiveRetAge - simStartAge) * 12);

    for (let a = simStartAge; a <= 100; a++) {
        let monthlySIP = 0;
        let monthlySWP = 0;

        if (a <= effectiveRetAge) {
            monthlySIP = initialSIP * Math.pow(1 + stepUp, a - simStartAge);
            totalInvested += (monthlySIP * 12);
        }

        if (!isRetOff && a > retAge + pensionDelay && corpus > 0) {
            monthlySWP = retExpToday * Math.pow(1 + inflation, a - simStartAge);
        }

        for (let m = 0; m < 12; m++) {
            let monthsElapsed = (a - simStartAge) * 12 + m;
            let monthsLeftToRet = totalRetMonths - monthsElapsed;
            let mRate;

            if (a < effectiveRetAge && monthsLeftToRet > 0) {
                let alloc = calcGlideAllocation(monthsLeftToRet, initEq, startM, endM);
                let rAnnual = (alloc.equityPct / 100) * preIRR + (alloc.debtPct / 100) * postIRR;
                mRate = Math.pow(1 + rAnnual, 1 / 12) - 1;
            } else {
                mRate = mPostRate; // Post-retirement conservative rate
            }

            if (corpus > 0 || monthlySIP > 0) {
                corpus = corpus + monthlySIP - monthlySWP;
                corpus = corpus + (corpus * mRate);
            } else {
                corpus = 0;
            }
        }

        if (a === effectiveRetAge) {
            corpusAtRetirement = corpus;
        }

        if (!isRetOff && corpus <= 0 && exhaustionAge === null && a > retAge) {
            exhaustionAge = a;
        }
    }

    // Monthly pension needed at retirement (in future money)
    const monthlyPensionAtRet = isRetOff ? 0 : (retExpToday * Math.pow(1 + inflation, retAge - simStartAge));

    // Update KPI UI
    const retCorpusEl = document.getElementById('kpi-ret-corpus');
    if (retCorpusEl) retCorpusEl.innerText = formatIndianCurrency(corpusAtRetirement);

    const pensionEl = document.getElementById('kpi-monthly-pension');
    if (pensionEl) {
        pensionEl.innerText = isRetOff ? "Goal Mode (Off)" : formatIndianCurrency(monthlyPensionAtRet) + " / mo";
    }

    const totalInvestedEl = document.getElementById('kpi-total-invested');
    if (totalInvestedEl) totalInvestedEl.innerText = formatIndianCurrency(totalInvested);

    // Status Badge
    const statusEl = document.getElementById('kpi-freedom-status');
    if (statusEl) {
        if (isRetOff) {
            statusEl.className = 'kpi-freedom-badge badge-success';
            statusEl.innerText = 'Goal Accumulation Mode';
        } else if (!exhaustionAge || exhaustionAge >= 100) {
            statusEl.className = 'kpi-freedom-badge badge-success';
            statusEl.innerText = 'Fully Funded (Age 100+)';
        } else if (exhaustionAge > retAge) {
            statusEl.className = 'kpi-freedom-badge badge-warning';
            statusEl.innerText = `Funded till Age ${exhaustionAge}`;
        } else {
            statusEl.className = 'kpi-freedom-badge badge-warning';
            statusEl.innerText = `Retirement Shortfall`;
        }
    }

    // Progress Bar
    const progressBar = document.getElementById('kpi-timeline-bar');
    if (progressBar) {
        if (isRetOff) {
            progressBar.style.width = '100%';
        } else {
            const totalSpan = Math.max(1, 100 - simStartAge);
            const workSpan = Math.max(0, retAge - simStartAge);
            const pct = Math.min(100, Math.max(10, Math.round((workSpan / totalSpan) * 100)));
            progressBar.style.width = pct + '%';
        }
    }

    const barStart = document.getElementById('kpi-bar-start');
    if (barStart) barStart.innerText = simStartAge > 0 ? `Age ${simStartAge} (Now)` : `Now`;

    const barMid = document.getElementById('kpi-bar-mid');
    if (barMid) barMid.innerText = isRetOff ? `Goal Focus` : `Retire @ ${retAge}`;

    const barEnd = document.getElementById('kpi-bar-end');
    if (barEnd) {
        if (isRetOff) {
            barEnd.innerText = `Accumulate: 100+`;
        } else {
            barEnd.innerText = exhaustionAge ? `Exhaust: ${exhaustionAge}` : `Freedom: 100+`;
        }
    }

    // Record snapshot KPIs for database persistence
    window.fpLastCalculatedSnapshot = {
        targetCorpusAtRet: corpusAtRetirement,
        monthlyPensionNeeded: monthlyPensionAtRet,
        freedomStatus: statusEl ? statusEl.innerText : 'Fully Funded',
        exhaustionAge: exhaustionAge || 100,
        totalInvested: totalInvested
    };
};

// ==========================================================================
// STEPPER ADJUSTMENT HANDLER (+ and - buttons)
// ==========================================================================
window.stepAdjust = function stepAdjust(id, delta) {
    const input = document.getElementById(id);
    if (!input) return;

    let val = parseFloat(input.value) || 0;
    const min = parseFloat(input.min) !== undefined ? parseFloat(input.min) : 0;
    const max = parseFloat(input.max) !== undefined ? parseFloat(input.max) : 100000000;
    
    val = Math.max(min, Math.min(max, val + delta));
    // Round to avoid floating point weirdness (e.g. 13.500000000001)
    if (delta.toString().includes('.')) {
        val = parseFloat(val.toFixed(1));
    }

    input.value = val;
    syncControlState(id, val);
};

// ==========================================================================
// CHIP PRESET SELECTOR HANDLER
// ==========================================================================
window.setControlVal = function setControlVal(id, val) {
    const input = document.getElementById(id);
    if (!input) return;

    input.value = val;
    syncControlState(id, val);
};

// ==========================================================================
// SYNC STATE (Slider, Number, Display, Chip highlight)
// ==========================================================================
function syncControlState(id, val) {
    // 1. Update Slider
    const sliderId = id.replace('inp-', 'slide-');
    const slider = document.getElementById(sliderId);
    if (slider) {
        slider.value = val;
        updateSliderVisual(slider);
    }

    // 2. Update Display Text
    const dispId = id.replace('inp-', 'disp-');
    const disp = document.getElementById(dispId);
    if (disp) {
        if (disp.tagName === 'INPUT') {
            disp.value = formatDisplayValue(id, val);
        } else {
            disp.innerText = formatDisplayValue(id, val);
        }
    }

    // 3. Update active preset chip
    const groupEl = document.getElementById(id)?.closest('.fp-control-group');
    if (groupEl) {
        const chips = groupEl.querySelectorAll('.fp-chip');
        chips.forEach(chip => {
            // Check if chip onclick matches
            const chipMatch = chip.getAttribute('onclick')?.includes(val.toString());
            if (chipMatch) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
    }

    // 4. Update Live KPI Snapshot, Glide Banner & Milestone Goals
    if (!window.fpAuth.isFirstTime) {
        window.updateLiveFreedomSnapshot();
    }
    updateGlideSummaryBanner();
    if (typeof window.renderMilestoneGoalCards === 'function') {
        window.renderMilestoneGoalCards();
    }

    // Trigger auto-save to cloud database
    if (!window.isPopulatingPlan && typeof window.triggerDebouncedAutoSave === 'function') {
        window.triggerDebouncedAutoSave();
    }

    // 5. If sticky button was on Download, reset it
    const stickyBtn = document.querySelector('.fp-btn-sticky');
    if (stickyBtn && stickyBtn.innerHTML.includes('Download')) {
        stickyBtn.innerHTML = 'View Detailed Cash Flow Projection &rarr;';
        stickyBtn.onclick = () => window.generateFreedomReport();
    }
}

function updateSliderVisual(slider) {
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const val = parseFloat(slider.value) || 0;
    if (max - min === 0) return;
    const pct = ((val - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(to right, #1d68bd 0%, #1d68bd ${pct}%, #e2e8f0 ${pct}%)`;
}

// ==========================================================================
// SEGMENTED TAB SCROLL NAVIGATION
// ==========================================================================
window.scrollToCard = function scrollToCard(cardId, btn) {
    const el = document.getElementById(cardId);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    document.querySelectorAll('.fp-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
};

// ==========================================================================
// RESET CALCULATOR TO DEFAULTS
// ==========================================================================
window.resetCalculatorDefaults = function resetCalculatorDefaults() {
    if (confirm("Reset all inputs to default settings?")) {
        window.setControlVal('inp-age', 40);
        window.setControlVal('inp-ret-age', 60);
        window.setControlVal('inp-initial-corpus', 1000000);
        window.setControlVal('inp-initial-sip', 50000);
        window.setControlVal('inp-stepup', 5);
        window.setControlVal('inp-pre-irr', 13.5);
        window.setControlVal('inp-post-irr', 8);
        window.setControlVal('inp-inflation', 7);
        window.setControlVal('inp-init-equity', 80);
        window.setControlVal('inp-glide-start', 108);
        window.setControlVal('inp-glide-end', 12);
        window.setControlVal('inp-expense', 40000);
        window.setControlVal('inp-pension-delay', 0);
        
        window.fpMilestones = [];
        window.renderMilestoneGoalCards();
        
        const retToggle = document.getElementById('toggle-retirement');
        if (retToggle) retToggle.checked = true;
        window.applyRetirementToggleUI(true, false);

        window.updateLiveFreedomSnapshot();
        updateGlideSummaryBanner();
        if (typeof window.triggerDebouncedAutoSave === 'function') {
            window.triggerDebouncedAutoSave();
        }
    }
};

// ==========================================================================
// USER SESSION / LEAD MANAGEMENT
// ==========================================================================
window.clearLeadData = function clearLeadData() {
    if (confirm("Switch user and enter new contact details?")) {
        localStorage.removeItem('fp_lead_unlocked');
        localStorage.removeItem('fp_lead_name');
        localStorage.removeItem('fp_lead_phone');
        window.location.reload();
    }
};

// ==========================================================================
// CLIENT AUTHENTICATION, DATABASE PERSISTENCE & ADVISOR ENGINE
// ==========================================================================
window.fpAuth = {
    token: localStorage.getItem('fp_token') || null,
    user: JSON.parse(localStorage.getItem('fp_user') || 'null'),
    activePlanId: null,
    activePlanName: 'Primary Plan',
    isAdvisorInspection: false
};

function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

window.fpApi = async function (path, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (window.fpAuth.token) {
        headers['Authorization'] = `Bearer ${window.fpAuth.token}`;
    }

    try {
        const res = await fetch(path, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });
        const data = await res.json();
        if (!res.ok) {
            if ((res.status === 401 || res.status === 403) && !path.includes('/auth/login')) {
                console.warn('Authentication expired or unauthorized.');
            }
            throw new Error(data.error || `Request failed with status ${res.status}`);
        }
        return data;
    } catch (err) {
        console.error(`API Error [${method} ${path}]:`, err.message);
        throw err;
    }
};

// AUTO-SAVE ENGINE (DEBOUNCED DATABASE SYNC)
let autoSaveTimer = null;
window.triggerDebouncedAutoSave = function () {
    if (!window.fpAuth.token || !window.fpAuth.activePlanId || window.fpAuth.isAdvisorInspection || window.isPopulatingPlan) {
        return;
    }

    const pill = document.getElementById('save-status-pill');
    const pillText = document.getElementById('save-status-text');
    if (pill) {
        pill.classList.add('syncing');
        if (pillText) pillText.innerText = 'Syncing...';
    }

    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
        try {
            const payload = collectPlanPayloadFromUI();
            await window.fpApi(`/api/plans/${window.fpAuth.activePlanId}`, 'PUT', payload);
            if (pill) {
                pill.classList.remove('syncing');
                if (pillText) pillText.innerText = 'Saved';
            }
        } catch (err) {
            console.warn('Auto-save sync error:', err.message);
            if (pill) {
                pill.classList.remove('syncing');
                if (pillText) pillText.innerText = 'Offline';
            }
        }
    }, 1100);
};

function collectPlanPayloadFromUI() {
    const gNum = (id, fallback = 0) => {
        const el = document.getElementById(id);
        return el ? (parseFloat(el.value) || fallback) : fallback;
    };
    const gInt = (id, fallback = 0) => {
        const el = document.getElementById(id);
        return el ? (parseInt(el.value) || fallback) : fallback;
    };

    const plan = {
        plan_name: window.fpAuth.activePlanName || 'My Life Plan',
        current_age: gInt('inp-age', 0),
        retirement_age: gInt('inp-ret-age', 0),
        life_expectancy: gInt('inp-exhaustion-expected', 100),
        current_expense: gNum('inp-expense', 0),
        initial_corpus: gNum('inp-initial-corpus', 0),
        initial_sip: gNum('inp-initial-sip', 0),
        sip_step_up: gNum('inp-stepup', 0),
        pre_ret_irr: gNum('inp-pre-irr', 13.5),
        post_ret_irr: gNum('inp-post-irr', 8.0),
        inflation_rate: gNum('inp-inflation', 6.5),
        initial_equity_pct: gNum('inp-init-equity', 80),
        glide_start_months: gInt('inp-glide-start', 108),
        glide_end_months: gInt('inp-glide-end', 12),
        pension_delay_yrs: gInt('inp-pension-delay', 0),
        solver_mode: document.getElementById('inp-solver-mode')?.value || 'custom',
        is_first_time: window.fpAuth.isFirstTime ? 1 : 0,
        retirement_enabled: window.fpRetirementEnabled ? 1 : 0
    };

    const milestones = (window.fpMilestones || []).map(m => ({
        id: m.id,
        name: m.name || 'Life Goal',
        age: m.target_age || 50,
        target_age: m.target_age || 50,
        target_year: m.target_year || (new Date().getFullYear() + 5),
        pv: m.present_value || 0,
        present_value: m.present_value || 0,
        active_amount: m.active_amount || 0,
        equity_pct: m.equity_pct !== undefined ? m.equity_pct : 70,
        debt_pct: m.debt_pct !== undefined ? m.debt_pct : 30,
        inf: m.inflation_rate !== undefined ? m.inflation_rate : 7.0,
        inflation_rate: m.inflation_rate !== undefined ? m.inflation_rate : 7.0,
        type: m.goal_type || 'outflow',
        goal_type: m.goal_type || 'outflow',
        loanRate: m.loan_rate || 8.5,
        loan_rate: m.loan_rate || 8.5,
        loanYears: m.loan_tenure_yrs || 5,
        loan_tenure_yrs: m.loan_tenure_yrs || 5,
        recStepUp: m.rec_step_up || 0,
        rec_step_up: m.rec_step_up || 0,
        recYears: m.rec_tenure_yrs || 5,
        rec_tenure_yrs: m.rec_tenure_yrs || 5,
        is_enabled: m.is_enabled !== undefined ? m.is_enabled : 1
    }));

    const snapshot = {
        target_corpus_at_ret: window.fpLastCalculatedSnapshot?.targetCorpusAtRet || 0,
        monthly_pension_needed: window.fpLastCalculatedSnapshot?.monthlyPensionNeeded || 0,
        freedom_status: window.fpLastCalculatedSnapshot?.freedomStatus || 'Fully Funded',
        exhaustion_age: window.fpLastCalculatedSnapshot?.exhaustionAge || 100,
        total_sip_invested: window.fpLastCalculatedSnapshot?.totalInvested || 0
    };

    return { plan, milestones, snapshot };
}

window.populatePlanToUI = function (plan, milestones) {
    if (!plan) return;

    window.isPopulatingPlan = true;
    window.fpAuth.activePlanId = plan.id;
    window.fpAuth.activePlanName = plan.plan_name;
    window.fpAuth.isFirstTime = (plan.is_first_time === 1 || plan.is_first_time === true);
    window.fpRetirementEnabled = (plan.retirement_enabled !== 0 && plan.retirement_enabled !== false);

    // Set retirement toggle checkbox UI
    const retToggle = document.getElementById('toggle-retirement');
    if (retToggle) retToggle.checked = window.fpRetirementEnabled;
    window.applyRetirementToggleUI(window.fpRetirementEnabled, false);

    const hdrPlanName = document.getElementById('hdr-plan-name');
    if (hdrPlanName) hdrPlanName.innerText = plan.plan_name;

    window.setControlVal('inp-age', plan.current_age || 0);
    window.setControlVal('inp-ret-age', plan.retirement_age || 0);
    window.setControlVal('inp-exhaustion-expected', plan.life_expectancy || 100);
    window.setControlVal('inp-expense', plan.current_expense || 0);
    window.setControlVal('inp-initial-corpus', plan.initial_corpus || 0);
    window.setControlVal('inp-initial-sip', plan.initial_sip || 0);
    window.setControlVal('inp-stepup', plan.sip_step_up || 0);
    window.setControlVal('inp-pre-irr', plan.pre_ret_irr || 13.5);
    window.setControlVal('inp-post-irr', plan.post_ret_irr || 8.0);
    window.setControlVal('inp-inflation', plan.inflation_rate || 6.5);
    window.setControlVal('inp-init-equity', plan.initial_equity_pct !== undefined ? plan.initial_equity_pct : 80);
    window.setControlVal('inp-glide-start', plan.glide_start_months !== undefined ? plan.glide_start_months : 108);
    window.setControlVal('inp-glide-end', plan.glide_end_months !== undefined ? plan.glide_end_months : 12);
    window.setControlVal('inp-pension-delay', plan.pension_delay_yrs || 0);

    const solverModeEl = document.getElementById('inp-solver-mode');
    if (solverModeEl && plan.solver_mode) solverModeEl.value = plan.solver_mode;

    // Populate milestone goals in window.fpMilestones
    const currentYear = new Date().getFullYear();
    const currentAge = plan.current_age || 30;
    window.fpMilestones = (milestones || []).map(m => {
        const targetAge = m.target_age || m.age || (currentAge + 5);
        const targetYear = m.target_year || (currentYear + Math.max(1, targetAge - currentAge));
        return {
            id: m.id || ('goal_' + Math.random().toString(36).substr(2, 9)),
            name: m.goal_name || m.name || 'Life Goal',
            target_year: targetYear,
            target_age: targetAge,
            present_value: parseFloat(m.present_value !== undefined ? m.present_value : (m.pv || 0)),
            active_amount: parseFloat(m.active_amount || 0),
            equity_pct: m.equity_pct !== undefined ? parseFloat(m.equity_pct) : 70,
            debt_pct: m.debt_pct !== undefined ? parseFloat(m.debt_pct) : 30,
            inflation_rate: m.inflation_rate !== undefined ? parseFloat(m.inflation_rate) : (m.inf !== undefined ? parseFloat(m.inf) : 7.0),
            goal_type: m.goal_type || m.type || 'outflow',
            loan_rate: parseFloat(m.loan_rate || m.loanRate || 8.5),
            loan_tenure_yrs: parseInt(m.loan_tenure_yrs || m.loanYears || 5),
            rec_step_up: parseFloat(m.rec_step_up || m.recStepUp || 0),
            rec_tenure_yrs: parseInt(m.rec_tenure_yrs || m.recYears || 5),
            is_enabled: m.is_enabled !== undefined ? m.is_enabled : 1
        };
    });

    window.renderMilestoneGoalCards();

    // Handle first-time vs normal button states
    const firstTimeSubmitBtn = document.getElementById('btn-submit-first-time');
    const normalActionsGrp = document.getElementById('btn-group-normal-actions');

    if (window.fpAuth.isFirstTime) {
        if (firstTimeSubmitBtn) firstTimeSubmitBtn.style.display = 'block';
        if (normalActionsGrp) normalActionsGrp.style.display = 'none';
        window.renderUncalculatedHeroState();
    } else {
        if (firstTimeSubmitBtn) firstTimeSubmitBtn.style.display = 'none';
        if (normalActionsGrp) normalActionsGrp.style.display = 'flex';
        window.updateLiveFreedomSnapshot();
    }

    updateGlideSummaryBanner();
    window.isPopulatingPlan = false;
};

window.handleFirstTimePlanSubmit = async function handleFirstTimePlanSubmit() {
    const age = parseInt(document.getElementById('inp-age')?.value) || 0;
    const retAge = parseInt(document.getElementById('inp-ret-age')?.value) || 0;

    if (age <= 0) {
        alert('Please enter your Current Age (Card 1) before generating your blueprint.');
        const ageInp = document.getElementById('disp-age');
        if (ageInp) {
            ageInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
            ageInp.focus();
        }
        return;
    }

    if (window.fpRetirementEnabled && retAge <= age) {
        alert('Retirement Age should be greater than Current Age. Please adjust in Card 1.');
        const retInp = document.getElementById('disp-ret-age');
        if (retInp) {
            retInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
            retInp.focus();
        }
        return;
    }

    const submitBtn = document.getElementById('btn-submit-first-time');
    if (submitBtn) {
        submitBtn.innerHTML = 'Generating Your Blueprint...';
        submitBtn.disabled = true;
    }

    try {
        window.fpAuth.isFirstTime = false;
        
        // Format all control displays now that values are confirmed
        ['inp-age', 'inp-ret-age', 'inp-initial-corpus', 'inp-initial-sip', 'inp-stepup', 'inp-expense'].forEach(id => {
            const dispId = id.replace('inp-', 'disp-');
            const disp = document.getElementById(dispId);
            const num = document.getElementById(id);
            if (disp && num) {
                if (disp.tagName === 'INPUT') disp.value = formatDisplayValue(id, num.value);
                else disp.innerText = formatDisplayValue(id, num.value);
            }
        });

        // Compute live calculations
        window.updateLiveFreedomSnapshot();

        // Switch bottom button to Save Plan & View Detailed Report
        if (submitBtn) submitBtn.style.display = 'none';
        const normalActionsGrp = document.getElementById('btn-group-normal-actions');
        if (normalActionsGrp) normalActionsGrp.style.display = 'flex';

        // Save plan to database with is_first_time: 0
        const payload = collectPlanPayloadFromUI();
        payload.plan.is_first_time = 0;
        await window.fpApi(`/api/plans/${window.fpAuth.activePlanId}`, 'PUT', payload);

        const pill = document.getElementById('save-status-pill');
        const pillText = document.getElementById('save-status-text');
        if (pill) pill.classList.remove('syncing');
        if (pillText) pillText.innerText = 'Saved';

        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
        console.error('Submission error:', err);
        alert('Failed to save blueprint: ' + err.message);
        if (submitBtn) {
            submitBtn.innerHTML = 'Submit Plan &amp; Generate Blueprint &rarr;';
            submitBtn.disabled = false;
        }
    }
};

window.manualSaveCurrentPlan = async function manualSaveCurrentPlan() {
    if (!window.fpAuth.token || !window.fpAuth.activePlanId) {
        alert('Please log in to save your plan.');
        return;
    }

    const saveBtn = document.getElementById('btn-save-plan');
    const origHtml = saveBtn ? saveBtn.innerHTML : '';
    if (saveBtn) {
        saveBtn.innerHTML = 'Saving...';
        saveBtn.disabled = true;
    }

    const pill = document.getElementById('save-status-pill');
    const pillText = document.getElementById('save-status-text');
    if (pill) {
        pill.classList.add('syncing');
        if (pillText) pillText.innerText = 'Syncing...';
    }

    try {
        const payload = collectPlanPayloadFromUI();
        await window.fpApi(`/api/plans/${window.fpAuth.activePlanId}`, 'PUT', payload);
        if (pill) {
            pill.classList.remove('syncing');
            if (pillText) pillText.innerText = 'Saved';
        }
        if (saveBtn) {
            saveBtn.innerHTML = '✓ Plan Saved';
            setTimeout(() => {
                saveBtn.innerHTML = origHtml;
                saveBtn.disabled = false;
            }, 1800);
        }
    } catch (err) {
        console.error('Manual save error:', err);
        alert('Failed to save plan: ' + err.message);
        if (pill) {
            pill.classList.remove('syncing');
            if (pillText) pillText.innerText = 'Offline';
        }
        if (saveBtn) {
            saveBtn.innerHTML = origHtml;
            saveBtn.disabled = false;
        }
    }
};

// ==========================================================================
// LIFE GOALS & MODAL ENGINE
// ==========================================================================
window.fpMilestones = [];

window.renderMilestoneGoalCards = function renderMilestoneGoalCards() {
    const container = document.getElementById('events-container');
    if (!container) return;

    if (!window.fpMilestones || window.fpMilestones.length === 0) {
        container.innerHTML = `
            <div class="fp-empty-goals-prompt">
                <div class="empty-icon">🎯</div>
                <div class="empty-title">No Life Goals Configured</div>
                <div class="empty-desc">Click "Add Life Goal" above to configure your milestone target amount, active earmarked savings, timeline, and asset partition.</div>
            </div>
        `;
        return;
    }

    const currentAge = parseInt(document.getElementById('inp-age')?.value) || 30;
    const currentYear = new Date().getFullYear();
    const eqRate = (parseFloat(document.getElementById('inp-pre-irr')?.value) || 13.5) / 100;
    const debtRate = (parseFloat(document.getElementById('inp-post-irr')?.value) || 8.0) / 100;

    let html = '';
    window.fpMilestones.forEach(g => {
        const targetAge = g.target_age || (currentAge + 5);
        const targetYear = g.target_year || (currentYear + (targetAge - currentAge));
        const yearsHorizon = Math.max(1, targetAge - currentAge);
        const pv = parseFloat(g.present_value) || 0;
        const activeAmt = parseFloat(g.active_amount) || 0;
        const inf = (parseFloat(g.inflation_rate) || 7.0) / 100;
        const eqPct = g.equity_pct !== undefined ? parseFloat(g.equity_pct) : 70;
        const dtPct = 100 - eqPct;

        const fv = pv * Math.pow(1 + inf, yearsHorizon);
        const rAnnual = (eqPct / 100) * eqRate + (dtPct / 100) * debtRate;
        const activeFV = activeAmt * Math.pow(1 + rAnnual, yearsHorizon);
        const netGapFV = Math.max(0, fv - activeFV);

        const mRate = Math.pow(1 + rAnnual, 1 / 12) - 1;
        const months = yearsHorizon * 12;
        let sipAcc = 0;
        for (let t = 0; t < months; t++) {
            sipAcc = (sipAcc + 1) * (1 + mRate);
        }
        const reqSIP = (netGapFV > 0 && sipAcc > 0) ? (netGapFV / sipAcc) : 0;
        const fundedPct = fv > 0 ? Math.min(100, Math.round((activeFV / fv) * 100)) : 0;

        let typeBadge = '';
        if (g.goal_type === 'recurring-outflow') typeBadge = 'Recurring Outflow';
        else if (g.goal_type === 'loan') typeBadge = 'Loan Assisted';
        else if (g.goal_type === 'inflow') typeBadge = 'Inflow / Liquidation';
        else typeBadge = 'Lumpsum Outflow';

        html += `
            <div class="fp-goal-card" id="goal-card-${g.id}">
                <div class="fp-goal-card-top">
                    <div class="fp-goal-card-title-wrap">
                        <span class="fp-goal-icon">🎯</span>
                        <div>
                            <div class="fp-goal-title">${escapeHtml(g.name || 'Life Milestone')}</div>
                            <span class="fp-goal-badge">${typeBadge} • Target Age ${targetAge} (${targetYear})</span>
                        </div>
                    </div>
                    <div class="fp-goal-actions">
                        <button type="button" class="fp-btn-goal-edit" onclick="openEditGoalModal('${g.id}')">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Edit
                        </button>
                        <button type="button" class="ev-del-btn" onclick="deleteMilestoneGoal('${g.id}')" title="Delete Goal">&times;</button>
                    </div>
                </div>

                <div class="fp-goal-grid">
                    <div class="fp-goal-kpi">
                        <span class="kpi-lbl">Target Cost Today (PV)</span>
                        <span class="kpi-val">${formatIndianCurrency(pv)}</span>
                    </div>
                    <div class="fp-goal-kpi">
                        <span class="kpi-lbl">Inflated Target (FV)</span>
                        <span class="kpi-val" style="color: var(--brand-navy);">${formatIndianCurrency(fv)}</span>
                    </div>
                    <div class="fp-goal-kpi">
                        <span class="kpi-lbl">Active Earmarked</span>
                        <span class="kpi-val" style="color: #059669;">${formatIndianCurrency(activeAmt)}</span>
                    </div>
                    <div class="fp-goal-kpi">
                        <span class="kpi-lbl">Required Monthly SIP</span>
                        <span class="kpi-val" style="color: #2563eb;">${fmtINR_plain(reqSIP)} / mo</span>
                    </div>
                </div>

                <div class="fp-goal-alloc-row">
                    <div class="alloc-lbl-row">
                        <span>Asset Mix: <strong>${eqPct}% Equity / ${dtPct}% Debt</strong></span>
                        <span>Funded: <strong>${fundedPct}%</strong></span>
                    </div>
                    <div class="fp-alloc-bar-preview">
                        <div class="alloc-bar-eq" style="width: ${eqPct}%;">${eqPct >= 15 ? eqPct + '% Eq' : ''}</div>
                        <div class="alloc-bar-dt" style="width: ${dtPct}%;">${dtPct >= 15 ? dtPct + '% Dt' : ''}</div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
};

window.openAddGoalModal = function openAddGoalModal() {
    const modal = document.getElementById('modal-goal-detail');
    if (!modal) return;

    document.getElementById('goal-modal-title').innerText = 'Add Life Milestone Goal';
    document.getElementById('goal-modal-id').value = '';
    document.getElementById('goal-modal-name').value = '';
    document.getElementById('goal-modal-pv').value = '';
    document.getElementById('goal-modal-active').value = '0';

    const currentAge = parseInt(document.getElementById('inp-age')?.value) || 30;
    document.getElementById('goal-modal-age').value = currentAge + 5;
    document.getElementById('goal-modal-inf').value = '7.0';
    document.getElementById('goal-modal-type').value = 'outflow';
    document.getElementById('goal-modal-duration').value = '5';
    document.getElementById('goal-modal-rec-stepup').value = '5';
    document.getElementById('goal-modal-equity-range').value = '80';

    window.updateGoalModalAllocDisplay(80);
    window.toggleGoalModalTypeFields('outflow');
    window.updateGoalModalHints();

    const delBtn = document.getElementById('btn-delete-goal-modal');
    if (delBtn) delBtn.style.display = 'none';

    modal.style.display = 'flex';
    setTimeout(() => {
        const nameInp = document.getElementById('goal-modal-name');
        if (nameInp) nameInp.focus();
    }, 50);
};

window.openEditGoalModal = function openEditGoalModal(goalId) {
    const modal = document.getElementById('modal-goal-detail');
    if (!modal) return;

    const goal = (window.fpMilestones || []).find(m => m.id === goalId);
    if (!goal) return;

    document.getElementById('goal-modal-title').innerText = `Edit Life Goal: ${goal.name || 'Milestone'}`;
    document.getElementById('goal-modal-id').value = goal.id;
    document.getElementById('goal-modal-name').value = goal.name || '';
    document.getElementById('goal-modal-pv').value = goal.present_value || 0;
    document.getElementById('goal-modal-active').value = goal.active_amount || 0;
    document.getElementById('goal-modal-age').value = goal.target_age || 50;
    document.getElementById('goal-modal-inf').value = goal.inflation_rate !== undefined ? goal.inflation_rate : 7.0;
    document.getElementById('goal-modal-type').value = goal.goal_type || 'outflow';
    document.getElementById('goal-modal-duration').value = goal.rec_tenure_yrs || goal.loan_tenure_yrs || 5;
    document.getElementById('goal-modal-rec-stepup').value = goal.rec_step_up || 5;

    const eqPct = goal.equity_pct !== undefined ? goal.equity_pct : 70;
    document.getElementById('goal-modal-equity-range').value = eqPct;

    window.updateGoalModalAllocDisplay(eqPct);
    window.toggleGoalModalTypeFields(goal.goal_type || 'outflow');
    window.updateGoalModalHints();

    const delBtn = document.getElementById('btn-delete-goal-modal');
    if (delBtn) delBtn.style.display = 'block';

    modal.style.display = 'flex';
};

window.closeGoalModal = function closeGoalModal() {
    const modal = document.getElementById('modal-goal-detail');
    if (modal) modal.style.display = 'none';
};

window.updateGoalModalAllocDisplay = function updateGoalModalAllocDisplay(val) {
    const eq = Math.min(100, Math.max(0, parseInt(val) || 0));
    const dt = 100 - eq;

    const disp = document.getElementById('goal-modal-alloc-disp');
    if (disp) disp.innerText = `${eq}% Equity | ${dt}% Debt`;

    const fillEq = document.getElementById('goal-alloc-fill-eq');
    if (fillEq) {
        fillEq.style.width = eq + '%';
        fillEq.innerText = eq >= 15 ? `${eq}% Eq` : '';
    }

    const fillDt = document.getElementById('goal-alloc-fill-dt');
    if (fillDt) {
        fillDt.style.width = dt + '%';
        fillDt.innerText = dt >= 15 ? `${dt}% Dt` : '';
    }

    window.updateGoalModalHints();
};

window.updateGoalModalHints = function updateGoalModalHints() {
    const pv = parseFloat(document.getElementById('goal-modal-pv')?.value) || 0;
    const active = parseFloat(document.getElementById('goal-modal-active')?.value) || 0;
    const net = Math.max(0, pv - active);

    const pvHint = document.getElementById('goal-modal-pv-hint');
    if (pvHint) pvHint.innerText = pv > 0 ? formatIndianCurrency(pv) : '₹ 0';

    const activeHint = document.getElementById('goal-modal-active-hint');
    if (activeHint) activeHint.innerText = `${formatIndianCurrency(active)} (Net PV Gap: ${formatIndianCurrency(net)})`;
};

window.toggleGoalModalTypeFields = function toggleGoalModalTypeFields(type) {
    const extra = document.getElementById('goal-modal-extra-fields');
    if (extra) {
        extra.style.display = (type === 'recurring-outflow' || type === 'loan') ? 'block' : 'none';
    }
};

window.handleGoalModalSubmit = function handleGoalModalSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('goal-modal-id').value;
    const name = document.getElementById('goal-modal-name').value.trim() || 'Life Goal';
    const pv = parseFloat(document.getElementById('goal-modal-pv').value) || 0;
    const activeAmt = parseFloat(document.getElementById('goal-modal-active').value) || 0;
    const targetAge = parseInt(document.getElementById('goal-modal-age').value) || 50;
    const inf = parseFloat(document.getElementById('goal-modal-inf').value) || 7.0;
    const goalType = document.getElementById('goal-modal-type').value || 'outflow';
    const duration = parseInt(document.getElementById('goal-modal-duration').value) || 5;
    const recStepUp = parseFloat(document.getElementById('goal-modal-rec-stepup').value) || 0;
    const eqPct = parseFloat(document.getElementById('goal-modal-equity-range').value) || 70;
    const dtPct = 100 - eqPct;

    const currentAge = parseInt(document.getElementById('inp-age')?.value) || 30;
    const currentYear = new Date().getFullYear();
    const targetYear = currentYear + Math.max(1, targetAge - currentAge);

    const goalObj = {
        id: id || ('goal_' + Date.now()),
        name: name,
        target_year: targetYear,
        target_age: targetAge,
        present_value: pv,
        active_amount: activeAmt,
        equity_pct: eqPct,
        debt_pct: dtPct,
        inflation_rate: inf,
        goal_type: goalType,
        loan_rate: 8.5,
        loan_tenure_yrs: duration,
        rec_step_up: recStepUp,
        rec_tenure_yrs: duration,
        is_enabled: 1
    };

    if (id) {
        const idx = window.fpMilestones.findIndex(m => m.id === id);
        if (idx !== -1) window.fpMilestones[idx] = goalObj;
        else window.fpMilestones.push(goalObj);
    } else {
        window.fpMilestones.push(goalObj);
    }

    window.closeGoalModal();
    window.renderMilestoneGoalCards();
    if (!window.fpAuth.isFirstTime) {
        window.updateLiveFreedomSnapshot();
    }

    const reportContainer = document.getElementById('fp-report-container');
    if (reportContainer && !reportContainer.classList.contains('fp-report-hidden')) {
        window.renderGoalsSummaryTable();
    }

    if (typeof window.triggerDebouncedAutoSave === 'function') {
        window.triggerDebouncedAutoSave();
    }
};

window.handleDeleteGoalFromModal = function handleDeleteGoalFromModal() {
    const id = document.getElementById('goal-modal-id').value;
    if (!id) return;
    if (confirm('Delete this life goal milestone?')) {
        window.deleteMilestoneGoal(id);
        window.closeGoalModal();
    }
};

window.deleteMilestoneGoal = function deleteMilestoneGoal(goalId) {
    window.fpMilestones = (window.fpMilestones || []).filter(m => m.id !== goalId);
    window.renderMilestoneGoalCards();
    if (!window.fpAuth.isFirstTime) {
        window.updateLiveFreedomSnapshot();
    }

    const reportContainer = document.getElementById('fp-report-container');
    if (reportContainer && !reportContainer.classList.contains('fp-report-hidden')) {
        window.renderGoalsSummaryTable();
    }

    if (typeof window.triggerDebouncedAutoSave === 'function') {
        window.triggerDebouncedAutoSave();
    }
};

window.toggleGoalsAccordion = function toggleGoalsAccordion() {
    const card = document.getElementById('goals-accordion-card');
    if (card) {
        card.classList.toggle('open');
    }
};

window.renderGoalsSummaryTable = function renderGoalsSummaryTable() {
    const tbody = document.getElementById('goals-summary-tbody');
    const countBadge = document.getElementById('goals-accordion-count');
    if (!tbody) return;

    const milestones = window.fpMilestones || [];
    const count = milestones.length;

    if (countBadge) {
        countBadge.innerText = `${count} Goal${count === 1 ? '' : 's'} Configured`;
    }

    if (count === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#64748b;">No milestone goals configured. Click "Add Life Goal" in Card 5 to add goals.</td></tr>`;
        return;
    }

    const currentAge = parseInt(document.getElementById('inp-age')?.value) || 30;
    const currentYear = new Date().getFullYear();
    const eqRate = (parseFloat(document.getElementById('inp-pre-irr')?.value) || 13.5) / 100;
    const debtRate = (parseFloat(document.getElementById('inp-post-irr')?.value) || 8.0) / 100;

    let html = '';
    milestones.forEach(g => {
        const targetAge = g.target_age || (currentAge + 5);
        const targetYear = g.target_year || (currentYear + (targetAge - currentAge));
        const yearsHorizon = Math.max(1, targetAge - currentAge);
        const pv = parseFloat(g.present_value) || 0;
        const activeAmt = parseFloat(g.active_amount) || 0;
        const inf = (parseFloat(g.inflation_rate) || 7.0) / 100;
        const eqPct = g.equity_pct !== undefined ? parseFloat(g.equity_pct) : 70;
        const dtPct = 100 - eqPct;

        const fv = pv * Math.pow(1 + inf, yearsHorizon);
        const rAnnual = (eqPct / 100) * eqRate + (dtPct / 100) * debtRate;
        const activeFV = activeAmt * Math.pow(1 + rAnnual, yearsHorizon);
        const netGapFV = Math.max(0, fv - activeFV);

        const mRate = Math.pow(1 + rAnnual, 1 / 12) - 1;
        const months = yearsHorizon * 12;
        let sipAcc = 0;
        for (let t = 0; t < months; t++) {
            sipAcc = (sipAcc + 1) * (1 + mRate);
        }
        const reqSIP = (netGapFV > 0 && sipAcc > 0) ? (netGapFV / sipAcc) : 0;
        const fundedPct = fv > 0 ? Math.min(100, Math.round((activeFV / fv) * 100)) : 0;

        let statusPill = '';
        if (fundedPct >= 100) {
            statusPill = '<span class="badge-status-pill badge-status-funded">● Fully Earmarked</span>';
        } else if (fundedPct > 0) {
            statusPill = `<span class="badge-status-pill badge-status-partial">● ${fundedPct}% Earmarked</span>`;
        } else {
            statusPill = '<span class="badge-status-pill badge-status-deficit">● Needs Funding</span>';
        }

        html += `
            <tr>
                <td><strong>${escapeHtml(g.name || 'Milestone Goal')}</strong></td>
                <td>${targetYear} (Age ${targetAge})</td>
                <td>${fmtINR_plain(pv)}</td>
                <td style="color:#059669; font-weight:600;">${fmtINR_plain(activeAmt)}</td>
                <td style="color:var(--brand-navy); font-weight:700;">${fmtINR_plain(fv)}</td>
                <td>
                    <span class="badge-asset-mix ${eqPct >= 70 ? 'mix-equity' : (eqPct <= 30 ? 'mix-debt' : 'mix-transition')}">
                        ${eqPct}% Eq / ${dtPct}% Dt
                    </span>
                </td>
                <td style="color:#2563eb; font-weight:700;">${reqSIP > 0 ? fmtINR_plain(reqSIP) + ' / mo' : 'Fully Funded'}</td>
                <td>${statusPill}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
};

// TAB SWITCHING (SIGN IN / REGISTER)
window.switchAuthTab = function (tab) {
    const btnLogin = document.getElementById('tab-btn-login');
    const btnReg = document.getElementById('tab-btn-register');
    const formLogin = document.getElementById('form-client-login');
    const formReg = document.getElementById('form-client-register');

    if (tab === 'login') {
        if (btnLogin) btnLogin.classList.add('active');
        if (btnReg) btnReg.classList.remove('active');
        if (formLogin) formLogin.style.display = 'block';
        if (formReg) formReg.style.display = 'none';
    } else {
        if (btnLogin) btnLogin.classList.remove('active');
        if (btnReg) btnReg.classList.add('active');
        if (formLogin) formLogin.style.display = 'none';
        if (formReg) formReg.style.display = 'block';
    }
};

window.handleClientLoginSubmit = async function (e) {
    e.preventDefault();
    const phone = document.getElementById('login-phone').value.trim();
    const pin = document.getElementById('login-pin').value.trim();
    const errEl = document.getElementById('login-error-msg');
    const submitBtn = document.getElementById('btn-login-submit');

    if (errEl) errEl.style.display = 'none';
    if (submitBtn) { submitBtn.innerText = 'Signing In...'; submitBtn.disabled = true; }

    try {
        const res = await window.fpApi('/api/auth/login', 'POST', { phone, pin });
        window.fpAuth.token = res.token;
        window.fpAuth.user = res.user;
        localStorage.setItem('fp_token', res.token);
        localStorage.setItem('fp_user', JSON.stringify(res.user));

        window.fpLeadName = res.user.name;
        window.fpLeadPhone = res.user.phone;

        // Load active plan
        const planRes = await window.fpApi('/api/plans/active');
        window.populatePlanToUI(planRes.plan, planRes.milestones);

        revealPlannerUI(res.user);
    } catch (err) {
        if (errEl) {
            errEl.innerText = err.message || 'Login failed. Please check your phone and PIN.';
            errEl.style.display = 'block';
        }
    } finally {
        if (submitBtn) { submitBtn.innerText = 'Access My Life Plans →'; submitBtn.disabled = false; }
    }
};

window.handleClientRegisterSubmit = async function (e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const pin = document.getElementById('reg-pin').value.trim();
    const errEl = document.getElementById('register-error-msg');
    const submitBtn = document.getElementById('btn-reg-submit');

    if (errEl) errEl.style.display = 'none';
    if (submitBtn) { submitBtn.innerText = 'Creating Account...'; submitBtn.disabled = true; }

    try {
        const res = await window.fpApi('/api/auth/register', 'POST', { name, phone, pin });
        window.fpAuth.token = res.token;
        window.fpAuth.user = res.user;
        localStorage.setItem('fp_token', res.token);
        localStorage.setItem('fp_user', JSON.stringify(res.user));

        window.fpLeadName = res.user.name;
        window.fpLeadPhone = res.user.phone;

        const planRes = await window.fpApi('/api/plans/active');
        window.populatePlanToUI(planRes.plan, planRes.milestones);

        revealPlannerUI(res.user);
    } catch (err) {
        if (errEl) {
            errEl.innerText = err.message || 'Registration failed. Please check your inputs.';
            errEl.style.display = 'block';
        }
    } finally {
        if (submitBtn) { submitBtn.innerText = 'Create Account & Start Planning →'; submitBtn.disabled = false; }
    }
};

function revealPlannerUI(user) {
    const s1 = document.getElementById('fp-step-1');
    const s2 = document.getElementById('fp-step-2');
    if (s1) s1.classList.remove('active');
    if (s2) s2.classList.add('active');

    const userBar = document.getElementById('fp-user-bar');
    if (userBar) userBar.style.display = 'flex';

    const userNameEl = document.getElementById('hdr-user-name');
    if (userNameEl && user) {
        userNameEl.innerText = user.name ? user.name.split(' ')[0] : 'Client';
    }

    window.scrollTo(0, 0);
}

window.handleUserLogout = function (confirmPrompt = true) {
    if (confirmPrompt && !confirm('Sign out of your account?')) return;
    localStorage.removeItem('fp_token');
    localStorage.removeItem('fp_user');
    window.fpAuth.token = null;
    window.fpAuth.user = null;
    window.fpAuth.activePlanId = null;

    const s1 = document.getElementById('fp-step-1');
    const s2 = document.getElementById('fp-step-2');
    if (s1) s1.classList.add('active');
    if (s2) s2.classList.remove('active');

    const userBar = document.getElementById('fp-user-bar');
    if (userBar) userBar.style.display = 'none';

    window.closeAdvisorDeskModal();
    window.closePlanManagerModal();
    window.closeAdvisorLoginModal();
    const banner = document.getElementById('advisor-inspect-banner');
    if (banner) banner.style.display = 'none';
};

// PLAN MANAGER (SCENARIO SWITCHER & BUILDER)
window.openPlanManagerModal = async function () {
    const modal = document.getElementById('modal-plan-manager');
    if (!modal) return;
    modal.style.display = 'flex';
    window.toggleNewPlanInput(false);
    await window.renderPlanCardsList();
};

window.closePlanManagerModal = function () {
    const modal = document.getElementById('modal-plan-manager');
    if (modal) modal.style.display = 'none';
};

window.toggleNewPlanInput = function (show) {
    const el = document.getElementById('new-plan-input-wrap');
    if (el) el.style.display = show ? 'block' : 'none';
    if (show) {
        const inp = document.getElementById('inp-new-plan-name');
        if (inp) { inp.value = ''; inp.focus(); }
    }
};

window.submitCreateNewPlan = async function () {
    const inp = document.getElementById('inp-new-plan-name');
    const name = inp ? inp.value.trim() : '';
    if (!name) {
        alert('Please enter a name for this plan scenario.');
        return;
    }

    try {
        const res = await window.fpApi('/api/plans/new', 'POST', {
            plan_name: name,
            clone_from_id: window.fpAuth.activePlanId
        });
        const planRes = await window.fpApi(`/api/plans/${res.planId}`);
        window.populatePlanToUI(planRes.plan, planRes.milestones);
        window.closePlanManagerModal();
    } catch (err) {
        alert('Failed to create plan: ' + err.message);
    }
};

window.duplicateCurrentPlan = async function () {
    const baseName = window.fpAuth.activePlanName || 'My Life Plan';
    const newName = `${baseName} (Copy)`;
    try {
        const res = await window.fpApi('/api/plans/new', 'POST', {
            plan_name: newName,
            clone_from_id: window.fpAuth.activePlanId
        });
        const planRes = await window.fpApi(`/api/plans/${res.planId}`);
        window.populatePlanToUI(planRes.plan, planRes.milestones);
        window.closePlanManagerModal();
    } catch (err) {
        alert('Failed to duplicate plan: ' + err.message);
    }
};

window.renderPlanCardsList = async function () {
    const container = document.getElementById('plan-cards-list');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;">Loading saved scenarios...</div>';

    try {
        const res = await window.fpApi('/api/plans');
        const plans = res.plans || [];
        if (plans.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;">No saved plans found.</div>';
            return;
        }

        let html = '';
        plans.forEach(p => {
            const isActive = p.id === window.fpAuth.activePlanId || p.is_active === 1;
            const updatedDate = p.updated_at ? new Date(p.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recently';
            html += `
                <div class="plan-card-item ${isActive ? 'active' : ''}">
                    <div class="plan-item-left">
                        <div class="plan-item-title-row">
                            <span class="plan-item-title">${escapeHtml(p.plan_name)}</span>
                            ${isActive ? '<span class="plan-active-badge">Active</span>' : ''}
                        </div>
                        <div class="plan-item-meta">
                            Age ${p.current_age} &rarr; ${p.retirement_age} | SIP: ₹${parseInt(p.initial_sip).toLocaleString('en-IN')}/mo | Updated: ${updatedDate}
                        </div>
                    </div>
                    <div class="plan-item-actions">
                        ${!isActive ? `<button type="button" class="fp-btn-secondary" style="padding:5px 10px; font-size:12px;" onclick="window.switchActivePlan('${p.id}')">Open</button>` : '<span style="font-size:12px; color:#059669; font-weight:600; padding:5px 10px;">Loaded</span>'}
                        ${plans.length > 1 && !isActive ? `<button type="button" class="ev-del-btn" onclick="window.deletePlanScenario('${p.id}')" title="Delete Plan">&#10005;</button>` : ''}
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<div style="color:#ef4444; padding:10px;">Failed to load plans: ${err.message}</div>`;
    }
};

window.switchActivePlan = async function (planId) {
    try {
        await window.fpApi(`/api/plans/${planId}/activate`, 'PUT');
        const planRes = await window.fpApi(`/api/plans/${planId}`);
        window.populatePlanToUI(planRes.plan, planRes.milestones);
        window.closePlanManagerModal();
    } catch (err) {
        alert('Failed to switch plan: ' + err.message);
    }
};

window.deletePlanScenario = async function (planId) {
    if (!confirm('Are you sure you want to delete this scenario?')) return;
    try {
        await window.fpApi(`/api/plans/${planId}`, 'DELETE');
        await window.renderPlanCardsList();
    } catch (err) {
        alert('Delete failed: ' + err.message);
    }
};

// ADVISOR INTELLIGENCE DESK INTEGRATION
window.handleAdvisorDeskClick = function () {
    if (window.fpAuth.token && window.fpAuth.user && window.fpAuth.user.role === 'advisor') {
        window.openAdvisorDeskModal();
    } else {
        window.openAdvisorLoginModal();
    }
};

window.openAdvisorLoginModal = function () {
    const m = document.getElementById('modal-advisor-login');
    if (m) m.style.display = 'flex';
};

window.closeAdvisorLoginModal = function () {
    const m = document.getElementById('modal-advisor-login');
    if (m) m.style.display = 'none';
};

window.handleAdvisorLoginSubmit = async function (e) {
    e.preventDefault();
    const phone = document.getElementById('adv-phone').value.trim();
    const pin = document.getElementById('adv-pin').value.trim();
    const errEl = document.getElementById('adv-error-msg');
    const submitBtn = document.getElementById('btn-adv-login');

    if (errEl) errEl.style.display = 'none';
    if (submitBtn) { submitBtn.innerText = 'Authenticating...'; submitBtn.disabled = true; }

    try {
        const res = await window.fpApi('/api/auth/login', 'POST', { phone, pin });
        if (res.user.role !== 'advisor') {
            throw new Error('This account does not have advisor privileges.');
        }

        window.fpAuth.token = res.token;
        window.fpAuth.user = res.user;
        localStorage.setItem('fp_token', res.token);
        localStorage.setItem('fp_user', JSON.stringify(res.user));

        window.closeAdvisorLoginModal();
        window.openAdvisorDeskModal();
    } catch (err) {
        if (errEl) {
            errEl.innerText = err.message || 'Authentication failed.';
            errEl.style.display = 'block';
        }
    } finally {
        if (submitBtn) { submitBtn.innerText = 'Unlock Advisor Intelligence Desk'; submitBtn.disabled = false; }
    }
};

window.openAdvisorDeskModal = async function () {
    const m = document.getElementById('modal-advisor-desk');
    if (m) m.style.display = 'flex';
    await window.refreshAdvisorData();
};

window.closeAdvisorDeskModal = function () {
    const m = document.getElementById('modal-advisor-desk');
    if (m) m.style.display = 'none';
};

window.advisorClientsCache = [];
window.refreshAdvisorData = async function () {
    try {
        const overview = await window.fpApi('/api/advisor/overview');
        if (overview && overview.metrics) {
            const m = overview.metrics;
            const elClients = document.getElementById('adv-metric-clients');
            const elGoals = document.getElementById('adv-metric-goals');
            const elRetAge = document.getElementById('adv-metric-ret-age');
            const elEquity = document.getElementById('adv-metric-equity');

            if (elClients) elClients.innerText = m.totalClients;
            if (elGoals) elGoals.innerText = m.totalGoals;
            if (elRetAge) elRetAge.innerText = m.avgRetirementAge + ' Yrs';
            if (elEquity) elEquity.innerText = m.avgEquityPct + '%';
        }

        const clientsRes = await window.fpApi('/api/advisor/clients');
        window.advisorClientsCache = clientsRes.clients || [];
        window.renderAdvisorClientTable(window.advisorClientsCache);
    } catch (err) {
        console.error('Advisor data error:', err);
    }
};

window.renderAdvisorClientTable = function (clients) {
    const tbody = document.getElementById('advisor-client-tbody');
    const counter = document.getElementById('adv-client-count-lbl');
    if (counter) counter.innerText = `Showing ${clients.length} clients`;
    if (!tbody) return;

    if (clients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:#64748b;">No matching clients found.</td></tr>`;
        return;
    }

    let html = '';
    clients.forEach(c => {
        const isFunded = c.freedomStatus && c.freedomStatus.includes('Funded');
        const statusBadge = isFunded
            ? `<span class="badge-status-pill badge-status-funded">● Fully Funded</span>`
            : `<span class="badge-status-pill badge-status-deficit">● Needs Review</span>`;

        html += `
            <tr>
                <td>
                    <div style="font-weight:700; color:var(--brand-navy);">${escapeHtml(c.clientName)}</div>
                    <div style="font-size:11.5px; color:var(--text-tertiary);">+91 ${c.clientPhone}</div>
                </td>
                <td>
                    <div><strong>${c.currentAge || 40}</strong> &rarr; <strong>${c.retirementAge || 60} Yrs</strong></div>
                    <div style="font-size:11px; color:var(--text-tertiary);">${(c.retirementAge || 60) - (c.currentAge || 40)} Yrs to Freedom</div>
                </td>
                <td>
                    <div style="font-weight:600;">₹ ${(c.initialSIP || 0).toLocaleString('en-IN')} / mo</div>
                    <div style="font-size:11px; color:var(--text-tertiary);">Corpus: ₹ ${formatIndianCurrency(c.initialCorpus || 0).replace('₹ ', '')}</div>
                </td>
                <td>
                    <span class="badge-asset-mix" style="font-size:11.5px;">${c.initialEquityPct || 80}% Eq / ${100 - (c.initialEquityPct || 80)}% Dt</span>
                </td>
                <td>
                    <span style="font-weight:700; color:var(--brand-navy);">${c.milestoneGoalsCount || 0} Goals</span>
                </td>
                <td>${statusBadge}</td>
                <td>
                    ${c.activePlanId ? `
                        <button type="button" class="btn-inspect-plan" onclick="window.inspectClientPlan('${c.activePlanId}', '${escapeHtml(c.clientName)}', '${escapeHtml(c.planName || 'Active Plan')}')">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                            Inspect Plan
                        </button>
                    ` : '<span style="color:#94a3b8; font-size:11px;">No plan</span>'}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
};

window.filterAdvisorClients = function (query) {
    query = (query || '').toLowerCase().trim();
    if (!query) {
        window.renderAdvisorClientTable(window.advisorClientsCache);
        return;
    }
    const filtered = window.advisorClientsCache.filter(c => 
        (c.clientName && c.clientName.toLowerCase().includes(query)) ||
        (c.clientPhone && c.clientPhone.includes(query))
    );
    window.renderAdvisorClientTable(filtered);
};

window.inspectClientPlan = async function (planId, clientName, planName) {
    try {
        const res = await window.fpApi(`/api/advisor/plans/${planId}`);
        window.closeAdvisorDeskModal();

        window.fpAuth.isAdvisorInspection = true;
        const banner = document.getElementById('advisor-inspect-banner');
        const cNameEl = document.getElementById('inspect-client-name');
        const pNameEl = document.getElementById('inspect-plan-name');
        if (banner) banner.style.display = 'flex';
        if (cNameEl) cNameEl.innerText = clientName;
        if (pNameEl) pNameEl.innerText = planName;

        window.populatePlanToUI(res.plan, res.milestones);
        revealPlannerUI({ name: clientName });
    } catch (err) {
        alert('Failed to inspect client plan: ' + err.message);
    }
};

window.exitAdvisorInspection = function () {
    window.fpAuth.isAdvisorInspection = false;
    const banner = document.getElementById('advisor-inspect-banner');
    if (banner) banner.style.display = 'none';
    window.openAdvisorDeskModal();
};

window.initAuthSession = async function () {
    const token = localStorage.getItem('fp_token');
    if (!token) return;

    try {
        window.fpAuth.token = token;
        const meRes = await window.fpApi('/api/auth/me');
        window.fpAuth.user = meRes.user;

        window.fpLeadName = meRes.user.name;
        window.fpLeadPhone = meRes.user.phone;

        const planRes = await window.fpApi('/api/plans/active');
        window.populatePlanToUI(planRes.plan, planRes.milestones);

        revealPlannerUI(meRes.user);
    } catch (err) {
        console.warn('Session verification failed, requiring re-login:', err.message);
        localStorage.removeItem('fp_token');
        localStorage.removeItem('fp_user');
        window.fpAuth.token = null;
        window.fpAuth.user = null;
    }
};

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Check existing authentication session
    window.initAuthSession();

    // 2. Setup Range Sliders & Number Input Synchronization
    const sliders = document.querySelectorAll('.fp-slider');
    sliders.forEach(slider => {
        const inputId = slider.id.replace('slide-', 'inp-');
        const numberInput = document.getElementById(inputId);
        if (numberInput) {
            slider.value = numberInput.value;
            updateSliderVisual(slider);
            const dispId = inputId.replace('inp-', 'disp-');
            const disp = document.getElementById(dispId);
            if (disp) {
                if (disp.tagName === 'INPUT') {
                    disp.value = formatDisplayValue(inputId, numberInput.value);
                } else {
                    disp.innerText = formatDisplayValue(inputId, numberInput.value);
                }
            }

            slider.addEventListener('input', (e) => {
                numberInput.value = e.target.value;
                syncControlState(inputId, e.target.value);
            });

            numberInput.addEventListener('input', (e) => {
                slider.value = e.target.value;
                syncControlState(inputId, e.target.value);
            });
        }
    });

    // 3. Run Initial Snapshot & Milestone Calculations
    if (!window.fpAuth.isFirstTime) {
        window.updateLiveFreedomSnapshot();
    }
    updateGlideSummaryBanner();
    if (typeof window.renderMilestoneGoalCards === 'function') {
        window.renderMilestoneGoalCards();
    }
});
// ==========================================================================
// DETAILED REPORT GENERATION
// ==========================================================================
window.toggleExhaustionAge = function() {
    const mode = document.getElementById('inp-solver-mode')?.value;
    const group = document.getElementById('group-exhaustion-age');
    if (!group) return;
    if (mode === 'solve-lumpsum' || mode === 'solve-sip') {
        group.style.display = 'block';
    } else {
        group.style.display = 'none';
    }
    if (!window.fpAuth.isFirstTime) {
        window.updateLiveFreedomSnapshot();
    }
};

window.generateFreedomReport = function generateFreedomReport() {
    const reportContainer = document.getElementById('fp-report-container');
    if (reportContainer) reportContainer.classList.remove('fp-report-hidden');

    const leadName = window.fpLeadName || '';
    const leadPhone = window.fpLeadPhone || '';
    const nameStr = leadName && leadPhone ? `${leadName} | ${leadPhone}` : (leadName || leadPhone);
    const detailsEl = document.getElementById('report-lead-details');
    if (detailsEl) detailsEl.innerText = nameStr;

    const age = parseInt(document.getElementById('inp-age').value) || 30;
    const retAge = parseInt(document.getElementById('inp-ret-age').value) || 60;
    const initialCorpus = document.getElementById('inp-initial-corpus').value === '' ? 0 : parseFloat(document.getElementById('inp-initial-corpus').value);
    const initialSIP = document.getElementById('inp-initial-sip').value === '' ? 0 : parseFloat(document.getElementById('inp-initial-sip').value);
    const stepUp = (parseFloat(document.getElementById('inp-stepup').value) || 0) / 100;
    const preIRR = (parseFloat(document.getElementById('inp-pre-irr').value) || 13.5) / 100;
    const postIRR = (parseFloat(document.getElementById('inp-post-irr').value) || 8) / 100;
    const retExpToday = parseFloat(document.getElementById('inp-expense').value) || 0;
    const inflation = (parseFloat(document.getElementById('inp-inflation').value) || 0) / 100;
    const pensionDelay = parseInt(document.getElementById('inp-pension-delay').value) || 0;
    const exhaustExpected = parseInt(document.getElementById('inp-exhaustion-expected').value) || 100;
    const mode = document.getElementById('inp-solver-mode').value || 'normal';
    const initEq = parseFloat(document.getElementById('inp-init-equity')?.value) || 80;
    const startM = parseInt(document.getElementById('inp-glide-start')?.value) || 108;
    const endM = parseInt(document.getElementById('inp-glide-end')?.value) || 12;
    const isRetOff = !window.fpRetirementEnabled;
    const effectiveRetAge = isRetOff ? Math.max(age + 20, 60) : retAge;
    const totalRetMonths = Math.max(0, (effectiveRetAge - age) * 12);
    
    const currentYear = new Date().getFullYear();

    // Construct events array from window.fpMilestones
    const baseEvents = [];
    (window.fpMilestones || []).forEach(g => {
        const targetAge = g.target_age || (age + Math.max(1, (g.target_year || currentYear + 5) - currentYear));
        const pv = parseFloat(g.present_value) || 0;
        const activeAmt = parseFloat(g.active_amount) || 0;
        const inf = (parseFloat(g.inflation_rate) || 7.0) / 100;
        const eqPct = g.equity_pct !== undefined ? parseFloat(g.equity_pct) : 70;
        const dtPct = 100 - eqPct;

        baseEvents.push({
            age: targetAge,
            name: g.name || 'Life Goal',
            pv: pv,
            activeAmt: activeAmt,
            eqPct: eqPct,
            dtPct: dtPct,
            inflation: inf,
            type: g.goal_type || 'outflow',
            loanRate: (parseFloat(g.loan_rate) || 8.5) / 100,
            loanYears: parseInt(g.loan_tenure_yrs) || 5,
            recStepUp: (parseFloat(g.rec_step_up) || 0) / 100,
            recYears: parseInt(g.rec_tenure_yrs) || 5
        });
    });

    const runSimulation = (simInitialCorpus, simInitialSIP) => {
        let events = JSON.parse(JSON.stringify(baseEvents));
        let corpus = 0;
        let totalInvestments = simInitialCorpus;
        let totalWithdrawals = 0;
        let highestCorpus = 0;
        let exhaustionAge = null;
        let corpusAtRetirement = 0;
        let corpusAt80 = 0;

        let tableHtml = `
            <thead>
                <tr>
                    <th>Year</th>
                    <th>Age</th>
                    <th>Asset Mix</th>
                    <th>Present Value, Inflation</th>
                    <th>Details</th>
                    <th>Inflow</th>
                    <th>Outflow</th>
                    <th>Monthly SIP</th>
                    <th>Monthly SWP</th>
                    <th>Corpus</th>
                </tr>
            </thead>
            <tbody>
        `;

        let maxAge = mode === 'normal' ? 100 : exhaustExpected;

        for (let a = age; a <= maxAge; a++) {
            let year = currentYear + (a - age);
            let rowDetails = [];
            let rowPVs = [];
            let rowInflow = 0;
            let rowOutflow = 0;
            let monthlySIP = 0;
            let monthlySWP = 0;
            let isFirstYear = (a === age);

            if (a <= effectiveRetAge) {
                monthlySIP = simInitialSIP * Math.pow(1 + stepUp, a - age);
            }

            // Retirement SWP is bypassed if retirement planning is toggled OFF
            if (!isRetOff && a > retAge + pensionDelay && corpus > 0) {
                monthlySWP = retExpToday * Math.pow(1 + inflation, a - age);
                totalWithdrawals += (monthlySWP * 12);
            }

            let evs = events.filter(e => e.age === a);
            evs.forEach(ev => {
                let pvText = ``;
                let inflatedAmt = 0;

                if (ev.type === 'loan') {
                    let loanAmtOrig = ev.pv;
                    let loanInflatedTarget = loanAmtOrig * Math.pow(1 + ev.inflation, a - age); 
                    let durationYrs = ev.loanYears;
                    let rate = ev.loanRate;
                    let r = rate / 12;
                    let n = durationYrs * 12;
                    let emi = (loanInflatedTarget * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                    
                    pvText = `<span style="color:#e63946">${formatIndianCurrency(ev.pv)}, ${(ev.inflation * 100).toFixed(0)}%</span>`;
                    rowPVs.push(pvText);
                    rowDetails.push(`<span style="color:#e63946">${escapeHtml(ev.name)} (EMI out)</span>`);
                    rowOutflow += (emi * 12); 
                    totalWithdrawals += (emi * 12);

                    if (durationYrs > 1) {
                        for(let l_y = 1; l_y < durationYrs; l_y++) {
                            let targetAge = a + l_y;
                            if(targetAge <= maxAge) {
                                events.push({
                                    age: targetAge,
                                    name: `${ev.name}`,
                                    pv: loanAmtOrig,
                                    isEMIStep: true,
                                    emiAmount: emi * 12,
                                    inflation: ev.inflation,
                                    type: 'emi-outflow'
                                });
                            }
                        }
                    }
                } else if (ev.type === 'emi-outflow') {
                     rowDetails.push(`<span style="color:#e63946">${escapeHtml(ev.name)} (EMI cont.)</span>`);
                     rowOutflow += ev.emiAmount;
                     totalWithdrawals += ev.emiAmount;
                } else if (ev.type === 'recurring-outflow') {
                    let baseAmt = ev.pv * Math.pow(1 + ev.inflation, a - age);
                    let yearAmt = ev.isRecStep ? ev.recurringAmount : baseAmt;

                    pvText = `<span style="color:#e63946">${ev.isRecStep ? '' : formatIndianCurrency(ev.pv) + ', ' + (ev.inflation * 100).toFixed(0) + '%'}</span>`;
                    if (!ev.isRecStep) rowPVs.push(pvText);
                    let stepLabel = ev.isRecStep ? `${escapeHtml(ev.name)} (Yr ${ev.recYearNum})` : `${escapeHtml(ev.name)} (Recurring)`;
                    rowDetails.push(`<span style="color:#e63946">${stepLabel}</span>`);
                    rowOutflow += yearAmt;
                    totalWithdrawals += yearAmt;

                    if (!ev.isRecStep && ev.recYears > 1) {
                        for (let ry = 1; ry < ev.recYears; ry++) {
                            let targetAge = a + ry;
                            if (targetAge <= maxAge) {
                                let futureAmt = baseAmt * Math.pow(1 + ev.recStepUp, ry);
                                events.push({
                                    age: targetAge,
                                    name: ev.name,
                                    pv: ev.pv,
                                    inflation: ev.inflation,
                                    type: 'recurring-outflow',
                                    isRecStep: true,
                                    recurringAmount: futureAmt,
                                    recYearNum: ry + 1,
                                    recStepUp: ev.recStepUp,
                                    recYears: 0
                                });
                            }
                        }
                    }
                } else {
                    inflatedAmt = ev.pv * Math.pow(1 + ev.inflation, a - age);
                    if (ev.type === 'inflow') {
                        pvText = `<span style="color:#10b981">${formatIndianCurrency(ev.pv)}, ${(ev.inflation * 100).toFixed(0)}%</span>`;
                        rowPVs.push(pvText);
                        rowDetails.push(`<span style="color:#10b981">${escapeHtml(ev.name)}</span>`);
                        rowInflow += inflatedAmt;
                        totalInvestments += inflatedAmt;
                    } else {
                        pvText = `<span style="color:#e63946">${formatIndianCurrency(ev.pv)}, ${(ev.inflation * 100).toFixed(0)}%</span>`;
                        rowPVs.push(pvText);
                        rowDetails.push(`<span style="color:#e63946">${escapeHtml(ev.name)}</span>`);
                        rowOutflow += inflatedAmt;
                        totalWithdrawals += inflatedAmt;
                    }
                }
            });

            if (corpus <= 0 && !isFirstYear) {
                 monthlySWP = 0;
                 rowOutflow = 0;
                 corpus = 0;
            }

            let currentCorpus = isFirstYear ? simInitialCorpus : corpus;
            let mSIP = monthlySIP;
            let mSWP = monthlySWP;
            let mOut = rowOutflow / 12;
            let mIn = rowInflow / 12;

            // Representative allocation badge for this year
            let repMonthsLeft = totalRetMonths - ((a - age) * 12 + 6);
            let rowAlloc = calcGlideAllocation(repMonthsLeft, initEq, startM, endM);
            let mixBadge = '';
            if (a >= effectiveRetAge) {
                mixBadge = `<span class="badge-asset-mix mix-debt">0% Eq / 100% Dt</span>`;
            } else if (rowAlloc.equityPct >= initEq) {
                mixBadge = `<span class="badge-asset-mix mix-equity">${initEq}% Eq / ${100 - initEq}% Dt</span>`;
            } else if (rowAlloc.equityPct <= 0) {
                mixBadge = `<span class="badge-asset-mix mix-debt">0% Eq / 100% Dt</span>`;
            } else {
                mixBadge = `<span class="badge-asset-mix mix-transition">${rowAlloc.equityPct.toFixed(0)}% Eq / ${rowAlloc.debtPct.toFixed(0)}% Dt</span>`;
            }

            for(let m = 0; m < 12; m++) {
                let monthsElapsed = (a - age) * 12 + m;
                let monthsLeftToRet = totalRetMonths - monthsElapsed;
                let mRate;

                if (a < effectiveRetAge && monthsLeftToRet > 0) {
                    let alloc = calcGlideAllocation(monthsLeftToRet, initEq, startM, endM);
                    let rAnnual = (alloc.equityPct / 100) * preIRR + (alloc.debtPct / 100) * postIRR;
                    mRate = Math.pow(1 + rAnnual, 1 / 12) - 1;
                } else {
                    mRate = Math.pow(1 + postIRR, 1 / 12) - 1;
                }

                if(currentCorpus > 0 || mSIP > 0 || mIn > 0) {
                     currentCorpus = currentCorpus + mSIP + mIn - mSWP - mOut;
                     currentCorpus = currentCorpus + (currentCorpus * mRate);
                } else {
                     currentCorpus = 0;
                }
            }
            
            if (isFirstYear) { 
                 totalInvestments += (monthlySIP * 12);
            } else {
                 if (a <= effectiveRetAge) totalInvestments += (monthlySIP * 12);
            }

            corpus = currentCorpus;

            if (corpus > highestCorpus) highestCorpus = corpus;
            if (a === effectiveRetAge) corpusAtRetirement = corpus;
            if (a === 80) corpusAt80 = corpus;
            if (!isRetOff && corpus <= 0 && exhaustionAge === null && !isFirstYear && a > retAge) {
                exhaustionAge = a;
            }

            tableHtml += `<tr ${a === effectiveRetAge ? 'style="font-weight:700; background:rgba(0,210,255,0.08)"' : ''}>
                <td>${year}</td>
                <td ${a === effectiveRetAge ? 'style="color:#00d2ff; font-weight:700;"' : ''}>${a}</td>
                <td>${mixBadge}</td>
                <td style="font-size:11px;">${rowPVs.join('<br>')}</td>
                <td>${rowDetails.join('<br>')}</td>
                <td style="color:#10b981">${rowInflow > 0 && !isFirstYear ? fmtINR_plain(rowInflow) : (isFirstYear ? fmtINR_plain(simInitialCorpus) : '')}</td>
                <td style="color:#e63946">${rowOutflow > 0 ? fmtINR_plain(rowOutflow) : ''}</td>
                <td style="color:#10b981">${monthlySIP > 0 ? fmtINR_plain(monthlySIP) : ''}</td>
                <td style="color:#e63946">${monthlySWP > 0 ? fmtINR_plain(monthlySWP) : ''}</td>
                <td style="font-weight:700">${fmtINR_plain(corpus)}</td>
            </tr>`;

            if (a >= maxAge && corpus <= 0) break;
        }
        tableHtml += '</tbody>';

        return {
            tableHtml,
            totalInvestments,
            totalWithdrawals,
            highestCorpus,
            exhaustionAge,
            corpusAtRetirement,
            corpusAt80,
            finalCorpusAtExhaust: corpus
        };
    };

    let targetInitialCorpus = initialCorpus;
    let targetInitialSIP = initialSIP;
    const maxAge = mode === 'normal' ? 100 : exhaustExpected;

    if (mode === 'solve-lumpsum') {
        let low = 0;
        let high = 1000000000;
        let bestCorpusFound = 0;
        for (let i = 0; i < 60; i++) {
            let mid = (low + high) / 2;
            let res = runSimulation(mid, initialSIP);
            if (res.finalCorpusAtExhaust > 0) {
                high = mid;
                bestCorpusFound = mid;
            } else {
                low = mid;
            }
        }
        targetInitialCorpus = bestCorpusFound;
    } else if (mode === 'solve-sip') {
        let low = 0;
        let high = 5000000;
        let bestSIPFound = 0;
        for (let i = 0; i < 60; i++) {
            let mid = (low + high) / 2;
            let res = runSimulation(initialCorpus, mid);
            if (res.finalCorpusAtExhaust > 0) {
                high = mid;
                bestSIPFound = mid;
            } else {
                low = mid;
            }
        }
        targetInitialSIP = bestSIPFound;
    }

    let finalSim = runSimulation(targetInitialCorpus, targetInitialSIP);
    const swpAtRetAge = isRetOff ? 0 : (retExpToday * Math.pow(1 + inflation, retAge + 1 + pensionDelay - age)); 

    let solvedText = '';
    if (mode === 'solve-lumpsum') {
        solvedText = `<div style="grid-column: 1 / -1; background:linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%); color:#fff; padding:14px; border-radius:12px; text-align:center; font-weight:bold; margin-bottom: 16px;">Required Lumpsum to secure goals till age ${maxAge}: <br><span style="font-size: 24px;">${fmtINR_plain(targetInitialCorpus)}</span></div>`;
    } else if (mode === 'solve-sip') {
        solvedText = `<div style="grid-column: 1 / -1; background:linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%); color:#fff; padding:14px; border-radius:12px; text-align:center; font-weight:bold; margin-bottom: 16px;">Required Monthly SIP to secure goals till age ${maxAge}: <br><span style="font-size: 24px;">${fmtINR_plain(targetInitialSIP)}</span></div>`;
    }

    // Populate the Expandable Goals Accordion Table above the Cash Flow Table
    window.renderGoalsSummaryTable();

    document.getElementById('report-table').innerHTML = finalSim.tableHtml;
    document.getElementById('report-summary').innerHTML = solvedText + `
        <div class="fp-summary-col">
            <div class="fp-sum-row"><span>Initial Corpus :</span> <strong>${fmtINR_plain(targetInitialCorpus)}</strong></div>
            <div class="fp-sum-row"><span>Initial SIP :</span> <strong>${fmtINR_plain(targetInitialSIP)}</strong></div>
            <div class="fp-sum-row"><span>Initial Equity % :</span> <strong>${initEq}% (${100 - initEq}% Debt)</strong></div>
            <div class="fp-sum-row"><span>Glide De-risking :</span> <strong>${startM}m &rarr; ${endM}m before target</strong></div>
            <div class="fp-sum-row"><span>Step up % :</span> <strong>${(stepUp * 100).toFixed(0)}%</strong></div>
            <div class="fp-sum-row"><span>Equity IRR :</span> <strong>${(preIRR * 100).toFixed(1)}%</strong></div>
            <div class="fp-sum-row"><span>Debt IRR :</span> <strong>${(postIRR * 100).toFixed(1)}%</strong></div>
            <div class="fp-sum-row"><span>Age / Ret. Age :</span> <strong>${age} / ${isRetOff ? 'Retirement Off' : retAge}</strong></div>
            <div class="fp-sum-row"><span>Inflation :</span> <strong>${(inflation * 100).toFixed(1)}%</strong></div>
            <div class="fp-sum-row"><span>Pension Delay :</span> <strong>${pensionDelay} Years</strong></div>
        </div>
        <div class="fp-summary-col">
            <div class="fp-sum-row"><span>Retirement Expense Today :</span> <strong>${isRetOff ? 'Disabled (Goal Mode)' : fmtINR_plain(retExpToday)}</strong></div>
            <div class="fp-sum-row"><span>Monthly Pension at Ret. :</span> <strong>${isRetOff ? '₹ 0 (Disabled)' : fmtINR_plain(swpAtRetAge)}</strong></div>
            <div class="fp-sum-row"><span>Total Investments :</span> <strong>${fmtINR_plain(finalSim.totalInvestments)}</strong></div>
            <div class="fp-sum-row"><span>Total Withdrawals :</span> <strong>${fmtINR_plain(finalSim.totalWithdrawals)}</strong></div>
            <div class="fp-sum-row"><span>Highest Corpus Peak :</span> <strong>${fmtINR_plain(finalSim.highestCorpus)}</strong></div>
            <div class="fp-sum-row"><span>Exhaustion Age :</span> <strong>${isRetOff ? 'Wealth Acc: 100+' : (finalSim.exhaustionAge || '>'+maxAge)}</strong></div>
            <div class="fp-sum-row"><span>Corpus at Retirement / Focus :</span> <strong>${fmtINR_plain(finalSim.corpusAtRetirement)}</strong></div>
            <div class="fp-sum-row"><span>Corpus at Age 80 :</span> <strong>${fmtINR_plain(finalSim.corpusAt80)}</strong></div>
        </div>
    `;

    const stickyBtn = document.querySelector('.fp-btn-sticky');
    if (stickyBtn && !stickyBtn.id.includes('btn-submit-first-time')) {
        stickyBtn.innerHTML = 'Download Comprehensive PDF Report';
        stickyBtn.onclick = () => window.downloadFreedomPDF();
    }

    setTimeout(() => {
        document.getElementById('fp-report-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    window.sendFreedomReportEmail('Generated');
};

// ==========================================================================
// EMAIL NOTIFICATION
// ==========================================================================
window.sendFreedomReportEmail = async function (status) {
    const leadName  = window.fpLeadName  || 'Not provided';
    const leadPhone = window.fpLeadPhone || 'Not provided';
    const g    = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const gSel = (id) => { const el = document.getElementById(id); return (el && el.options && el.options[el.selectedIndex]) ? el.options[el.selectedIndex].text : ''; };

    try {
        const fd = new FormData();
        fd.append('_subject',                   `Financial Freedom Report ${status} – ${leadName} | ${leadPhone}`);
        fd.append('_template',                  'table');
        fd.append('_captcha',                   'false');
        fd.append('Status',                     `Report ${status}`);
        fd.append('Name',                       leadName);
        fd.append('Phone',                      leadPhone);
        fd.append('Current Age',                g('inp-age'));
        fd.append('Retirement Age',             g('inp-ret-age'));
        fd.append('Initial Corpus (Rs)',        g('inp-initial-corpus'));
        fd.append('Initial SIP (Rs/mo)',        g('inp-initial-sip'));
        fd.append('SIP Step-Up %',              g('inp-stepup'));
        fd.append('Equity IRR %',               g('inp-pre-irr'));
        fd.append('Debt IRR %',                 g('inp-post-irr'));
        fd.append('Initial Equity %',           g('inp-init-equity'));
        fd.append('Glide Start (Months)',       g('inp-glide-start'));
        fd.append('Glide End (Months)',         g('inp-glide-end'));
        fd.append('Current Expense (Rs/mo)',    g('inp-expense'));
        fd.append('Inflation Rate %',           g('inp-inflation'));
        fd.append('Pension Delay (Years)',      g('inp-pension-delay'));
        fd.append('Analysis Mode',              gSel('inp-solver-mode'));

        const milestones = window.fpMilestones || [];
        if (milestones.length > 0) {
            let eventsText = '';
            milestones.forEach((g, i) => {
                let line = `${i+1}. ${g.name || 'Goal'} | Year: ${g.target_year || '-'} (Age ${g.target_age || '-'}) | PV: Rs ${parseInt(g.present_value || 0).toLocaleString('en-IN')} | Active: Rs ${parseInt(g.active_amount || 0).toLocaleString('en-IN')} | Mix: ${g.equity_pct || 70}% Eq / ${g.debt_pct || 30}% Dt | Type: ${g.goal_type || 'outflow'}`;
                if (g.goal_type === 'loan') {
                    line += ` | Loan Rate: ${g.loan_rate || 8.5}% | Duration: ${g.loan_tenure_yrs || 5} Yr`;
                }
                eventsText += line + '\n';
            });
            fd.append('Goals & Events', eventsText.trim());
        } else {
            fd.append('Goals & Events', 'None added');
        }

        await fetch('https://formsubmit.co/ajax/srpprimewealth@gmail.com', {
            method : 'POST',
            headers: { 'Accept': 'application/json' },
            body   : fd
        });
    } catch (err) {
        console.warn('Email warning:', err.message);
    }
};

// ==========================================================================
// PDF DOWNLOAD
// ==========================================================================
window.downloadFreedomPDF = async function () {
    const reportSheet = document.getElementById('fp-report-sheet');
    if (!reportSheet || reportSheet.innerHTML.trim() === '') {
        alert('Please generate the report first before downloading.');
        return;
    }

    const btns = document.querySelectorAll('[onclick*="downloadFreedomPDF"]');
    const origTexts = [];
    btns.forEach((btn, i) => { origTexts[i] = btn.innerHTML; btn.innerHTML = '⌛ Generating PDF...'; btn.disabled = true; });
    const restoreBtns = () => btns.forEach((btn, i) => { btn.innerHTML = origTexts[i]; btn.disabled = false; });

    await window.sendFreedomReportEmail('Downloaded');

    if (typeof html2pdf === 'undefined') {
        alert('PDF library is loading. Please try again in a few seconds.');
        restoreBtns();
        return;
    }

    const pdfContainer = document.createElement('div');
    pdfContainer.id = 'pdf-render-wrapper';
    pdfContainer.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 800px;
        background: #ffffff;
        color: #1a2d5a;
        padding: 30px;
        box-sizing: border-box;
        font-family: 'Inter', sans-serif;
    `;

    const clonedSheet = reportSheet.cloneNode(true);
    clonedSheet.style.boxShadow = 'none';
    clonedSheet.style.padding = '0';
    pdfContainer.appendChild(clonedSheet);
    document.body.appendChild(pdfContainer);

    const filename = `SRP_Financial_Freedom_Plan_${(window.fpLeadName || 'Client').replace(/\s+/g, '_')}.pdf`;

    try {
        await html2pdf()
            .set({
                margin      : [8, 6, 8, 6],
                filename    : filename,
                image       : { type: 'jpeg', quality: 0.98 },
                html2canvas : {
                    scale          : 1.8,
                    useCORS        : true,
                    backgroundColor: '#ffffff',
                    windowWidth    : 800
                },
                jsPDF       : { unit: 'mm', format: 'a4', orientation: 'portrait' }
            })
            .from(pdfContainer)
            .save();
    } catch (err) {
        console.error('PDF error:', err);
        alert('PDF generation failed: ' + err.message);
    } finally {
        if (pdfContainer.parentNode) pdfContainer.parentNode.removeChild(pdfContainer);
        restoreBtns();
    }
};
