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
        case 'inp-sip-duration':
        case 'inp-exhaustion-expected':
            return val > 0 ? Math.round(val) + (Math.round(val) === 1 ? " Yr" : " Yrs") : (window.fpAuth && window.fpAuth.isFirstTime ? "" : "0 Yrs");
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
    const eqRate = (parseFloat(document.getElementById('inp-pre-irr')?.value) || 12.0) / 100;
    const debtRate = (parseFloat(document.getElementById('inp-post-irr')?.value) || 6.0) / 100;

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
    if (typeof window.renderGoalLumpsumPartitionTable === 'function') {
        window.renderGoalLumpsumPartitionTable();
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
    const preIRR = (parseFloat(document.getElementById('inp-pre-irr')?.value) || 12.0) / 100;
    const postIRR = (parseFloat(document.getElementById('inp-post-irr')?.value) || 6.0) / 100;
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

    // SIP Duration in Years (from Current Age)
    const simStartAge = age > 0 ? age : 30;
    const sipDuration = parseInt(document.getElementById('inp-sip-duration')?.value) || Math.max(1, effectiveRetAge - simStartAge);

    // Fast simulation loop
    let corpus = initialCorpus;
    let totalInvested = initialCorpus;
    let corpusAtRetirement = 0;
    let exhaustionAge = null;
    const mPostRate = Math.pow(1 + postIRR, 1 / 12) - 1;
    const totalRetMonths = Math.max(0, (effectiveRetAge - simStartAge) * 12);

    for (let a = simStartAge; a <= 100; a++) {
        let yearsElapsed = a - simStartAge;
        let monthlySIP = 0;
        let monthlySWP = 0;

        if (yearsElapsed < sipDuration) {
            monthlySIP = initialSIP * Math.pow(1 + stepUp, yearsElapsed);
            totalInvested += (monthlySIP * 12);
        }

        if (!isRetOff && a > retAge + pensionDelay && corpus > 0) {
            monthlySWP = retExpToday * Math.pow(1 + inflation, yearsElapsed);
        }

        for (let m = 0; m < 12; m++) {
            let monthsElapsed = yearsElapsed * 12 + m;
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

    // Fast goal status tracking for live UI
    const simGoalStatus = {};
    (window.fpMilestones || []).forEach(m => {
        const tAge = m.target_age || (simStartAge + 5);
        if (exhaustionAge !== null && exhaustionAge < tAge) {
            simGoalStatus[m.id] = { status: 'unmet', fundedPct: 0 };
        } else if (exhaustionAge === tAge) {
            simGoalStatus[m.id] = { status: 'partially_met', fundedPct: 50 };
        } else {
            simGoalStatus[m.id] = { status: 'met', fundedPct: 100 };
        }
    });
    window.fpLastSimGoalStatus = simGoalStatus;

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

    if (typeof window.renderGoalLumpsumPartitionTable === 'function') {
        window.renderGoalLumpsumPartitionTable();
    }
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
        window.setControlVal('inp-sip-duration', 20);
        window.setControlVal('inp-stepup', 5);
        window.setControlVal('inp-pre-irr', 12);
        window.setControlVal('inp-post-irr', 6);
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
        sip_duration_yrs: gInt('inp-sip-duration', Math.max(1, (gInt('inp-ret-age', 60) + gInt('inp-pension-delay', 0)) - gInt('inp-age', 40))),
        sip_step_up: gNum('inp-stepup', 0),
        pre_ret_irr: gNum('inp-pre-irr', 12.0),
        post_ret_irr: gNum('inp-post-irr', 6.0),
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
    const activePlanTitle = document.getElementById('active-plan-title');
    if (activePlanTitle) activePlanTitle.innerText = plan.plan_name;
    if (typeof window.refreshPlansCount === 'function') window.refreshPlansCount();

    window.setControlVal('inp-age', plan.current_age || 0);
    window.setControlVal('inp-ret-age', plan.retirement_age || 0);
    window.setControlVal('inp-exhaustion-expected', plan.life_expectancy || 100);
    window.setControlVal('inp-expense', plan.current_expense || 0);
    window.setControlVal('inp-initial-corpus', plan.initial_corpus || 0);
    window.setControlVal('inp-initial-sip', plan.initial_sip || 0);

    const defaultSipDuration = Math.max(1, (plan.retirement_age || 60) + (plan.pension_delay_yrs || 0) - (plan.current_age || 40));
    window.setControlVal('inp-sip-duration', plan.sip_duration_yrs !== undefined ? plan.sip_duration_yrs : defaultSipDuration);

    window.setControlVal('inp-stepup', plan.sip_step_up || 0);
    window.setControlVal('inp-pre-irr', plan.pre_ret_irr || 12.0);
    window.setControlVal('inp-post-irr', plan.post_ret_irr || 6.0);
    window.setControlVal('inp-inflation', plan.inflation_rate || 6.5);
    window.setControlVal('inp-init-equity', plan.initial_equity_pct !== undefined ? plan.initial_equity_pct : 80);
    window.setControlVal('inp-glide-start', plan.glide_start_months !== undefined ? plan.glide_start_months : 108);
    window.setControlVal('inp-glide-end', plan.glide_end_months !== undefined ? plan.glide_end_months : 12);
    window.setControlVal('inp-pension-delay', plan.pension_delay_yrs || 0);

    const solverModeEl = document.getElementById('inp-solver-mode');
    if (solverModeEl && plan.solver_mode) solverModeEl.value = plan.solver_mode;
    window.toggleExhaustionAge();

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
        alert('Retirement Age should be greater than Current Age. Please adjust in Card 4 (Retirement Expenses & Targets).');
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
        ['inp-age', 'inp-ret-age', 'inp-sip-duration', 'inp-initial-corpus', 'inp-initial-sip', 'inp-stepup', 'inp-expense'].forEach(id => {
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
        alert('Please log in or register to save your plan.');
        return;
    }

    const saveBtn = document.getElementById('btn-save-plan');
    const pmSaveBtn = document.getElementById('btn-pm-save');
    const origHtml = saveBtn ? saveBtn.innerHTML : '';
    const origPmHtml = pmSaveBtn ? pmSaveBtn.innerHTML : '';
    if (saveBtn) { saveBtn.innerHTML = 'Saving...'; saveBtn.disabled = true; }
    if (pmSaveBtn) { pmSaveBtn.innerHTML = 'Saving...'; pmSaveBtn.disabled = true; }

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
        if (saveBtn) saveBtn.innerHTML = '✓ Plan Saved';
        if (pmSaveBtn) pmSaveBtn.innerHTML = '✓ Saved';
        if (typeof window.showPlanToast === 'function') {
            window.showPlanToast(`Plan "${window.fpAuth.activePlanName || 'My Life Plan'}" saved successfully!`);
        }
        setTimeout(() => {
            if (saveBtn) { saveBtn.innerHTML = origHtml; saveBtn.disabled = false; }
            if (pmSaveBtn) { pmSaveBtn.innerHTML = origPmHtml; pmSaveBtn.disabled = false; }
        }, 1800);
        if (typeof window.refreshPlansCount === 'function') {
            await window.refreshPlansCount();
        }
    } catch (err) {
        console.error('Manual save error:', err);
        alert('Failed to save plan: ' + err.message);
        if (pill) {
            pill.classList.remove('syncing');
            if (pillText) pillText.innerText = 'Offline';
        }
        if (saveBtn) { saveBtn.innerHTML = origHtml; saveBtn.disabled = false; }
        if (pmSaveBtn) { pmSaveBtn.innerHTML = origPmHtml; pmSaveBtn.disabled = false; }
    }
};

// ==========================================================================
// GOAL-BASED GLIDE PATH & LUMPSUM PARTITION ENGINE (EXCEL MATHEMATICAL MODEL)
// ==========================================================================

window.calculateGoalLumpsumGlide = function calculateGoalLumpsumGlide(monthsToGoal, goalAmount, customOptions = {}) {
    const months = Math.max(1, Math.round(monthsToGoal || 1));
    const targetAmt = parseFloat(goalAmount) || 0;

    // Read current planner parameters
    const initEquity = parseFloat(document.getElementById('inp-init-equity')?.value);
    const initEq = customOptions.initEquity !== undefined ? customOptions.initEquity : (isNaN(initEquity) ? 80 : initEquity);

    // Read de-risking window controls from Card 3
    const cfgGlideStart = parseInt(document.getElementById('inp-glide-start')?.value) || 108;
    const cfgGlideEnd = parseInt(document.getElementById('inp-glide-end')?.value) || 12;

    const glideStartM = customOptions.glideStartMonth !== undefined ? customOptions.glideStartMonth : cfgGlideStart;
    const glideEndM = customOptions.glideEndMonth !== undefined ? customOptions.glideEndMonth : cfgGlideEnd;

    // Effective glide window adjusted for this goal's horizon if horizon is shorter than glide start
    const effGlideStart = Math.min(glideStartM, months);
    const effGlideEnd = Math.min(glideEndM, Math.max(0, Math.floor(effGlideStart / 4)));

    const preIrrVal = parseFloat(document.getElementById('inp-pre-irr')?.value);
    const equityIRR = customOptions.equityIRR !== undefined 
        ? customOptions.equityIRR 
        : ((isNaN(preIrrVal) ? 12.0 : preIrrVal) / 100);

    const postIrrVal = parseFloat(document.getElementById('inp-post-irr')?.value);
    const debtIRR = customOptions.debtIRR !== undefined 
        ? customOptions.debtIRR 
        : ((isNaN(postIrrVal) ? 6.0 : postIrrVal) / 100);

    // Cumulative discount calculation: product of (1 + monthly discount) from 1 to months
    let cumulativeFactor = 1.0;
    for (let m = 1; m <= months; m++) {
        // mLeft is months from goal achievement: for discounting month m, mLeft = months - m
        const mLeft = months - m;
        const alloc = calcGlideAllocation(mLeft, initEq, effGlideStart, effGlideEnd);
        const dPct = alloc.debtPct;
        const ePct = alloc.equityPct;
        const annualReturn = (dPct / 100) * debtIRR + (ePct / 100) * equityIRR;
        const monthlyRate = annualReturn / 12;
        cumulativeFactor *= (1 + monthlyRate);
    }

    const pv = cumulativeFactor > 0 ? (targetAmt / cumulativeFactor) : targetAmt;

    // Today's asset allocation (based on months remaining today)
    const todayAlloc = calcGlideAllocation(months, initEq, effGlideStart, effGlideEnd);
    const currentDebtPct = todayAlloc.debtPct;
    const currentEquityPct = todayAlloc.equityPct;
    const debtValue = pv * (currentDebtPct / 100);
    const equityValue = pv * (currentEquityPct / 100);
    const currentAnnualReturn = (currentDebtPct / 100) * debtIRR + (currentEquityPct / 100) * equityIRR;
    const currentMonthlyRate = currentAnnualReturn / 12;

    return {
        monthsToGoal: months,
        goalAmount: targetAmt,
        pv,
        debtPct: currentDebtPct,
        equityPct: currentEquityPct,
        debtValue,
        equityValue,
        annualReturn: currentAnnualReturn,
        monthlyRate: currentMonthlyRate,
        cumulativeFactor,
        glideStartM: effGlideStart,
        glideEndM: effGlideEnd
    };
};

window.calculateRetirementMonthlyStreamLumpsum = function calculateRetirementMonthlyStreamLumpsum(customOptions = {}) {
    const isRetEnabled = window.fpRetirementEnabled !== false;
    if (!isRetEnabled) {
        return {
            enabled: false,
            totalPV: 0,
            totalDebt: 0,
            totalEquity: 0,
            overallDebtPct: 0,
            overallEquityPct: 0,
            totalMonths: 0,
            monthlySchedule: []
        };
    }

    const age = parseInt(document.getElementById('inp-age')?.value) || 30;
    const retAge = parseInt(document.getElementById('inp-ret-age')?.value) || 60;
    const pensionDelay = parseInt(document.getElementById('inp-pension-delay')?.value) || 0;
    const expenseToday = parseFloat(document.getElementById('inp-expense')?.value) || 40000;
    const inflation = (parseFloat(document.getElementById('inp-inflation')?.value) || 7.0) / 100;
    const exhaustionAge = parseInt(document.getElementById('inp-exhaustion-expected')?.value) || 85;

    const startAge = retAge + pensionDelay;
    const startMonthFromToday = Math.max(0, (startAge - age) * 12);
    const totalRetMonths = Math.max(0, (exhaustionAge - startAge) * 12);

    if (totalRetMonths <= 0 || expenseToday <= 0) {
        return {
            enabled: true,
            totalPV: 0,
            totalDebt: 0,
            totalEquity: 0,
            overallDebtPct: 0,
            overallEquityPct: 0,
            totalMonths: 0,
            monthlySchedule: []
        };
    }

    let totalPV = 0;
    let totalDebt = 0;
    let totalEquity = 0;
    const monthlySchedule = [];

    for (let t = 1; t <= totalRetMonths; t++) {
        const m = startMonthFromToday + t;
        const inflatedExpense = expenseToday * Math.pow(1 + inflation, m / 12);
        const res = window.calculateGoalLumpsumGlide(m, inflatedExpense, customOptions);

        totalPV += res.pv;
        totalDebt += res.debtValue;
        totalEquity += res.equityValue;

        monthlySchedule.push({
            payoutMonthIndex: t,
            ageAtPayout: (age + m / 12).toFixed(1),
            monthsToPayout: m,
            payoutAmount: inflatedExpense,
            pv: res.pv,
            debtPct: res.debtPct,
            debtValue: res.debtValue,
            equityPct: res.equityPct,
            equityValue: res.equityValue,
            monthlyRate: res.monthlyRate
        });
    }

    const overallDebtPct = totalPV > 0 ? (totalDebt / totalPV) * 100 : 0;
    const overallEquityPct = totalPV > 0 ? (totalEquity / totalPV) * 100 : 0;

    return {
        enabled: true,
        totalPV,
        totalDebt,
        totalEquity,
        overallDebtPct,
        overallEquityPct,
        totalMonths: totalRetMonths,
        monthlySchedule,
        startAge,
        exhaustionAge,
        expenseToday
    };
};

window.renderGoalLumpsumPartitionTable = function renderGoalLumpsumPartitionTable() {
    const tbody = document.getElementById('goal-partition-tbody');
    const tfoot = document.getElementById('goal-partition-tfoot');
    const kpiLumpsum = document.getElementById('pkpi-total-lumpsum');
    const kpiDebt = document.getElementById('pkpi-total-debt');
    const kpiEquity = document.getElementById('pkpi-total-equity');
    if (!tbody) return;

    const currentAge = parseInt(document.getElementById('inp-age')?.value) || 30;
    const currentYear = new Date().getFullYear();
    const milestones = window.fpMilestones || [];

    let totalPortfolioPV = 0;
    let totalPortfolioDebt = 0;
    let totalPortfolioEquity = 0;
    let rowsHtml = '';

    // 1. Process discrete milestone goals
    milestones.forEach((g) => {
        const targetAge = g.target_age || (currentAge + 5);
        const targetYear = g.target_year || (currentYear + (targetAge - currentAge));
        const months = Math.max(1, (targetAge - currentAge) * 12);
        const pvAmount = parseFloat(g.present_value) || 0;
        const inf = (parseFloat(g.inflation_rate) || 7.0) / 100;
        const inflatedGoalAmount = pvAmount * Math.pow(1 + inf, months / 12);

        const res = window.calculateGoalLumpsumGlide(months, inflatedGoalAmount);

        totalPortfolioPV += res.pv;
        totalPortfolioDebt += res.debtValue;
        totalPortfolioEquity += res.equityValue;

        const mixClass = res.debtPct >= 80 ? 'mix-pure-debt' : (res.equityPct >= 70 ? 'mix-pure-eq' : 'mix-glide');

        rowsHtml += `
            <tr>
                <td>
                    <div style="font-weight: 700; color: var(--brand-navy);">${escapeHtml(g.name || 'Life Milestone')}</div>
                    <div class="fp-table-mobile-sub">Age ${targetAge} (${targetYear}) • ${months} mos</div>
                </td>
                <td>Age ${targetAge} (${targetYear}) • ${months} mos</td>
                <td style="font-weight: 700; color: var(--brand-navy);">${fmtINR_plain(inflatedGoalAmount)}</td>
                <td style="background: rgba(16, 185, 129, 0.04);">
                    <span class="badge-partition-mix mix-pure-debt" style="font-weight: 700; background: #dcfce7; color: #15803d; border: 1px solid #86efac;">
                        100% Debt / 0% Equity
                    </span>
                    <div style="font-size: 11px; color: #15803d; margin-top: 2px; font-weight: 600;">
                        ${fmtINR_plain(inflatedGoalAmount)} in Debt
                    </div>
                </td>
                <td style="color: var(--brand-blue); font-weight: 800; font-size: 13.5px;">${fmtINR_plain(res.pv)}</td>
                <td>
                    <span class="badge-partition-mix ${mixClass}">
                        ${res.equityPct.toFixed(0)}% Eq / ${res.debtPct.toFixed(0)}% Dt
                    </span>
                </td>
                <td style="color: #059669; font-weight: 600;">${fmtINR_plain(res.debtValue)}</td>
                <td style="color: #4f46e5; font-weight: 600;">${fmtINR_plain(res.equityValue)}</td>
                <td>
                    <button type="button" class="fp-btn-view-schedule" onclick="openGoalScheduleModal('${g.id}')">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                        View Glide Schedule
                    </button>
                </td>
            </tr>
        `;
    });

    // 2. Process Retirement Recurring Stream
    const retRes = window.calculateRetirementMonthlyStreamLumpsum();
    window.fpLatestRetSchedule = retRes.monthlySchedule || [];

    if (retRes.enabled && retRes.totalMonths > 0) {
        totalPortfolioPV += retRes.totalPV;
        totalPortfolioDebt += retRes.totalDebt;
        totalPortfolioEquity += retRes.totalEquity;

        rowsHtml += `
            <tr style="background: rgba(2, 132, 199, 0.04);">
                <td>
                    <div style="font-weight: 700; color: var(--brand-navy);">Retirement Monthly Pension Stream</div>
                    <div style="font-size: 11px; color: var(--text-tertiary);">${retRes.totalMonths} Monthly Payouts</div>
                    <div class="fp-table-mobile-sub">Age ${retRes.startAge} &rarr; ${retRes.exhaustionAge}</div>
                </td>
                <td>Age ${retRes.startAge} &rarr; ${retRes.exhaustionAge} (${retRes.totalMonths} mos)</td>
                <td style="font-weight: 700; color: var(--brand-navy);">${fmtINR_plain(retRes.expenseToday)} / mo inflated</td>
                <td style="background: rgba(16, 185, 129, 0.04);">
                    <span class="badge-partition-mix mix-pure-debt" style="font-weight: 700; background: #dcfce7; color: #15803d; border: 1px solid #86efac;">
                        100% Debt / 0% Equity
                    </span>
                    <div style="font-size: 11px; color: #15803d; margin-top: 2px; font-weight: 600;">
                        100% De-risked at Each Payout
                    </div>
                </td>
                <td style="color: var(--brand-blue); font-weight: 800; font-size: 13.5px;">${fmtINR_plain(retRes.totalPV)}</td>
                <td>
                    <span class="badge-partition-mix mix-pure-debt">
                        ${retRes.overallEquityPct.toFixed(0)}% Eq / ${retRes.overallDebtPct.toFixed(0)}% Dt
                    </span>
                </td>
                <td style="color: #059669; font-weight: 600;">${fmtINR_plain(retRes.totalDebt)}</td>
                <td style="color: #4f46e5; font-weight: 600;">${fmtINR_plain(retRes.totalEquity)}</td>
                <td>
                    <button type="button" class="fp-btn-view-schedule" onclick="openRetScheduleModal()">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                        View Monthly Schedule
                    </button>
                </td>
            </tr>
        `;
    }

    if (rowsHtml === '') {
        rowsHtml = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: var(--text-tertiary);">No goals or retirement configured yet. Add a life goal above or enable retirement.</td></tr>`;
    }

    tbody.innerHTML = rowsHtml;

    // Overall portfolio percentages
    const overallDebtPct = totalPortfolioPV > 0 ? (totalPortfolioDebt / totalPortfolioPV) * 100 : 0;
    const overallEqPct = totalPortfolioPV > 0 ? (totalPortfolioEquity / totalPortfolioPV) * 100 : 0;

    // 3. Render Table Footer (Totals)
    if (tfoot) {
        if (totalPortfolioPV > 0) {
            tfoot.innerHTML = `
                <tr>
                    <td style="font-weight: 700; color: var(--brand-navy);">Consolidated Portfolio</td>
                    <td style="color: var(--text-tertiary); font-size: 11px;">All Goals Combined</td>
                    <td style="color: var(--brand-navy); font-weight: 700;">-</td>
                    <td style="color: #15803d; font-weight: 800; background: rgba(16, 185, 129, 0.06);">100% Debt at Specified Ages</td>
                    <td style="color: var(--brand-blue); font-size: 14px; font-weight: 800;">${fmtINR_plain(totalPortfolioPV)}</td>
                    <td><span class="badge-partition-mix mix-pure-debt">${overallEqPct.toFixed(0)}% Eq / ${overallDebtPct.toFixed(0)}% Dt</span></td>
                    <td style="color: #059669; font-size: 14px; font-weight: 800;">${fmtINR_plain(totalPortfolioDebt)}</td>
                    <td style="color: #4f46e5; font-size: 14px; font-weight: 800;">${fmtINR_plain(totalPortfolioEquity)}</td>
                    <td style="font-weight: 700; color: #059669;">100% Protected</td>
                </tr>
            `;
        } else {
            tfoot.innerHTML = '';
        }
    }

    // 4. Update Header KPI Cards
    if (kpiLumpsum) kpiLumpsum.innerText = fmtINR_plain(totalPortfolioPV);
    if (kpiDebt) kpiDebt.innerText = `${fmtINR_plain(totalPortfolioDebt)} (${overallDebtPct.toFixed(1)}%)`;
    if (kpiEquity) kpiEquity.innerText = `${fmtINR_plain(totalPortfolioEquity)} (${overallEqPct.toFixed(1)}%)`;

    // Store latest portfolio total on window
    window.fpLatestGoalLumpsumTotal = {
        totalPV: totalPortfolioPV,
        totalDebt: totalPortfolioDebt,
        totalEquity: totalPortfolioEquity,
        overallDebtPct,
        overallEqPct
    };

    // Also trigger Asset Accumulation Table update
    if (typeof window.renderAssetAccumulationTable === 'function') {
        window.renderAssetAccumulationTable();
    }
};

// ==========================================================================
// GOAL ASSET ACCUMULATION SCHEDULE (LUMPSUM MODE)
// Forward projection showing how lumpsum accumulates to fulfill the goal
// ==========================================================================

window.fpAccumulationViewMode = 'annual'; // 'annual' | 'monthly'

window.setAccumulationViewMode = function setAccumulationViewMode(mode) {
    window.fpAccumulationViewMode = mode;
    const btnAnnual = document.getElementById('btn-accum-annual');
    const btnMonthly = document.getElementById('btn-accum-monthly');
    if (btnAnnual) btnAnnual.classList.toggle('active', mode === 'annual');
    if (btnMonthly) btnMonthly.classList.toggle('active', mode === 'monthly');
    const tableEl = document.getElementById('asset-accumulation-table');
    const wrap = tableEl ? tableEl.closest('.fp-partition-table-wrap') : null;
    if (wrap) wrap.scrollLeft = 0;
    window.renderAssetAccumulationTable();
};

window.renderAssetAccumulationTable = function renderAssetAccumulationTable() {
    const tableEl = document.getElementById('asset-accumulation-table');
    const theadEl = document.getElementById('asset-accumulation-thead');
    const tbodyEl = document.getElementById('asset-accumulation-tbody');
    const tfootEl = document.getElementById('asset-accumulation-tfoot');
    const selGoal = document.getElementById('sel-accum-goal');
    if (!tbodyEl) return;

    const currentAge = parseInt(document.getElementById('inp-age')?.value) || 30;
    const currentYear = new Date().getFullYear();
    const milestones = window.fpMilestones || [];
    const isRetEnabled = window.fpRetirementEnabled !== false;

    // Planner parameters
    const initEquity = parseFloat(document.getElementById('inp-init-equity')?.value);
    const initEq = isNaN(initEquity) ? 80 : initEquity;
    const cfgGlideStart = parseInt(document.getElementById('inp-glide-start')?.value) || 108;
    const cfgGlideEnd = parseInt(document.getElementById('inp-glide-end')?.value) || 12;
    const preIrrVal = parseFloat(document.getElementById('inp-pre-irr')?.value);
    const equityIRR = (isNaN(preIrrVal) ? 12.0 : preIrrVal) / 100;
    const postIrrVal = parseFloat(document.getElementById('inp-post-irr')?.value);
    const debtIRR = (isNaN(postIrrVal) ? 6.0 : postIrrVal) / 100;

    // 1. Populate / sync goal selector dropdown
    if (selGoal) {
        const currentSelectedVal = selGoal.value;
        let optHtml = `<option value="all">All Goals (Consolidated Lumpsum)</option>`;

        milestones.forEach((g) => {
            const targetAge = g.target_age || (currentAge + 5);
            const targetYear = g.target_year || (currentYear + (targetAge - currentAge));
            optHtml += `<option value="${g.id}">${escapeHtml(g.name || 'Life Milestone')} (Age ${targetAge} • ${targetYear})</option>`;
        });

        if (isRetEnabled) {
            const retAge = parseInt(document.getElementById('inp-ret-age')?.value) || 60;
            const pensionDelay = parseInt(document.getElementById('inp-pension-delay')?.value) || 0;
            const exAge = parseInt(document.getElementById('inp-exhaustion-expected')?.value) || 85;
            optHtml += `<option value="retirement">Retirement Monthly Pension Stream (Age ${retAge + pensionDelay} - ${exAge})</option>`;
        }

        selGoal.innerHTML = optHtml;
        if (currentSelectedVal && selGoal.querySelector(`option[value="${currentSelectedVal}"]`)) {
            selGoal.value = currentSelectedVal;
        }
    }

    const selectedGoalId = selGoal ? selGoal.value : 'all';
    const viewMode = window.fpAccumulationViewMode || 'annual';

    // Helper: compute month-by-month accumulation for a single goal
    function getSingleGoalMonthAccumulation(targetAge, pvAmount, inflationRate, goalName) {
        const months = Math.max(1, (targetAge - currentAge) * 12);
        const inflatedFV = pvAmount * Math.pow(1 + inflationRate, months / 12);
        const lump = window.calculateGoalLumpsumGlide(months, inflatedFV);
        const initialPV = lump.pv;

        const effGlideStart = Math.min(cfgGlideStart, months);
        const effGlideEnd = Math.min(cfgGlideEnd, Math.max(0, Math.floor(effGlideStart / 4)));

        let curBal = initialPV;
        const monthsList = [];

        for (let m = 1; m <= months; m++) {
            const remMonths = months - m; // 0 at maturity month
            const alloc = calcGlideAllocation(remMonths, initEq, effGlideStart, effGlideEnd);
            const dPct = alloc.debtPct;
            const ePct = alloc.equityPct;
            const annualReturn = (dPct / 100) * debtIRR + (ePct / 100) * equityIRR;
            const monthlyRate = annualReturn / 12;

            const openBal = curBal;
            const debtPortion = openBal * (dPct / 100);
            const equityPortion = openBal * (ePct / 100);
            const growth = openBal * monthlyRate;
            const closeBal = openBal + growth;
            curBal = closeBal;

            monthsList.push({
                month: m,
                remMonths: remMonths,
                age: (currentAge + m / 12).toFixed(1),
                year: currentYear + Math.floor(m / 12),
                openBal,
                debtPct: dPct,
                equityPct: ePct,
                debtPortion,
                equityPortion,
                growth,
                closeBal,
                monthlyRate,
                isMaturity: (m === months),
                targetFV: inflatedFV,
                goalName: goalName
            });
        }

        return {
            months,
            targetAge,
            targetFV: inflatedFV,
            initialPV,
            totalGrowth: curBal - initialPV,
            monthsList
        };
    }

    // 2. Build the data depending on selection
    let activeGoalsData = [];

    if (selectedGoalId === 'all') {
        milestones.forEach((g) => {
            const targetAge = g.target_age || (currentAge + 5);
            const pvAmount = parseFloat(g.present_value) || 0;
            const inf = (parseFloat(g.inflation_rate) || 7.0) / 100;
            if (pvAmount > 0) {
                activeGoalsData.push(getSingleGoalMonthAccumulation(targetAge, pvAmount, inf, g.name || 'Life Milestone'));
            }
        });
    } else if (selectedGoalId === 'retirement') {
        const retRes = window.calculateRetirementMonthlyStreamLumpsum();
        if (retRes.enabled && retRes.totalMonths > 0) {
            const expenseToday = retRes.expenseToday;
            const inflation = (parseFloat(document.getElementById('inp-inflation')?.value) || 7.0) / 100;
            const startMonth = Math.max(0, (retRes.startAge - currentAge) * 12);

            for (let t = 1; t <= retRes.totalMonths; t++) {
                const totalM = startMonth + t;
                const payoutAmt = expenseToday * Math.pow(1 + inflation, totalM / 12);
                activeGoalsData.push(getSingleGoalMonthAccumulation(currentAge + totalM / 12, payoutAmt / Math.pow(1 + inflation, totalM / 12), inflation, `Retirement Payout M${t}`));
            }
        }
    } else {
        const g = milestones.find(m => m.id === selectedGoalId);
        if (g) {
            const targetAge = g.target_age || (currentAge + 5);
            const pvAmount = parseFloat(g.present_value) || 0;
            const inf = (parseFloat(g.inflation_rate) || 7.0) / 100;
            activeGoalsData.push(getSingleGoalMonthAccumulation(targetAge, pvAmount, inf, g.name || 'Life Milestone'));
        }
    }

    // Check empty state
    if (activeGoalsData.length === 0) {
        if (theadEl) theadEl.innerHTML = '';
        tbodyEl.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 28px; color: var(--text-tertiary);">No milestone goals available. Add a goal above to view its lumpsum accumulation schedule.</td></tr>`;
        if (tfootEl) tfootEl.innerHTML = '';
        return;
    }

    // Calculate Summary KPIs
    let totalInitialPV = 0;
    let totalTargetFV = 0;
    let maxMonths = 0;

    activeGoalsData.forEach((gd) => {
        totalInitialPV += gd.initialPV;
        totalTargetFV += gd.targetFV;
        if (gd.months > maxMonths) maxMonths = gd.months;
    });

    const totalGrowth = totalTargetFV - totalInitialPV;
    const growthPct = totalInitialPV > 0 ? (totalGrowth / totalInitialPV) * 100 : 0;

    const kpiPv = document.getElementById('accum-kpi-pv');
    const kpiGrowth = document.getElementById('accum-kpi-growth');
    const kpiTarget = document.getElementById('accum-kpi-target');

    if (kpiPv) kpiPv.innerText = fmtINR_plain(totalInitialPV);
    if (kpiGrowth) kpiGrowth.innerHTML = `${fmtINR_plain(totalGrowth)} <span style="font-size:11px; font-weight:600; color:#16a34a;">(+${growthPct.toFixed(1)}%)</span>`;
    if (kpiTarget) kpiTarget.innerText = fmtINR_plain(totalTargetFV);

    // 3. Render Table
    if (viewMode === 'annual') {
        if (theadEl) {
            theadEl.innerHTML = `
                <tr>
                    <th>Timeline (Year)</th>
                    <th>Age</th>
                    <th>Time Remaining</th>
                    <th>Beginning Asset (₹)</th>
                    <th>Asset Partition (Mix)</th>
                    <th>Equity Balance (₹)</th>
                    <th>Debt Balance (₹)</th>
                    <th>Yearly Growth (₹)</th>
                    <th>Ending Asset (₹)</th>
                    <th style="background: rgba(16, 185, 129, 0.08); color: #065f46;">Goal Fulfillment (100% Debt)</th>
                </tr>
            `;
        }

        const totalYears = Math.ceil(maxMonths / 12);
        let rowsHtml = '';
        let cumReturnsAll = 0;

        for (let y = 1; y <= totalYears; y++) {
            const startM = (y - 1) * 12 + 1;
            const endM = Math.min(y * 12, maxMonths);
            const yearAgeStart = currentAge + y - 1;
            const yearAgeEnd = currentAge + y;
            const yearCalendar = currentYear + y - 1;

            let yearOpenBal = 0;
            let yearCloseBal = 0;
            let yearGrowth = 0;
            let yearEndDebtBal = 0;
            let yearEndEqBal = 0;
            let maturedGoalsInYear = [];

            activeGoalsData.forEach((gd) => {
                if (gd.months >= startM) {
                    const monthObjStart = gd.monthsList[startM - 1];
                    if (monthObjStart) yearOpenBal += monthObjStart.openBal;

                    const effectiveEndM = Math.min(endM, gd.months);
                    const monthObjEnd = gd.monthsList[effectiveEndM - 1];
                    if (monthObjEnd) {
                        yearCloseBal += monthObjEnd.closeBal;
                        yearEndDebtBal += monthObjEnd.closeBal * (monthObjEnd.debtPct / 100);
                        yearEndEqBal += monthObjEnd.closeBal * (monthObjEnd.equityPct / 100);
                    }

                    for (let m = startM; m <= effectiveEndM; m++) {
                        if (gd.monthsList[m - 1]) {
                            yearGrowth += gd.monthsList[m - 1].growth;
                        }
                    }

                    if (gd.months >= startM && gd.months <= endM) {
                        maturedGoalsInYear.push({
                            name: gd.monthsList[0]?.goalName || 'Goal',
                            age: gd.targetAge,
                            fv: gd.targetFV
                        });
                    }
                }
            });

            cumReturnsAll += yearGrowth;
            const endDebtPct = yearCloseBal > 0 ? (yearEndDebtBal / yearCloseBal) * 100 : 0;
            const endEqPct = yearCloseBal > 0 ? (yearEndEqBal / yearCloseBal) * 100 : 0;
            const mixClass = endDebtPct >= 80 ? 'mix-pure-debt' : (endEqPct >= 70 ? 'mix-pure-eq' : 'mix-glide');

            const isMaturityRow = maturedGoalsInYear.length > 0;
            const trClass = isMaturityRow ? 'row-maturity-fulfilled' : '';

            let fulfillHtml = `<span style="color: var(--text-tertiary); font-size: 11.5px;">Compounding in growth phase</span>`;
            if (isMaturityRow) {
                fulfillHtml = maturedGoalsInYear.map(mg => `
                    <div style="color: #15803d; font-weight: 700; font-size: 12px;">
                        Fulfilled: ${escapeHtml(mg.name)} at Age ${mg.age} (${fmtINR_plain(mg.fv)}) in <strong>100% Debt</strong>
                    </div>
                `).join('');
            }

            const remYears = Math.max(0, totalYears - y);
            const remLabel = remYears === 0 ? 'Goal Achieved' : `${remYears} yr${remYears > 1 ? 's' : ''} left`;

            rowsHtml += `
                <tr class="${trClass}">
                    <td>
                        <div style="font-weight: 700; color: var(--brand-navy);">Year ${y} (${yearCalendar})</div>
                        <div class="fp-table-mobile-sub">Age ${yearAgeStart}&rarr;${yearAgeEnd} • ${remLabel}</div>
                    </td>
                    <td>Age ${yearAgeStart} &rarr; ${yearAgeEnd}</td>
                    <td style="color: var(--text-secondary); font-size: 12px;">${remLabel}</td>
                    <td style="font-weight: 600;">${fmtINR_plain(yearOpenBal)}</td>
                    <td>
                        <span class="badge-partition-mix ${mixClass}">
                            ${endEqPct.toFixed(0)}% Eq / ${endDebtPct.toFixed(0)}% Dt
                        </span>
                    </td>
                    <td style="color: #4f46e5; font-weight: 600;">${fmtINR_plain(yearEndEqBal)}</td>
                    <td style="color: #059669; font-weight: 600;">${fmtINR_plain(yearEndDebtBal)}</td>
                    <td style="color: #2563eb; font-weight: 700;">+${fmtINR_plain(yearGrowth)}</td>
                    <td style="font-weight: 800; color: var(--brand-navy); font-size: 13.5px;">${fmtINR_plain(yearCloseBal)}</td>
                    <td style="background: rgba(16, 185, 129, 0.04);">${fulfillHtml}</td>
                </tr>
            `;
        }

        tbodyEl.innerHTML = rowsHtml;

        if (tfootEl) {
            tfootEl.innerHTML = `
                <tr>
                    <td style="font-weight: 700; color: var(--brand-navy);">Lumpsum Summary</td>
                    <td>-</td>
                    <td>-</td>
                    <td style="font-weight: 800; color: var(--brand-blue);">${fmtINR_plain(totalInitialPV)} (PV)</td>
                    <td><span class="badge-partition-mix mix-pure-debt">100% Debt</span></td>
                    <td style="color: #4f46e5; font-weight: 600;">-</td>
                    <td style="color: #059669; font-weight: 600;">Protected</td>
                    <td style="color: #2563eb; font-weight: 800;">+${fmtINR_plain(cumReturnsAll)}</td>
                    <td style="font-weight: 800; color: #15803d; font-size: 14px;">${fmtINR_plain(totalTargetFV)}</td>
                    <td style="font-weight: 800; color: #15803d;">100% Debt</td>
                </tr>
            `;
        }

    } else {
        // Monthly View (Matches Excel Screenshot 2 fidelity)
        if (theadEl) {
            theadEl.innerHTML = `
                <tr>
                    <th>Month #</th>
                    <th>Age</th>
                    <th>Months to Goal</th>
                    <th>Opening Value (₹)</th>
                    <th style="background: rgba(16, 185, 129, 0.08); color: #065f46;">Debt %</th>
                    <th>Debt Balance (₹)</th>
                    <th>Equity %</th>
                    <th>Equity Balance (₹)</th>
                    <th>Monthly Return (₹)</th>
                    <th>Ending Value (₹)</th>
                    <th>Status</th>
                </tr>
            `;
        }

        let rowsHtml = '';
        let cumMonthGrowth = 0;

        for (let m = 1; m <= maxMonths; m++) {
            let mOpenBal = 0;
            let mCloseBal = 0;
            let mDebtBal = 0;
            let mEqBal = 0;
            let mGrowth = 0;
            let maturedInMonth = [];

            activeGoalsData.forEach((gd) => {
                if (gd.months >= m) {
                    const row = gd.monthsList[m - 1];
                    if (row) {
                        mOpenBal += row.openBal;
                        mCloseBal += row.closeBal;
                        mDebtBal += row.debtPortion;
                        mEqBal += row.equityPortion;
                        mGrowth += row.growth;
                        if (row.isMaturity) {
                            maturedInMonth.push({
                                name: row.goalName,
                                age: row.age,
                                fv: row.targetFV
                            });
                        }
                    }
                }
            });

            cumMonthGrowth += mGrowth;
            const mDebtPct = mOpenBal > 0 ? (mDebtBal / mOpenBal) * 100 : 0;
            const mEqPct = mOpenBal > 0 ? (mEqBal / mOpenBal) * 100 : 0;
            const mixClass = mDebtPct >= 80 ? 'mix-pure-debt' : (mEqPct >= 70 ? 'mix-pure-eq' : 'mix-glide');

            const isMaturityRow = maturedInMonth.length > 0;
            const trClass = isMaturityRow ? 'row-maturity-fulfilled' : '';

            let statusHtml = `<span style="color: var(--text-tertiary); font-size: 11px;">Glide Month ${m}</span>`;
            if (isMaturityRow) {
                statusHtml = maturedInMonth.map(mg => `
                    <span style="color: #15803d; font-weight: 700; font-size: 11.5px;">
                        Fulfilled: ${escapeHtml(mg.name)} (100% Debt)
                    </span>
                `).join('<br/>');
            }

            const remM = maxMonths - m;
            const remLabel = remM === 0 ? '0 mos (Maturity)' : `${remM} mos`;
            const ageDisplay = (currentAge + m / 12).toFixed(1);

            rowsHtml += `
                <tr class="${trClass}">
                    <td>
                        <div style="font-weight: 700; color: var(--brand-navy);">Month ${m}</div>
                        <div class="fp-table-mobile-sub">Age ${ageDisplay} • ${remLabel}</div>
                    </td>
                    <td>Age ${ageDisplay}</td>
                    <td style="color: var(--text-secondary); font-size: 12px;">${remLabel}</td>
                    <td style="font-weight: 600;">${fmtINR_plain(mOpenBal)}</td>
                    <td style="background: rgba(16, 185, 129, 0.04);">
                        <span class="badge-partition-mix ${mixClass}">
                            ${mDebtPct.toFixed(1)}%
                        </span>
                    </td>
                    <td style="color: #059669; font-weight: 600;">${fmtINR_plain(mDebtBal)}</td>
                    <td>
                        <span class="badge-partition-mix ${mixClass}">
                            ${mEqPct.toFixed(1)}%
                        </span>
                    </td>
                    <td style="color: #4f46e5; font-weight: 600;">${fmtINR_plain(mEqBal)}</td>
                    <td style="color: #2563eb; font-weight: 600;">+${fmtINR_plain(mGrowth)}</td>
                    <td style="font-weight: 800; color: var(--brand-navy); font-size: 13px;">${fmtINR_plain(mCloseBal)}</td>
                    <td>${statusHtml}</td>
                </tr>
            `;
        }

        tbodyEl.innerHTML = rowsHtml;

        if (tfootEl) {
            tfootEl.innerHTML = `
                <tr>
                    <td style="font-weight: 700; color: var(--brand-navy);">Lumpsum Total</td>
                    <td>-</td>
                    <td>-</td>
                    <td style="font-weight: 800; color: var(--brand-blue);">${fmtINR_plain(totalInitialPV)} (PV)</td>
                    <td style="color: #15803d; font-weight: 700;">100% Debt</td>
                    <td>-</td>
                    <td style="color: #64748b;">0% Eq</td>
                    <td>-</td>
                    <td style="color: #2563eb; font-weight: 800;">+${fmtINR_plain(cumMonthGrowth)}</td>
                    <td style="font-weight: 800; color: #15803d; font-size: 14px;">${fmtINR_plain(totalTargetFV)}</td>
                    <td style="font-weight: 800; color: #15803d;">Protected</td>
                </tr>
            `;
        }
    }
};

window.openGoalScheduleModal = function openGoalScheduleModal(goalId) {
    const modal = document.getElementById('modal-ret-schedule');
    if (!modal) return;

    const goal = (window.fpMilestones || []).find(m => m.id === goalId);
    if (!goal) return;

    const currentAge = parseInt(document.getElementById('inp-age')?.value) || 30;
    const targetAge = goal.target_age || (currentAge + 5);
    const months = Math.max(1, (targetAge - currentAge) * 12);
    const pvAmount = parseFloat(goal.present_value) || 0;
    const inf = (parseFloat(goal.inflation_rate) || 7.0) / 100;
    const inflatedGoalAmount = pvAmount * Math.pow(1 + inf, months / 12);

    const initEquity = parseFloat(document.getElementById('inp-init-equity')?.value);
    const initEq = isNaN(initEquity) ? 80 : initEquity;
    const cfgGlideStart = parseInt(document.getElementById('inp-glide-start')?.value) || 108;
    const cfgGlideEnd = parseInt(document.getElementById('inp-glide-end')?.value) || 12;
    const effGlideStart = Math.min(cfgGlideStart, months);
    const effGlideEnd = Math.min(cfgGlideEnd, Math.max(0, Math.floor(effGlideStart / 4)));

    const preIrrVal = parseFloat(document.getElementById('inp-pre-irr')?.value);
    const equityIRR = (isNaN(preIrrVal) ? 12.0 : preIrrVal) / 100;
    const postIrrVal = parseFloat(document.getElementById('inp-post-irr')?.value);
    const debtIRR = (isNaN(postIrrVal) ? 6.0 : postIrrVal) / 100;

    // Set modal headers
    const titleEl = modal.querySelector('.fp-modal-title');
    const subTitleEl = document.getElementById('modal-ret-schedule-subtitle');
    if (titleEl) titleEl.innerText = `Goal Glide Schedule: ${goal.name || 'Life Milestone'}`;
    if (subTitleEl) subTitleEl.innerHTML = `Systematic de-risking across <strong>${effGlideStart} months (${(effGlideStart / 12).toFixed(1)} Yrs)</strong>, reaching <strong>100% Debt and 0% Equity</strong> at target age ${targetAge}.`;

    const tbody = document.getElementById('ret-schedule-tbody');
    const thead = modal.querySelector('table thead');
    if (thead) {
        thead.innerHTML = `
            <tr>
                <th>Timeline Step</th>
                <th>Age</th>
                <th>Months to Goal</th>
                <th>Goal Value (₹)</th>
                <th>Discounted PV (₹)</th>
                <th style="background: rgba(16, 185, 129, 0.08); color: #065f46;">Debt %</th>
                <th>Debt Portion (₹)</th>
                <th>Equity %</th>
                <th>Equity Portion (₹)</th>
                <th>Blended Rate</th>
            </tr>
        `;
    }

    const kpiPv = document.getElementById('ret-sched-kpi-pv');
    const kpiDebt = document.getElementById('ret-sched-kpi-debt');
    const kpiEquity = document.getElementById('ret-sched-kpi-equity');

    const kpiLabels = modal.querySelectorAll('.fp-pkpi-label');
    if (kpiLabels[0]) kpiLabels[0].innerText = `Target at Age ${targetAge} (100% Debt)`;
    if (kpiLabels[1]) kpiLabels[1].innerText = `Lumpsum Needed Today (PV)`;
    if (kpiLabels[2]) kpiLabels[2].innerText = `Today's Starting Mix`;

    // Compute month-by-month schedule from Month 0 down to Month -months
    const scheduleRows = [];
    let cumFactor = 1.0;

    // Month 0 (When goal is achieved)
    scheduleRows.push({
        relativeMonth: 0,
        age: targetAge.toFixed(1),
        label: `Month 0 (Goal Achieved @ Age ${targetAge})`,
        goalVal: inflatedGoalAmount,
        pv: inflatedGoalAmount,
        debtPct: 100,
        equityPct: 0,
        debtValue: inflatedGoalAmount,
        equityValue: 0,
        monthlyRate: debtIRR / 12,
        isMaturity: true
    });

    for (let m = 1; m <= months; m++) {
        // m is months before goal achievement
        const alloc = calcGlideAllocation(m, initEq, effGlideStart, effGlideEnd);
        const dPct = alloc.debtPct;
        const ePct = alloc.equityPct;
        const annualReturn = (dPct / 100) * debtIRR + (ePct / 100) * equityIRR;
        const monthlyRate = annualReturn / 12;
        cumFactor *= (1 + monthlyRate);

        const pv = inflatedGoalAmount / cumFactor;
        const debtValue = pv * (dPct / 100);
        const equityValue = pv * (ePct / 100);

        scheduleRows.push({
            relativeMonth: -m,
            age: (targetAge - m / 12).toFixed(1),
            label: m === months ? `Month -${m} (Today / Now)` : `Month -${m}`,
            goalVal: inflatedGoalAmount,
            pv,
            debtPct: dPct,
            equityPct: ePct,
            debtValue,
            equityValue,
            monthlyRate,
            isToday: (m === months)
        });
    }

    const todayRow = scheduleRows[scheduleRows.length - 1];
    if (kpiPv) kpiPv.innerText = fmtINR_plain(inflatedGoalAmount);
    if (kpiDebt) kpiDebt.innerText = fmtINR_plain(todayRow.pv);
    if (kpiEquity) kpiEquity.innerText = `${todayRow.equityPct.toFixed(0)}% Eq / ${todayRow.debtPct.toFixed(0)}% Dt`;

    let html = '';
    scheduleRows.forEach(r => {
        const rowStyle = r.isMaturity 
            ? 'background: #f0fdf4; font-weight: 700;' 
            : (r.isToday ? 'background: #eff6ff; font-weight: 700;' : '');
        
        const mixClass = r.debtPct >= 80 ? 'mix-pure-debt' : (r.equityPct >= 70 ? 'mix-pure-eq' : 'mix-glide');

        html += `
            <tr style="${rowStyle}">
                <td>${escapeHtml(r.label)}</td>
                <td>Age ${r.age}</td>
                <td>${r.relativeMonth === 0 ? '0 mos (Maturity)' : Math.abs(r.relativeMonth) + ' mos'}</td>
                <td>${fmtINR_plain(r.goalVal)}</td>
                <td style="color: var(--brand-blue); font-weight: 700;">${fmtINR_plain(r.pv)}</td>
                <td><span class="badge-partition-mix ${mixClass}">${r.debtPct.toFixed(1)}%</span></td>
                <td style="color: #059669;">${fmtINR_plain(r.debtValue)}</td>
                <td><span class="badge-partition-mix ${mixClass}">${r.equityPct.toFixed(1)}%</span></td>
                <td style="color: #4f46e5;">${fmtINR_plain(r.equityValue)}</td>
                <td style="color: var(--text-secondary);">${(r.monthlyRate * 100).toFixed(2)}%</td>
            </tr>
        `;
    });

    if (tbody) tbody.innerHTML = html;
    modal.style.display = 'flex';
};

window.openRetScheduleModal = function openRetScheduleModal() {
    const modal = document.getElementById('modal-ret-schedule');
    if (!modal) return;

    const schedule = window.fpLatestRetSchedule || [];
    const tbody = document.getElementById('ret-schedule-tbody');
    const titleEl = modal.querySelector('.fp-modal-title');
    const subTitleEl = document.getElementById('modal-ret-schedule-subtitle');
    if (titleEl) titleEl.innerText = 'Retirement Monthly Cashflow Glide Schedule';
    if (subTitleEl) subTitleEl.innerHTML = 'Each retirement month is an individual goal. At payout month, partition is <strong>100% Debt and 0% Equity</strong>.';

    const thead = modal.querySelector('table thead');
    if (thead) {
        thead.innerHTML = `
            <tr>
                <th>Payout Month</th>
                <th>Age</th>
                <th>Months to Payout</th>
                <th>Monthly Payout (₹)</th>
                <th>PV Today (₹)</th>
                <th style="background: rgba(16, 185, 129, 0.08); color: #065f46;">Debt %</th>
                <th>Debt Portion (₹)</th>
                <th>Equity %</th>
                <th>Equity Portion (₹)</th>
                <th>Blended Return</th>
            </tr>
        `;
    }

    const kpiPv = document.getElementById('ret-sched-kpi-pv');
    const kpiDebt = document.getElementById('ret-sched-kpi-debt');
    const kpiEquity = document.getElementById('ret-sched-kpi-equity');

    const kpiLabels = modal.querySelectorAll('.fp-pkpi-label');
    if (kpiLabels[0]) kpiLabels[0].innerText = 'Retirement Total Lumpsum PV';
    if (kpiLabels[1]) kpiLabels[1].innerText = 'Retirement Debt Portion';
    if (kpiLabels[2]) kpiLabels[2].innerText = 'Retirement Equity Portion';

    let totalPV = 0;
    let totalDebt = 0;
    let totalEquity = 0;

    let rowsHtml = '';
    schedule.forEach(item => {
        totalPV += item.pv;
        totalDebt += item.debtValue;
        totalEquity += item.equityValue;

        const mixClass = item.debtPct >= 80 ? 'mix-pure-debt' : (item.equityPct >= 70 ? 'mix-pure-eq' : 'mix-glide');

        rowsHtml += `
            <tr>
                <td>Month ${item.payoutMonthIndex}</td>
                <td>Age ${item.ageAtPayout}</td>
                <td>${item.monthsToPayout} mos</td>
                <td style="font-weight: 600;">${fmtINR_plain(item.payoutAmount)}</td>
                <td style="color: var(--brand-blue); font-weight: 700;">${fmtINR_plain(item.pv)}</td>
                <td><span class="badge-partition-mix ${mixClass}">${item.debtPct.toFixed(1)}%</span></td>
                <td style="color: #059669;">${fmtINR_plain(item.debtValue)}</td>
                <td><span class="badge-partition-mix ${mixClass}">${item.equityPct.toFixed(1)}%</span></td>
                <td style="color: #4f46e5;">${fmtINR_plain(item.equityValue)}</td>
                <td style="color: var(--text-secondary);">${(item.monthlyRate * 100).toFixed(2)}%</td>
            </tr>
        `;
    });

    if (tbody) tbody.innerHTML = rowsHtml;
    if (kpiPv) kpiPv.innerText = fmtINR_plain(totalPV);
    if (kpiDebt) kpiDebt.innerText = `${fmtINR_plain(totalDebt)} (${totalPV > 0 ? ((totalDebt / totalPV) * 100).toFixed(1) : 0}%)`;
    if (kpiEquity) kpiEquity.innerText = `${fmtINR_plain(totalEquity)} (${totalPV > 0 ? ((totalEquity / totalPV) * 100).toFixed(1) : 0}%)`;

    modal.style.display = 'flex';
};

window.closeRetScheduleModal = function closeRetScheduleModal() {
    const modal = document.getElementById('modal-ret-schedule');
    if (modal) modal.style.display = 'none';
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
                <div class="empty-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></div>
                <div class="empty-title">No Life Goals Configured</div>
                <div class="empty-desc">Click "Add Life Goal" above to configure your milestone target amount, active earmarked savings, timeline, and asset partition.</div>
            </div>
        `;
        window.renderGoalLumpsumPartitionTable();
        return;
    }

    const currentAge = parseInt(document.getElementById('inp-age')?.value) || 30;
    const currentYear = new Date().getFullYear();
    const eqRate = (parseFloat(document.getElementById('inp-pre-irr')?.value) || 12.0) / 100;
    const debtRate = (parseFloat(document.getElementById('inp-post-irr')?.value) || 6.0) / 100;

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
                        <span class="fp-goal-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>
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
                        <span>At Target Age ${targetAge}: <strong style="color: #059669;">100% Debt & 0% Equity (Capital Protected)</strong></span>
                        <span>Today's Mix: <strong>${eqPct}% Eq / ${dtPct}% Dt</strong></span>
                    </div>
                    <div class="fp-alloc-bar-preview">
                        <div class="alloc-bar-dt" style="width: 100%; background: linear-gradient(90deg, #10b981 0%, #059669 100%); font-size: 11px; font-weight: 700;">
                            Maturity @ Age ${targetAge}: 100% Debt & 0% Equity
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    window.renderGoalLumpsumPartitionTable();
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

    if (count === 0) {
        if (countBadge) countBadge.innerText = `0 Goals Configured`;
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#64748b;">No milestone goals configured. Click "Add Life Goal" in Card 5 to add goals.</td></tr>`;
        const oldNotice = document.getElementById('goals-unmet-notice-box');
        if (oldNotice) oldNotice.remove();
        return;
    }

    const mode = document.getElementById('inp-solver-mode')?.value || 'normal';
    const isStandardMode = (mode === 'normal');
    const simGoalStatus = window.fpLastSimGoalStatus || {};

    const currentAge = parseInt(document.getElementById('inp-age')?.value) || 30;
    const currentYear = new Date().getFullYear();
    const eqRate = (parseFloat(document.getElementById('inp-pre-irr')?.value) || 12.0) / 100;
    const debtRate = (parseFloat(document.getElementById('inp-post-irr')?.value) || 6.0) / 100;

    let html = '';
    let metOrPartialList = [];
    let unmetList = [];

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

        // Determine Simulation Projection Status:
        let simStatus = 'met';
        if (isStandardMode) {
            if (simGoalStatus[g.id]) {
                simStatus = simGoalStatus[g.id].status;
            }
        } else {
            simStatus = 'met'; // In solver mode, all goals are met by the solver
        }

        const goalItem = {
            g,
            targetAge,
            targetYear,
            pv,
            activeAmt,
            fv,
            eqPct,
            dtPct,
            reqSIP,
            fundedPct,
            simStatus
        };

        if (simStatus === 'unmet') {
            unmetList.push(goalItem);
        } else {
            metOrPartialList.push(goalItem);
        }
    });

    // In Standard Projection: ONLY SHOW MET GOALS AND PARTIALLY MET GOALS
    const displayedGoals = isStandardMode ? metOrPartialList : (metOrPartialList.concat(unmetList));

    if (countBadge) {
        if (isStandardMode) {
            countBadge.innerText = unmetList.length > 0 
                ? `${displayedGoals.length} Met / Partially Met (${unmetList.length} Unmet)`
                : `${displayedGoals.length} of ${count} Goals Met`;
        } else {
            countBadge.innerText = `${count} Goals (All Met via Solver)`;
        }
    }

    if (displayedGoals.length === 0) {
        html = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#e11d48; font-weight:600;">
            Notice: In Standard Projection, no goals can be met due to immediate corpus/cashflow deficit. Switch to "Calculate SIP Required" or "Calculate Lumpsum" in Analysis Mode.
        </td></tr>`;
    } else {
        displayedGoals.forEach(item => {
            let statusPill = '';
            if (item.simStatus === 'met') {
                statusPill = `<span class="badge-status-pill badge-status-funded">● Met (100% Funded)</span>`;
            } else if (item.simStatus === 'partially_met') {
                statusPill = `<span class="badge-status-pill badge-status-partial">● Partially Met</span>`;
            } else {
                statusPill = `<span class="badge-status-pill badge-status-deficit">● Unmet (Shortfall)</span>`;
            }

            html += `
                <tr>
                    <td><strong>${escapeHtml(item.g.name || 'Milestone Goal')}</strong></td>
                    <td>${item.targetYear} (Age ${item.targetAge})</td>
                    <td>${fmtINR_plain(item.pv)}</td>
                    <td style="color:#059669; font-weight:600;">${fmtINR_plain(item.activeAmt)}</td>
                    <td style="color:var(--brand-navy); font-weight:700;">${fmtINR_plain(item.fv)}</td>
                    <td>
                        <span class="badge-asset-mix ${item.eqPct >= 70 ? 'mix-equity' : (item.eqPct <= 30 ? 'mix-debt' : 'mix-transition')}">
                            ${item.eqPct}% Eq / ${item.dtPct}% Dt
                        </span>
                    </td>
                    <td style="color:#2563eb; font-weight:700;">${item.reqSIP > 0 ? fmtINR_plain(item.reqSIP) + ' / mo' : 'Fully Funded'}</td>
                    <td>${statusPill}</td>
                </tr>
            `;
        });
    }

    tbody.innerHTML = html;

    // Handle Unmet Goals Warning Callout in Standard Projection
    let noticeEl = document.getElementById('goals-unmet-notice-box');
    const accordionBody = document.getElementById('goals-accordion-body');
    if (isStandardMode && unmetList.length > 0) {
        if (!noticeEl) {
            noticeEl = document.createElement('div');
            noticeEl.id = 'goals-unmet-notice-box';
            noticeEl.className = 'fp-unmet-goals-notice';
            if (accordionBody) accordionBody.appendChild(noticeEl);
        }
        noticeEl.innerHTML = `
            <strong>Note: Standard Projection displays only Met and Partially Met goals (${displayedGoals.length}).</strong><br>
            ${unmetList.length} goal${unmetList.length > 1 ? 's' : ''} (<em>${unmetList.map(u => escapeHtml(u.g.name) + ' at Age ' + u.targetAge).join(', ')}</em>) cannot be funded due to corpus exhaustion. Switch to <strong>"Calculate SIP Required"</strong> or <strong>"Calculate Lumpsum"</strong> in the standalone <strong>Analysis Mode</strong> card to solve for all goals.
        `;
        noticeEl.style.display = 'block';
    } else if (noticeEl) {
        noticeEl.style.display = 'none';
    }
};

// TAB SWITCHING (SIGN IN / REGISTER / ADVISOR)
window.switchAuthTab = function (tab) {
    const btnLogin = document.getElementById('tab-btn-login');
    const btnReg = document.getElementById('tab-btn-register');
    const btnAdv = document.getElementById('tab-btn-advisor');
    const formLogin = document.getElementById('form-client-login');
    const formReg = document.getElementById('form-client-register');
    const formAdv = document.getElementById('form-client-advisor');

    if (btnLogin) btnLogin.classList.toggle('active', tab === 'login');
    if (btnReg) btnReg.classList.toggle('active', tab === 'register');
    if (btnAdv) btnAdv.classList.toggle('active', tab === 'advisor');

    if (formLogin) formLogin.style.display = (tab === 'login') ? 'block' : 'none';
    if (formReg) formReg.style.display = (tab === 'register') ? 'block' : 'none';
    if (formAdv) formAdv.style.display = (tab === 'advisor') ? 'block' : 'none';
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

    // Only authorized advisors see Advisor Desk in header; regular clients never see it
    const advHdrBtn = document.getElementById('btn-hdr-advisor');
    if (advHdrBtn) {
        advHdrBtn.style.display = (user && user.role === 'advisor') ? 'inline-flex' : 'none';
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

    const advHdrBtn = document.getElementById('btn-hdr-advisor');
    if (advHdrBtn) advHdrBtn.style.display = 'none';

    window.closeAdvisorDeskModal();
    window.closePlanManagerModal();
    window.closeAdvisorLoginModal();
    const banner = document.getElementById('advisor-inspect-banner');
    if (banner) banner.style.display = 'none';
};

// ==========================================================================
// TOAST NOTIFICATION UTILITY
// ==========================================================================
window.showPlanToast = function (msg, type = 'success') {
    let container = document.getElementById('fp-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'fp-toast-container';
        container.className = 'fp-toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `fp-toast ${type}`;
    toast.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <span>${escapeHtml(msg)}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
};

window.refreshPlansCount = async function () {
    if (!window.fpAuth.token) return;
    try {
        const res = await window.fpApi('/api/plans');
        const count = (res.plans || []).length;
        const countBadge = document.getElementById('fp-pm-plans-count');
        if (countBadge) countBadge.innerText = count.toString();
    } catch (e) {
        // silent fail
    }
};

window.promptRenameCurrentPlan = async function () {
    if (!window.fpAuth.token || !window.fpAuth.activePlanId) return;
    const currentName = window.fpAuth.activePlanName || 'My Freedom Plan';
    const newName = prompt('Enter a new name for your active plan:', currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;

    try {
        await window.fpApi(`/api/plans/${window.fpAuth.activePlanId}/rename`, 'PUT', { plan_name: newName.trim() });
        window.fpAuth.activePlanName = newName.trim();
        const hdrPlanName = document.getElementById('hdr-plan-name');
        if (hdrPlanName) hdrPlanName.innerText = newName.trim();
        const activePlanTitle = document.getElementById('active-plan-title');
        if (activePlanTitle) activePlanTitle.innerText = newName.trim();
        window.showPlanToast(`Plan renamed to "${newName.trim()}"`);
    } catch (err) {
        alert('Failed to rename plan: ' + err.message);
    }
};

window.renamePlanScenario = async function (planId, currentName) {
    const newName = prompt(`Enter a new name for "${currentName}":`, currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;

    try {
        await window.fpApi(`/api/plans/${planId}/rename`, 'PUT', { plan_name: newName.trim() });
        if (planId === window.fpAuth.activePlanId) {
            window.fpAuth.activePlanName = newName.trim();
            const hdrPlanName = document.getElementById('hdr-plan-name');
            if (hdrPlanName) hdrPlanName.innerText = newName.trim();
            const activePlanTitle = document.getElementById('active-plan-title');
            if (activePlanTitle) activePlanTitle.innerText = newName.trim();
        }
        await window.renderPlanCardsList();
        window.showPlanToast(`Plan renamed to "${newName.trim()}"`);
    } catch (err) {
        alert('Failed to rename plan: ' + err.message);
    }
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

window.toggleNewPlanInput = function (show, mode = 'blank') {
    const el = document.getElementById('new-plan-input-wrap');
    if (el) el.style.display = show ? 'block' : 'none';
    if (show) {
        const inp = document.getElementById('inp-new-plan-name');
        const lbl = document.getElementById('lbl-new-plan-mode');
        const btn = document.getElementById('btn-submit-new-plan');
        el.dataset.planMode = mode;
        if (mode === 'save_current') {
            if (lbl) lbl.innerText = 'Save Current Inputs as New Plan';
            if (btn) btn.innerText = 'Save & Load Plan';
            if (inp) {
                const base = window.fpAuth.activePlanName || 'My Life Plan';
                inp.value = `${base} (Scenario 2)`;
                inp.focus();
                inp.select();
            }
        } else {
            if (lbl) lbl.innerText = 'Create Fresh Blank Scenario';
            if (btn) btn.innerText = 'Create & Load Plan';
            if (inp) { inp.value = ''; inp.focus(); }
        }
    }
};

window.promptSaveAsNewPlan = function () {
    window.openPlanManagerModal();
    window.toggleNewPlanInput(true, 'save_current');
};

window.submitCreateNewPlan = async function () {
    const inp = document.getElementById('inp-new-plan-name');
    const wrap = document.getElementById('new-plan-input-wrap');
    const mode = wrap?.dataset?.planMode || 'blank';
    const name = inp ? inp.value.trim() : '';
    if (!name) {
        alert('Please enter a name for this plan scenario.');
        return;
    }

    try {
        if (mode === 'save_current') {
            const res = await window.fpApi('/api/plans/new', 'POST', {
                plan_name: name,
                clone_from_id: window.fpAuth.activePlanId
            });
            const payload = collectPlanPayloadFromUI();
            payload.plan.plan_name = name;
            await window.fpApi(`/api/plans/${res.planId}`, 'PUT', payload);
            await window.fpApi(`/api/plans/${res.planId}/activate`, 'PUT');
            const planRes = await window.fpApi(`/api/plans/${res.planId}`);
            window.populatePlanToUI(planRes.plan, planRes.milestones);
            window.closePlanManagerModal();
            window.showPlanToast(`Saved and loaded new plan "${name}"!`);
        } else {
            const res = await window.fpApi('/api/plans/new', 'POST', {
                plan_name: name
            });
            await window.fpApi(`/api/plans/${res.planId}/activate`, 'PUT');
            const planRes = await window.fpApi(`/api/plans/${res.planId}`);
            window.populatePlanToUI(planRes.plan, planRes.milestones);
            window.closePlanManagerModal();
            window.showPlanToast(`Created and loaded fresh plan "${name}"!`);
        }
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
        window.showPlanToast(`Duplicated and loaded plan "${newName}"!`);
    } catch (err) {
        alert('Failed to duplicate plan: ' + err.message);
    }
};

window.duplicatePlanScenario = async function (planId) {
    try {
        const res = await window.fpApi('/api/plans/new', 'POST', {
            plan_name: `Plan Copy`,
            clone_from_id: planId
        });
        await window.renderPlanCardsList();
        await window.refreshPlansCount();
        window.showPlanToast(`Duplicated plan scenario!`);
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
        const countBadge = document.getElementById('fp-pm-plans-count');
        if (countBadge) countBadge.innerText = plans.length.toString();

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
                            Age ${p.current_age} &rarr; ${p.retirement_age} | SIP: ₹${parseInt(p.initial_sip || 0).toLocaleString('en-IN')}/mo | Corpus: ₹${parseInt(p.initial_corpus || 0).toLocaleString('en-IN')} | Updated: ${updatedDate}
                        </div>
                    </div>
                    <div class="plan-item-actions">
                        <button type="button" class="fp-btn-rename-plan" onclick="window.renamePlanScenario('${p.id}', '${escapeHtml(p.plan_name)}')" title="Rename Plan">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            Rename
                        </button>
                        <button type="button" class="fp-btn-secondary" style="padding:5px 10px; font-size:12px;" onclick="window.duplicatePlanScenario('${p.id}')" title="Duplicate Plan">
                            Copy
                        </button>
                        ${!isActive ? `<button type="button" class="fp-btn-primary" style="padding:6px 14px; font-size:12.5px; font-weight:700;" onclick="window.switchActivePlan('${p.id}')">Load Plan</button>` : '<span class="fp-loaded-tag">Loaded</span>'}
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
        window.showPlanToast(`Loaded plan "${planRes.plan.plan_name}"!`);
    } catch (err) {
        alert('Failed to switch plan: ' + err.message);
    }
};

window.deletePlanScenario = async function (planId) {
    if (!confirm('Are you sure you want to delete this scenario?')) return;
    try {
        await window.fpApi(`/api/plans/${planId}`, 'DELETE');
        await window.renderPlanCardsList();
        await window.refreshPlansCount();
        window.showPlanToast(`Plan deleted successfully.`);
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

window.handleAdvisorLoginSubmit = async function (e, source = 'modal') {
    e.preventDefault();
    const isCard = source === 'card';
    const phoneInput = document.getElementById(isCard ? 'adv-card-phone' : 'adv-phone');
    const pinInput = document.getElementById(isCard ? 'adv-card-pin' : 'adv-pin');
    const errEl = document.getElementById(isCard ? 'adv-card-error-msg' : 'adv-error-msg');
    const submitBtn = document.getElementById(isCard ? 'btn-adv-card-submit' : 'btn-adv-login');

    const phone = phoneInput ? phoneInput.value.trim() : '';
    const pin = pinInput ? pinInput.value.trim() : '';

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

        // Enable advisor desk button for this advisor session
        const advHdrBtn = document.getElementById('btn-hdr-advisor');
        if (advHdrBtn) advHdrBtn.style.display = 'inline-flex';

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
    const advHdrBtn = document.getElementById('btn-hdr-advisor');
    if (!token) {
        if (advHdrBtn) advHdrBtn.style.display = 'none';
        return;
    }

    try {
        window.fpAuth.token = token;
        const meRes = await window.fpApi('/api/auth/me');
        window.fpAuth.user = meRes.user;

        window.fpLeadName = meRes.user.name;
        window.fpLeadPhone = meRes.user.phone;

        if (advHdrBtn) {
            advHdrBtn.style.display = (meRes.user && meRes.user.role === 'advisor') ? 'inline-flex' : 'none';
        }

        const planRes = await window.fpApi('/api/plans/active');
        if (planRes && planRes.plan) {
            window.populatePlanToUI(planRes.plan, planRes.milestones);
        }

        revealPlannerUI(meRes.user);
    } catch (err) {
        console.warn('Session verification failed, requiring re-login:', err.message);
        localStorage.removeItem('fp_token');
        localStorage.removeItem('fp_user');
        window.fpAuth.token = null;
        window.fpAuth.user = null;
        if (advHdrBtn) advHdrBtn.style.display = 'none';
    }
};

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Support URL-triggered logout for clean switching/testing
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('logout') === '1') {
        window.handleUserLogout(false);
        if (window.history && window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } else {
        // 1. Check existing authentication session
        window.initAuthSession();
    }

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
    const preIRR = (parseFloat(document.getElementById('inp-pre-irr').value) || 12.0) / 100;
    const postIRR = (parseFloat(document.getElementById('inp-post-irr').value) || 6.0) / 100;
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
    const sipDuration = parseInt(document.getElementById('inp-sip-duration')?.value) || Math.max(1, effectiveRetAge - age);
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

            let yearsElapsed = a - age;
            if (yearsElapsed < sipDuration) {
                monthlySIP = simInitialSIP * Math.pow(1 + stepUp, yearsElapsed);
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
                 if (sipDuration > 0) totalInvestments += (monthlySIP * 12);
            } else {
                 if (yearsElapsed < sipDuration) totalInvestments += (monthlySIP * 12);
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

    // Compute goal status for Goals Summary Table based on final simulation
    const simGoalStatus = {};
    (window.fpMilestones || []).forEach(m => {
        const tAge = m.target_age || (age + 5);
        if (mode === 'normal') {
            if (finalSim.exhaustionAge !== null && finalSim.exhaustionAge < tAge) {
                simGoalStatus[m.id] = { status: 'unmet', fundedPct: 0 };
            } else if (finalSim.exhaustionAge === tAge) {
                simGoalStatus[m.id] = { status: 'partially_met', fundedPct: 50 };
            } else {
                simGoalStatus[m.id] = { status: 'met', fundedPct: 100 };
            }
        } else {
            // In solver mode, all goals are met
            simGoalStatus[m.id] = { status: 'met', fundedPct: 100 };
        }
    });
    window.fpLastSimGoalStatus = simGoalStatus; 

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
    btns.forEach((btn, i) => { origTexts[i] = btn.innerHTML; btn.innerHTML = 'Generating PDF...'; btn.disabled = true; });
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
