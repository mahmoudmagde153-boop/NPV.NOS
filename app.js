let currentProject = 'Zomra';
let typingTimer;

let discountRates = {
    0: 19, 1: 18, 2: 15, 3: 13, 4: 10,
    5: 10, 6: 9, 7: 9, 8: 9, 9: 9, 10: 9, 11: 9, 12: 9, 13: 9, 14: 9, 15: 9
};

let globalCustomFlows = [];
let globalBaseFlows = [];
let basePvCache = 0;
let basePriceCache = 0;

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

window.updateExportHeaderInfo = function() {
    let actualPrice = window.lastCalculatedPrice || parseFloat(document.getElementById('offer-total-amt')?.innerText.replace(/[^\d.]/g, '')) || basePriceCache || 0;
    let offerPreDelivPct = parseFloat((document.getElementById('offer-pre-delivery') ? document.getElementById('offer-pre-delivery').innerText : '0').replace('%', '')) || 0;
    generateExportTemplate(actualPrice, offerPreDelivPct);
};

function updateFixedInstMonthlyHint() {
    let hintEl = document.getElementById('fixed-inst-monthly-hint');
    if (!hintEl) return;
    let toggle = document.getElementById('fixed-inst-toggle');
    if (!toggle || !toggle.checked) {
        hintEl.style.display = 'none';
        return;
    }
    let val = parseFloat(document.getElementById('fixed-inst-val')?.value) || 0;
    let type = document.getElementById('fixed-inst-type')?.value || 'amt';
    let freqMonths = parseInt(document.getElementById('payment-frequency')?.value) === 2 ? 6 : 3;
    let basePrice = basePriceCache || 5000000;

    if (val <= 0) {
        hintEl.style.display = 'none';
        return;
    }

    if (type === 'amt') {
        let monthly = val / freqMonths;
        hintEl.innerHTML = `💡 القسط المُدخل يعادل: <span style="color: #fff; font-weight: bold;">${formatCurr(monthly)} / شهر</span>`;
        hintEl.style.display = 'block';
    } else {
        let amt = (basePrice * (val / 100));
        let monthly = amt / freqMonths;
        hintEl.innerHTML = `💡 القسط المُدخل (${val}% = ${formatCurr(amt)}) يعادل: <span style="color: #fff; font-weight: bold;">${formatCurr(monthly)} / شهر</span>`;
        hintEl.style.display = 'block';
    }
}
window.updateFixedInstMonthlyHint = updateFixedInstMonthlyHint;

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
    window.meltState = {};
    resetDistPresetInternal();
    let flexToggle = document.getElementById('flexible-toggle');
    if (flexToggle) {
        flexToggle.value = (proj === 'Zomra') ? 'yes' : 'no';
    }
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
    let toggle = document.getElementById('fixed-inst-toggle');
    if (toggle) toggle.checked = false;
    let fixValEl = document.getElementById('fixed-inst-val');
    if (fixValEl) fixValEl.value = '';
    let ctrl = document.getElementById('fixed-inst-controls-wrapper');
    if (ctrl) ctrl.style.display = 'none';
    let badge = document.getElementById('fixed-inst-status-badge');
    if (badge) {
        badge.innerText = 'غير مفعل';
        badge.style.color = 'var(--text-muted)';
    }
    ['dp1', 'dp2', 'addl', 'deliv'].forEach(id => {
        let el = document.getElementById(id + '-val');
        let typeEl = document.getElementById(id + '-type');
        if (el) el.value = '';
        if (typeEl) typeEl.value = 'pct';
    });
    window.globalTableOverrides = {};
    calculate();
};

window.applyRecDP = function(pct) {
    let dp1Val = document.getElementById('dp1-val');
    let dp1Type = document.getElementById('dp1-type');
    if (dp1Val && dp1Type) {
        dp1Type.value = 'pct';
        dp1Val.value = parseFloat(Number(pct).toFixed(4));
    }
    let toggle = document.getElementById('fixed-inst-toggle');
    if (toggle) toggle.checked = true;
    let scopeEl = document.getElementById('fixed-inst-scope');
    if (scopeEl) scopeEl.value = 'all';
    ['dp2', 'addl', 'deliv'].forEach(id => {
        let el = document.getElementById(id + '-val');
        let typeEl = document.getElementById(id + '-type');
        if (el) el.value = '';
        if (typeEl) typeEl.value = 'pct';
    });
    window.globalTableOverrides = {};
    calculate();
};

window.applyRecDeliv = function(pct) {
    let delivVal = document.getElementById('deliv-val');
    let delivType = document.getElementById('deliv-type');
    if (delivVal && delivType) {
        delivType.value = 'pct';
        delivVal.value = parseFloat(Number(pct).toFixed(4));
    }
    let toggle = document.getElementById('fixed-inst-toggle');
    if (toggle) toggle.checked = true;
    let scopeEl = document.getElementById('fixed-inst-scope');
    if (scopeEl) scopeEl.value = 'all';
    ['dp1', 'dp2', 'addl'].forEach(id => {
        let el = document.getElementById(id + '-val');
        let typeEl = document.getElementById(id + '-type');
        if (el) el.value = '';
        if (typeEl) typeEl.value = 'pct';
    });
    window.globalTableOverrides = {};
    calculate();
};

window.applyRecDP2 = function(pct) {
    let dp2Val = document.getElementById('dp2-val');
    let dp2Type = document.getElementById('dp2-type');
    if (dp2Val && dp2Type) {
        dp2Type.value = 'pct';
        dp2Val.value = parseFloat(Number(pct).toFixed(4));
    }
    let toggle = document.getElementById('fixed-inst-toggle');
    if (toggle) toggle.checked = true;
    let scopeEl = document.getElementById('fixed-inst-scope');
    if (scopeEl) scopeEl.value = 'all';
    ['dp1', 'addl', 'deliv'].forEach(id => {
        let el = document.getElementById(id + '-val');
        let typeEl = document.getElementById(id + '-type');
        if (el) el.value = '';
        if (typeEl) typeEl.value = 'pct';
    });
    window.globalTableOverrides = {};
    calculate();
};

window.applyRecPreOnly = function() {
    let toggle = document.getElementById('fixed-inst-toggle');
    if (toggle) toggle.checked = true;
    let scopeEl = document.getElementById('fixed-inst-scope');
    if (scopeEl) scopeEl.value = 'pre';
    window.onFixedScopeChange();
    ['dp1', 'dp2', 'addl', 'deliv'].forEach(id => {
        let el = document.getElementById(id + '-val');
        let typeEl = document.getElementById(id + '-type');
        if (el) el.value = '';
        if (typeEl) typeEl.value = 'pct';
    });
    window.globalTableOverrides = {};
    calculate();
};

window.applyFixedVal = function(v) {
    let valEl = document.getElementById('fixed-inst-val');
    if (valEl) valEl.value = v;
    calculate();
};

window.onPaymentFrequencyChange = function() {
    let freqMonths = parseInt(document.getElementById('payment-frequency')?.value) === 2 ? 6 : 3;
    let intraToggle = document.getElementById('toggle-intra-year');
    let intraBadge = document.getElementById('intra-year-status-badge');
    let wrapper = document.getElementById('intra-year-controls-wrapper');
    let intraBox = intraToggle ? intraToggle.closest('.custom-controls') : null;
    
    if (freqMonths === 6) {
        if (intraToggle) {
            intraToggle.disabled = true;
            intraToggle.checked = false;
        }
        if (wrapper) wrapper.style.display = 'none';
        if (intraBadge) {
            intraBadge.innerText = 'غير متاح (الأقساط النصف سنوية متساوية)';
            intraBadge.style.color = 'var(--text-muted)';
        }
        if (intraBox) intraBox.style.opacity = '0.6';
    } else {
        if (intraToggle) intraToggle.disabled = false;
        if (intraBox) intraBox.style.opacity = '1';
        if (intraToggle && intraToggle.checked) {
            if (wrapper) wrapper.style.display = 'block';
            if (intraBadge) {
                intraBadge.innerText = 'مفعّل';
                intraBadge.style.color = 'var(--accent-blue)';
            }
        } else {
            if (wrapper) wrapper.style.display = 'none';
            if (intraBadge) {
                intraBadge.innerText = 'غير مفعّل';
                intraBadge.style.color = 'var(--text-muted)';
            }
        }
    }
    window.globalTableOverrides = {};
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
    
    if (!g || !g.active || !isToggled || g.freqMonths === 6) {
        box.style.display = 'none';
        if (badge) {
            if (g && g.freqMonths === 6) {
                badge.innerText = 'غير متاح (الأقساط متساوية)';
                badge.style.color = 'var(--text-muted)';
            } else if (!isToggled) {
                badge.innerText = 'غير مفعّل';
                badge.style.color = 'var(--text-muted)';
            }
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
    let flexToggle = document.getElementById('flexible-toggle');
    if (flexToggle) flexToggle.value = (currentProject === 'Zomra') ? 'yes' : 'no';
    
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
    
    let manualDiscEl = document.getElementById('manual-discount-val');
    if (manualDiscEl) manualDiscEl.value = '';
    let manualInfoEl = document.getElementById('manual-discount-info');
    if (manualInfoEl) {
        manualInfoEl.style.display = 'none';
        manualInfoEl.innerHTML = '';
    }
    let firstInstDateEl = document.getElementById('first-inst-date');
    if (firstInstDateEl) firstInstDateEl.value = '';
    window.globalTableOverrides = {};
    window.meltState = {};
    
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

function getFlexiblePvFactor(diffDays) {
    if (diffDays <= 0) return 1.0;
    let r;
    if (diffDays < 54) r = (discountRates[0] !== undefined ? discountRates[0] : 19) / 100;
    else if (diffDays < 419) r = (discountRates[1] !== undefined ? discountRates[1] : 18) / 100;
    else if (diffDays < 784) r = (discountRates[2] !== undefined ? discountRates[2] : 15) / 100;
    else if (diffDays < 1149) r = (discountRates[3] !== undefined ? discountRates[3] : 13) / 100;
    else if (diffDays < 1879) r = (discountRates[4] !== undefined ? discountRates[4] : 10) / 100;
    else r = (discountRates[6] !== undefined ? discountRates[6] : 9) / 100;
    return 1.0 / Math.pow(1.0 + r / 365.0, diffDays);
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
        0: (discountRates[1] !== undefined ? discountRates[1] : 18) / 100,
        1: (discountRates[2] !== undefined ? discountRates[2] : 15) / 100,
        2: (discountRates[3] !== undefined ? discountRates[3] : 13) / 100,
        3: (discountRates[4] !== undefined ? discountRates[4] : 10) / 100,
        4: (discountRates[5] !== undefined ? discountRates[5] : 10) / 100,
        5: (discountRates[6] !== undefined ? discountRates[6] : 9) / 100,
        6: (discountRates[7] !== undefined ? discountRates[7] : 9) / 100,
        7: (discountRates[8] !== undefined ? discountRates[8] : 9) / 100,
        8: (discountRates[9] !== undefined ? discountRates[9] : 9) / 100,
        9: (discountRates[10] !== undefined ? discountRates[10] : 9) / 100,
        10: (discountRates[11] !== undefined ? discountRates[11] : 9) / 100
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
        let pmt = Math.max(0, Math.round(months / 3));
        f.period = pmt;

        let rate;
        if (pmt === 0 || f.id === 'dp1' || f.id === 'dp2') {
            rate = (discountRates[0] !== undefined ? discountRates[0] : 19) / 100;
        } else if (pmt <= 3) {
            rate = (discountRates[1] !== undefined ? discountRates[1] : 18) / 100;
        } else if (pmt <= 7) {
            rate = (discountRates[2] !== undefined ? discountRates[2] : 15) / 100;
        } else if (pmt <= 11) {
            rate = (discountRates[3] !== undefined ? discountRates[3] : 13) / 100;
        } else if (pmt <= 19) {
            rate = (discountRates[4] !== undefined ? discountRates[4] : 10) / 100;
        } else {
            rate = (discountRates[6] !== undefined ? discountRates[6] : 9) / 100;
        }
        
        // Zomra October 2026 Update: Payments in 2026 for normal mode get 19%
        if (!isFlexible && pmt <= 3 && pDate.getFullYear() === 2026) {
            rate = (discountRates[0] !== undefined ? discountRates[0] : 19) / 100;
        }
        
        if (isFlexible) {
            let baseDate = new Date('2025-12-29T00:00:00');
            let diffDays = Math.round((pDate - baseDate) / (1000 * 60 * 60 * 24));
            let r;
            if (diffDays < 54) r = (discountRates[0] !== undefined ? discountRates[0] : 19) / 100;
            else if (diffDays < 419) r = (discountRates[1] !== undefined ? discountRates[1] : 18) / 100;
            else if (diffDays < 784) r = (discountRates[2] !== undefined ? discountRates[2] : 15) / 100;
            else if (diffDays < 1150) r = (discountRates[3] !== undefined ? discountRates[3] : 13) / 100;
            else if (diffDays < 1880) r = (discountRates[4] !== undefined ? discountRates[4] : 10) / 100;
            else r = (discountRates[6] !== undefined ? discountRates[6] : 9) / 100;
            f.rate = r;
            f.pvFactor = 1.0 / Math.pow(1.0 + r / 365.0, diffDays);
            f.pv = (f.amount || 0) * f.pvFactor;
        } else {
            f.rate = rate;
            if (f.id === 'dp1' || f.id === 'dp2') {
                f.rate = 0;
                f.period = 0;
                f.pvFactor = 1;
                f.pv = f.amount || 0;
            } else if (f.id === 'addl') {
                f.period = 2;
                f.pvFactor = 1 / Math.pow(1 + rate / 4, 2);
                f.pv = (f.amount || 0) * f.pvFactor;
            } else {
                f.pvFactor = 1 / Math.pow(1 + rate / 4, pmt);
                f.pv = (f.amount || 0) * f.pvFactor;
            }
        }
    } else if (currentProject === 'Perla') {
        if (f.isMnt) {
            f.rate = 0;
            f.period = 0;
            f.pvFactor = 1;
            f.pv = f.amount || 0;
            return;
        }
        
        let pmt = Math.max(0, Math.round(months / 3));
        f.period = pmt;
        
        if (isFlexible) {
            let baseDate = new Date('2026-08-01T00:00:00');
            let diffDays = Math.round((pDate - baseDate) / (1000 * 60 * 60 * 24));
            let r;
            if (diffDays < 54) r = (discountRates[0] !== undefined ? discountRates[0] : 19) / 100;
            else if (diffDays < 419) r = (discountRates[1] !== undefined ? discountRates[1] : 18) / 100;
            else if (diffDays < 784) r = (discountRates[2] !== undefined ? discountRates[2] : 15) / 100;
            else if (diffDays < 1150) r = (discountRates[3] !== undefined ? discountRates[3] : 13) / 100;
            else if (diffDays < 1880) r = (discountRates[4] !== undefined ? discountRates[4] : 10) / 100;
            else r = (discountRates[6] !== undefined ? discountRates[6] : 9) / 100;
            f.rate = r;
            f.pvFactor = 1.0 / Math.pow(1.0 + r / 365.0, diffDays);
            f.pv = (f.amount || 0) * f.pvFactor;
        } else {
            if (f.id === 'dp1') {
                f.rate = 0;
                f.period = 0;
                f.pvFactor = 1;
                f.pv = f.amount || 0;
            } else {
                if (pmt <= 1 || f.id === 'dp2') {
                    f.rate = (discountRates[0] !== undefined ? discountRates[0] : 19) / 100;
                } else if (pmt <= 5) {
                    f.rate = (discountRates[1] !== undefined ? discountRates[1] : 18) / 100;
                } else if (pmt <= 9) {
                    f.rate = (discountRates[2] !== undefined ? discountRates[2] : 15) / 100;
                } else if (pmt <= 13) {
                    f.rate = (discountRates[3] !== undefined ? discountRates[3] : 13) / 100;
                } else if (pmt <= 21) {
                    f.rate = (discountRates[4] !== undefined ? discountRates[4] : 10) / 100;
                } else {
                    f.rate = (discountRates[6] !== undefined ? discountRates[6] : 9) / 100;
                }
                f.pvFactor = 1 / Math.pow(1 + f.rate / 4, f.period);
                f.pv = (f.amount || 0) * f.pvFactor;
            }
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
            let v = parseFloat(el.value);
            if (!isNaN(v) && v >= 0) {
                if (!typeEl || typeEl.value === 'pct') {
                    return v / 100;
                } else if (typeEl.value === 'amt') {
                    let p = basePriceCache || 5000000;
                    return p > 0 ? (v / p) : def;
                }
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
        
        let startMonth = (freqMonths === 6) ? 7 : 4;
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
        
        let numInst = overrideInstCount !== null ? overrideInstCount : (freqMonths === 6 ? (years * 2) : (years * 4 - 1));
        
        let startMonth = (freqMonths === 6) ? 9 : 6;
        let firstDate = customFirstDateStr ? new Date(customFirstDateStr) : null;
        let diffMonths = firstDate ? Math.round((firstDate - cDate) / (1000 * 60 * 60 * 24 * 30.44)) : startMonth;
        if (diffMonths < 0) diffMonths = startMonth;
        
        for (let i = 0; i < numInst; i++) {
            let m = diffMonths + i * freqMonths;
            let dStr = customFirstDateStr ? formatDate(addMonths(customFirstDateStr, i * freqMonths)) : formatDate(addMonths(contractDateStr, m));
            flows.push({ id: 'inst_' + i, label: 'Installment ' + (i+1), date: dStr, months: m, isInst: true });
        }
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
                let delivPct = template.find(t => t.id === 'deliv')?.defaultPct || 0.05;
                if (f.mergedIds.includes('deliv')) m_amt += deliv !== null ? deliv : price * delivPct;
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
            actualPrePct = nTotal > 0 ? remPct * (nPre / nTotal) : 0;
            actualPostPct = nTotal > 0 ? remPct * (nPost / nTotal) : 0;
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
        } else if (distMode === 'back') {
            actualPrePct = Math.min(remPct, basePrePct);
            actualPostPct = remPct - actualPrePct;
        } else {
            // Default (auto & equal): All installments are 100% equal across all periods (matching Excel sheets)
            actualPrePct = nTotal > 0 ? remPct * (nPre / nTotal) : 0;
            actualPostPct = nTotal > 0 ? remPct * (nPost / nTotal) : 0;
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
    
    // Semi-Annual installments (freqMonths === 6) are strictly equal regular payments; intra-year shift is quarterly only
    let hasIntraYearShift = (freqMonths !== 6) && isIntraYearActive && !isNaN(intraValRaw) && intraValRaw > 0;
    
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
                    if (freqMonths === 6) {
                        isBumpInst = (instIndex % instsPerYear === instsPerYear - 1);
                    } else {
                        isBumpInst = (f.months % 12 === 0 && f.months > 0);
                    }
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
            let pct = validTotal > 0 ? ((f.amount || 0) / validTotal) : 0;
            f.exactPct = pct;
            let pctVal = pct * 100;
            if (Math.abs(pctVal - Math.round(pctVal)) < 1e-4) {
                f.displayPct = Math.round(pctVal).toString();
            } else if (Math.abs(pctVal - (Math.round(pctVal * 100) / 100)) < 1e-4) {
                f.displayPct = (Math.round(pctVal * 100) / 100).toFixed(2);
            } else if (Math.abs(pctVal - (Math.round(pctVal * 1000) / 1000)) < 1e-4) {
                f.displayPct = (Math.round(pctVal * 1000) / 1000).toFixed(3);
            } else if (Math.abs(pctVal - (Math.round(pctVal * 10000) / 10000)) < 1e-4) {
                f.displayPct = (Math.round(pctVal * 10000) / 10000).toFixed(4);
            } else {
                f.displayPct = parseFloat(pctVal.toFixed(5)).toString();
            }
        } else {
            f.exactPct = 0.04;
            f.displayPct = '4';
        }
    });
    return flows;
}

function updatePreDeliveryTracker(flows, elementId) {
    if (!flows || !Array.isArray(flows)) return 0;
    let delivMonth = currentProject === 'Zomra' ? 37 : 48; // Zomra delivery is month 37
    let totAmt = flows.filter(f => !f.isMnt).reduce((s, f) => s + (f.amount || 0), 0);
    let preAmt = 0;
    flows.forEach(f => {
        if (!f.isMnt && f.months <= delivMonth) {
            preAmt += (f.amount || 0);
        }
    });
    let pct = totAmt > 0 ? (preAmt / totAmt * 100) : 0;
    let el = document.getElementById(elementId);
    if (el) el.innerText = pct.toFixed(2) + '%';
    return pct;
}

// --- Financial Approval & Risk Assessment Functions ---
window.approvalBenchmarkMode = '8y';

function getProjectBenchmarks() {
    if (currentProject === 'Zomra') {
        return {
            y8: 46.88,
            y10: 40.50,
            delivMonth: 37,
            fixedDP: 15.0
        };
    } else { // Perla
        return {
            y8: 53.55,
            y10: 44.62,
            delivMonth: 48,
            fixedDP: 10.0
        };
    }
}

window.setApprovalBenchmark = function(mode) {
    window.approvalBenchmarkMode = mode;
    ['8y', '10y', 'auto'].forEach(m => {
        let btn = document.getElementById('bench-btn-' + m);
        if (btn) {
            if (m === mode) {
                btn.classList.add('active');
                btn.style.background = 'var(--accent-blue)';
                btn.style.color = 'white';
                btn.style.borderColor = 'var(--accent-blue)';
                btn.style.fontWeight = 'bold';
            } else {
                btn.classList.remove('active');
                btn.style.background = 'transparent';
                btn.style.color = 'var(--text)';
                btn.style.borderColor = 'var(--border)';
                btn.style.fontWeight = 'normal';
            }
        }
    });
    calculate();
};

function getActiveBenchmark(benchmarks) {
    let mode = window.approvalBenchmarkMode || '8y';
    if (mode === '8y') {
        return { pct: benchmarks.y8, label: 'سياسة 8 سنوات الطبيعية' };
    }
    if (mode === '10y') {
        return { pct: benchmarks.y10, label: 'سياسة 10 سنوات الطبيعية' };
    }
    let yrs = parseInt(document.getElementById('duration-years')?.value) || 8;
    let autoPct = benchmarks.y8;
    if (yrs === 8) autoPct = benchmarks.y8;
    else if (yrs === 10) autoPct = benchmarks.y10;
    else {
        if (currentProject === 'Zomra') {
            autoPct = 15.0 + (255.0 / yrs);
        } else {
            let totalInst = (yrs * 12 - 6) / 3 + 1;
            autoPct = 10.0 + (15 * (90.0 / totalInst));
        }
    }
    return { pct: autoPct, label: `طبيعي مدة الخطة (${yrs} سنوات)` };
}

function updateBenchmarkButtonLabels() {
    let benchmarks = getProjectBenchmarks();
    let b8 = document.getElementById('bench-btn-8y');
    let b10 = document.getElementById('bench-btn-10y');
    let bAuto = document.getElementById('bench-btn-auto');
    let mode = window.approvalBenchmarkMode || '8y';

    if (b8) {
        b8.innerText = (mode === '8y' ? '🔘 ' : '⚪ ') + `سياسة 8 سنوات (${benchmarks.y8.toFixed(2)}%)`;
    }
    if (b10) {
        b10.innerText = (mode === '10y' ? '🔘 ' : '⚪ ') + `سياسة 10 سنوات (${benchmarks.y10.toFixed(2)}%)`;
    }
    if (bAuto) {
        let yrs = parseInt(document.getElementById('duration-years')?.value) || 8;
        bAuto.innerText = (mode === 'auto' ? '🔘 ' : '⚪ ') + `حسب مدة الخطة (${yrs} سنوات)`;
    }
}

window.toggleApprovalAudit = function() {
    let el = document.getElementById('approval-audit-details');
    if (!el) return;
    if (el.style.display === 'none' || !el.style.display) {
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
};

window.autoFixPreDeliveryApproval = function(targetPct) {
    let benchmarks = getProjectBenchmarks();
    if (!targetPct) {
        let active = getActiveBenchmark(benchmarks);
        targetPct = active.pct;
    }
    
    let fixedDP = benchmarks.fixedDP;
    let pool = 100.0 - fixedDP;
    let reqPre = Math.max(0, targetPct - fixedDP);
    let reqPost = Math.max(0, pool - reqPre);

    if (!window.globalDistState) window.globalDistState = {};
    window.globalDistState.mode = 'custom';
    window.globalDistState.typedPrePct = reqPre;
    window.globalDistState.typedPostPct = reqPost;

    let modeSelect = document.getElementById('dist-mode-select');
    let preInput = document.getElementById('pre-deliv-inst-pct');
    let postInput = document.getElementById('post-deliv-inst-pct');

    if (modeSelect) modeSelect.value = 'custom';
    if (preInput) preInput.value = reqPre.toFixed(2);
    if (postInput) postInput.value = reqPost.toFixed(2);

    calculate();
};

function renderApprovalStatus(price, offerPreDelivPct) {
    let card = document.getElementById('approval-status-card');
    let badgeContainer = document.getElementById('approval-badge-container');
    let auditBox = document.getElementById('approval-audit-details');
    let miniBadge = document.getElementById('offer-pre-deliv-approval-badge');
    if (!card || !badgeContainer) return;

    updateBenchmarkButtonLabels();

    let benchmarks = getProjectBenchmarks();
    let activeBenchmark = getActiveBenchmark(benchmarks);
    let targetPct = activeBenchmark.pct;
    let label = activeBenchmark.label;
    
    let diff = offerPreDelivPct - targetPct;
    let isApproved = diff >= -0.05; // floating point tolerance

    let unitPrice = price || basePriceCache || 0;
    let deficitAmt = Math.abs(diff) * unitPrice / 100;

    // Mini badge in summary box
    if (miniBadge) {
        if (isApproved) {
            miniBadge.style.background = 'rgba(39, 174, 96, 0.2)';
            miniBadge.style.color = '#2ecc71';
            miniBadge.style.border = '1px solid #27ae60';
            miniBadge.innerHTML = 'معتمد ✅';
        } else {
            miniBadge.style.background = 'rgba(231, 76, 60, 0.2)';
            miniBadge.style.color = '#e74c3c';
            miniBadge.style.border = '1px solid #e74c3c';
            miniBadge.innerHTML = 'غير معتمد ❌';
        }
    }

    if (isApproved) {
        card.style.background = 'rgba(46, 204, 113, 0.06)';
        card.style.border = '1.5px solid #2ecc71';
        
        badgeContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <span style="background: #27ae60; color: white; padding: 5px 14px; border-radius: 20px; font-weight: bold; font-size: 0.92rem; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 5px rgba(39,174,96,0.3);">
                        ✅ APPROVED / معتمد
                    </span>
                    <span style="font-size: 0.9rem; color: #2ecc71; font-weight: bold;">
                        خطة سداد معتمدة: المحصل قبل الاستلام (${offerPreDelivPct.toFixed(2)}%) مستوفٍ لمعيار ${label} (${targetPct.toFixed(2)}%).
                    </span>
                </div>
                <button type="button" onclick="toggleApprovalAudit()" style="background: transparent; border: 1px solid #2ecc71; color: #2ecc71; font-size: 0.8rem; padding: 4px 10px; border-radius: 4px; cursor: pointer;">
                    🔍 تفاصيل السياسة الائتمانية
                </button>
            </div>
            <div style="margin-top: 6px; font-size: 0.83rem; color: var(--text-muted);">
                الفارق الإيجابي: <strong style="color: #2ecc71;">+${Math.max(0, diff).toFixed(2)}%</strong> عن الحد الأدنى المطلوب (${targetPct.toFixed(2)}%).
            </div>
        `;
    } else {
        card.style.background = 'rgba(231, 76, 60, 0.08)';
        card.style.border = '1.5px solid #e74c3c';

        let severity = (offerPreDelivPct < benchmarks.y10 - 0.05) ? 'حرج' : 'متوسط';
        let approvalEntity = (severity === 'حرج') 
            ? 'مجلس الإدارة / الرئيس التنفيذي (CFO / CEO)' 
            : 'رئيس قطاع المبيعات (Sales Director)';

        badgeContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <button type="button" onclick="toggleApprovalAudit()" style="background: #e74c3c; color: white; border: none; padding: 5px 14px; border-radius: 20px; font-weight: bold; font-size: 0.92rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(231,76,60,0.35);">
                        ❌ NOT APPROVED / غير معتمد (استثناء)
                    </button>
                    <span style="font-size: 0.92rem; color: #e74c3c; font-weight: bold;">
                        عجز بالتحصيل: -${Math.abs(diff).toFixed(2)}% (${formatCurr(deficitAmt)})
                    </span>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <button type="button" onclick="autoFixPreDeliveryApproval(${targetPct})" style="background: #e67e22; color: white; border: none; font-size: 0.82rem; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(230,126,34,0.3);">
                        ⚡ رفع التحصيل للاعتماد (${targetPct.toFixed(2)}%)
                    </button>
                    <button type="button" onclick="toggleApprovalAudit()" style="background: transparent; border: 1px solid #e74c3c; color: #e74c3c; font-size: 0.8rem; padding: 4px 10px; border-radius: 4px; cursor: pointer;">
                        ⚠️ تقرير الاستثناء
                    </button>
                </div>
            </div>
            <div style="margin-top: 6px; font-size: 0.83rem; color: #f87171; line-height: 1.4;">
                ⚠️ <strong>تنبيه ائتماني:</strong> المحصل قبل الاستلام (<strong>${offerPreDelivPct.toFixed(2)}%</strong>) أقل من النسبة الطبيعية المعتمدة لـ${label} (<strong>${targetPct.toFixed(2)}%</strong>). مطلوب اعتماد: <span style="text-decoration: underline; font-weight: bold; color: white;">${approvalEntity}</span>.
            </div>
        `;
    }

    if (auditBox) {
        let is8yMet = (offerPreDelivPct >= benchmarks.y8 - 0.05);
        let is10yMet = (offerPreDelivPct >= benchmarks.y10 - 0.05);
        
        auditBox.style.background = 'rgba(0,0,0,0.25)';
        auditBox.style.border = '1px solid var(--border)';
        auditBox.innerHTML = `
            <div style="font-weight: bold; color: var(--gold); margin-bottom: 8px; font-size: 0.9rem; display: flex; justify-content: space-between;">
                <span>📋 تفاصيل معايير التحصيل والاعتماد المالي (${currentProject})</span>
                <span style="font-size: 0.8rem; color: var(--text-muted); cursor: pointer;" onclick="toggleApprovalAudit()">✖ إغلاق</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-bottom: 8px;">
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <th style="text-align: right; padding: 4px; color: var(--text-muted);">المعيار</th>
                    <th style="text-align: center; padding: 4px; color: var(--text-muted);">النسبة المطلوبة</th>
                    <th style="text-align: center; padding: 4px; color: var(--text-muted);">المحصل الفعلي</th>
                    <th style="text-align: center; padding: 4px; color: var(--text-muted);">الفارق</th>
                    <th style="text-align: center; padding: 4px; color: var(--text-muted);">الحالة</th>
                </tr>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 4px; font-weight: bold;">سياسة الـ 8 سنوات (القياسية)</td>
                    <td style="padding: 4px; text-align: center;">${benchmarks.y8.toFixed(2)}%</td>
                    <td style="padding: 4px; text-align: center;">${offerPreDelivPct.toFixed(2)}%</td>
                    <td style="padding: 4px; text-align: center; color: ${is8yMet ? '#2ecc71' : '#e74c3c'}; font-weight: bold;">${(offerPreDelivPct - benchmarks.y8) >= 0 ? '+' : ''}${(offerPreDelivPct - benchmarks.y8).toFixed(2)}%</td>
                    <td style="padding: 4px; text-align: center;">${is8yMet ? '<span style="color:#2ecc71; font-weight:bold;">✅ مستوفٍ</span>' : '<span style="color:#e74c3c; font-weight:bold;">❌ غير مستوفٍ</span>'}</td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 4px; font-weight: bold;">سياسة الـ 10 سنوات (الحد الأدنى)</td>
                    <td style="padding: 4px; text-align: center;">${benchmarks.y10.toFixed(2)}%</td>
                    <td style="padding: 4px; text-align: center;">${offerPreDelivPct.toFixed(2)}%</td>
                    <td style="padding: 4px; text-align: center; color: ${is10yMet ? '#2ecc71' : '#e74c3c'}; font-weight: bold;">${(offerPreDelivPct - benchmarks.y10) >= 0 ? '+' : ''}${(offerPreDelivPct - benchmarks.y10).toFixed(2)}%</td>
                    <td style="padding: 4px; text-align: center;">${is10yMet ? '<span style="color:#2ecc71; font-weight:bold;">✅ مستوفٍ</span>' : '<span style="color:#e74c3c; font-weight:bold;">❌ غير مستوفٍ</span>'}</td>
                </tr>
            </table>
            <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
                📌 <strong>صلاحيات الاعتماد والاستثناء:</strong><br>
                • إذا كان المحصل أقل من ${benchmarks.y10.toFixed(2)}%: يتطلب اعتماد استثنائي من رئيس مجلس الإدارة / الرئيس التنفيذي.<br>
                • إذا كان المحصل بين ${benchmarks.y10.toFixed(2)}% و ${benchmarks.y8.toFixed(2)}%: يتطلب اعتماد رئيس قطاع المبيعات CCO.<br>
                • إذا كان المحصل ≥ ${benchmarks.y8.toFixed(2)}%: معتمد تلقائياً بدون حاجة لأي موافقات خاصة.
            </div>
        `;
    }
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

// --- Melt Milestone Payments Functions ---
window.meltState = window.meltState || {};

function getMilestoneDefs() {
    if (currentProject === 'Zomra') {
        return [
            { id: 'deliv', label: 'دفعة الاستلام (Delivery Payment)', defaultPct: 5.0, month: 37 },
            { id: 'addl', label: 'دفعة الـ 6 شهور (6-Months Payment)', defaultPct: 5.0, month: 6 },
            { id: 'dp2', label: 'الدفعة الثانية (2nd Payment)', defaultPct: 2.5, month: 1 }
        ];
    } else { // Perla
        return [
            { id: 'dp2', label: 'الدفعة الثانية (2nd Payment)', defaultPct: 5.0, month: 3 }
        ];
    }
}

function renderMeltControls() {
    let container = document.getElementById('melt-controls-container');
    if (!container) return;
    
    let milestones = getMilestoneDefs();
    let html = '';
    
    milestones.forEach(m => {
        let activeScope = window.meltState ? window.meltState[m.id] : null;
        let isPre = activeScope === 'pre';
        let isAll = activeScope === 'all';
        let isMelted = isPre || isAll;
        
        let badgeStyle = isMelted 
            ? (isPre ? 'background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid #38bdf8;' : 'background: rgba(251, 191, 36, 0.2); color: #fbbf24; border: 1px solid #fbbf24;')
            : 'background: rgba(255, 255, 255, 0.08); color: var(--text-muted); border: 1px solid var(--border);';
        let badgeText = isPre ? '🌊 مسيّحة قبل الاستلام' : (isAll ? '🔄 مسيّحة على كل الأقساط' : `قائمة (${m.defaultPct}%)`);
        
        let preBtnStyle = isPre 
            ? 'background: var(--accent-blue); color: white; border-color: var(--accent-blue); font-weight: bold;' 
            : 'border-color: rgba(56, 189, 248, 0.4); color: var(--accent-blue);';
        let allBtnStyle = isAll 
            ? 'background: var(--gold); color: black; border-color: var(--gold); font-weight: bold;' 
            : 'border-color: rgba(251, 191, 36, 0.4); color: var(--gold);';
        let restoreStyle = isMelted 
            ? 'border-color: #ef4444; color: #ef4444;' 
            : 'display: none;';
            
        html += `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border); flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: bold; font-size: 0.88rem; color: var(--text);">${m.label}</span>
                <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; ${badgeStyle}">${badgeText}</span>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                <button type="button" class="btn btn-outline" id="melt-btn-${m.id}-pre" onclick="applyMelt('${m.id}', 'pre')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px; cursor: pointer; ${preBtnStyle}">
                    🌊 قبل الاستلام فقط
                </button>
                <button type="button" class="btn btn-outline" id="melt-btn-${m.id}-all" onclick="applyMelt('${m.id}', 'all')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px; cursor: pointer; ${allBtnStyle}">
                    🔄 على كل الأقساط بالتساوي
                </button>
                <button type="button" class="btn btn-outline" id="melt-btn-${m.id}-restore" onclick="restoreMelt('${m.id}')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px; cursor: pointer; ${restoreStyle}">
                    ↩️ استعادة الدفعة
                </button>
            </div>
        </div>
        `;
    });
    
    container.innerHTML = html;
}

window.applyMelt = function(milestoneId, targetScope) {
    if (!window.meltState) window.meltState = {};
    window.meltState[milestoneId] = targetScope;
    
    let el = document.getElementById(milestoneId + '-val');
    let typeEl = document.getElementById(milestoneId + '-type');
    if (el) el.value = '0';
    if (typeEl) typeEl.value = 'pct';
    
    recalcMeltDistribution();
};

window.restoreMelt = function(milestoneId) {
    if (window.meltState) {
        delete window.meltState[milestoneId];
    }
    let el = document.getElementById(milestoneId + '-val');
    if (el) el.value = '';
    
    recalcMeltDistribution();
};

window.resetMeltPayments = function() {
    window.meltState = {};
    ['dp1', 'dp2', 'addl', 'deliv'].forEach(id => {
        let el = document.getElementById(id + '-val');
        if (el && el.value === '0') el.value = '';
    });
    resetDistPresetInternal();
    calculate();
};

function recalcMeltDistribution() {
    let years = parseInt(document.getElementById('duration-years')?.value) || 8;
    let freqMonths = parseInt(document.getElementById('payment-frequency')?.value) === 2 ? 6 : 3;
    let delivMonth = currentProject === 'Zomra' ? 37 : 48;
    
    let tpl = generateFlowsTemplate(formatDate(new Date()), years, freqMonths, false);
    let dynamicInsts = tpl.filter(f => (f.isInst || f.isMerged));
    let nPre = dynamicInsts.filter(f => f.months <= delivMonth).length;
    let nPost = dynamicInsts.filter(f => f.months > delivMonth).length;
    let nTotal = nPre + nPost;
    
    let standardMilestonesPct = (currentProject === 'Zomra') ? 15.0 : 10.0;
    let standardBaselinePool = 100.0 - standardMilestonesPct;
    let basePrePct = nTotal > 0 ? standardBaselinePool * (nPre / nTotal) : 0;
    let basePostPct = nTotal > 0 ? standardBaselinePool * (nPost / nTotal) : 0;
    
    let getPct = (id, def) => {
        let el = document.getElementById(id + '-val');
        if (el && el.value !== '') {
            let v = parseFloat(el.value);
            return isNaN(v) ? def : v;
        }
        return def;
    };
    
    let currentFixedPct = 0;
    if (currentProject === 'Zomra') {
        currentFixedPct += getPct('dp1', 2.5);
        currentFixedPct += getPct('dp2', 2.5);
        currentFixedPct += getPct('addl', 5.0);
        currentFixedPct += getPct('deliv', 5.0);
    } else {
        currentFixedPct += getPct('dp1', 5.0);
        currentFixedPct += getPct('dp2', 5.0);
    }
    
    let remPct = Math.max(0, 100.0 - currentFixedPct);
    
    let meltedPrePct = 0;
    let meltedAllPct = 0;
    let hasAnyMelt = false;
    
    if (window.meltState) {
        for (let [mId, scope] of Object.entries(window.meltState)) {
            let defVal = (mId === 'dp1' || mId === 'dp2') ? (currentProject === 'Zomra' ? 2.5 : 5.0) : 5.0;
            hasAnyMelt = true;
            if (scope === 'pre') {
                meltedPrePct += defVal;
            } else if (scope === 'all') {
                meltedAllPct += defVal;
            }
        }
    }
    
    if (!hasAnyMelt) {
        resetDistPresetInternal();
        calculate();
        return;
    }
    
    let targetPrePct = basePrePct;
    let targetPostPct = basePostPct;
    
    if (meltedPrePct > 0 && meltedAllPct === 0) {
        targetPostPct = basePostPct;
        targetPrePct = remPct - targetPostPct;
    } else if (meltedAllPct > 0 && meltedPrePct === 0) {
        targetPrePct = nTotal > 0 ? remPct * (nPre / nTotal) : 0;
        targetPostPct = nTotal > 0 ? remPct * (nPost / nTotal) : 0;
    } else if (meltedPrePct > 0 && meltedAllPct > 0) {
        let poolForRest = remPct - meltedPrePct;
        let restPre = nTotal > 0 ? poolForRest * (nPre / nTotal) : 0;
        targetPrePct = restPre + meltedPrePct;
        targetPostPct = nTotal > 0 ? poolForRest * (nPost / nTotal) : 0;
    }
    
    if (!window.globalDistState) window.globalDistState = {};
    window.globalDistState.mode = 'custom';
    window.globalDistState.typedPrePct = targetPrePct;
    window.globalDistState.typedPostPct = targetPostPct;
    
    let preInput = document.getElementById('pre-deliv-inst-pct');
    let postInput = document.getElementById('post-deliv-inst-pct');
    if (preInput) preInput.value = targetPrePct.toFixed(2);
    if (postInput) postInput.value = targetPostPct.toFixed(2);
    
    calculate();
}

function renderMeltImpactSummary(flows) {
    let summaryBox = document.getElementById('melt-impact-summary');
    if (!summaryBox) return;
    
    let hasMelt = window.meltState && Object.keys(window.meltState).length > 0;
    if (!hasMelt) {
        summaryBox.style.display = 'none';
        summaryBox.innerHTML = '';
        return;
    }
    
    let delivMonth = currentProject === 'Zomra' ? 37 : 48;
    let preInsts = (flows || []).filter(f => (f.isInst || f.isMerged) && !f.isMnt && f.months <= delivMonth);
    let postInsts = (flows || []).filter(f => (f.isInst || f.isMerged) && !f.isMnt && f.months > delivMonth);
    
    let preAmt = preInsts.length > 0 ? preInsts[0].amount : 0;
    let postAmt = postInsts.length > 0 ? postInsts[0].amount : 0;
    let prePct = preInsts.length > 0 ? preInsts[0].displayPct : 0;
    let postPct = postInsts.length > 0 ? postInsts[0].displayPct : 0;
    
    let listItems = [];
    let milestoneDefs = getMilestoneDefs();
    for (let [mId, scope] of Object.entries(window.meltState)) {
        let mDef = milestoneDefs.find(m => m.id === mId);
        let mName = mDef ? mDef.label : mId;
        let scopeName = scope === 'pre' 
            ? '<strong style="color:var(--accent-blue);">أقساط ما قبل الاستلام فقط (للحفاظ على نسبة التحصيل والاعتماد)</strong>' 
            : '<strong style="color:var(--gold);">جميع الأقساط بالتساوي على مدار المدة</strong>';
        listItems.push(`• تم تسييح <strong>${mName}</strong> على ${scopeName}.`);
    }
    
    summaryBox.style.display = 'block';
    summaryBox.innerHTML = `
        <div style="color: var(--text); font-weight: bold; margin-bottom: 4px;">
            💡 أثر تسييح الدفعات على قيمة الأقساط:
        </div>
        <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 6px;">
            ${listItems.join('<br>')}
        </div>
        <div style="display: flex; gap: 15px; flex-wrap: wrap; font-size: 0.85rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">
            <span style="color: var(--accent-blue);">قسط ما قبل الاستلام: <strong>${formatCurr(preAmt)}</strong> (${prePct}%) [عدد: ${preInsts.length}]</span>
            <span style="color: var(--gold);">قسط ما بعد الاستلام: <strong>${formatCurr(postAmt)}</strong> (${postPct}%) [عدد: ${postInsts.length}]</span>
        </div>
    `;
}

function renderFixedGuidanceBox(g) {
    let counterpartEl = document.getElementById('fixed-inst-counterpart-info');
    let guidanceBox = document.getElementById('fixed-inst-guidance-box');
    
    if (!g || !g.hasFixedInst) {
        if (counterpartEl) counterpartEl.style.display = 'none';
        if (guidanceBox) guidanceBox.style.display = 'none';
        return;
    }
    
    let basePrice = basePriceCache || 5000000;
    let price = g.price || basePrice;
    let currentYears = parseInt(document.getElementById('duration-years').value) || 8;
    let contractDateStr = document.getElementById('contract-date').value || new Date();
    let freqMonths = parseInt(document.getElementById('payment-frequency').value) === 2 ? 6 : 3;
    let targetPv = basePvCache || (basePrice * 0.712);
    
    let isZomra = (currentProject === 'Zomra');
    let delivMonth = isZomra ? 37 : 48;
    let instPoolPct = isZomra ? 0.85 : 0.90;
    let nTotal = g.nTotal || (currentYears * (12 / freqMonths));
    let naturalInst = nTotal > 0 ? (basePrice * instPoolPct) / nTotal : 0;
    
    // Generate standard template for current plan to get exact milestone PV factors
    let tpl = generateFlowsTemplate(contractDateStr, currentYears, freqMonths, false);
    
    let dp1Flow = tpl.find(f => f.id === 'dp1');
    let dp2Flow = tpl.find(f => f.id === 'dp2');
    let addlFlow = isZomra ? tpl.find(f => f.id === 'addl') : null;
    let delivFlow = isZomra ? tpl.find(f => f.id === 'deliv' || (f.mergedIds && f.mergedIds.includes('deliv'))) : null;
    
    let getDf = (f) => {
        if (!f) return 1.0;
        let tempF = { date: f.date, months: f.months, amount: 1, id: f.id };
        applyDiscountLogic(tempF, contractDateStr);
        return tempF.pv || 1.0;
    };
    
    let dfDp1 = 1.0;
    let dfDp2 = getDf(dp2Flow);
    let dfAddl = addlFlow ? getDf(addlFlow) : 0;
    let dfDeliv = delivFlow ? getDf(delivFlow) : 0;
    
    let instFlows = tpl.filter(f => (f.isInst || f.isMerged) && !f.isFixedOverride);
    let preInsts = instFlows.filter(f => f.months <= delivMonth);
    let postInsts = instFlows.filter(f => f.months > delivMonth);
    
    let sumPreDf = preInsts.reduce((sum, f) => sum + getDf(f), 0);
    let sumPostDf = postInsts.reduce((sum, f) => sum + getDf(f), 0);
    let sumAllInstDf = sumPreDf + sumPostDf;
    
    // 1. Counterpart Info
    if (counterpartEl) {
        counterpartEl.style.display = 'block';
        if (g.scope === 'pre') {
            let monthlyPost = (g.instAmtPost || 0) / freqMonths;
            counterpartEl.innerHTML = `
                <div style="color: var(--accent-blue); font-weight: bold; font-size: 0.9rem;">
                    ➡️ الأقساط بعد الاستلام (محسوبة بالـ NPV بالتساوي): 
                    <span style="color: #fff;">${formatCurr(g.instAmtPost)}</span> 
                    <span style="color: #2ecc71; font-size: 0.82rem; margin-right: 4px;">(💡 يعادل ${formatCurr(monthlyPost)} / شهر)</span>
                    (${g.actualPostPct.toFixed(2)}% إجمالي / ${(g.nPost > 0 ? g.actualPostPct / g.nPost : 0).toFixed(2)}% لكل قسط) 
                    | عدد: ${g.nPost} قسطاً
                </div>`;
        } else if (g.scope === 'post') {
            let monthlyPre = (g.instAmtPre || 0) / freqMonths;
            counterpartEl.innerHTML = `
                <div style="color: var(--accent-blue); font-weight: bold; font-size: 0.9rem;">
                    ➡️ الأقساط قبل الاستلام (محسوبة بالـ NPV بالتساوي): 
                    <span style="color: #fff;">${formatCurr(g.instAmtPre)}</span> 
                    <span style="color: #2ecc71; font-size: 0.82rem; margin-right: 4px;">(💡 يعادل ${formatCurr(monthlyPre)} / شهر)</span>
                    (${g.actualPrePct.toFixed(2)}% إجمالي / ${(g.nPre > 0 ? g.actualPrePct / g.nPre : 0).toFixed(2)}% لكل قسط) 
                    | عدد: ${g.nPre} قسطاً
                </div>`;
        } else {
            let totalInst = nTotal * g.fixedAmt;
            let monthlyAll = (g.fixedAmt || 0) / freqMonths;
            counterpartEl.innerHTML = `
                <div style="color: var(--gold); font-weight: bold; font-size: 0.9rem;">
                    ➡️ إجمالي الأقساط على ${currentYears} سنوات (${nTotal} قسطاً): 
                    <span style="color: #fff;">${formatCurr(totalInst)}</span> 
                    <span style="color: #2ecc71; font-size: 0.82rem; margin-right: 4px;">(💡 يعادل ${formatCurr(monthlyAll)} / شهر)</span>
                    (${(price > 0 ? (totalInst / price) * 100 : 0).toFixed(2)}% من السعر)
                </div>`;
        }
    }
    
    // 2. Feasibility & Actionable Guidance
    if (guidanceBox) {
        guidanceBox.style.display = 'block';
        
        let fixedInst = g.fixedAmt;
        let totalFixedInst = nTotal * fixedInst;
        let pvFixedInsts = fixedInst * sumAllInstDf;
        
        let currentOfferPv = globalCustomFlows.filter(f => !f.isMnt).reduce((sum, f) => sum + (f.pv || 0), 0);
        let pvDeficit = targetPv - currentOfferPv;
        
        // Check if balanced
        let isBalanced = Math.abs(currentOfferPv - targetPv) < 1500 || Math.abs(fixedInst - naturalInst) < 50;
        
        if (isBalanced) {
            guidanceBox.style.background = 'rgba(46, 204, 113, 0.1)';
            guidanceBox.style.border = '1px solid rgba(46, 204, 113, 0.3)';
            guidanceBox.innerHTML = `
                <div style="color: #2ecc71; font-weight: bold;">
                    ✅ الخطة متطابقة تماماً بنسبة 100% مع شيت الإكسيل (القيمة الحالية NPV متطابقة مع السعر الأصلي).
                </div>
            `;
            return;
        }
        
        // Calculate the 4 exact NPV solutions
        // Solution 1: Natural Duration (Years) Matching
        let bestYear = null;
        let bestYearPrice = 0;
        let bestYearInst = 0;
        let bestYearDiffPct = 0;
        let bestGap = Infinity;
        
        for (let y = 3; y <= 12; y++) {
            if (y === currentYears) continue;
            let tplY = generateFlowsTemplate(contractDateStr, y, freqMonths, false);
            let pY = solveForPrice(targetPv, tplY);
            let nY = tplY.filter(f => (f.isInst || f.isMerged) && !f.isFixedOverride).length;
            let instY = (pY * instPoolPct) / nY;
            let gap = Math.abs(instY - fixedInst);
            if (gap < bestGap) {
                bestGap = gap;
                bestYear = y;
                bestYearPrice = pY;
                bestYearInst = instY;
                bestYearDiffPct = ((pY - basePrice) / basePrice) * 100;
            }
        }
        
        // Solution 2: Exact Down Payment 1 via NPV preserving other milestone percentages
        let W_dp1, P_dp1, neededDp1Amt, dp1PctOfPrice, dpPriceDiffPct;
        if (isZomra) {
            let S_std_dp1 = 0.025 + 0.05 + 0.05; // 0.125
            let W_std_dp1 = 0.025 * dfDp2 + 0.05 * dfAddl + 0.05 * dfDeliv;
            W_dp1 = (1 - S_std_dp1) + W_std_dp1;
            P_dp1 = (targetPv + totalFixedInst - pvFixedInsts) / W_dp1;
            neededDp1Amt = (1 - S_std_dp1) * P_dp1 - totalFixedInst;
            dp1PctOfPrice = P_dp1 > 0 ? (neededDp1Amt / P_dp1) * 100 : 0;
            dpPriceDiffPct = ((P_dp1 - basePrice) / basePrice) * 100;
        } else {
            let W_std_dp1 = 0.05 * dfDp2;
            W_dp1 = 0.95 + W_std_dp1;
            P_dp1 = (targetPv + totalFixedInst - pvFixedInsts) / W_dp1;
            neededDp1Amt = 0.95 * P_dp1 - totalFixedInst;
            dp1PctOfPrice = P_dp1 > 0 ? (neededDp1Amt / P_dp1) * 100 : 0;
            dpPriceDiffPct = ((P_dp1 - basePrice) / basePrice) * 100;
        }
        
        // Solution 3: Exact Delivery Payment (Zomra) or DP2 (Perla) via NPV
        let sol3Desc, sol3BtnText, sol3ClickAction;
        if (isZomra) {
            let S_nonDeliv = 0.10; // DP1 2.5% + DP2 2.5% + Addl 5%
            let W_nonDeliv = 0.025 * dfDp1 + 0.025 * dfDp2 + 0.05 * dfAddl;
            let W_deliv = W_nonDeliv + (1 - S_nonDeliv) * dfDeliv;
            P_deliv = (targetPv + totalFixedInst * dfDeliv - pvFixedInsts) / W_deliv;
            let neededDelivAmt = (1 - S_nonDeliv) * P_deliv - totalFixedInst;
            let delivPctOfPrice = P_deliv > 0 ? (neededDelivAmt / P_deliv) * 100 : 0;
            let delivPriceDiffPct = ((P_deliv - basePrice) / basePrice) * 100;
            
            let displayDelivPct = (Math.abs(delivPctOfPrice - Math.round(delivPctOfPrice * 100) / 100) < 0.005) ? (Math.round(delivPctOfPrice * 100) / 100).toFixed(2) : delivPctOfPrice.toFixed(4);
            sol3BtnText = `تحميل ${displayDelivPct}% على الاستلام`;
            sol3Desc = `📦 <strong>تحميل على الاستلام:</strong> سداد <strong>${displayDelivPct}%</strong> (${formatNum(Math.round(neededDelivAmt))} ج.م) عند الاستلام لتثبيت القسط عند ${formatNum(fixedInst)} ج.م بسعر ${formatNum(Math.round(P_deliv))} ج.م (${delivPriceDiffPct >= 0 ? '+' : ''}${delivPriceDiffPct.toFixed(2)}%).`;
            sol3ClickAction = `applyRecDeliv(${delivPctOfPrice.toFixed(4)})`;
        } else {
            let W_dp2 = 0.05 * dfDp1 + 0.95 * dfDp2;
            let P_dp2 = (targetPv + totalFixedInst * dfDp2 - pvFixedInsts) / W_dp2;
            let neededDp2Amt = 0.95 * P_dp2 - totalFixedInst;
            let dp2PctOfPrice = P_dp2 > 0 ? (neededDp2Amt / P_dp2) * 100 : 0;
            let dp2PriceDiffPct = ((P_dp2 - basePrice) / basePrice) * 100;
            
            let displayDp2Pct = (Math.abs(dp2PctOfPrice - Math.round(dp2PctOfPrice * 100) / 100) < 0.005) ? (Math.round(dp2PctOfPrice * 100) / 100).toFixed(2) : dp2PctOfPrice.toFixed(4);
            sol3BtnText = `تعديل الدفعة 2 إلى ${displayDp2Pct}%`;
            sol3Desc = `💰 <strong>تعديل الدفعة الثانية:</strong> سداد <strong>${displayDp2Pct}%</strong> (${formatNum(Math.round(neededDp2Amt))} ج.م) بعد 3 شهور لتثبيت القسط عند ${formatNum(fixedInst)} ج.م بسعر ${formatNum(Math.round(P_dp2))} ج.م (${dp2PriceDiffPct >= 0 ? '+' : ''}${dp2PriceDiffPct.toFixed(2)}%).`;
            sol3ClickAction = `applyRecDP2(${dp2PctOfPrice.toFixed(4)})`;
        }
        
        // Solution 4: Exact Pre-Delivery Only via NPV
        let W_ms = isZomra ? (0.025 + 0.025 * dfDp2 + 0.05 * dfAddl + 0.05 * dfDeliv) : (0.05 + 0.05 * dfDp2);
        let instPool = isZomra ? 0.85 : 0.90;
        let nPreCount = preInsts.length;
        let nPostCount = postInsts.length;
        let W_post = nPostCount > 0 ? (instPool / nPostCount) * sumPostDf : 0;
        let P_pre = (nPostCount > 0 && (W_ms + W_post) > 0)
            ? (targetPv - (fixedInst * sumPreDf) + ((nPreCount * fixedInst) / nPostCount) * sumPostDf) / (W_ms + W_post)
            : basePrice;
        let solvedPostInst = nPostCount > 0 ? (instPool * P_pre - nPreCount * fixedInst) / nPostCount : 0;
        let prePriceDiffPct = ((P_pre - basePrice) / basePrice) * 100;
        
        let isDeficit = pvDeficit > 0;
        guidanceBox.style.background = isDeficit ? 'rgba(243, 156, 18, 0.15)' : 'rgba(52, 152, 219, 0.15)';
        guidanceBox.style.border = isDeficit ? '1px solid #f39c12' : '1px solid #3498db';
        
        let headerText = isDeficit 
            ? `⚠️ تنبيه: القسط (${formatCurr(fixedInst)}) أقل من القسط الطبيعي (${formatCurr(naturalInst)}). لمطابقة شيت الإكسيل (NPV) بنسبة 100%، اختر أحد الحلول الآتية:`
            : `ℹ️ ملاحظة: القسط (${formatCurr(fixedInst)}) أكبر من القسط الطبيعي (${formatCurr(naturalInst)}). لمطابقة شيت الإكسيل (NPV) بنسبة 100%، اختر أحد الحلول الآتية:`;
            
        let yearsBtnText = `تطبيق ${bestYear} سنوات`;
        let yearsDesc = `🗓️ <strong>تعديل السنين (${bestYear} سنوات):</strong> القسط في الإكسيل يصبح <strong>${formatNum(Math.round(bestYearInst))} ج.م</strong> بسعر إجمالي ${formatNum(Math.round(bestYearPrice))} ج.م (${bestYearDiffPct >= 0 ? '+' : ''}${bestYearDiffPct.toFixed(2)}%).`;
        
        let displayDp1Pct = (Math.abs(dp1PctOfPrice - Math.round(dp1PctOfPrice * 100) / 100) < 0.005) ? (Math.round(dp1PctOfPrice * 100) / 100).toFixed(2) : dp1PctOfPrice.toFixed(4);
        let dpBtnText = `تطبيق مقدم ${displayDp1Pct}%`;
        let dpDesc = `💰 <strong>تعديل المقدم:</strong> سداد مقدم <strong>${displayDp1Pct}%</strong> (${formatNum(Math.round(neededDp1Amt))} ج.م) لتثبيت القسط عند ${formatNum(fixedInst)} ج.م بسعر ${formatNum(Math.round(P_dp1))} ج.م (${dpPriceDiffPct >= 0 ? '+' : ''}${dpPriceDiffPct.toFixed(2)}%).`;
        
        let preBtnText = `تثبيت قبل الاستلام فقط`;
        let preDesc = `⚖️ <strong>تثبيت قبل الاستلام فقط:</strong> دفع <strong>${formatNum(fixedInst)} ج.م</strong> قبل الاستلام، ويكون قسط ما بعد الاستلام <strong>${formatNum(Math.round(solvedPostInst))} ج.م</strong> بسعر ${formatNum(Math.round(P_pre))} ج.م (${prePriceDiffPct >= 0 ? '+' : ''}${prePriceDiffPct.toFixed(2)}%).`;

        guidanceBox.innerHTML = `
            <div style="color: ${isDeficit ? '#f39c12' : '#3498db'}; font-weight: bold; margin-bottom: 8px;">
                ${headerText}
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${bestYear ? `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 8px 10px; border-radius: 4px;">
                    <span>${yearsDesc}</span>
                    <button class="btn btn-primary" onclick="applyRecYears(${bestYear})" style="padding: 4px 10px; font-size: 0.8rem; white-space: nowrap;">${yearsBtnText}</button>
                </div>` : ''}
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 8px 10px; border-radius: 4px;">
                    <span>${dpDesc}</span>
                    <button class="btn btn-primary" onclick="applyRecDP(${dp1PctOfPrice.toFixed(4)})" style="padding: 4px 10px; font-size: 0.8rem; background: #217346; border-color: #217346; white-space: nowrap;">${dpBtnText}</button>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 8px 10px; border-radius: 4px;">
                    <span>${sol3Desc}</span>
                    <button class="btn btn-primary" onclick="${sol3ClickAction}" style="padding: 4px 10px; font-size: 0.8rem; background: var(--accent-blue); border-color: var(--accent-blue); white-space: nowrap;">${sol3BtnText}</button>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 8px 10px; border-radius: 4px;">
                    <span>${preDesc}</span>
                    <button class="btn btn-outline" onclick="applyRecPreOnly()" style="padding: 4px 10px; font-size: 0.8rem; border-color: var(--gold); color: #fff; white-space: nowrap;">${preBtnText}</button>
                </div>
            </div>
        `;
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
        let displayDpNeeded = (Math.abs(dpNeededPct - Math.round(dpNeededPct * 100) / 100) < 0.005) ? (Math.round(dpNeededPct * 100) / 100).toFixed(2) : dpNeededPct.toFixed(4);
        dpActionHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 4px; margin-bottom: 6px;">
                <span>💰 <strong>تعديل المقدم:</strong> دفع مقدم <strong>${displayDpNeeded}%</strong> (${formatNum(Math.round(dpNeededAmt))} ج.م) للوصول للسعر المستهدف بالمليم على نفس السنين.</span>
                <button class="btn btn-primary" onclick="applyTargetDP(${dpNeededPct.toFixed(4)})" style="padding: 3px 8px; font-size: 0.78rem; background: #217346; border-color: #217346;">تطبيق مقدم ${displayDpNeeded}%</button>
            </div>
        `;
    }

    // 3. Exact Pre-Delivery Installment Solver on Current Plan
    let tplCurrent = generateFlowsTemplate(contractDateStr, currentYears, freqMonths, false);
    let delivMonth = currentProject === 'Zomra' ? 37 : 48;
    let dynInsts = tplCurrent.filter(f => (f.isInst || f.isMerged) && !f.isFixedOverride);
    let preCount = dynInsts.filter(f => f.months <= delivMonth).length;
    let postCount = dynInsts.filter(f => f.months > delivMonth).length;
    
    let instActionHtml = '';
    if (preCount > 0 && postCount > 0) {
        let fixedPv = 0;
        let totalMilestonesPct = 0;
        tplCurrent.forEach(f => {
            if (f.isDP || f.id === 'deliv') {
                totalMilestonesPct += (f.defaultPct || 0);
                let tempF = { date: f.date, months: f.months, amount: targetPrice * (f.defaultPct || 0), id: f.id };
                applyDiscountLogic(tempF, contractDateStr);
                fixedPv += (tempF.pv || 0);
            } else if (f.isMerged) {
                let dPct = 0.05;
                totalMilestonesPct += dPct;
                let tempF = { date: f.date, months: f.months, amount: targetPrice * dPct, id: 'deliv' };
                applyDiscountLogic(tempF, contractDateStr);
                fixedPv += (tempF.pv || 0);
            }
        });
        
        let remCash = targetPrice * (1.0 - totalMilestonesPct);
        let sumPreF = 0;
        let sumPostF = 0;
        dynInsts.forEach(f => {
            let tempF = { date: f.date, months: f.months, amount: 1, id: f.id };
            applyDiscountLogic(tempF, contractDateStr);
            if (f.months <= delivMonth) sumPreF += (tempF.pv || 0);
            else sumPostF += (tempF.pv || 0);
        });
        
        let coeff = sumPreF - (preCount / postCount) * sumPostF;
        if (Math.abs(coeff) > 1e-6) {
            let neededPv = targetPv - fixedPv - (remCash / postCount) * sumPostF;
            let solvedPreAmt = neededPv / coeff;
            let solvedPostAmt = (remCash - preCount * solvedPreAmt) / postCount;
            
            if (solvedPreAmt > 0 && solvedPostAmt > 0) {
                let solvedPrePct = (solvedPreAmt / targetPrice) * 100;
                let solvedPostPct = (solvedPostAmt / targetPrice) * 100;
                instActionHtml = `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 4px;">
                        <span>⚡ <strong>أقساط ما قبل الاستلام:</strong> قسط <strong>${formatNum(solvedPreAmt)} ج.م</strong> (${solvedPrePct.toFixed(2)}%) قبل الاستلام، و <strong>${formatNum(solvedPostAmt)} ج.م</strong> (${solvedPostPct.toFixed(2)}%) بعد الاستلام.</span>
                        <button class="btn btn-outline" onclick="applyTargetPreInst(${Math.round(solvedPreAmt)})" style="padding: 3px 8px; font-size: 0.78rem; border-color: var(--gold); color: #fff;">تطبيق قسط ${formatNum(solvedPreAmt)}</button>
                    </div>
                `;
            }
        }
    }

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

window.applyTargetPreInst = function(amt) {
    let toggle = document.getElementById('fixed-inst-toggle');
    if (toggle) toggle.checked = true;
    let scopeEl = document.getElementById('fixed-inst-scope');
    if (scopeEl) scopeEl.value = 'pre';
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
        globalBaseFlows = baseFlows;
        window.globalBaseFlows = baseFlows;
        
        let baseInstFlows = baseFlows.filter(f => (f.isInst || f.isMerged) && !f.isMnt);
        let baseInstAmt = baseInstFlows.reduce((sum, f) => sum + (f.amount || 0), 0);
        let baseMonthlyAvg = baseInstFlows.length > 0 ? (baseInstAmt / (baseInstFlows.length * baseFreq)) : 0;
        let baseMonthlyEl = document.getElementById('base-monthly-avg');
        if (baseMonthlyEl) baseMonthlyEl.innerText = formatCurr(baseMonthlyAvg) + ' / شهر';
        
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
        let hasCustomMilestones = ['dp1', 'dp2', 'addl', 'deliv'].some(id => {
            let el = document.getElementById(id + '-val');
            return el && el.value.trim() !== '';
        });

        if (hasFixedInst && fixedInstScope === 'all' && !hasCustomMilestones) {
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
            let hasCustomInputs = hasCustomMilestones;
            let isDistCustomized = window.globalDistState && (window.globalDistState.mode !== 'auto' || window.globalDistState.typedPrePct !== null || window.globalDistState.typedPostPct !== null);
            if (currentProject === 'Perla' && is7030 && freqMonths === 3 && !hasFixedInst && !hasTableOverrides && !hasCustomInputs && !isDistCustomized && years === 8) {
                bestPrice = basePriceCache * 1.00863920294539959;
            }
        }
        // Manual Discount Application
        let manualDiscEl = document.getElementById('manual-discount-val');
        let manualDiscTypeEl = document.getElementById('manual-discount-type');
        let manualDiscVal = manualDiscEl ? parseFloat(manualDiscEl.value) : NaN;
        let manualDiscType = manualDiscTypeEl ? manualDiscTypeEl.value : 'pct';
        let hasManualDiscount = !isNaN(manualDiscVal) && manualDiscVal > 0;
        
        let manualDiscAmt = 0;
        let manualDiscPct = 0;
        let finalOfferPrice = bestPrice;
        
        if (hasManualDiscount) {
            if (manualDiscType === 'pct') {
                manualDiscPct = manualDiscVal;
                manualDiscAmt = bestPrice * (manualDiscVal / 100);
            } else {
                manualDiscAmt = manualDiscVal;
                manualDiscPct = bestPrice > 0 ? (manualDiscVal / bestPrice) * 100 : 0;
            }
            finalOfferPrice = Math.max(0, bestPrice - manualDiscAmt);
        }
        
        globalCustomFlows = calculateCustomFlows(finalOfferPrice, customTemplate);
        
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
        let offerNonMntTot = globalCustomFlows.filter(f => !f.isMnt).reduce((s, f) => s + (f.amount || 0), 0);
        let offerPreAmt = 0;
        globalCustomFlows.forEach(f => {
            if (!f.isMnt && f.months <= delivMonth) {
                offerPreAmt += (f.amount || 0);
            }
        });
        offerPreDelivPct = offerNonMntTot > 0 ? (offerPreAmt / offerNonMntTot * 100) : 0;
        let offerPreDelivEl = document.getElementById('offer-pre-delivery');
        if (offerPreDelivEl) offerPreDelivEl.innerText = offerPreDelivPct.toFixed(2) + '%';
        window.lastOfferPreDelivPct = offerPreDelivPct;
        renderApprovalStatus(actualPrice, offerPreDelivPct);

        let offerInstFlows = globalCustomFlows.filter(f => (f.isInst || f.isMerged) && !f.isMnt);
        let offerInstAmt = offerInstFlows.reduce((sum, f) => sum + (f.amount || 0), 0);
        let offerMonthlyAvg = offerInstFlows.length > 0 ? (offerInstAmt / (offerInstFlows.length * freqMonths)) : 0;
        let offerMonthlyEl = document.getElementById('offer-monthly-avg');
        if (offerMonthlyEl) offerMonthlyEl.innerText = formatCurr(offerMonthlyAvg) + ' / شهر';

        updateFixedInstMonthlyHint();

        renderTable(globalCustomFlows, 'offer-tbody');
        updatePreDeliveryTracker(globalCustomFlows, 'offer-pre-delivery');
        updateDistUI(globalCustomFlows._distInfo);
        renderMeltControls();
        renderMeltImpactSummary(globalCustomFlows);
        renderFixedGuidanceBox(globalCustomFlows._fixedGuidance);
        renderIntraGuidanceBox(globalCustomFlows._intraGuidance);
        renderTargetPriceGuidance(targetPrice, actualPrice, targetPv);
        generateExportTemplate(actualPrice, offerPreDelivPct);
        
        let manualInfoEl = document.getElementById('manual-discount-info');
        if (manualInfoEl) {
            if (hasManualDiscount) {
                manualInfoEl.style.display = 'block';
                manualInfoEl.innerHTML = `✅ تم تطبيق خصم يدوي: <strong>${manualDiscPct.toFixed(2)}%</strong> (${formatCurr(manualDiscAmt)}) — السعر بعد الخصم: <strong>${formatCurr(finalOfferPrice)}</strong>`;
            } else {
                manualInfoEl.style.display = 'none';
                manualInfoEl.innerHTML = '';
            }
        }
        
        let diffEl = document.getElementById('pv-difference');
        if (diffEl) {
            let priceDiff = actualPrice - basePriceCache;
            if (basePriceCache <= 0) {
                diffEl.innerHTML = `<span style="color:var(--text-muted)">يرجى إدخال سعر الوحدة الأساسي</span>`;
            } else if (hasManualDiscount) {
                let color = actualPrice >= basePriceCache ? 'var(--success)' : 'var(--danger)';
                let netDiffPct = ((actualPrice - basePriceCache) / basePriceCache) * 100;
                diffEl.innerHTML = `
                    <div style="color:${color}; font-size: 1.15rem; font-weight: bold;">
                        السعر النهائي بعد الخصم: ${formatCurr(actualPrice)}
                    </div>
                    <div style="font-size: 0.92rem; margin-top: 5px; color: #2ecc71; font-weight: bold;">
                        🏷️ خصم يدوي: -${manualDiscPct.toFixed(2)}% (-${formatCurr(manualDiscAmt)})
                    </div>
                    <div style="font-size: 0.85rem; margin-top: 3px; color: var(--text-muted);">
                        الفارق الصافي عن السعر الأساسي: ${netDiffPct >= 0 ? '+' : ''}${netDiffPct.toFixed(2)}% (${formatCurr(Math.abs(priceDiff))})
                    </div>
                `;
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
    
    let rowFreq = (tbodyId === 'base-tbody') ? 
        (document.getElementById('base-payment-frequency')?.value === '2' ? 6 : 3) : 
        (document.getElementById('payment-frequency')?.value === '2' ? 6 : 3);

    let nonMntFlows = (flows || []).filter(f => !f.isMnt);
    nonMntFlows.forEach((cf) => {
        let idx = flows.indexOf(cf);
        let tr = document.createElement('tr');
        
        let displayPct = cf.displayPct;
        let isInstRow = cf.isInst || cf.isMerged;
        let monthlyBadgeHtml = isInstRow ? 
            `<div style="font-size: 0.72rem; color: #2ecc71; font-weight: normal; margin-top: 1px;">💡 ${formatCurr((cf.amount || 0) / rowFreq)} / شهر</div>` : '';
        
        if (tbodyId === 'base-tbody') {
            tr.innerHTML = `
                <td style="text-align:left">${cf.label}</td>
                <td>${cf.date}</td>
                <td>${displayPct}%</td>
                <td style="color:var(--accent-blue); font-weight:bold;">${formatCurr(cf.amount)}${monthlyBadgeHtml}</td>
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
                <td>
                    <input type="number" style="width:90px; color:var(--accent-blue); font-weight:bold;" class="tbl-input tbl-amt" value="${Math.round(cf.amount || 0)}" onchange="applyTableEdits()">
                    ${monthlyBadgeHtml}
                </td>
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

window.clearManualDiscount = function() {
    let el = document.getElementById('manual-discount-val');
    if (el) el.value = '';
    let info = document.getElementById('manual-discount-info');
    if (info) {
        info.style.display = 'none';
        info.innerHTML = '';
    }
    calculate();
};

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
            
            let pctChanged = Math.abs(typedPct - currentPct) > 0.005;
            let amtChanged = Math.abs(typedAmt - currentAmt) > 1;
            
            if (pctChanged) {
                window.globalTableOverrides[flowId].amount = typedPct;
                window.globalTableOverrides[flowId].isPct = true;
            } else if (amtChanged) {
                window.globalTableOverrides[flowId].amount = typedAmt;
                window.globalTableOverrides[flowId].isPct = false;
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
function buildExportPlanHtml(opts) {
    let {
        title,
        flows,
        price,
        preDelivPct,
        isBase,
        years,
        contractDateStr,
        clientName,
        unitNo
    } = opts;

    let nonMntFlows = (flows || []).filter(f => !f.isMnt);
    let mntFlows = (flows || []).filter(f => f.isMnt);
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

    let mntTotal = price * 0.08;
    let incPct = (price - basePriceCache) / basePriceCache;
    let isDiscount = incPct < 0;
    let label1 = isDiscount ? 'Discount % :' : 'Increase % :';
    let label2 = isDiscount ? 'Price After Discount :' : 'Price After Increase :';
    let displayIncPct = Math.abs(incPct);

    let benchmarks = getProjectBenchmarks();
    let activeBench = getActiveBenchmark(benchmarks);
    let isApproved = isBase ? true : ((preDelivPct || 0) >= (activeBench.pct - 0.05));
    let approvalText = isBase ? 'APPROVED (Standard Baseline)' : (isApproved ? 'APPROVED' : `NOT APPROVED (Shortfall ${(activeBench.pct - preDelivPct).toFixed(2)}%)`);
    let approvalColor = isApproved ? '#27ae60' : '#c0392b';

    let metaRows = '';
    if (clientName) {
        metaRows += `<tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding};">Client Name :</td><td colspan="3" class="export-bold" style="border-right: 1.5px solid black; padding: ${cellPadding};">${escapeHtml(clientName)}</td></tr>`;
    }
    if (unitNo) {
        metaRows += `<tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding};">Unit No :</td><td colspan="3" class="export-bold" style="border-right: 1.5px solid black; padding: ${cellPadding};">${escapeHtml(unitNo)}</td></tr>`;
    }

    let priceRows = isBase ? `
        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding};">Increase % :</td><td colspan="3" style="border-right: 1.5px solid black; padding: ${cellPadding};">0.00%</td></tr>
        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding};">Unit Price :</td><td colspan="3" class="export-bold" style="border-right: 1.5px solid black; padding: ${cellPadding};">${formatNum(price)}</td></tr>
    ` : `
        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding};">${label1}</td><td colspan="3" style="border-right: 1.5px solid black; padding: ${cellPadding};">${formatPct(displayIncPct)}</td></tr>
        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding};">${label2}</td><td colspan="3" class="export-bold" style="border-right: 1.5px solid black; padding: ${cellPadding};">${formatNum(price)}</td></tr>
    `;

    let html = `
        <colgroup>
            <col style="width: 14.5%;">
            <col style="width: 30%;">
            <col style="width: 10.5%;">
            <col style="width: 26%;">
            <col style="width: 19%;">
        </colgroup>
        <tr><th colspan="5" class="export-header-blue" style="font-size: ${titleFontSize}; border: 1.5px solid black; padding: 3px; letter-spacing: 0.3px;">${title}</th></tr>
        ${metaRows}
        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding};">Date :</td><td colspan="3" style="border-right: 1.5px solid black; padding: ${cellPadding};">${formatDateExport(contractDateStr || new Date())}</td></tr>
        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding};">Unit Base Price :</td><td colspan="3" style="border-right: 1.5px solid black; padding: ${cellPadding};">${formatNum(basePriceCache)}</td></tr>
        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding};">Maintenance (8%) :</td><td colspan="3" style="border-right: 1.5px solid black; padding: ${cellPadding};">${formatNum(mntTotal)}</td></tr>
        ${priceRows}
        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding};">Collected Till Delivery:</td><td colspan="3" style="border-right: 1.5px solid black; padding: ${cellPadding};">${(preDelivPct || 0).toFixed(2)}%</td></tr>
        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; border-bottom: 1.5px solid black; padding: ${cellPadding};">Approval Status:</td><td colspan="3" class="export-bold" style="border-right: 1.5px solid black; border-bottom: 1.5px solid black; padding: ${cellPadding}; color: ${approvalColor};">${approvalText}</td></tr>
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
        <td class="export-header-blue" style="border-bottom: 1.5px solid black; padding: ${cellPadding};">${formatNum(price)}</td>
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

    return { html, fontSize };
}

function generateExportTemplate(offerPrice, offerPreDelivPct) {
    let dateEl = document.getElementById('contract-date');
    let contractDateStr = (dateEl && dateEl.value) ? dateEl.value : formatDate(new Date());
    let years = parseInt(document.getElementById('duration-years')?.value) || 8;
    let clientName = (document.getElementById('client-name')?.value || '').trim();
    let unitNo = (document.getElementById('unit-number')?.value || '').trim();
    let isComparing = document.getElementById('compare-base-export-toggle')?.checked;

    // 1. Offer Plan Page
    let offerTitle = `NATIONS OF SKY \u2014 ${currentProject.toUpperCase()} \u2014 PAYMENT PLAN (${years} YEARS)`;
    let offerPlan = buildExportPlanHtml({
        title: offerTitle,
        flows: globalCustomFlows,
        price: offerPrice,
        preDelivPct: offerPreDelivPct,
        isBase: false,
        years: years,
        contractDateStr: contractDateStr,
        clientName: clientName,
        unitNo: unitNo
    });

    let exportTable = document.getElementById('export-table');
    if (exportTable) {
        exportTable.style.fontSize = offerPlan.fontSize;
        exportTable.style.width = '520px';
        exportTable.innerHTML = offerPlan.html;
    }

    // 2. Base Plan Page (if comparison is selected)
    let basePageEl = document.getElementById('export-base-page');
    let exportTableBase = document.getElementById('export-table-base');
    if (isComparing && globalBaseFlows && globalBaseFlows.length > 0) {
        if (basePageEl) basePageEl.style.display = 'block';
        let baseYearsEl = document.getElementById('base-duration-years');
        let baseYears = parseInt(baseYearsEl ? baseYearsEl.value : 8) || 8;
        let baseTitle = `NATIONS OF SKY \u2014 ${currentProject.toUpperCase()} \u2014 BASE PAYMENT PLAN (${baseYears} YEARS)`;
        
        let benchmarks = getProjectBenchmarks();
        let basePrePct = benchmarks['8y'] ? benchmarks['8y'].pct : (currentProject === 'Zomra' ? 46.88 : 53.55);

        let basePlan = buildExportPlanHtml({
            title: baseTitle,
            flows: globalBaseFlows,
            price: basePriceCache,
            preDelivPct: basePrePct,
            isBase: true,
            years: baseYears,
            contractDateStr: contractDateStr,
            clientName: clientName,
            unitNo: unitNo
        });

        if (exportTableBase) {
            exportTableBase.style.fontSize = basePlan.fontSize;
            exportTableBase.style.width = '520px';
            exportTableBase.innerHTML = basePlan.html;
        }
    } else {
        if (basePageEl) basePageEl.style.display = 'none';
        if (exportTableBase) exportTableBase.innerHTML = '';
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
        let clientName = (document.getElementById('client-name')?.value || '').trim();
        let unitNo = (document.getElementById('unit-number')?.value || '').trim();
        let isComparing = document.getElementById('compare-base-export-toggle')?.checked;

        let clientPart = clientName ? `_${clientName.replace(/\s+/g, '_')}` : '';
        let unitPart = unitNo ? `_Unit_${unitNo.replace(/\s+/g, '_')}` : '';
        let compPart = isComparing ? '_With_Base_Comparison' : '';
        let pdfFileName = `Payment_Plan_${projName}_${yearsVal}Y${unitPart}${clientPart}${compPart}.pdf`;

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
            pagebreak: isComparing 
                ? { mode: ['css', 'legacy'], before: '.html2pdf__page-break' } 
                : { mode: 'avoid-all' }
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

const EMBEDDED_EXCEL_TEMPLATE_B64 = "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";

async function populateTemplateWorkbook(workbook, offerPrice) {
    const ws = workbook.worksheets[0];
    let basePrice = basePriceCache || 0;
    let mntTotal = basePrice * 0.08;
    let incAmt = offerPrice - basePrice;
    let incPct = basePrice > 0 ? (incAmt / basePrice) : 0;
    let isDiscount = incPct < 0;
    let years = parseInt(document.getElementById('duration-years')?.value) || 8;
    let dateEl = document.getElementById('contract-date');
    let contractDateStr = (dateEl && dateEl.value) ? dateEl.value : formatDate(new Date());

    let projectTitle = 'NATIONS OF SKY — ' + currentProject.toUpperCase() + ' — PAYMENT PLAN (' + years + ' YEARS)';
    ws.getCell('D2').value = projectTitle;
    ws.getCell('F2').value = projectTitle;

    let clientName = (document.getElementById('client-name')?.value || '').trim();
    let unitNo = (document.getElementById('unit-number')?.value || '').trim();
    if (unitNo && clientName) {
        ws.getCell('D3').value = 'Unit / Client :';
        ws.getCell('F3').value = `${unitNo} — ${clientName}`;
        ws.getRow(3).hidden = false;
    } else if (unitNo) {
        ws.getCell('D3').value = 'Unit No :';
        ws.getCell('F3').value = unitNo;
        ws.getRow(3).hidden = false;
    } else if (clientName) {
        ws.getCell('D3').value = 'Client Name :';
        ws.getCell('F3').value = clientName;
        ws.getRow(3).hidden = false;
    } else {
        ws.getCell('D3').value = null;
        ws.getCell('F3').value = null;
        ws.getRow(3).hidden = true;
    }

    ws.getCell('F4').value = basePrice;
    ws.getCell('F4').numFmt = '#,##0.00';

    ws.getCell('F5').value = mntTotal;
    ws.getCell('F5').numFmt = '#,##0.00';

    ws.getCell('D6').value = isDiscount ? 'Discount % :' : 'Increase % :';
    ws.getCell('E6').value = isDiscount ? 'Discount % :' : 'Increase % :';
    ws.getCell('F6').value = -incPct;
    ws.getCell('F6').numFmt = '0.00%';

    ws.getCell('D7').value = isDiscount ? 'Price After Discount :' : 'Price After Increase :';
    ws.getCell('E7').value = isDiscount ? 'Price After Discount :' : 'Price After Increase :';
    ws.getCell('F7').value = offerPrice;
    ws.getCell('F7').numFmt = '#,##0.00';

    ws.getCell('G9').value = years + ' Years Payment Plan';

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

    let totalRowIdx = 54;
    for (let i = 11; i < 500; i++) {
        let r = ws.getRow(i);
        let found = false;
        for (let c = 2; c <= 9; c++) {
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

    for (let i = 11; i < totalRowIdx; i++) {
        let r = ws.getRow(i);
        [4, 5, 6, 7, 8, 9].forEach(c => r.getCell(c).value = null);
        r.hidden = false;
    }

    let rowIdx = 11;
    let excelTotalAmt = 0;
    let excelTotalPct = 0;
    let modelRow = ws.getRow(12);

    grouped.forEach(grp => {
        grp.items.forEach((item, j) => {
            let isFirst = j === 0;
            let itemPct = offerPrice > 0 ? (item.amount / offerPrice) * 100.0 : 0;
            
            if (rowIdx >= totalRowIdx) {
                ws.spliceRows(totalRowIdx, 0, []);
                totalRowIdx++;
            }

            let r = ws.getRow(rowIdx);
            if (isFirst) r.getCell(4).value = grp.name;
            r.getCell(6).value = item.label;
            r.getCell(7).value = itemPct / 100.0;
            r.getCell(7).numFmt = '0.00%';
            r.getCell(8).value = item.amount;
            r.getCell(8).numFmt = '#,##0.00';
            r.getCell(9).value = formatDateExport(item.date);

            [4, 5, 6, 7, 8, 9].forEach(c => {
                let cell = r.getCell(c);
                let mCell = modelRow.getCell(c);
                if (mCell && mCell.style) {
                    cell.style = JSON.parse(JSON.stringify(mCell.style));
                }
            });

            excelTotalAmt += item.amount;
            excelTotalPct += itemPct;
            rowIdx++;
        });
    });

    for (let i = rowIdx; i < totalRowIdx; i++) {
        ws.getRow(i).hidden = true;
    }

    let rTotal = ws.getRow(totalRowIdx);
    rTotal.getCell(7).value = excelTotalPct / 100.0;
    rTotal.getCell(7).numFmt = '0.00%';
    rTotal.getCell(8).value = excelTotalAmt;
    rTotal.getCell(8).numFmt = '#,##0.00';

    let mntRowIdx = totalRowIdx + 5;
    let excelMntSum = 0;
    let excelMntPctSum = 0;
    mnts.forEach(m => {
        let mntPct = offerPrice > 0 ? (m.amount / offerPrice) * 100.0 : 0;
        let r = ws.getRow(mntRowIdx++);
        r.getCell(6).value = m.amount;
        r.getCell(6).numFmt = '#,##0.00';
        r.getCell(7).value = formatDateExport(m.date);
        r.getCell(8).value = null;
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
}

async function exportExcel() {
    try {
        if (!globalCustomFlows || globalCustomFlows.length === 0) {
            alert('لا توجد بيانات متاحة للتصدير.');
            return;
        }

        let offerAmtText = document.getElementById('offer-total-amt') ? document.getElementById('offer-total-amt').innerText : '';
        let offerPrice = parseFloat(offerAmtText.replace(/[^0-9.-]+/g, '')) || window.lastCalculatedPrice || basePriceCache || 0;

        if (window.ExcelJS && typeof EMBEDDED_EXCEL_TEMPLATE_B64 !== 'undefined') {
            const bin = atob(EMBEDDED_EXCEL_TEMPLATE_B64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(bytes.buffer);
            await populateTemplateWorkbook(workbook, offerPrice);

            const outBuffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Payment_Plan_' + currentProject + '.xlsx';
            a.click();
            window.URL.revokeObjectURL(url);
            return;
        }

        exportExcelFallback(offerPrice);
    } catch(err) {
        console.error('Excel Export Error:', err);
        alert('حدث خطأ أثناء تصدير ملف الإكسيل.');
    }
}

function exportExcelFallback(offerPrice) {
    if (!window.XLSX) {
        alert('مكتبة تصدير الإكسيل غير متوفرة حالياً.');
        return;
    }
    let basePrice = basePriceCache || 0;
    let mntTotal = basePrice * 0.08;
    let incAmt = offerPrice - basePrice;
    let incPct = basePrice > 0 ? (incAmt / basePrice) : 0;
    let isDiscount = incPct < 0;

    let clientName = (document.getElementById('client-name')?.value || '').trim();
    let unitNo = (document.getElementById('unit-number')?.value || '').trim();
    let isComparing = document.getElementById('compare-base-export-toggle')?.checked;

    let benchmarks = getProjectBenchmarks();
    let activeBench = getActiveBenchmark(benchmarks);
    let isApproved = (window.lastOfferPreDelivPct || 0) >= (activeBench.pct - 0.05);
    let approvalText = isApproved ? 'APPROVED' : `NOT APPROVED (Shortfall ${(activeBench.pct - (window.lastOfferPreDelivPct || 0)).toFixed(2)}%)`;

    let ws_data = [
        ['Payment Plan', '', '', '', '']
    ];
    if (clientName) ws_data.push(['Client Name :', clientName, '', '', '']);
    if (unitNo) ws_data.push(['Unit No :', unitNo, '', '', '']);
    ws_data.push(
        ['Unit Base Price :', basePrice, '', '', ''],
        ['Maintenance (8%) :', mntTotal, '', '', ''],
        [isDiscount ? 'Discount Amount :' : 'Increase Amount :', Math.abs(incAmt), '', '', ''],
        [isDiscount ? 'Discount % :' : 'Increase % :', Math.abs(incPct), '', '', ''],
        [isDiscount ? 'Price After Discount :' : 'Price After Increase :', offerPrice, '', '', ''],
        ['Collected Till Delivery :', (window.lastOfferPreDelivPct || 0) / 100, '', '', ''],
        ['Approval Status :', approvalText, '', '', ''],
        ['', '', '', '', ''],
        ['Payment Terms & Types', '', 'Payment Plan', '', ''],
        ['Type', 'Description', '%', 'Amount', 'Date']
    );

    let nonMntFlows = globalCustomFlows.filter(f => !f.isMnt);
    let totalAmtSum = 0;
    let totalPctSum = 0;

    nonMntFlows.forEach(f => {
        let grpName = '';
        if (f.months <= 1 && f.isDP) grpName = 'Down Payment';
        else {
            let y = Math.ceil(f.months / 12);
            if (y < 1) y = 1;
            grpName = 'Year ' + y;
        }
        let itemPct = offerPrice > 0 ? (f.amount / offerPrice) : 0;
        let row = [
            grpName,
            f.label,
            itemPct,
            f.amount || 0,
            formatDateExport(f.date)
        ];
        ws_data.push(row);
        totalAmtSum += (f.amount || 0);
        totalPctSum += itemPct;
    });

    ws_data.push(['Total Payments:', '', totalPctSum, totalAmtSum, '']);

    let mnts = globalCustomFlows.filter(f => f.isMnt);
    if (mnts.length > 0) {
        ws_data.push(['', '', '', '', '']);
        ws_data.push(['Maintenance Schedule', '', '8% of Base Price', '', '']);
        ws_data.push(['Type', 'Description', '%', 'Amount', 'Date']);
        let mntSum = 0;
        let mntPctSum = 0;
        mnts.forEach(m => {
            let mPct = offerPrice > 0 ? (m.amount / offerPrice) : 0;
            ws_data.push(['Maintenance', m.label, mPct, m.amount || 0, formatDateExport(m.date)]);
            mntSum += (m.amount || 0);
            mntPctSum += mPct;
        });
        ws_data.push(['Total Maintenance:', '', mntPctSum, mntSum, '']);
    }

    let wb = XLSX.utils.book_new();
    let ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, isComparing ? 'Offer Plan' : 'Payment Plan');

    if (isComparing && globalBaseFlows && globalBaseFlows.length > 0) {
        let basePrePct = benchmarks['8y'] ? benchmarks['8y'].pct : (currentProject === 'Zomra' ? 46.88 : 53.55);
        let ws_data_base = [
            ['Base Payment Plan', '', '', '', '']
        ];
        if (clientName) ws_data_base.push(['Client Name :', clientName, '', '', '']);
        if (unitNo) ws_data_base.push(['Unit No :', unitNo, '', '', '']);
        ws_data_base.push(
            ['Unit Base Price :', basePrice, '', '', ''],
            ['Maintenance (8%) :', basePrice * 0.08, '', '', ''],
            ['Increase % :', 0, '', '', ''],
            ['Unit Price :', basePrice, '', '', ''],
            ['Collected Till Delivery :', basePrePct / 100, '', '', ''],
            ['Approval Status :', 'APPROVED (Standard Baseline)', '', '', ''],
            ['', '', '', '', ''],
            ['Payment Terms & Types', '', 'Base Payment Plan', '', ''],
            ['Type', 'Description', '%', 'Amount', 'Date']
        );
        let baseNonMnt = globalBaseFlows.filter(f => !f.isMnt);
        let baseTotalAmt = 0;
        let baseTotalPct = 0;
        baseNonMnt.forEach(f => {
            let grpName = '';
            if (f.months <= 1 && f.isDP) grpName = 'Down Payment';
            else {
                let y = Math.ceil(f.months / 12);
                if (y < 1) y = 1;
                grpName = 'Year ' + y;
            }
            let itemPct = basePrice > 0 ? (f.amount / basePrice) : 0;
            ws_data_base.push([
                grpName,
                f.label,
                itemPct,
                f.amount || 0,
                formatDateExport(f.date)
            ]);
            baseTotalAmt += (f.amount || 0);
            baseTotalPct += itemPct;
        });
        ws_data_base.push(['Total Payments:', '', baseTotalPct, baseTotalAmt, '']);
        let baseMnt = globalBaseFlows.filter(f => f.isMnt);
        if (baseMnt.length > 0) {
            ws_data_base.push(['', '', '', '', '']);
            ws_data_base.push(['Maintenance Schedule', '', '8% of Base Price', '', '']);
            ws_data_base.push(['Type', 'Description', '%', 'Amount', 'Date']);
            let mntSum = 0;
            let mntPctSum = 0;
            baseMnt.forEach(m => {
                let mPct = basePrice > 0 ? (m.amount / basePrice) : 0;
                ws_data_base.push(['Maintenance', m.label, mPct, m.amount || 0, formatDateExport(m.date)]);
                mntSum += (m.amount || 0);
                mntPctSum += mPct;
            });
            ws_data_base.push(['Total Maintenance:', '', mntPctSum, mntSum, '']);
        }
        let wsBase = XLSX.utils.aoa_to_sheet(ws_data_base);
        XLSX.utils.book_append_sheet(wb, wsBase, 'Base Plan');
    }

    let clientPart = clientName ? `_${clientName.replace(/\s+/g, '_')}` : '';
    let unitPart = unitNo ? `_Unit_${unitNo.replace(/\s+/g, '_')}` : '';
    let compPart = isComparing ? '_With_Base_Comparison' : '';
    XLSX.writeFile(wb, `Payment_Plan_${currentProject}${unitPart}${clientPart}${compPart}.xlsx`);
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
        
        let offerAmtText = document.getElementById('offer-total-amt')?.innerText || '';
        let offerPrice = parseFloat(offerAmtText.replace(/[^0-9.-]+/g, '')) || window.lastCalculatedPrice || basePriceCache || 0;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const buffer = e.target.result;
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                await populateTemplateWorkbook(workbook, offerPrice);

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
                alert('حدث خطأ أثناء معالجة ملف الإكسيل. يرجى التأكد من رفع شيت مطابق وصالح.');
                event.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    } catch (e) {
        console.error('Template upload file reading error:', e);
        alert('حدث خطأ أثناء قراءة ملف الإكسيل.');
        event.target.value = '';
    }
}
