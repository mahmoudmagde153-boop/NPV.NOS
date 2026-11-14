let currentProject = 'Zomra';
let typingTimer;

let discountRates = {
    0: 21, 1: 21, 2: 20, 3: 19, 4: 18, 5: 17,
    6: 16, 7: 15, 8: 14, 9: 13, 10: 12, 11: 12, 12: 12, 13: 12, 14: 12, 15: 12
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
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'EGP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0 
        }).format(Math.round(num));
    } catch(e) {
        return (Math.round(num) || 0).toLocaleString('en-US') + ' EGP';
    }
}

function formatNum(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    try {
        return new Intl.NumberFormat('en-US', { 
            maximumFractionDigits: 0,
            minimumFractionDigits: 0 
        }).format(Math.round(num));
    } catch(e) {
        return (Math.round(num) || 0).toLocaleString('en-US');
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
    if (typeof proj === 'string') {
        let pLower = proj.toLowerCase();
        if (pLower.includes('perla')) currentProject = 'Perla';
        else if (pLower.includes('orb')) currentProject = 'ORB';
        else if (pLower.includes('zomra')) currentProject = 'Zomra';
        else if (pLower.includes('jirian')) currentProject = 'Jirian';
        else currentProject = proj;
    }
    window.currentProject = currentProject;
    if (currentProject === 'Zomra') {
        discountRates = {
            0: 21, 1: 21, 2: 20, 3: 19, 4: 18, 5: 17,
            6: 16, 7: 15, 8: 14, 9: 13, 10: 12, 11: 12, 12: 12, 13: 12, 14: 12, 15: 12
        };
    } else if (currentProject === 'Perla' || currentProject === 'ORB') {
        discountRates = {
            0: 20, 1: 19, 2: 16, 3: 14, 4: 11, 5: 11,
            6: 10, 7: 10, 8: 10, 9: 10, 10: 9, 11: 9, 12: 9, 13: 9, 14: 9, 15: 9
        };
    } else {
        discountRates = {
            0: 19, 1: 18, 2: 15, 3: 13, 4: 10,
            5: 10, 6: 9, 7: 9, 8: 9, 9: 9, 10: 9, 11: 9, 12: 9, 13: 9, 14: 9, 15: 9
        };
    }
    let basePriceInput = document.getElementById('base-price');
    if (basePriceInput) {
        if (currentProject === 'ORB') {
            basePriceInput.value = '15300000';
        } else if (currentProject === 'Perla') {
            basePriceInput.value = '30631636';
        } else if (currentProject === 'Zomra') {
            basePriceInput.value = '28158648';
        } else if (currentProject === 'Jirian') {
            basePriceInput.value = '50000000';
        }
    }
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        if (b.innerText && b.innerText.toLowerCase().includes(currentProject.toLowerCase())) {
            b.classList.add('active');
        }
    });
    if (typeof event !== 'undefined' && event && event.target && event.target.classList) {
        event.target.classList.add('active');
    }
    window.meltState = {};
    resetDistPresetInternal();
    let flexToggle = document.getElementById('flexible-toggle');
    if (flexToggle && !flexToggle.value) {
        flexToggle.value = 'no';
    }
    renderBaseInputs();
    renderCustomInputs();
    calculate();
}

window.delayedCalculate = function() {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        calculate();
        if (typeof window.generateSmartOptions === 'function') {
            window.generateSmartOptions();
        }
    }, 300);
}

function applyTargetPrice() {
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
    window.meltState = {};
    calculate();
};

// Option 2: Increase years + adjust DP1 & Deliv, zero DP2 & Addl
window.applyRecYearsWithDP = function(y, dp1Pct, delivPct) {
    let yrEl = document.getElementById('duration-years');
    if (yrEl) yrEl.value = y;
    let toggle = document.getElementById('fixed-inst-toggle');
    if (toggle) toggle.checked = true;
    let scopeEl = document.getElementById('fixed-inst-scope');
    if (scopeEl) scopeEl.value = 'all';
    
    let dp1Val = document.getElementById('dp1-val');
    let dp1Type = document.getElementById('dp1-type');
    if (dp1Val && dp1Type) {
        dp1Type.value = 'pct';
        dp1Val.value = parseFloat(Number(dp1Pct).toFixed(8));
    }
    let dp2Val = document.getElementById('dp2-val');
    if (dp2Val) dp2Val.value = '0';
    let addlVal = document.getElementById('addl-val');
    if (addlVal) addlVal.value = '0';
    
    let delivVal = document.getElementById('deliv-val');
    let delivType = document.getElementById('deliv-type');
    if (delivVal && delivType) {
        delivType.value = 'pct';
        delivVal.value = parseFloat(Number(delivPct).toFixed(8));
    }
    
    window.globalTableOverrides = {};
    window.meltState = {};
    calculate();
};

// Option 2 (Perla): Increase years + zero DP2 (0%) + increase DP1 (0% Deliv, 0% Addl)
window.applyRecYearsWithDP_Perla = function(y, dp1Pct) {
    let yrEl = document.getElementById('duration-years');
    if (yrEl) yrEl.value = Math.min(10, y);
    let toggle = document.getElementById('fixed-inst-toggle');
    if (toggle) toggle.checked = true;
    let scopeEl = document.getElementById('fixed-inst-scope');
    if (scopeEl) scopeEl.value = 'all';
    
    let dp1Val = document.getElementById('dp1-val');
    let dp1Type = document.getElementById('dp1-type');
    if (dp1Val && dp1Type) {
        dp1Type.value = 'pct';
        dp1Val.value = parseFloat(Number(dp1Pct).toFixed(8));
    }
    let dp2Val = document.getElementById('dp2-val');
    if (dp2Val) dp2Val.value = '0';
    ['addl', 'deliv'].forEach(id => {
        let el = document.getElementById(id + '-val');
        if (el) el.value = '';
    });
    
    window.globalTableOverrides = {};
    window.meltState = {};
    calculate();
};

// Option 3 (Perla): Increase years + keep DP2 (5%) + increase DP1
window.applyRecYears_KeepDP2_Perla = function(y, dp1Pct) {
    let yrEl = document.getElementById('duration-years');
    if (yrEl) yrEl.value = Math.min(10, y);
    let toggle = document.getElementById('fixed-inst-toggle');
    if (toggle) toggle.checked = true;
    let scopeEl = document.getElementById('fixed-inst-scope');
    if (scopeEl) scopeEl.value = 'all';
    
    let dp1Val = document.getElementById('dp1-val');
    let dp1Type = document.getElementById('dp1-type');
    if (dp1Val && dp1Type) {
        dp1Type.value = 'pct';
        dp1Val.value = parseFloat(Number(dp1Pct).toFixed(8));
    }
    let dp2Val = document.getElementById('dp2-val');
    if (dp2Val) dp2Val.value = '5';
    ['addl', 'deliv'].forEach(id => {
        let el = document.getElementById(id + '-val');
        if (el) el.value = '';
    });
    
    window.globalTableOverrides = {};
    window.meltState = {};
    calculate();
};

// Option 4 (Perla): Current years + zero DP2 (0%) + increase DP1
window.applyRecDP_ZeroDP2_Perla = function(dp1Pct) {
    let toggle = document.getElementById('fixed-inst-toggle');
    if (toggle) toggle.checked = true;
    let scopeEl = document.getElementById('fixed-inst-scope');
    if (scopeEl) scopeEl.value = 'all';
    
    let dp1Val = document.getElementById('dp1-val');
    let dp1Type = document.getElementById('dp1-type');
    if (dp1Val && dp1Type) {
        dp1Type.value = 'pct';
        dp1Val.value = parseFloat(Number(dp1Pct).toFixed(8));
    }
    let dp2Val = document.getElementById('dp2-val');
    if (dp2Val) dp2Val.value = '0';
    ['addl', 'deliv'].forEach(id => {
        let el = document.getElementById(id + '-val');
        if (el) el.value = '';
    });
    
    window.globalTableOverrides = {};
    window.meltState = {};
    calculate();
};

// Option 5 (Perla): Current years + keep DP2 (5%) + increase DP1
window.applyRecDP_KeepDP2_Perla = function(dp1Pct) {
    let toggle = document.getElementById('fixed-inst-toggle');
    if (toggle) toggle.checked = true;
    let scopeEl = document.getElementById('fixed-inst-scope');
    if (scopeEl) scopeEl.value = 'all';
    
    let dp1Val = document.getElementById('dp1-val');
    let dp1Type = document.getElementById('dp1-type');
    if (dp1Val && dp1Type) {
        dp1Type.value = 'pct';
        dp1Val.value = parseFloat(Number(dp1Pct).toFixed(8));
    }
    let dp2Val = document.getElementById('dp2-val');
    if (dp2Val) dp2Val.value = '5';
    ['addl', 'deliv'].forEach(id => {
        let el = document.getElementById(id + '-val');
        if (el) el.value = '';
    });
    
    window.globalTableOverrides = {};
    window.meltState = {};
    calculate();
};

// Option 3: Increase DP1 only, zero DP2 (0%) & Addl (0%), keep Delivery (5%)
window.applyRecDP_KeepDeliv = function(dp1Pct, delivPct) {
    let toggle = document.getElementById('fixed-inst-toggle');
    if (toggle) toggle.checked = true;
    let scopeEl = document.getElementById('fixed-inst-scope');
    if (scopeEl) scopeEl.value = 'all';
    
    let dp1Val = document.getElementById('dp1-val');
    let dp1Type = document.getElementById('dp1-type');
    if (dp1Val && dp1Type) {
        dp1Type.value = 'pct';
        dp1Val.value = parseFloat(Number(dp1Pct).toFixed(8));
    }
    let dp2Val = document.getElementById('dp2-val');
    if (dp2Val) dp2Val.value = '0';
    let addlVal = document.getElementById('addl-val');
    if (addlVal) addlVal.value = '0';
    
    let delivVal = document.getElementById('deliv-val');
    let delivType = document.getElementById('deliv-type');
    if (delivVal && delivType) {
        delivType.value = 'pct';
        delivVal.value = parseFloat(Number(delivPct || 5.0).toFixed(4));
    }
    
    window.globalTableOverrides = {};
    window.meltState = {};
    calculate();
};

// Option 4: Keep all standard milestones (DP1 2.5%, DP2 2.5%, Addl 5%), increase Delivery
window.applyRecDeliv_AllMilestones = function(delivPct) {
    let toggle = document.getElementById('fixed-inst-toggle');
    if (toggle) toggle.checked = true;
    let scopeEl = document.getElementById('fixed-inst-scope');
    if (scopeEl) scopeEl.value = 'all';
    
    let isZomra = (currentProject === 'Zomra');
    let dp1Val = document.getElementById('dp1-val');
    let dp1Type = document.getElementById('dp1-type');
    if (dp1Val && dp1Type) {
        dp1Type.value = 'pct';
        dp1Val.value = isZomra ? '2.5' : '5';
    }
    let dp2Val = document.getElementById('dp2-val');
    let dp2Type = document.getElementById('dp2-type');
    if (dp2Val && dp2Type) {
        dp2Type.value = 'pct';
        dp2Val.value = isZomra ? '2.5' : '5';
    }
    let addlVal = document.getElementById('addl-val');
    let addlType = document.getElementById('addl-type');
    if (addlVal && addlType) {
        addlType.value = 'pct';
        addlVal.value = isZomra ? '5' : '0';
    }
    
    let delivVal = document.getElementById('deliv-val');
    let delivType = document.getElementById('deliv-type');
    if (delivVal && delivType) {
        delivType.value = 'pct';
        delivVal.value = parseFloat(Number(delivPct).toFixed(8));
    }
    
    window.globalTableOverrides = {};
    window.meltState = {};
    calculate();
};

// Option 5: Keep DP1 (2.5%), zero DP2 (0%) & Addl (0%), increase Delivery
window.applyRecDeliv_ZeroMilestones = function(delivPct, dp1Pct) {
    let toggle = document.getElementById('fixed-inst-toggle');
    if (toggle) toggle.checked = true;
    let scopeEl = document.getElementById('fixed-inst-scope');
    if (scopeEl) scopeEl.value = 'all';
    
    let isZomra = (currentProject === 'Zomra');
    let dp1Val = document.getElementById('dp1-val');
    let dp1Type = document.getElementById('dp1-type');
    if (dp1Val && dp1Type) {
        dp1Type.value = 'pct';
        dp1Val.value = parseFloat(Number(dp1Pct || (isZomra ? 2.5 : 5.0)).toFixed(4));
    }
    let dp2Val = document.getElementById('dp2-val');
    if (dp2Val) dp2Val.value = '0';
    let addlVal = document.getElementById('addl-val');
    if (addlVal) addlVal.value = '0';
    
    let delivVal = document.getElementById('deliv-val');
    let delivType = document.getElementById('deliv-type');
    if (delivVal && delivType) {
        delivType.value = 'pct';
        delivVal.value = parseFloat(Number(delivPct).toFixed(8));
    }
    
    window.globalTableOverrides = {};
    window.meltState = {};
    calculate();
};

// Option 6: Increase DP1, zero ALL milestones including Delivery
window.applyRecDP_ZeroAll = function(dp1Pct) {
    let toggle = document.getElementById('fixed-inst-toggle');
    if (toggle) toggle.checked = true;
    let scopeEl = document.getElementById('fixed-inst-scope');
    if (scopeEl) scopeEl.value = 'all';
    
    let dp1Val = document.getElementById('dp1-val');
    let dp1Type = document.getElementById('dp1-type');
    if (dp1Val && dp1Type) {
        dp1Type.value = 'pct';
        dp1Val.value = parseFloat(Number(dp1Pct).toFixed(8));
    }
    ['dp2', 'addl', 'deliv'].forEach(id => {
        let el = document.getElementById(id + '-val');
        let typeEl = document.getElementById(id + '-type');
        if (el) el.value = '0';
        if (typeEl) typeEl.value = 'pct';
    });
    
    window.globalTableOverrides = {};
    window.meltState = {};
    calculate();
};

// Backward compatible aliases
window.applyRecDP = window.applyRecDP_ZeroAll;
window.applyRecDeliv = window.applyRecDeliv_AllMilestones;
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
    window.meltState = {};
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
    window.meltState = {};
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
    let customCont = document.getElementById('intra-custom-years-container');
    if (customCont) customCont.style.display = 'none';
    calculate();
};

window.onIntraYearScopeChange = function() {
    let scope = document.getElementById('intra-year-scope')?.value || 'all';
    let container = document.getElementById('intra-custom-years-container');
    if (container) {
        container.style.display = (scope === 'custom') ? 'block' : 'none';
    }
    if (scope === 'custom') {
        let years = parseInt(document.getElementById('duration-years')?.value) || 8;
        window.renderIntraYearCheckboxes(years);
    }
    calculate();
};

window.renderIntraYearCheckboxes = function(years) {
    let container = document.getElementById('intra-custom-years-checkboxes');
    if (!container) return;
    
    let currentChecked = window.getIntraSelectedYears();
    if (!currentChecked || currentChecked.length === 0) currentChecked = [1, 2];
    
    container.innerHTML = '';
    for (let y = 1; y <= years; y++) {
        let isChecked = currentChecked.includes(y);
        let lbl = document.createElement('label');
        lbl.style.display = 'inline-flex';
        lbl.style.alignItems = 'center';
        lbl.style.gap = '5px';
        lbl.style.fontSize = '0.82rem';
        lbl.style.cursor = 'pointer';
        lbl.style.padding = '3px 8px';
        lbl.style.borderRadius = '4px';
        lbl.style.background = isChecked ? 'rgba(33, 150, 243, 0.2)' : 'rgba(255,255,255,0.05)';
        lbl.style.border = isChecked ? '1px solid var(--accent-blue)' : '1px solid rgba(255,255,255,0.1)';
        
        lbl.innerHTML = `
            <input type="checkbox" class="intra-year-chk" value="${y}" ${isChecked ? 'checked' : ''} onchange="window.onIntraYearCheckboxChange(this)">
            السنة ${y}
        `;
        container.appendChild(lbl);
    }
};

window.onIntraYearCheckboxChange = function(el) {
    if (el && el.parentElement) {
        if (el.checked) {
            el.parentElement.style.background = 'rgba(33, 150, 243, 0.2)';
            el.parentElement.style.border = '1px solid var(--accent-blue)';
        } else {
            el.parentElement.style.background = 'rgba(255,255,255,0.05)';
            el.parentElement.style.border = '1px solid rgba(255,255,255,0.1)';
        }
    }
    calculate();
};

window.getIntraSelectedYears = function() {
    let chks = document.querySelectorAll('.intra-year-chk:checked');
    if (!chks || chks.length === 0) return [1, 2];
    return Array.from(chks).map(c => parseInt(c.value)).filter(n => !isNaN(n));
};

window.selectIntraYearsPreset = function(preset) {
    let years = parseInt(document.getElementById('duration-years')?.value) || 8;
    let targetYears = [];
    if (preset === '1_2') targetYears = [1, 2];
    else if (preset === '1_2_3') targetYears = [1, 2, 3];
    else if (preset === 'all') {
        for (let i = 1; i <= years; i++) targetYears.push(i);
    }
    
    document.querySelectorAll('.intra-year-chk').forEach(chk => {
        let y = parseInt(chk.value);
        chk.checked = targetYears.includes(y);
        if (chk.parentElement) {
            if (chk.checked) {
                chk.parentElement.style.background = 'rgba(33, 150, 243, 0.2)';
                chk.parentElement.style.border = '1px solid var(--accent-blue)';
            } else {
                chk.parentElement.style.background = 'rgba(255,255,255,0.05)';
                chk.parentElement.style.border = '1px solid rgba(255,255,255,0.1)';
            }
        }
    });
    calculate();
};

// --- Custom Installment Zero & Shift State and Functions ---
window.installmentShiftState = { zeroInsts: [], targetInsts: [], destMode: 'down' };

window.onShiftDestModeChange = function() {
    let modeEl = document.getElementById('inst-shift-dest-mode');
    let mode = modeEl ? modeEl.value : 'all';
    let wrapper = document.getElementById('target-inst-ids-wrapper');
    let desc = document.getElementById('dest-mode-desc');
    
    if (mode === 'all') {
        if (wrapper) wrapper.style.display = 'none';
        if (desc) desc.innerText = 'يوزع المبلغ بالتساوي على جميع الأقساط المتبقية في الخطة (قبل وبعد التصفير)';
    } else if (mode === 'specific') {
        if (wrapper) wrapper.style.display = 'block';
        if (desc) desc.innerText = 'حدد أرقام الأقساط التي تستقبل المبلغ بالكامل (مثال: 5, 6)';
    } else if (mode === 'balloon') {
        if (wrapper) wrapper.style.display = 'none';
        if (desc) desc.innerText = 'يُرحل إلى القسط الأخير (البالون) في نهاية كل سنة';
    } else {
        if (wrapper) wrapper.style.display = 'none';
        if (desc) desc.innerText = 'يوزع المبلغ بالتساوي على الأقساط التالية له فقط دون المساس بالأقساط السابقة';
    }
};

window.applyInstallmentShift = function() {
    let zeroStr = document.getElementById('zero-inst-ids')?.value || '';
    let targetStr = document.getElementById('target-inst-ids')?.value || '';
    let destMode = document.getElementById('inst-shift-dest-mode')?.value || 'all';
    
    let parseIds = (str) => {
        return str.split(/[\s,]+/)
            .map(s => parseInt(s.trim()))
            .filter(n => !isNaN(n) && n > 0);
    };
    
    let zeros = parseIds(zeroStr);
    let targets = (destMode === 'specific') ? parseIds(targetStr) : [];
    
    window.installmentShiftState = {
        zeroInsts: zeros,
        targetInsts: targets,
        destMode: destMode
    };
    
    renderInstShiftStatusBox();
    calculate();
};

window.resetInstallmentShifts = function() {
    window.installmentShiftState = { zeroInsts: [], targetInsts: [], destMode: 'all' };
    let zEl = document.getElementById('zero-inst-ids');
    if (zEl) zEl.value = '';
    let tEl = document.getElementById('target-inst-ids');
    if (tEl) tEl.value = '';
    let modeEl = document.getElementById('inst-shift-dest-mode');
    if (modeEl) modeEl.value = 'all';
    if (window.onShiftDestModeChange) window.onShiftDestModeChange();
    let box = document.getElementById('inst-shift-status-box');
    if (box) {
        box.style.display = 'none';
        box.innerHTML = '';
    }
    calculate();
};

function renderInstShiftStatusBox() {
    let box = document.getElementById('inst-shift-status-box');
    if (!box) return;
    let state = window.installmentShiftState;
    if (!state || !state.zeroInsts || state.zeroInsts.length === 0) {
        box.style.display = 'none';
        box.innerHTML = '';
        return;
    }
    
    let zerosText = state.zeroInsts.map(n => `القسط ${n}`).join('، ');
    let destMode = state.destMode || 'down';
    let destLabel = '';
    if (destMode === 'specific' && state.targetInsts && state.targetInsts.length > 0) {
        destLabel = `أقساط محددة بالرقم (${state.targetInsts.map(n => `القسط ${n}`).join('، ')})`;
    } else if (destMode === 'balloon') {
        destLabel = 'دفعة نهاية السنة (Balloon)';
    } else {
        destLabel = 'باقي الأقساط التالية لحد تحت (تلقائي بالتساوي)';
    }
        
    let mergedNotice = '';
    if (window.globalCustomFlows) {
        let mergedShifted = window.globalCustomFlows.find(f => f._isInstZeroShifted);
        if (mergedShifted) {
            mergedNotice = `<div style="font-size: 0.8rem; color: #3498db; margin-top: 4px;">📦 ملاحظة: تم الحفاظ على دفعة الاستلام بالكامل (${mergedShifted.displayPct}% = ${formatCurr(mergedShifted.amount)}) وتصفير وترحيل شق القسط فقط.</div>`;
        }
    }
        
    box.style.display = 'block';
    box.innerHTML = `
        <div style="color: #a855f7; font-weight: bold; line-height: 1.5;">
            🔀 ترحيل نشط: تم تصفير (${zerosText}) وترحيل القيمة إلى: <strong>${destLabel}</strong>.
            <div style="font-size: 0.8rem; color: #2ecc71; margin-top: 4px;">
                ✅ تم الحفاظ على الأقساط الخفيفة والمثبتة بنسبة 100% دون أي تعديل أو إلغاء لحركاتها السابقة.
            </div>
            ${mergedNotice}
        </div>
    `;
}

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
    if (flexToggle) flexToggle.value = 'no';
    
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
    let manualActionEl = document.getElementById('manual-discount-action');
    if (manualActionEl) manualActionEl.value = 'discount';
    if (window.onManualActionChange) window.onManualActionChange();
    let manualInfoEl = document.getElementById('manual-discount-info');
    if (manualInfoEl) {
        manualInfoEl.style.display = 'none';
        manualInfoEl.innerHTML = '';
    }
    let firstInstDateEl = document.getElementById('first-inst-date');
    if (firstInstDateEl) firstInstDateEl.value = '';
    window.globalTableOverrides = {};
    window.meltState = {};
    window.isManuallyDisapproved = false;
    let disapproveToggle = document.getElementById('manual-disapproval-toggle');
    if (disapproveToggle) disapproveToggle.checked = false;
    let disapproveLabel = document.getElementById('manual-disapproval-label');
    if (disapproveLabel) {
        disapproveLabel.style.color = '#2ecc71';
        disapproveLabel.innerHTML = '✅ العرض موافق عليه (APPROVED) — انقر للتحديد كـ "غير موافق"';
    }
    let disapproveWrap = document.getElementById('manual-approval-toggle-wrapper');
    if (disapproveWrap) {
        disapproveWrap.style.background = 'rgba(46, 204, 113, 0.12)';
        disapproveWrap.style.borderColor = '#27ae60';
    }
    
    resetDistPresetInternal();
    window.installmentShiftState = { zeroInsts: [], targetInsts: [] };
    let zEl = document.getElementById('zero-inst-ids');
    if (zEl) zEl.value = '';
    let tEl = document.getElementById('target-inst-ids');
    if (tEl) tEl.value = '';
    let shiftBox = document.getElementById('inst-shift-status-box');
    if (shiftBox) {
        shiftBox.style.display = 'none';
        shiftBox.innerHTML = '';
    }
    let intraScopeEl = document.getElementById('intra-year-scope');
    if (intraScopeEl) intraScopeEl.value = 'all';
    let intraCustomCont = document.getElementById('intra-custom-years-container');
    if (intraCustomCont) intraCustomCont.style.display = 'none';
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
        <input type="number" id="base-duration-years" value="8" min="1" max="10" oninput="delayedCalculate()">
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
    let dp1Label = currentProject === 'Jirian' ? 'Down Payment (5%)' : 'Down Payment 1';
    let dp2Label = currentProject === 'Jirian' ? '1st Dec Payment (5%)' : 'Down Payment 2';
    html += createInputGroup('dp1', dp1Label);
    html += createInputGroup('dp2', dp2Label);
    
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
    if (currentProject === 'Zomra') {
        if (diffDays < 368) r = 0.21;
        else if (diffDays < 1068) r = 0.20;
        else if (diffDays < 1433) r = 0.19;
        else if (diffDays < 1798) r = 0.18;
        else if (diffDays < 2163) r = 0.17;
        else if (diffDays < 2529) r = 0.16;
        else if (diffDays < 2894) r = 0.15;
        else if (diffDays < 3349) r = 0.14;
        else if (diffDays < 3715) r = 0.13;
        else r = 0.12;
    } else {
        if (diffDays < 54) r = 0.19;
        else if (diffDays < 419) r = 0.18;
        else if (diffDays < 784) r = 0.15;
        else if (diffDays < 1150) r = 0.13;
        else if (diffDays < 1880) r = 0.10;
        else r = 0.09;
    }
    return 1.0 / Math.pow(1.0 + r / 365.0, diffDays);
}

function applyDiscountLogic(f, contractDateStr, forceNormal = false, forceFlex = false) {
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
    let isFlexible = forceFlex ? true : (forceNormal ? false : (flexibleToggle ? (flexibleToggle.value === 'yes') : false));
    
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
            rate = (discountRates[0] !== undefined ? discountRates[0] : 21) / 100;
        } else if (pmt <= 3) {
            rate = (discountRates[1] !== undefined ? discountRates[1] : 21) / 100;
        } else if (pmt <= 7) {
            rate = (discountRates[2] !== undefined ? discountRates[2] : 20) / 100;
        } else if (pmt <= 11) {
            rate = (discountRates[3] !== undefined ? discountRates[3] : 19) / 100;
        } else if (pmt <= 15) {
            rate = (discountRates[4] !== undefined ? discountRates[4] : 18) / 100;
        } else if (pmt <= 19) {
            rate = (discountRates[5] !== undefined ? discountRates[5] : 17) / 100;
        } else if (pmt <= 23) {
            rate = (discountRates[6] !== undefined ? discountRates[6] : 16) / 100;
        } else if (pmt <= 27) {
            rate = (discountRates[7] !== undefined ? discountRates[7] : 15) / 100;
        } else if (pmt <= 32) {
            rate = (discountRates[8] !== undefined ? discountRates[8] : 14) / 100;
        } else if (pmt <= 36) {
            rate = (discountRates[9] !== undefined ? discountRates[9] : 13) / 100;
        } else {
            rate = (discountRates[10] !== undefined ? discountRates[10] : 12) / 100;
        }
        
        if (isFlexible) {
            let [fy, fm, fd] = f.date.split('-').map(Number);
            // Zomra Excel Sheet1 discount factor is indexed daily starting from serial 46020 (Dec 29, 2025)
            let diffDays = Math.round((Date.UTC(fy, fm - 1, fd) - Date.UTC(2025, 11, 29)) / 86400000);
            if (diffDays < 0) diffDays = 0;
            let r;
            if (diffDays < 368) r = 0.21;
            else if (diffDays < 1068) r = 0.20;
            else if (diffDays < 1433) r = 0.19;
            else if (diffDays < 1798) r = 0.18;
            else if (diffDays < 2163) r = 0.17;
            else if (diffDays < 2529) r = 0.16;
            else if (diffDays < 2894) r = 0.15;
            else if (diffDays < 3349) r = 0.14;
            else if (diffDays < 3715) r = 0.13;
            else r = 0.12;
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
                f.pvFactor = 1 / Math.pow(1 + rate * 5 / 12, 2);
                f.pv = (f.amount || 0) * f.pvFactor;
            } else {
                f.pvFactor = 1 / Math.pow(1 + rate / 4, pmt);
                f.pv = (f.amount || 0) * f.pvFactor;
            }
        }
    } else if (currentProject === 'Jirian') {
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
            let [fy, fm, fd] = f.date.split('-').map(Number);
            let [cy, cm, cd] = contractDateStr.split('-').map(Number);
            let diffDays = Math.round((Date.UTC(fy, fm - 1, fd) - Date.UTC(cy, cm - 1, cd)) / 86400000);
            if (diffDays < 0) diffDays = 0;
            let r;
            if (diffDays < 54) r = 0.19;
            else if (diffDays < 419) r = 0.18;
            else if (diffDays < 784) r = 0.15;
            else if (diffDays < 1150) r = 0.13;
            else if (diffDays < 1880) r = 0.10;
            else r = 0.09;
            f.rate = r;
            f.pvFactor = 1.0 / Math.pow(1.0 + r / 365.0, diffDays);
            f.pv = (f.amount || 0) * f.pvFactor;
        } else {
            if (f.id === 'dp1' || f.id === 'dp2') {
                f.rate = (discountRates[0] !== undefined ? discountRates[0] : 19) / 100;
                f.period = 0;
                f.pvFactor = 1.0;
                f.pv = f.amount || 0;
            } else {
                if (pmt <= 4) {
                    f.rate = (discountRates[1] !== undefined ? discountRates[1] : 18) / 100;
                } else if (pmt <= 8) {
                    f.rate = (discountRates[2] !== undefined ? discountRates[2] : 15) / 100;
                } else if (pmt <= 12) {
                    f.rate = (discountRates[3] !== undefined ? discountRates[3] : 13) / 100;
                } else if (pmt <= 20) {
                    f.rate = (discountRates[4] !== undefined ? discountRates[4] : 10) / 100;
                } else {
                    f.rate = (discountRates[6] !== undefined ? discountRates[6] : 9) / 100;
                }
                f.pvFactor = 1 / Math.pow(1 + f.rate / 4, f.period);
                f.pv = (f.amount || 0) * f.pvFactor;
            }
        }
    } else if (currentProject === 'Perla' || currentProject === 'ORB') {
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
            let [fy, fm, fd] = f.date.split('-').map(Number);
            let [cy, cm, cd] = contractDateStr.split('-').map(Number);
            let diffDays = Math.round((Date.UTC(fy, fm - 1, fd) - Date.UTC(cy, cm - 1, cd)) / 86400000);
            if (diffDays < 0) diffDays = 0;
            let r;
            if (currentProject === 'ORB') {
                if (diffDays < 109) r = 0.20;
                else if (diffDays < 475) r = 0.19;
                else if (diffDays < 840) r = 0.16;
                else if (diffDays < 1205) r = 0.14;
                else if (diffDays < 1936) r = 0.11;
                else if (diffDays < 3397) r = 0.10;
                else r = 0.09;
            } else { // Perla
                if (diffDays < 54) r = 0.19;
                else if (diffDays < 419) r = 0.18;
                else if (diffDays < 784) r = 0.15;
                else if (diffDays < 1150) r = 0.13;
                else if (diffDays < 1880) r = 0.10;
                else r = 0.09;
            }
            f.rate = r;
            f.pvFactor = 1.0 / Math.pow(1.0 + r / 365.0, diffDays);
            f.pv = (f.amount || 0) * f.pvFactor;
        } else {
            if (f.id === 'dp1') {
                f.rate = 0;
                f.period = 0;
                f.pvFactor = 1.0;
                f.pv = f.amount || 0;
            } else if (f.id === 'dp2' || pmt <= 1) {
                f.rate = (discountRates[0] !== undefined ? discountRates[0] : 20) / 100;
                f.period = 1;
                f.pvFactor = 1.0 / (1.0 + f.rate / 4.0); // 1 / 1.05 = 0.95238095238
                f.pv = (f.amount || 0) * f.pvFactor;
            } else {
                if (pmt <= 5) {
                    f.rate = (discountRates[1] !== undefined ? discountRates[1] : 19) / 100;
                } else if (pmt <= 9) {
                    f.rate = (discountRates[2] !== undefined ? discountRates[2] : 16) / 100;
                } else if (pmt <= 13) {
                    f.rate = (discountRates[3] !== undefined ? discountRates[3] : 14) / 100;
                } else if (pmt <= 21) {
                    f.rate = (discountRates[4] !== undefined ? discountRates[4] : 11) / 100;
                } else if (pmt <= 37) {
                    f.rate = (discountRates[6] !== undefined ? discountRates[6] : 10) / 100;
                } else {
                    f.rate = (discountRates[10] !== undefined ? discountRates[10] : 9) / 100;
                }
                f.pvFactor = 1.0 / Math.pow(1.0 + f.rate / 4.0, f.period);
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

function generateFlowsTemplate(contractDateStr, years, freqMonths, isBase = false, customFirstDateStrParam = null, isPureStandard = false) {
    let flows = [];
    years = Math.max(1, Math.min(10, parseInt(years) || 8));
    freqMonths = (parseInt(freqMonths) === 6 || parseInt(freqMonths) === 3) ? parseInt(freqMonths) : 3;
    let totalMonths = years * 12;
    
    // Check for overridden installment count
    let overrideEl = isPureStandard ? null : document.getElementById(isBase ? 'base-inst-count' : 'custom-inst-count');
    let overrideInstCount = (overrideEl && overrideEl.value) ? parseInt(overrideEl.value) : null;
    if (isNaN(overrideInstCount) || overrideInstCount <= 0 || overrideInstCount > 120) overrideInstCount = null;
    
    // Check for overridden percentages (if empty, fallback to defaults)
    let getOverridePct = (id, def) => {
        if (isPureStandard) return def;
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

    let flexToggleEl = document.getElementById('flexible-toggle');
    let isFlexMode = !isPureStandard && ((flexToggleEl ? (flexToggleEl.value === 'yes') : false) || ((currentProject === 'Perla' || currentProject === 'ORB') && years > 8));

    function getMonthsDiff(dStr, cStr) {
        if (!dStr) return 0;
        let [dy, dm, dd] = dStr.split('-').map(Number);
        let [cy, cm, cd] = cStr.split('-').map(Number);
        let m = (dy - cy) * 12 + (dm - cm);
        if (dd < cd && dd < 28) m--;
        return Math.max(0, m);
    }
    
    let msState = (!isBase && !isPureStandard && window.customMilestonesState) ? window.customMilestonesState : null;

    let pushDP1 = (defPct, defLabel) => {
        if (!isBase && msState && msState.splitDP1) {
            let v1a = parseFloat(msState.dp1_a_val) || (currentProject === 'Zomra' ? 1.25 : 2.5);
            let t1a = msState.dp1_a_type || 'pct';
            let d1a = msState.dp1_a_date || contractDateStr;
            let m1a = getMonthsDiff(d1a, contractDateStr);
            let p1a = t1a === 'pct' ? (v1a / 100) : (basePriceCache > 0 ? v1a / basePriceCache : 0.025);
            let flow1a = { id: 'dp1_a', label: 'Down Payment 1A (مقدم 1أ)', date: d1a, months: m1a, isDP: true, defaultPct: p1a, exactPct: (t1a === 'pct' ? p1a : null) };
            if (t1a === 'pct') flow1a._exactFixedPct = v1a;
            else { flow1a._exactFixedVal = v1a; flow1a._isFixedCash = true; }
            flows.push(flow1a);

            let v1b = parseFloat(msState.dp1_b_val) || (currentProject === 'Zomra' ? 1.25 : 2.5);
            let t1b = msState.dp1_b_type || 'pct';
            let d1b = msState.dp1_b_date || formatDate(addMonths(contractDateStr, 1));
            let m1b = getMonthsDiff(d1b, contractDateStr);
            let p1b = t1b === 'pct' ? (v1b / 100) : (basePriceCache > 0 ? v1b / basePriceCache : 0.025);
            let flow1b = { id: 'dp1_b', label: 'Down Payment 1B (مقدم 1ب)', date: d1b, months: m1b, isDP: true, defaultPct: p1b, exactPct: (t1b === 'pct' ? p1b : null) };
            if (t1b === 'pct') flow1b._exactFixedPct = v1b;
            else { flow1b._exactFixedVal = v1b; flow1b._isFixedCash = true; }
            flows.push(flow1b);
        } else {
            let d1 = (!isBase && msState && msState.dp1_date) ? msState.dp1_date : contractDateStr;
            let m1 = getMonthsDiff(d1, contractDateStr);
            let p1 = isBase ? defPct : getOverridePct('dp1', defPct);
            let flow1 = { id: 'dp1', label: defLabel, date: d1, months: m1, isDP: true, defaultPct: p1, exactPct: p1 };
            let dp1Data = isBase ? null : getCustomInputData('dp1', basePriceCache || 5000000);
            if (dp1Data) {
                if (dp1Data.isPct) flow1._exactFixedPct = dp1Data.val;
                else { flow1._exactFixedVal = dp1Data.val; flow1._isFixedCash = true; }
            } else {
                flow1._exactFixedPct = p1 * 100;
            }
            flows.push(flow1);
        }
    };

    let pushDP2 = (defPct, defMonths, defLabel) => {
        if (!isBase && msState && msState.splitDP2) {
            let v2a = parseFloat(msState.dp2_a_val) || (currentProject === 'Zomra' ? 1.25 : 2.5);
            let t2a = msState.dp2_a_type || 'pct';
            let defMonthA = currentProject === 'Zomra' ? 1 : 2;
            let d2a = msState.dp2_a_date || formatDate(addMonths(contractDateStr, defMonthA));
            let m2a = getMonthsDiff(d2a, contractDateStr);
            let p2a = t2a === 'pct' ? (v2a / 100) : (basePriceCache > 0 ? v2a / basePriceCache : 0.025);
            let flow2a = { id: 'dp2_a', label: 'Down Payment 2A (دفعة 2أ)', date: d2a, months: m2a, isDP: true, defaultPct: p2a, exactPct: (t2a === 'pct' ? p2a : null) };
            if (t2a === 'pct') flow2a._exactFixedPct = v2a;
            else { flow2a._exactFixedVal = v2a; flow2a._isFixedCash = true; }
            flows.push(flow2a);

            let v2b = parseFloat(msState.dp2_b_val) || (currentProject === 'Zomra' ? 1.25 : 2.5);
            let t2b = msState.dp2_b_type || 'pct';
            let defMonthB = currentProject === 'Zomra' ? 2 : 3;
            let d2b = msState.dp2_b_date || formatDate(addMonths(contractDateStr, defMonthB));
            let m2b = getMonthsDiff(d2b, contractDateStr);
            let p2b = t2b === 'pct' ? (v2b / 100) : (basePriceCache > 0 ? v2b / basePriceCache : 0.025);
            let flow2b = { id: 'dp2_b', label: 'Down Payment 2B (دفعة 2ب)', date: d2b, months: m2b, isDP: true, defaultPct: p2b, exactPct: (t2b === 'pct' ? p2b : null) };
            if (t2b === 'pct') flow2b._exactFixedPct = v2b;
            else { flow2b._exactFixedVal = v2b; flow2b._isFixedCash = true; }
            flows.push(flow2b);
        } else {
            let d2 = (!isBase && msState && msState.dp2_date) ? msState.dp2_date : formatDate(addMonths(contractDateStr, defMonths));
            let m2 = getMonthsDiff(d2, contractDateStr);
            let p2 = isBase ? defPct : getOverridePct('dp2', defPct);
            let flow2 = { id: 'dp2', label: defLabel, date: d2, months: m2, isDP: true, defaultPct: p2, exactPct: p2 };
            let dp2Data = isBase ? null : getCustomInputData('dp2', basePriceCache || 5000000);
            if (dp2Data) {
                if (dp2Data.isPct) flow2._exactFixedPct = dp2Data.val;
                else { flow2._exactFixedVal = dp2Data.val; flow2._isFixedCash = true; }
            } else {
                flow2._exactFixedPct = p2 * 100;
            }
            flows.push(flow2);
        }
    };

    let pushExtraPayments = () => {
        if (isBase || isPureStandard) return;
        if (msState && Array.isArray(msState.extraPayments)) {
            msState.extraPayments.forEach((extra, idx) => {
                let v = parseFloat(extra.val) || 0;
                let t = extra.type || 'pct';
                let d = extra.date || formatDate(addMonths(contractDateStr, (idx + 1) * 6));
                let m = getMonthsDiff(d, contractDateStr);
                let p = t === 'pct' ? (v / 100) : (basePriceCache > 0 ? v / basePriceCache : 0);
                let fExtra = {
                    id: extra.id || ('extra_' + idx),
                    label: extra.label || (`دفعة إضافية ${idx + 1}`),
                    date: d,
                    months: m,
                    isDP: true,
                    isExtra: true,
                    defaultPct: p,
                    exactPct: (t === 'pct' ? p : null)
                };
                if (t === 'pct') fExtra._exactFixedPct = v;
                else { fExtra._exactFixedVal = v; fExtra._isFixedCash = true; }
                flows.push(fExtra);
            });
        }
    };

    if (currentProject === 'Zomra') {
        pushDP1(0.025, 'Down Payment');
        pushDP2(0.025, 1, '2nd Payment');
        
        let addlDate = (!isBase && msState && msState.addl_date) ? msState.addl_date : formatDate(addMonths(contractDateStr, 6));
        flows.push({ id: 'addl', label: '6-Months Payment', date: addlDate, months: getMonthsDiff(addlDate, contractDateStr), isDP: true, defaultPct: isBase ? 0.05 : getOverridePct('addl', 0.05) });
        
        let delivDate = (!isBase && msState && msState.deliv_date) ? msState.deliv_date : formatDate(addMonths(contractDateStr, 37));
        let delivOverride = getOverridePct('deliv', 0.05);
        if (delivOverride > 0 || (!isBase && msState && msState.deliv_val && parseFloat(msState.deliv_val) > 0)) {
            let dPct = delivOverride > 0 ? delivOverride : (parseFloat(msState.deliv_val) / 100);
            flows.push({ id: 'deliv', label: 'Delivery Payment', date: delivDate, months: getMonthsDiff(delivDate, contractDateStr), isDP: true, defaultPct: dPct });
        } else if (years >= 3) {
            flows.push({ id: 'deliv', label: 'Delivery Payment', date: delivDate, months: 37, isDP: true, defaultPct: 0.05 });
        }
        
        let mnt1Date = formatDate(addMonths(contractDateStr, 25));
        flows.push({ id: 'mnt1', label: 'Maintenance 1', date: mnt1Date, months: 25, isMnt: true });
        flows.push({ id: 'mnt2', label: 'Maintenance 2', date: delivDate, months: 37, isMnt: true });
        
        pushExtraPayments();
        
        let numInst = overrideInstCount !== null ? overrideInstCount : (years * (12 / freqMonths));
        let totalMilestonesPct = flows.filter(f => f.isDP).reduce((s, f) => s + (f.defaultPct || 0), 0);
        let poolForInst = Math.max(0, 1.0 - totalMilestonesPct);
        let defaultInstPct = numInst > 0 ? (poolForInst / numInst) : 0;
        
        let startMonth = (freqMonths === 6) ? 7 : 4;
        let firstDate = customFirstDateStr ? new Date(customFirstDateStr) : null;
        let diffMonths = firstDate ? Math.round((firstDate - cDate) / (1000 * 60 * 60 * 24 * 30.44)) : startMonth;
        if (diffMonths < 0) diffMonths = startMonth;
        
        for (let i = 0; i < numInst; i++) {
            let m = diffMonths + i * freqMonths;
            let dStr = customFirstDateStr ? formatDate(addMonths(customFirstDateStr, i * freqMonths)) : formatDate(addMonths(contractDateStr, m));
            flows.push({ id: 'inst_' + i, label: 'Installment ' + (i+1), date: dStr, months: m, isInst: true, defaultPct: defaultInstPct });
        }
    } else if (currentProject === 'Jirian') {
        pushDP1(0.05, 'Down Payment (5%)');
        
        let cDateObj = new Date(contractDateStr);
        let dp2Year = (cDateObj.getMonth() >= 11 && cDateObj.getDate() > 1) ? cDateObj.getFullYear() + 1 : cDateObj.getFullYear();
        let dp2Date = formatDate(new Date(dp2Year, 11, 1));
        let dp2Months = (dp2Year - cDateObj.getFullYear()) * 12 + 11 - cDateObj.getMonth();
        if (dp2Months < 0) dp2Months = 1;
        flows.push({ id: 'dp2', label: '1st Dec Payment (5%)', date: dp2Date, months: dp2Months, isDP: true, defaultPct: getOverridePct('dp2', 0.05) });
        
        let delivDate = (!isBase && msState && msState.deliv_date) ? msState.deliv_date : formatDate(addMonths(contractDateStr, 48));
        let mnt1Date = (!isBase && msState && msState.mnt1_date) ? msState.mnt1_date : formatDate(addMonths(contractDateStr, 36));
        let mnt2Date = (!isBase && msState && msState.mnt2_date) ? msState.mnt2_date : delivDate;
        flows.push({ id: 'mnt1', label: 'Maintenance 1 (4% - 1 Year Pre-Delivery)', date: mnt1Date, months: 36, isMnt: true });
        flows.push({ id: 'mnt2', label: 'Maintenance 2 (4% - At Delivery)', date: mnt2Date, months: 48, isMnt: true });
        
        pushExtraPayments();

        let numInst = overrideInstCount !== null ? overrideInstCount : (years * (12 / freqMonths));
        let totalMilestonesPct = flows.filter(f => f.isDP).reduce((s, f) => s + (f.defaultPct || 0), 0);
        let poolForInst = Math.max(0, 1.0 - totalMilestonesPct);
        let defaultInstPct = numInst > 0 ? (poolForInst / numInst) : 0;

        let startMonth = (freqMonths === 6) ? 6 : 3;
        let firstDate = customFirstDateStr ? new Date(customFirstDateStr) : null;
        let diffMonths = firstDate ? Math.round((firstDate - cDateObj) / (1000 * 60 * 60 * 24 * 30.44)) : startMonth;
        if (diffMonths < 0) diffMonths = startMonth;
        
        for (let i = 0; i < numInst; i++) {
            let m = diffMonths + i * freqMonths;
            let dStr = customFirstDateStr ? formatDate(addMonths(customFirstDateStr, i * freqMonths)) : formatDate(addMonths(contractDateStr, m));
            flows.push({ id: 'inst_' + i, label: 'Installment ' + (i+1), date: dStr, months: m, isInst: true, defaultPct: defaultInstPct, exactPct: defaultInstPct });
        }
    } else if (currentProject === 'ORB') {
        pushDP1(0.05, 'Down Payment 1');
        pushDP2(0.05, 3, 'Down Payment 2');
        
        let delivDate = (!isBase && msState && msState.deliv_date) ? msState.deliv_date : formatDate(addMonths(contractDateStr, 24));
        let delivOverride = isBase ? 0 : getOverridePct('deliv', 0);
        if (delivOverride > 0 || (!isBase && msState && msState.deliv_val && parseFloat(msState.deliv_val) > 0)) {
            let dPct = delivOverride > 0 ? delivOverride : (parseFloat(msState.deliv_val) / 100);
            flows.push({ id: 'deliv', label: 'Delivery Payment', date: delivDate, months: getMonthsDiff(delivDate, contractDateStr), isDP: true, defaultPct: dPct, exactPct: dPct });
        }
        
        let mnt1Date = (!isBase && msState && msState.mnt1_date) ? msState.mnt1_date : formatDate(addMonths(contractDateStr, 12));
        let mnt2Date = (!isBase && msState && msState.mnt2_date) ? msState.mnt2_date : delivDate;
        flows.push({ id: 'mnt1', label: 'Maintenance 1 (4% - 1 Year)', date: mnt1Date, months: 12, isMnt: true });
        flows.push({ id: 'mnt2', label: 'Maintenance 2 (4% - Delivery)', date: mnt2Date, months: 24, isMnt: true });
        
        pushExtraPayments();

        let numInst = overrideInstCount !== null ? overrideInstCount : (freqMonths === 6 ? (years * 2) : (years * 4));
        let totalMilestonesPct = flows.filter(f => f.isDP).reduce((s, f) => s + (f.defaultPct || 0), 0);
        let poolForInst = Math.max(0, 1.0 - totalMilestonesPct);
        let defaultInstPct = numInst > 0 ? (poolForInst / numInst) : 0;
        
        let startMonth = (freqMonths === 6) ? 9 : 6;
        let firstDate = customFirstDateStr ? new Date(customFirstDateStr) : null;
        let diffMonths = firstDate ? Math.round((firstDate - cDate) / (1000 * 60 * 60 * 24 * 30.44)) : startMonth;
        if (diffMonths < 0) diffMonths = startMonth;
        
        for (let i = 0; i < numInst; i++) {
            let m = diffMonths + i * freqMonths;
            let dStr = customFirstDateStr ? formatDate(addMonths(customFirstDateStr, i * freqMonths)) : formatDate(addMonths(contractDateStr, m));
            flows.push({ id: 'inst_' + i, label: 'Installment ' + (i+1), date: dStr, months: m, isInst: true, defaultPct: defaultInstPct, exactPct: defaultInstPct });
        }
    } else { // Perla
        pushDP1(0.05, 'Down Payment 1');
        pushDP2(0.05, 3, 'Down Payment 2');
        
        let delivDate = (!isBase && msState && msState.deliv_date) ? msState.deliv_date : formatDate(addMonths(contractDateStr, 51));
        let delivOverride = isBase ? 0 : getOverridePct('deliv', 0);
        if (delivOverride > 0 || (!isBase && msState && msState.deliv_val && parseFloat(msState.deliv_val) > 0)) {
            let dPct = delivOverride > 0 ? delivOverride : (parseFloat(msState.deliv_val) / 100);
            flows.push({ id: 'deliv', label: 'Delivery Payment', date: delivDate, months: getMonthsDiff(delivDate, contractDateStr), isDP: true, defaultPct: dPct, exactPct: dPct });
        }
        
        let mnt1Date = formatDate(addMonths(contractDateStr, 39));
        flows.push({ id: 'mnt1', label: 'Maintenance 1', date: mnt1Date, months: 39, isMnt: true });
        flows.push({ id: 'mnt2', label: 'Maintenance 2', date: delivDate, months: 51, isMnt: true });
        
        pushExtraPayments();

        let numInst = overrideInstCount !== null ? overrideInstCount : (freqMonths === 6 ? (years * 2) : (years * 4 - 1));
        let totalMilestonesPct = flows.filter(f => f.isDP).reduce((s, f) => s + (f.defaultPct || 0), 0);
        let poolForInst = Math.max(0, 1.0 - totalMilestonesPct);
        let defaultInstPct = numInst > 0 ? (poolForInst / numInst) : 0;
        
        let startMonth = (freqMonths === 6) ? 9 : 6;
        let firstDate = customFirstDateStr ? new Date(customFirstDateStr) : null;
        let diffMonths = firstDate ? Math.round((firstDate - cDate) / (1000 * 60 * 60 * 24 * 30.44)) : startMonth;
        if (diffMonths < 0) diffMonths = startMonth;
        
        for (let i = 0; i < numInst; i++) {
            let m = diffMonths + i * freqMonths;
            let dStr = customFirstDateStr ? formatDate(addMonths(customFirstDateStr, i * freqMonths)) : formatDate(addMonths(contractDateStr, m));
            flows.push({ id: 'inst_' + i, label: 'Installment ' + (i+1), date: dStr, months: m, isInst: true, defaultPct: defaultInstPct, exactPct: defaultInstPct });
        }
    }
    
    let mergedFlows = [];
    let shouldMerge = document.getElementById('merge-delivery-toggle') ? document.getElementById('merge-delivery-toggle').checked : true;
    
    flows.forEach(f => {
        let existing = shouldMerge ? mergedFlows.find(mf => mf.date === f.date && !mf.isMnt && !f.isMnt) : null;
        if (existing) {
            existing.label += ' + ' + f.label;
            existing.isMerged = true;
            existing.isInst = true;
            existing.isDP = false; // Merged installment, not a standalone DP
            if (f.id === 'deliv' || existing.id === 'deliv') {
                existing.hasDeliv = true;
                let delivF = (existing.id === 'deliv') ? existing : f;
                let instF = (existing.id === 'deliv') ? f : existing;
                existing._delivDefaultPct = delivF._delivDefaultPct || delivF.defaultPct || 0.05;
                existing._instDefaultPct = instF._instDefaultPct || instF.defaultPct || 0;
            }
            existing.mergedIds = existing.mergedIds || [existing.id];
            existing.mergedIds.push(f.id);
            if (f.defaultPct) existing.defaultPct = (existing.defaultPct || 0) + f.defaultPct;
        } else {
            if (f.id === 'deliv') {
                f._delivDefaultPct = f.defaultPct || 0.05;
            }
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
function calculateBaseFlows(price, template, contractDateStr) {
    let flows = JSON.parse(JSON.stringify(template));
    
    // The NPV engine operates on 100% of the unit price (ignoring maintenance)
    let remaining = price; 
    let instCount = 0;
    
    flows.forEach(f => {
        if (f.isMnt) {
            f.amount = basePriceCache * 0.04;
        } else if (f.isMerged) {
            let delivPct = f._delivDefaultPct !== undefined ? f._delivDefaultPct : 0.05;
            let delivAmt = price * delivPct;
            f._delivPortionAmt = delivAmt;
            f._exactMergedDelivPct = delivPct * 100;
            remaining -= delivAmt;
            instCount++;
        } else if (f.isDP) {
            f.amount = price * (f.defaultPct || 0);
            if (f.defaultPct) f._exactFixedPct = (f.defaultPct || 0) * 100;
            remaining -= f.amount;
        } else if (f.isInst) {
            instCount++;
        }
    });
    
    let instAmt = instCount > 0 ? remaining / instCount : 0;
    let instPct = instCount > 0 ? (remaining / price) / instCount : 0;
    flows.forEach(f => {
        if (f.isMerged) {
            let delivPct = f._delivDefaultPct !== undefined ? f._delivDefaultPct : 0.05;
            f.exactPct = delivPct + instPct;
            f.defaultPct = f.exactPct;
            f.amount = (f._delivPortionAmt || 0) + instAmt;
            f._instPortionAmt = instAmt;
        } else if (f.isInst) {
            f.exactPct = instPct;
            f.defaultPct = instPct;
            f.amount = (f.amount || 0) + instAmt;
        } else if (f.isDP) {
            f.exactPct = f.defaultPct || 0;
        }
        
        applyDiscountLogic(f, contractDateStr, false);
    });
    
    return flows;
}

function getCustomInputData(id, price) {
    let valEl = document.getElementById(id + '-val');
    let typeEl = document.getElementById(id + '-type');
    if (!valEl || valEl.value.trim() === '') return null;
    let v = parseFloat(valEl.value);
    if (isNaN(v) || v < 0) return null;
    let isPct = (!typeEl || typeEl.value === 'pct');
    return {
        isPct: isPct,
        val: v,
        amount: isPct ? price * (v / 100) : v
    };
}

function getCustomInputAmt(id, price) {
    let d = getCustomInputData(id, price);
    return d ? d.amount : null;
}

function solveForPrice(basePv, template) {
    if (!template || template.length === 0 || basePriceCache <= 0 || !basePv || isNaN(basePv) || basePv <= 0) {
        return basePriceCache || 0;
    }
    let pRef = basePriceCache;
    let getPv = (p) => {
        let flows = calculateCustomFlows(p, template);
        return flows.filter(f => !f.isMnt).reduce((sum, f) => sum + (f.pv || 0), 0);
    };

    let p1 = pRef;
    let p2 = pRef * 1.05;
    let pv1 = getPv(p1);
    let pv2 = getPv(p2);
    let slope = (pv2 - pv1) / (p2 - p1);

    let solvedPrice = p1;
    if (Math.abs(slope) > 1e-9) {
        solvedPrice = p1 + (basePv - pv1) / slope;
    }

    for (let iter = 0; iter < 30; iter++) {
        let curPv = getPv(solvedPrice);
        let err = curPv - basePv;
        if (Math.abs(err) < 1e-4) break;
        let pNext = solvedPrice + (Math.abs(err) > 10 ? 10 : 1);
        let s = (getPv(pNext) - curPv) / (pNext - solvedPrice);
        if (Math.abs(s) > 1e-9) {
            solvedPrice = solvedPrice - err / s;
        } else {
            break;
        }
    }

    if (isNaN(solvedPrice) || !isFinite(solvedPrice) || solvedPrice <= 0) {
        let low = 0, high = basePriceCache * 10;
        for (let i = 0; i < 60; i++) {
            let mid = (low + high) / 2;
            let testPv = getPv(mid);
            if (testPv > basePv) high = mid; else low = mid;
            solvedPrice = mid;
        }
    }
    return solvedPrice;
}

function getStandardDurationPrice(targetPv, years, freqMonths, contractDateStr) {
    if (!targetPv || targetPv <= 0) return basePriceCache || 0;
    let tpl = generateFlowsTemplate(contractDateStr, years, freqMonths, false, null, true);
    let pRef = basePriceCache || 5000000;
    let getPv = (p) => {
        let flows = calculateCustomFlows(p, tpl, { isPureStandard: true });
        return flows.filter(f => !f.isMnt).reduce((s, f) => s + (f.pv || 0), 0);
    };
    let p1 = pRef;
    let p2 = pRef * 1.05;
    let pv1 = getPv(p1);
    let pv2 = getPv(p2);
    let slope = (pv2 - pv1) / (p2 - p1);
    let solved = p1;
    if (Math.abs(slope) > 1e-9) solved = p1 + (targetPv - pv1) / slope;
    for (let i = 0; i < 30; i++) {
        let cur = getPv(solved);
        let err = cur - targetPv;
        if (Math.abs(err) < 1e-4) break;
        let pNext = solved + 1;
        let s = (getPv(pNext) - cur) / 1;
        if (Math.abs(s) > 1e-9) solved -= err / s;
    }
    return solved;
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
    let isPure = options.isPureStandard === true;
    let dp1Data = isPure ? null : getCustomInputData('dp1', price);
    let dp2Data = isPure ? null : getCustomInputData('dp2', price);
    let addlData = isPure ? null : getCustomInputData('addl', price);
    let delivData = isPure ? null : getCustomInputData('deliv', price);
    let dp1 = dp1Data ? dp1Data.amount : null;
    let dp2 = dp2Data ? dp2Data.amount : null;
    let addl = addlData ? addlData.amount : null;
    let deliv = delivData ? delivData.amount : null;
    
    let flows = JSON.parse(JSON.stringify(template));
    let remAmt = price;
    
    let overrides = isPure ? {} : (window.globalTableOverrides || {});
    
    flows.forEach(f => {
        if (f.isMnt) {
            f.amount = basePriceCache * 0.04;
        } else {
            // Apply Date Overrides only if actually modified
            if (overrides[f.id] && overrides[f.id].date && overrides[f.id].date !== f.date) {
                f.date = overrides[f.id].date;
                let cDate = new Date(document.getElementById('contract-date').value);
                let pDate = new Date(f.date);
                let m = (pDate.getFullYear() - cDate.getFullYear()) * 12 + (pDate.getMonth() - cDate.getMonth());
                if (pDate.getDate() < cDate.getDate() && pDate.getDate() < 28) m--;
                f.months = Math.max(0, m);
            }
            // Priority 1: Table overrides
            if (overrides[f.id] && overrides[f.id].amount !== undefined) {
                let ov = overrides[f.id];
                if (ov.isPct) {
                    f.amount = price * (ov.amount / 100);
                    f._exactFixedPct = ov.amount;
                } else {
                    f.amount = ov.amount;
                    f._exactFixedVal = ov.amount;
                    f._isFixedCash = true;
                }
                f.isFixedOverride = true;
            } 
            // Priority 2: Input fields for DP/Addl/Deliv
            else if (f.id === 'dp1') {
                if (dp1Data !== null) {
                    f.amount = dp1Data.amount;
                    if (dp1Data.isPct) {
                        f._exactFixedPct = dp1Data.val;
                    } else {
                        f._exactFixedVal = dp1Data.val;
                        f._isFixedCash = true;
                    }
                } else {
                    f.amount = price * (f.defaultPct || 0);
                    if (f.defaultPct) f._exactFixedPct = (f.defaultPct || 0) * 100;
                }
            }
            else if (f.id === 'dp2') {
                if (dp2Data !== null) {
                    f.amount = dp2Data.amount;
                    if (dp2Data.isPct) {
                        f._exactFixedPct = dp2Data.val;
                    } else {
                        f._exactFixedVal = dp2Data.val;
                        f._isFixedCash = true;
                    }
                } else {
                    f.amount = price * (f.defaultPct || 0);
                    if (f.defaultPct) f._exactFixedPct = (f.defaultPct || 0) * 100;
                }
            }
            else if (f.id === 'addl') {
                if (addlData !== null) {
                    f.amount = addlData.amount;
                    if (addlData.isPct) {
                        f._exactFixedPct = addlData.val;
                    } else {
                        f._exactFixedVal = addlData.val;
                        f._isFixedCash = true;
                    }
                } else {
                    f.amount = price * (f.defaultPct || 0);
                    if (f.defaultPct) f._exactFixedPct = (f.defaultPct || 0) * 100;
                }
            }
            else if (f.isMerged) {
                let m_amt = 0;
                let delivTpl = template.find(t => t.id === 'deliv' || (t.mergedIds && t.mergedIds.includes('deliv')));
                let delivPct = f._delivDefaultPct !== undefined ? f._delivDefaultPct : (delivTpl && delivTpl._delivDefaultPct ? delivTpl._delivDefaultPct : 0.05);
                let exactDelivPct = null;
                let exactDelivVal = null;
                if (!f.mergedIds || f.mergedIds.includes('deliv') || f.id === 'deliv' || f.hasDeliv) {
                    if (delivData !== null) {
                        m_amt = delivData.amount;
                        if (delivData.isPct) {
                            exactDelivPct = delivData.val;
                        } else {
                            exactDelivVal = delivData.val;
                        }
                    } else {
                        m_amt = price * delivPct;
                        exactDelivPct = delivPct * 100;
                    }
                }
                f.amount = m_amt; 
                f._mergedDelivAmt = m_amt;
                f._savedMergedDelivAmt = m_amt;
                f._exactMergedDelivPct = exactDelivPct;
                f._exactMergedDelivVal = exactDelivVal;
            }
            else if (f.id === 'deliv') {
                if (delivData !== null) {
                    f.amount = delivData.amount;
                    if (delivData.isPct) {
                        f._exactFixedPct = delivData.val;
                    } else {
                        f._exactFixedVal = delivData.val;
                        f._isFixedCash = true;
                    }
                } else {
                    f.amount = price * (f.defaultPct || 0);
                    if (f.defaultPct) f._exactFixedPct = (f.defaultPct || 0) * 100;
                }
            }
            
            if (f.amount !== undefined) {
                if (f.isMerged) remAmt -= (f._mergedDelivAmt || 0);
                if (f.id === 'deliv' && !f.isMerged) remAmt -= f.amount;
                if (!f.isInst && f.id !== 'deliv' && !f.isMerged) remAmt -= f.amount;
                if (f.isInst && !f.isMerged && f.isFixedOverride) remAmt -= f.amount;
            }
        }
    });
    
    let instIndex = 0;
    let freqMonths = parseInt(document.getElementById('payment-frequency')?.value) === 2 ? 6 : 3;
    let instsPerYear = 12 / freqMonths;
    
    // Intra-Year Shift / Balloon logic (Supports custom amount, percentage, and legacy 70/30)
    let isIntraToggle = !isPure && document.getElementById('toggle-intra-year') && document.getElementById('toggle-intra-year').checked;
    let isLegacy7030 = !isPure && document.getElementById('toggle-70-30') && document.getElementById('toggle-70-30').checked;
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

    let dynamicInsts = flows.filter(f => (f.isInst || f.isMerged) && !f.isFixedOverride);
    
    let isFixedInst = !isPure && document.getElementById('fixed-inst-toggle') && document.getElementById('fixed-inst-toggle').checked;
    let fixedInstScope = document.getElementById('fixed-inst-scope') ? document.getElementById('fixed-inst-scope').value : 'all';
    let fixedInstVal = document.getElementById('fixed-inst-val') ? parseFloat(document.getElementById('fixed-inst-val').value) : 0;
    let fixedInstType = document.getElementById('fixed-inst-type') ? document.getElementById('fixed-inst-type').value : 'amt';
    let hasFixedInst = isFixedInst && fixedInstVal > 0;
    
    let delivMonth = (currentProject === 'Zomra') ? 37 : (currentProject === 'Perla' ? 51 : 48);
    let preInsts = dynamicInsts.filter(f => f.months <= delivMonth);
    let postInsts = dynamicInsts.filter(f => f.months > delivMonth);
    let nPre = preInsts.length;
    let nPost = postInsts.length;
    let nTotal = nPre + nPost;
    
    let remPct = price > 0 ? (remAmt / price) * 100 : 0;
    let standardMilestonesPct = (currentProject === 'Zomra') ? (template.some(t => t.id === 'deliv' || (t.mergedIds && t.mergedIds.includes('deliv'))) ? 15.0 : 10.0) : 10.0;
    let standardBaselinePool = 100.0 - standardMilestonesPct;
    let basePrePct = nTotal > 0 ? standardBaselinePool * (nPre / nTotal) : 0;
    let basePostPct = nTotal > 0 ? standardBaselinePool * (nPost / nTotal) : 0;
    
    let distMode = window.globalDistState ? window.globalDistState.mode : 'auto';
    let typedPre = window.globalDistState ? window.globalDistState.typedPrePct : null;
    let typedPost = window.globalDistState ? window.globalDistState.typedPostPct : null;
    
    let fixedAmt = 0;
    if (hasFixedInst) {
        if (fixedInstType === 'pct') {
            fixedAmt = price * (fixedInstVal / 100);
        } else {
            fixedAmt = fixedInstVal;
        }
    }
    
    let actualPrePct = 0;
    let actualPostPct = 0;
    let instAmtPre = 0;
    let instAmtPost = 0;

    let hasMeltActive = window.meltState && Object.keys(window.meltState).length > 0;
    if (hasFixedInst) {
        if (hasMeltActive) {
            // When user has melted milestones (e.g. DP2 or Addl), the installments dynamically absorb the melted portion!
            if (typedPre !== null && !isNaN(typedPre)) {
                actualPrePct = Math.max(0, Math.min(remPct, typedPre));
                actualPostPct = remPct - actualPrePct;
            } else if (typedPost !== null && !isNaN(typedPost)) {
                actualPostPct = Math.max(0, Math.min(remPct, typedPost));
                actualPrePct = remPct - actualPostPct;
            } else {
                actualPrePct = nTotal > 0 ? remPct * (nPre / nTotal) : 0;
                actualPostPct = nTotal > 0 ? remPct * (nPost / nTotal) : 0;
            }
            let prePoolAmt = price * (actualPrePct / 100);
            let postPoolAmt = price * (actualPostPct / 100);
            instAmtPre = nPre > 0 ? prePoolAmt / nPre : 0;
            instAmtPost = nPost > 0 ? postPoolAmt / nPost : 0;
            distMode = 'custom';
        } else if (fixedInstScope === 'pre') {
            instAmtPre = fixedAmt;
            let totalPreAmt = nPre * instAmtPre;
            let remPost = remAmt - totalPreAmt;
            let postPctPerInst = nPost > 0 ? (Math.round(((remPost / price) / nPost) * 1000000) / 1000000) : 0;
            instAmtPost = price * postPctPerInst;
            actualPrePct = price > 0 ? (totalPreAmt / price) * 100 : 0;
            actualPostPct = price > 0 ? ((nPost * instAmtPost) / price) * 100 : 0;
            distMode = 'custom';
        } else if (fixedInstScope === 'post') {
            instAmtPost = fixedAmt;
            let totalPostAmt = nPost * instAmtPost;
            let remPre = remAmt - totalPostAmt;
            let prePctPerInst = nPre > 0 ? (Math.round(((remPre / price) / nPre) * 1000000) / 1000000) : 0;
            instAmtPre = price * prePctPerInst;
            actualPostPct = price > 0 ? (totalPostAmt / price) * 100 : 0;
            actualPrePct = price > 0 ? ((nPre * instAmtPre) / price) * 100 : 0;
            distMode = 'custom';
        } else {
            // Scope === 'all'
            instAmtPre = fixedAmt;
            instAmtPost = fixedAmt;
            actualPrePct = price > 0 ? ((nPre * fixedAmt) / price) * 100 : 0;
            actualPostPct = price > 0 ? ((nPost * fixedAmt) / price) * 100 : 0;
            distMode = hasIntraYearShift ? 'equal' : 'custom';
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
            let isFlowFixedInst = hasFixedInst && !hasMeltActive && ((fixedInstScope === 'all') || (fixedInstScope === 'pre' && f.months <= delivMonth) || (fixedInstScope === 'post' && f.months > delivMonth));
            if (isFlowFixedInst) {
                f._isFixedInst = true;
                f._isFixedCash = (fixedInstType === 'amt');
                f.isFixedOverride = true;
            }
            let baseInstAmt = (f.months <= delivMonth) ? instAmtPre : instAmtPost;
            let currentInstAmt = baseInstAmt;
            
            let applyShift = hasIntraYearShift;
            if (intraScope === 'pre' && f.months > delivMonth) applyShift = false;
            if (intraScope === 'post' && f.months <= delivMonth) applyShift = false;
            if (intraScope === 'custom') {
                let y = Math.floor(instIndex / instsPerYear) + 1;
                let selectedYears = window.getIntraSelectedYears ? window.getIntraSelectedYears() : [1, 2];
                if (!selectedYears.includes(y)) applyShift = false;
            }
            
            if (applyShift) {
                let isBumpInst = (instIndex % instsPerYear === instsPerYear - 1);
                let isLastInst = (instIndex === dynamicInsts.length - 1);
                
                let cycleTotal = baseInstAmt * instsPerYear;
                let regularInstCount = instsPerYear - 1;
                let maxSafeLight = regularInstCount > 0 ? (cycleTotal / regularInstCount) * 0.99 : cycleTotal;
                
                let lightAmt = 0;
                if (intraType === 'pct') {
                    lightAmt = baseInstAmt * (intraValRaw / 100);
                } else {
                    lightAmt = intraValRaw; // Exact cash amount entered by user (e.g. 350,000 EGP exact)
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
                    if (intraType === 'amt') f._exactFixedVal = intraValRaw;
                    let withheld = baseInstAmt - lightAmt;
                    accumulatedWithheld += withheld;
                    if (intraGuidanceInfo.regularAmt === 0) {
                        intraGuidanceInfo.regularAmt = lightAmt;
                    }
                }
            }
            
            f.amount = (f._mergedDelivAmt || 0) + currentInstAmt;
            f._instPortionAmt = currentInstAmt;
            f._delivPortionAmt = f._mergedDelivAmt || 0;
            if (f.isMerged && f._mergedDelivAmt !== undefined) {
                f._savedMergedDelivAmt = f._mergedDelivAmt;
            }
            instIndex++;
        } else if ((f.isInst || f.isMerged) && f.isFixedOverride) {
            instIndex++;
        }
        
        delete f._mergedDelivAmt;
        applyDiscountLogic(f);
    });

    // When fixedInstScope === 'all', automatically absorb any remainder EQUALLY across all dynamic installments so total is strictly 100.00%
    if (!isPure && hasFixedInst && fixedInstScope === 'all') {
        let dynInsts = flows.filter(f => (f.isInst || f.isMerged) && !f.isFixedOverride && !f.isMnt && !f._isZeroShifted);
        if (dynInsts.length > 0) {
            let totalAssigned = dynInsts.reduce((sum, f) => sum + (f.isMerged ? ((f.amount || 0) - (f._savedMergedDelivAmt || 0)) : (f.amount || 0)), 0);
            let diffToBalance = remAmt - totalAssigned;
            if (Math.abs(diffToBalance) > 0.01) {
                let addEach = diffToBalance / dynInsts.length;
                dynInsts.forEach(inst => {
                    inst.amount = (inst.amount || 0) + addEach;
                    if (inst.isMerged) {
                        inst._instPortionAmt = (inst._instPortionAmt || 0) + addEach;
                    }
                    applyDiscountLogic(inst);
                });
            }
        }
    }
    
    // Custom Installment Zero & Shift Execution
    if (!isPure && window.installmentShiftState && window.installmentShiftState.zeroInsts && window.installmentShiftState.zeroInsts.length > 0) {
        let zeros = window.installmentShiftState.zeroInsts;
        let destMode = window.installmentShiftState.destMode || 'down';
        let targets = window.installmentShiftState.targetInsts || [];
        
        let instFlowsList = flows.filter(f => (f.isInst || f.isMerged) && !f.isMnt);
        let totalShiftedAmt = 0;
        let zeroLabels = [];
        
        zeros.forEach(num => {
            let idx = num - 1; // 1-based index to 0-based
            if (idx >= 0 && idx < instFlowsList.length) {
                let f = instFlowsList[idx];
                f._originalAmtBeforeShift = f.amount;
                f._isZeroShifted = true;
                zeroLabels.push(`قسط ${num}`);
                if (f.isMerged) {
                    let delivAmt = f._savedMergedDelivAmt !== undefined ? f._savedMergedDelivAmt : (price * (f._delivDefaultPct || 0.05));
                    let instPortion = Math.max(0, (f.amount || 0) - delivAmt);
                    totalShiftedAmt += instPortion;
                    f.amount = delivAmt; // Keep delivery payment 100% intact!
                    f._isInstZeroShifted = true;
                    f._instPortionAmt = 0;
                    f._delivPortionAmt = delivAmt;
                    f.exactPct = (f._exactMergedDelivPct !== undefined && f._exactMergedDelivPct !== null) ? (f._exactMergedDelivPct / 100.0) : 0.05;
                } else {
                    totalShiftedAmt += (f.amount || 0);
                    f.amount = 0;
                    f.exactPct = 0.0;
                }
                applyDiscountLogic(f);
            }
        });
        
        if (totalShiftedAmt > 0) {
            let recipientFlows = [];
            
            if (destMode === 'all') {
                // ترحيل وتوزيع بالتساوي على جميع الأقساط المتبقية (قبل وبعد التصفير)
                recipientFlows = instFlowsList.filter((f, idx) => !zeros.includes(idx + 1) && !f.isFixedOverride);
            } else if (destMode === 'specific' && targets.length > 0) {
                targets.forEach(num => {
                    let idx = num - 1;
                    if (idx >= 0 && idx < instFlowsList.length && !zeros.includes(num)) {
                        recipientFlows.push(instFlowsList[idx]);
                    }
                });
            } else if (destMode === 'balloon') {
                zeros.forEach(num => {
                    let y = Math.ceil(num / instsPerYear);
                    let balloonInstIdx = y * instsPerYear - 1;
                    if (balloonInstIdx < instFlowsList.length && !zeros.includes(balloonInstIdx + 1)) {
                        let bf = instFlowsList[balloonInstIdx];
                        if (!recipientFlows.includes(bf)) recipientFlows.push(bf);
                    }
                });
                if (recipientFlows.length === 0) {
                    let maxZero = Math.max(...zeros);
                    recipientFlows = instFlowsList.filter((f, idx) => (idx + 1) > maxZero && !f.isFixedOverride);
                }
            } else {
                // destMode === 'down' (Default: ترحيل على باقي الأقساط التالية لحد تحت)
                let maxZero = Math.max(...zeros);
                recipientFlows = instFlowsList.filter((f, idx) => {
                    let instNum = idx + 1;
                    if (instNum <= maxZero) return false;
                    if (zeros.includes(instNum)) return false;
                    if (f.isFixedOverride) return false;
                    
                    // Protect light quarters in active intra-year balloon years
                    if (hasIntraYearShift) {
                        let y = Math.floor(idx / instsPerYear) + 1;
                        let selectedYears = window.getIntraSelectedYears ? window.getIntraSelectedYears() : [1, 2];
                        let isSelectedYear = (intraScope === 'all') || 
                                             (intraScope === 'pre' && f.months <= delivMonth) || 
                                             (intraScope === 'post' && f.months > delivMonth) ||
                                             (intraScope === 'custom' && selectedYears.includes(y));
                        let isBump = (idx % instsPerYear === instsPerYear - 1);
                        if (isSelectedYear && !isBump) {
                            return false; // Protected light installment (keep original)
                        }
                    }
                    
                    // Protect fixed installments
                    if (hasFixedInst) {
                        if (fixedInstScope === 'all') return false;
                        if (fixedInstScope === 'pre' && f.months <= delivMonth) return false;
                        if (fixedInstScope === 'post' && f.months > delivMonth) return false;
                    }
                    
                    return true;
                });
                
                // Fallbacks if all subsequent are protected
                if (recipientFlows.length === 0) {
                    recipientFlows = instFlowsList.filter((f, idx) => (idx + 1) > maxZero && !zeros.includes(idx + 1));
                }
                if (recipientFlows.length === 0) {
                    recipientFlows = instFlowsList.filter((f, idx) => !zeros.includes(idx + 1));
                }
            }
            
            if (recipientFlows.length > 0) {
                let addPerFlow = totalShiftedAmt / recipientFlows.length;
                let targetNums = recipientFlows.map(rf => instFlowsList.indexOf(rf) + 1);
                
                zeros.forEach(num => {
                    let idx = num - 1;
                    if (idx >= 0 && idx < instFlowsList.length) {
                        instFlowsList[idx]._shiftedTo = targetNums.length <= 4 
                            ? targetNums.map(n => `قسط ${n}`).join('، ')
                            : (destMode === 'all' 
                                ? 'جميع الأقساط المتبقية' 
                                : `الأقساط التالية (${targetNums[0]} إلى ${targetNums[targetNums.length - 1]})`);
                    }
                });
                
                recipientFlows.forEach(f => {
                    f.amount = (f.amount || 0) + addPerFlow;
                    if (f.isMerged) {
                        f._instPortionAmt = (f._instPortionAmt || 0) + addPerFlow;
                    }
                    f.exactPct = price > 0 ? (f.amount / price) : (f.defaultPct || 0);
                    f._isShiftTarget = true;
                    f._shiftedFrom = zeroLabels.join('، ');
                    f._addedShiftAmt = (f._addedShiftAmt || 0) + addPerFlow;
                    applyDiscountLogic(f);
                });
            }
        }
    }
    
    flows._intraGuidance = intraGuidanceInfo;
    return flows;
}

function reconcileIntegerInstallments(flows, targetTotalPrice) {
    if (!flows || !Array.isArray(flows)) return flows;
    let targetTotal = Math.round(targetTotalPrice);
    let nonMnt = flows.filter(f => !f.isMnt);
    if (nonMnt.length === 0 || targetTotal <= 0) return flows;


    let nonInstFlows = nonMnt.filter(f => !f.isInst && !f.isMerged);
    let mergedFlows = nonMnt.filter(f => f.isMerged);
    let pureInstFlows = nonMnt.filter(f => f.isInst && !f.isMerged);

    let sumNonInst = 0;
    nonInstFlows.forEach(f => {
        if (f._exactFixedVal !== undefined && f._exactFixedVal > 0) {
            f.amount = Math.round(f._exactFixedVal);
        } else if (f._exactFixedPct !== undefined && f._exactFixedPct > 0) {
            f.amount = Math.round(targetTotal * (f._exactFixedPct / 100.0));
        } else {
            f.amount = Math.round(f.amount || 0);
        }
        sumNonInst += f.amount;
    });

    let dynInstEntries = [];
    let fixedInstSum = 0;

    mergedFlows.forEach(f => {
        let delivPart = 0;
        if (f._exactMergedDelivPct !== undefined && f._exactMergedDelivPct !== null) {
            delivPart = Math.round(targetTotal * (f._exactMergedDelivPct / 100.0));
        } else if (f._mergedDelivAmt !== undefined && f._mergedDelivAmt !== null) {
            delivPart = Math.round(f._mergedDelivAmt);
        } else {
            delivPart = Math.round(f._delivPortionAmt || f.amount || 0);
        }
        f._delivPortionAmt = delivPart;
        sumNonInst += delivPart;

        if (!f._isInstZeroShifted) {
            let idealInst = f._instPortionAmt !== undefined ? f._instPortionAmt : Math.max(0, (f.amount || 0) - delivPart);
            dynInstEntries.push({ flow: f, idealAmt: idealInst, isMerged: true });
        } else {
            f._instPortionAmt = 0;
            f.amount = delivPart;
        }
    });

    pureInstFlows.forEach(f => {
        if (f._isZeroShifted) {
            f.amount = 0;
        } else if (f._isFixedInst) {
            f.amount = Math.round(f.amount);
            fixedInstSum += f.amount;
        } else {
            dynInstEntries.push({ flow: f, idealAmt: f.amount || 0, isMerged: false });
        }
    });

    let remForDyn = targetTotal - sumNonInst - fixedInstSum;

    if (dynInstEntries.length > 0) {
        let isStandardUniform = dynInstEntries.every(d => Math.abs(d.idealAmt - dynInstEntries[0].idealAmt) < 0.5);
        if (isStandardUniform) {
            let uniformAmt = Math.round(dynInstEntries[0].idealAmt);
            dynInstEntries.forEach(d => {
                if (d.isMerged) {
                    d.flow._instPortionAmt = uniformAmt;
                    d.flow.amount = (d.flow._delivPortionAmt || 0) + uniformAmt;
                } else {
                    d.flow.amount = uniformAmt;
                }
            });
        } else {
            let sumIdeal = dynInstEntries.reduce((s, d) => s + (d.idealAmt || 0), 0);
            dynInstEntries.forEach(d => {
                let share = sumIdeal > 0 ? ((d.idealAmt / sumIdeal) * remForDyn) : (remForDyn / dynInstEntries.length);
                d.floorVal = Math.floor(share);
                d.remainder = share - d.floorVal;
            });

            let curSum = dynInstEntries.reduce((s, d) => s + d.floorVal, 0);
            let deficit = remForDyn - curSum;

            let sorted = dynInstEntries.map((d, idx) => ({ d, idx })).sort((a, b) => b.d.remainder - a.d.remainder);
            for (let k = 0; k < deficit; k++) {
                sorted[k].d.floorVal += 1;
            }

            dynInstEntries.forEach(d => {
                let instPart = d.floorVal;
                if (d.isMerged) {
                    d.flow._instPortionAmt = instPart;
                    d.flow.amount = (d.flow._delivPortionAmt || 0) + instPart;
                } else {
                    d.flow.amount = instPart;
                }
            });
        }
    }

    nonMnt.forEach(f => {
        f.pv = f.amount * (f.pvFactor !== undefined ? f.pvFactor : 1.0);
    });

    return flows;
}

function applyPerfectPercentages(flows, totalAmt) {
    if (!flows || !Array.isArray(flows)) return [];
    let nonMnt = flows.filter(f => !f.isMnt);
    let sumAssignedAmt = nonMnt.reduce((s, f) => s + Math.round(f.amount || 0), 0);
    let validTotal = sumAssignedAmt > 0 ? sumAssignedAmt : ((totalAmt > 0 && !isNaN(totalAmt)) ? totalAmt : 0);
    if (validTotal <= 0) return flows;

    // Step 1: Assign exact percentages to zero flows and explicitly fixed milestones
    nonMnt.forEach(f => {
        let amt = Math.round(f.amount || 0);
        f.amount = amt;
        f.pv = amt * (f.pvFactor !== undefined ? f.pvFactor : 1.0);
        if (amt <= 0 || f._isZeroShifted) {
            f.exactPct = 0.0;
        } else if (!f.exactPct || isNaN(f.exactPct) || f.exactPct <= 0) {
            f.exactPct = validTotal > 0 ? (amt / validTotal) : 0.0;
        }

        // Is zero flow (e.g. zeroed/shifted installment)
        if (amt <= 0 || f._isZeroShifted) {
            f.exactPct = 0;
            f._pctVal = 0.0;
            f.displayPct = '0.00';
            return;
        }

        // Overridden by table input explicitly in %
        if (f.isFixedOverride && f._exactFixedPct !== undefined && f._exactFixedPct !== null) {
            f._pctVal = Math.round(f._exactFixedPct * 100) / 100;
            f.displayPct = f._pctVal.toFixed(2);
            return;
        }

        // Milestone with exact fixed percentage
        if (!f.isInst && !f.isMerged && f._exactFixedPct !== undefined && f._exactFixedPct !== null) {
            f.exactPct = f._exactFixedPct / 100.0;
            f._pctVal = Math.round(f._exactFixedPct * 100) / 100;
            f.displayPct = f._pctVal.toFixed(2);
            return;
        }

        // Milestone with default percentage (when NOT overridden by custom amount)
        if (!f.isInst && !f.isMerged && f.defaultPct !== undefined && f.defaultPct !== null && !f._exactFixedVal) {
            f.exactPct = f.defaultPct;
            f._pctVal = Math.round(f.defaultPct * 10000) / 100;
            f.displayPct = f._pctVal.toFixed(2);
            return;
        }

        // Milestone fixed by cash amount (e.g. DP1 fixed as 10,000,000 EGP)
        if (!f.isInst && !f.isMerged && f._exactFixedVal !== undefined && f._exactFixedVal > 0) {
            let rawPct = (amt / validTotal) * 100;
            f._pctVal = Math.round(rawPct * 100) / 100;
            f.displayPct = f._pctVal.toFixed(2);
            return;
        }
    });

    // Step 2: Smart Grouping for Installments (Pure and Merged)
    let activeInsts = nonMnt.filter(f => (f.isInst || f.isMerged) && (f.amount > 0) && !f._isZeroShifted);
    
    activeInsts.forEach(f => {
        if (f.isMerged) {
            let delivAmt = (f._delivPortionAmt !== undefined && f._delivPortionAmt !== null) 
                ? f._delivPortionAmt 
                : (f._savedMergedDelivAmt || (f._delivDefaultPct ? Math.round(validTotal * f._delivDefaultPct) : Math.round(validTotal * 0.05)));
            f._delivPart = delivAmt;
            f._instPart = Math.max(0, f.amount - delivAmt);
        } else {
            f._instPart = f.amount;
        }
    });

    let groups = [];
    activeInsts.forEach(f => {
        if (f.isFixedOverride && f._exactFixedPct !== undefined) {
            groups.push({ flows: [f], targetVal: f._instPart });
            return;
        }
        let grp = groups.find(g => Math.abs(g.targetVal - f._instPart) <= 5);
        if (grp) {
            grp.flows.push(f);
        } else {
            groups.push({ flows: [f], targetVal: f._instPart });
        }
    });

    groups.forEach(g => {
        let totalPart = g.flows.reduce((s, f) => s + f._instPart, 0);
        let avgPart = totalPart / g.flows.length;
        let uniformRawPct = (avgPart / validTotal) * 100;
        let uniformPctVal = Math.round(uniformRawPct * 100) / 100;
        let uniformDisplayPct = uniformPctVal.toFixed(2);
        let refInst = g.flows.find(f => !f.isMerged) || g.flows[0];
        let exactInstPct = (refInst && refInst.defaultPct !== undefined && refInst.defaultPct > 0)
            ? refInst.defaultPct
            : (validTotal > 0 ? (avgPart / validTotal) : (uniformRawPct / 100.0));

        g.flows.forEach(f => {
            if (f.isFixedOverride && f._exactFixedPct !== undefined) {
                f.exactPct = f._exactFixedPct / 100.0;
                f._pctVal = Math.round(f._exactFixedPct * 100) / 100;
                f.displayPct = f._pctVal.toFixed(2);
            } else if (f.isMerged) {
                let delivAmt = f._delivPart !== undefined ? f._delivPart : (f._delivPortionAmt || (validTotal * 0.05));
                let delivPct = (f._exactMergedDelivPct !== undefined && f._exactMergedDelivPct !== null)
                    ? (f._exactMergedDelivPct / 100.0)
                    : (f._delivDefaultPct !== undefined ? f._delivDefaultPct : (validTotal > 0 ? (delivAmt / validTotal) : 0.05));
                let mergedExactPct = delivPct + exactInstPct;
                f.exactPct = mergedExactPct;
                let mergedPctVal = Math.round(mergedExactPct * 10000) / 100;
                f._pctVal = mergedPctVal;
                f.displayPct = mergedPctVal.toFixed(2);
            } else {
                f.exactPct = exactInstPct;
                f._pctVal = uniformPctVal;
                f.displayPct = uniformDisplayPct;
            }
        });
    });

    nonMnt.forEach(f => {
        if (f.displayPct === undefined || f.displayPct === null) {
            let rawPct = ((f.amount || 0) / validTotal) * 100;
            f._pctVal = Math.round(rawPct * 100) / 100;
            f.displayPct = f._pctVal.toFixed(2);
        }
    });

    // Step 3: Strict 100.00% Sum Guarantee without breaking regular installment uniformity
    // Regular identical installments MUST stay 100% uniform (never split into 2.58% and 2.57%).
    // Any balancing difference (diffCents) is absorbed by the delivery milestone or DP1.
    let activeNonMnt = nonMnt.filter(f => (f.amount > 0) && !f._isZeroShifted);
    if (activeNonMnt.length > 0) {
        let totalCents = 10000; // 100.00%
        let sumAssignedCents = 0;
        
        activeNonMnt.forEach(f => {
            let pVal = parseFloat(f.displayPct) || 0;
            let cents = Math.round(pVal * 100);
            f._cents = cents;
            sumAssignedCents += cents;
        });

        let diffCents = totalCents - sumAssignedCents;
        if (diffCents !== 0) {
            // Find single milestone target (Delivery or Merged delivery or DP1) to absorb rounding delta
            let delivTarget = activeNonMnt.find(f => f.isMerged || f.id === 'deliv' || (f.label && f.label.includes('Delivery') && !f.isInst));
            if (!delivTarget) {
                delivTarget = activeNonMnt.find(f => f.id === 'dp1' || f.isDP) || activeNonMnt[activeNonMnt.length - 1];
            }
            if (delivTarget && delivTarget._cents !== undefined) {
                delivTarget._cents += diffCents;
                delivTarget._pctVal = delivTarget._cents / 100.0;
                delivTarget.displayPct = delivTarget._pctVal.toFixed(2);
            }
        }
    }

    flows.forEach(f => {
        if (f.isMnt) {
            f.exactPct = 0.04;
            f.displayPct = '4.00';
        }
    });

    return flows;
}





// --- Excel Export & Clipboard Helpers ---
window.getExcelPercentagesText = function() {
    if (!window.globalCustomFlows || window.globalCustomFlows.length === 0) {
        return '';
    }
    let nonMnt = window.globalCustomFlows.filter(f => !f.isMnt);
    let offerPrice = window.lastCalculatedPrice || basePriceCache || 0;
    
    let freqEl = document.getElementById('payment-frequency');
    let freqMonths = (freqEl && parseInt(freqEl.value) === 2) ? 6 : 3;

    let isPerla = (currentProject === 'Perla');
    let isOrb = (currentProject === 'ORB');
    let isZomra = (currentProject === 'Zomra');
    let isJirian = (currentProject === 'Jirian');
    let rowCount = isZomra ? 43 : 42;
    let excelRatios = new Array(rowCount).fill(0.0);

    let dp1Flow = nonMnt.find(f => f.id === 'dp1');
    let dp2Flow = nonMnt.find(f => f.id === 'dp2');
    let addlFlow = nonMnt.find(f => f.id === 'addl');
    let delivFlow = nonMnt.find(f => f.id === 'deliv');
    let instFlows = nonMnt.filter(f => (f.isInst || f.isMerged));

    let totalNonMntAmt = nonMnt.reduce((s, f) => s + Math.round(f.amount || 0), 0);
    let effPrice = totalNonMntAmt > 0 ? totalNonMntAmt : offerPrice;

    let getRatio = (flow) => {
        if (!flow || flow._isZeroShifted || !flow.amount || flow.amount <= 0) return 0.0;
        if (flow.exactPct !== undefined && !isNaN(flow.exactPct) && flow.exactPct > 0) {
            return flow.exactPct;
        }
        return effPrice > 0 ? (flow.amount / effPrice) : 0.0;
    };

    if (isPerla || isOrb) {
        if (dp1Flow) excelRatios[0] = getRatio(dp1Flow);
        if (dp2Flow) excelRatios[1] = getRatio(dp2Flow);

        if (freqMonths === 6) {
            instFlows.forEach((inst, idx) => {
                let rIdx = 3 + idx * 2;
                if (rIdx < rowCount) {
                    excelRatios[rIdx] = getRatio(inst);
                }
            });
        } else {
            instFlows.forEach((inst, idx) => {
                let rIdx = 2 + idx;
                if (rIdx < rowCount) {
                    excelRatios[rIdx] = getRatio(inst);
                }
            });
        }

        if (delivFlow && delivFlow.amount > 0 && !instFlows.some(f => f.hasDeliv || (f.mergedIds && f.mergedIds.includes('deliv')))) {
            let delivIdx = isOrb ? (freqMonths === 6 ? 7 : 8) : (freqMonths === 6 ? 17 : 17);
            if (delivIdx < rowCount) excelRatios[delivIdx] += getRatio(delivFlow);
        }
    } else if (isZomra) {
        if (dp1Flow) excelRatios[0] = getRatio(dp1Flow);
        if (dp2Flow) excelRatios[1] = getRatio(dp2Flow);

        if (freqMonths === 6) {
            if (addlFlow) excelRatios[3] = getRatio(addlFlow);
            instFlows.forEach((inst, idx) => {
                let rIdx = 4 + idx * 2;
                if (rIdx < rowCount) {
                    excelRatios[rIdx] = getRatio(inst);
                }
            });
        } else {
            if (instFlows.length > 0) excelRatios[2] = getRatio(instFlows[0]);
            if (addlFlow) excelRatios[3] = getRatio(addlFlow);
            for (let idx = 1; idx < instFlows.length; idx++) {
                let rIdx = 3 + idx;
                if (rIdx < rowCount) {
                    excelRatios[rIdx] = getRatio(instFlows[idx]);
                }
            }
        }

        if (delivFlow && delivFlow.amount > 0 && !instFlows.some(f => f.hasDeliv || (f.mergedIds && f.mergedIds.includes('deliv')))) {
            let delivIdx = 14;
            if (delivIdx < rowCount) excelRatios[delivIdx] += getRatio(delivFlow);
        }
    } else { // Jirian
        if (dp1Flow) excelRatios[0] = getRatio(dp1Flow);
        if (dp2Flow) excelRatios[1] = getRatio(dp2Flow);
        instFlows.forEach((inst, idx) => {
            let rIdx = 2 + idx;
            if (rIdx < rowCount) excelRatios[rIdx] = getRatio(inst);
        });
    }

    return excelRatios.map(r => {
        if (r <= 0) return '0%';
        let pct = r * 100;
        let rounded = parseFloat(pct.toFixed(8));
        return rounded + '%';
    }).join('\n');
};

window.copyExcelPercentages = function() {
    let textToCopy = window.getExcelPercentagesText();
    if (!textToCopy) {
        alert('لا توجد بيانات جدول لنسخها.');
        return;
    }
    let lines = textToCopy.split('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            alert('تم نسخ ' + lines.length + ' نسبة بنجاح لصقها في عمود L (من L16) في شيت الإكسيل بدقة تامة.');
        }).catch(() => {
            copyFallback(textToCopy);
        });
    } else {
        copyFallback(textToCopy);
    }
};

window.copyFullTableTSV = function() {
    if (!window.globalCustomFlows || window.globalCustomFlows.length === 0) {
        alert('لا توجد بيانات جدول لنسخها.');
        return;
    }
    let rows = ['الدفعة\tالتاريخ\tالنسبة\tالقيمة (EGP)'];
    window.globalCustomFlows.forEach(f => {
        rows.push(`${f.label}\t${f.date}\t${f.displayPct}%\t${Math.round(f.amount || 0)}`);
    });
    let tsv = rows.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(tsv).then(() => {
            alert('تم نسخ جدول الدفعات بالكامل بنجاح. يمكنك لصقه مباشرة في أي برنامج إكسيل (Ctrl+V).');
        }).catch(() => {
            copyFallback(tsv);
        });
    } else {
        copyFallback(tsv);
    }
};

window.copyFallback = function(text) {
    let textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        alert('تم النسخ للحافظة بنجاح!');
    } catch (err) {
        alert('تعذر النسخ تلقائياً، يرجى التحديد والنسخ يدوياً.');
    }
    document.body.removeChild(textarea);
};
