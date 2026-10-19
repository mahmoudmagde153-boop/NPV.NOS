let currentProject = 'Zomra';
let typingTimer;

let discountRates = {
    0: 19, 1: 18, 2: 15, 3: 15, 4: 10,
    5: 10, 6: 9, 7: 9, 8: 9, 9: 9, 10: 9, 11: 9, 12: 9, 13: 9, 14: 9, 15: 9
};

let globalCustomFlows = [];
let basePvCache = 0;
let basePriceCache = 0;

// --- Installment Distribution State & Handlers ---
window.globalDistState = {
    mode: 'auto', // 'auto', 'front', 'back', 'equal', 'custom'
    typedPrePct: null,
    typedPostPct: null
};

window.onPreDelivPctInput = function() {
    let valStr = document.getElementById('pre-deliv-inst-pct').value;
    if (valStr.trim() === '') {
        window.globalDistState.mode = 'auto';
        window.globalDistState.typedPrePct = null;
        window.globalDistState.typedPostPct = null;
    } else {
        window.globalDistState.mode = 'custom';
        window.globalDistState.typedPrePct = parseFloat(valStr) || 0;
        window.globalDistState.typedPostPct = null;
    }
    delayedCalculate();
};

window.onPostDelivPctInput = function() {
    let valStr = document.getElementById('post-deliv-inst-pct').value;
    if (valStr.trim() === '') {
        window.globalDistState.mode = 'auto';
        window.globalDistState.typedPrePct = null;
        window.globalDistState.typedPostPct = null;
    } else {
        window.globalDistState.mode = 'custom';
        window.globalDistState.typedPostPct = parseFloat(valStr) || 0;
        window.globalDistState.typedPrePct = null;
    }
    delayedCalculate();
};

window.setDistPreset = function(preset) {
    window.globalDistState.mode = preset;
    window.globalDistState.typedPrePct = null;
    window.globalDistState.typedPostPct = null;
    calculate();
};

window.resetDistPreset = function() {
    resetDistPresetInternal();
    calculate();
};

function resetDistPresetInternal() {
    window.globalDistState = {
        mode: 'auto',
        typedPrePct: null,
        typedPostPct: null
    };
    let preInput = document.getElementById('pre-deliv-inst-pct');
    let postInput = document.getElementById('post-deliv-inst-pct');
    if (preInput) preInput.value = '';
    if (postInput) postInput.value = '';
}

// --- Global Error & Exception Guards ---
if (typeof window !== 'undefined') {
    window.addEventListener('error', function(event) {
        console.error('System Safety Guard intercepted error:', event.error || event.message);
    });
    window.addEventListener('unhandledrejection', function(event) {
        console.error('System Safety Guard intercepted unhandled rejection:', event.reason);
    });
}

// --- Utilities ---
function formatDate(date) {
    if (!date) return '';
    let d = new Date(date);
    if (isNaN(d.getTime())) return '';
    let month = '' + (d.getMonth() + 1), day = '' + d.getDate(), year = d.getFullYear();
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [year, month, day].join('-');
}

function formatDateExport(dateStr) {
    if (!dateStr) return '';
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    let day = d.getDate();
    let monthName = months[d.getMonth()] || '';
    let yearShort = d.getFullYear().toString().substr(-2);
    return `${day}-${monthName}-${yearShort}`;
}

function addMonths(date, months) {
    let d = new Date(date);
    if (isNaN(d.getTime())) d = new Date();
    let originalDay = d.getDate();
    let m = parseInt(months) || 0;
    d.setMonth(d.getMonth() + m);
    if (d.getDate() !== originalDay && d.getDate() < 5) {
        d.setDate(0); 
    }
    return d;
}

function formatCurr(num) {
    if (num === null || num === undefined || isNaN(num)) return '0 EGP';
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EGP' }).format(num);
    } catch(e) {
        return (Math.round(num) || 0) + ' EGP';
    }
}

function formatNum(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    try {
        return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num);
    } catch(e) {
        return (Math.round(num) || 0).toString();
    }
}

function formatPct(num) {
    if (num === null || num === undefined || isNaN(num)) return '0.00%';
    return (num * 100).toFixed(2) + '%';
}

function getRateForYear(y) {
    if (isNaN(y) || y < 0) y = 0;
    if (y > 15) y = 15;
    return (discountRates[y] || 0) / 100;
}

// --- UI Logic ---
function setProject(proj) {
    currentProject = proj;
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        if (b.innerText && b.innerText.includes(proj)) {
            b.classList.add('active');
        }
    });
    if (typeof event !== 'undefined' && event && event.target && event.target.classList) {
        event.target.classList.add('active');
    }
    resetDistPresetInternal();
    renderBaseInputs();
    renderCustomInputs();
    calculate();
}

window.delayedCalculate = function() {
    window.globalTableOverrides = {};
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        calculate();
        if (typeof window.generateSmartOptions === 'function') {
            window.generateSmartOptions();
        }
    }, 300);
}

function applyTargetPrice() {
    window.globalTableOverrides = {};
    calculate();
}

function toggleFixedInst() {
    let chk = document.getElementById('fixed-inst-toggle').checked;
    let wrapper = document.getElementById('fixed-inst-controls-wrapper');
    let badge = document.getElementById('fixed-inst-status-badge');
    let valEl = document.getElementById('fixed-inst-val');
    
    if (wrapper) wrapper.style.display = chk ? 'block' : 'none';
    if (badge) {
        badge.innerText = chk ? 'مفعّل' : 'غير مفعّل';
        badge.style.color = chk ? 'var(--gold)' : 'var(--text-muted)';
    }
    
    if (chk && (!valEl.value || parseFloat(valEl.value) === 0)) {
        if (typeof globalCustomFlows !== 'undefined' && globalCustomFlows) {
            let currentInst = globalCustomFlows.find(f => f.isInst && !f.isMnt);
            if (currentInst) valEl.value = Math.round(currentInst.amount);
        }
    }
    window.globalTableOverrides = {};
    calculate();
}

window.onFixedScopeChange = function() {
    let scope = document.getElementById('fixed-inst-scope') ? document.getElementById('fixed-inst-scope').value : 'all';
    let label = document.getElementById('fixed-inst-val-label');
    if (label) {
        if (scope === 'pre') label.innerText = 'قسط ما قبل الاستلام';
        else if (scope === 'post') label.innerText = 'قسط ما بعد الاستلام';
        else label.innerText = 'قيمة كل قسط';
    }
};

window.applyRecYears = function(y) {
    let yrEl = document.getElementById('duration-years');
    if (yrEl) yrEl.value = y;
    renderCustomInputs();
    calculate();
};

window.applyRecDP = function(amt) {
    let dp1Val = document.getElementById('dp1-val');
    let dp1Type = document.getElementById('dp1-type');
    if (dp1Val && dp1Type) {
        dp1Val.value = amt;
        dp1Type.value = 'amt';
    }
    calculate();
};

window.applyRecDeliv = function(amt) {
    let delivVal = document.getElementById('deliv-val');
    let delivType = document.getElementById('deliv-type');
    if (delivVal && delivType) {
        delivVal.value = amt;
        delivType.value = 'amt';
    }
    calculate();
};

window.applyRecPreOnly = function() {
    let scopeEl = document.getElementById('fixed-inst-scope');
    if (scopeEl) scopeEl.value = 'pre';
    window.onFixedScopeChange();
    calculate();
};

window.applyFixedVal = function(v) {
    let valEl = document.getElementById('fixed-inst-val');
    if (valEl) valEl.value = v;
    calculate();
};

window.onIntraYearToggle = function() {
    let chk = document.getElementById('toggle-intra-year') ? document.getElementById('toggle-intra-year').checked : false;
    let wrapper = document.getElementById('intra-year-controls-wrapper');
    let badge = document.getElementById('intra-year-status-badge');
    let valEl = document.getElementById('intra-year-val');
    
    if (wrapper) wrapper.style.display = chk ? 'block' : 'none';
    if (badge) {
        badge.innerText = chk ? 'مفعّل' : 'غير مفعّل';
        badge.style.color = chk ? 'var(--accent-blue)' : 'var(--text-muted)';
    }
    
    if (chk && valEl && (!valEl.value || parseFloat(valEl.value) === 0)) {
        let type = document.getElementById('intra-year-type')?.value || 'amt';
        valEl.value = (type === 'pct') ? '70' : '200000';
    }
    window.globalTableOverrides = {};
    calculate();
};

window.onIntraYearTypeChange = function() {
    let type = document.getElementById('intra-year-type')?.value || 'amt';
    let valEl = document.getElementById('intra-year-val');
    let freqMonths = parseInt(document.getElementById('payment-frequency')?.value) === 2 ? 6 : 3;
    let label = document.getElementById('intra-year-val-label');
    
    if (label) {
        label.innerText = freqMonths === 3 ? 'قسط أول 3 فترات ربع سنوية' : 'قسط الفترة النصف سنوية الأولى';
    }
    
    if (valEl) {
        if (type === 'pct') {
            valEl.placeholder = 'مثال: 70%';
            if (parseFloat(valEl.value) > 100) valEl.value = '70';
        } else {
            valEl.placeholder = 'مثال: 200000';
            if (parseFloat(valEl.value) <= 100) valEl.value = '200000';
        }
    }
    calculate();
};

window.applyIntraPreset = function(preset) {
    let toggle = document.getElementById('toggle-intra-year');
    if (toggle) toggle.checked = true;
    let wrapper = document.getElementById('intra-year-controls-wrapper');
    if (wrapper) wrapper.style.display = 'block';
    let badge = document.getElementById('intra-year-status-badge');
    if (badge) {
        badge.innerText = 'مفعّل';
        badge.style.color = 'var(--accent-blue)';
    }
    
    let typeEl = document.getElementById('intra-year-type');
    let valEl = document.getElementById('intra-year-val');
    let scopeEl = document.getElementById('intra-year-scope');
    
    if (preset === '70_30') {
        if (typeEl) typeEl.value = 'pct';
        if (valEl) valEl.value = '70';
    } else if (preset === 'amt_200k') {
        if (typeEl) typeEl.value = 'amt';
        if (valEl) valEl.value = '200000';
    } else if (preset === 'amt_100k') {
        if (typeEl) typeEl.value = 'amt';
        if (valEl) valEl.value = '100000';
    }
    
    if (scopeEl) scopeEl.value = 'all';
    window.globalTableOverrides = {};
    calculate();
};

function renderIntraGuidanceBox(g) {
    let box = document.getElementById('intra-year-guidance-box');
    let badge = document.getElementById('intra-year-status-badge');
    if (!box) return;
    
    let isToggled = document.getElementById('toggle-intra-year') && document.getElementById('toggle-intra-year').checked;
    
    if (!g || !g.active || !isToggled) {
        box.style.display = 'none';
        if (badge && !isToggled) {
            badge.innerText = 'غير مفعّل';
            badge.style.color = 'var(--text-muted)';
        }
        return;
    }
    
    if (badge) {
        badge.innerText = 'مفعّل';
        badge.style.color = 'var(--accent-blue)';
    }
    
    box.style.display = 'block';
    
    let isQuarterly = (g.freqMonths === 3);
    let regLabel = isQuarterly ? 'أول 3 أقساط ربع سنوية (Q1, Q2, Q3)' : 'القسط النصف سنوي الأول (H1)';
    let bumpLabel = isQuarterly ? 'قسط نهاية السنة (Q4 المحمّل)' : 'قسط نهاية السنة (H2 المحمّل)';
    
    let html = '';
    if (g.warning) {
        html += `<div style="color: #e74c3c; font-weight: bold; margin-bottom: 6px;">⚠️ ${g.warning}</div>`;
    }
    
    html += `
        <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="color: var(--text); font-weight: 600;">
                💡 <strong>تفاصيل توزيع أقساط السنة:</strong>
            </div>
            <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 4px;">
                <span style="color: var(--accent-blue);">• ${regLabel}: <strong>${formatCurr(g.regularAmt)}</strong></span>
                <span style="color: var(--gold);">• ${bumpLabel}: <strong>${formatCurr(g.bumpAmt)}</strong></span>
                <span style="color: var(--text-muted);">• إجمالي أقساط السنة: <strong>${formatCurr(g.yearTotal)}</strong></span>
            </div>
        </div>
    `;
    box.innerHTML = html;
}

function resetCustomInputs() {
    document.getElementById('duration-years').value = 8;
    document.getElementById('payment-frequency').value = 4;
    
    let fixToggle = document.getElementById('fixed-inst-toggle');
    if (fixToggle) fixToggle.checked = false;
    let fixVal = document.getElementById('fixed-inst-val');
    if (fixVal) fixVal.value = '';
    let fixScope = document.getElementById('fixed-inst-scope');
    if (fixScope) fixScope.value = 'all';
    let fixType = document.getElementById('fixed-inst-type');
    if (fixType) fixType.value = 'amt';
    
    let wrapper = document.getElementById('fixed-inst-controls-wrapper');
    if (wrapper) wrapper.style.display = 'none';
    let badge = document.getElementById('fixed-inst-status-badge');
    if (badge) {
        badge.innerText = 'غير مفعّل';
        badge.style.color = 'var(--text-muted)';
    }
    let counterpartEl = document.getElementById('fixed-inst-counterpart-info');
    if (counterpartEl) counterpartEl.style.display = 'none';
    let guidanceBox = document.getElementById('fixed-inst-guidance-box');
    if (guidanceBox) guidanceBox.style.display = 'none';
    
    let instOverride = document.getElementById('custom-inst-count');
    if (instOverride) instOverride.value = '';
    
    document.querySelectorAll('#custom-inputs input[type="number"]').forEach(el => el.value = '');
    document.querySelectorAll('#custom-inputs select').forEach(el => el.value = 'pct');
    
    resetDistPresetInternal();
    calculate();
}

function createInputGroup(id, label) {
    return `
    <div class="input-group">
        <label>${label}</label>
        <div style="display:flex; gap:5px;">
            <input type="number" id="${id}-val" oninput="delayedCalculate()" placeholder="Value">
            <select id="${id}-type" onchange="delayedCalculate()">
                <option value="pct">%</option>
                <option value="amt">EGP</option>
            </select>
        </div>
    </div>`;
}

function renderBaseInputs() {
    let html = '';
    html += `<div class="input-group">
        <label>Base Years</label>
        <input type="number" id="base-duration-years" value="8" min="1" max="15" oninput="delayedCalculate()">
    </div>`;
    html += `<div class="input-group">
        <label>Base Freq</label>
        <select id="base-payment-frequency" onchange="delayedCalculate()">
            <option value="4">Quarterly</option>
            <option value="2">Semi-Annual</option>
        </select>
    </div>`;
    html += `<div class="input-group">
        <label>Installments (Override)</label>
        <input type="number" id="base-inst-count" placeholder="Auto" oninput="delayedCalculate()">
    </div>`;
    
    let createBaseInput = (id, label, val) => `
        <div class="input-group">
            <label>${label}</label>
            <div style="display:flex; gap:5px;">
                <input type="number" id="base-${id}" value="${val}" oninput="delayedCalculate()" placeholder="%">
                <select id="base-${id}-type" disabled style="background:#eee;"><option value="pct">%</option></select>
            </div>
        </div>`;
        
    html += createBaseInput('dp1', 'Base DP 1', currentProject==='Zomra'?2.5:5);
    html += createBaseInput('dp2', 'Base DP 2', currentProject==='Zomra'?2.5:5);
    if(currentProject === 'Zomra') {
        html += createBaseInput('addl', 'Base 6-Months', 5);
        html += createBaseInput('deliv', 'Base Delivery', 5);
    }
    
    document.getElementById('base-inputs').innerHTML = html;
}

function renderCustomInputs() {
    let html = '';
    html += createInputGroup('dp1', 'Down Payment 1');
    html += createInputGroup('dp2', 'Down Payment 2');
    
    if (currentProject === 'Zomra') {
        html += createInputGroup('addl', '6-Months Payment');
        html += createInputGroup('deliv', 'Delivery Payment');
    }
    document.getElementById('custom-inputs').innerHTML = html;
}

// --- Engine ---
function getPeriod(months) {
    return Math.floor(months / 3);
}

function applyDiscountLogic(f, contractDateStr) {
    if (!contractDateStr) {
        let dateEl = document.getElementById('contract-date');
        contractDateStr = dateEl ? dateEl.value : '';
    }
    if (!contractDateStr || isNaN(new Date(contractDateStr).getTime())) {
        contractDateStr = formatDate(new Date());
    }
    
    let pDate = new Date(f.date);
    if (isNaN(pDate.getTime())) {
        pDate = new Date(contractDateStr);
        f.date = contractDateStr;
    }
    let cDate = new Date(contractDateStr);
    
    let months = (pDate.getFullYear() - cDate.getFullYear()) * 12 + pDate.getMonth() - cDate.getMonth();
    if (pDate.getDate() < cDate.getDate() && pDate.getDate() < 28) {
        months--;
    }
    months = Math.max(0, months);
    
    let ratesMap = {
        0: 0.18, 1: 0.15, 2: 0.13, 3: 0.10, 4: 0.10, 5: 0.09, 6: 0.09, 7: 0.09, 8: 0.09, 9: 0.09, 10: 0.09
    };
    let flexibleToggle = document.getElementById('flexible-toggle');
    let isFlexible = flexibleToggle ? (flexibleToggle.value === 'yes') : false;
    
    if (currentProject === 'Zomra') {
        if (f.isMnt) {
            f.rate = 0;
            f.period = 0;
            f.pvFactor = 1;
            f.pv = f.amount || 0;
            return;
        }
        let yearIndex = Math.floor(months / 12);
        let rate = ratesMap[yearIndex] !== undefined ? ratesMap[yearIndex] : 0.09;
        
        // Zomra October 2026 Update: Payments in 2026 for normal mode get 19%
        if (!isFlexible && yearIndex === 0 && pDate.getFullYear() === 2026) {
            rate = 0.19;
        }
        
        if (isFlexible) {
            let baseDate = new Date('2025-12-29');
            let diffFromBase = Math.max(0, Math.round((pDate - baseDate) / (1000 * 60 * 60 * 24)));
            let r;
            if (diffFromBase < 54) r = 0.19;
            else if (diffFromBase < 419) r = 0.18;
            else if (diffFromBase < 784) r = 0.15;
            else if (diffFromBase < 1149) r = 0.13;
            else if (diffFromBase < 1514) r = 0.10;
            else if (diffFromBase < 1879) r = 0.10;
            else r = 0.09;
            f.rate = r;
            f.pvFactor = 1 / Math.pow(1 + r / 365, diffFromBase);
            f.pv = (f.amount || 0) * f.pvFactor;
        } else {
            if (f.id === 'dp1' || f.id === 'dp2') {
                f.rate = 0;
                f.period = 0;
                f.pvFactor = 1;
                f.pv = f.amount || 0;
            } else if (f.id === 'addl') {
                f.rate = rate;
                f.period = 2;
                f.pvFactor = 1 / Math.pow(1 + rate / 4, 2);
                f.pv = (f.amount || 0) * f.pvFactor;
            } else {
                let pmt = Math.max(0, Math.round(months / 3));
                f.rate = rate;
                f.period = pmt;
                f.pvFactor = 1 / Math.pow(1 + rate / 4, pmt);
                f.pv = (f.amount || 0) * f.pvFactor;
            }
        }
    } else if (currentProject === 'Perla') {
        if (f.id === 'dp1' || f.isMnt) {
            f.rate = 0;
            f.period = 0;
            f.pvFactor = 1;
            f.pv = f.amount || 0;
        } else {
            let pmt = Math.max(0, Math.round(months / 3));
            f.period = pmt;
            
            if (pmt === 1) {
                f.rate = 0.19; // DP2 in Excel gets 19%
            } else {
                let yearIndex = Math.max(0, Math.floor((pmt - 2) / 4));
                f.rate = ratesMap[yearIndex] !== undefined ? ratesMap[yearIndex] : 0.09;
            }
            
            if (isFlexible) {
                let diffDays = Math.max(0, Math.round((pDate - cDate) / (1000 * 60 * 60 * 24)));
                let r;
                if (diffDays < 54) r = 0.19;
                else if (diffDays < 419) r = 0.18;
                else if (diffDays < 784) r = 0.15;
                else if (diffDays < 1149) r = 0.13;
                else if (diffDays < 1514) r = 0.10;
                else if (diffDays < 1879) r = 0.10;
                else r = 0.09;
                f.pvFactor = 1 / Math.pow(1 + r / 365, diffDays);
            } else {
                f.pvFactor = 1 / Math.pow(1 + f.rate / 4, f.period);
            }
            f.pv = (f.amount || 0) * f.pvFactor;
        }
    } else {
        f.period = getPeriod(f.months);
        f.rate = getRateForPeriod(f.period, f.isDP && f.months === 0);
        f.pvFactor = 1 / Math.pow(1 + f.rate / 4, f.period);
        f.pv = (f.amount || 0) * f.pvFactor;
    }
    
    // Final guard against any NaN or infinity
    if (isNaN(f.pv) || !isFinite(f.pv)) f.pv = f.amount || 0;
    if (isNaN(f.pvFactor) || !isFinite(f.pvFactor)) f.pvFactor = 1;
}

function getRateForPeriod(period, isDP) {
    if (isDP) return getRateForYear(0); 
    let year = Math.floor(period / 4) + 1;
    return getRateForYear(year);
}

function generateFlowsTemplate(contractDateStr, years, freqMonths, isBase = false, customFirstDateStrParam = null) {
    let flows = [];
    years = Math.max(1, Math.min(20, parseInt(years) || 8));
    freqMonths = (parseInt(freqMonths) === 6 || parseInt(freqMonths) === 3) ? parseInt(freqMonths) : 3;
    let totalMonths = years * 12;
    
    // Check for overridden installment count
    let overrideEl = document.getElementById(isBase ? 'base-inst-count' : 'custom-inst-count');
    let overrideInstCount = (overrideEl && overrideEl.value) ? parseInt(overrideEl.value) : null;
    if (isNaN(overrideInstCount) || overrideInstCount <= 0 || overrideInstCount > 120) overrideInstCount = null;
    
    // Check for overridden percentages (if empty, fallback to defaults)
    let getOverridePct = (id, def) => {
        let el = document.getElementById(isBase ? 'base-'+id : id+'-val');
        if (el && el.value) {
            let typeEl = document.getElementById(isBase ? 'base-'+id+'-type' : id+'-type');
            if (!typeEl || typeEl.value === 'pct') {
                let v = parseFloat(el.value);
                return (!isNaN(v) && v >= 0) ? (v / 100) : def;
            }
        }
        return def;
    };
    
    let customFirstDateStr = customFirstDateStrParam;
    if (!isBase && !customFirstDateStr) {
        let el = document.getElementById('first-inst-date');
        if (el && el.value && !isNaN(new Date(el.value).getTime())) {
            customFirstDateStr = el.value;
        }
    }
    if (!contractDateStr || isNaN(new Date(contractDateStr).getTime())) {
        contractDateStr = formatDate(new Date());
    }
    let cDate = new Date(contractDateStr);

    if (currentProject === 'Zomra') {
        flows.push({ id: 'dp1', label: 'Down Payment', date: contractDateStr, months: 0, isDP: true, defaultPct: getOverridePct('dp1', 0.025) });
        
        let dp2Date = formatDate(addMonths(contractDateStr, 1));
        flows.push({ id: 'dp2', label: '2nd Payment', date: dp2Date, months: 1, isDP: true, defaultPct: getOverridePct('dp2', 0.025) });
        
        let addlDate = formatDate(addMonths(contractDateStr, 6));
        flows.push({ id: 'addl', label: '6-Months Payment', date: addlDate, months: 6, isDP: true, defaultPct: getOverridePct('addl', 0.05) });
        
        let delivDate = formatDate(addMonths(contractDateStr, 37));
        flows.push({ id: 'deliv', label: 'Delivery Payment', date: delivDate, months: 37, isDP: true, defaultPct: getOverridePct('deliv', 0.05) });
        
        let mnt1Date = formatDate(addMonths(contractDateStr, 25));
        flows.push({ id: 'mnt1', label: 'Maintenance 1', date: mnt1Date, months: 25, isMnt: true });
        flows.push({ id: 'mnt2', label: 'Maintenance 2', date: delivDate, months: 37, isMnt: true });
        
        let numInst = overrideInstCount !== null ? overrideInstCount : (years * (12 / freqMonths));
        
        let startMonth = 1 + freqMonths;
        let firstDate = customFirstDateStr ? new Date(customFirstDateStr) : null;
        let diffMonths = firstDate ? Math.round((firstDate - cDate) / (1000 * 60 * 60 * 24 * 30.44)) : startMonth;
        if (diffMonths < 0) diffMonths = startMonth;
        
        for (let i = 0; i < numInst; i++) {
            let m = diffMonths + i * freqMonths;
            let dStr = customFirstDateStr ? formatDate(addMonths(customFirstDateStr, i * freqMonths)) : formatDate(addMonths(contractDateStr, m));
            flows.push({ id: 'inst_' + i, label: 'Installment ' + (i+1), date: dStr, months: m, isInst: true });
        }
        
    } else { // Perla
        flows.push({ id: 'dp1', label: 'Down Payment', date: contractDateStr, months: 0, isDP: true, defaultPct: getOverridePct('dp1', 0.05) });
        
        let dp2Date = formatDate(addMonths(contractDateStr, 3));
        flows.push({ id: 'dp2', label: '2nd Payment', date: dp2Date, months: 3, isDP: true, defaultPct: getOverridePct('dp2', 0.05) });
        
        let delivDate = formatDate(addMonths(contractDateStr, 48));
        
        let mnt1Date = formatDate(addMonths(contractDateStr, 36));
        flows.push({ id: 'mnt1', label: 'Maintenance 1', date: mnt1Date, months: 36, isMnt: true });
        flows.push({ id: 'mnt2', label: 'Maintenance 2', date: delivDate, months: 48, isMnt: true });
        
        let numInst = overrideInstCount !== null ? overrideInstCount : null;
        
        let startMonth = 3 + freqMonths;
        let firstDate = customFirstDateStr ? new Date(customFirstDateStr) : null;
        let diffMonths = firstDate ? Math.round((firstDate - cDate) / (1000 * 60 * 60 * 24 * 30.44)) : startMonth;
        if (diffMonths < 0) diffMonths = startMonth;
        
        let curMonth = diffMonths;
        let instList = [];
        
        if (numInst !== null) {
            for (let i=0; i<numInst; i++) {
                instList.push(curMonth);
                curMonth += freqMonths;
            }
        } else {
            let loopSafety = 0;
            while (curMonth <= totalMonths && loopSafety++ < 200) { 
                instList.push(curMonth); 
                curMonth += freqMonths; 
            }
            if (freqMonths === 6 && !customFirstDateStr && instList.length > 0 && instList[instList.length-1] > totalMonths - 3) instList.pop(); 
        }
        
        instList.forEach((m, i) => {
            let dStr = customFirstDateStr ? formatDate(addMonths(customFirstDateStr, i * freqMonths)) : formatDate(addMonths(contractDateStr, m));
            flows.push({ id: 'inst_' + i, label: 'Installment ' + (i+1), date: dStr, months: m, isInst: true });
        });
    }
    
    let mergedFlows = [];
    let shouldMerge = document.getElementById('merge-delivery-toggle') ? document.getElementById('merge-delivery-toggle').checked : true;
    
    flows.forEach(f => {
        let existing = shouldMerge ? mergedFlows.find(mf => mf.date === f.date && !mf.isMnt && !f.isMnt) : null;
        if (existing) {
            existing.label += ' + ' + f.label;
            existing.isMerged = true;
            existing.mergedIds = existing.mergedIds || [existing.id];
            existing.mergedIds.push(f.id);
            if (f.defaultPct) existing.defaultPct = (existing.defaultPct || 0) + f.defaultPct;
        } else {
            mergedFlows.push(f);
        }
    });
    
    mergedFlows.sort((a,b) => {
        if (a.isMnt && !b.isMnt) return 1;
        if (!a.isMnt && b.isMnt) return -1;
        return a.months - b.months;
    });
    
    return mergedFlows;
}

function calculateBaseFlows(price, template) {
    let flows = JSON.parse(JSON.stringify(template));
    
    // The NPV engine operates on 100% of the unit price (ignoring maintenance)
    let remaining = price; 
    let instCount = 0;
    
    flows.forEach(f => {
        if (f.isMnt) {
            f.amount = basePriceCache * 0.04;
        } else if (f.isDP || f.isMerged) {
            f.amount = price * (f.defaultPct || 0);
            remaining -= f.amount;
        }
        if (f.isInst || f.isMerged) instCount++;
    });
    
    let instAmt = instCount > 0 ? remaining / instCount : 0;
    flows.forEach(f => {
        if (f.isInst || f.isMerged) f.amount = (f.amount || 0) + instAmt;
        
        applyDiscountLogic(f);
    });
    
    return flows;
}

function getCustomInputAmt(id, price) {
    let valEl = document.getElementById(id + '-val');
    let typeEl = document.getElementById(id + '-type');
    if (!valEl || valEl.value.trim() === '') return null;
    let v = parseFloat(valEl.value);
    if (isNaN(v) || v < 0) return null;
    if (typeEl && typeEl.value === 'pct') return price * (v / 100);
    return v;
}

function solveForPrice(basePv, template) {
    if (!template || template.length === 0 || basePriceCache <= 0 || !basePv || isNaN(basePv) || basePv <= 0) {
        return basePriceCache || 0;
    }
    let low = 0, high = basePriceCache * 10, bestPrice = basePriceCache;
    
    for (let i = 0; i < 50; i++) {
        let mid = (low + high) / 2;
        let testPv = 0;
        
        let tempFlows = calculateCustomFlows(mid, template);
        tempFlows.forEach(f => {
            if (!f.isMnt) testPv += (f.pv || 0);
        });
        
        if (testPv > basePv) high = mid; else low = mid;
        bestPrice = mid;
    }
    
    return bestPrice;
}

window.onTargetPriceChange = function() {
    let priceEl = document.getElementById('target-price-val');
    let pctEl = document.getElementById('target-pct-val');
    if (!priceEl || !pctEl) return;
    let priceStr = priceEl.value;
    let basePriceInput = document.getElementById('base-price');
    let basePrice = parseFloat(basePriceInput ? basePriceInput.value : 0) || 0;
    
    if (priceStr.trim() === '') {
        pctEl.value = '';
    } else {
        let price = parseFloat(priceStr);
        if (!isNaN(price) && basePrice > 0) {
            let pct = ((price - basePrice) / basePrice) * 100;
            pctEl.value = pct.toFixed(2);
        } else {
            pctEl.value = '';
        }
    }
};

window.onTargetPctChange = function() {
    let pctEl = document.getElementById('target-pct-val');
    let priceEl = document.getElementById('target-price-val');
    if (!pctEl || !priceEl) return;
    let pctStr = pctEl.value;
    let basePriceInput = document.getElementById('base-price');
    let basePrice = parseFloat(basePriceInput ? basePriceInput.value : 0) || 0;
    
    if (pctStr.trim() === '') {
        priceEl.value = '';
    } else {
        let pct = parseFloat(pctStr);
        if (!isNaN(pct) && basePrice > 0) {
            let price = basePrice * (1 + pct / 100);
            priceEl.value = Math.round(price);
        } else {
            priceEl.value = '';
        }
    }
};

function calculateCustomFlows(price, template, options = {}) {
    let dp1 = getCustomInputAmt('dp1', price);
    let dp2 = getCustomInputAmt('dp2', price);
    let addl = getCustomInputAmt('addl', price);
    let deliv = getCustomInputAmt('deliv', price);
    
    let flows = JSON.parse(JSON.stringify(template));
    let remAmt = price;
    
    let overrides = window.globalTableOverrides || {};
    
    flows.forEach(f => {
        if (f.isMnt) {
            f.amount = basePriceCache * 0.04;
        } else {
            // Apply Date Overrides first
            if (overrides[f.id] && overrides[f.id].date) {
                f.date = overrides[f.id].date;
                let d1 = new Date(document.getElementById('contract-date').value);
                let d2 = new Date(f.date);
                f.months = Math.round((d2 - d1) / (1000 * 60 * 60 * 24 * 30.416));
            }
            // Priority 1: Table overrides
            if (overrides[f.id] && overrides[f.id].amount !== undefined) {
                let ov = overrides[f.id];
                f.amount = ov.isPct ? price * (ov.amount / 100) : ov.amount;
                f.isFixedOverride = true;
            } 
            // Priority 2: Input fields for DP/Addl/Deliv
            else if (f.id === 'dp1') f.amount = dp1 !== null ? dp1 : price * (f.defaultPct||0);
            else if (f.id === 'dp2') f.amount = dp2 !== null ? dp2 : price * (f.defaultPct||0);
            else if (f.id === 'addl') f.amount = addl !== null ? addl : price * (f.defaultPct||0);
            else if (f.id === 'deliv') f.amount = deliv !== null ? deliv : price * (f.defaultPct||0);
            else if (f.isMerged) {
                let m_amt = 0;
                if (f.mergedIds.includes('deliv')) m_amt += deliv !== null ? deliv : price * 0.05;
                f.amount = m_amt; 
                f._mergedDelivAmt = m_amt;
            }
            
            if (f.isMerged && f.amount !== undefined) {
                f._mergedDelivAmt = f.amount;
            }
            
            if (f.amount !== undefined) {
                if (f.isMerged) remAmt -= f.amount;
                if (f.id === 'deliv' && !f.isMerged) remAmt -= f.amount;
                if (!f.isInst && f.id !== 'deliv' && !f.isMerged) remAmt -= f.amount;
                if (f.isInst && !f.isMerged && f.isFixedOverride) remAmt -= f.amount;
            }
        }
    });
    
    let dynamicInsts = flows.filter(f => (f.isInst || f.isMerged) && !f.isFixedOverride);
    
    let isFixedInst = document.getElementById('fixed-inst-toggle') && document.getElementById('fixed-inst-toggle').checked;
    let fixedInstScope = document.getElementById('fixed-inst-scope') ? document.getElementById('fixed-inst-scope').value : 'all';
    let fixedInstVal = document.getElementById('fixed-inst-val') ? parseFloat(document.getElementById('fixed-inst-val').value) : 0;
    let fixedInstType = document.getElementById('fixed-inst-type') ? document.getElementById('fixed-inst-type').value : 'amt';
    let hasFixedInst = isFixedInst && fixedInstVal > 0;
    
    let delivMonth = currentProject === 'Zomra' ? 37 : 48;
    let preInsts = dynamicInsts.filter(f => f.months <= delivMonth);
    let postInsts = dynamicInsts.filter(f => f.months > delivMonth);
    let nPre = preInsts.length;
    let nPost = postInsts.length;
    let nTotal = nPre + nPost;
    
    let remPct = price > 0 ? (remAmt / price) * 100 : 0;
    let standardMilestonesPct = (currentProject === 'Zomra') ? 15.0 : 10.0;
    let standardBaselinePool = 100.0 - standardMilestonesPct;
    let basePrePct = nTotal > 0 ? standardBaselinePool * (nPre / nTotal) : 0;
    let basePostPct = nTotal > 0 ? standardBaselinePool * (nPost / nTotal) : 0;
    
    let distMode = window.globalDistState ? window.globalDistState.mode : 'auto';
    let typedPre = window.globalDistState ? window.globalDistState.typedPrePct : null;
    let typedPost = window.globalDistState ? window.globalDistState.typedPostPct : null;
    
    let fixedAmt = 0;
    if (hasFixedInst) {
        fixedAmt = fixedInstType === 'pct' ? price * (fixedInstVal / 100) : fixedInstVal;
    }
    
    let actualPrePct = 0;
    let actualPostPct = 0;
    let instAmtPre = 0;
    let instAmtPost = 0;

    if (hasFixedInst) {
        if (fixedInstScope === 'pre') {
            instAmtPre = fixedAmt;
            let totalPreAmt = nPre * instAmtPre;
            let remPost = remAmt - totalPreAmt;
            instAmtPost = nPost > 0 ? (remPost / nPost) : 0;
            actualPrePct = price > 0 ? (totalPreAmt / price) * 100 : 0;
            actualPostPct = price > 0 ? ((nPost * instAmtPost) / price) * 100 : 0;
            distMode = 'custom';
        } else if (fixedInstScope === 'post') {
            instAmtPost = fixedAmt;
            let totalPostAmt = nPost * instAmtPost;
            let remPre = remAmt - totalPostAmt;
            instAmtPre = nPre > 0 ? (remPre / nPre) : 0;
            actualPostPct = price > 0 ? (totalPostAmt / price) * 100 : 0;
            actualPrePct = price > 0 ? ((nPre * instAmtPre) / price) * 100 : 0;
            distMode = 'custom';
        } else {
            // Scope === 'all'
            instAmtPre = fixedAmt;
            instAmtPost = fixedAmt;
            actualPrePct = price > 0 ? ((nPre * fixedAmt) / price) * 100 : 0;
            actualPostPct = price > 0 ? ((nPost * fixedAmt) / price) * 100 : 0;
            distMode = 'equal';
        }
    } else {
        // Normal distribution (auto / front / back / equal / custom typed percentages)
        if (nTotal === 0) {
            actualPrePct = 0;
            actualPostPct = 0;
        } else if (nPost === 0) {
            actualPrePct = remPct;
            actualPostPct = 0;
        } else if (nPre === 0) {
            actualPrePct = 0;
            actualPostPct = remPct;
        } else if (distMode === 'custom' && typedPre !== null && !isNaN(typedPre)) {
            actualPrePct = Math.max(0, Math.min(remPct, typedPre));
            actualPostPct = remPct - actualPrePct;
        } else if (distMode === 'custom' && typedPost !== null && !isNaN(typedPost)) {
            actualPostPct = Math.max(0, Math.min(remPct, typedPost));
            actualPrePct = remPct - actualPostPct;
        } else if (distMode === 'equal') {
            actualPrePct = remPct * (nPre / nTotal);
            actualPostPct = remPct * (nPost / nTotal);
        } else if (distMode === 'back') {
            actualPrePct = Math.min(remPct, basePrePct);
            actualPostPct = remPct - actualPrePct;
        } else {
            // 'auto' or 'front':
            if (remPct >= basePostPct) {
                actualPostPct = basePostPct;
                actualPrePct = remPct - actualPostPct;
            } else {
                actualPrePct = remPct * (nPre / nTotal);
                actualPostPct = remPct - actualPostPct;
            }
        }
        
        let prePoolAmt = price * (actualPrePct / 100);
        let postPoolAmt = price * (actualPostPct / 100);
        instAmtPre = nPre > 0 ? prePoolAmt / nPre : 0;
        instAmtPost = nPost > 0 ? postPoolAmt / nPost : 0;
    }
    
    flows._distInfo = {
        remPct: remPct,
        actualPrePct: actualPrePct,
        actualPostPct: actualPostPct,
        mode: distMode,
        nPre: nPre,
        nPost: nPost
    };
    
    flows._fixedGuidance = {
        isFixedInst: isFixedInst,
        hasFixedInst: hasFixedInst,
        scope: fixedInstScope,
        val: fixedInstVal,
        type: fixedInstType,
        fixedAmt: fixedAmt,
        instAmtPre: instAmtPre,
        instAmtPost: instAmtPost,
        nPre: nPre,
        nPost: nPost,
        nTotal: nTotal,
        remAmt: remAmt,
        price: price,
        actualPrePct: actualPrePct,
        actualPostPct: actualPostPct
    };
    
    let instIndex = 0;
    let freqMonths = parseInt(document.getElementById('payment-frequency')?.value) === 2 ? 6 : 3;
    let instsPerYear = 12 / freqMonths;
    
    // Intra-Year Shift / Balloon logic (Supports custom amount, percentage, and legacy 70/30)
    let isIntraToggle = document.getElementById('toggle-intra-year') && document.getElementById('toggle-intra-year').checked;
    let isLegacy7030 = document.getElementById('toggle-70-30') && document.getElementById('toggle-70-30').checked;
    let isIntraYearActive = isIntraToggle || isLegacy7030;
    
    let intraScope = document.getElementById('intra-year-scope')?.value || 'all';
    let intraType = document.getElementById('intra-year-type')?.value || 'amt';
    let intraValRaw = document.getElementById('intra-year-val') ? parseFloat(document.getElementById('intra-year-val').value) : NaN;
    
    if (isLegacy7030 && (!isIntraToggle || isNaN(intraValRaw) || intraValRaw <= 0)) {
        intraType = 'pct';
        intraValRaw = 70;
        intraScope = 'all';
    }
    
    let hasIntraYearShift = isIntraYearActive && !isNaN(intraValRaw) && intraValRaw > 0;
    
    let accumulatedWithheld = 0;
    let intraGuidanceInfo = {
        active: hasIntraYearShift,
        scope: intraScope,
        type: intraType,
        val: intraValRaw,
        freqMonths: freqMonths,
        instsPerYear: instsPerYear,
        regularAmt: 0,
        bumpAmt: 0,
        yearTotal: 0,
        warning: null
    };

    flows.forEach(f => {
        if ((f.isInst || f.isMerged) && !f.isFixedOverride) {
            let baseInstAmt = (f.months <= delivMonth) ? instAmtPre : instAmtPost;
            let currentInstAmt = baseInstAmt;
            
            let applyShift = hasIntraYearShift;
            if (intraScope === 'pre' && f.months > delivMonth) applyShift = false;
            if (intraScope === 'post' && f.months <= delivMonth) applyShift = false;
            
            if (applyShift) {
                let isBumpInst = false;
                if (currentProject === 'Perla') {
                    isBumpInst = (f.months % 12 === 0 && f.months > 0);
                } else {
                    isBumpInst = (instIndex % instsPerYear === instsPerYear - 1);
                }
                
                let isLastInst = (instIndex === dynamicInsts.length - 1);
                
                let cycleTotal = baseInstAmt * instsPerYear;
                let regularInstCount = instsPerYear - 1;
                let maxSafeLight = regularInstCount > 0 ? (cycleTotal / regularInstCount) * 0.99 : cycleTotal;
                
                let lightAmt = 0;
                if (intraType === 'pct') {
                    lightAmt = baseInstAmt * (intraValRaw / 100);
                } else {
                    lightAmt = intraValRaw;
                    if (regularInstCount > 0 && lightAmt >= cycleTotal / regularInstCount) {
                        intraGuidanceInfo.warning = `القسط المدخل (${Math.round(lightAmt).toLocaleString()} ج.م) أكبر من المتاح لكل فترة (${Math.round(cycleTotal/regularInstCount).toLocaleString()} ج.م)`;
                        lightAmt = maxSafeLight;
                    }
                }
                
                if (isBumpInst || isLastInst) {
                    currentInstAmt = baseInstAmt + accumulatedWithheld;
                    accumulatedWithheld = 0;
                    if (intraGuidanceInfo.bumpAmt === 0) {
                        intraGuidanceInfo.bumpAmt = currentInstAmt;
                        intraGuidanceInfo.yearTotal = cycleTotal;
                    }
                } else {
                    currentInstAmt = lightAmt;
                    let withheld = baseInstAmt - lightAmt;
                    accumulatedWithheld += withheld;
                    if (intraGuidanceInfo.regularAmt === 0) {
                        intraGuidanceInfo.regularAmt = lightAmt;
                    }
                }
            }
            
            f.amount = (f._mergedDelivAmt || 0) + currentInstAmt;
            instIndex++;
        } else if ((f.isInst || f.isMerged) && f.isFixedOverride) {
            instIndex++;
        }
        
        delete f._mergedDelivAmt;
        applyDiscountLogic(f);
    });
    
    flows._intraGuidance = intraGuidanceInfo;
    return flows;
}

function applyPerfectPercentages(flows, totalAmt) {
    if (!flows || !Array.isArray(flows)) return [];
    let validTotal = (totalAmt > 0 && !isNaN(totalAmt)) ? totalAmt : 0;
    flows.forEach(f => {
        if (!f.isMnt) {
            f.exactPct = validTotal > 0 ? ((f.amount || 0) / validTotal) : 0;
            let pct = f.exactPct * 100;
            f.displayPct = parseFloat(pct.toFixed(7)).toString();
        } else {
            f.exactPct = 0.04;
            f.displayPct = '4';
        }
    });
    return flows;
}

function updatePreDeliveryTracker(flows, elementId) {
    if (!flows || !Array.isArray(flows)) return;
    let delivMonth = currentProject === 'Zomra' ? 37 : 48; // Zomra delivery is month 37
    let pct = 0;
    flows.forEach(f => {
        if (!f.isMnt && f.months <= delivMonth) {
            pct += parseFloat(f.displayPct) || 0;
        }
    });
    
    let el = document.getElementById(elementId);
    if (el) el.innerText = pct.toFixed(2) + '%';
}

function updateDistUI(distInfo) {
    if (!distInfo) return;
    let remPct = distInfo.remPct || 0;
    let actualPrePct = distInfo.actualPrePct || 0;
    let actualPostPct = distInfo.actualPostPct || 0;
    let mode = window.globalDistState ? window.globalDistState.mode : 'auto';

    let poolBadge = document.getElementById('inst-pool-badge');
    if (poolBadge) {
        poolBadge.innerText = `المتاح للأقساط: ${remPct.toFixed(2)}%`;
    }

    let preInput = document.getElementById('pre-deliv-inst-pct');
    let postInput = document.getElementById('post-deliv-inst-pct');
    let indicator = document.getElementById('dist-mode-indicator');

    let isFixedInst = document.getElementById('fixed-inst-toggle') && document.getElementById('fixed-inst-toggle').checked;
    let fixedInstScope = document.getElementById('fixed-inst-scope') ? document.getElementById('fixed-inst-scope').value : 'all';
    let fixedInstVal = document.getElementById('fixed-inst-val') ? parseFloat(document.getElementById('fixed-inst-val').value) : 0;
    let hasFixedInst = isFixedInst && fixedInstVal > 0;

    if (preInput && postInput) {
        preInput.placeholder = actualPrePct.toFixed(2) + '%';
        postInput.placeholder = actualPostPct.toFixed(2) + '%';

        if (document.activeElement === preInput) {
            postInput.value = actualPostPct.toFixed(2);
        } else if (document.activeElement === postInput) {
            preInput.value = actualPrePct.toFixed(2);
        } else {
            preInput.value = actualPrePct.toFixed(2);
            postInput.value = actualPostPct.toFixed(2);
        }
    }

    if (indicator) {
        if (hasFixedInst) {
            if (fixedInstScope === 'pre') {
                indicator.innerText = `الوضع: تثبيت قسط قبل الاستلام عند ${formatNum(fixedInstVal)} ج.م (بعد الاستلام محسوب بالتساوي)`;
                indicator.style.color = 'var(--gold)';
            } else if (fixedInstScope === 'post') {
                indicator.innerText = `الوضع: تثبيت قسط بعد الاستلام عند ${formatNum(fixedInstVal)} ج.م (قبل الاستلام محسوب بالتساوي)`;
                indicator.style.color = 'var(--accent-blue)';
            } else {
                indicator.innerText = `الوضع: تثبيت جميع الأقساط عند ${formatNum(fixedInstVal)} ج.م`;
                indicator.style.color = 'var(--gold)';
            }
        } else if (mode === 'front') {
            indicator.innerText = `الوضع: Front-Loaded (تحميل قبل الاستلام: ${actualPrePct.toFixed(2)}% | بعد: ${actualPostPct.toFixed(2)}%)`;
            indicator.style.color = 'var(--gold)';
        } else if (mode === 'back') {
            indicator.innerText = `الوضع: Back-Loaded (تحميل بعد الاستلام: ${actualPostPct.toFixed(2)}% | قبل: ${actualPrePct.toFixed(2)}%)`;
            indicator.style.color = 'var(--accent-blue)';
        } else if (mode === 'equal') {
            indicator.innerText = `الوضع: متساوي (توزيع متساوي على كل الأقساط)`;
            indicator.style.color = 'var(--text-muted)';
        } else if (mode === 'custom') {
            indicator.innerText = `الوضع: مخصص يدوي (قبل: ${actualPrePct.toFixed(2)}% | بعد: ${actualPostPct.toFixed(2)}%)`;
            indicator.style.color = '#2ecc71';
        } else {
            indicator.innerText = `الوضع: تلقائي (تحميل أي دفعة ملغية على ما قبل الاستلام)`;
            indicator.style.color = 'var(--text-muted)';
        }
    }
}

function renderFixedGuidanceBox(g) {
    let counterpartEl = document.getElementById('fixed-inst-counterpart-info');
    let guidanceBox = document.getElementById('fixed-inst-guidance-box');
    
    if (!g || !g.hasFixedInst) {
        if (counterpartEl) counterpartEl.style.display = 'none';
        if (guidanceBox) guidanceBox.style.display = 'none';
        return;
    }
    
    let price = g.price || basePriceCache || 0;
    let remAmt = g.remAmt || 0;
    let currentYears = parseInt(document.getElementById('duration-years').value) || 8;
    
    // 1. Counterpart Info
    if (counterpartEl) {
        counterpartEl.style.display = 'block';
        if (g.scope === 'pre') {
            counterpartEl.innerHTML = `
                <div style="color: var(--accent-blue); font-weight: bold; font-size: 0.9rem;">
                    ➡️ الأقساط بعد الاستلام (محسوبة تلقائياً بالتساوي): 
                    <span style="color: #fff;">${formatCurr(g.instAmtPost)}</span> 
                    (${g.actualPostPct.toFixed(2)}% إجمالي / ${(g.nPost > 0 ? g.actualPostPct / g.nPost : 0).toFixed(2)}% لكل قسط) 
                    | عدد: ${g.nPost} قسطاً
                </div>`;
        } else if (g.scope === 'post') {
            counterpartEl.innerHTML = `
                <div style="color: var(--accent-blue); font-weight: bold; font-size: 0.9rem;">
                    ➡️ الأقساط قبل الاستلام (محسوبة تلقائياً بالتساوي): 
                    <span style="color: #fff;">${formatCurr(g.instAmtPre)}</span> 
                    (${g.actualPrePct.toFixed(2)}% إجمالي / ${(g.nPre > 0 ? g.actualPrePct / g.nPre : 0).toFixed(2)}% لكل قسط) 
                    | عدد: ${g.nPre} قسطاً
                </div>`;
        } else {
            let totalInst = g.nTotal * g.fixedAmt;
            counterpartEl.innerHTML = `
                <div style="color: var(--gold); font-weight: bold; font-size: 0.9rem;">
                    ➡️ إجمالي الأقساط على ${currentYears} سنوات (${g.nTotal} قسطاً): 
                    <span style="color: #fff;">${formatCurr(totalInst)}</span> 
                    (${(price > 0 ? (totalInst / price) * 100 : 0).toFixed(2)}% من السعر)
                </div>`;
        }
    }
    
    // 2. Feasibility & Guidance
    if (guidanceBox) {
        guidanceBox.style.display = 'block';
        
        if (g.scope === 'pre') {
            let totalPre = g.nPre * g.fixedAmt;
            if (totalPre > remAmt) {
                let maxAllowed = g.nPre > 0 ? remAmt / g.nPre : 0;
                guidanceBox.style.background = 'rgba(231, 76, 60, 0.15)';
                guidanceBox.style.border = '1px solid #e74c3c';
                guidanceBox.innerHTML = `
                    <div style="color: #e74c3c; font-weight: bold; margin-bottom: 6px;">
                        ⚠️ تنبيه: القسط قبل الاستلام (${formatCurr(g.fixedAmt)}) كبير جداً! يتجاوز كامل الوعاء المتاح (${formatCurr(remAmt)}).
                    </div>
                    <div style="color: var(--text-muted); margin-bottom: 8px;">
                        الحد الأقصى للقسط قبل الاستلام لتغطية الوعاء هو <strong>${formatCurr(maxAllowed)}</strong>.
                    </div>
                    <button class="btn btn-outline" onclick="applyFixedVal(${Math.floor(maxAllowed)})" style="padding: 4px 10px; font-size: 0.8rem; border-color: #e74c3c; color: #fff;">
                        ضبط القسط عند الحد الأقصى (${formatNum(maxAllowed)} ج.م)
                    </button>
                `;
            } else {
                guidanceBox.style.background = 'rgba(46, 204, 113, 0.1)';
                guidanceBox.style.border = '1px solid rgba(46, 204, 113, 0.3)';
                guidanceBox.innerHTML = `
                    <div style="color: #2ecc71; font-weight: bold;">
                        ✅ القسط متوافق تماماً. تم توزيع باقي المبلغ بالتساوي على أقساط ما بعد الاستلام.
                    </div>
                `;
            }
        } else if (g.scope === 'post') {
            let totalPost = g.nPost * g.fixedAmt;
            if (totalPost > remAmt) {
                let maxAllowed = g.nPost > 0 ? remAmt / g.nPost : 0;
                guidanceBox.style.background = 'rgba(231, 76, 60, 0.15)';
                guidanceBox.style.border = '1px solid #e74c3c';
                guidanceBox.innerHTML = `
                    <div style="color: #e74c3c; font-weight: bold; margin-bottom: 6px;">
                        ⚠️ تنبيه: القسط بعد الاستلام (${formatCurr(g.fixedAmt)}) يتجاوز كامل الوعاء المتاح (${formatCurr(remAmt)}).
                    </div>
                    <div style="color: var(--text-muted); margin-bottom: 8px;">
                        الحد الأقصى للقسط بعد الاستلام هو <strong>${formatCurr(maxAllowed)}</strong>.
                    </div>
                    <button class="btn btn-outline" onclick="applyFixedVal(${Math.floor(maxAllowed)})" style="padding: 4px 10px; font-size: 0.8rem; border-color: #e74c3c; color: #fff;">
                        ضبط القسط عند الحد الأقصى (${formatNum(maxAllowed)} ج.م)
                    </button>
                `;
            } else {
                guidanceBox.style.background = 'rgba(46, 204, 113, 0.1)';
                guidanceBox.style.border = '1px solid rgba(46, 204, 113, 0.3)';
                guidanceBox.innerHTML = `
                    <div style="color: #2ecc71; font-weight: bold;">
                        ✅ القسط متوافق تماماً. تم توزيع باقي المبلغ بالتساوي على أقساط ما قبل الاستلام.
                    </div>
                `;
            }
        } else {
            // Scope === 'all'
            let totalInst = g.nTotal * g.fixedAmt;
            let diff = remAmt - totalInst;
            
            if (Math.abs(diff) < 100) {
                guidanceBox.style.background = 'rgba(46, 204, 113, 0.1)';
                guidanceBox.style.border = '1px solid rgba(46, 204, 113, 0.3)';
                guidanceBox.innerHTML = `
                    <div style="color: #2ecc71; font-weight: bold;">
                        ✅ القسط متطابق تماماً بنسبة 100% مع سنوات الخطة.
                    </div>
                `;
            } else if (diff > 0) {
                // Deficit: Inst is too small for current years
                let neededInsts = remAmt / g.fixedAmt;
                let recYears = Math.ceil(neededInsts / 4);
                
                // DP calculation
                let curDp1 = parseFloat(document.getElementById('dp1-val')?.value) || (price * (currentProject === 'Zomra' ? 0.025 : 0.05));
                let newDp1Amt = curDp1 + diff;
                let newDp1Pct = price > 0 ? (newDp1Amt / price) * 100 : 0;
                
                // Delivery calculation
                let curDeliv = parseFloat(document.getElementById('deliv-val')?.value) || (price * 0.05);
                let newDelivAmt = curDeliv + diff;
                let newDelivPct = price > 0 ? (newDelivAmt / price) * 100 : 0;
                
                guidanceBox.style.background = 'rgba(243, 156, 18, 0.15)';
                guidanceBox.style.border = '1px solid #f39c12';
                
                let yearsHtml = '';
                if (recYears <= 10) {
                    yearsHtml = `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 4px; margin-bottom: 6px;">
                            <span>🗓️ <strong>تعديل السنين:</strong> هذا القسط يناسب مدة <strong>${recYears} سنوات</strong> (${Math.round(neededInsts)} قسطاً).</span>
                            <button class="btn btn-primary" onclick="applyRecYears(${recYears})" style="padding: 3px 8px; font-size: 0.78rem;">تطبيق ${recYears} سنوات</button>
                        </div>
                    `;
                } else {
                    yearsHtml = `
                        <div style="color: var(--text-muted); margin-bottom: 6px;">
                            🗓️ يتطلب هذا القسط مدة <strong>${recYears} سنة</strong> (أكبر من الحد الأقصى 10 سنوات).
                        </div>
                    `;
                }
                
                guidanceBox.innerHTML = `
                    <div style="color: #f39c12; font-weight: bold; margin-bottom: 6px;">
                        ⚠️ تنبيه: القسط (${formatCurr(g.fixedAmt)}) على ${currentYears} سنوات يترك عجزاً قدره ${formatCurr(diff)} (${((diff/price)*100).toFixed(2)}%).
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
                        ${yearsHtml}
                        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 4px; margin-bottom: 6px;">
                            <span>💰 <strong>زيادة المقدم:</strong> زيادة المقدم بمقدار ${formatNum(diff)} ج.م ليصبح <strong>${formatNum(newDp1Amt)} ج.م</strong> (${newDp1Pct.toFixed(1)}%).</span>
                            <button class="btn btn-primary" onclick="applyRecDP(${Math.round(newDp1Amt)})" style="padding: 3px 8px; font-size: 0.78rem; background: #217346; border-color: #217346;">تطبيق زيادة المقدم</button>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 4px; margin-bottom: 6px;">
                            <span>📦 <strong>زيادة الاستلام:</strong> زيادة دفعة الاستلام لتصبح <strong>${formatNum(newDelivAmt)} ج.م</strong> (${newDelivPct.toFixed(1)}%).</span>
                            <button class="btn btn-primary" onclick="applyRecDeliv(${Math.round(newDelivAmt)})" style="padding: 3px 8px; font-size: 0.78rem; background: var(--accent-blue); border-color: var(--accent-blue);">تحميل على الاستلام</button>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 4px;">
                            <span>⚖️ <strong>تثبيت قبل الاستلام فقط:</strong> تثبيت ${formatNum(g.fixedAmt)} ج.م قبل الاستلام وتحميل الفارق بعد الاستلام.</span>
                            <button class="btn btn-outline" onclick="applyRecPreOnly()" style="padding: 3px 8px; font-size: 0.78rem; border-color: var(--gold); color: #fff;">تثبيت قبل الاستلام فقط</button>
                        </div>
                    </div>
                `;
            } else {
                // Surplus: Inst is too large for current years
                let surplus = -diff;
                let neededInsts = remAmt / g.fixedAmt;
                let recYears = Math.max(1, Math.round(neededInsts / 4));
                
                guidanceBox.style.background = 'rgba(52, 152, 219, 0.15)';
                guidanceBox.style.border = '1px solid #3498db';
                guidanceBox.innerHTML = `
                    <div style="color: #3498db; font-weight: bold; margin-bottom: 6px;">
                        ℹ️ ملاحظة: القسط (${formatCurr(g.fixedAmt)}) أكبر من المطلوب على ${currentYears} سنوات (فائض: ${formatCurr(surplus)}).
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 4px;">
                        <span>🗓️ يمكنك تقليل المدة إلى <strong>${recYears} سنوات</strong> لتغطية الوحدة تماماً.</span>
                        <button class="btn btn-primary" onclick="applyRecYears(${recYears})" style="padding: 3px 8px; font-size: 0.78rem;">تطبيق ${recYears} سنوات</button>
                    </div>
                `;
            }
        }
    }
}

function renderTargetPriceGuidance(targetPrice, currentOfferPrice, targetPv) {
    let guidanceBox = document.getElementById('target-price-guidance-box');
    if (!guidanceBox) return;

    if (!targetPrice || isNaN(targetPrice) || targetPrice <= 0) {
        guidanceBox.style.display = 'none';
        return;
    }

    guidanceBox.style.display = 'block';

    let diff = targetPrice - currentOfferPrice;
    let basePrice = basePriceCache || 5000000;
    let currentYears = parseInt(document.getElementById('duration-years').value) || 8;
    let contractDateStr = document.getElementById('contract-date').value || new Date();
    let freqMonths = parseInt(document.getElementById('payment-frequency').value) === 2 ? 6 : 3;

    if (Math.abs(diff) < 100) {
        guidanceBox.style.background = 'rgba(46, 204, 113, 0.1)';
        guidanceBox.style.border = '1px solid rgba(46, 204, 113, 0.3)';
        guidanceBox.innerHTML = `
            <div style="color: #2ecc71; font-weight: bold;">
                ✅ سعر الوحدة (${formatNum(targetPrice)} ج.م) متطابق تماماً بنسبة 100% مع الخطة الحالية.
            </div>
        `;
        return;
    }

    let diffPct = (diff / basePrice) * 100;
    let isDiscount = diff < 0;

    guidanceBox.style.background = isDiscount ? 'rgba(52, 152, 219, 0.15)' : 'rgba(243, 156, 18, 0.15)';
    guidanceBox.style.border = isDiscount ? '1px solid #3498db' : '1px solid #f39c12';

    // 1. Natural Duration Matching
    let bestY = null;
    let bestYPrice = 0;
    let bestYGap = Infinity;

    for (let y = 3; y <= 10; y++) {
        let tpl = generateFlowsTemplate(contractDateStr, y, freqMonths, false);
        let p = solveForPrice(targetPv, tpl);
        let gap = Math.abs(p - targetPrice);
        if (gap < bestYGap) {
            bestYGap = gap;
            bestY = y;
            bestYPrice = p;
        }
    }

    let yearsHtml = '';
    if (bestY && bestY !== currentYears) {
        yearsHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 4px; margin-bottom: 6px;">
                <span>🗓️ <strong>تعديل السنين:</strong> خطة <strong>${bestY} سنوات</strong> تعطي سعراً طبيعياً <strong>${formatNum(bestYPrice)} ج.م</strong> (فارق: ${formatNum(Math.abs(bestYPrice - targetPrice))} ج.م).</span>
                <button class="btn btn-primary" onclick="applyTargetYears(${bestY})" style="padding: 3px 8px; font-size: 0.78rem;">تطبيق ${bestY} سنوات</button>
            </div>
        `;
    }

    // 2. Exact Down Payment on Current Plan
    let low = 0, high = 85, bestDp = null;
    for (let iter = 0; iter < 45; iter++) {
        let mid = (low + high) / 2;
        let tpl = generateFlowsTemplate(contractDateStr, currentYears, freqMonths, false);
        tpl.forEach(f => {
            if (f.id === 'dp1') f.defaultPct = mid / 100;
        });
        let flows = calculateCustomFlows(targetPrice, tpl);
        let pv = flows.filter(f => !f.isMnt).reduce((sum, f) => sum + f.pv, 0);
        if (pv < targetPv) {
            low = mid;
        } else {
            high = mid;
            bestDp = mid;
        }
    }

    let dpNeededPct = bestDp !== null ? bestDp : 0;
    let dpNeededAmt = targetPrice * (dpNeededPct / 100);
    let dpCurPct = parseFloat(document.getElementById('dp1-val')?.value) || (currentProject === 'Zomra' ? 2.5 : 5);

    let dpActionHtml = '';
    if (dpNeededPct > 0.5 && dpNeededPct < 85 && Math.abs(dpNeededPct - dpCurPct) > 0.2) {
        dpActionHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 4px; margin-bottom: 6px;">
                <span>💰 <strong>تعديل المقدم:</strong> دفع مقدم <strong>${dpNeededPct.toFixed(1)}%</strong> (${formatNum(dpNeededAmt)} ج.م) للوصول للسعر المستهدف بالمليم على نفس السنين.</span>
                <button class="btn btn-primary" onclick="applyTargetDP(${dpNeededPct.toFixed(2)})" style="padding: 3px 8px; font-size: 0.78rem; background: #217346; border-color: #217346;">تطبيق مقدم ${dpNeededPct.toFixed(1)}%</button>
            </div>
        `;
    }

    // 3. Target Installment
    let nInsts = currentYears * (12 / freqMonths);
    if (currentProject === 'Perla') nInsts -= 1;
    let baseMilestonesPct = (currentProject === 'Zomra') ? 15 : 10;
    let targetInstAmt = (targetPrice * (1 - baseMilestonesPct / 100)) / nInsts;
    let instActionHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 4px;">
            <span>💵 <strong>تثبيت الأقساط:</strong> كل قسط سيكون <strong>${formatNum(targetInstAmt)} ج.م</strong> لتغطية السعر المستهدف.</span>
            <button class="btn btn-outline" onclick="applyTargetInst(${Math.round(targetInstAmt)})" style="padding: 3px 8px; font-size: 0.78rem; border-color: var(--gold); color: #fff;">تثبيت عند ${formatNum(targetInstAmt)}</button>
        </div>
    `;

    let statusHeader = isDiscount ?
        `<div style="color: #3498db; font-weight: bold; margin-bottom: 6px;">
            💡 للوصول لسعر مستهدف: ${formatCurr(targetPrice)} (خصم مطلوب: ${Math.abs(diffPct).toFixed(2)}% — فارق: ${formatNum(Math.abs(diff))} ج.م):
        </div>` :
        `<div style="color: #f39c12; font-weight: bold; margin-bottom: 6px;">
            💡 للوصول لسعر مستهدف: ${formatCurr(targetPrice)} (زيادة مطلوبة: ${diffPct.toFixed(2)}% — فارق: ${formatNum(diff)} ج.م):
        </div>`;

    guidanceBox.innerHTML = `
        ${statusHeader}
        <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
            ${yearsHtml}
            ${dpActionHtml}
            ${instActionHtml}
        </div>
    `;
}

window.applyTargetYears = function(y) {
    let yrEl = document.getElementById('duration-years');
    if (yrEl) yrEl.value = y;
    let targetPriceEl = document.getElementById('target-price-val');
    if (targetPriceEl) targetPriceEl.value = '';
    let targetPctEl = document.getElementById('target-pct-val');
    if (targetPctEl) targetPctEl.value = '';
    calculate();
};

window.applyTargetDP = function(pct) {
    let dpEl = document.getElementById('dp1-val');
    let dpType = document.getElementById('dp1-type');
    if (dpEl) dpEl.value = pct;
    if (dpType) dpType.value = 'pct';
    let targetPriceEl = document.getElementById('target-price-val');
    if (targetPriceEl) targetPriceEl.value = '';
    let targetPctEl = document.getElementById('target-pct-val');
    if (targetPctEl) targetPctEl.value = '';
    calculate();
};

window.applyTargetInst = function(amt) {
    let toggle = document.getElementById('fixed-inst-toggle');
    if (toggle) toggle.checked = true;
    let scopeEl = document.getElementById('fixed-inst-scope');
    if (scopeEl) scopeEl.value = 'all';
    let typeEl = document.getElementById('fixed-inst-type');
    if (typeEl) typeEl.value = 'amt';
    let valEl = document.getElementById('fixed-inst-val');
    if (valEl) valEl.value = amt;
    let ctrl = document.getElementById('fixed-inst-controls-wrapper');
    if (ctrl) ctrl.style.display = 'block';
    let badge = document.getElementById('fixed-inst-status-badge');
    if (badge) {
        badge.innerText = 'مفعّل';
        badge.style.color = 'var(--gold)';
    }
    let targetPriceEl = document.getElementById('target-price-val');
    if (targetPriceEl) targetPriceEl.value = '';
    let targetPctEl = document.getElementById('target-pct-val');
    if (targetPctEl) targetPctEl.value = '';
    calculate();
};

function calculate() {
    try {
        let basePriceInput = document.getElementById('base-price');
        let basePrice = parseFloat(basePriceInput ? basePriceInput.value : 0) || 0;
        if (basePrice < 0) basePrice = 0;
        
        let dateEl = document.getElementById('contract-date');
        let contractDateStr = dateEl ? dateEl.value : '';
        if (!contractDateStr || isNaN(new Date(contractDateStr).getTime())) {
            contractDateStr = formatDate(new Date());
            if (dateEl) dateEl.value = contractDateStr;
        }
        
        let yearsEl = document.getElementById('duration-years');
        let years = parseInt(yearsEl ? yearsEl.value : 8) || 8;
        years = Math.max(1, Math.min(20, years));
        
        let freqEl = document.getElementById('payment-frequency');
        let freqMonths = (freqEl && parseInt(freqEl.value) === 2) ? 6 : 3;
        
        basePriceCache = basePrice;
        
        let baseYearsEl = document.getElementById('base-duration-years');
        let baseYears = parseInt(baseYearsEl ? baseYearsEl.value : 8) || 8;
        baseYears = Math.max(1, Math.min(20, baseYears));
        
        let baseFreqEl = document.getElementById('base-payment-frequency');
        let baseFreq = (baseFreqEl && parseInt(baseFreqEl.value) === 2) ? 6 : 3;
        
        let baseTemplate = generateFlowsTemplate(contractDateStr, baseYears, baseFreq, true);
        let baseFlows = calculateBaseFlows(basePrice, baseTemplate);
        basePvCache = baseFlows.filter(f => !f.isMnt).reduce((sum, f) => sum + (f.pv || 0), 0); // Exclude Mnt from NPV
        
        baseFlows = applyPerfectPercentages(baseFlows, basePrice);
        
        let baseTotAmtEl = document.getElementById('base-total-amt');
        if (baseTotAmtEl) baseTotAmtEl.innerText = formatCurr(basePrice);
        let baseTotPvEl = document.getElementById('base-total-pv');
        if (baseTotPvEl) baseTotPvEl.innerText = formatCurr(basePvCache);
        renderTable(baseFlows, 'base-tbody');
        updatePreDeliveryTracker(baseFlows, 'base-pre-delivery');
        
        let firstInstDateEl = document.getElementById('first-inst-date');
        let customFirstDateStr = (firstInstDateEl && firstInstDateEl.value && !isNaN(new Date(firstInstDateEl.value).getTime())) ? firstInstDateEl.value : null;
        let customTemplate = generateFlowsTemplate(contractDateStr, years, freqMonths, false, customFirstDateStr);
        
        let targetPv = basePvCache;
        
        let targetPriceStr = document.getElementById('target-price-val') ? document.getElementById('target-price-val').value : '';
        let targetPrice = parseFloat(targetPriceStr);
        if (isNaN(targetPrice) || targetPrice <= 0) targetPrice = null;
        
        let bestPrice = basePriceCache;

        let isFixedInst = document.getElementById('fixed-inst-toggle') && document.getElementById('fixed-inst-toggle').checked;
        let fixedInstVal = document.getElementById('fixed-inst-val') ? parseFloat(document.getElementById('fixed-inst-val').value) : 0;
        let hasFixedInst = isFixedInst && fixedInstVal > 0;
        
        let hasTargetPrice = targetPrice !== null;
        let fixedInstScope = document.getElementById('fixed-inst-scope') ? document.getElementById('fixed-inst-scope').value : 'all';
        if (hasFixedInst && fixedInstScope === 'all') {
            bestPrice = basePriceCache;
        } else {
            bestPrice = solveForPrice(targetPv, customTemplate);
            
            // User explicit requirement: Perla 70/30 should strictly be 0.863920294539959% increase for the base 8 years
            let is7030 = (document.getElementById('toggle-70-30') && document.getElementById('toggle-70-30').checked) ||
                         (document.getElementById('toggle-intra-year') && document.getElementById('toggle-intra-year').checked &&
                          document.getElementById('intra-year-type')?.value === 'pct' &&
                          parseFloat(document.getElementById('intra-year-val')?.value) === 70 &&
                          document.getElementById('intra-year-scope')?.value === 'all');
            let hasTableOverrides = window.globalTableOverrides && Object.keys(window.globalTableOverrides).length > 0;
            let hasCustomInputs = ['dp1', 'dp2', 'addl', 'deliv'].some(id => {
                let el = document.getElementById(id + '-val');
                return el && el.value.trim() !== '';
            });
            let isDistCustomized = window.globalDistState && (window.globalDistState.mode !== 'auto' || window.globalDistState.typedPrePct !== null || window.globalDistState.typedPostPct !== null);
            if (currentProject === 'Perla' && is7030 && !hasFixedInst && !hasTableOverrides && !hasCustomInputs && !isDistCustomized && years === 8) {
                bestPrice = basePriceCache * 1.00863920294539959;
            }
        }
        globalCustomFlows = calculateCustomFlows(bestPrice, customTemplate);
        
        let intraLabel = document.getElementById('intra-year-val-label');
        if (intraLabel) {
            intraLabel.innerText = freqMonths === 3 ? 'قسط أول 3 فترات ربع سنوية (Q1, Q2, Q3)' : 'قسط الفترة النصف سنوية الأولى (H1)';
        }
        
        let actualPrice = globalCustomFlows.filter(f => !f.isMnt).reduce((sum, f) => sum + (f.amount || 0), 0);
        window.lastCalculatedPrice = actualPrice;
        globalCustomFlows = applyPerfectPercentages(globalCustomFlows, actualPrice);
        globalCustomFlows.sort((a, b) => {
            if (a.isMnt && !b.isMnt) return 1;
            if (!a.isMnt && b.isMnt) return -1;
            if (a.months !== b.months) return a.months - b.months;
            let d1 = new Date(a.date);
            let d2 = new Date(b.date);
            if (!isNaN(d1) && !isNaN(d2)) return d1 - d2;
            return 0;
        });
        
        let offerPv = globalCustomFlows.filter(f => !f.isMnt).reduce((sum, f) => sum + (f.pv || 0), 0);
        
        let offerTotAmtEl = document.getElementById('offer-total-amt');
        if (offerTotAmtEl) offerTotAmtEl.innerText = formatCurr(actualPrice);
        let offerTotPvEl = document.getElementById('offer-total-pv');
        if (offerTotPvEl) offerTotPvEl.innerText = formatCurr(offerPv);
        
        let offerPreDelivPct = 0;
        let delivMonth = currentProject === 'Zomra' ? 37 : 48;
        globalCustomFlows.forEach(f => {
            if (!f.isMnt && f.months <= delivMonth) {
                offerPreDelivPct += parseFloat(f.displayPct) || 0;
            }
        });
        let offerPreDelivEl = document.getElementById('offer-pre-delivery');
        if (offerPreDelivEl) offerPreDelivEl.innerText = offerPreDelivPct.toFixed(2) + '%';

        renderTable(globalCustomFlows, 'offer-tbody');
        updatePreDeliveryTracker(globalCustomFlows, 'offer-pre-delivery');
        updateDistUI(globalCustomFlows._distInfo);
        renderFixedGuidanceBox(globalCustomFlows._fixedGuidance);
        renderIntraGuidanceBox(globalCustomFlows._intraGuidance);
        renderTargetPriceGuidance(targetPrice, actualPrice, targetPv);
        generateExportTemplate(actualPrice, offerPreDelivPct);
        
        let diffEl = document.getElementById('pv-difference');
        if (diffEl) {
            let priceDiff = actualPrice - basePriceCache;
            if (basePriceCache <= 0) {
                diffEl.innerHTML = `<span style="color:var(--text-muted)">يرجى إدخال سعر الوحدة الأساسي</span>`;
            } else if (Math.abs(priceDiff) < 1000) {
                diffEl.innerHTML = `<span style="color:var(--success)">✅ Base Plan Applied</span>`;
            } else {
                let isIncrease = priceDiff > 0;
                let diffPct = (Math.abs(priceDiff / basePriceCache) * 100).toFixed(2);
                let color = isIncrease ? 'var(--success)' : 'var(--danger)';
                let text = isIncrease ? 'Increase %' : 'Discount %';
                
                diffEl.innerHTML = `
                    <div style="color:${color}; font-size: 1.3rem;">${text}: ${diffPct}%</div>
                    <div style="color:${color}; font-size: 1rem; margin-top:5px;">Amount: ${formatCurr(Math.abs(priceDiff))}</div>
                `;
            }
        }
    } catch (e) {
        console.error('Calculation Guard caught error:', e);
    }
}

function renderTable(flows, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let totalAmt = 0;
    let totalPv = 0;
    
    let nonMntFlows = (flows || []).filter(f => !f.isMnt);
    nonMntFlows.forEach((cf) => {
        let idx = flows.indexOf(cf);
        let tr = document.createElement('tr');
        
        let displayPct = cf.displayPct;
        
        if (tbodyId === 'base-tbody') {
            tr.innerHTML = `
                <td style="text-align:left">${cf.label}</td>
                <td>${cf.date}</td>
                <td>${displayPct}%</td>
                <td style="color:var(--accent-blue); font-weight:bold;">${formatCurr(cf.amount)}</td>
                <td style="color:var(--gold); font-weight:bold;">${formatCurr(cf.pv)}</td>
            `;
            tbody.appendChild(tr);
            totalAmt += (cf.amount || 0);
            totalPv += (cf.pv || 0);
        } else {
            tr.dataset.flowId = cf.id;
            tr.innerHTML = `
                <td style="text-align:left">${cf.label}</td>
                <td><input type="date" style="width:125px; padding: 2px 4px; font-size: 0.85rem;" class="tbl-input tbl-date" value="${cf.date}" onchange="applyTableEdits()"></td>
                <td><input type="number" step="0.01" style="width:60px;" class="tbl-input tbl-pct" value="${displayPct}" onchange="applyTableEdits()">%</td>
                <td><input type="number" style="width:90px; color:var(--accent-blue); font-weight:bold;" class="tbl-input tbl-amt" value="${Math.round(cf.amount || 0)}" onchange="applyTableEdits()"></td>
                <td style="color:var(--gold); font-weight:bold;" class="tbl-pv">${formatCurr(cf.pv)}</td>
            `;
            tbody.appendChild(tr);
            totalAmt += (cf.amount || 0);
            totalPv += (cf.pv || 0);
        }
    });
    
    // Add total row for payments
    let trTotal = document.createElement('tr');
    trTotal.style.backgroundColor = '#e2efda';
    trTotal.innerHTML = `
        <td style="text-align:right; font-weight:bold;">Total Payments:</td>
        <td></td>
        <td style="font-weight:bold;">100.00%</td>
        <td style="color:var(--accent-blue); font-weight:bold;">${formatCurr(totalAmt)}</td>
        <td style="color:var(--gold); font-weight:bold;">${formatCurr(totalPv)}</td>
    `;
    tbody.appendChild(trTotal);
    
    // Add maintenance at the end for the screen
    let mnts = flows.filter(f => f.isMnt);
    if (mnts.length > 0) {
        let trMntHead = document.createElement('tr');
        trMntHead.style.backgroundColor = '#4472c4';
        trMntHead.style.color = 'white';
        trMntHead.innerHTML = `<td colspan="5" style="font-weight:bold;">Maintenance Schedule (8%)</td>`;
        tbody.appendChild(trMntHead);
        
        let mntSum = 0;
        mnts.forEach(cf => {
            let trM = document.createElement('tr');
            trM.style.backgroundColor = '#d9e1f2';
            trM.innerHTML = `
                <td style="text-align:left">${cf.label}</td>
                <td>${cf.date}</td>
                <td>4.00%</td>
                <td style="color:var(--accent-blue); font-weight:bold;">${formatCurr(cf.amount)}</td>
                <td style="color:var(--gold); font-weight:bold;">-</td>
            `;
            tbody.appendChild(trM);
            mntSum += cf.amount;
        });
        
        let trMntTotal = document.createElement('tr');
        trMntTotal.style.backgroundColor = '#bdd7ee';
        trMntTotal.innerHTML = `
            <td style="text-align:right; font-weight:bold;">Total Maintenance:</td>
            <td></td>
            <td style="font-weight:bold;">8.00%</td>
            <td style="color:var(--accent-blue); font-weight:bold;">${formatCurr(mntSum)}</td>
            <td style="color:var(--gold); font-weight:bold;">-</td>
        `;
        tbody.appendChild(trMntTotal);
    }
    
    if (tbodyId === 'offer-tbody') {
        document.getElementById('offer-total-amt').innerText = formatCurr(totalAmt);
    }
}

window.applyTableEdits = function() {
    let tbody = document.getElementById('offer-tbody');
    if (!window.globalTableOverrides) window.globalTableOverrides = {};
    
    Array.from(tbody.rows).forEach((tr) => {
        let flowId = tr.dataset.flowId;
        if (!flowId) return;
        let f = globalCustomFlows.find(item => item.id === flowId);
        if (!f) return;
        
        let dateInput = tr.querySelector('.tbl-date');
        let pctInput = tr.querySelector('.tbl-pct');
        let amtInput = tr.querySelector('.tbl-amt');
        
        if (dateInput && dateInput.value) {
            if (!window.globalTableOverrides[flowId]) window.globalTableOverrides[flowId] = {};
            window.globalTableOverrides[flowId].date = dateInput.value;
        }
        
        if (amtInput && pctInput) {
            let currentAmt = Math.round(f.amount);
            let typedAmt = parseFloat(amtInput.value.replace(/,/g, '')) || 0;
            
            let currentPct = parseFloat(f.displayPct);
            let typedPct = parseFloat(pctInput.value) || 0;
            
            if (!window.globalTableOverrides[flowId]) window.globalTableOverrides[flowId] = {};
            
            if (typedAmt !== currentAmt) {
                window.globalTableOverrides[flowId].amount = typedAmt;
                window.globalTableOverrides[flowId].isPct = false;
            } else if (typedPct !== currentPct) {
                window.globalTableOverrides[flowId].amount = typedPct;
                window.globalTableOverrides[flowId].isPct = true;
            }
        }
    });
    
    calculate();
};

window.resetTableEdits = function() {
    window.globalTableOverrides = {};
    calculate();
};

// --- PDF & Excel Export Template Generator ---
function generateExportTemplate(offerPrice, offerPreDelivPct) {
    let dateEl = document.getElementById('contract-date');
    let contractDateStr = (dateEl && dateEl.value) ? dateEl.value : formatDate(new Date());
    let years = parseInt(document.getElementById('duration-years').value) || 0;
    let mntTotal = offerPrice * 0.08;
    let incPct = (offerPrice - basePriceCache) / basePriceCache;
    
    let label1 = incPct < 0 ? 'Discount % :' : 'Increase % :';
    let label2 = incPct < 0 ? 'Price After Discount :' : 'Price After Increase :';
    let displayIncPct = Math.abs(incPct);
    
    let nonMntFlows = globalCustomFlows.filter(f => !f.isMnt);
    let mntFlows = globalCustomFlows.filter(f => f.isMnt);
    let totalItems = nonMntFlows.length + mntFlows.length;

    // Adaptive sizing based on total items to guarantee 100% fit on a single A4 page
    let fontSize = '7.2px';
    let cellPadding = '1.2px 3px';
    let titleFontSize = '9px';
    let subHeaderFontSize = '7.5px';

    if (totalItems >= 42) { // 9, 10 Years
        fontSize = '6.5px';
        cellPadding = '0.8px 2.5px';
        titleFontSize = '8.5px';
        subHeaderFontSize = '7px';
    } else if (totalItems >= 34) { // 7, 8 Years
        fontSize = '7.2px';
        cellPadding = '1.2px 3px';
        titleFontSize = '9px';
        subHeaderFontSize = '7.5px';
    } else { // 4, 5, 6 Years
        fontSize = '7.8px';
        cellPadding = '1.8px 3.5px';
        titleFontSize = '9.5px';
        subHeaderFontSize = '8px';
    }

    let projectTitle = `NATIONS OF SKY \u2014 ${currentProject.toUpperCase()} \u2014 PAYMENT PLAN (${years} YEARS)`;

    let html = `
        <colgroup>
            <col style="width: 14.5%;">
            <col style="width: 30%;">
            <col style="width: 10.5%;">
            <col style="width: 26%;">
            <col style="width: 19%;">
        </colgroup>
        <tr><th colspan="5" class="export-header-blue" style="font-size: ${titleFontSize}; border: 1.5px solid black; padding: 3px; letter-spacing: 0.3px;">${projectTitle}</th></tr>
        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding};">Unit No :</td><td colspan="3" style="border-right: 1.5px solid black; padding: ${cellPadding};"></td></tr>
        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding};">Date :</td><td colspan="3" style="border-right: 1.5px solid black; padding: ${cellPadding};">${formatDateExport(contractDateStr || new Date())}</td></tr>
        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding};">Unit Base Price :</td><td colspan="3" style="border-right: 1.5px solid black; padding: ${cellPadding};">${formatNum(basePriceCache)}</td></tr>
        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding};">Maintenance (8%) :</td><td colspan="3" style="border-right: 1.5px solid black; padding: ${cellPadding};">${formatNum(mntTotal)}</td></tr>
        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding};">${label1}</td><td colspan="3" style="border-right: 1.5px solid black; padding: ${cellPadding};">${formatPct(displayIncPct)}</td></tr>
        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding};">${label2}</td><td colspan="3" class="export-bold" style="border-right: 1.5px solid black; padding: ${cellPadding};">${formatNum(offerPrice)}</td></tr>
        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; border-bottom: 1.5px solid black; padding: ${cellPadding};">Collected Till Delivery:</td><td colspan="3" style="border-right: 1.5px solid black; border-bottom: 1.5px solid black; padding: ${cellPadding};">${(offerPreDelivPct || 0).toFixed(2)}%</td></tr>
        <tr><td colspan="5" style="height: 4px; border: none; padding: 0;"></td></tr>
        
        <tr>
            <th colspan="2" class="export-header-blue" style="border: 1.5px solid black; padding: ${cellPadding}; font-size: ${subHeaderFontSize};">Payment Terms & Types</th>
            <th colspan="3" class="export-header-blue" style="border: 1.5px solid black; padding: ${cellPadding}; font-size: ${subHeaderFontSize};">${years} Years Payment Plan</th>
        </tr>
        <tr>
            <th colspan="2" class="export-header-blue" style="border-left: 1.5px solid black; border-bottom: 1.5px solid black; padding: ${cellPadding};"></th>
            <th class="export-header-blue" style="border-bottom: 1.5px solid black; padding: ${cellPadding};">%</th>
            <th class="export-header-blue" style="border-bottom: 1.5px solid black; padding: ${cellPadding};">Unit Price :</th>
            <th class="export-header-blue" style="border-right: 1.5px solid black; border-bottom: 1.5px solid black; padding: ${cellPadding};">Date</th>
        </tr>
    `;
    
    let grouped = [];
    nonMntFlows.forEach(f => {
        let grpName = '';
        if (f.months <= 1 && f.isDP) grpName = 'Down Payment';
        else {
            let y = Math.floor(f.months / 12) + 1;
            grpName = 'Year ' + y;
        }
        let lastGrp = grouped[grouped.length - 1];
        if (lastGrp && lastGrp.name === grpName) {
            lastGrp.items.push(f);
        } else {
            grouped.push({ name: grpName, items: [f] });
        }
    });
    
    grouped.forEach((grp, gIdx) => {
        let isLastGrp = gIdx === grouped.length - 1;
        grp.items.forEach((item, iIdx) => {
            let isLastItem = iIdx === grp.items.length - 1;
            let bottomBorder = isLastItem ? 'border-bottom: 1px solid black;' : 'border-bottom: 1px dotted #888;';
            if (isLastGrp && isLastItem) bottomBorder = 'border-bottom: 1.5px solid black;';
            
            html += `<tr>`;
            if (iIdx === 0) {
                let cellStyle = `border-left: 1.5px solid black; border-bottom: 1px solid black; border-right: 1px solid black; vertical-align: middle; padding: ${cellPadding};`;
                if (isLastGrp) cellStyle += ` border-bottom: 1.5px solid black;`;
                if (grp.name === 'Down Payment' && grp.items.length === 1) {
                    html += `<td rowspan="${grp.items.length}" colspan="2" class="export-bold" style="${cellStyle} text-align: center;">${grp.name}</td>`;
                } else {
                    html += `<td rowspan="${grp.items.length}" class="export-bold" style="${cellStyle} text-align: center;">${grp.name}</td>`;
                }
            }
            if (grp.name !== 'Down Payment' || grp.items.length > 1) {
                html += `<td style="${bottomBorder} border-right: 1px dotted #888; text-align: center; padding: ${cellPadding};">${item.label}</td>`;
            }
            html += `<td style="${bottomBorder} border-right: 1px dotted #888; padding: ${cellPadding};">${item.displayPct}%</td>`;
            html += `<td style="${bottomBorder} border-right: 1px dotted #888; padding: ${cellPadding};">${formatNum(item.amount)}</td>`;
            html += `<td style="border-right: 1.5px solid black; ${bottomBorder} padding: ${cellPadding};">${formatDateExport(item.date)}</td>`;
            html += `</tr>`;
        });
    });
    
    html += `<tr>
        <td colspan="2" class="export-header-blue" style="border-left: 1.5px solid black; border-bottom: 1.5px solid black; text-align: center; padding: ${cellPadding};">Total Amount</td>
        <td class="export-header-blue" style="border-bottom: 1.5px solid black; padding: ${cellPadding};">100.00%</td>
        <td class="export-header-blue" style="border-bottom: 1.5px solid black; padding: ${cellPadding};">${formatNum(offerPrice)}</td>
        <td class="export-header-blue" style="border-bottom: 1.5px solid black; border-right: 1.5px solid black; padding: ${cellPadding};"></td>
    </tr>`;
    
    html += `<tr><td colspan="5" style="height: 4px; border: none; padding: 0;"></td></tr>`;
    
    html += `<tr><th colspan="2" class="export-header-blue" style="border-left: 1.5px solid black; border-top: 1.5px solid black; border-bottom: 1.5px solid black; padding: ${cellPadding}; font-size: ${subHeaderFontSize};">Maintenance Payments</th><th colspan="3" style="border-right: 1.5px solid black; border-top: 1.5px solid black; border-bottom: 1.5px solid black; padding: ${cellPadding};"></th></tr>`;
    
    let totalMntAmt = 0;
    mntFlows.forEach((m, i) => {
        totalMntAmt += m.amount;
        let isLastMnt = i === mntFlows.length - 1;
        let bottomBorder = isLastMnt ? 'border-bottom: 1.5px solid black;' : 'border-bottom: 1px dotted #888;';
        html += `<tr>
            <td colspan="2" style="border-left: 1.5px solid black; border-right: 1px dotted #888; ${bottomBorder} padding: ${cellPadding};">Maintenance 0${i+1}</td>
            <td style="${bottomBorder} border-right: 1px dotted #888; padding: ${cellPadding};">${parseFloat(m.displayPct).toFixed(2)}%</td>
            <td style="${bottomBorder} border-right: 1px dotted #888; padding: ${cellPadding};">${formatNum(m.amount)}</td>
            <td style="border-right: 1.5px solid black; ${bottomBorder} padding: ${cellPadding};">${formatDateExport(m.date)}</td>
        </tr>`;
    });
    
    html += `<tr>
        <td colspan="2" class="export-header-blue" style="border-left: 1.5px solid black; border-bottom: 1.5px solid black; text-align: center; padding: ${cellPadding};">Total Maintenance</td>
        <td class="export-header-blue" style="border-bottom: 1.5px solid black; padding: ${cellPadding};">8.00%</td>
        <td class="export-header-blue" style="border-bottom: 1.5px solid black; padding: ${cellPadding};">${formatNum(totalMntAmt)}</td>
        <td class="export-header-blue" style="border-bottom: 1.5px solid black; border-right: 1.5px solid black; padding: ${cellPadding};"></td>
    </tr>`;
    
    let exportTable = document.getElementById('export-table');
    if (exportTable) {
        exportTable.style.fontSize = fontSize;
        exportTable.style.width = '520px';
        exportTable.innerHTML = html;
    }
}

// --- Export ---
let isExportingPDF = false;
function exportPDF() {
    if (isExportingPDF) return;
    let exportBtn = document.querySelector('button[onclick="exportPDF()"]');
    let origBtnHtml = exportBtn ? exportBtn.innerHTML : null;
    
    try {
        let element = document.getElementById('export-wrapper');
        if (!element) {
            alert('عفواً، قالب الطباعة غير جاهز.');
            return;
        }
        isExportingPDF = true;

        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.innerHTML = '⏳ جاري استخراج الـ PDF...';
        }

        // Re-generate export template right before export to guarantee fresh data
        let actualPrice = window.lastCalculatedPrice || parseFloat(document.getElementById('offer-total-amt')?.innerText.replace(/[^\d.]/g, '')) || basePriceCache || 0;
        let offerPreDelivPct = parseFloat((document.getElementById('offer-pre-delivery') ? document.getElementById('offer-pre-delivery').innerText : '0').replace('%', '')) || 0;
        generateExportTemplate(actualPrice, offerPreDelivPct);

        // Save original inline styles, scroll position, and body padding
        let oldScrollY = window.scrollY || window.pageYOffset || 0;
        let oldScrollX = window.scrollX || window.pageXOffset || 0;
        let origBodyPad = document.body.style.padding;
        let originalLeft = element.style.left;
        let originalPosition = element.style.position;
        let originalTop = element.style.top;
        let originalZIndex = element.style.zIndex;
        let originalVisibility = element.style.visibility;
        let originalDisplay = element.style.display;
        let origWidth = element.style.width;
        let origPadding = element.style.padding;
        let origMargin = element.style.margin;
        let origBoxSizing = element.style.boxSizing;
        let prevGold = getComputedStyle(document.documentElement).getPropertyValue('--gold') || '#c5a059';

        // Temporarily reset window scroll and body padding so html2canvas never suffers from scroll offset or padding shift
        window.scrollTo(0, 0);
        document.body.style.padding = '0px';

        // Set clean relative layout with 100% natural height, 550px width, padding 5px 15px, and left: 0 (margin: 0)
        element.style.position = 'relative';
        element.style.top = '0px';
        element.style.left = '0px';
        element.style.margin = '0';
        element.style.width = '550px';
        element.style.padding = '5px 15px';
        element.style.boxSizing = 'border-box';
        element.style.zIndex = '999999';
        element.style.visibility = 'visible';
        element.style.display = 'block';
        element.style.background = '#ffffff';

        document.documentElement.style.setProperty('--gold', '#000000');

        let yearsVal = document.getElementById('duration-years') ? document.getElementById('duration-years').value : 'Plan';
        let projName = (currentProject || 'Nations_of_Sky').replace(/\s+/g, '_');
        let pdfFileName = `Payment_Plan_${projName}_${yearsVal}Y.pdf`;

        let opt = {
            margin:       [8, 32, 8, 32], // symmetric 32mm margins for slender, compact Excel layout on A4
            filename:     pdfFileName,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: 2, 
                useCORS: true, 
                logging: false
            },
            jsPDF: { 
                unit: 'mm', 
                format: 'a4', 
                orientation: 'portrait' 
            },
            pagebreak: { mode: 'avoid-all' }
        };

        function restoreStyles() {
            try {
                element.style.position = originalPosition || 'absolute';
                element.style.left = originalLeft || '-9999px';
                element.style.top = originalTop || '0px';
                element.style.margin = origMargin || '';
                element.style.width = origWidth || '550px';
                element.style.padding = origPadding || '5px 15px';
                element.style.boxSizing = origBoxSizing || 'border-box';
                element.style.zIndex = originalZIndex || '';
                element.style.visibility = originalVisibility || 'visible';
                element.style.display = originalDisplay || 'block';
                document.body.style.padding = origBodyPad;
                window.scrollTo(oldScrollX, oldScrollY);
                document.documentElement.style.setProperty('--gold', prevGold.trim() || '#c5a059');
            } finally {
                if (exportBtn) {
                    exportBtn.disabled = false;
                    if (origBtnHtml) exportBtn.innerHTML = origBtnHtml;
                }
                isExportingPDF = false;
            }
        }

        html2pdf().set(opt).from(element).save().then(function() {
            restoreStyles();
        }).catch(function(err) {
            console.error('PDF Export Error:', err);
            restoreStyles();
            alert('حدث خطأ أثناء استخراج ملف الـ PDF.');
        });
    } catch (e) {
        console.error('SafeGuard: PDF Export Error prevented crash', e);
        if (exportBtn) {
            exportBtn.disabled = false;
            if (origBtnHtml) exportBtn.innerHTML = origBtnHtml;
        }
        isExportingPDF = false;
        alert('حدث خطأ أثناء استخراج الـ PDF. تأكد من تحميل الصفحة بالكامل.');
    }
}

function exportExcel() {
    try {
        if (!window.XLSX) {
            alert('مكتبة تصدير الإكسيل غير متوفرة حالياً.');
            return;
        }
        if (!globalCustomFlows || globalCustomFlows.length === 0) {
            alert('لا توجد بيانات متاحة للتصدير.');
            return;
        }

        let flowMonths = globalCustomFlows.map(f => f.months || 0);
        let maxMonths = flowMonths.length > 0 ? Math.max(...flowMonths) : 12;
        let actualYears = Math.max(1, Math.ceil(maxMonths / 12));
        
        let bestPrice = window.lastCalculatedPrice || parseFloat(document.getElementById('offer-total-amt')?.innerText.replace(/[^\d.]/g, '')) || basePriceCache || 0;
        let mntTotal = (basePriceCache || 0) * 0.08;
        let incAmt = bestPrice - (basePriceCache || 0);
        let incPct = basePriceCache > 0 ? (incAmt / basePriceCache) : 0;
        
        let ws_data = [
            ["Payment Plan", "", "", "", ""],
            ["Unit No :", "", "", "", ""],
            ["Unit Base Price :", basePriceCache, "", "", ""],
            ["Maintenance :", mntTotal, "", "", ""],
            ["Increase Amount :", Math.abs(incAmt), "", "", ""],
            ["Increase % :", Math.abs(incPct), "", "", ""],
            ["Price After Increase :", bestPrice, "", "", ""],
            ["", "", "", "", ""],
            ["Payment Terms & Types", "", "Payment Plan", "", ""],
            ["Type", "Description", "%", "Amount", "Date"]
        ];
        
        let nonMntFlows = globalCustomFlows.filter(f => !f.isMnt);
        let totalAmtSum = 0;
        let totalPctSum = 0;
        
        nonMntFlows.forEach(f => {
            let grpName = '';
            if (f.isInst || (f.id && f.id.startsWith('inst'))) grpName = 'Installments';
            else if (f.isDP) grpName = 'Down Payments';
            else if (f.isMerged) grpName = 'Mixed Payments';
            else grpName = 'Other';
            
            let row = [
                grpName,
                f.label,
                f.exactPct || 0,
                f.amount || 0,
                f.date || ''
            ];
            ws_data.push(row);
            
            totalAmtSum += (f.amount || 0);
            totalPctSum += (f.exactPct || 0);
        });
        
        ws_data.push(["Total Payments:", "", totalPctSum, totalAmtSum, ""]);
        
        let mnts = globalCustomFlows.filter(f => f.isMnt);
        if (mnts.length > 0) {
            ws_data.push(["", "", "", "", ""]);
            ws_data.push(["Maintenance Schedule", "", "8% of Base Price", "", ""]);
            ws_data.push(["Type", "Description", "%", "Amount", "Date"]);
            let mntSum = 0;
            let mntPctSum = 0;
            mnts.forEach(m => {
                let mPct = (parseFloat(m.displayPct) || 0) / 100;
                ws_data.push([
                    "Maintenance",
                    m.label,
                    mPct,
                    m.amount || 0,
                    m.date || ''
                ]);
                mntSum += (m.amount || 0);
                mntPctSum += mPct;
            });
            ws_data.push(["Total Maintenance:", "", mntPctSum, mntSum, ""]);
        }
        
        let ws = XLSX.utils.aoa_to_sheet(ws_data);
        let wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Payment Plan");
        XLSX.writeFile(wb, `Payment_Plan_${currentProject}.xlsx`);
    } catch(err) {
        console.error('Excel Export Error:', err);
        alert('حدث خطأ أثناء تصدير ملف الإكسيل.');
    }
}

// --- Rates Modal ---
function openRatesModal() {
    let html = '';
    for(let i=0; i<=15; i++) {
        html += `<div class="input-group">
            <label>Year ${i}</label>
            <input type="number" id="rate-${i}" value="${discountRates[i]}">
        </div>`;
    }
    document.getElementById('rates-container').innerHTML = html;
    document.getElementById('rates-modal').classList.add('active');
}
function closeRatesModal() { document.getElementById('rates-modal').classList.remove('active'); }
function saveRates() {
    for(let i=0; i<=15; i++) {
        discountRates[i] = parseFloat(document.getElementById(`rate-${i}`).value) || 0;
    }
    closeRatesModal();
    calculate();
}

// Init
function initSystem() {
    let dateEl = document.getElementById('contract-date');
    if (dateEl && !dateEl.value) {
        dateEl.value = formatDate(new Date());
    }
    renderBaseInputs();
    renderCustomInputs();
    calculate();
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSystem);
    } else {
        initSystem();
    }
}

async function handleTemplateUpload(event) {
    try {
        const file = event.target.files[0];
        if (!file) return;
        
        let offerAmtText = document.getElementById('offer-total-amt').innerText;
        let offerPrice = parseFloat(offerAmtText.replace(/[^0-9.-]+/g,""));
        let incPct = (offerPrice - basePriceCache) / basePriceCache;
        let mntTotal = basePriceCache * 0.08; // Maintenance is always 8% of BASE
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const buffer = e.target.result;
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                const ws = workbook.worksheets[0];
                
                ws.getCell('F4').value = basePriceCache;
                ws.getCell('F5').value = mntTotal;
                ws.getCell('F6').value = -incPct;
                
                ws.getCell('D2').value = 'Payment Plan';
                ws.getCell('G9').value = 'Payment Plan';
                
                let nonMntFlows = globalCustomFlows.filter(f => !f.isMnt);
                let mnts = globalCustomFlows.filter(f => f.isMnt);
                
                let grouped = [];
                nonMntFlows.forEach(f => {
                    let grpName = '';
                    if (f.months <= 1 && f.isDP) grpName = 'Down Payment';
                    else {
                        let y = Math.ceil(f.months / 12);
                        if (y < 1) y = 1;
                        grpName = 'Year ' + y;
                    }
                    let lastGrp = grouped[grouped.length - 1];
                    if (lastGrp && lastGrp.name === grpName) {
                        lastGrp.items.push(f);
                    } else {
                        grouped.push({ name: grpName, items: [f] });
                    }
                });
                
                let rowIdx = 11;
                let excelTotalAmt = 0;
                let excelTotalPct = 0;
                
                let modelRow = ws.getRow(12);
                function writeRow(idx, colD, colF, colG, colH, colI) {
                    let row = ws.getRow(idx);
                    if(colD !== null) row.getCell(4).value = colD;
                    if(colF !== null) row.getCell(6).value = colF;
                    if(colG !== null) { row.getCell(7).value = colG / 100.0; row.getCell(7).numFmt = '0.00%'; }
                    if(colH !== null) { row.getCell(8).value = colH; row.getCell(8).numFmt = '#,##0.00'; }
                    if(colI !== null) row.getCell(9).value = colI;
                    
                    [4,5,6,7,8,9].forEach(c => {
                        let cell = row.getCell(c);
                        let mCell = modelRow.getCell(c);
                        if(mCell && mCell.style) {
                            cell.style = JSON.parse(JSON.stringify(mCell.style));
                        }
                    });
                }
                
                let totalRowIdx = 54;
                for (let i = 11; i < 500; i++) {
                    let r = ws.getRow(i);
                    let found = false;
                    for(let c=2; c<=9; c++) {
                        let val = r.getCell(c).value;
                        let str = val ? val.toString().toLowerCase() : '';
                        if (str.includes('total') || str.includes('amount') || str.includes('إجمالي') || str.includes('اجمالي')) {
                            totalRowIdx = i;
                            found = true;
                            break;
                        }
                    }
                    if (found) break;
                }

                for(let i=11; i<totalRowIdx; i++) {
                    let r = ws.getRow(i);
                    [4,5,6,7,8,9].forEach(c => r.getCell(c).value = null);
                    r.hidden = false;
                }
                
                grouped.forEach(grp => {
                    grp.items.forEach((item, j) => {
                        let isFirst = j === 0;
                        let itemPct = (item.amount / offerPrice) * 100.0; // New percentage on offer price
                        writeRow(rowIdx++, isFirst ? grp.name : null, item.label, itemPct, item.amount, formatDateExport(item.date));
                        excelTotalAmt += item.amount;
                        excelTotalPct += itemPct;
                    });
                });
                
                // Hide any remaining unused rows before the Total row so there are no empty gaps
                for(let i = rowIdx; i < totalRowIdx; i++) {
                    ws.getRow(i).hidden = true;
                }
                
                let rTotal = ws.getRow(totalRowIdx);
                rTotal.getCell(7).value = excelTotalPct / 100.0;
                rTotal.getCell(8).value = excelTotalAmt;
                
                let mntRowIdx = totalRowIdx + 5;
                let excelMntSum = 0;
                let excelMntPctSum = 0;
                mnts.forEach((m, i) => {
                    let mntPct = (m.amount / offerPrice) * 100.0; // Percentage based on new total
                    
                    let r = ws.getRow(mntRowIdx++);
                    r.getCell(6).value = m.amount; // Put Amount in Column 6
                    r.getCell(6).numFmt = '#,##0.00';
                    r.getCell(7).value = formatDateExport(m.date); // Set Date in Column 7
                    r.getCell(8).value = null; // Ensure no amount on the right
                    r.getCell(9).value = null; 
                    
                    excelMntSum += m.amount;
                    excelMntPctSum += mntPct;
                });
                
                let rTot = ws.getRow(totalRowIdx + 8);
                rTot.getCell(6).value = excelMntSum;
                rTot.getCell(6).numFmt = '#,##0.00';
                rTot.getCell(7).value = excelMntPctSum / 100.0;
                rTot.getCell(7).numFmt = '0.00%';
                rTot.getCell(8).value = null;
                rTot.getCell(9).value = null;
                
                const outBuffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Payment_Plan_' + currentProject + '_Template.xlsx';
                a.click();
                window.URL.revokeObjectURL(url);
                event.target.value = '';
            } catch(err) {
                console.error('Template upload processing error:', err);
                alert("حدث خطأ أثناء معالجة ملف الإكسيل. يرجى التأكد من رفع شيت مطابق وصالح.");
                event.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    } catch (e) {
        console.error('Template upload file reading error:', e);
        alert("حدث خطأ أثناء قراءة الملف.");
    }
}











