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
    switch (id) {
        case 'inp-age':
        case 'inp-ret-age':
        case 'inp-exhaustion-expected':
            return Math.round(val) + " Yrs";
        case 'inp-pension-delay':
            return Math.round(val) + (val === 1 ? " Yr" : " Yrs");
        case 'inp-initial-corpus':
            return formatIndianCurrency(val);
        case 'inp-initial-sip':
            return formatIndianCurrency(val) + " / mo";
        case 'inp-stepup':
            return val.toFixed(1) + "% / yr";
        case 'inp-pre-irr':
        case 'inp-post-irr':
        case 'inp-inflation':
            return val.toFixed(1) + "% p.a.";
        case 'inp-expense':
            return formatIndianCurrency(val) + " / mo";
        default:
            return val.toString();
    }
}

// ==========================================================================
// REAL-TIME RETIREMENT SNAPSHOT ENGINE
// ==========================================================================
window.updateLiveFreedomSnapshot = function updateLiveFreedomSnapshot() {
    const age = parseInt(document.getElementById('inp-age')?.value) || 40;
    const retAge = parseInt(document.getElementById('inp-ret-age')?.value) || 60;
    const initialCorpus = parseFloat(document.getElementById('inp-initial-corpus')?.value) || 0;
    const initialSIP = parseFloat(document.getElementById('inp-initial-sip')?.value) || 0;
    const stepUp = (parseFloat(document.getElementById('inp-stepup')?.value) || 0) / 100;
    const preIRR = (parseFloat(document.getElementById('inp-pre-irr')?.value) || 12) / 100;
    const postIRR = (parseFloat(document.getElementById('inp-post-irr')?.value) || 8) / 100;
    const retExpToday = parseFloat(document.getElementById('inp-expense')?.value) || 0;
    const inflation = (parseFloat(document.getElementById('inp-inflation')?.value) || 0) / 100;
    const pensionDelay = parseInt(document.getElementById('inp-pension-delay')?.value) || 0;
    
    // Quick years remaining
    const yearsLeft = Math.max(0, retAge - age);
    const yearsLeftEl = document.getElementById('kpi-years-left');
    if (yearsLeftEl) yearsLeftEl.innerText = yearsLeft + " Yrs";

    // Fast simulation loop
    let corpus = initialCorpus;
    let totalInvested = initialCorpus;
    let corpusAtRetirement = 0;
    let exhaustionAge = null;
    const mPreRate = Math.pow(1 + preIRR, 1 / 12) - 1;
    const mPostRate = Math.pow(1 + postIRR, 1 / 12) - 1;

    for (let a = age; a <= 100; a++) {
        let isPre = (a < retAge);
        let mRate = isPre ? mPreRate : mPostRate;
        let monthlySIP = 0;
        let monthlySWP = 0;

        if (a <= retAge) {
            monthlySIP = initialSIP * Math.pow(1 + stepUp, a - age);
            totalInvested += (monthlySIP * 12);
        }

        if (a > retAge + pensionDelay && corpus > 0) {
            monthlySWP = retExpToday * Math.pow(1 + inflation, a - age);
        }

        for (let m = 0; m < 12; m++) {
            if (corpus > 0 || monthlySIP > 0) {
                corpus = corpus + monthlySIP - monthlySWP;
                corpus = corpus + (corpus * mRate);
            } else {
                corpus = 0;
            }
        }

        if (a === retAge) {
            corpusAtRetirement = corpus;
        }

        if (corpus <= 0 && exhaustionAge === null && a > retAge) {
            exhaustionAge = a;
        }
    }

    // Monthly pension needed at retirement (in future money)
    const monthlyPensionAtRet = retExpToday * Math.pow(1 + inflation, retAge - age);

    // Update KPI UI
    const retCorpusEl = document.getElementById('kpi-ret-corpus');
    if (retCorpusEl) retCorpusEl.innerText = formatIndianCurrency(corpusAtRetirement);

    const pensionEl = document.getElementById('kpi-monthly-pension');
    if (pensionEl) pensionEl.innerText = formatIndianCurrency(monthlyPensionAtRet) + " / mo";

    const totalInvestedEl = document.getElementById('kpi-total-invested');
    if (totalInvestedEl) totalInvestedEl.innerText = formatIndianCurrency(totalInvested);

    // Status Badge
    const statusEl = document.getElementById('kpi-freedom-status');
    if (statusEl) {
        if (!exhaustionAge || exhaustionAge >= 100) {
            statusEl.className = 'kpi-freedom-badge badge-success';
            statusEl.innerText = '🎉 Safe till Age 100+';
        } else if (exhaustionAge > retAge) {
            statusEl.className = 'kpi-freedom-badge badge-warning';
            statusEl.innerText = `⚠️ Lasts till Age ${exhaustionAge}`;
        } else {
            statusEl.className = 'kpi-freedom-badge badge-warning';
            statusEl.innerText = `⚠️ Underfunded at Retirement`;
        }
    }

    // Progress Bar
    const progressBar = document.getElementById('kpi-timeline-bar');
    if (progressBar) {
        const totalSpan = Math.max(1, 100 - age);
        const workSpan = Math.max(0, retAge - age);
        const pct = Math.min(100, Math.max(10, Math.round((workSpan / totalSpan) * 100)));
        progressBar.style.width = pct + '%';
    }

    const barStart = document.getElementById('kpi-bar-start');
    if (barStart) barStart.innerText = `Age ${age} (Now)`;

    const barMid = document.getElementById('kpi-bar-mid');
    if (barMid) barMid.innerText = `Retire @ ${retAge}`;

    const barEnd = document.getElementById('kpi-bar-end');
    if (barEnd) barEnd.innerText = exhaustionAge ? `Exhaust: ${exhaustionAge}` : `Freedom: 100+`;
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
        disp.innerText = formatDisplayValue(id, val);
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

    // 4. Update Live KPI Snapshot
    window.updateLiveFreedomSnapshot();

    // 5. If sticky button was on Download, reset it
    const stickyBtn = document.querySelector('.fp-btn-sticky');
    if (stickyBtn && stickyBtn.innerHTML.includes('Download')) {
        stickyBtn.innerHTML = '📊 View Detailed Year-by-Year Breakdown →';
        stickyBtn.onclick = () => window.generateFreedomReport();
    }
}

function updateSliderVisual(slider) {
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const val = parseFloat(slider.value) || 0;
    if (max - min === 0) return;
    const pct = ((val - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(to right, #00d2ff 0%, #3a7bd5 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
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
        window.setControlVal('inp-expense', 40000);
        window.setControlVal('inp-pension-delay', 0);
        
        const eventsContainer = document.getElementById('events-container');
        if (eventsContainer) eventsContainer.innerHTML = '';
        
        window.updateLiveFreedomSnapshot();
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
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Check if lead was already captured in localStorage
    const isUnlocked = localStorage.getItem('fp_lead_unlocked');
    if (isUnlocked === 'true') {
        window.fpLeadName = localStorage.getItem('fp_lead_name') || '';
        window.fpLeadPhone = localStorage.getItem('fp_lead_phone') || '';
        const s1 = document.getElementById('fp-step-1');
        const s2 = document.getElementById('fp-step-2');
        if (s1 && s2) {
            s1.classList.remove('active');
            s2.classList.add('active');
        }
    }

    // 2. Handle Lead Form Submit
    const leadForm = document.getElementById('fp-lead-form');
    if (leadForm) {
        leadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = leadForm.querySelector('button[type="submit"]');
            submitBtn.innerText = "Unlocking...";
            submitBtn.disabled = true;

            const name = document.getElementById('lead-name').value;
            const phone = document.getElementById('lead-phone').value;
            window.fpLeadName = name;
            window.fpLeadPhone = phone;

            localStorage.setItem('fp_lead_unlocked', 'true');
            localStorage.setItem('fp_lead_name', name);
            localStorage.setItem('fp_lead_phone', phone);

            const s1 = document.getElementById('fp-step-1');
            const s2 = document.getElementById('fp-step-2');
            if (s1 && s2) {
                s1.classList.remove('active');
                s2.classList.add('active');
                window.scrollTo(0, 0);
            }

            try {
                const formData = new FormData(leadForm);
                formData.append('_subject', 'Financial Freedom PWA Unlocked - ' + name);
                await fetch("https://formsubmit.co/ajax/srpprimewealth@gmail.com", {
                    method: "POST",
                    headers: { 'Accept': 'application/json' },
                    body: formData
                });
            } catch (err) {
                console.error("Lead submit error:", err);
            }
        });
    }

    // 3. Setup Range Sliders & Number Input Synchronization
    const sliders = document.querySelectorAll('.fp-slider');
    sliders.forEach(slider => {
        const inputId = slider.id.replace('slide-', 'inp-');
        const numberInput = document.getElementById(inputId);
        if (numberInput) {
            // Initial sync
            slider.value = numberInput.value;
            updateSliderVisual(slider);
            const dispId = inputId.replace('inp-', 'disp-');
            const disp = document.getElementById(dispId);
            if (disp) disp.innerText = formatDisplayValue(inputId, numberInput.value);

            // Slider dragged
            slider.addEventListener('input', (e) => {
                numberInput.value = e.target.value;
                syncControlState(inputId, e.target.value);
            });

            // Number input edited
            numberInput.addEventListener('input', (e) => {
                slider.value = e.target.value;
                syncControlState(inputId, e.target.value);
            });
        }
    });

    // 4. Run Initial Snapshot
    window.updateLiveFreedomSnapshot();
});

// ==========================================================================
// LIFE GOALS & EVENTS (MOBILE-FRIENDLY CARD BUILDER)
// ==========================================================================
let eventRowId = 0;
window.addEventRow = function addEventRow() {
    let id = eventRowId++;
    const container = document.getElementById('events-container');
    const row = document.createElement('div');
    row.className = 'event-row';
    const currentYear = new Date().getFullYear();
    row.innerHTML = `
        <div class="ev-grid">
            <div class="ev-row-top">
                <input type="text" class="ev-name" placeholder="Goal Name (e.g. Higher Edu / House / Car)" style="font-weight:600; flex:1;" value="Life Goal #${id + 1}">
                <button type="button" class="ev-del-btn" onclick="this.closest('.event-row').remove(); window.updateLiveFreedomSnapshot();" title="Remove Goal">✕</button>
            </div>
            <div class="ev-grid-fields">
                <div>
                    <label>Target Year</label>
                    <input type="number" class="ev-age" value="${currentYear + 5}" min="${currentYear}" oninput="window.updateLiveFreedomSnapshot()">
                </div>
                <div>
                    <label>Amount Today (₹ PV)</label>
                    <input type="number" class="ev-pv" value="500000" min="0" step="50000" oninput="window.updateLiveFreedomSnapshot()">
                </div>
                <div>
                    <label>Inflation (%)</label>
                    <input type="number" class="ev-inf" value="7" step="0.5" oninput="window.updateLiveFreedomSnapshot()">
                </div>
                <div>
                    <label>Event Type</label>
                    <select class="ev-type" onchange="window.toggleEventFields(this); window.updateLiveFreedomSnapshot();">
                        <option value="outflow">Outflow (Lumpsum)</option>
                        <option value="recurring-outflow">Outflow (Recurring)</option>
                        <option value="inflow">Inflow</option>
                        <option value="loan">Loan (EMI Outflow)</option>
                    </select>
                </div>
                <div class="loan-fields" style="display:none; opacity:0.5;">
                    <label>Loan Rate (%)</label>
                    <input type="number" class="ev-loan-rate" value="8.5" step="0.1" disabled oninput="window.updateLiveFreedomSnapshot()">
                </div>
                <div class="loan-fields" style="display:none; opacity:0.5;">
                    <label>Tenure (Yrs)</label>
                    <input type="number" class="ev-loan-yrs" value="5" min="1" disabled oninput="window.updateLiveFreedomSnapshot()">
                </div>
                <div class="recurring-fields" style="display:none; opacity:0.5;">
                    <label>Step-Up (%/yr)</label>
                    <input type="number" class="ev-rec-stepup" value="0" step="0.5" disabled oninput="window.updateLiveFreedomSnapshot()">
                </div>
                <div class="recurring-fields" style="display:none; opacity:0.5;">
                    <label>Duration (Yrs)</label>
                    <input type="number" class="ev-rec-yrs" value="5" min="1" disabled oninput="window.updateLiveFreedomSnapshot()">
                </div>
            </div>
        </div>
    `;
    container.appendChild(row);
    window.updateLiveFreedomSnapshot();
};

window.toggleEventFields = function(selectEl) {
    const parentRow = selectEl.closest('.ev-grid');
    const loanFields = parentRow.querySelectorAll('.loan-fields');
    const recurringFields = parentRow.querySelectorAll('.recurring-fields');

    if (selectEl.value === 'loan') {
        loanFields.forEach(f => {
            f.style.display = 'block';
            f.style.opacity = '1';
            f.querySelector('input').disabled = false;
        });
    } else {
        loanFields.forEach(f => {
            f.style.display = 'none';
            f.style.opacity = '0.5';
            f.querySelector('input').disabled = true;
        });
    }

    if (selectEl.value === 'recurring-outflow') {
        recurringFields.forEach(f => {
            f.style.display = 'block';
            f.style.opacity = '1';
            f.querySelector('input').disabled = false;
        });
    } else {
        recurringFields.forEach(f => {
            f.style.display = 'none';
            f.style.opacity = '0.5';
            f.querySelector('input').disabled = true;
        });
    }
};
window.toggleLoanFields = window.toggleEventFields;

window.toggleExhaustionAge = function() {
    const mode = document.getElementById('inp-solver-mode')?.value;
    const group = document.getElementById('group-exhaustion-age');
    if (!group) return;
    if (mode === 'solve-lumpsum' || mode === 'solve-sip') {
        group.style.display = 'block';
    } else {
        group.style.display = 'none';
    }
    window.updateLiveFreedomSnapshot();
};

// ==========================================================================
// DETAILED REPORT GENERATION
// ==========================================================================
window.generateFreedomReport = function generateFreedomReport() {
    const reportContainer = document.getElementById('fp-report-container');
    if (reportContainer) reportContainer.classList.remove('fp-report-hidden');

    const leadName = window.fpLeadName || '';
    const leadPhone = window.fpLeadPhone || '';
    const nameStr = leadName && leadPhone ? `${leadName} | ${leadPhone}` : (leadName || leadPhone);
    const detailsEl = document.getElementById('report-lead-details');
    if (detailsEl) detailsEl.innerText = nameStr;

    const age = parseInt(document.getElementById('inp-age').value) || 40;
    const retAge = parseInt(document.getElementById('inp-ret-age').value) || 60;
    const initialCorpus = document.getElementById('inp-initial-corpus').value === '' ? 0 : parseFloat(document.getElementById('inp-initial-corpus').value);
    const initialSIP = document.getElementById('inp-initial-sip').value === '' ? 0 : parseFloat(document.getElementById('inp-initial-sip').value);
    const stepUp = (parseFloat(document.getElementById('inp-stepup').value) || 0) / 100;
    const preIRR = (parseFloat(document.getElementById('inp-pre-irr').value) || 12) / 100;
    const postIRR = (parseFloat(document.getElementById('inp-post-irr').value) || 8) / 100;
    const retExpToday = parseFloat(document.getElementById('inp-expense').value) || 0;
    const inflation = (parseFloat(document.getElementById('inp-inflation').value) || 0) / 100;
    const pensionDelay = parseInt(document.getElementById('inp-pension-delay').value) || 0;
    const exhaustExpected = parseInt(document.getElementById('inp-exhaustion-expected').value) || 100;
    const mode = document.getElementById('inp-solver-mode').value || 'normal';
    
    const currentYear = new Date().getFullYear();

    const eventRows = document.querySelectorAll('.event-row');
    const baseEvents = [];
    eventRows.forEach(row => {
        const enteredYear = parseInt(row.querySelector('.ev-age').value) || currentYear;
        const targetAge = age + (enteredYear - currentYear);
        baseEvents.push({
            age: targetAge,
            name: row.querySelector('.ev-name').value || '',
            pv: parseFloat(row.querySelector('.ev-pv').value) || 0,
            inflation: (parseFloat(row.querySelector('.ev-inf').value) || 0) / 100,
            type: row.querySelector('.ev-type').value,
            loanRate: row.querySelector('.ev-loan-rate') ? (parseFloat(row.querySelector('.ev-loan-rate').value) || 8.5) / 100 : 0.085,
            loanYears: row.querySelector('.ev-loan-yrs') ? (parseInt(row.querySelector('.ev-loan-yrs').value) || 5) : 5,
            recStepUp: row.querySelector('.ev-rec-stepup') ? (parseFloat(row.querySelector('.ev-rec-stepup').value) || 0) / 100 : 0,
            recYears: row.querySelector('.ev-rec-yrs') ? (parseInt(row.querySelector('.ev-rec-yrs').value) || 5) : 5
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

            if (a <= retAge) {
                monthlySIP = simInitialSIP * Math.pow(1 + stepUp, a - age);
            }

            if (a > retAge + pensionDelay && corpus > 0) {
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
                    
                    pvText = `<span style="color:#e63946">${ev.pv}, ${(ev.inflation * 100).toFixed(0)}%</span>`;
                    rowPVs.push(pvText);
                    rowDetails.push(`<span style="color:#e63946">${ev.name} (EMI out)</span>`);
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
                     rowDetails.push(`<span style="color:#e63946">${ev.name} (EMI cont.)</span>`);
                     rowOutflow += ev.emiAmount;
                     totalWithdrawals += ev.emiAmount;
                } else if (ev.type === 'recurring-outflow') {
                    let baseAmt = ev.pv * Math.pow(1 + ev.inflation, a - age);
                    let yearAmt = ev.isRecStep ? ev.recurringAmount : baseAmt;

                    pvText = `<span style="color:#e63946">${ev.isRecStep ? '' : ev.pv + ', ' + (ev.inflation * 100).toFixed(0) + '%'}</span>`;
                    if (!ev.isRecStep) rowPVs.push(pvText);
                    let stepLabel = ev.isRecStep ? `${ev.name} (Yr ${ev.recYearNum})` : `${ev.name} (Recurring)`;
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
                        pvText = `<span style="color:#10b981">${ev.pv}, ${(ev.inflation * 100).toFixed(0)}%</span>`;
                        rowPVs.push(pvText);
                        rowDetails.push(`<span style="color:#10b981">${ev.name}</span>`);
                        rowInflow += inflatedAmt;
                        totalInvestments += inflatedAmt;
                    } else {
                        pvText = `<span style="color:#e63946">${ev.pv}, ${(ev.inflation * 100).toFixed(0)}%</span>`;
                        rowPVs.push(pvText);
                        rowDetails.push(`<span style="color:#e63946">${ev.name}</span>`);
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

            let rate = (a < retAge) ? preIRR : postIRR;
            let mRate = Math.pow(1 + rate, 1/12) - 1;
            let currentCorpus = isFirstYear ? simInitialCorpus : corpus;
            let mSIP = monthlySIP;
            let mSWP = monthlySWP;
            let mOut = rowOutflow / 12;
            let mIn = rowInflow / 12;

            for(let m = 0; m < 12; m++) {
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
                 if (a <= retAge) totalInvestments += (monthlySIP * 12);
            }

            corpus = currentCorpus;

            if (corpus > highestCorpus) highestCorpus = corpus;
            if (a === retAge) corpusAtRetirement = corpus;
            if (a === 80) corpusAt80 = corpus;
            if (corpus <= 0 && exhaustionAge === null && !isFirstYear) {
                exhaustionAge = a;
            }

            tableHtml += `<tr ${a === retAge ? 'style="font-weight:700; background:rgba(0,210,255,0.08)"' : ''}>
                <td>${year}</td>
                <td ${a === retAge ? 'style="color:#00d2ff; font-weight:700;"' : ''}>${a}</td>
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
    const swpAtRetAge = retExpToday * Math.pow(1 + inflation, retAge + 1 + pensionDelay - age); 

    let solvedText = '';
    if (mode === 'solve-lumpsum') {
        solvedText = `<div style="grid-column: 1 / -1; background:linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%); color:#fff; padding:14px; border-radius:12px; text-align:center; font-weight:bold; margin-bottom: 16px;">Required Lumpsum to secure goals till age ${maxAge}: <br><span style="font-size: 24px;">${fmtINR_plain(targetInitialCorpus)}</span></div>`;
    } else if (mode === 'solve-sip') {
        solvedText = `<div style="grid-column: 1 / -1; background:linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%); color:#fff; padding:14px; border-radius:12px; text-align:center; font-weight:bold; margin-bottom: 16px;">Required Monthly SIP to secure goals till age ${maxAge}: <br><span style="font-size: 24px;">${fmtINR_plain(targetInitialSIP)}</span></div>`;
    }

    document.getElementById('report-table').innerHTML = finalSim.tableHtml;
    document.getElementById('report-summary').innerHTML = solvedText + `
        <div class="fp-summary-col">
            <div class="fp-sum-row"><span>Initial Corpus :</span> <strong>${fmtINR_plain(targetInitialCorpus)}</strong></div>
            <div class="fp-sum-row"><span>Initial SIP :</span> <strong>${fmtINR_plain(targetInitialSIP)}</strong></div>
            <div class="fp-sum-row"><span>Step up % :</span> <strong>${(stepUp * 100).toFixed(0)}%</strong></div>
            <div class="fp-sum-row"><span>Pre Retirement IRR :</span> <strong>${(preIRR * 100).toFixed(1)}%</strong></div>
            <div class="fp-sum-row"><span>Post Retirement IRR :</span> <strong>${(postIRR * 100).toFixed(1)}%</strong></div>
            <div class="fp-sum-row"><span>Age :</span> <strong>${age}</strong></div>
            <div class="fp-sum-row"><span>Retirement Age :</span> <strong>${retAge}</strong></div>
            <div class="fp-sum-row"><span>Inflation :</span> <strong>${(inflation * 100).toFixed(1)}%</strong></div>
            <div class="fp-sum-row"><span>Pension Delay :</span> <strong>${pensionDelay} Years</strong></div>
        </div>
        <div class="fp-summary-col">
            <div class="fp-sum-row"><span>Retirement Expense Today :</span> <strong>${fmtINR_plain(retExpToday)}</strong></div>
            <div class="fp-sum-row"><span>Monthly Pension at Ret. :</span> <strong>${fmtINR_plain(swpAtRetAge)}</strong></div>
            <div class="fp-sum-row"><span>Total Investments :</span> <strong>${fmtINR_plain(finalSim.totalInvestments)}</strong></div>
            <div class="fp-sum-row"><span>Total Withdrawals :</span> <strong>${fmtINR_plain(finalSim.totalWithdrawals)}</strong></div>
            <div class="fp-sum-row"><span>Highest Corpus Peak :</span> <strong>${fmtINR_plain(finalSim.highestCorpus)}</strong></div>
            <div class="fp-sum-row"><span>Exhaustion Age :</span> <strong>${finalSim.exhaustionAge || '>'+maxAge}</strong></div>
            <div class="fp-sum-row"><span>Corpus at Retirement :</span> <strong>${fmtINR_plain(finalSim.corpusAtRetirement)}</strong></div>
            <div class="fp-sum-row"><span>Corpus at Age 80 :</span> <strong>${fmtINR_plain(finalSim.corpusAt80)}</strong></div>
        </div>
    `;

    const stickyBtn = document.querySelector('.fp-btn-sticky');
    if (stickyBtn) {
        stickyBtn.innerHTML = '📄 Download Official PDF Report';
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
        fd.append('Pre-Retirement IRR %',       g('inp-pre-irr'));
        fd.append('Post-Retirement IRR %',      g('inp-post-irr'));
        fd.append('Current Expense (Rs/mo)',    g('inp-expense'));
        fd.append('Inflation Rate %',           g('inp-inflation'));
        fd.append('Pension Delay (Years)',      g('inp-pension-delay'));
        fd.append('Analysis Mode',              gSel('inp-solver-mode'));

        const eventRows = document.querySelectorAll('.event-row');
        if (eventRows.length > 0) {
            let eventsText = '';
            eventRows.forEach((row, i) => {
                const evYear = row.querySelector('.ev-age')?.value || '-';
                const evName = row.querySelector('.ev-name')?.value || '-';
                const evPV = row.querySelector('.ev-pv')?.value || '0';
                const evInf = row.querySelector('.ev-inf')?.value || '0';
                const evType = row.querySelector('.ev-type')?.value || '-';
                let line = `${i+1}. ${evName} | Year: ${evYear} | PV: Rs ${parseInt(evPV).toLocaleString('en-IN')} | Infl: ${evInf}% | Type: ${evType}`;
                if (evType === 'loan') {
                    const loanRate = row.querySelector('.ev-loan-rate')?.value || '-';
                    const loanYrs = row.querySelector('.ev-loan-yrs')?.value || '-';
                    line += ` | Loan Rate: ${loanRate}% | Duration: ${loanYrs} Yr`;
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
