// Adjust Input helper
window.adjustInput = function (id, delta) {
  const el = document.getElementById(id);
  if (!el) return;
  let val = parseFloat(el.value) || 0;
  val += delta;
  const min = parseFloat(el.min);
  const max = parseFloat(el.max);
  if (!isNaN(min) && val < min) val = min;
  if (!isNaN(max) && val > max) val = max;
  const stepAttr = el.getAttribute('step') || '1';
  const decimals = (stepAttr.split('.')[1] || '').length;
  el.value = val.toFixed(decimals);
  el.dispatchEvent(new Event('input'));
};

// Scroll reveal
const revEls = document.querySelectorAll(".reveal");
const revObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        revObs.unobserve(e.target);
      }
    });
  },
  {
    threshold: 0.1,
    rootMargin: "0px 0px -40px 0px",
  }
);
revEls.forEach((el) => revObs.observe(el));

// Mobile Menu Toggle
window.toggleMobileMenu = function () {
  const links = document.querySelector('.nav-links');
  links.classList.toggle('mobile-active');
};

// Close mobile menu on link click
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelector('.nav-links').classList.remove('mobile-active');
  });
});

// Slider gradient
function updateSlider(el) {
  if (!el || isNaN(parseFloat(el.max))) return;
  const val = parseFloat(el.value);
  const min = parseFloat(el.min) || 0;
  const max = parseFloat(el.max) || 100;
  const pct = (((val - min) / (max - min)) * 100).toFixed(1);
  el.style.background = `linear-gradient(to right,#4BA3D4 0%,#4BA3D4 ${pct}%,#dde6ef ${pct}%,#dde6ef 100%)`;
}

// SIP calculator helpers
function fmtINR(n) {
  if (n >= 10000000) return "₹" + (n / 10000000).toFixed(2) + " Cr";
  if (n >= 100000) return "₹" + (n / 100000).toFixed(2) + " L";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function calcSIP() {
  const iLump = document.getElementById("i-lump");
  const iAmt = document.getElementById("i-amt");
  const iSipYrs = document.getElementById("i-sip-yrs");
  const stepTypeEl = document.getElementById("step-type");
  const iStep = document.getElementById("i-step");
  const iYrs = document.getElementById("i-yrs");
  const iRate = document.getElementById("i-rate");

  if (!iAmt || !iYrs || !iRate || !iLump || !iSipYrs) return;

  const lumpsum = +iLump.value || 0;
  let sipAmount = +iAmt.value || 0;
  let sipYrs = +iSipYrs.value || 0;
  const stepType = stepTypeEl ? stepTypeEl.value : "none";
  const stepValue = iStep ? (+iStep.value || 0) : 0;

  let totalYrs = +iYrs.value || 0;
  const rateNum = +iRate.value || 0;

  if (sipYrs > totalYrs) {
    totalYrs = sipYrs;
    iYrs.value = totalYrs;
    const sYrs = document.getElementById("s-yrs");
    if (sYrs) sYrs.value = totalYrs;
  }


  const monthlyRate = Math.pow(1 + rateNum / 100, 1 / 12) - 1;
  const totalMonths = totalYrs * 12;
  const sipMonths = Math.min(sipYrs * 12, totalMonths); // constrain SIP months

  let corpus = lumpsum;
  let invested = lumpsum;
  let currentSip = sipAmount;

  for (let m = 1; m <= totalMonths; m++) {
    if (m <= sipMonths) {
      corpus += currentSip;
      invested += currentSip;
    }

    corpus *= (1 + monthlyRate);

    if (m % 12 === 0 && m < sipMonths) {
      if (stepType === 'pct') {
        currentSip += currentSip * (stepValue / 100);
      } else if (stepType === 'amt') {
        currentSip += stepValue;
      }
    }
  }

  const returns = corpus > invested ? corpus - invested : 0;
  const gainPct = invested > 0 ? ((returns / invested) * 100).toFixed(1) : "0.0";
  const invW = corpus > 0 ? Math.min(100, Math.round((invested / corpus) * 100)) : 100;
  const retW = Math.max(0, 100 - invW);

  document.getElementById("r-corpus").textContent = fmtINR(corpus);
  document.getElementById("r-invested").textContent = fmtINR(invested);
  document.getElementById("r-returns").textContent = fmtINR(returns);
  document.getElementById("r-gain").textContent = "+" + gainPct + "%";

  const chartEl = document.getElementById("sip-chart");
  if (chartEl) {
    chartEl.style.background = `conic-gradient(#4ba3d4 0% ${retW}%, rgba(255, 255, 255, 0.15) ${retW}% 100%)`;
  }

}

const inputs = [
  "i-lump",
  "i-amt",
  "i-sip-yrs",
  "i-yrs",
  "i-rate"
];

inputs.forEach(id => {
  const i = document.getElementById(id);
  if (i) {
    i.addEventListener("input", calcSIP);
    i.addEventListener("blur", (e) => {
      let val = parseFloat(e.target.value);
      const min = parseFloat(i.min);
      const max = parseFloat(i.max);
      if (isNaN(val) || val < min) val = min;
      if (!isNaN(max) && val > max) val = max;
      e.target.value = val;
      calcSIP();
    });
  }
});

const stepTypeEl = document.getElementById("step-type");
const stepValWrap = document.getElementById("step-val-wrap");
if (stepTypeEl && document.getElementById("i-step")) {
  stepTypeEl.addEventListener("change", () => {
    if (stepValWrap) {
      stepValWrap.style.display = stepTypeEl.value === 'none' ? 'none' : 'flex';
    }
    calcSIP();
  });
  document.getElementById("i-step").addEventListener("input", calcSIP);
}



// Contact form behavior with Email delivery via FormSubmit
const contactForm = document.getElementById("contactForm");
if (contactForm) {
  contactForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const btn = document.getElementById("submitBtn");
    if (!btn) return;
    const originalText = btn.textContent;

    // 1. Visual feedback
    btn.textContent = "Sending...";
    btn.disabled = true;

    // 2. Prepare Data
    const formData = new FormData(contactForm);
    formData.append('_subject', 'New Consultation Request - ' + (formData.get('name') || 'Website'));
    formData.append('_template', 'table');

    // 3. POST to FormSubmit
    fetch("https://formsubmit.co/ajax/srpprimewealth@gmail.com", {
      method: "POST",
      headers: { 
          'Accept': 'application/json'
      },
      body: formData
    })
      .then(response => response.json())
      .then(data => {
        if (data.success === "false") throw new Error("FormSubmit Error");
        
        // Success feedback
        btn.textContent = "✓ Request Sent! We will contact you soon.";
        btn.style.background = "#2d6a4f";
        contactForm.reset();

        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = "";
          btn.disabled = false;
        }, 5000);
      })
      .catch(error => {
        console.error('Submission Error:', error);
        alert("Something went wrong. Please check your internet or contact us directly on WhatsApp (+91 75618 05630).");
        btn.textContent = originalText;
        btn.disabled = false;
      });
  });
}

// Retirement Calculator Logic
function calcRetirement() {
  const curAge = +document.getElementById("i-ret-age").value || 0;
  const retAge = +document.getElementById("i-ret-rage").value || 0;
  const lifeExp = +document.getElementById("i-ret-life").value || 0;
  const curExp = +document.getElementById("i-ret-exp").value || 0;
  const inf = +document.getElementById("i-ret-inf").value || 0;
  const preRet = +document.getElementById("i-ret-preret").value || 0;
  const postRet = +document.getElementById("i-ret-post").value || 0;

  let yrsToRetire = retAge - curAge;
  let yrsInRetire = lifeExp - retAge;

  if (yrsToRetire < 0) yrsToRetire = 0;
  if (yrsInRetire < 0) yrsInRetire = 0;

  // 1. Future Value of Expenses (at Retirement Age) using daily compounding approximation for closer matches
  const infRate = inf / 100;
  let futureExp = curExp * Math.pow(1 + infRate, yrsToRetire);

  // 2. Real Rate of Return post-retirement (Geometric)
  const rPost = postRet / 100;
  const realRate = (1 + rPost) / (1 + infRate) - 1;
  const realRateMo = Math.pow(1 + realRate, 1 / 12) - 1;
  const nRetireMonths = yrsInRetire * 12;

  // 3. Target Corpus (Present Value of an Annuity Due - withdrawn at beginning of month)
  let targetCorpus = 0;
  if (Math.abs(realRateMo) > 0.0001) {
    targetCorpus = futureExp * ((1 - Math.pow(1 + realRateMo, -nRetireMonths)) / realRateMo) * (1 + realRateMo);
  } else {
    // If real rate is exactly or very close to 0
    targetCorpus = futureExp * nRetireMonths;
  }

  // 4. Required SIP & Lumpsum (Investment to reach target corpus)
  let reqSip = 0;
  let reqLump = 0;

  if (yrsToRetire > 0 && targetCorpus > 0) {
    const nAccMonths = yrsToRetire * 12;

    if (preRet > 0 && nAccMonths > 0) {
      const rPreMo = Math.pow(1 + preRet / 100, 1 / 12) - 1;
      // Annuity Due PMT equation
      reqSip = targetCorpus * rPreMo / (Math.pow(1 + rPreMo, nAccMonths) - 1) / (1 + rPreMo);
      // PV of Target Corpus
      reqLump = targetCorpus / Math.pow(1 + rPreMo, nAccMonths);
    } else {
      reqSip = targetCorpus / (nAccMonths || 1);
      reqLump = targetCorpus;
    }
  } else if (yrsToRetire <= 0 && targetCorpus > 0) {
    reqLump = targetCorpus;
    reqSip = 0;
  }

  let totalInvested = reqSip * yrsToRetire * 12;
  let totalWithdrawn = 0;
  for (let m = 0; m < nRetireMonths; m++) {
    let yr = Math.floor(m / 12);
    totalWithdrawn += futureExp * Math.pow(1 + infRate, yr);
  }

  // Update DOM
  const corpusEl = document.getElementById("r-ret-corpus");
  const moExpEl = document.getElementById("r-ret-mo-exp");
  const sipEl = document.getElementById("r-ret-sip");
  const lumpEl = document.getElementById("r-ret-lump");

  if (corpusEl) corpusEl.textContent = fmtINR(targetCorpus);
  if (moExpEl) moExpEl.textContent = fmtINR(futureExp);

  const invEl = document.getElementById("r-ret-invested");
  if (invEl) invEl.textContent = fmtINR(totalInvested);

  const wdEl = document.getElementById("r-ret-withdrawn");
  if (wdEl) wdEl.textContent = fmtINR(totalWithdrawn);

  if (sipEl) sipEl.textContent = fmtINR(reqSip);
  if (lumpEl) lumpEl.textContent = fmtINR(reqLump);

  // Prepare Chart Data
  let chartLabels = [];
  let chartCorpus = [];
  let chartExpenses = [];

  for (let y = 0; y <= yrsInRetire; y++) {
    let age = retAge + y;
    chartLabels.push("Age " + age);

    let monthsLeft = (yrsInRetire - y) * 12;
    let expenseAtYear = futureExp * Math.pow(1 + infRate, y);
    chartExpenses.push(Math.round(expenseAtYear));

    let corpusAtYear = 0;
    if (Math.abs(realRateMo) > 0.0001) {
      corpusAtYear = expenseAtYear * ((1 - Math.pow(1 + realRateMo, -monthsLeft)) / realRateMo) * (1 + realRateMo);
    } else {
      corpusAtYear = expenseAtYear * monthsLeft;
    }
    chartCorpus.push(Math.round(corpusAtYear));
  }

  // Draw chart
  const ctx = document.getElementById("retireChart");
  if (ctx && window.Chart) {
    try {
      if (window.retireChartInstance) {
        window.retireChartInstance.destroy();
      }
      window.retireChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: chartLabels,
          datasets: [
            {
              type: 'line',
              label: 'Corpus Value',
              data: chartCorpus,
              borderColor: '#4ba3d4',
              backgroundColor: 'rgba(75, 163, 212, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              yAxisID: 'y'
            },
            {
              type: 'bar',
              label: 'Future Monthly Expense',
              data: chartExpenses,
              backgroundColor: 'rgba(230, 57, 70, 0.8)',
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: 'rgba(255, 255, 255, 0.7)', font: { family: "'Inter', sans-serif" } } }
          },
          scales: {
            x: { ticks: { color: 'rgba(255, 255, 255, 0.5)' }, grid: { display: false } },
            y: {
              type: 'linear', display: true, position: 'left',
              ticks: { color: 'rgba(255, 255, 255, 0.5)', callback: function (v) { return '₹' + (v / 10000000).toFixed(1) + 'Cr'; } },
              grid: { color: 'rgba(255, 255, 255, 0.1)' },
              title: { display: true, text: 'Corpus', color: 'rgba(255, 255, 255, 0.5)' }
            },
            y1: {
              type: 'linear', display: true, position: 'right',
              ticks: { color: 'rgba(255, 255, 255, 0.5)', callback: function (v) { return '₹' + (v / 100000).toFixed(1) + 'L'; } },
              grid: { display: false },
              title: { display: true, text: 'Monthly Expense', color: 'rgba(255, 255, 255, 0.5)' }
            }
          }
        }
      });
    } catch (e) {
      console.error("Retirement Chart error:", e);
    }
  }

  // Sync sliders
}

const retInputs = [
  "i-ret-age",
  "i-ret-rage",
  "i-ret-life",
  "i-ret-exp",
  "i-ret-inf",
  "i-ret-preret",
  "i-ret-post"
];

retInputs.forEach(id => {
  const i = document.getElementById(id);
  if (i) {
    i.addEventListener("input", calcRetirement);
    i.addEventListener("blur", (e) => {
      let val = parseFloat(e.target.value);
      const min = parseFloat(i.min);
      const max = parseFloat(i.max);
      if (isNaN(val) || val < min) val = min;
      if (!isNaN(max) && val > max) val = max;
      e.target.value = val;
      calcRetirement();
    });
  }
});

window.downloadRetirementPDF = function () {
  const element = document.getElementById("retire-print-area");
  if (!element) return;

  // Clone the element to safely modify styles for printing
  const elementClone = element.cloneNode(true);

  // Apply specific styles for PDF to ensure it outputs nicely
  elementClone.style.background = '#0d1838'; // Dark theme background
  elementClone.style.color = '#ffffff';
  elementClone.style.padding = '40px';
  elementClone.style.borderRadius = '0'; // Remove rounding

  // Create a detached container for html2pdf
  const printContainer = document.createElement('div');
  printContainer.appendChild(elementClone);

  const opt = {
    margin: 0.5,
    filename: 'Retirement_Plan_Report.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0d1838' },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
  };

  html2pdf().set(opt).from(printContainer).save();
};

// Goal Planning Calculator Logic
function calcGoal() {
  const goalAmt = +document.getElementById("i-goal-amt").value || 0;
  const yrs = +document.getElementById("i-goal-yrs").value || 0;
  const inf = +document.getElementById("i-goal-inf").value || 0;
  const rate = +document.getElementById("i-goal-rate").value || 0;

  // 1. Future Goal Value
  const infRate = inf / 100;
  const fv = goalAmt * Math.pow(1 + infRate, yrs);

  // 2. Required SIP
  let sip = 0;
  let lump = 0;
  let goalW = 0;

  if (yrs > 0 && fv > 0) {
    const rMo = Math.pow(1 + rate / 100, 1 / 12) - 1;
    const nMonths = yrs * 12;

    if (rMo > 0) {
      sip = fv * rMo / (Math.pow(1 + rMo, nMonths) - 1) / (1 + rMo);
      lump = fv / Math.pow(1 + rMo, nMonths);
    } else {
      sip = fv / nMonths;
      lump = fv;
    }

    // Viz weight (ratio of principal invested via sip to total goal)
    goalW = Math.min(94, Math.round(((sip * nMonths) / fv) * 100));
  }

  document.getElementById("r-goal-today").textContent = fmtINR(goalAmt);
  const fvStr = fmtINR(fv);
  document.getElementById("r-goal-fv").textContent = fvStr;
  const fvCenter = document.getElementById("r-goal-fv-center");
  if (fvCenter) fvCenter.textContent = fvStr;

  document.getElementById("r-goal-sip").textContent = fmtINR(sip);
  document.getElementById("r-goal-lump").textContent = fmtINR(lump);

  // Split calculations
  const totalPrincipal = sip * yrs * 12;
  const totalProfit = Math.max(0, fv - totalPrincipal);

  const invValEl = document.getElementById("r-goal-invested-val");
  const profValEl = document.getElementById("r-goal-profit-val");
  if (invValEl) invValEl.textContent = fmtINR(totalPrincipal);
  if (profValEl) profValEl.textContent = fmtINR(totalProfit);

  const chartEl = document.getElementById("goal-chart");
  if (chartEl) {
    // Match SIP calculator: Blue = Profit, Gray = Invested
    // goalW is principal invested %, so profit is 100 - goalW
    const retW = 100 - goalW;
    chartEl.style.background = `conic-gradient(#4ba3d4 0% ${retW}%, rgba(255, 255, 255, 0.15) ${retW}% 100%)`;
  }

  ["s-goal-amt", "s-goal-yrs", "s-goal-inf", "s-goal-rate"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) updateSlider(el);
  });
}

const goalInputs = [
  "i-goal-amt",
  "i-goal-yrs",
  "i-goal-inf",
  "i-goal-rate"
];

goalInputs.forEach(id => {
  const i = document.getElementById(id);
  if (i) {
    i.addEventListener("input", calcGoal);
    i.addEventListener("blur", (e) => {
      let val = parseFloat(e.target.value);
      const min = parseFloat(i.min);
      const max = parseFloat(i.max);
      if (isNaN(val) || val < min) val = min;
      if (val > max) val = max;
      e.target.value = val;
      calcGoal();
    });
  }
});


// Loan & EMI Calculator Logic
// Tab Switching Logic
window.switchCalcTab = function (tabId, btn) {
  const tabs = document.querySelectorAll('.calc-tab-content');
  tabs.forEach(t => t.classList.remove('active'));
  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add('active');

  const btns = document.querySelectorAll('.calc-tab-btn');
  btns.forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // Recalculate based on active tab
  try {
    if (tabId === 'calc-sip') calcSIP();
    if (tabId === 'calc-retire') calcRetirement();
    if (tabId === 'calc-goal') calcGoal();
    if (tabId === 'calc-loan') calcLoan();
    if (tabId === 'calc-xirr') calcXirr();
  } catch (e) {
    console.error("Tab switch calculation error:", e);
  }
};

window.setLoanMode = function (mode, btn) {
  document.getElementById('loan-calculator-mode').value = mode;

  // Toggle active button
  const btns = document.querySelectorAll('.loan-mode-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Show/Hide fields
  document.getElementById('group-loan-amt').style.display = (mode === 'amt') ? 'none' : 'block';
  document.getElementById('group-loan-rate').style.display = (mode === 'rate') ? 'none' : 'block';
  document.getElementById('group-loan-yrs').style.display = (mode === 'yrs') ? 'none' : 'block';
  document.getElementById('group-loan-emi').style.display = (mode === 'emi') ? 'none' : 'block';

  // Label update
  const label = document.getElementById('loan-res-label');
  if (mode === 'emi') label.textContent = 'Estimated Monthly EMI';
  if (mode === 'amt') label.textContent = 'Maximum Loan Amount';
  if (mode === 'rate') label.textContent = 'Required Interest Rate';
  if (mode === 'yrs') label.textContent = 'Loan Tenure';

  calcLoan();
};

window.setLoanTenureType = function (type) {
  const typeEl = document.getElementById("i-loan-tenure-type");
  const yrBtn = document.getElementById("btn-tenure-yr");
  const moBtn = document.getElementById("btn-tenure-mo");
  const suffixEl = document.getElementById("label-loan-yrs-suffix");

  if (typeEl) typeEl.value = type;

  if (type === 'yr') {
    if (yrBtn) { yrBtn.style.background = "#1a2d5a"; yrBtn.style.color = "white"; }
    if (moBtn) { moBtn.style.background = "transparent"; moBtn.style.color = "#64748b"; }
    if (suffixEl) suffixEl.textContent = "Yr";
  } else {
    if (moBtn) { moBtn.style.background = "#1a2d5a"; moBtn.style.color = "white"; }
    if (yrBtn) { yrBtn.style.background = "transparent"; yrBtn.style.color = "#64748b"; }
    if (suffixEl) suffixEl.textContent = "Mo";
  }

  calcLoan();
};

function calcLoan() {
  const mode = document.getElementById('loan-calculator-mode').value;
  let loanAmt = +document.getElementById("i-loan-amt").value || 0;
  let rate = +document.getElementById("i-loan-rate").value || 0;
  let tenureVal = +document.getElementById("i-loan-yrs").value || 0;
  let inputEmi = +document.getElementById("i-loan-emi-input").value || 0;

  const typeEl = document.getElementById("i-loan-tenure-type");
  const tenureType = typeEl ? typeEl.value : 'yr';
  let yrs = (tenureType === 'mo') ? (tenureVal / 12) : tenureVal;
  let nMonths = (tenureType === 'mo') ? tenureVal : (tenureVal * 12);

  let emi = 0;
  let resultVal = 0;
  let totalPayment = 0;
  let totalInt = 0;
  let prinW = 100;

  const rMo = Math.pow(1 + rate / 100, 1 / 12) - 1;

  if (mode === 'emi') {
    if (nMonths > 0 && loanAmt > 0) {
      if (rMo > 0) {
        emi = loanAmt * rMo * Math.pow(1 + rMo, nMonths) / (Math.pow(1 + rMo, nMonths) - 1);
      } else {
        emi = loanAmt / nMonths;
      }
    }
    resultVal = emi;
    totalPayment = emi * nMonths;
  }
  else if (mode === 'amt') {
    if (rMo > 0 && nMonths > 0) {
      loanAmt = inputEmi * (Math.pow(1 + rMo, nMonths) - 1) / (rMo * Math.pow(1 + rMo, nMonths));
    } else {
      loanAmt = inputEmi * nMonths;
    }
    resultVal = loanAmt;
    emi = inputEmi;
    totalPayment = emi * nMonths;
  }
  else if (mode === 'yrs') {
    if (rMo > 0 && inputEmi > (loanAmt * rMo)) {
      const n = Math.log(inputEmi / (inputEmi - loanAmt * rMo)) / Math.log(1 + rMo);
      yrs = n / 12;
      nMonths = n;
    } else if (rMo === 0 && inputEmi > 0) {
      yrs = loanAmt / inputEmi / 12;
      nMonths = loanAmt / inputEmi;
    } else {
      yrs = Infinity;
      nMonths = Infinity;
    }
    resultVal = (tenureType === 'mo') ? nMonths : yrs;
    emi = inputEmi;
    totalPayment = emi * nMonths;
  }
  else if (mode === 'rate') {
    // Iterative solve for Rate
    if (loanAmt > 0 && nMonths > 0) {
      if (inputEmi > (loanAmt / nMonths)) {
        let low = 0, high = 1; // 0% to 1200% annual
        for (let i = 0; i < 20; i++) {
          let mid = (low + high) / 2;
          let testEmi = loanAmt * mid * Math.pow(1 + mid, nMonths) / (Math.pow(1 + mid, nMonths) - 1);
          if (testEmi > inputEmi) high = mid;
          else low = mid;
        }
        rate = low * 12 * 100;
      } else {
        rate = 0;
      }
    }
    resultVal = rate;
    emi = inputEmi;
    totalPayment = emi * nMonths;
  }

  totalInt = Math.max(0, totalPayment - loanAmt);
  prinW = totalPayment > 0 ? Math.min(100, Math.round((loanAmt / totalPayment) * 100)) : 100;

  // Display Result
  const resEl = document.getElementById("r-loan-emi");
  if (resultVal === Infinity || isNaN(resultVal)) {
    resEl.textContent = "Inf";
  } else if (mode === 'emi' || mode === 'amt') {
    resEl.textContent = fmtINR(resultVal);
  } else if (mode === 'rate') {
    resEl.textContent = resultVal.toFixed(2) + "%";
  } else if (mode === 'yrs') {
    resEl.textContent = resultVal.toFixed(1) + (tenureType === 'mo' ? " Mo" : " Yr");
  }

  document.getElementById("r-loan-prin").textContent = fmtINR(loanAmt);

  if (totalPayment === Infinity || isNaN(totalPayment)) {
    document.getElementById("r-loan-total").textContent = "Infinite";
    document.getElementById("r-loan-int").textContent = "Infinite";
    prinW = 0; // if payment is infinite, it's virtually all interest
  } else {
    document.getElementById("r-loan-total").textContent = fmtINR(totalPayment);
    document.getElementById("r-loan-int").textContent = fmtINR(totalInt);
  }

  const chartEl = document.getElementById("loan-chart");
  if (chartEl) {
    chartEl.style.background = `conic-gradient(#4ba3d4 0% ${prinW}%, #e63946 ${prinW}% 100%)`;
  }

  // Update sliders
  ["s-loan-amt", "s-loan-rate", "s-loan-yrs", "s-loan-emi-input"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) updateSlider(el);
  });
}

const loanInputs = [
  "i-loan-amt",
  "i-loan-rate",
  "i-loan-yrs",
  "i-loan-emi-input",
  "i-loan-tenure-type"
];

loanInputs.forEach(id => {
  const i = document.getElementById(id);
  if (i) {
    i.addEventListener("input", calcLoan);
    i.addEventListener("blur", (e) => {
      let val = parseFloat(e.target.value);
      const min = parseFloat(i.min);
      const max = parseFloat(i.max);
      if (isNaN(val) || val < min) val = min;
      if (val > max) val = max;
      e.target.value = val;
      calcLoan();
    });
  }
});


// XIRR CALCULATOR LOGIC

window.addSingleRow = function (date = '', amount = '', afterRow = null) {
  const body = document.getElementById('xirr-body');
  if (!body) return;

  const row = document.createElement('tr');
  row.style.borderBottom = "1px solid #f1f5f9";

  if (!date) {
    const refInput = (afterRow && afterRow !== 'start') ? afterRow.querySelector('.x-date') : body.querySelector('tr:last-child .x-date');
    if (refInput && refInput.value) {
      let d = new Date(refInput.value);
      d.setMonth(d.getMonth() + 1);
      date = d.toISOString().split('T')[0];
    } else {
      date = new Date().toISOString().split('T')[0];
    }
  }

  row.innerHTML = `
    <td style="padding: 8px 12px;"><input type="date" class="range-input x-date" value="${date}" style="width: 100%; text-align: left; background: transparent; border-color: transparent; border-radius: 0;"></td>
    <td style="padding: 8px 12px;"><input type="number" class="range-input x-amt" value="${amount}" step="100" style="width: 100%; text-align: right; background: transparent; border-color: transparent; border-radius: 0;"></td>
    <td style="padding: 8px 12px; text-align: center; display: flex; justify-content: center; gap: 8px;">
      <button onclick="addSingleRow('', '', this.parentElement.parentElement)" style="background:none; border:none; cursor:pointer; color:#4ba3d4; font-size:16px;" title="Insert row below">+</button>
      <button onclick="this.parentElement.parentElement.remove(); calcXirr();" style="background:none; border:none; cursor:pointer; color:#e63946; font-size:16px;" title="Delete row">×</button>
    </td>
  `;

  if (afterRow === 'start') {
    body.insertBefore(row, body.firstChild);
  } else if (afterRow) {
    afterRow.parentNode.insertBefore(row, afterRow.nextSibling);
  } else {
    body.appendChild(row);
  }

  const amtInput = row.querySelector('.x-amt');
  const dateInput = row.querySelector('.x-date');

  amtInput.addEventListener('input', () => {
    updateXirrRowStyle(amtInput);
    calcXirr();
  });
  dateInput.addEventListener('input', calcXirr);

  updateXirrRowStyle(amtInput);
  calcXirr();
};

function updateXirrRowStyle(input) {
  const val = parseFloat(input.value) || 0;
  if (val < 0) {
    input.style.color = "#e63946"; // Red for outflow
    input.style.fontWeight = "600";
  } else if (val > 0) {
    input.style.color = "#4ba3d4"; // Blue for inflow
    input.style.fontWeight = "600";
  } else {
    input.style.color = "#94a3b8";
  }
}

window.generateFlows = function () {
  const freq = parseInt(document.getElementById('x-freq').value);
  const count = parseInt(document.getElementById('x-count').value);
  let amt = parseFloat(document.getElementById('x-start-amt').value);
  const stepVal = parseFloat(document.getElementById('x-step-val').value) || 0;
  const stepType = document.getElementById('x-step-type').value;

  let lastDate = new Date();
  const lastDateInput = document.querySelector('#xirr-body tr:last-child .x-date');
  if (lastDateInput && lastDateInput.value) {
    lastDate = new Date(lastDateInput.value);
    lastDate.setMonth(lastDate.getMonth() + freq);
  }

  for (let i = 0; i < count; i++) {
    const dStr = lastDate.toISOString().split('T')[0];
    addSingleRow(dStr, String(Math.round(amt)));

    lastDate.setMonth(lastDate.getMonth() + (freq === 1 ? 1 : 12));

    if ((freq === 1 && (i + 1) % 12 === 0) || freq === 12) {
      if (stepType === 'pct') amt = Math.round(amt * (1 + stepVal / 100));
      else amt = Math.round(amt + stepVal);
    }
  }
};

window.clearXirr = function () {
  if (confirm("Clear all cashflow entries?")) {
    document.getElementById('xirr-body').innerHTML = '';
    calcXirr();
  }
};

window.calcXirr = function () {
  const rows = document.querySelectorAll('#xirr-body tr');
  const data = [];
  let inflow = 0;
  let outflow = 0;

  rows.forEach(row => {
    const d = row.querySelector('.x-date').value;
    const v = parseFloat(row.querySelector('.x-amt').value) || 0;
    if (d && v !== 0) {
      data.push({ date: new Date(d), amt: v });
      if (v > 0) inflow += v;
      else outflow += Math.abs(v);
    }
  });

  document.getElementById('r-xirr-in').textContent = fmtINR(inflow);
  document.getElementById('r-xirr-out').textContent = fmtINR(outflow);
  const net = inflow - outflow;
  const netEl = document.getElementById('r-xirr-net');
  netEl.textContent = fmtINR(net);
  if (net > 0) netEl.style.color = "#25d366";
  else if (net < 0) netEl.style.color = "#e63946";
  else netEl.style.color = "#fff";

  if (data.length < 2) {
    document.getElementById('r-xirr-val').textContent = "0.00%";
    document.getElementById('xirr-status').textContent = "Input at least 1 outflow (-) and 1 inflow (+)";
    return;
  }

  data.sort((a, b) => a.date - b.date);

  const xirr = solveXirr(data);
  const resEl = document.getElementById('r-xirr-val');
  const statusEl = document.getElementById('xirr-status');

  if (isNaN(xirr) || Math.abs(xirr) > 1000) {
    resEl.textContent = "Err";
    statusEl.textContent = "Check Data and Signs";
  } else {
    resEl.textContent = (xirr * 100).toFixed(2) + "%";
    statusEl.textContent = "Annualized Return (XIRR)";
    resEl.style.color = xirr >= 0 ? "#fff" : "#e63946";
  }
};

function solveXirr(data) {
  const values = data.map(d => d.amt);
  const dates = data.map(d => d.date);

  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    let f = 0;
    let df = 0;
    for (let j = 0; j < values.length; j++) {
      const di = (dates[j] - dates[0]) / (365 * 24 * 60 * 60 * 1000);
      const common = Math.pow(1 + rate, di);
      f += values[j] / common;
      df -= (values[j] * di) / (common * (1 + rate));
    }
    let newRate = rate - f / df;
    if (Math.abs(newRate - rate) < 0.00001) return newRate;
    rate = newRate;
    if (isNaN(rate)) return NaN;
  }
  return rate;
}


// ===== INVESTMENT GROWTH READY RECKONER =====
const RK_SIP_PERIODS = [1, 2, 3, 4, 5, 10, 15, 20];
const RK_TOTAL_DURATIONS = [5, 10, 15, 20, 25, 30, 35, 40];

function rkFmtCorpus(n) {
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr';
  if (n >= 100000)   return '₹' + (n / 100000).toFixed(2) + ' L';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function rkCalcCorpus(lumpsum, sipAmt, hikePercent, ratePercent, sipYrs, totalYrs) {
  if (sipYrs > totalYrs) return null; // invalid combination
  const monthlyRate = Math.pow(1 + ratePercent / 100, 1 / 12) - 1;
  const totalMonths = totalYrs * 12;
  const sipMonths = sipYrs * 12;
  let corpus = lumpsum;
  let currentSip = sipAmt;

  for (let m = 1; m <= totalMonths; m++) {
    if (m <= sipMonths) {
      corpus += currentSip;
    }
    corpus *= (1 + monthlyRate);
    // Annual hike at end of each year, while SIP is active
    if (m % 12 === 0 && m < sipMonths) {
      currentSip += currentSip * (hikePercent / 100);
    }
  }
  return corpus;
}

function rkCalcTotalInvested(lumpsum, sipAmt, hikePercent, sipYrs) {
  let invested = lumpsum;
  let currentSip = sipAmt;
  const sipMonths = sipYrs * 12;
  for (let m = 1; m <= sipMonths; m++) {
    invested += currentSip;
    if (m % 12 === 0 && m < sipMonths) {
      currentSip += currentSip * (hikePercent / 100);
    }
  }
  return invested;
}

function rkCellClass(corpus, baseSip, ratePercent, totalYrs) {
  if (corpus === null) return 'rk-cell-na';
  if (baseSip <= 0) return 'rk-cell-ultra';
  
  // Inflate base SIP by 7% per year to compare future growth in today's terms
  const inflatedSip = baseSip * Math.pow(1.07, totalYrs);
  
  const monthlyRate = Math.pow(1 + ratePercent / 100, 1 / 12) - 1;
  const monthlyGrowth = corpus * monthlyRate;
  const ratio = monthlyGrowth / inflatedSip;

  if (ratio < 1)  return 'rk-cell-low';    // < 1x Inflated SIP
  if (ratio < 2)  return 'rk-cell-mid';    // 1x - 2x
  if (ratio < 5)  return 'rk-cell-high';   // 2x - 5x
  if (ratio < 10) return 'rk-cell-vhigh';  // 5x - 10x
  return 'rk-cell-ultra';                  // >= 10x
}

function calcReckoner() {
  const lump = +(document.getElementById('rk-lump') || {}).value || 0;
  const sip  = +(document.getElementById('rk-sip')  || {}).value || 0;
  const hike = +(document.getElementById('rk-hike') || {}).value || 0;
  const rate = +(document.getElementById('rk-rate') || {}).value || 0;

  // Build header
  const thead = document.querySelector('#reckoner-table thead tr');
  if (!thead) return;
  // Keep corner th, remove the rest
  while (thead.children.length > 1) thead.removeChild(thead.lastChild);
  RK_TOTAL_DURATIONS.forEach(d => {
    const th = document.createElement('th');
    th.textContent = d + ' Yr';
    thead.appendChild(th);
  });

  // Build body
  const tbody = document.getElementById('reckoner-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  RK_SIP_PERIODS.forEach(sipYrs => {
    const tr = document.createElement('tr');

    // Row header — SIP period + total invested
    const tdLabel = document.createElement('td');
    const totalInvested = rkCalcTotalInvested(lump, sip, hike, sipYrs);
    tdLabel.innerHTML =
      '<span class="rk-row-label-sip">' + sipYrs + (sipYrs === 1 ? ' Year SIP' : ' Years SIP') + '</span>' +
      '<span class="rk-row-label-invested">Invested: ' + rkFmtCorpus(totalInvested) + '</span>';
    tr.appendChild(tdLabel);

    RK_TOTAL_DURATIONS.forEach(totalYrs => {
      const td = document.createElement('td');
      const corpus = rkCalcCorpus(lump, sip, hike, rate, sipYrs, totalYrs);
      if (corpus === null) {
        td.textContent = '—';
      } else {
        td.textContent = rkFmtCorpus(corpus);
      }
      td.className = rkCellClass(corpus, sip, rate, totalYrs);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// Wire up reckoner inputs
['rk-lump', 'rk-sip', 'rk-hike', 'rk-rate'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', calcReckoner);
    el.addEventListener('blur', function () {
      let v = parseFloat(this.value);
      const min = parseFloat(this.min);
      if (isNaN(v) || v < min) v = min;
      this.value = v;
      calcReckoner();
    });
  }
});

// Run initially
function initCalculators() {
  const tryCalc = (id, fn) => {
    try {
      if (document.getElementById(id)) fn();
    } catch (e) {
      console.error(`Error initializing calculator (${id}):`, e);
    }
  };

  tryCalc("i-amt", calcSIP);
  tryCalc("i-ret-age", calcRetirement);
  tryCalc("i-goal-amt", calcGoal);
  tryCalc("i-loan-amt", calcLoan);
  tryCalc("rk-lump", calcReckoner);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCalculators);
} else {
  initCalculators();
}

// Tab Switching Logic (already handles calcLoan)
