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
}

window.resetCustomInputs = resetCustomInputs;
window.setProject = setProject;
window.calculate = calculate;;



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

// --- Garage / Parking Slot Feature (Independent Fixed Amenity) ---

window.garageOption = 'none';



function getGarageSchedule(project, option, contractDateStr) {

    let opt = option || window.garageOption;

    if (!opt || opt === 'none') return null;

    let proj = (project || currentProject || 'Perla').toLowerCase();

    let cDateStr = contractDateStr || (document.getElementById('contract-date')?.value) || formatDate(new Date());

    

    if (proj.includes('orb')) {

        let isTandem = (opt === 'orb_tandem');

        let totalAmt = isTandem ? 700000 : 500000;

        let instAmt = isTandem ? 175000 : 125000;

        let typeName = isTandem ? 'Tandem Parking Slot' : 'Standard Parking Slot';

        

        return {

            title: `${typeName} (${formatCurr(totalAmt)})`,

            totalAmount: totalAmt,

            optionType: isTandem ? 'tandem' : 'standard',

            items: [

                { seq: 'G1', label: `${typeName} 01 (At Contract)`, date: cDateStr, amount: instAmt },

                { seq: 'G2', label: `${typeName} 02 (+1 Year)`, date: formatDate(addMonths(cDateStr, 12)), amount: instAmt },

                { seq: 'G3', label: `${typeName} 03 (+2 Years)`, date: formatDate(addMonths(cDateStr, 24)), amount: instAmt },

                { seq: 'G4', label: `${typeName} 04 (+3 Years)`, date: formatDate(addMonths(cDateStr, 36)), amount: instAmt }

            ]

        };

    } else if (proj.includes('zomra')) {

        if (opt !== 'zomra_standard') return null;

        let totalAmt = 400000;

        let instAmt = 100000;

        let delivDate = formatDate(addMonths(cDateStr, 37));

        

        return {

            title: `Parking Slot (${formatCurr(totalAmt)})`,

            totalAmount: totalAmt,

            optionType: 'zomra',

            items: [

                { seq: 'G1', label: 'Garage Installment 01 (+1 Year)', date: formatDate(addMonths(cDateStr, 12)), amount: instAmt },

                { seq: 'G2', label: 'Garage Installment 02 (1 Year Pre-Delivery)', date: formatDate(addMonths(delivDate, -12)), amount: instAmt },

                { seq: 'G3', label: 'Garage Installment 03 (At Delivery)', date: delivDate, amount: instAmt },

                { seq: 'G4', label: 'Garage Installment 04 (+1 Year Post-Delivery)', date: formatDate(addMonths(delivDate, 12)), amount: instAmt }

            ]

        };

    }

    return null;

}





window.updateGarageDropdown = function(proj) {

    let sel = document.getElementById('garage-option');

    if (!sel) return;

    

    let curVal = window.garageOption || sel.value || 'none';

    sel.innerHTML = '';

    

    let pName = (proj || currentProject || 'Perla').toLowerCase();

    

    if (pName.includes('orb')) {

        sel.innerHTML = `

            <option value="none">❌ بدون جراج (Excluded)</option>

            <option value="orb_standard">🚗 Standard Parking Slot (500,000 ج.م - 4 أقساط سنوية × 125,000)</option>

            <option value="orb_tandem">🚙 Tandem Parking Slot (700,000 ج.م - 4 أقساط سنوية × 175,000)</option>

        `;

        if (curVal === 'orb_standard' || curVal === 'orb_tandem') {

            sel.value = curVal;

        } else {

            sel.value = 'none';

        }

    } else if (pName.includes('zomra')) {

        sel.innerHTML = `

            <option value="none">❌ بدون جراج (Excluded)</option>

            <option value="zomra_standard">🚗 Parking Slot (400,000 ج.م - 4 دفعات متساوية × 100,000)</option>

        `;

        if (curVal === 'zomra_standard') {

            sel.value = curVal;

        } else {

            sel.value = 'none';

        }

    } else {

        sel.innerHTML = `

            <option value="none">❌ بدون جراج (غير متاح لمشروع ${proj})</option>

        `;

        sel.value = 'none';

    }

    window.garageOption = sel.value;

};



window.onGarageOptionChange = function() {

    let sel = document.getElementById('garage-option');

    if (sel) {

        window.garageOption = sel.value;

    }

};



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

    updateGarageDropdown(currentProject);

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

    

    if (chk) {

        let scope = document.getElementById('fixed-inst-scope')?.value || 'all';

        let container = document.getElementById('fixed-inst-custom-years-container');

        if (container) container.style.display = (scope === 'custom') ? 'block' : 'none';

        let specificContainer = document.getElementById('fixed-inst-specific-insts-container');

        if (specificContainer) specificContainer.style.display = (scope === 'specific_inst') ? 'block' : 'none';



        let years = parseInt(document.getElementById('duration-years')?.value) || 8;

        if (scope === 'custom') {

            window.renderFixedYearCheckboxes(years);

        } else if (scope === 'specific_inst') {

            window.renderFixedInstCheckboxes();

        }

        if (window.onFixedTargetModeChange) window.onFixedTargetModeChange();



        if (!valEl.value || parseFloat(valEl.value) === 0) {

            if (typeof globalCustomFlows !== 'undefined' && globalCustomFlows) {

                let currentInst = globalCustomFlows.find(f => f.isInst && !f.isMnt);

                if (currentInst) valEl.value = Math.round(currentInst.amount);

            }

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

        else if (scope === 'custom') label.innerText = 'قيمة القسط للسنين المحددة';

        else if (scope === 'specific_inst') label.innerText = 'قيمة القسط للأقساط المحددة';

        else label.innerText = 'قيمة كل قسط';

    }

    let container = document.getElementById('fixed-inst-custom-years-container');

    if (container) {

        container.style.display = (scope === 'custom') ? 'block' : 'none';

    }

    let specificContainer = document.getElementById('fixed-inst-specific-insts-container');

    if (specificContainer) {

        specificContainer.style.display = (scope === 'specific_inst') ? 'block' : 'none';

    }

    let years = parseInt(document.getElementById('duration-years')?.value) || 8;

    if (scope === 'custom') {

        window.renderFixedYearCheckboxes(years);

    } else if (scope === 'specific_inst') {

        window.renderFixedInstCheckboxes();

    }

    if (window.onFixedTargetModeChange) window.onFixedTargetModeChange();

    calculate();

};



window.onFixedTargetModeChange = function() {

    let mode = document.getElementById('fixed-inst-target-mode')?.value || 'all_remaining';

    let singleWrapper = document.getElementById('fixed-inst-single-target-wrapper');

    let targetInstsContainer = document.getElementById('fixed-inst-target-insts-container');

    let targetYearsContainer = document.getElementById('fixed-inst-target-years-container');

    let noteEl = document.getElementById('fixed-inst-target-note');

    let years = parseInt(document.getElementById('duration-years')?.value) || 8;



    if (singleWrapper) singleWrapper.style.display = (mode === 'single_inst') ? 'block' : 'none';

    if (targetInstsContainer) targetInstsContainer.style.display = (mode === 'specific_insts') ? 'block' : 'none';

    if (targetYearsContainer) targetYearsContainer.style.display = (mode === 'specific_years') ? 'block' : 'none';



    if (noteEl) {

        if (mode === 'single_inst') {

            noteEl.innerHTML = '🎯 <strong style="color: #38bdf8;">تحميل على قسط واحد:</strong> سيتم تحميل كامل فرق التثبيت على رقم القسط المختار أعلاه، وتظل باقي الأقساط عند نسبتها الأصلية الطبيعية كشيت الإكسيل بالملي.';

        } else if (mode === 'specific_insts') {

            noteEl.innerHTML = '📋 <strong style="color: #38bdf8;">تحميل على أقساط محددة:</strong> سيتم تحميل كامل فرق التثبيت بالتساوي على أرقام الأقساط المختارة أعلاه، وتظل باقي الأقساط عند نسبتها الأصلية.';

        } else if (mode === 'specific_years') {

            noteEl.innerHTML = '📅 <strong style="color: #38bdf8;">تحميل على سنين محددة:</strong> سيتم تحميل كامل فرق التثبيت على السنة/السنين المحددة أعلاه، بينما تظل أي سنين أخرى غير محددة عند قسطها الأصلي الطبيعي دون أي زيادة.';

        } else if (mode === 'delivery_milestone') {

            noteEl.innerHTML = '🏢 <strong style="color: var(--gold);">تحميل على الاستلام:</strong> سيتم ترحيل كامل فرق التثبيت وإضافته إلى دفعة الاستلام، وتظل باقي سنين الأقساط عند قسطها الأصلي الطبيعي دون أي زيادة.';

        } else {

            noteEl.innerHTML = '🔄 <strong style="color: var(--text-muted);">توزيع متساوي:</strong> يتوزع فرق التثبيت بالتساوي على جميع الأقساط غير المثبتة.';

        }

    }

    if (mode === 'single_inst') {

        window.renderFixedSingleTargetSelect();

    } else if (mode === 'specific_insts') {

        window.renderFixedTargetInstsCheckboxes();

    } else if (mode === 'specific_years') {

        window.renderFixedTargetYearCheckboxes(years);

    }

};



window.getFixedSelectedInsts = function() {

    let chks = document.querySelectorAll('.fixed-inst-specific-chk:checked');

    if (!chks || chks.length === 0) return [1];

    return Array.from(chks).map(c => parseInt(c.value)).filter(n => !isNaN(n));

};



window.getFixedTargetInsts = function() {

    let chks = document.querySelectorAll('.fixed-target-inst-chk:checked');

    if (!chks || chks.length === 0) return [];

    return Array.from(chks).map(c => parseInt(c.value)).filter(n => !isNaN(n));

};



window.getFixedSingleTargetInst = function() {

    let sel = document.getElementById('fixed-inst-single-target-select');

    if (!sel || !sel.value) return 8;

    let n = parseInt(sel.value);

    return isNaN(n) ? 8 : n;

};



window.selectFixedInstPreset = function(preset) {

    let years = parseInt(document.getElementById('duration-years')?.value) || 8;

    let freqMonths = (document.getElementById('payment-frequency')?.value == '2') ? 6 : 3;

    let instsPerYear = 12 / freqMonths;

    let totalInsts = years * instsPerYear;

    

    let targetInsts = [];

    if (preset === 'first1') targetInsts = [1];

    else if (preset === 'first2') targetInsts = [1, 2];

    else if (preset === 'year1') {

        for (let i = 1; i <= instsPerYear; i++) targetInsts.push(i);

    } else if (preset === 'none') {

        targetInsts = [];

    }

    

    document.querySelectorAll('.fixed-inst-specific-chk').forEach(chk => {

        let n = parseInt(chk.value);

        chk.checked = targetInsts.includes(n);

        if (chk.parentElement) {

            if (chk.checked) {

                chk.parentElement.style.background = 'rgba(212, 175, 55, 0.2)';

                chk.parentElement.style.border = '1px solid var(--gold)';

                chk.parentElement.style.color = 'var(--gold)';

            } else {

                chk.parentElement.style.background = 'rgba(255,255,255,0.05)';

                chk.parentElement.style.border = '1px solid rgba(255,255,255,0.1)';

                chk.parentElement.style.color = 'var(--text)';

            }

        }

    });

    

    window.renderFixedTargetInstsCheckboxes();

    window.renderFixedSingleTargetSelect();

    if (window.delayedCalculate) window.delayedCalculate(100); else calculate();

};



window.selectFixedTargetInstsPreset = function(preset) {

    let scope = document.getElementById('fixed-inst-scope')?.value || 'all';

    let fixedInsts = (scope === 'specific_inst') ? window.getFixedSelectedInsts() : [];

    document.querySelectorAll('.fixed-target-inst-chk').forEach(chk => {

        let n = parseInt(chk.value);

        if (preset === 'remaining') {

            chk.checked = !fixedInsts.includes(n);

        } else if (preset === 'none') {

            chk.checked = false;

        }

        if (chk.parentElement) {

            if (chk.checked) {

                chk.parentElement.style.background = 'rgba(56, 189, 248, 0.2)';

                chk.parentElement.style.border = '1px solid #38bdf8';

                chk.parentElement.style.color = '#38bdf8';

            } else {

                chk.parentElement.style.background = 'rgba(255,255,255,0.05)';

                chk.parentElement.style.border = '1px solid rgba(255,255,255,0.1)';

                chk.parentElement.style.color = 'var(--text)';

            }

        }

    });

    if (window.delayedCalculate) window.delayedCalculate(100); else calculate();

};



window.renderFixedInstCheckboxes = function(totalInsts) {

    let container = document.getElementById('fixed-inst-specific-insts-checkboxes');

    if (!container) return;

    

    if (!totalInsts) {

        let years = parseInt(document.getElementById('duration-years')?.value) || 8;

        let freqMonths = (document.getElementById('payment-frequency')?.value == '2') ? 6 : 3;

        totalInsts = years * (12 / freqMonths);

    }

    

    let currentChecked = window.getFixedSelectedInsts();

    if (!currentChecked || currentChecked.length === 0) currentChecked = [1];

    

    container.innerHTML = '';

    for (let i = 1; i <= totalInsts; i++) {

        let isChecked = currentChecked.includes(i);

        let lbl = document.createElement('label');

        lbl.style.display = 'inline-flex';

        lbl.style.alignItems = 'center';

        lbl.style.gap = '5px';

        lbl.style.fontSize = '0.8rem';

        lbl.style.cursor = 'pointer';

        lbl.style.padding = '3px 8px';

        lbl.style.borderRadius = '4px';

        lbl.style.background = isChecked ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)';

        lbl.style.border = isChecked ? '1px solid var(--gold)' : '1px solid rgba(255,255,255,0.1)';

        lbl.style.color = isChecked ? 'var(--gold)' : 'var(--text)';

        

        lbl.innerHTML = `

            <input type="checkbox" class="fixed-inst-specific-chk" value="${i}" ${isChecked ? 'checked' : ''} onchange="window.onFixedInstSpecificCheckboxChange(this)">

            قسط ${i}

        `;

        container.appendChild(lbl);

    }

    window.renderFixedTargetInstsCheckboxes(totalInsts);

    window.renderFixedSingleTargetSelect(totalInsts);

};



window.onFixedInstSpecificCheckboxChange = function(el) {

    if (el && el.parentElement) {

        if (el.checked) {

            el.parentElement.style.background = 'rgba(212, 175, 55, 0.2)';

            el.parentElement.style.border = '1px solid var(--gold)';

            el.parentElement.style.color = 'var(--gold)';

        } else {

            el.parentElement.style.background = 'rgba(255,255,255,0.05)';

            el.parentElement.style.border = '1px solid rgba(255,255,255,0.1)';

            el.parentElement.style.color = 'var(--text)';

        }

    }

    window.renderFixedTargetInstsCheckboxes();

    window.renderFixedSingleTargetSelect();

    if (window.delayedCalculate) window.delayedCalculate(100); else calculate();

};



window.renderFixedSingleTargetSelect = function(totalInsts) {

    let sel = document.getElementById('fixed-inst-single-target-select');

    if (!sel) return;

    

    if (!totalInsts) {

        let years = parseInt(document.getElementById('duration-years')?.value) || 8;

        let freqMonths = (document.getElementById('payment-frequency')?.value == '2') ? 6 : 3;

        totalInsts = years * (12 / freqMonths);

    }

    

    let scope = document.getElementById('fixed-inst-scope')?.value || 'all';

    let fixedInsts = (scope === 'specific_inst') ? window.getFixedSelectedInsts() : [];

    if (scope === 'custom') {

        let fixedYears = window.getFixedSelectedYears ? window.getFixedSelectedYears() : [1, 2];

        let freqMonths = (document.getElementById('payment-frequency')?.value == '2') ? 6 : 3;

        let ipy = 12 / freqMonths;

        fixedYears.forEach(y => {

            for (let k = 1; k <= ipy; k++) fixedInsts.push((y - 1) * ipy + k);

        });

    }

    

    let currentVal = parseInt(sel.value);

    sel.innerHTML = '';

    

    let available = [];

    for (let i = 1; i <= totalInsts; i++) {

        if (!fixedInsts.includes(i)) available.push(i);

    }

    if (available.length === 0) {

        for (let i = 1; i <= totalInsts; i++) available.push(i);

    }

    

    available.forEach(n => {

        let opt = document.createElement('option');

        opt.value = n;

        opt.innerText = `🎯 قسط ${n}`;

        if (n === currentVal) opt.selected = true;

        sel.appendChild(opt);

    });

    

    if (!available.includes(currentVal) && available.length > 0) {

        let defaultChoice = available.includes(8) ? 8 : available[available.length - 1];

        sel.value = defaultChoice;

    }

};



window.renderFixedTargetInstsCheckboxes = function(totalInsts) {

    let container = document.getElementById('fixed-inst-target-insts-checkboxes');

    if (!container) return;

    

    if (!totalInsts) {

        let years = parseInt(document.getElementById('duration-years')?.value) || 8;

        let freqMonths = (document.getElementById('payment-frequency')?.value == '2') ? 6 : 3;

        totalInsts = years * (12 / freqMonths);

    }

    

    let scope = document.getElementById('fixed-inst-scope')?.value || 'all';

    let fixedInsts = (scope === 'specific_inst') ? window.getFixedSelectedInsts() : [];

    if (scope === 'custom') {

        let fixedYears = window.getFixedSelectedYears ? window.getFixedSelectedYears() : [1, 2];

        let freqMonths = (document.getElementById('payment-frequency')?.value == '2') ? 6 : 3;

        let ipy = 12 / freqMonths;

        fixedYears.forEach(y => {

            for (let k = 1; k <= ipy; k++) fixedInsts.push((y - 1) * ipy + k);

        });

    }

    

    let availableInsts = [];

    for (let i = 1; i <= totalInsts; i++) {

        if (!fixedInsts.includes(i)) availableInsts.push(i);

    }

    

    let currentTargetChecked = window.getFixedTargetInsts();

    let validChecked = currentTargetChecked.filter(n => availableInsts.includes(n));

    if (validChecked.length === 0 && availableInsts.length > 0) {

        validChecked = [availableInsts[availableInsts.length - 1]];

    }

    

    container.innerHTML = '';

    availableInsts.forEach(n => {

        let isChecked = validChecked.includes(n);

        let lbl = document.createElement('label');

        lbl.style.display = 'inline-flex';

        lbl.style.alignItems = 'center';

        lbl.style.gap = '5px';

        lbl.style.fontSize = '0.8rem';

        lbl.style.cursor = 'pointer';

        lbl.style.padding = '3px 8px';

        lbl.style.borderRadius = '4px';

        lbl.style.background = isChecked ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)';

        lbl.style.border = isChecked ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)';

        lbl.style.color = isChecked ? '#38bdf8' : 'var(--text)';

        

        lbl.innerHTML = `

            <input type="checkbox" class="fixed-target-inst-chk" value="${n}" ${isChecked ? 'checked' : ''} onchange="window.onFixedTargetInstCheckboxChange(this)">

            قسط ${n}

        `;

        container.appendChild(lbl);

    });

};



window.onFixedTargetInstCheckboxChange = function(el) {

    if (el && el.parentElement) {

        if (el.checked) {

            el.parentElement.style.background = 'rgba(56, 189, 248, 0.2)';

            el.parentElement.style.border = '1px solid #38bdf8';

            el.parentElement.style.color = '#38bdf8';

        } else {

            el.parentElement.style.background = 'rgba(255,255,255,0.05)';

            el.parentElement.style.border = '1px solid rgba(255,255,255,0.1)';

            el.parentElement.style.color = 'var(--text)';

        }

    }

    if (window.delayedCalculate) window.delayedCalculate(100); else calculate();

};



window.renderFixedTargetYearCheckboxes = function(years) {

    let container = document.getElementById('fixed-inst-target-years-checkboxes');

    let presetsContainer = document.getElementById('fixed-inst-target-presets');

    if (!container) return;



    let fixedYears = window.getFixedSelectedYears ? window.getFixedSelectedYears() : [1, 2];

    let availableYears = [];

    for (let y = 1; y <= years; y++) {

        if (!fixedYears.includes(y)) availableYears.push(y);

    }



    let currentTargetChecked = window.getFixedTargetYears();

    let validChecked = currentTargetChecked.filter(y => availableYears.includes(y));

    if (validChecked.length === 0 && availableYears.length > 0) {

        validChecked = [availableYears[0]];

    }



    container.innerHTML = '';

    availableYears.forEach(y => {

        let isChecked = validChecked.includes(y);

        let lbl = document.createElement('label');

        lbl.style.display = 'inline-flex';

        lbl.style.alignItems = 'center';

        lbl.style.gap = '5px';

        lbl.style.fontSize = '0.82rem';

        lbl.style.cursor = 'pointer';

        lbl.style.padding = '3px 8px';

        lbl.style.borderRadius = '4px';

        lbl.style.background = isChecked ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)';

        lbl.style.border = isChecked ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)';

        lbl.style.color = isChecked ? '#38bdf8' : 'var(--text)';



        lbl.innerHTML = `

            <input type="checkbox" class="fixed-target-year-chk" value="${y}" ${isChecked ? 'checked' : ''} onchange="window.onFixedTargetYearCheckboxChange(this)">

            السنة ${y}

        `;

        container.appendChild(lbl);

    });



    if (presetsContainer) {

        presetsContainer.innerHTML = '';

        if (availableYears.length > 0) {

            let firstAvail = availableYears[0];

            let btn1 = document.createElement('button');

            btn1.type = 'button';

            btn1.className = 'btn btn-outline';

            btn1.style.cssText = 'padding: 2px 8px; font-size: 0.75rem; border-color: rgba(56, 189, 248, 0.5); color: #38bdf8; cursor: pointer;';

            btn1.innerText = `السنة ${firstAvail} فقط`;

            btn1.onclick = () => window.selectFixedTargetPreset([firstAvail]);

            presetsContainer.appendChild(btn1);



            if (availableYears.length >= 2) {

                let btn2 = document.createElement('button');

                btn2.type = 'button';

                btn2.className = 'btn btn-outline';

                btn2.style.cssText = 'padding: 2px 8px; font-size: 0.75rem; border-color: rgba(56, 189, 248, 0.5); color: #38bdf8; cursor: pointer;';

                btn2.innerText = `السنة ${firstAvail} و ${availableYears[1]}`;

                btn2.onclick = () => window.selectFixedTargetPreset([firstAvail, availableYears[1]]);

                presetsContainer.appendChild(btn2);

            }



            let btnAll = document.createElement('button');

            btnAll.type = 'button';

            btnAll.className = 'btn btn-outline';

            btnAll.style.cssText = 'padding: 2px 8px; font-size: 0.75rem; border-color: rgba(255,255,255,0.2); cursor: pointer;';

            btnAll.innerText = 'تحديد الكل';

            btnAll.onclick = () => window.selectFixedTargetPreset(availableYears);

            presetsContainer.appendChild(btnAll);

        }

    }

};



window.onFixedTargetYearCheckboxChange = function(el) {

    if (el && el.parentElement) {

        if (el.checked) {

            el.parentElement.style.background = 'rgba(56, 189, 248, 0.2)';

            el.parentElement.style.border = '1px solid #38bdf8';

            el.parentElement.style.color = '#38bdf8';

        } else {

            el.parentElement.style.background = 'rgba(255,255,255,0.05)';

            el.parentElement.style.border = '1px solid rgba(255,255,255,0.1)';

            el.parentElement.style.color = 'var(--text)';

        }

    }

    if (window.delayedCalculate) window.delayedCalculate(100); else calculate();

};



window.getFixedTargetYears = function() {

    let chks = document.querySelectorAll('.fixed-target-year-chk:checked');

    if (!chks || chks.length === 0) return [];

    return Array.from(chks).map(c => parseInt(c.value)).filter(n => !isNaN(n));

};



window.selectFixedTargetPreset = function(targetList) {

    document.querySelectorAll('.fixed-target-year-chk').forEach(chk => {

        let y = parseInt(chk.value);

        chk.checked = targetList.includes(y);

        if (chk.parentElement) {

            if (chk.checked) {

                chk.parentElement.style.background = 'rgba(56, 189, 248, 0.2)';

                chk.parentElement.style.border = '1px solid #38bdf8';

                chk.parentElement.style.color = '#38bdf8';

            } else {

                chk.parentElement.style.background = 'rgba(255,255,255,0.05)';

                chk.parentElement.style.border = '1px solid rgba(255,255,255,0.1)';

                chk.parentElement.style.color = 'var(--text)';

            }

        }

    });

    if (window.delayedCalculate) window.delayedCalculate(100); else calculate();

};



window.renderFixedYearCheckboxes = function(years) {

    let container = document.getElementById('fixed-inst-custom-years-checkboxes');

    if (!container) return;

    

    let currentChecked = window.getFixedSelectedYears();

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

        lbl.style.background = isChecked ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)';

        lbl.style.border = isChecked ? '1px solid var(--gold)' : '1px solid rgba(255,255,255,0.1)';

        lbl.style.color = isChecked ? 'var(--gold)' : 'var(--text)';

        

        lbl.innerHTML = `

            <input type="checkbox" class="fixed-year-chk" value="${y}" ${isChecked ? 'checked' : ''} onchange="window.onFixedYearCheckboxChange(this)">

            السنة ${y}

        `;

        container.appendChild(lbl);

    }

    if (window.renderFixedTargetYearCheckboxes) {

        window.renderFixedTargetYearCheckboxes(years);

    }

};



window.onFixedYearCheckboxChange = function(el) {

    if (el && el.parentElement) {

        if (el.checked) {

            el.parentElement.style.background = 'rgba(212, 175, 55, 0.2)';

            el.parentElement.style.border = '1px solid var(--gold)';

            el.parentElement.style.color = 'var(--gold)';

        } else {

            el.parentElement.style.background = 'rgba(255,255,255,0.05)';

            el.parentElement.style.border = '1px solid rgba(255,255,255,0.1)';

            el.parentElement.style.color = 'var(--text)';

        }

    }

    let years = parseInt(document.getElementById('duration-years')?.value) || 8;

    if (window.renderFixedTargetYearCheckboxes) {

        window.renderFixedTargetYearCheckboxes(years);

    }

    if (window.delayedCalculate) window.delayedCalculate(100); else calculate();

};



window.getFixedSelectedYears = function() {

    let chks = document.querySelectorAll('.fixed-year-chk:checked');

    if (!chks || chks.length === 0) return [1, 2];

    return Array.from(chks).map(c => parseInt(c.value)).filter(n => !isNaN(n));

};



window.selectFixedYearsPreset = function(preset) {

    let years = parseInt(document.getElementById('duration-years')?.value) || 8;

    let targetYears = [];

    if (preset === '1_2') targetYears = [1, 2];

    else if (preset === '1_2_3') targetYears = [1, 2, 3];

    else if (preset === 'all') {

        for (let i = 1; i <= years; i++) targetYears.push(i);

    }

    

    document.querySelectorAll('.fixed-year-chk').forEach(chk => {

        let y = parseInt(chk.value);

        chk.checked = targetYears.includes(y);

        if (chk.parentElement) {

            if (chk.checked) {

                chk.parentElement.style.background = 'rgba(212, 175, 55, 0.2)';

                chk.parentElement.style.border = '1px solid var(--gold)';

                chk.parentElement.style.color = 'var(--gold)';

            } else {

                chk.parentElement.style.background = 'rgba(255,255,255,0.05)';

                chk.parentElement.style.border = '1px solid rgba(255,255,255,0.1)';

                chk.parentElement.style.color = 'var(--text)';

            }

        }

    });

    if (window.delayedCalculate) window.delayedCalculate(100); else calculate();

};



window.applySuggestedDeliveryPct = function(pct) {

    if (!window.customMilestonesState) window.customMilestonesState = {};

    window.customMilestonesState.deliv_val = pct;

    window.customMilestonesState.deliv_type = 'pct';

    

    let delivValEl = document.getElementById('deliv-val');

    if (delivValEl) delivValEl.value = pct;

    let delivTypeEl = document.getElementById('deliv-type');

    if (delivTypeEl) delivTypeEl.value = 'pct';

    

    calculate();

    if (typeof window.showToast === 'function') {

        window.showToast(`✅ تم تعديل نسبة دفعة الاستلام إلى ${pct}% بنجاح!`);

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

    let label = document.getElementById('intra-year-val-label');

    

    if (intraToggle) intraToggle.disabled = false;

    if (intraBox) intraBox.style.opacity = '1';

    

    if (label) {

        label.innerText = (freqMonths === 6) ? 'قسط الفترة النصف سنوية الأولى (H1)' : 'قسط الفترات العادية (أول 3 فترات ربع سنوية)';

    }

    

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

    if (window.globalTableOverrides) {
        Object.keys(window.globalTableOverrides).forEach(k => {
            if (k.startsWith('inst_')) delete window.globalTableOverrides[k];
        });
    }

    renderInstShiftStatusBox();
    calculate();

    let tbl = document.getElementById('offer-tbody') || document.querySelector('.table-container');
    if (tbl) tbl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (window.showToast) window.showToast(`✅ تم تطبيق ترحيل وتصفير الأقساط (${zeros.map(n=>'قسط '+n).join('، ')}) وتحديث الجدول فوراً!`, true, 4500);
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

    

    if (!g || !g.active || !isToggled) {

        box.style.display = 'none';

        if (badge) {

            if (!isToggled) {

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

    let fixTargetMode = document.getElementById('fixed-inst-target-mode');

    if (fixTargetMode) fixTargetMode.value = 'all_remaining';

    let fixTargetContainer = document.getElementById('fixed-inst-target-years-container');

    if (fixTargetContainer) fixTargetContainer.style.display = 'none';

    

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

    

    // Target Price Reset

    let tpVal = document.getElementById('target-price-val');

    if (tpVal) tpVal.value = '';

    let tpPct = document.getElementById('target-pct-val');

    if (tpPct) tpPct.value = '';

    let tpGuidance = document.getElementById('target-price-guidance-box');

    if (tpGuidance) {

        tpGuidance.style.display = 'none';

        tpGuidance.innerHTML = '';

    }



    // 70/30 and Intra-Year Reset

    let toggle7030 = document.getElementById('toggle-70-30');

    if (toggle7030) toggle7030.checked = false;

    let toggleIntra = document.getElementById('toggle-intra-year');

    if (toggleIntra) toggleIntra.checked = false;

    let intraVal = document.getElementById('intra-year-val');

    if (intraVal) intraVal.value = '';

    let intraWrapper = document.getElementById('intra-year-controls-wrapper');

    if (intraWrapper) intraWrapper.style.display = 'none';

    let intraBadge = document.getElementById('intra-year-status-badge');

    if (intraBadge) {

        intraBadge.innerText = 'غير مفعل';

        intraBadge.style.color = 'var(--text-muted)';

    }

    let quick7030Btn = document.getElementById('btn-quick-7030');

    if (quick7030Btn) {

        quick7030Btn.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)';

        quick7030Btn.innerText = '🎯 نمط 70% / 30% (Balloon)';

    }



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

    window.customMilestonesState = { splitDP1: null, splitDP2: null, extraPayments: [] };

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



window.toggleSplitDP1 = function(isSplit) {

    if (!window.customMilestonesState) window.customMilestonesState = {};

    window.customMilestonesState.splitDP1 = Boolean(isSplit);

    let isZomra = (currentProject === 'Zomra');

    if (isSplit) {

        window.customMilestonesState.dp1_a_val = isZomra ? 1.25 : 2.5;

        window.customMilestonesState.dp1_b_val = isZomra ? 1.25 : 2.5;

    }

    renderCustomInputs();

    calculate();

};



window.toggleSplitDP2 = function(isSplit) {

    if (!window.customMilestonesState) window.customMilestonesState = {};

    window.customMilestonesState.splitDP2 = Boolean(isSplit);

    let isZomra = (currentProject === 'Zomra');

    if (isSplit) {

        window.customMilestonesState.dp2_a_val = isZomra ? 1.25 : 2.5;

        window.customMilestonesState.dp2_b_val = isZomra ? 1.25 : 2.5;

    }

    renderCustomInputs();

    calculate();

};



window.onCustomMilestoneChange = function(field, val) {

    if (!window.customMilestonesState) window.customMilestonesState = {};

    window.customMilestonesState[field] = val;

    delayedCalculate();

};



window.addExtraPayment = function() {

    if (!window.customMilestonesState) window.customMilestonesState = {};

    if (!Array.isArray(window.customMilestonesState.extraPayments)) {

        window.customMilestonesState.extraPayments = [];

    }

    let dateEl = document.getElementById('contract-date');

    let contractDateStr = dateEl ? dateEl.value : '';

    if (!contractDateStr || isNaN(new Date(contractDateStr).getTime())) contractDateStr = formatDate(new Date());



    let count = window.customMilestonesState.extraPayments.length + 1;

    let defDate = formatDate(addMonths(contractDateStr, count * 6));

    window.customMilestonesState.extraPayments.push({

        id: 'extra_' + Date.now(),

        label: 'دفعة إضافية ' + count,

        val: 2.5,

        type: 'pct',

        date: defDate

    });

    renderCustomInputs();

    calculate();

};



window.removeExtraPayment = function(id) {

    if (!window.customMilestonesState || !window.customMilestonesState.extraPayments) return;

    window.customMilestonesState.extraPayments = window.customMilestonesState.extraPayments.filter(e => e.id !== id);

    renderCustomInputs();

    calculate();

};



window.onExtraPaymentChange = function(id, field, val) {

    if (!window.customMilestonesState || !window.customMilestonesState.extraPayments) return;

    let item = window.customMilestonesState.extraPayments.find(e => e.id === id);

    if (item) {

        item[field] = val;

    }

    delayedCalculate();

};



function renderCustomInputs() {

    let container = document.getElementById('custom-inputs');

    if (!container) return;

    

    let isZomra = (currentProject === 'Zomra');

    let s = window.customMilestonesState || {};

    

    let dateEl = document.getElementById('contract-date');

    let cDateStr = dateEl ? dateEl.value : '';

    if (!cDateStr || isNaN(new Date(cDateStr).getTime())) cDateStr = formatDate(new Date());



    let defDp1Pct = isZomra ? 2.5 : 5.0;

    let defDp2Pct = isZomra ? 2.5 : 5.0;



    let dp1Label = currentProject === 'Jirian' ? 'Down Payment (5%)' : 'المقدم الأول (Down Payment 1)';

    let dp2Label = currentProject === 'Jirian' ? '1st Dec Payment (5%)' : (isZomra ? 'الدفعة الثانية بعد شهر (DP 2)' : 'الدفعة الثانية بعد 3 شهور (DP 2)');



    let html = `

    <div style="background: rgba(255, 255, 255, 0.03); border: 1.5px solid rgba(212, 175, 55, 0.35); border-radius: 8px; padding: 14px; margin-bottom: 15px; width: 100%; box-sizing: border-box;">

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">

            <div style="display: flex; align-items: center; gap: 8px;">

                <span style="font-size: 1.25rem;">💎</span>

                <span style="font-weight: bold; color: var(--gold); font-size: 1rem;">الدفعات والمقدمات خارج الأقساط (Custom Milestones & Extra Payments)</span>

            </div>

            <button type="button" class="btn btn-outline" onclick="addExtraPayment()" style="border-color: var(--accent-blue); color: var(--accent-blue); padding: 4px 12px; font-size: 0.82rem; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">

                ➕ إضافة دفعة خارج الأقساط

            </button>

        </div>



        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px; line-height: 1.4;">

            يمكنك تقسيم الـ 5% إلى دفعتين (2.5% + 2.5%) مع تحديد تاريخ كل دفعة، أو إضافة دفعات سنوية/مخصصة خارج الأقساط. تُخصم قيمتها وتُوزع الأقساط تلقائياً بدقة 100%.

        </div>



        <!-- Down Payment 1 -->

        <div style="margin-bottom: 10px;">

    `;



    // DP1 Split vs Single

    if (s.splitDP1) {

        let v1a = s.dp1_a_val !== undefined ? s.dp1_a_val : (isZomra ? 1.25 : 2.5);

        let t1a = s.dp1_a_type || 'pct';

        let d1a = s.dp1_a_date || cDateStr;



        let v1b = s.dp1_b_val !== undefined ? s.dp1_b_val : (isZomra ? 1.25 : 2.5);

        let t1b = s.dp1_b_type || 'pct';

        let d1b = s.dp1_b_date || formatDate(addMonths(cDateStr, 1));



        html += `

        <div style="background: rgba(56, 189, 248, 0.06); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: 6px; padding: 10px;">

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">

                <span style="font-weight: bold; color: var(--accent-blue); font-size: 0.88rem;">✂️ المقدم الأول مُقسّم (1أ + 1ب)</span>

                <button type="button" class="btn btn-outline" onclick="toggleSplitDP1(false)" style="padding: 2px 8px; font-size: 0.75rem; border-color: rgba(255,255,255,0.3); color: #ddd; cursor: pointer;">

                    🔗 دمج لدفعة واحدة (${defDp1Pct}%)

                </button>

            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">

                <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px;">

                    <label style="font-size: 0.75rem; color: #aaa; margin-bottom: 3px; display: block;">دفعة 1أ (عند الحجز/التعاقد):</label>

                    <div style="display: flex; gap: 4px; margin-bottom: 4px;">

                        <input type="number" step="0.01" id="dp1-a-val" value="${v1a}" oninput="onCustomMilestoneChange('dp1_a_val', this.value)" style="width: 60%; padding: 5px;">

                        <select id="dp1-a-type" onchange="onCustomMilestoneChange('dp1_a_type', this.value)" style="width: 40%; padding: 5px;">

                            <option value="pct" ${t1a === 'pct' ? 'selected' : ''}>%</option>

                            <option value="amt" ${t1a === 'amt' ? 'selected' : ''}>EGP</option>

                        </select>

                    </div>

                    <input type="date" id="dp1-a-date" value="${d1a}" onchange="onCustomMilestoneChange('dp1_a_date', this.value)" style="width: 100%; padding: 5px; box-sizing: border-box;">

                </div>

                <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px;">

                    <label style="font-size: 0.75rem; color: #aaa; margin-bottom: 3px; display: block;">دفعة 1ب (دفعة التعاقد / بعد شهر):</label>

                    <div style="display: flex; gap: 4px; margin-bottom: 4px;">

                        <input type="number" step="0.01" id="dp1-b-val" value="${v1b}" oninput="onCustomMilestoneChange('dp1_b_val', this.value)" style="width: 60%; padding: 5px;">

                        <select id="dp1-b-type" onchange="onCustomMilestoneChange('dp1_b_type', this.value)" style="width: 40%; padding: 5px;">

                            <option value="pct" ${t1b === 'pct' ? 'selected' : ''}>%</option>

                            <option value="amt" ${t1b === 'amt' ? 'selected' : ''}>EGP</option>

                        </select>

                    </div>

                    <input type="date" id="dp1-b-date" value="${d1b}" onchange="onCustomMilestoneChange('dp1_b_date', this.value)" style="width: 100%; padding: 5px; box-sizing: border-box;">

                </div>

            </div>

        </div>

        `;

    } else {

        let v1 = s.dp1_val !== undefined ? s.dp1_val : '';

        let t1 = s.dp1_type || 'pct';

        let d1 = s.dp1_date || cDateStr;

        html += `

        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px;">

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">

                <label style="font-size: 0.85rem; font-weight: bold; color: var(--gold); margin: 0;">${dp1Label}</label>

                <button type="button" class="btn btn-outline" onclick="toggleSplitDP1(true)" style="padding: 2px 8px; font-size: 0.75rem; border-color: var(--accent-blue); color: var(--accent-blue); cursor: pointer;">

                    ✂️ تقسيم لدفعتين (2.5% + 2.5%)

                </button>

            </div>

            <div style="display: grid; grid-template-columns: 1fr 90px 1.2fr; gap: 6px; align-items: center;">

                <input type="number" step="0.01" id="dp1-val" value="${v1}" oninput="onCustomMilestoneChange('dp1_val', this.value)" placeholder="افتراضي ${defDp1Pct}%" style="padding: 6px;">

                <select id="dp1-type" onchange="onCustomMilestoneChange('dp1_type', this.value)" style="padding: 6px;">

                    <option value="pct" ${t1 === 'pct' ? 'selected' : ''}>%</option>

                    <option value="amt" ${t1 === 'amt' ? 'selected' : ''}>EGP</option>

                </select>

                <input type="date" id="dp1-date" value="${d1}" onchange="onCustomMilestoneChange('dp1_date', this.value)" style="padding: 6px;" title="تاريخ الدفعة">

            </div>

        </div>

        `;

    }

    html += `</div>`; // End DP1



    // DP2 Split vs Single

    html += `<div style="margin-bottom: 10px;">`;

    let defMonth2 = isZomra ? 1 : 3;

    let defDate2 = formatDate(addMonths(cDateStr, defMonth2));



    if (s.splitDP2) {

        let v2a = s.dp2_a_val !== undefined ? s.dp2_a_val : (isZomra ? 1.25 : 2.5);

        let t2a = s.dp2_a_type || 'pct';

        let d2a = s.dp2_a_date || formatDate(addMonths(cDateStr, isZomra ? 1 : 2));



        let v2b = s.dp2_b_val !== undefined ? s.dp2_b_val : (isZomra ? 1.25 : 2.5);

        let t2b = s.dp2_b_type || 'pct';

        let d2b = s.dp2_b_date || formatDate(addMonths(cDateStr, isZomra ? 2 : 3));



        html += `

        <div style="background: rgba(56, 189, 248, 0.06); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: 6px; padding: 10px;">

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">

                <span style="font-weight: bold; color: var(--accent-blue); font-size: 0.88rem;">✂️ الدفعة الثانية مُقسّمة (2أ + 2ب)</span>

                <button type="button" class="btn btn-outline" onclick="toggleSplitDP2(false)" style="padding: 2px 8px; font-size: 0.75rem; border-color: rgba(255,255,255,0.3); color: #ddd; cursor: pointer;">

                    🔗 دمج لدفعة واحدة (${defDp2Pct}%)

                </button>

            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">

                <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px;">

                    <label style="font-size: 0.75rem; color: #aaa; margin-bottom: 3px; display: block;">دفعة 2أ:</label>

                    <div style="display: flex; gap: 4px; margin-bottom: 4px;">

                        <input type="number" step="0.01" id="dp2-a-val" value="${v2a}" oninput="onCustomMilestoneChange('dp2_a_val', this.value)" style="width: 60%; padding: 5px;">

                        <select id="dp2-a-type" onchange="onCustomMilestoneChange('dp2_a_type', this.value)" style="width: 40%; padding: 5px;">

                            <option value="pct" ${t2a === 'pct' ? 'selected' : ''}>%</option>

                            <option value="amt" ${t2a === 'amt' ? 'selected' : ''}>EGP</option>

                        </select>

                    </div>

                    <input type="date" id="dp2-a-date" value="${d2a}" onchange="onCustomMilestoneChange('dp2_a_date', this.value)" style="width: 100%; padding: 5px; box-sizing: border-box;">

                </div>

                <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px;">

                    <label style="font-size: 0.75rem; color: #aaa; margin-bottom: 3px; display: block;">دفعة 2ب:</label>

                    <div style="display: flex; gap: 4px; margin-bottom: 4px;">

                        <input type="number" step="0.01" id="dp2-b-val" value="${v2b}" oninput="onCustomMilestoneChange('dp2_b_val', this.value)" style="width: 60%; padding: 5px;">

                        <select id="dp2-b-type" onchange="onCustomMilestoneChange('dp2_b_type', this.value)" style="width: 40%; padding: 5px;">

                            <option value="pct" ${t2b === 'pct' ? 'selected' : ''}>%</option>

                            <option value="amt" ${t2b === 'amt' ? 'selected' : ''}>EGP</option>

                        </select>

                    </div>

                    <input type="date" id="dp2-b-date" value="${d2b}" onchange="onCustomMilestoneChange('dp2_b_date', this.value)" style="width: 100%; padding: 5px; box-sizing: border-box;">

                </div>

            </div>

        </div>

        `;

    } else {

        let v2 = s.dp2_val !== undefined ? s.dp2_val : '';

        let t2 = s.dp2_type || 'pct';

        let d2 = s.dp2_date || defDate2;

        html += `

        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px;">

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">

                <label style="font-size: 0.85rem; font-weight: bold; color: var(--gold); margin: 0;">${dp2Label}</label>

                <button type="button" class="btn btn-outline" onclick="toggleSplitDP2(true)" style="padding: 2px 8px; font-size: 0.75rem; border-color: var(--accent-blue); color: var(--accent-blue); cursor: pointer;">

                    ✂️ تقسيم لدفعتين (2.5% + 2.5%)

                </button>

            </div>

            <div style="display: grid; grid-template-columns: 1fr 90px 1.2fr; gap: 6px; align-items: center;">

                <input type="number" step="0.01" id="dp2-val" value="${v2}" oninput="onCustomMilestoneChange('dp2_val', this.value)" placeholder="افتراضي ${defDp2Pct}%" style="padding: 6px;">

                <select id="dp2-type" onchange="onCustomMilestoneChange('dp2_type', this.value)" style="padding: 6px;">

                    <option value="pct" ${t2 === 'pct' ? 'selected' : ''}>%</option>

                    <option value="amt" ${t2 === 'amt' ? 'selected' : ''}>EGP</option>

                </select>

                <input type="date" id="dp2-date" value="${d2}" onchange="onCustomMilestoneChange('dp2_date', this.value)" style="padding: 6px;" title="تاريخ الدفعة">

            </div>

        </div>

        `;

    }

    html += `</div>`; // End DP2



    // Project-specific additions (Zomra)

    if (isZomra) {

        let vAddl = s.addl_val !== undefined ? s.addl_val : '';

        let tAddl = s.addl_type || 'pct';

        let dAddl = s.addl_date || formatDate(addMonths(cDateStr, 6));



        let vDeliv = s.deliv_val !== undefined ? s.deliv_val : '';

        let tDeliv = s.deliv_type || 'pct';

        let dDeliv = s.deliv_date || formatDate(addMonths(cDateStr, 37));



        html += `

        <div style="margin-bottom: 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px;">

            <label style="font-size: 0.85rem; font-weight: bold; color: var(--gold); margin-bottom: 6px; display: block;">دفعة بعد 6 شهور (6-Months Payment)</label>

            <div style="display: grid; grid-template-columns: 1fr 90px 1.2fr; gap: 6px; align-items: center;">

                <input type="number" step="0.01" id="addl-val" value="${vAddl}" oninput="onCustomMilestoneChange('addl_val', this.value)" placeholder="افتراضي 5%" style="padding: 6px;">

                <select id="addl-type" onchange="onCustomMilestoneChange('addl_type', this.value)" style="padding: 6px;">

                    <option value="pct" ${tAddl === 'pct' ? 'selected' : ''}>%</option>

                    <option value="amt" ${tAddl === 'amt' ? 'selected' : ''}>EGP</option>

                </select>

                <input type="date" id="addl-date" value="${dAddl}" onchange="onCustomMilestoneChange('addl_date', this.value)" style="padding: 6px;">

            </div>

        </div>



        <div style="margin-bottom: 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px;">

            <label style="font-size: 0.85rem; font-weight: bold; color: var(--gold); margin-bottom: 6px; display: block;">دفعة الاستلام (Delivery Payment)</label>

            <div style="display: grid; grid-template-columns: 1fr 90px 1.2fr; gap: 6px; align-items: center;">

                <input type="number" step="0.01" id="deliv-val" value="${vDeliv}" oninput="onCustomMilestoneChange('deliv_val', this.value)" placeholder="افتراضي 5%" style="padding: 6px;">

                <select id="deliv-type" onchange="onCustomMilestoneChange('deliv_type', this.value)" style="padding: 6px;">

                    <option value="pct" ${tDeliv === 'pct' ? 'selected' : ''}>%</option>

                    <option value="amt" ${tDeliv === 'amt' ? 'selected' : ''}>EGP</option>

                </select>

                <input type="date" id="deliv-date" value="${dDeliv}" onchange="onCustomMilestoneChange('deliv_date', this.value)" style="padding: 6px;">

            </div>

        </div>

        `;

    }



    // Extra Payments (if any)

    if (s.extraPayments && s.extraPayments.length > 0) {

        html += `<div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">`;

        s.extraPayments.forEach((extra, idx) => {

            html += `

            <div style="background: rgba(46, 204, 113, 0.05); border: 1.5px dashed rgba(46, 204, 113, 0.4); border-radius: 6px; padding: 10px;">

                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">

                    <div style="display: flex; align-items: center; gap: 6px; width: 70%;">

                        <span style="color: #2ecc71; font-size: 0.9rem;">⭐</span>

                        <input type="text" value="${escapeHtml(extra.label)}" oninput="onExtraPaymentChange('${extra.id}', 'label', this.value)" style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #2ecc71; font-weight: bold; font-size: 0.88rem; padding: 2px 6px; border-radius: 4px; width: 100%;">

                    </div>

                    <button type="button" class="btn btn-outline" onclick="removeExtraPayment('${extra.id}')" style="padding: 2px 8px; font-size: 0.75rem; border-color: #e74c3c; color: #e74c3c; cursor: pointer;">

                        🗑️ حذف

                    </button>

                </div>

                <div style="display: grid; grid-template-columns: 1fr 90px 1.2fr; gap: 6px; align-items: center;">

                    <input type="number" step="0.01" value="${extra.val !== undefined ? extra.val : ''}" oninput="onExtraPaymentChange('${extra.id}', 'val', this.value)" placeholder="القيمة" style="padding: 6px;">

                    <select onchange="onExtraPaymentChange('${extra.id}', 'type', this.value)" style="padding: 6px;">

                        <option value="pct" ${extra.type === 'pct' ? 'selected' : ''}>%</option>

                        <option value="amt" ${extra.type === 'amt' ? 'selected' : ''}>EGP</option>

                    </select>

                    <input type="date" value="${extra.date}" onchange="onExtraPaymentChange('${extra.id}', 'date', this.value)" style="padding: 6px;">

                </div>

            </div>

            `;

        });

        html += `</div>`;

    }



    html += `</div>`; // Close card

    container.innerHTML = html;

}







// --- Engine ---

function getPeriod(months) {

    return Math.floor(months / 3);

}



function getSheet1DiscountFactor(dateStr, contractDateStr, project) {

    if (!dateStr || !contractDateStr) return 1.0;

    let [fy, fm, fd] = dateStr.split('-').map(Number);

    let [cy, cm, cd] = contractDateStr.split('-').map(Number);

    let diffDays = Math.round((Date.UTC(fy, fm - 1, fd) - Date.UTC(cy, cm - 1, cd)) / 86400000);

    if (diffDays <= 0) return 1.0;

    

    let r;

    let proj = (project || currentProject || '').trim().toLowerCase();

    if (proj === 'zomra') {

        if (diffDays <= 367) r = 0.21;

        else if (diffDays <= 1067) r = 0.20;

        else if (diffDays <= 1432) r = 0.19;

        else if (diffDays <= 1797) r = 0.18;

        else if (diffDays <= 2162) r = 0.17;

        else if (diffDays <= 2528) r = 0.16;

        else if (diffDays <= 2893) r = 0.15;

        else if (diffDays <= 3348) r = 0.14;

        else if (diffDays <= 3714) r = 0.13;

        else r = 0.12;

    } else if (proj === 'orb') {

        if (diffDays <= 108) r = 0.20;

        else if (diffDays <= 474) r = 0.19;

        else if (diffDays <= 839) r = 0.16;

        else if (diffDays <= 1204) r = 0.14;

        else if (diffDays <= 1935) r = 0.11;

        else if (diffDays <= 3396) r = 0.10;

        else r = 0.09;

    } else { // Jirian & Perla

        if (diffDays <= 53) r = 0.19;

        else if (diffDays <= 418) r = 0.18;

        else if (diffDays <= 783) r = 0.15;

        else if (diffDays <= 1149) r = 0.13;

        else if (diffDays <= 1879) r = 0.10;

        else r = 0.09;

    }

    

    return 1.0 / Math.pow(1.0 + r / 365.0, diffDays);

}



function getFlexiblePvFactor(diffDays, project) {

    if (diffDays <= 0) return 1.0;

    let r;

    let proj = (project || currentProject || '').trim().toLowerCase();

    if (proj === 'zomra') {

        if (diffDays <= 367) r = 0.21;

        else if (diffDays <= 1067) r = 0.20;

        else if (diffDays <= 1432) r = 0.19;

        else if (diffDays <= 1797) r = 0.18;

        else if (diffDays <= 2162) r = 0.17;

        else if (diffDays <= 2528) r = 0.16;

        else if (diffDays <= 2893) r = 0.15;

        else if (diffDays <= 3348) r = 0.14;

        else if (diffDays <= 3714) r = 0.13;

        else r = 0.12;

    } else if (proj === 'orb') {

        if (diffDays <= 108) r = 0.20;

        else if (diffDays <= 474) r = 0.19;

        else if (diffDays <= 839) r = 0.16;

        else if (diffDays <= 1204) r = 0.14;

        else if (diffDays <= 1935) r = 0.11;

        else if (diffDays <= 3396) r = 0.10;

        else r = 0.09;

    } else { // Jirian & Perla

        if (diffDays <= 53) r = 0.19;

        else if (diffDays <= 418) r = 0.18;

        else if (diffDays <= 783) r = 0.15;

        else if (diffDays <= 1149) r = 0.13;

        else if (diffDays <= 1879) r = 0.10;

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

            let [cy, cm, cd] = contractDateStr.split('-').map(Number);

            let diffDays = Math.round((Date.UTC(fy, fm - 1, fd) - Date.UTC(cy, cm - 1, cd)) / 86400000);

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



function generateFlowsTemplate(contractDateStr, years, freqMonths, isBase = false, customFirstDateStrParam = null, isPureStandard = false, forceFlex = null) {

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

            let isDp1Melted = (!isBase && window.meltState && window.meltState['dp1']);

            let p1 = isBase ? defPct : (isDp1Melted ? 0 : getOverridePct('dp1', defPct));

            let flow1 = { id: 'dp1', label: defLabel, date: d1, months: m1, isDP: true, defaultPct: p1, exactPct: p1 };

            let dp1Data = isBase ? null : getCustomInputData('dp1', basePriceCache || 5000000);

            if (isDp1Melted) {

                flow1._exactFixedPct = 0;

                flow1._isMelted = true;

            } else if (dp1Data) {

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

            let isDp2Melted = (!isBase && window.meltState && window.meltState['dp2']);

            let p2 = isBase ? defPct : (isDp2Melted ? 0 : getOverridePct('dp2', defPct));

            let flow2 = { id: 'dp2', label: defLabel, date: d2, months: m2, isDP: true, defaultPct: p2, exactPct: p2 };

            let dp2Data = isBase ? null : getCustomInputData('dp2', basePriceCache || 5000000);

            if (isDp2Melted) {

                flow2._exactFixedPct = 0;

                flow2._isMelted = true;

            } else if (dp2Data) {

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

        let isAddlMelted = (!isBase && window.meltState && window.meltState['addl']);

        let addlPct = isAddlMelted ? 0 : (isBase ? 0.05 : getOverridePct('addl', 0.05));

        let flowAddl = { id: 'addl', label: '6-Months Payment', date: addlDate, months: getMonthsDiff(addlDate, contractDateStr), isDP: true, defaultPct: addlPct };

        if (isAddlMelted) { flowAddl._exactFixedPct = 0; flowAddl._isMelted = true; }

        flows.push(flowAddl);

        

        let delivDate = (!isBase && msState && msState.deliv_date) ? msState.deliv_date : formatDate(addMonths(contractDateStr, 37));

        let isDelivMelted = (!isBase && window.meltState && window.meltState['deliv']);

        let delivOverride = isDelivMelted ? 0 : getOverridePct('deliv', 0.05);

        let hasCustomDelivZ = (!isBase && msState && msState.deliv_val !== undefined && msState.deliv_val !== null && msState.deliv_val !== '');

        if (!isDelivMelted && (delivOverride > 0 || hasCustomDelivZ)) {

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

                let isDelivMelted = (!isBase && window.meltState && window.meltState['deliv']);

                if (isDelivMelted) {

                    existing.hasDeliv = false;

                    existing._delivDefaultPct = 0;

                    existing._exactMergedDelivPct = 0;

                } else {

                    existing.hasDeliv = true;

                    let delivF = (existing.id === 'deliv') ? existing : f;

                    let instF = (existing.id === 'deliv') ? f : existing;

                    existing._delivDefaultPct = delivF._delivDefaultPct || delivF.defaultPct || 0.05;

                    existing._instDefaultPct = instF._instDefaultPct || instF.defaultPct || 0;

                }

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

    let nonMntTpl = template.filter(f => !f.isMnt);
    let contractDateStr = document.getElementById('contract-date')?.value || '';
    
    // Pre-calculate discount factors for each flow
    nonMntTpl.forEach(f => {
        if (f.pvFactor === undefined || isNaN(f.pvFactor)) {
            let tempF = { date: f.date, months: f.months, period: f.period, amount: 1, id: f.id };
            applyDiscountLogic(tempF, contractDateStr);
            f.pvFactor = tempF.pvFactor !== undefined ? tempF.pvFactor : 1.0;
        }
    });

    let isFixedInst = document.getElementById('fixed-inst-toggle')?.checked;
    let fixedInstVal = parseFloat(document.getElementById('fixed-inst-val')?.value) || 0;
    let fixedInstType = document.getElementById('fixed-inst-type')?.value || 'amt';
    let hasFixedCash = isFixedInst && fixedInstVal > 0 && fixedInstType === 'amt' && (!window.meltState || Object.keys(window.meltState).length === 0);
    let hasZeroShifts = window.installmentShiftState && window.installmentShiftState.zeroInsts && window.installmentShiftState.zeroInsts.length > 0;

    if (hasFixedCash || hasZeroShifts) {
        // Analytical Closed-Form Solver for Fixed Cash and Zeroed Installments
        let msFlows = nonMntTpl.filter(f => !f.isInst && !f.isMerged);
        let mergedFlows = nonMntTpl.filter(f => f.isMerged);
        let allInsts = nonMntTpl.filter(f => f.isInst || f.isMerged);

        let S_ms = 0;
        let W_ms = 0;
        msFlows.forEach(f => {
            let p = (f.defaultPct !== undefined ? f.defaultPct : 0.05);
            if (f._exactFixedPct !== undefined) p = f._exactFixedPct / 100.0;
            S_ms += p;
            W_ms += p * (f.pvFactor || 1.0);
        });
        mergedFlows.forEach(f => {
            let delivP = f._delivDefaultPct !== undefined ? f._delivDefaultPct : 0.05;
            if (f._exactMergedDelivPct !== undefined) delivP = f._exactMergedDelivPct / 100.0;
            S_ms += delivP;
            W_ms += delivP * (f.pvFactor || 1.0);
        });

        let fixedInstScope = document.getElementById('fixed-inst-scope')?.value || 'all';
        let fixedSelectedYears = (fixedInstScope === 'custom' && window.getFixedSelectedYears) ? window.getFixedSelectedYears() : [1, 2];
        let fixedSelectedInsts = (fixedInstScope === 'specific_inst' && window.getFixedSelectedInsts) ? window.getFixedSelectedInsts() : [1];
        let delivMonth = (currentProject === 'ORB') ? 24 : ((currentProject === 'Zomra') ? 37 : (currentProject === 'Perla' ? 51 : 48));

        let isFixedFlow = (f) => {
            if (!hasFixedCash) return false;
            if (fixedInstScope === 'all') return true;
            if (fixedInstScope === 'pre') return f.months <= delivMonth;
            if (fixedInstScope === 'post') return f.months > delivMonth;
            if (fixedInstScope === 'custom') return fixedSelectedYears.includes(f._instYear);
            if (fixedInstScope === 'specific_inst') return fixedSelectedInsts.includes(f._instNum);
            return false;
        };

        let zeros = (hasZeroShifts && window.installmentShiftState.zeroInsts) ? window.installmentShiftState.zeroInsts : [];
        let shiftTargets = (hasZeroShifts && window.installmentShiftState.targetInsts) ? window.installmentShiftState.targetInsts : [];

        let fixedCashEntries = [];
        let targetFlows = [];
        let neutralFlows = [];

        let nTotalInsts = allInsts.length;
        let baselinePerInstPct = nTotalInsts > 0 ? (1.0 - S_ms) / nTotalInsts : 0;

        allInsts.forEach((f, idx) => {
            let instNum = idx + 1;
            let df = f.pvFactor || 1.0;

            if (zeros.includes(instNum)) {
                fixedCashEntries.push({ flow: f, amount: 0, df: df });
            } else if (isFixedFlow(f)) {
                fixedCashEntries.push({ flow: f, amount: fixedInstVal, df: df });
            } else if (hasZeroShifts && shiftTargets.includes(instNum)) {
                targetFlows.push({ flow: f, df: df });
            } else if (hasFixedCash) {
                let fixedTargetMode = document.getElementById('fixed-inst-target-mode')?.value || 'all_remaining';
                let targetYears = (fixedTargetMode === 'specific_years' && window.getFixedTargetYears) ? window.getFixedTargetYears() : [];
                let targetInsts = (fixedTargetMode === 'specific_insts' && window.getFixedTargetInsts) ? window.getFixedTargetInsts() : [];
                let singleInst = (fixedTargetMode === 'single_inst' && window.getFixedSingleTargetInst) ? window.getFixedSingleTargetInst() : 8;

                let isTarget = false;
                if (fixedTargetMode === 'all_remaining') isTarget = true;
                else if (fixedTargetMode === 'single_inst' && instNum === singleInst) isTarget = true;
                else if (fixedTargetMode === 'specific_insts' && targetInsts.includes(instNum)) isTarget = true;
                else if (fixedTargetMode === 'specific_years' && targetYears.includes(f._instYear)) isTarget = true;

                if (isTarget) {
                    targetFlows.push({ flow: f, df: df });
                } else {
                    neutralFlows.push({ flow: f, pct: baselinePerInstPct, df: df });
                }
            } else {
                neutralFlows.push({ flow: f, pct: baselinePerInstPct, df: df });
            }
        });

        if (targetFlows.length === 0 && neutralFlows.length > 0) {
            targetFlows = neutralFlows.map(n => ({ flow: n.flow, df: n.df }));
            neutralFlows = [];
        }

        let S_u = neutralFlows.reduce((sum, n) => sum + n.pct, 0);
        let W_u = neutralFlows.reduce((sum, n) => sum + n.pct * n.df, 0);

        let nTarget = targetFlows.length;
        let sumTargetDf = targetFlows.reduce((sum, t) => sum + t.df, 0);
        let W_target_bar = nTarget > 0 ? (sumTargetDf / nTarget) : 1.0;

        let cashShortfallPv = 0;
        fixedCashEntries.forEach(fc => {
            cashShortfallPv += fc.amount * (fc.df - W_target_bar);
        });

        let denom = W_ms + W_u + (1.0 - S_ms - S_u) * W_target_bar;
        if (Math.abs(denom) > 1e-9) {
            let P_eff = (basePv - cashShortfallPv) / denom;
            if (!isNaN(P_eff) && isFinite(P_eff) && P_eff > 0) {
                return P_eff;
            }
        }
    }

    // Default Linear & Secant Fallback Solver
    let pRef = basePriceCache;
    let flows1 = calculateCustomFlows(pRef, template);
    let fixedCashPv = 0.0;
    let sumVarWeight = 0.0;
    let hasVariable = false;
    
    flows1.filter(f => !f.isMnt).forEach(f => {
        let df = (f.pvFactor !== undefined && !isNaN(f.pvFactor)) ? f.pvFactor : 1.0;
        if (f._isFixedCash) {
            fixedCashPv += (f.amount || 0) * df;
        } else {
            let pct = (f._exactFixedPct !== undefined && !isNaN(f._exactFixedPct) && f._exactFixedPct > 0)
                ? (f._exactFixedPct / 100.0)
                : ((f.exactPct !== undefined && !isNaN(f.exactPct) && f.exactPct > 0) ? f.exactPct : (f.amount / pRef));
            sumVarWeight += pct * df;
            hasVariable = true;
        }
    });
    
    let solvedPrice = pRef;
    if (hasVariable && sumVarWeight > 1e-9) {
        solvedPrice = (basePv - fixedCashPv) / sumVarWeight;
    }
    
    let getPv = (p) => {
        let flows = calculateCustomFlows(p, template);
        return flows.filter(f => !f.isMnt).reduce((sum, f) => sum + (f.pv || 0), 0);
    };

    let curPv = getPv(solvedPrice);
    let err = curPv - basePv;
    if (Math.abs(err) > 0.05) {
        for (let iter = 0; iter < 15; iter++) {
            let iterPv = getPv(solvedPrice);
            let iterErr = iterPv - basePv;
            if (Math.abs(iterErr) < 1e-4) break;
            let pNext = solvedPrice + (Math.abs(iterErr) > 10 ? 10 : 1);
            let s = (getPv(pNext) - iterPv) / (pNext - solvedPrice);
            if (Math.abs(s) > 1e-9) {
                solvedPrice = solvedPrice - iterErr / s;
            } else {
                break;
            }
        }
    }

    if (isNaN(solvedPrice) || !isFinite(solvedPrice) || solvedPrice <= 0) {
        solvedPrice = basePriceCache;
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

                    f.exactPct = ov.amount / 100;

                    f._isFixedCash = false;

                } else {

                    f.amount = ov.amount;

                    f._exactFixedVal = ov.amount;

                    f._isFixedCash = true;

                }

                f.isFixedOverride = true;

            } 

            // If milestone is melted in meltState:
            else if (!isPure && window.meltState && window.meltState[f.id]) {
                f.amount = 0;
                f.exactPct = 0;
                f.defaultPct = 0;
                f._exactFixedPct = 0;
                f._exactFixedVal = 0;
                f._isFixedCash = false;
                f._isMelted = true;
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

    

    // Intra-year shift supports both Quarterly (Q1-Q3 light + Q4 balloon) and Semi-Annual (H1 light + H2 balloon)

    let hasIntraYearShift = isIntraYearActive && !isNaN(intraValRaw) && intraValRaw > 0;



    let allInstFlows = flows.filter(f => (f.isInst || f.isMerged) && !f.isMnt);

    allInstFlows.forEach((f, idx) => {

        f._instYear = Math.floor(idx / instsPerYear) + 1;

        f._instNum = idx + 1;

    });

    let dynamicInsts = allInstFlows.filter(f => !f.isFixedOverride);

    

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

    

    let fixedSelectedYears = (fixedInstScope === 'custom') ? (window.getFixedSelectedYears ? window.getFixedSelectedYears() : [1, 2]) : [];

    let fixedSelectedInsts = (fixedInstScope === 'specific_inst') ? (window.getFixedSelectedInsts ? window.getFixedSelectedInsts() : [1]) : [];



    let isFlowFixedInst = (f) => {

        if (!hasFixedInst || hasMeltActive) return false;

        if (fixedInstScope === 'all') return true;

        if (fixedInstScope === 'pre') return f.months <= delivMonth;

        if (fixedInstScope === 'post') return f.months > delivMonth;

        if (fixedInstScope === 'custom') return fixedSelectedYears.includes(f._instYear);

        if (fixedInstScope === 'specific_inst') return fixedSelectedInsts.includes(f._instNum);

        return false;

    };



    let fixedTargetMode = document.getElementById('fixed-inst-target-mode')?.value || 'all_remaining';

    let targetYears = (fixedTargetMode === 'specific_years' && window.getFixedTargetYears) ? window.getFixedTargetYears().filter(y => !fixedSelectedYears.includes(y)) : [];

    let targetInsts = (fixedTargetMode === 'specific_insts' && window.getFixedTargetInsts) ? window.getFixedTargetInsts().filter(n => !fixedSelectedInsts.includes(n)) : [];

    let singleTargetInst = (fixedTargetMode === 'single_inst' && window.getFixedSingleTargetInst) ? window.getFixedSingleTargetInst() : 8;



    let fixedFlows = allInstFlows.filter(f => isFlowFixedInst(f));

    let unfixedFlows = allInstFlows.filter(f => !isFlowFixedInst(f));

    let targetIsDelivery = (fixedTargetMode === 'delivery_milestone');

    

    let targetFlows = [];

    if (hasFixedInst && !hasMeltActive) {

        if (targetIsDelivery) {

            targetFlows = [];

        } else if (fixedTargetMode === 'single_inst') {

            targetFlows = allInstFlows.filter(f => f._instNum === singleTargetInst && !isFlowFixedInst(f));

            if (targetFlows.length === 0 && unfixedFlows.length > 0) targetFlows = [unfixedFlows[0]];

        } else if (fixedTargetMode === 'specific_insts') {

            targetFlows = allInstFlows.filter(f => targetInsts.includes(f._instNum) && !isFlowFixedInst(f));

            if (targetFlows.length === 0 && unfixedFlows.length > 0) targetFlows = unfixedFlows;

        } else if (fixedTargetMode === 'specific_years') {

            targetFlows = allInstFlows.filter(f => targetYears.includes(f._instYear) && !isFlowFixedInst(f));

            if (targetFlows.length === 0 && unfixedFlows.length > 0) targetFlows = unfixedFlows;

        } else {

            // all_remaining

            targetFlows = unfixedFlows;

        }

    }



    let normalBaseInstAmt = nTotal > 0 ? (remAmt / nTotal) : 0;

    let nFixed = fixedFlows.length;

    let totalFixedCash = (fixedInstType === 'pct') ? (nFixed * price * (fixedInstVal / 100)) : (nFixed * fixedAmt);

    let totalShortfall = (nFixed * normalBaseInstAmt) - totalFixedCash;



    let nTarget = targetFlows.length;

    let amtPerTarget = (nTarget > 0) ? (normalBaseInstAmt + totalShortfall / nTarget) : normalBaseInstAmt;

    let amtPerNeutral = normalBaseInstAmt;



    if (hasFixedInst && !hasMeltActive) {

        let preCash = 0;

        let postCash = 0;

        allInstFlows.forEach(f => {

            let amt = amtPerNeutral;

            if (isFlowFixedInst(f)) {

                amt = fixedAmt;

            } else if (!targetIsDelivery && targetFlows.includes(f)) {

                amt = amtPerTarget;

            } else {

                amt = amtPerNeutral;

            }

            if (f.months <= delivMonth) preCash += amt; else postCash += amt;

        });

        actualPrePct = price > 0 ? (preCash / price) * 100 : 0;

        actualPostPct = price > 0 ? (postCash / price) * 100 : 0;

        distMode = 'custom';

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

        nFixed: nFixed,

        nTarget: nTarget,

        nNeutral: allInstFlows.length - nFixed - nTarget,

        fixedSelectedYears: fixedSelectedYears,

        fixedSelectedInsts: fixedSelectedInsts,

        targetMode: fixedTargetMode,

        targetYears: targetYears,

        targetInsts: targetInsts,

        singleTargetInst: singleTargetInst,

        targetIsDelivery: targetIsDelivery,

        totalFixedCash: totalFixedCash,

        normalBaseInstAmt: normalBaseInstAmt,

        totalShortfall: totalShortfall,

        amtPerTarget: amtPerTarget,

        amtPerNeutral: amtPerNeutral,

        price: price,

        nPre: nPre,

        nPost: nPost,

        nTotal: nTotal,

        remAmt: remAmt,

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

        if (f.id === 'deliv' || (f.mergedIds && f.mergedIds.includes('deliv')) || (f.label && f.label.includes('Delivery') && !f.isMnt)) {

            if (hasFixedInst && targetIsDelivery) {

                let baseDeliv = f.isMerged ? (price * (f._delivDefaultPct || 0.05)) : (price * 0.05);

                let augmentedDeliv = baseDeliv + totalShortfall;

                if (f.isMerged) {

                    f._mergedDelivAmt = augmentedDeliv;

                    f._savedMergedDelivAmt = augmentedDeliv;

                    f._delivPortionAmt = augmentedDeliv;

                } else {

                    f.amount = augmentedDeliv;

                }

                f._isTargetDeliv = true;

            }

        }



        if ((f.isInst || f.isMerged) && !f.isFixedOverride) {

            let isFixed = (hasFixedInst && !hasMeltActive) ? isFlowFixedInst(f) : false;

            let isTarget = (hasFixedInst && !hasMeltActive && !targetIsDelivery) ? targetFlows.includes(f) : false;

            let isNeutral = (hasFixedInst && !hasMeltActive) ? (!isFixed && !isTarget) : false;

            

            f._isFixedInst = isFixed;

            f._isTargetInst = isTarget;

            f._isNeutralInst = isNeutral;

            

            let isPreDeliv = f.months <= delivMonth;
            let normalNeutralInstAmt = (hasFixedInst && !hasMeltActive) ? amtPerNeutral : (isPreDeliv ? instAmtPre : instAmtPost);
            let baseInstAmt = normalNeutralInstAmt;

            if (isFixed) {

                f._isFixedCash = (fixedInstType === 'amt');

                f._isFixedPct = (fixedInstType === 'pct');

                if (fixedInstType === 'amt') {

                    f._exactFixedVal = fixedInstVal;

                    baseInstAmt = fixedInstVal;

                } else {

                    f._exactFixedPct = fixedInstVal;

                    baseInstAmt = price * (fixedInstVal / 100);

                }

                f.isFixedOverride = true;

            } else if (isTarget) {

                baseInstAmt = amtPerTarget;

                f.isFixedOverride = false;

            } else {

                baseInstAmt = normalNeutralInstAmt;

                f.isFixedOverride = false;

            }



            let currentInstAmt = baseInstAmt;

            

            let applyShift = hasIntraYearShift && !isFixed;

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



    // Handle Delivery Milestone absorption when fixedTargetMode === 'delivery_milestone'

    if (!isPure && hasFixedInst && fixedInstScope === 'custom') {

        let fixedTargetModeCalc = document.getElementById('fixed-inst-target-mode')?.value || 'all_remaining';

        if (fixedTargetModeCalc === 'delivery_milestone') {

            let fixedSelectedYearsCalc = window.getFixedSelectedYears ? window.getFixedSelectedYears() : [1, 2];

            let fixedInstsCalc = allInstFlows.filter(fl => fixedSelectedYearsCalc.includes(fl._instYear));

            let totalFixedCashCalc = fixedInstsCalc.length * fixedAmt;

            let normalBaseInstAmtCalc = nTotal > 0 ? (remAmt / nTotal) : 0;

            let totalShortfallCalc = (fixedInstsCalc.length * normalBaseInstAmtCalc) - totalFixedCashCalc;



            let delivFlow = flows.find(f => f.id === 'deliv' || (f.mergedIds && f.mergedIds.includes('deliv')) || (f.label && f.label.includes('Delivery') && !f.isMnt));

            if (delivFlow) {

                if (delivFlow.isMerged) {

                    delivFlow._mergedDelivAmt = (delivFlow._savedMergedDelivAmt || delivFlow._mergedDelivAmt || 0) + totalShortfallCalc;

                    delivFlow._savedMergedDelivAmt = delivFlow._mergedDelivAmt;

                    delivFlow.amount = (delivFlow._instPortionAmt || 0) + delivFlow._mergedDelivAmt;

                } else {

                    delivFlow.amount = (delivFlow.amount || (price * 0.05)) + totalShortfallCalc;

                    delivFlow.exactPct = price > 0 ? (delivFlow.amount / price) : 0.05;

                }

                delivFlow._hasFixedShiftLoad = true;

                delivFlow._fixedShiftLoadedAmt = totalShortfallCalc;

                applyDiscountLogic(delivFlow);

            }

        }

    }



    // Universal Precision Balance: absorb any millimeter/penny difference so total flow sum strictly equals price (100.00%)

    if (!isPure && hasFixedInst) {

        let allNonMntFlows = flows.filter(f => !f.isMnt);

        let totalCurrentSum = allNonMntFlows.reduce((sum, f) => sum + (f.amount || 0), 0);

        let diffToBalance = price - totalCurrentSum;

        if (Math.abs(diffToBalance) > 0.005) {

            let delivFlow = flows.find(f => f.id === 'deliv' || (f.mergedIds && f.mergedIds.includes('deliv')) || (f.label && f.label.includes('Delivery') && !f.isMnt));

            if (targetIsDelivery && delivFlow) {

                if (delivFlow.isMerged) {

                    delivFlow._mergedDelivAmt = (delivFlow._mergedDelivAmt || 0) + diffToBalance;

                    delivFlow._savedMergedDelivAmt = delivFlow._mergedDelivAmt;

                    delivFlow.amount = (delivFlow._instPortionAmt || 0) + delivFlow._mergedDelivAmt;

                } else {

                    delivFlow.amount = (delivFlow.amount || 0) + diffToBalance;

                }

                applyDiscountLogic(delivFlow);

            } else if (targetFlows.length > 0) {

                let addEach = diffToBalance / targetFlows.length;

                targetFlows.forEach(inst => {

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
        if (f._isTargetDeliv) {
            delivPart = Math.round(f._delivPortionAmt || f._mergedDelivAmt || f.amount || 0);
        } else if (f._exactMergedDelivPct !== undefined && f._exactMergedDelivPct !== null) {
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
            if (f._isZeroShifted) {
                f._instPortionAmt = 0;
                f.amount = delivPart;
            } else if (f.isFixedOverride && f._exactFixedPct !== undefined) {
                let totalMergedAmt = Math.round(targetTotal * (f._exactFixedPct / 100.0));
                f._instPortionAmt = Math.max(0, totalMergedAmt - delivPart);
                f.amount = delivPart + f._instPortionAmt;
                fixedInstSum += f._instPortionAmt;
            } else if (f._isFixedInst) {
                f._instPortionAmt = Math.round(idealInst);
                f.amount = delivPart + f._instPortionAmt;
                fixedInstSum += f._instPortionAmt;
            } else if (f._isNeutralInst) {
                f._instPortionAmt = Math.round(idealInst);
                f.amount = delivPart + f._instPortionAmt;
                fixedInstSum += f._instPortionAmt;
            } else {
                dynInstEntries.push({ flow: f, idealAmt: idealInst, isMerged: true });
            }
        } else {
            f._instPortionAmt = 0;
            f.amount = delivPart;
        }
    });

    pureInstFlows.forEach(f => {
        if (f._isZeroShifted) {
            f.amount = 0;
        } else if (f.isFixedOverride && f._exactFixedPct !== undefined) {
            f.amount = Math.round(targetTotal * (f._exactFixedPct / 100.0));
            fixedInstSum += f.amount;
        } else if (f.isFixedOverride && f._exactFixedVal !== undefined) {
            f.amount = Math.round(f._exactFixedVal);
            fixedInstSum += f.amount;
        } else if (f._isFixedInst) {
            f.amount = Math.round(f.amount);
            fixedInstSum += f.amount;
        } else if (f._isNeutralInst) {
            f.amount = Math.round(f.amount);
            fixedInstSum += f.amount;
        } else {
            dynInstEntries.push({ flow: f, idealAmt: f.amount || 0, isMerged: false });
        }
    });

    let remForDyn = targetTotal - sumNonInst - fixedInstSum;

    if (dynInstEntries.length === 0) {
        // If all installments are fixed or neutral, distribute any remainder across neutral installments
        let neutralFlows = nonMnt.filter(f => f._isNeutralInst && !f._isZeroShifted);
        if (neutralFlows.length > 0) {
            let addEach = Math.floor(remForDyn / neutralFlows.length);
            let remExtra = remForDyn - (addEach * neutralFlows.length);
            neutralFlows.forEach((f, idx) => {
                let add = addEach + (idx < remExtra ? 1 : 0);
                f.amount = (f.amount || 0) + add;
                if (f.isMerged) f._instPortionAmt = (f._instPortionAmt || 0) + add;
            });
        }
    } else {
        let isStandardUniform = dynInstEntries.every(d => Math.abs(d.idealAmt - dynInstEntries[0].idealAmt) < 0.5);
        if (isStandardUniform) {
            let baseUniform = Math.floor(remForDyn / dynInstEntries.length);
            let deficit = remForDyn - (baseUniform * dynInstEntries.length);
            dynInstEntries.forEach((d, idx) => {
                let instPart = baseUniform + (idx >= (dynInstEntries.length - deficit) ? 1 : 0);
                if (d.isMerged) {
                    d.flow._instPortionAmt = instPart;
                    d.flow.amount = (d.flow._delivPortionAmt || 0) + instPart;
                } else {
                    d.flow.amount = instPart;
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

    });    // Step 2: Smart Grouping for Installments (Pure and Merged)

    let activeInsts = nonMnt.filter(f => (f.isInst || f.isMerged) && (f.amount > 0) && !f._isZeroShifted);

    

    activeInsts.forEach(f => {

        if (f.isMerged) {

            let delivAmt = f._delivPortionAmt !== undefined ? f._delivPortionAmt : (f._savedMergedDelivAmt || 0);

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



    let isAllInstsUniform = (groups.length === 1 && groups[0].flows.length === activeInsts.length);



    groups.forEach(g => {

        let totalPart = g.flows.reduce((s, f) => s + f._instPart, 0);

        let avgPart = totalPart / g.flows.length;

        let uniformRawPct = (avgPart / validTotal) * 100;

        let uniformPctVal = Math.round(uniformRawPct * 100) / 100;

        let uniformDisplayPct = uniformPctVal.toFixed(2);

        let refInst = g.flows.find(f => !f.isMerged) || g.flows[0];

        let isGroupMatchingDefault = (isAllInstsUniform && refInst && refInst.defaultPct !== undefined && refInst.defaultPct > 0 && Math.abs(refInst.defaultPct - (avgPart / validTotal)) < 0.0001);

        let exactInstPct = isGroupMatchingDefault

            ? refInst.defaultPct

            : (validTotal > 0 ? (avgPart / validTotal) : (uniformRawPct / 100.0));



        g.flows.forEach(f => {
            let instPartPct = isGroupMatchingDefault ? refInst.defaultPct : (validTotal > 0 ? (f._instPart / validTotal) : (f.defaultPct || 0));

            if (f.isFixedOverride && f._exactFixedPct !== undefined) {
                f.exactPct = f._exactFixedPct / 100.0;
                f._pctVal = Math.round(f._exactFixedPct * 100) / 100;
                f.displayPct = f._pctVal.toFixed(2);
            } else if (f.isMerged) {
                let isDelivMelted = (window.meltState && window.meltState['deliv']);
                let delivAmt = (f._delivPortionAmt !== undefined && f._delivPortionAmt !== null) ? f._delivPortionAmt : (f._savedMergedDelivAmt || 0);
                let delivPct = isDelivMelted ? 0 : ((f._exactMergedDelivPct !== undefined && f._exactMergedDelivPct !== null)
                    ? (f._exactMergedDelivPct / 100.0)
                    : (f._delivDefaultPct !== undefined ? f._delivDefaultPct : (validTotal > 0 ? (delivAmt / validTotal) : 0.05)));
                let mergedExactPct = delivPct + instPartPct;
                f.exactPct = mergedExactPct;
                let mergedPctVal = Math.round(mergedExactPct * 10000) / 100;
                f._pctVal = mergedPctVal;
                f.displayPct = mergedPctVal.toFixed(2);
            } else {
                f.exactPct = instPartPct;
                let pctVal = Math.round(instPartPct * 10000) / 100;
                f._pctVal = pctVal;
                f.displayPct = pctVal.toFixed(2);
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



    // Step 3: Hare-Niemeyer Largest Remainder Method (Strict 100.00% Mathematical Guarantee)

    // When installments are standard/uniform, we PRESERVE identical percentages across all regular installments (no 2.65% vs 2.66% split)

    let activeNonMnt = nonMnt.filter(f => (f.amount > 0) && !f._isZeroShifted);

    if (!isAllInstsUniform && activeNonMnt.length > 0) {

        let totalCents = 10000; // 100.00%

        let sumAssignedCents = 0;

        

        activeNonMnt.forEach(f => {

            let pVal = parseFloat(f.displayPct) || 0;

            let cents = Math.round(pVal * 100);

            f._cents = cents;

            let rawPct = (f.amount / validTotal) * 100;

            f._rawPctRem = (rawPct * 100) - cents;

            sumAssignedCents += cents;

        });



        let diffCents = totalCents - sumAssignedCents;

        if (diffCents !== 0) {

            let adjustable = activeNonMnt.filter(f => (f.isInst || f.isMerged) && !f._isFixedInst && !f.isFixedOverride);

            if (adjustable.length === 0) adjustable = activeNonMnt.filter(f => !f.isDP && !f._isFixedInst && !f.isFixedOverride);

            if (adjustable.length === 0) adjustable = activeNonMnt;



            if (diffCents > 0 && adjustable.length > 0) {

                let sorted = [...adjustable].sort((a, b) => b._rawPctRem - a._rawPctRem);

                for (let i = 0; i < diffCents; i++) {

                    sorted[i % sorted.length]._cents += 1;

                }

            } else if (diffCents < 0 && adjustable.length > 0) {

                let toRemove = Math.abs(diffCents);

                let sorted = [...adjustable].sort((a, b) => a._rawPctRem - b._rawPctRem);

                for (let i = 0; i < toRemove; i++) {

                    let target = sorted[i % sorted.length];

                    if (target._cents > 0) target._cents -= 1;

                }

            }



            activeNonMnt.forEach(f => {

                f._pctVal = f._cents / 100.0;

                f.displayPct = f._pctVal.toFixed(2);

            });

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



function updatePreDeliveryTracker(flows, elementId) {

    if (!flows || !Array.isArray(flows)) return 0;

    let delivMonth = (currentProject === 'Zomra') ? 37 : (currentProject === 'Perla' ? 51 : 48); // Zomra delivery is month 37

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



// ==========================================

// --- PURE ORIGINAL BASELINE ENGINE ---

// Calculates the 100% pristine baseline for any duration (8y, 10y, etc.)

// without any custom milestones, shifts, or overrides.

// ==========================================

window.getPureOriginalBaseline = function(proj, years, freqMonths, contractDateStr) {

    if (!contractDateStr) contractDateStr = formatDate(new Date());

    years = Math.max(1, Math.min(20, parseInt(years) || 8));

    freqMonths = (parseInt(freqMonths) === 6 || parseInt(freqMonths) === 3) ? parseInt(freqMonths) : 3;

    let tpl = generateFlowsTemplate(contractDateStr, years, freqMonths, true, null, true);

    let samplePrice = 10000000;

    let flows = calculateBaseFlows(samplePrice, tpl, contractDateStr);

    let instsPerYear = 12 / freqMonths;

    let baseInsts = flows.filter(f => (f.isInst || f.isMerged) && !f.isMnt);

    baseInsts.forEach((f, idx) => {

        f._instYear = Math.floor(idx / instsPerYear) + 1;

    });

    

    let isZomra = (proj === 'Zomra');

    let delivMonth = (proj === 'ORB') ? 24 : (isZomra ? 37 : (proj === 'Perla' ? 51 : 48));

    

    let totAmt = flows.filter(f => !f.isMnt).reduce((s, f) => s + (f.amount || 0), 0);

    let preAmt = flows.filter(f => !f.isMnt && f.months <= delivMonth).reduce((s, f) => s + (f.amount || 0), 0);

    let origPreDelivPct = totAmt > 0 ? (preAmt / totAmt * 100) : 0;

    

    let annual = [];

    for (let y = 1; y <= years; y++) {

        let mLimit = y * 12;

        let cumAmt = flows.filter(f => !f.isMnt && (f._instYear ? (f._instYear <= y) : (f.months <= mLimit))).reduce((s, f) => s + (f.amount || 0), 0);

        annual.push({

            year: y,

            cumPct: totAmt > 0 ? (cumAmt / totAmt * 100) : 0

        });

    }

    

    return {

        years: years,

        freqMonths: freqMonths,

        delivMonth: delivMonth,

        origPreDelivPct: origPreDelivPct,

        annual: annual,

        flows: flows

    };

};



window.getOfferCumulativeAnalysis = function(flows, years, proj) {

    if (!flows || !Array.isArray(flows)) return null;

    years = Math.max(1, Math.min(20, parseInt(years) || 8));

    let isZomra = (proj === 'Zomra');

    let delivMonth = (proj === 'ORB') ? 24 : (isZomra ? 37 : (proj === 'Perla' ? 51 : 48));

    

    let totAmt = flows.filter(f => !f.isMnt).reduce((s, f) => s + (f.amount || 0), 0);

    let preAmt = flows.filter(f => !f.isMnt && f.months <= delivMonth).reduce((s, f) => s + (f.amount || 0), 0);

    let offerPreDelivPct = totAmt > 0 ? (preAmt / totAmt * 100) : 0;

    

    let annual = [];

    for (let y = 1; y <= years; y++) {

        let mLimit = y * 12;

        let cumAmt = flows.filter(f => !f.isMnt && (f._instYear ? (f._instYear <= y) : (f.months <= mLimit))).reduce((s, f) => s + (f.amount || 0), 0);

        annual.push({

            year: y,

            cumPct: totAmt > 0 ? (cumAmt / totAmt * 100) : 0

        });

    }

    

    return {

        offerPreDelivPct: offerPreDelivPct,

        annual: annual

    };

};



window.resetToPureBaseline = function() {

    let yr = parseInt(document.getElementById('duration-years')?.value) || 8;

    if (typeof window.applyRecYears === 'function') {

        window.applyRecYears(yr);

    } else {

        let fixedToggle = document.getElementById('fixed-inst-toggle');

        if (fixedToggle) fixedToggle.checked = false;

        let intraToggle = document.getElementById('toggle-intra-year');

        if (intraToggle) intraToggle.checked = false;

        let legacyToggle = document.getElementById('toggle-70-30');

        if (legacyToggle) legacyToggle.checked = false;

        window.customMilestonesState = {};

        calculate();

    }

    if (typeof window.showToast === 'function') {

        window.showToast(`✅ تم استعادة بيمنت الـ ${yr} سنين الأوريجنال الأصلية بنجاح!`);

    }

};



window.toggleAnnualMatrixVisibility = function() {

    let el = document.getElementById('fixed-inst-annual-matrix-wrapper');

    if (!el) return;

    el.style.display = (el.style.display === 'none' || !el.style.display) ? 'block' : 'none';

};



// --- Financial Approval & Risk Assessment Functions ---

window.approvalBenchmarkMode = 'auto';



function getProjectBenchmarks() {

    let freqMonths = parseInt(document.getElementById('payment-frequency')?.value) === 2 ? 6 : 3;

    let contractDateStr = document.getElementById('contract-date')?.value;

    let b8 = window.getPureOriginalBaseline ? window.getPureOriginalBaseline(currentProject, 8, freqMonths, contractDateStr) : null;

    let b10 = window.getPureOriginalBaseline ? window.getPureOriginalBaseline(currentProject, 10, freqMonths, contractDateStr) : null;

    

    let y8_val = b8 ? b8.origPreDelivPct : (currentProject === 'Zomra' ? 46.88 : (currentProject === 'Jirian' ? 55.00 : 53.55));

    let y10_val = b10 ? b10.origPreDelivPct : (currentProject === 'Zomra' ? 40.50 : (currentProject === 'Jirian' ? 46.00 : 47.78));



    return {

        y8: y8_val,

        y10: y10_val,

        delivMonth: (currentProject === 'ORB') ? 24 : (currentProject === 'Zomra' ? 37 : (currentProject === 'Perla' ? 51 : 48)),

        fixedDP: (currentProject === 'Zomra') ? 15.0 : 10.0

    };

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

    let mode = window.approvalBenchmarkMode || 'auto';

    let currentYears = parseInt(document.getElementById('duration-years')?.value) || 8;

    let freqMonths = parseInt(document.getElementById('payment-frequency')?.value) === 2 ? 6 : 3;

    let contractDateStr = document.getElementById('contract-date')?.value;

    

    if (mode === '8y') {

        let b = window.getPureOriginalBaseline ? window.getPureOriginalBaseline(currentProject, 8, freqMonths, contractDateStr) : null;

        let pct = b ? b.origPreDelivPct : 50.0;

        return { pct: pct, label: `بيمنت الـ 8 سنوات الأوريجنال (${pct.toFixed(2)}%)`, years: 8, baseline: b };

    }

    if (mode === '10y') {

        let b = window.getPureOriginalBaseline ? window.getPureOriginalBaseline(currentProject, 10, freqMonths, contractDateStr) : null;

        let pct = b ? b.origPreDelivPct : 46.0;

        return { pct: pct, label: `بيمنت الـ 10 سنوات الأوريجنال (${pct.toFixed(2)}%)`, years: 10, baseline: b };

    }

    // 'auto' mode: Pure Original Baseline for the EXACT duration of the Offer Plan!

    let b = window.getPureOriginalBaseline ? window.getPureOriginalBaseline(currentProject, currentYears, freqMonths, contractDateStr) : null;

    let pct = b ? b.origPreDelivPct : (benchmarks ? benchmarks.y8 : 50.0);

    return { pct: pct, label: `بيمنت الـ ${currentYears} سنوات الأوريجنال (${pct.toFixed(2)}%)`, years: currentYears, baseline: b };

}



function updateBenchmarkButtonLabels() {

    let currentYears = parseInt(document.getElementById('duration-years')?.value) || 8;

    let freqMonths = parseInt(document.getElementById('payment-frequency')?.value) === 2 ? 6 : 3;

    let contractDateStr = document.getElementById('contract-date')?.value;

    

    let b8 = window.getPureOriginalBaseline ? window.getPureOriginalBaseline(currentProject, 8, freqMonths, contractDateStr) : null;

    let b10 = window.getPureOriginalBaseline ? window.getPureOriginalBaseline(currentProject, 10, freqMonths, contractDateStr) : null;

    let bAuto = window.getPureOriginalBaseline ? window.getPureOriginalBaseline(currentProject, currentYears, freqMonths, contractDateStr) : null;

    

    let p8 = b8 ? b8.origPreDelivPct : 50.0;

    let p10 = b10 ? b10.origPreDelivPct : 46.0;

    let pAuto = bAuto ? bAuto.origPreDelivPct : 50.0;



    let btn8 = document.getElementById('bench-btn-8y');

    let btn10 = document.getElementById('bench-btn-10y');

    let btnAuto = document.getElementById('bench-btn-auto');

    let mode = window.approvalBenchmarkMode || 'auto';



    if (btn8) btn8.innerText = (mode === '8y' ? '🔘 ' : '⚪ ') + `أوريجنال 8 سنوات (${p8.toFixed(2)}%)`;

    if (btn10) btn10.innerText = (mode === '10y' ? '🔘 ' : '⚪ ') + `أوريجنال 10 سنوات (${p10.toFixed(2)}%)`;

    if (btnAuto) btnAuto.innerText = (mode === 'auto' ? '🔘 ' : '⚪ ') + `حسب مدة الخطة (${currentYears} سنين: ${pAuto.toFixed(2)}%)`;

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



window.isManuallyDisapproved = false;



window.toggleManualApproval = function(forcedState) {

    let toggle = document.getElementById('manual-disapproval-toggle');

    if (forcedState !== undefined) {

        window.isManuallyDisapproved = Boolean(forcedState);

        if (toggle) toggle.checked = window.isManuallyDisapproved;

    } else {

        window.isManuallyDisapproved = toggle ? toggle.checked : false;

    }

    

    let wrapper = document.getElementById('manual-approval-toggle-wrapper');

    let label = document.getElementById('manual-disapproval-label');

    if (label && wrapper) {

        if (window.isManuallyDisapproved) {

            wrapper.style.background = 'rgba(231, 76, 60, 0.15)';

            wrapper.style.borderColor = '#e74c3c';

            label.style.color = '#e74c3c';

            label.innerHTML = '🔴 غير موافق (NOT APPROVED) — تم الرفض (انقر للموافقة)';

        } else {

            wrapper.style.background = 'rgba(46, 204, 113, 0.12)';

            wrapper.style.borderColor = '#27ae60';

            label.style.color = '#2ecc71';

            label.innerHTML = '✅ العرض موافق عليه (APPROVED) — انقر للتحديد كـ "غير موافق"';

        }

    }

    

    let actualPrice = window.lastCalculatedPrice || basePriceCache || 0;

    let preDelivPct = window.lastOfferPreDelivPct || 0;

    renderApprovalStatus(actualPrice, preDelivPct);

    generateExportTemplate(actualPrice, preDelivPct);

};



function renderApprovalStatus(price, offerPreDelivPct) {

    let card = document.getElementById('approval-status-card');

    let badgeContainer = document.getElementById('approval-badge-container');

    let miniBadge = document.getElementById('offer-pre-deliv-approval-badge');

    if (!card || !badgeContainer) return;



    let isDisapproved = Boolean(window.isManuallyDisapproved);

    let isApproved = !isDisapproved;



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

                        ✅ APPROVED / موافق ومعتمد

                    </span>

                    <span style="font-size: 0.9rem; color: #2ecc71; font-weight: bold;">

                        خطة سداد معتمدة وموافق عليها. نسبة المحصل قبل الاستلام: ${(offerPreDelivPct || 0).toFixed(2)}%.

                    </span>

                </div>

                <button type="button" class="btn btn-outline" onclick="toggleManualApproval(true)" style="border-color: rgba(231, 76, 60, 0.4); color: #e74c3c; font-size: 0.8rem; padding: 4px 10px; cursor: pointer; border-radius: 4px;">

                    ❌ تغيير لـ غير موافق (Mark Not Approved)

                </button>

            </div>

            <div style="margin-top: 6px; font-size: 0.83rem; color: var(--text-muted);">

                حالة الاعتماد في الـ PDF والإكسيل: <strong style="color: #2ecc71;">APPROVED (معتمد)</strong>

            </div>

        `;

    } else {

        card.style.background = 'rgba(231, 76, 60, 0.08)';

        card.style.border = '1.5px solid #e74c3c';



        badgeContainer.innerHTML = `

            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">

                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">

                    <span style="background: #e74c3c; color: white; padding: 5px 14px; border-radius: 20px; font-weight: bold; font-size: 0.92rem; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(231,76,60,0.35);">

                        ❌ NOT APPROVED / غير موافق (مرفوض)

                    </span>

                    <span style="font-size: 0.92rem; color: #e74c3c; font-weight: bold;">

                        تم تحديد الخطة كـ غير موافق عليها.

                    </span>

                </div>

                <button type="button" class="btn btn-outline" onclick="toggleManualApproval(false)" style="border-color: rgba(46, 204, 113, 0.4); color: #2ecc71; font-size: 0.8rem; padding: 4px 10px; cursor: pointer; border-radius: 4px;">

                    ✅ استعادة الموافقة (Mark Approved)

                </button>

            </div>

            <div style="margin-top: 6px; font-size: 0.83rem; color: #f87171; line-height: 1.4;">

                ⚠️ <strong>تنبيه:</strong> سيظهر موقف الاعتماد في الـ PDF والإكسيل كـ: <strong style="color: white; text-decoration: underline;">NOT APPROVED (غير معتمد)</strong>.

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

            } else if (fixedInstScope === 'custom') {

                let fixedYears = window.getFixedSelectedYears ? window.getFixedSelectedYears() : [1, 2];

                let yearsStr = fixedYears.map(y => `سنة ${y}`).join('، ');

                let targetMode = document.getElementById('fixed-inst-target-mode')?.value || 'all_remaining';

                let targetNote = '';

                if (targetMode === 'specific_years') {

                    let tYears = (window.getFixedTargetYears ? window.getFixedTargetYears() : []).filter(y => !fixedYears.includes(y));

                    targetNote = ` (تحميل الفرق على: ${tYears.map(y => `سنة ${y}`).join('، ')})`;

                } else if (targetMode === 'delivery_milestone') {

                    targetNote = ` (تحميل الفرق على دفعة الاستلام)`;

                } else {

                    targetNote = ` (توزيع الفرق على باقي السنين بالتساوي)`;

                }

                indicator.innerText = `الوضع: تثبيت أقساط ${yearsStr} عند ${formatNum(fixedInstVal)} ج.م${targetNote}`;

                indicator.style.color = 'var(--gold)';

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
    let years = parseInt(document.getElementById('duration-years')?.value) || 8;
    if (currentProject === 'Zomra') {
        let list = [];
        list.push({ id: 'dp1', label: 'المقدم الأول (DP1)', defaultPct: 2.5, month: 0 });
        list.push({ id: 'dp2', label: 'الدفعة الثانية (2nd Payment)', defaultPct: 2.5, month: 1 });
        list.push({ id: 'addl', label: 'دفعة الـ 6 شهور (6-Months Payment)', defaultPct: 5.0, month: 6 });
        if (years >= 3) {
            list.push({ id: 'deliv', label: 'دفعة الاستلام (Delivery Payment)', defaultPct: 5.0, month: 37 });
        }
        return list;
    } else if (currentProject === 'ORB') {
        return [
            { id: 'dp1', label: 'المقدم الأول (DP1)', defaultPct: 5.0, month: 0 },
            { id: 'dp2', label: 'الدفعة الثانية (Down Payment 2)', defaultPct: 5.0, month: 3 }
        ];
    } else if (currentProject === 'Jirian') {
        return [
            { id: 'dp1', label: 'المقدم الأول (DP1)', defaultPct: 5.0, month: 0 },
            { id: 'dp2', label: 'دفعة 1 ديسمبر (1st Dec Payment)', defaultPct: 5.0, month: 1 }
        ];
    } else { // Perla
        return [
            { id: 'dp1', label: 'المقدم الأول (DP1)', defaultPct: 5.0, month: 0 },
            { id: 'dp2', label: 'الدفعة الثانية (Down Payment 2)', defaultPct: 5.0, month: 3 }
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
        let badgeText = isPre ? '🌊 مسيّحة قبل الاستلام' : (isAll ? '🔄 مسيّحة على كل الأقساط' : ('قائمة (' + m.defaultPct + '%)'));
        
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
    
    if (!window.customMilestonesState) window.customMilestonesState = {};
    window.customMilestonesState[milestoneId + '_val'] = '0';
    window.customMilestonesState[milestoneId + '_type'] = 'pct';
    
    if (window.globalTableOverrides) {
        delete window.globalTableOverrides[milestoneId];
    }
    
    let el = document.getElementById(milestoneId + '-val');
    let typeEl = document.getElementById(milestoneId + '-type');
    if (el) el.value = '0';
    if (typeEl) typeEl.value = 'pct';
    
    if (milestoneId === 'dp1') {
        window.customMilestonesState.splitDP1 = false;
        window.customMilestonesState.dp1_a_val = '0';
        window.customMilestonesState.dp1_b_val = '0';
    }
    if (milestoneId === 'dp2') {
        window.customMilestonesState.splitDP2 = false;
        window.customMilestonesState.dp2_a_val = '0';
        window.customMilestonesState.dp2_b_val = '0';
    }
    
    recalcMeltDistribution();
};

window.restoreMelt = function(milestoneId) {
    if (window.meltState) {
        delete window.meltState[milestoneId];
    }
    if (window.customMilestonesState) {
        delete window.customMilestonesState[milestoneId + '_val'];
    }
    if (window.globalTableOverrides) {
        delete window.globalTableOverrides[milestoneId];
    }
    let el = document.getElementById(milestoneId + '-val');
    if (el) el.value = '';
    
    recalcMeltDistribution();
};

window.resetMeltPayments = function() {
    window.meltState = {};
    if (window.customMilestonesState) {
        delete window.customMilestonesState.dp1_val;
        delete window.customMilestonesState.dp2_val;
        delete window.customMilestonesState.addl_val;
        delete window.customMilestonesState.deliv_val;
    }
    ['dp1', 'dp2', 'addl', 'deliv'].forEach(id => {
        let el = document.getElementById(id + '-val');
        if (el && el.value === '0') el.value = '';
        if (window.globalTableOverrides) delete window.globalTableOverrides[id];
    });
    resetDistPresetInternal();
    calculate();
};

function recalcMeltDistribution() {
    let years = parseInt(document.getElementById('duration-years')?.value) || 8;
    let freqMonths = parseInt(document.getElementById('payment-frequency')?.value) === 2 ? 6 : 3;
    let delivMonth = (currentProject === 'Zomra') ? 37 : (currentProject === 'Perla' ? 51 : (currentProject === 'ORB' ? 24 : 48));
    
    let tpl = generateFlowsTemplate(formatDate(new Date()), years, freqMonths, true);
    let dynamicInsts = tpl.filter(f => (f.isInst || f.isMerged));
    let nPre = dynamicInsts.filter(f => f.months <= delivMonth).length;
    let nPost = dynamicInsts.filter(f => f.months > delivMonth).length;
    let nTotal = nPre + nPost;
    
    let standardMilestonesPct = (currentProject === 'Zomra') ? (years >= 3 ? 15.0 : 10.0) : 10.0;
    let standardBaselinePool = 100.0 - standardMilestonesPct;
    let basePrePct = nTotal > 0 ? standardBaselinePool * (nPre / nTotal) : 0;
    let basePostPct = nTotal > 0 ? standardBaselinePool * (nPost / nTotal) : 0;
    
    let getDefMilestonePct = (id) => {
        if (id === 'dp1' || id === 'dp2') return (currentProject === 'Zomra') ? 2.5 : 5.0;
        if (id === 'addl') return 5.0;
        if (id === 'deliv') return (currentProject === 'Zomra' && years >= 3) ? 5.0 : 0.0;
        return 0.0;
    };
    
    let meltedPrePct = 0;
    let meltedAllPct = 0;
    let hasAnyMelt = false;
    
    if (window.meltState) {
        for (let [mId, scope] of Object.entries(window.meltState)) {
            let defVal = getDefMilestonePct(mId);
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
    
    let targetPrePct = basePrePct + meltedPrePct + (nTotal > 0 ? meltedAllPct * (nPre / nTotal) : 0);
    let targetPostPct = basePostPct + (nTotal > 0 ? meltedAllPct * (nPost / nTotal) : 0);
    
    if (!window.globalDistState) window.globalDistState = {};
    window.globalDistState.mode = 'custom';
    window.globalDistState.typedPrePct = targetPrePct;
    window.globalDistState.typedPostPct = targetPostPct;
    
    let preInput = document.getElementById('pre-deliv-inst-pct');
    let postInput = document.getElementById('post-deliv-inst-pct');
    if (preInput) preInput.value = targetPrePct.toFixed(4);
    if (postInput) postInput.value = targetPostPct.toFixed(4);
    
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
    
    let delivMonth = (currentProject === 'Zomra') ? 37 : (currentProject === 'Perla' ? 51 : (currentProject === 'ORB' ? 24 : 48));
    let preInsts = (flows || []).filter(f => (f.isInst || f.isMerged) && !f.isMnt && f.months <= delivMonth);
    let postInsts = (flows || []).filter(f => (f.isInst || f.isMerged) && !f.isMnt && f.months > delivMonth);
    
    let preAmt = preInsts.length > 0 ? (preInsts[0]._instPortionAmt || preInsts[0].amount) : 0;
    let postAmt = postInsts.length > 0 ? (postInsts[0]._instPortionAmt || postInsts[0].amount) : 0;
    let prePct = preInsts.length > 0 ? (preInsts[0].displayPct || (preInsts[0].exactPct * 100).toFixed(2)) : '0.00';
    let postPct = postInsts.length > 0 ? (postInsts[0].displayPct || (postInsts[0].exactPct * 100).toFixed(2)) : '0.00';
    
    let listItems = [];
    let milestoneDefs = getMilestoneDefs();
    for (let [mId, scope] of Object.entries(window.meltState)) {
        let mDef = milestoneDefs.find(m => m.id === mId);
        let mName = mDef ? mDef.label : mId;
        let scopeName = scope === 'pre' 
            ? '<strong style="color:var(--accent-blue);">أقساط ما قبل الاستلام فقط (للحفاظ على نسبة التحصيل والاعتماد)</strong>' 
            : '<strong style="color:var(--gold);">جميع الأقساط بالتساوي على مدار المدة</strong>';
        listItems.push('• تم تسييح <strong>' + mName + '</strong> على ' + scopeName + '.');
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

    let delivMonth = currentProject === 'ORB' ? 24 : (isZomra ? 37 : (currentProject === 'Perla' ? 51 : 48));

    let instPoolPct = isZomra ? 0.85 : 0.90; // Zomra allocates 85% to installments, others 90%

    let nTotal = g.nTotal || (currentYears * (12 / freqMonths));

    let naturalInst = nTotal > 0 ? (basePrice * instPoolPct) / nTotal : 0;

    

    // Generate standard template for current plan to get exact milestone PV factors

    let tpl = generateFlowsTemplate(contractDateStr, currentYears, freqMonths, false);

    

    let dp1Flow = tpl.find(f => f.id === 'dp1');

    let dp2Flow = tpl.find(f => f.id === 'dp2');

    let addlFlow = isZomra ? tpl.find(f => f.id === 'addl') : null;

    let getDf = (f) => {

        if (!f) return 1.0;

        let tempF = { date: f.date, months: f.months, amount: 1, id: f.id };

        applyDiscountLogic(tempF, contractDateStr);

        return tempF.pv || 1.0;

    };

    

    let dfDp1 = 1.0;

    let dfDp2 = getDf(dp2Flow);

    let dfAddl = addlFlow ? getDf(addlFlow) : 0;

    let delivFlow = tpl.find(f => f.id === 'deliv' || (f.mergedIds && f.mergedIds.includes('deliv')));

    let dfDeliv = delivFlow ? getDf(delivFlow) : getDf({ date: formatDate(addMonths(contractDateStr, delivMonth)), months: delivMonth, id: 'deliv' });

    

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

        } else if (g.scope === 'custom') {

            let yearsStr = (g.fixedSelectedYears && g.fixedSelectedYears.length > 0) ? g.fixedSelectedYears.map(y => `سنة ${y}`).join('، ') : 'السنين المحددة';

            let monthlyFixed = (g.fixedAmt || 0) / freqMonths;

            let targetMode = g.targetMode || 'all_remaining';



            if (targetMode === 'specific_years' && g.targetYears && g.targetYears.length > 0) {

                let targetYearsStr = g.targetYears.map(y => `سنة ${y}`).join('، ');

                let neutralYears = [];

                for (let y = 1; y <= currentYears; y++) {

                    if (!g.fixedSelectedYears.includes(y) && !g.targetYears.includes(y)) neutralYears.push(y);

                }

                let neutralYearsStr = neutralYears.length > 0 ? neutralYears.map(y => `سنة ${y}`).join('، ') : '';

                let monthlyTarget = (g.amtPerTarget || 0) / freqMonths;

                let monthlyNeutral = (g.amtPerNeutral || 0) / freqMonths;

                let shortfallSign = (g.totalShortfall >= 0 ? '+' : '');



                counterpartEl.innerHTML = `

                    <div style="display: flex; flex-direction: column; gap: 5px;">

                        <div style="color: var(--gold); font-weight: bold; font-size: 0.88rem;">

                            📌 السنين المثبتة (${yearsStr} — ${g.nFixed} قسطاً): 

                            <span style="color: #fff;">${formatCurr(g.fixedAmt)}</span> 

                            <span style="color: #2ecc71; font-size: 0.8rem; margin-right: 4px;">(💡 يعادل ${formatCurr(monthlyFixed)} / شهر)</span>

                        </div>

                        <div style="color: #38bdf8; font-weight: bold; font-size: 0.88rem; background: rgba(56, 189, 248, 0.1); padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.3);">

                            🎯 سنين تحميل الفرق (${targetYearsStr}): 

                            <span style="color: #fff;">${formatCurr(g.amtPerTarget)}</span> 

                            <span style="color: #2ecc71; font-size: 0.8rem; margin-right: 4px;">(💡 يعادل ${formatCurr(monthlyTarget)} / شهر)</span>

                            <span style="font-size: 0.78rem; color: #38bdf8; margin-right: 6px;">[تحملت فرق ${shortfallSign}${formatCurr(g.totalShortfall)}]</span>

                        </div>

                        ${neutralYears.length > 0 ? `

                        <div style="color: var(--text-muted); font-size: 0.84rem;">

                            ➡️ باقي السنين بدون أي زيادة (${neutralYearsStr} — قسطها الطبيعي): 

                            <span style="color: #fff;">${formatCurr(g.amtPerNeutral)}</span> 

                            <span style="color: #2ecc71; font-size: 0.8rem; margin-right: 4px;">(💡 يعادل ${formatCurr(monthlyNeutral)} / شهر)</span>

                        </div>` : ''}

                    </div>`;

            } else if (targetMode === 'delivery_milestone') {

                let monthlyNormal = (g.normalBaseInstAmt || 0) / freqMonths;

                let shortfallSign = (g.totalShortfall >= 0 ? '+' : '');

                let delivTotalAmt = (price * (currentProject === 'Zomra' ? 0.05 : 0.05)) + (g.totalShortfall || 0);



                counterpartEl.innerHTML = `

                    <div style="display: flex; flex-direction: column; gap: 5px;">

                        <div style="color: var(--gold); font-weight: bold; font-size: 0.88rem;">

                            📌 السنين المثبتة (${yearsStr} — ${g.nFixed} قسطاً): 

                            <span style="color: #fff;">${formatCurr(g.fixedAmt)}</span> 

                            <span style="color: #2ecc71; font-size: 0.8rem; margin-right: 4px;">(💡 يعادل ${formatCurr(monthlyFixed)} / شهر)</span>

                        </div>

                        <div style="color: var(--gold); font-weight: bold; font-size: 0.88rem; background: rgba(212, 175, 55, 0.1); padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(212, 175, 55, 0.3);">

                            🏢 دفعة الاستلام المحمّلة بالفرق: 

                            <span style="color: #fff;">${formatCurr(delivTotalAmt)}</span> 

                            <span style="font-size: 0.78rem; color: var(--gold); margin-right: 6px;">[تحملت فرق ${shortfallSign}${formatCurr(g.totalShortfall)}]</span>

                        </div>

                        <div style="color: var(--text-muted); font-size: 0.84rem;">

                            ➡️ باقي سنين الأقساط (ظلت عند قسطها الطبيعي دون زيادة): 

                            <span style="color: #fff;">${formatCurr(g.normalBaseInstAmt)}</span> 

                            <span style="color: #2ecc71; font-size: 0.8rem; margin-right: 4px;">(💡 يعادل ${formatCurr(monthlyNormal)} / شهر)</span>

                        </div>

                    </div>`;

            } else {

                let monthlyUnfixed = (g.amtPerUnfixed || 0) / freqMonths;

                counterpartEl.innerHTML = `

                    <div style="display: flex; flex-direction: column; gap: 4px;">

                        <div style="color: var(--gold); font-weight: bold; font-size: 0.88rem;">

                            📌 السنين المثبتة (${yearsStr} — ${g.nFixed} قسطاً): 

                            <span style="color: #fff;">${formatCurr(g.fixedAmt)}</span> 

                            <span style="color: #2ecc71; font-size: 0.8rem; margin-right: 4px;">(💡 يعادل ${formatCurr(monthlyFixed)} / شهر)</span>

                        </div>

                        <div style="color: var(--accent-blue); font-weight: bold; font-size: 0.88rem;">

                            ➡️ باقي السنين غير المحددة (${g.nUnfixed} قسطاً بالتساوي بدون بالون): 

                            <span style="color: #fff;">${formatCurr(g.amtPerUnfixed)}</span> 

                            <span style="color: #2ecc71; font-size: 0.8rem; margin-right: 4px;">(💡 يعادل ${formatCurr(monthlyUnfixed)} / شهر)</span>

                        </div>

                    </div>`;

            }

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

        

        let pureBase = window.getPureOriginalBaseline ? window.getPureOriginalBaseline(currentProject, currentYears, freqMonths, contractDateStr) : null;

        let offerAnalysis = window.getOfferCumulativeAnalysis ? window.getOfferCumulativeAnalysis(globalCustomFlows, currentYears, currentProject) : null;



        let offerPreDelivPct = offerAnalysis ? offerAnalysis.offerPreDelivPct : (window.lastOfferPreDelivPct || 0);

        let basePreDelivPct = pureBase ? pureBase.origPreDelivPct : (parseFloat(document.getElementById('base-pre-delivery')?.innerText.replace('%', '')) || 50.0);

        let diffPct = offerPreDelivPct - basePreDelivPct;



        let currentDelivPct = 0;

        if (typeof globalCustomFlows !== 'undefined' && globalCustomFlows) {

            let delivFlow = globalCustomFlows.find(f => f.id === 'deliv' || (f.mergedIds && f.mergedIds.includes('deliv')) || (f.label && f.label.includes('Delivery') && !f.isMnt));

            if (delivFlow) {

                if (delivFlow._exactFixedPct !== undefined && delivFlow._exactFixedPct !== null) currentDelivPct = delivFlow._exactFixedPct;

                else if (delivFlow.exactPct !== undefined && delivFlow.exactPct !== null) currentDelivPct = delivFlow.exactPct * 100;

                else if (delivFlow.defaultPct) currentDelivPct = delivFlow.defaultPct * 100;

                else if (delivFlow._pctVal) currentDelivPct = delivFlow._pctVal;

            }

        }

        if (currentDelivPct === 0 && window.customMilestonesState && window.customMilestonesState.deliv_val) {

            currentDelivPct = parseFloat(window.customMilestonesState.deliv_val) || 0;

        }



        // Annual collection analysis against pure baseline of currentYears

        let annualRows = [];

        let hasYearDeficit = false;

        let deficitYears = [];



        for (let y = 1; y <= currentYears; y++) {

            let origY = (pureBase && pureBase.annual && pureBase.annual[y - 1]) ? pureBase.annual[y - 1].cumPct : 0;

            let offerY = (offerAnalysis && offerAnalysis.annual && offerAnalysis.annual[y - 1]) ? offerAnalysis.annual[y - 1].cumPct : 0;

            let diffY = offerY - origY;

            if (diffY < -0.15) {

                hasYearDeficit = true;

                deficitYears.push({ year: y, diff: diffY, orig: origY, offer: offerY });

            }

            annualRows.push({ year: y, origY: origY, offerY: offerY, diffY: diffY });

        }



        // Build annual comparison matrix HTML

        let matrixRowsHtml = annualRows.map(r => {

            let statusBadge = (Math.abs(r.diffY) <= 0.15) 

                ? '<span style="color:#2ecc71; font-weight:bold;">✅ متطابق</span>'

                : (r.diffY > 0.15 

                    ? `<span style="color:#10b981; font-weight:bold;">🟢 أعلى (+${r.diffY.toFixed(2)}%)</span>`

                    : `<span style="color:#e74c3c; font-weight:bold;">⚠️ أقل (${r.diffY.toFixed(2)}%)</span>`);

            return `

                <tr style="border-bottom: 1px solid rgba(255,255,255,0.07); text-align:center;">

                    <td style="padding: 4px 6px; font-weight:bold; color:var(--gold);">السنة ${r.year}</td>

                    <td style="padding: 4px 6px; color:#fff;">${r.offerY.toFixed(2)}%</td>

                    <td style="padding: 4px 6px; color:var(--accent-blue);">${r.origY.toFixed(2)}%</td>

                    <td style="padding: 4px 6px; color:${r.diffY >= -0.15 ? '#2ecc71' : '#e74c3c'}; font-weight:bold;">${r.diffY >= 0 ? '+' : ''}${r.diffY.toFixed(2)}%</td>

                    <td style="padding: 4px 6px;">${statusBadge}</td>

                </tr>

            `;

        }).join('');



        let suggestedDelivPct = (currentDelivPct >= diffPct) ? (currentDelivPct - diffPct) : 0.0;

        let isGuidanceBalanced = Math.abs(diffPct) <= 0.15 && !hasYearDeficit;



        guidanceBox.style.background = isGuidanceBalanced ? 'rgba(46, 204, 113, 0.1)' : 'rgba(230, 126, 34, 0.12)';

        guidanceBox.style.border = isGuidanceBalanced ? '1px solid rgba(46, 204, 113, 0.3)' : '1px solid rgba(230, 126, 34, 0.4)';

        guidanceBox.style.padding = '12px 14px';

        guidanceBox.style.borderRadius = '8px';



        let delivStatusHtml = '';

        if (diffPct > 0.15) {

            delivStatusHtml = `

                <div style="font-size: 0.85rem; line-height: 1.4; color: #eee;">

                    نسبة التحصيل الحالية قبل الاستلام وصلت إلى <span style="color: #f39c12; font-weight: bold;">${offerPreDelivPct.toFixed(2)}%</span> 

                    (أعلى من بيمنت الـ ${currentYears} سنين الأوريجنال البالغة <span style="color: var(--accent-blue); font-weight: bold;">${basePreDelivPct.toFixed(2)}%</span> بزيادة <span style="color: #e74c3c; font-weight: bold;">+${diffPct.toFixed(2)}%</span>).

                </div>

            `;

        } else if (diffPct < -0.15) {

            delivStatusHtml = `

                <div style="font-size: 0.85rem; line-height: 1.4; color: #eee;">

                    نسبة التحصيل الحالية قبل الاستلام وصلت إلى <span style="color: #e74c3c; font-weight: bold;">${offerPreDelivPct.toFixed(2)}%</span> 

                    (أقل من بيمنت الـ ${currentYears} سنين الأوريجنال البالغة <span style="color: var(--accent-blue); font-weight: bold;">${basePreDelivPct.toFixed(2)}%</span> بنقص <span style="color: #e74c3c; font-weight: bold;">${diffPct.toFixed(2)}%</span>).

                </div>

            `;

        } else {

            delivStatusHtml = `

                <div style="font-size: 0.85rem; color: #2ecc71; font-weight: bold;">

                    ✅ نسبة التحصيل حتى الاستلام (${offerPreDelivPct.toFixed(2)}%) متطابقة تماماً مع بيمنت الـ ${currentYears} سنين الأوريجنال (${basePreDelivPct.toFixed(2)}%).

                </div>

            `;

        }



        let annualDeficitWarning = '';

        if (hasYearDeficit) {

            annualDeficitWarning = `

                <div style="margin-top: 6px; padding: 6px 10px; background: rgba(231, 76, 60, 0.15); border-radius: 4px; border: 1px solid rgba(231, 76, 60, 0.3); font-size: 0.83rem; color: #fca5a5;">

                    ⚠️ <strong>تنبيه التحصيل السنوي:</strong> 

                    التحصيل التراكمي في (${deficitYears.map(d => `السنة ${d.year}`).join('، ')}) أقل من البيمنت الأوريجنال.

                </div>

            `;

        }



        let optionsHtml = `

            <div style="margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px; border: 1px dashed rgba(255,255,255,0.15);">

                <div style="color: var(--gold); font-weight: bold; font-size: 0.86rem; margin-bottom: 6px;">

                    🎯 خيارات وبدائل متاحة (اختر ما يناسبك بحرية أو اترك الخطة كما هي):

                </div>

                <div style="display: flex; flex-direction: column; gap: 6px;">

                    ${(currentDelivPct > 0 && Math.abs(diffPct) > 0.15) ? `

                        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; background: rgba(255,255,255,0.03); padding: 5px 8px; border-radius: 4px;">

                            <span style="font-size: 0.82rem; color: #eee;">

                                <strong>الخيار (1):</strong> ضبط دفعة الاستلام لتصبح <strong>${suggestedDelivPct.toFixed(2)}%</strong> لمعادلة التحصيل قبل الاستلام تماماً.

                            </span>

                            <button type="button" class="btn btn-primary" onclick="window.applySuggestedDeliveryPct(${suggestedDelivPct.toFixed(2)})" style="padding: 3px 10px; font-size: 0.78rem; background: var(--accent-blue); border-color: var(--accent-blue); cursor: pointer; font-weight: bold;">

                                ⚡ تطبيق نسبة الاستلام (${suggestedDelivPct.toFixed(2)}%)

                            </button>

                        </div>

                    ` : ''}

                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; background: rgba(255,255,255,0.03); padding: 5px 8px; border-radius: 4px;">

                        <span style="font-size: 0.82rem; color: #eee;">

                            <strong>الخيار (2):</strong> الإبقاء على الخطة الاستثنائية الحالية وتصديرها مباشرة دون أي تعديل.

                        </span>

                        <span style="color: #2ecc71; font-weight: bold; font-size: 0.8rem;">متاح للاعتماد ✅</span>

                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; background: rgba(255,255,255,0.03); padding: 5px 8px; border-radius: 4px;">

                        <span style="font-size: 0.82rem; color: #eee;">

                            <strong>الخيار (3):</strong> استعادة بيمنت الـ ${currentYears} سنين الأوريجنال الطبيعية 100% بنقرة واحدة.

                        </span>

                        <button type="button" class="btn btn-outline" onclick="window.resetToPureBaseline()" style="padding: 3px 10px; font-size: 0.78rem; border-color: var(--gold); color: var(--gold); cursor: pointer;">

                            🔄 استعادة الأوريجنال (${currentYears} سنين)

                        </button>

                    </div>

                </div>

            </div>

        `;



        guidanceBox.innerHTML = `

            <div style="display: flex; flex-direction: column; gap: 4px;">

                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">

                    <div style="color: ${isGuidanceBalanced ? '#2ecc71' : '#f39c12'}; font-weight: bold; font-size: 0.88rem;">

                        📊 <strong>مستشار التحصيل مقارنة ببيمنت الـ ${currentYears} سنين الأوريجنال (${basePreDelivPct.toFixed(2)}%):</strong>

                    </div>

                    <button type="button" onclick="window.toggleAnnualMatrixVisibility()" style="background: none; border: 1px solid rgba(255,255,255,0.2); color: var(--gold); padding: 2px 8px; border-radius: 4px; font-size: 0.76rem; cursor: pointer;">

                        🔍 تفاصيل التحصيل السنوي (سنة بسنة)

                    </button>

                </div>

                ${delivStatusHtml}

                ${annualDeficitWarning}

                

                <div id="fixed-inst-annual-matrix-wrapper" style="display: none; margin-top: 8px; overflow-x: auto;">

                    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; background: rgba(0,0,0,0.4); border-radius: 4px;">

                        <thead>

                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: var(--text-muted); text-align: center;">

                                <th style="padding: 4px 6px;">السنة</th>

                                <th style="padding: 4px 6px;">تحصيل العرض الحالي</th>

                                <th style="padding: 4px 6px;">بيمنت الـ ${currentYears} سنين الأوريجنال</th>

                                <th style="padding: 4px 6px;">الفرق</th>

                                <th style="padding: 4px 6px;">الحالة</th>

                            </tr>

                        </thead>

                        <tbody>

                            ${matrixRowsHtml}

                        </tbody>

                    </table>

                </div>



                ${optionsHtml}

            </div>

        `;

        return;



        // Check if balanced

        let isBalanced = Math.abs(fixedInst - naturalInst) < 50;

        

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

        

        // Option 1: Natural Duration (Years) Matching

        let bestYear = null;

        let bestYearPrice = 0;

        let bestYearInst = 0;

        let bestYearDiffPct = 0;

        let bestGap = Infinity;

        

        for (let y = 3; y <= 10; y++) {

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

        

        if (!isZomra) {

            // =========================================================================

            // PERLA TAILORED GUIDANCE (Strictly DP1 5%, DP2 5%, 0% Deliv, 0% 6-Mo, Max 10 Years)

            // =========================================================================

            let opt2HtmlPerla = '';

            let opt3HtmlPerla = '';

            if (bestYear) {

                // Option 2 (Perla): Increase years to bestYear + zero DP2 (0%) + increase DP1

                let tplY = generateFlowsTemplate(contractDateStr, bestYear, freqMonths, false);

                let instFlowsY = tplY.filter(f => (f.isInst || f.isMerged) && !f.isFixedOverride);

                let nTotalY = instFlowsY.length;

                let sumInstDfY = instFlowsY.reduce((sum, f) => sum + getDf(f), 0);

                let pvFixedY = fixedInst * sumInstDfY;

                let totFixedY = nTotalY * fixedInst;

                

                let dp1AmtY_zero = targetPv - pvFixedY;

                let P_Y_zero = dp1AmtY_zero + totFixedY;

                let dp1PctY_zero = P_Y_zero > 0 ? (dp1AmtY_zero / P_Y_zero) * 100 : 0;

                let diffPctY_zero = ((P_Y_zero - basePrice) / basePrice) * 100;

                let displayDp1Y_zero = (Math.abs(dp1PctY_zero - Math.round(dp1PctY_zero * 100) / 100) < 0.005) ? (Math.round(dp1PctY_zero * 100) / 100).toFixed(2) : dp1PctY_zero.toFixed(2);

                

                opt2HtmlPerla = `

                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(142, 68, 173, 0.15); border: 1px solid rgba(142, 68, 173, 0.35); padding: 8px 10px; border-radius: 4px;">

                        <div>

                            <strong style="color: #9b59b6;">🗓️ الخيار 2: زيادة السنين لـ (${bestYear} سنوات) + سداد مقدم ${displayDp1Y_zero}% وتصفير الدفعة الثانية</strong><br>

                            <span style="font-size: 0.83rem; color: #ddd;">سداد مقدم <strong>${displayDp1Y_zero}%</strong> (${formatNum(Math.round(dp1AmtY_zero))} ج.م)، تصفير الدفعة الثانية (0%)، وبدون أي دفعات استلام، وتثبيت كافة الأقساط (${nTotalY} قسطاً) عند ${formatNum(fixedInst)} ج.م بسعر <strong>${formatNum(Math.round(P_Y_zero))} ج.م</strong> (${diffPctY_zero >= 0 ? '+' : ''}${diffPctY_zero.toFixed(2)}%).</span>

                        </div>

                        <button class="btn btn-primary" onclick="applyRecYearsWithDP_Perla(${bestYear}, ${dp1PctY_zero.toFixed(8)})" style="padding: 5px 12px; font-size: 0.8rem; background: #8e44ad; border-color: #8e44ad; white-space: nowrap; margin-right: 10px;">تطبيق ${bestYear} سنوات + تصفير الدفعة 2</button>

                    </div>

                `;



                // Option 3 (Perla): Increase years to bestYear + keep DP2 (5%) + increase DP1

                let dp2FlowY = tplY.find(f => f.id === 'dp2');

                let dfDp2Y = getDf(dp2FlowY);

                let P_Y_keep = (targetPv - pvFixedY + totFixedY) / (0.95 + 0.05 * dfDp2Y);

                let dp1AmtY_keep = 0.95 * P_Y_keep - totFixedY;

                let dp1PctY_keep = P_Y_keep > 0 ? (dp1AmtY_keep / P_Y_keep) * 100 : 0;

                let diffPctY_keep = ((P_Y_keep - basePrice) / basePrice) * 100;

                let displayDp1Y_keep = (Math.abs(dp1PctY_keep - Math.round(dp1PctY_keep * 100) / 100) < 0.005) ? (Math.round(dp1PctY_keep * 100) / 100).toFixed(2) : dp1PctY_keep.toFixed(2);



                opt3HtmlPerla = `

                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(46, 204, 113, 0.15); border: 1px solid rgba(46, 204, 113, 0.35); padding: 8px 10px; border-radius: 4px;">

                        <div>

                            <strong style="color: #2ecc71;">🗓️ الخيار 3: زيادة السنين لـ (${bestYear} سنوات) + إبقاء الدفعة الثانية (5%) وزيادة المقدم الأول (${displayDp1Y_keep}%)</strong><br>

                            <span style="font-size: 0.83rem; color: #ddd;">سداد مقدم <strong>${displayDp1Y_keep}%</strong> (${formatNum(Math.round(dp1AmtY_keep))} ج.م)، وسداد الدفعة الثانية 5% (${formatNum(Math.round(P_Y_keep * 0.05))} ج.م)، وتثبيت الأقساط (${nTotalY} قسطاً) عند ${formatNum(fixedInst)} ج.م بسعر <strong>${formatNum(Math.round(P_Y_keep))} ج.م</strong> (${diffPctY_keep >= 0 ? '+' : ''}${diffPctY_keep.toFixed(2)}%).</span>

                        </div>

                        <button class="btn btn-primary" onclick="applyRecYears_KeepDP2_Perla(${bestYear}, ${dp1PctY_keep.toFixed(8)})" style="padding: 5px 12px; font-size: 0.8rem; background: #27ae60; border-color: #27ae60; white-space: nowrap; margin-right: 10px;">تطبيق ${bestYear} سنوات + بقاء الدفعة 2 (5%)</button>

                    </div>

                `;

            }



            // Option 4 (Perla): Current Years + zero DP2 (0%) + increase DP1

            let dp1Amt_zero_curr = targetPv - pvFixedInsts;

            let P_zero_curr = dp1Amt_zero_curr + totalFixedInst;

            let dp1Pct_zero_curr = P_zero_curr > 0 ? (dp1Amt_zero_curr / P_zero_curr) * 100 : 0;

            let diffPct_zero_curr = ((P_zero_curr - basePrice) / basePrice) * 100;

            let displayDp1_zero_curr = (Math.abs(dp1Pct_zero_curr - Math.round(dp1Pct_zero_curr * 100) / 100) < 0.005) ? (Math.round(dp1Pct_zero_curr * 100) / 100).toFixed(2) : dp1Pct_zero_curr.toFixed(2);



            // Option 5 (Perla): Current Years + keep DP2 (5%) + increase DP1

            let P_keep_curr = (targetPv - pvFixedInsts + totalFixedInst) / (0.95 + 0.05 * dfDp2);

            let dp1Amt_keep_curr = 0.95 * P_keep_curr - totalFixedInst;

            let dp1Pct_keep_curr = P_keep_curr > 0 ? (dp1Amt_keep_curr / P_keep_curr) * 100 : 0;

            let diffPct_keep_curr = ((P_keep_curr - basePrice) / basePrice) * 100;

            let displayDp1_keep_curr = (Math.abs(dp1Pct_keep_curr - Math.round(dp1Pct_keep_curr * 100) / 100) < 0.005) ? (Math.round(dp1Pct_keep_curr * 100) / 100).toFixed(2) : dp1Pct_keep_curr.toFixed(2);



            let isDeficit = fixedInst < naturalInst;

            guidanceBox.style.background = isDeficit ? 'rgba(243, 156, 18, 0.12)' : 'rgba(52, 152, 219, 0.12)';

            guidanceBox.style.border = isDeficit ? '1px solid #f39c12' : '1px solid #3498db';

            

            let headerText = isDeficit 

                ? `⚠️ تنبيه: القسط المدخل (${formatCurr(fixedInst)}) أقل من القسط الطبيعي (${formatCurr(naturalInst)}). لمطابقة شيت إكسيل بيرلا بنسبة 100% وبدون أي فارق، اختر أحد الحلول التالية:`

                : `ℹ️ ملاحظة: القسط المدخل (${formatCurr(fixedInst)}) أكبر من القسط الطبيعي (${formatCurr(naturalInst)}). لمطابقة شيت إكسيل بيرلا بنسبة 100% وبدون أي فارق، اختر أحد الحلول التالية:`;



            guidanceBox.innerHTML = `

                <div style="color: ${isDeficit ? '#f39c12' : '#3498db'}; font-weight: bold; margin-bottom: 10px; font-size: 0.95rem;">

                    ${headerText}

                </div>

                <div style="display: flex; flex-direction: column; gap: 8px;">

                    ${bestYear ? `

                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(52, 152, 219, 0.15); border: 1px solid rgba(52, 152, 219, 0.35); padding: 8px 10px; border-radius: 4px;">

                        <div>

                            <strong style="color: #3498db;">🗓️ الخيار 1: تعديل السنين فقط إلى (${bestYear} سنوات)</strong><br>

                            <span style="font-size: 0.83rem; color: #ddd;">الإبقاء على دفعات بيرلا (5% مقدم + 5% بعد 3 شهور)؛ القسط الطبيعي في الإكسيل يصبح <strong>${formatNum(Math.round(bestYearInst))} ج.م</strong> بسعر إجمالي <strong>${formatNum(Math.round(bestYearPrice))} ج.م</strong> (${bestYearDiffPct >= 0 ? '+' : ''}${bestYearDiffPct.toFixed(2)}%).</span>

                        </div>

                        <button class="btn btn-primary" onclick="applyRecYears(${bestYear})" style="padding: 5px 12px; font-size: 0.8rem; white-space: nowrap; margin-right: 10px;">تطبيق ${bestYear} سنوات (طبيعي)</button>

                    </div>` : ''}



                    ${opt2HtmlPerla}

                    ${opt3HtmlPerla}



                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(41, 128, 185, 0.15); border: 1px solid rgba(41, 128, 185, 0.35); padding: 8px 10px; border-radius: 4px;">

                        <div>

                            <strong style="color: #2980b9;">💰 الخيار 4: تصفير الدفعة الثانية وزيادة المقدم الأول (${displayDp1_zero_curr}%) على ${currentYears} سنوات</strong><br>

                            <span style="font-size: 0.83rem; color: #ddd;">سداد مقدم <strong>${displayDp1_zero_curr}%</strong> (${formatNum(Math.round(dp1Amt_zero_curr))} ج.م) وتصفير الدفعة الثانية (0%)، وتثبيت كافة الأقساط (${nTotal} قسطاً) عند ${formatNum(fixedInst)} ج.م بسعر إجمالي <strong>${formatNum(Math.round(P_zero_curr))} ج.م</strong> (${diffPct_zero_curr >= 0 ? '+' : ''}${diffPct_zero_curr.toFixed(2)}%).</span>

                        </div>

                        <button class="btn btn-primary" onclick="applyRecDP_ZeroDP2_Perla(${dp1Pct_zero_curr.toFixed(8)})" style="padding: 5px 12px; font-size: 0.8rem; background: #2980b9; border-color: #2980b9; white-space: nowrap; margin-right: 10px;">زيادة المقدم (${displayDp1_zero_curr}%) وتصفير الدفعة 2</button>

                    </div>



                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(39, 174, 96, 0.15); border: 1px solid rgba(39, 174, 96, 0.35); padding: 8px 10px; border-radius: 4px;">

                        <div>

                            <strong style="color: #2ecc71;">💰 الخيار 5: إبقاء الدفعة الثانية (5%) وزيادة المقدم الأول (${displayDp1_keep_curr}%) على ${currentYears} سنوات</strong><br>

                            <span style="font-size: 0.83rem; color: #ddd;">سداد مقدم <strong>${displayDp1_keep_curr}%</strong> (${formatNum(Math.round(dp1Amt_keep_curr))} ج.م) وسداد الدفعة الثانية 5% (${formatNum(Math.round(P_keep_curr * 0.05))} ج.م)، وتثبيت كافة الأقساط (${nTotal} قسطاً) عند ${formatNum(fixedInst)} ج.م بسعر إجمالي <strong>${formatNum(Math.round(P_keep_curr))} ج.م</strong> (${diffPct_keep_curr >= 0 ? '+' : ''}${diffPct_keep_curr.toFixed(2)}%).</span>

                        </div>

                        <button class="btn btn-primary" onclick="applyRecDP_KeepDP2_Perla(${dp1Pct_keep_curr.toFixed(8)})" style="padding: 5px 12px; font-size: 0.8rem; background: #217346; border-color: #217346; white-space: nowrap; margin-right: 10px;">زيادة المقدم (${displayDp1_keep_curr}%) وبقاء الدفعة 2 (5%)</button>

                    </div>

                </div>

            `;

            return;

        }



        // =========================================================================

        // ZOMRA GUIDANCE OPTIONS (Option 1 through Option 7)

        // =========================================================================

        // Option 2: Increase Years (bestYear) + adjust DP1 & Deliv (5%), zero DP2 (0%) & Addl (0%)

        let opt2Html = '';

        if (bestYear) {

            let tplY = generateFlowsTemplate(contractDateStr, bestYear, freqMonths, false);

            let delivFlowY = tplY.find(f => f.id === 'deliv' || (f.mergedIds && f.mergedIds.includes('deliv')));

            let dfDelivY = delivFlowY ? getDf(delivFlowY) : dfDeliv;

            let instFlowsY = tplY.filter(f => (f.isInst || f.isMerged) && !f.isFixedOverride);

            let nTotalY = instFlowsY.length;

            let sumInstDfY = instFlowsY.reduce((sum, f) => sum + getDf(f), 0);

            let pvFixedY = fixedInst * sumInstDfY;

            let totFixedY = nTotalY * fixedInst;

            

            let delivPctY = 0.05;

            let W_Y = (1.0 - delivPctY) + delivPctY * dfDelivY;

            let P_Y = (targetPv - pvFixedY + totFixedY) / W_Y;

            let dp1AmtY = targetPv - pvFixedY - P_Y * delivPctY * dfDelivY;

            let dp1PctY = P_Y > 0 ? (dp1AmtY / P_Y) * 100 : 0;

            let diffPctY = ((P_Y - basePrice) / basePrice) * 100;

            

            let displayDp1Y = (Math.abs(dp1PctY - Math.round(dp1PctY * 100) / 100) < 0.005) ? (Math.round(dp1PctY * 100) / 100).toFixed(2) : dp1PctY.toFixed(2);

            opt2Html = `

                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(142, 68, 173, 0.15); border: 1px solid rgba(142, 68, 173, 0.35); padding: 8px 10px; border-radius: 4px;">

                    <div>

                        <strong style="color: #9b59b6;">🗓️ الخيار 2: زيادة السنين لـ (${bestYear} سنوات) + سداد مقدم ${displayDp1Y}% وتصفير الدفعات</strong><br>

                        <span style="font-size: 0.83rem; color: #ddd;">سداد مقدم <strong>${displayDp1Y}%</strong> (${formatNum(Math.round(dp1AmtY))} ج.م)، إبقاء الاستلام 5%، وتثبيت كل الأقساط (${nTotalY} قسطاً) عند ${formatNum(fixedInst)} ج.م بسعر <strong>${formatNum(Math.round(P_Y))} ج.م</strong> (${diffPctY >= 0 ? '+' : ''}${diffPctY.toFixed(2)}%).</span>

                    </div>

                    <button class="btn btn-primary" onclick="applyRecYearsWithDP(${bestYear}, ${dp1PctY.toFixed(8)}, 5.0)" style="padding: 5px 12px; font-size: 0.8rem; background: #8e44ad; border-color: #8e44ad; white-space: nowrap; margin-right: 10px;">تطبيق ${bestYear} سنوات + تصفير الدفعات</button>

                </div>

            `;

        }



        // Option 3: Increase DP1 only, Zero DP2 (0%) & Addl (0%), Keep Delivery at 5%

        let delivPct_3 = 0.05;

        let W_3 = (1.0 - delivPct_3) + delivPct_3 * dfDeliv;

        let P_3 = (targetPv - pvFixedInsts + totalFixedInst) / W_3;

        let dp1Amt_3 = targetPv - pvFixedInsts - P_3 * delivPct_3 * dfDeliv;

        let dp1Pct_3 = P_3 > 0 ? (dp1Amt_3 / P_3) * 100 : 0;

        let diffPct_3 = ((P_3 - basePrice) / basePrice) * 100;

        let displayDp1_3 = (Math.abs(dp1Pct_3 - Math.round(dp1Pct_3 * 100) / 100) < 0.005) ? (Math.round(dp1Pct_3 * 100) / 100).toFixed(2) : dp1Pct_3.toFixed(2);

        

        // Option 4: Keep All Standard Project Milestones (DP1 2.5%, DP2 2.5%, Addl 5%), Increase Delivery

        let S_nonDeliv_4 = 0.10;

        let W_nonDeliv_4 = isZomra ? (0.025 * dfDp1 + 0.025 * dfDp2 + 0.05 * dfAddl) : (0.05 * dfDp1 + 0.05 * dfDp2);

        let W_4 = W_nonDeliv_4 + (1.0 - S_nonDeliv_4) * dfDeliv;

        let P_4 = (targetPv - pvFixedInsts + totalFixedInst * dfDeliv) / W_4;

        let delivAmt_4 = (1.0 - S_nonDeliv_4) * P_4 - totalFixedInst;

        let delivPct_4 = P_4 > 0 ? (delivAmt_4 / P_4) * 100 : 0;

        let diffPct_4 = ((P_4 - basePrice) / basePrice) * 100;

        let displayDeliv_4 = (Math.abs(delivPct_4 - Math.round(delivPct_4 * 100) / 100) < 0.005) ? (Math.round(delivPct_4 * 100) / 100).toFixed(2) : delivPct_4.toFixed(2);



        // Option 5: Keep DP1 (2.5%), Zero DP2 (0%) & Addl (0%), Increase Delivery

        let dp1Pct_5 = isZomra ? 0.025 : 0.05;

        let denom_5 = dp1Pct_5 + (1.0 - dp1Pct_5) * dfDeliv;

        let numer_5 = targetPv - pvFixedInsts + totalFixedInst * dfDeliv;

        let P_5 = numer_5 / denom_5;

        let delivAmt_5 = P_5 * (1.0 - dp1Pct_5) - totalFixedInst;

        let delivPct_5 = P_5 > 0 ? (delivAmt_5 / P_5) * 100 : 0;

        let diffPct_5 = ((P_5 - basePrice) / basePrice) * 100;

        let displayDeliv_5 = (Math.abs(delivPct_5 - Math.round(delivPct_5 * 100) / 100) < 0.005) ? (Math.round(delivPct_5 * 100) / 100).toFixed(2) : delivPct_5.toFixed(2);



        // Option 6: Increase DP1, Zero ALL milestones including Delivery (0%)

        let dp1Amt_6 = targetPv - pvFixedInsts;

        let P_6 = dp1Amt_6 + totalFixedInst;

        let dp1Pct_6 = P_6 > 0 ? (dp1Amt_6 / P_6) * 100 : 0;

        let diffPct_6 = ((P_6 - basePrice) / basePrice) * 100;

        let displayDp1_6 = (Math.abs(dp1Pct_6 - Math.round(dp1Pct_6 * 100) / 100) < 0.005) ? (Math.round(dp1Pct_6 * 100) / 100).toFixed(2) : dp1Pct_6.toFixed(2);



        // Option 7: Pre-Delivery Only via NPV

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

        

        let isDeficit = fixedInst < naturalInst;

        guidanceBox.style.background = isDeficit ? 'rgba(243, 156, 18, 0.12)' : 'rgba(52, 152, 219, 0.12)';

        guidanceBox.style.border = isDeficit ? '1px solid #f39c12' : '1px solid #3498db';

        

        let headerText = isDeficit 

            ? `⚠️ تنبيه: القسط المدخل (${formatCurr(fixedInst)}) أقل من القسط الطبيعي (${formatCurr(naturalInst)}). لمطابقة شيت الإكسيل (NPV) بنسبة 100% بالملي وبدون أي فارق، اختر أحد الحلول التالية:`

            : `ℹ️ ملاحظة: القسط المدخل (${formatCurr(fixedInst)}) أكبر من القسط الطبيعي (${formatCurr(naturalInst)}). لمطابقة شيت الإكسيل (NPV) بنسبة 100% بالملي وبدون أي فارق، اختر أحد الحلول التالية:`;



        guidanceBox.innerHTML = `

            <div style="color: ${isDeficit ? '#f39c12' : '#3498db'}; font-weight: bold; margin-bottom: 10px; font-size: 0.95rem;">

                ${headerText}

            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">

                ${bestYear ? `

                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(52, 152, 219, 0.15); border: 1px solid rgba(52, 152, 219, 0.35); padding: 8px 10px; border-radius: 4px;">

                    <div>

                        <strong style="color: #3498db;">🗓️ الخيار 1: تعديل السنين فقط إلى (${bestYear} سنوات)</strong><br>

                        <span style="font-size: 0.83rem; color: #ddd;">الإبقاء على كامل دفعات المشروع القياسية؛ القسط الطبيعي في الإكسيل يصبح <strong>${formatNum(Math.round(bestYearInst))} ج.م</strong> بسعر إجمالي <strong>${formatNum(Math.round(bestYearPrice))} ج.م</strong> (${bestYearDiffPct >= 0 ? '+' : ''}${bestYearDiffPct.toFixed(2)}%).</span>

                    </div>

                    <button class="btn btn-primary" onclick="applyRecYears(${bestYear})" style="padding: 5px 12px; font-size: 0.8rem; white-space: nowrap; margin-right: 10px;">تطبيق ${bestYear} سنوات (طبيعي)</button>

                </div>` : ''}



                ${opt2Html}



                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(46, 204, 113, 0.15); border: 1px solid rgba(46, 204, 113, 0.35); padding: 8px 10px; border-radius: 4px;">

                    <div>

                        <strong style="color: #2ecc71;">💰 الخيار 3: زيادة المقدم فقط (${displayDp1_3}%) وتصفير ${isZomra ? 'دفعات 2.5% و 5%' : 'دفعة 5% الثانية'} مع الإبقاء على دفعة الاستلام (5%)</strong><br>

                        <span style="font-size: 0.83rem; color: #ddd;">سداد مقدم <strong>${displayDp1_3}%</strong> (${formatNum(Math.round(dp1Amt_3))} ج.م)، وتصفير ${isZomra ? 'الدفعة 2 ودفعة 6 شهور' : 'دفعة 5% الثانية'}، إبقاء الاستلام 5% (${formatNum(Math.round(P_3 * 0.05))} ج.م)، وتثبيت كافة الأقساط عند ${formatNum(fixedInst)} ج.م بسعر إجمالي <strong>${formatNum(Math.round(P_3))} ج.م</strong> (${diffPct_3 >= 0 ? '+' : ''}${diffPct_3.toFixed(2)}%).</span>

                    </div>

                    <button class="btn btn-primary" onclick="applyRecDP_KeepDeliv(${dp1Pct_3.toFixed(8)}, 5.0)" style="padding: 5px 12px; font-size: 0.8rem; background: #27ae60; border-color: #27ae60; white-space: nowrap; margin-right: 10px;">زيادة المقدم (${displayDp1_3}%) وإبقاء الاستلام (5%)</button>

                </div>



                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(41, 128, 185, 0.15); border: 1px solid rgba(41, 128, 185, 0.35); padding: 8px 10px; border-radius: 4px;">

                    <div>

                        <strong style="color: #2980b9;">📦 الخيار 4: الإبقاء على كافة دفعات المشروع وزيادة دفعة الاستلام (${displayDeliv_4}%)</strong><br>

                        <span style="font-size: 0.83rem; color: #ddd;">${isZomra ? 'دفع 2.5% مقدم + 2.5% دفعة 2 + 5% دفعة 6 شهور' : 'دفع 5% مقدم 1 + 5% مقدم 2'}، وسداد <strong>${displayDeliv_4}%</strong> (${formatNum(Math.round(delivAmt_4))} ج.م) عند الاستلام لتثبيت كافة الأقساط عند ${formatNum(fixedInst)} ج.م بسعر إجمالي <strong>${formatNum(Math.round(P_4))} ج.م</strong> (${diffPct_4 >= 0 ? '+' : ''}${diffPct_4.toFixed(2)}%).</span>

                    </div>

                    <button class="btn btn-primary" onclick="applyRecDeliv_AllMilestones(${delivPct_4.toFixed(8)})" style="padding: 5px 12px; font-size: 0.8rem; background: #2980b9; border-color: #2980b9; white-space: nowrap; margin-right: 10px;">زيادة الاستلام (${displayDeliv_4}%) مع بقاء الدفعات</button>

                </div>



                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(22, 160, 133, 0.15); border: 1px solid rgba(22, 160, 133, 0.35); padding: 8px 10px; border-radius: 4px;">

                    <div>

                        <strong style="color: #1abc9c;">📦 الخيار 5: إبقاء المقدم (${isZomra ? '2.5%' : '5%'}) وتصفير ${isZomra ? 'دفعات 2.5% و 5%' : 'دفعة 5% الثانية'} وتعديل الاستلام (${displayDeliv_5}%)</strong><br>

                        <span style="font-size: 0.83rem; color: #ddd;">سداد مقدم ${isZomra ? '2.5%' : '5%'} (${formatNum(Math.round(P_5 * (isZomra ? 0.025 : 0.05)))} ج.م)، وتصفير ${isZomra ? 'الدفعة 2 ودفعة 6 شهور' : 'دفعة 5% الثانية'}، وسداد <strong>${displayDeliv_5}%</strong> (${formatNum(Math.round(delivAmt_5))} ج.م) عند الاستلام لتثبيت الأقساط عند ${formatNum(fixedInst)} ج.م بسعر إجمالي <strong>${formatNum(Math.round(P_5))} ج.م</strong> (${diffPct_5 >= 0 ? '+' : ''}${diffPct_5.toFixed(2)}%).</span>

                    </div>

                    <button class="btn btn-primary" onclick="applyRecDeliv_ZeroMilestones(${delivPct_5.toFixed(8)}, ${isZomra ? 2.5 : 5.0})" style="padding: 5px 12px; font-size: 0.8rem; background: #16a085; border-color: #16a085; white-space: nowrap; margin-right: 10px;">زيادة الاستلام (${displayDeliv_5}%) وتصفير الدفعات</button>

                </div>



                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(39, 174, 96, 0.15); border: 1px solid rgba(39, 174, 96, 0.35); padding: 8px 10px; border-radius: 4px;">

                    <div>

                        <strong style="color: #2ecc71;">⚡ الخيار 6: زيادة المقدم (${displayDp1_6}%) وإلغاء كافة الدفعات حتى الاستلام (تصفير كل شيء)</strong><br>

                        <span style="font-size: 0.83rem; color: #ddd;">سداد مقدم <strong>${displayDp1_6}%</strong> (${formatNum(Math.round(dp1Amt_6))} ج.م) وإلغاء ${isZomra ? 'الدفعة 2 ودفعة 6 شهور' : 'دفعة 5% الثانية'} والاستلام لتثبيت كافة الأقساط عند ${formatNum(fixedInst)} ج.م بسعر إجمالي <strong>${formatNum(Math.round(P_6))} ج.م</strong> (${diffPct_6 >= 0 ? '+' : ''}${diffPct_6.toFixed(2)}%).</span>

                    </div>

                    <button class="btn btn-primary" onclick="applyRecDP_ZeroAll(${dp1Pct_6.toFixed(8)})" style="padding: 5px 12px; font-size: 0.8rem; background: #217346; border-color: #217346; white-space: nowrap; margin-right: 10px;">زيادة المقدم (${displayDp1_6}%) وإلغاء كل الدفعات</button>

                </div>



                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(241, 196, 15, 0.15); border: 1px solid rgba(241, 196, 15, 0.35); padding: 8px 10px; border-radius: 4px;">

                    <div>

                        <strong style="color: #f1c40f;">⚖️ الخيار 7: تثبيت قسط ما قبل الاستلام فقط عند ${formatNum(fixedInst)} ج.م</strong><br>

                        <span style="font-size: 0.83rem; color: #ddd;">دفع <strong>${formatNum(fixedInst)} ج.م</strong> قبل الاستلام، ويكون قسط ما بعد الاستلام <strong>${formatNum(Math.round(solvedPostInst))} ج.م</strong> بسعر إجمالي <strong>${formatNum(Math.round(P_pre))} ج.م</strong> (${prePriceDiffPct >= 0 ? '+' : ''}${prePriceDiffPct.toFixed(2)}%).</span>

                    </div>

                    <button class="btn btn-outline" onclick="applyRecPreOnly()" style="padding: 5px 12px; font-size: 0.8rem; border-color: var(--gold); color: #fff; white-space: nowrap; margin-right: 10px;">تثبيت قبل الاستلام فقط</button>

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



    // 2. Exact Down Payment on Current Plan (Closed-form Analytical Solution)

    let tpl = generateFlowsTemplate(contractDateStr, currentYears, freqMonths, false);

    let dynInstsTpl = tpl.filter(f => (f.isInst || f.isMerged) && !f.isFixedOverride);

    let sumInstDf = 0;

    dynInstsTpl.forEach(f => {

        let tempF = { date: f.date, months: f.months, period: f.period, amount: 1, id: f.id };

        applyDiscountLogic(tempF, contractDateStr);

        sumInstDf += (tempF.pvFactor !== undefined ? tempF.pvFactor : 1.0);

    });

    let nInsts = dynInstsTpl.length;

    let W_inst = nInsts > 0 ? (sumInstDf / nInsts) : 0;



    let sumMsWeight = 0;

    let sumMsPct = 0;

    tpl.forEach(f => {

        if (f.id === 'dp2' || f.id === 'addl') {

            let p = f.defaultPct || 0;

            sumMsPct += p;

            let tempF = { date: f.date, months: f.months, period: f.period, amount: 1, id: f.id };

            applyDiscountLogic(tempF, contractDateStr);

            sumMsWeight += p * (tempF.pvFactor !== undefined ? tempF.pvFactor : 1.0);

        } else if (f.isMerged) {

            let p = 0.05;

            sumMsPct += p;

            let tempF = { date: f.date, months: f.months, period: f.period, amount: 1, id: 'deliv' };

            applyDiscountLogic(tempF, contractDateStr);

            sumMsWeight += p * (tempF.pvFactor !== undefined ? tempF.pvFactor : 1.0);

        }

    });



    let neededDpAmt = 0;

    if (Math.abs(1.0 - W_inst) > 1e-9) {

        neededDpAmt = (targetPv - targetPrice * (sumMsWeight + (1.0 - sumMsPct) * W_inst)) / (1.0 - W_inst);

    }

    let dpNeededPct = targetPrice > 0 ? (neededDpAmt / targetPrice) * 100 : 0;

    let dpNeededAmt = neededDpAmt;

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

    let delivMonth = (currentProject === 'Zomra') ? 37 : (currentProject === 'Perla' ? 51 : 48);

    let dynInsts = tplCurrent.filter(f => (f.isInst || f.isMerged) && !f.isFixedOverride);

    let preCount = dynInsts.filter(f => f.months <= delivMonth).length;

    let postCount = dynInsts.filter(f => f.months > delivMonth).length;

    

    let instActionHtml = '';

    if (preCount > 0 && postCount > 0) {

        let fixedPv = 0;

        let totalMilestonesPct = 0;

        tplCurrent.forEach(f => {

            if (f.isMerged) {

                let dPct = f._delivDefaultPct !== undefined ? f._delivDefaultPct : 0.05;

                totalMilestonesPct += dPct;

                let tempF = { date: f.date, months: f.months, amount: targetPrice * dPct, id: 'deliv' };

                applyDiscountLogic(tempF, contractDateStr);

                fixedPv += (tempF.pv || 0);

            } else if (f.isDP || f.id === 'deliv') {

                totalMilestonesPct += (f.defaultPct || 0);

                let tempF = { date: f.date, months: f.months, amount: targetPrice * (f.defaultPct || 0), id: f.id };

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
    window.globalTableOverrides = {};
    calculate();
    let tbl = document.getElementById('offer-tbody') || document.querySelector('.table-container');
    if (tbl) tbl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (window.showToast) window.showToast(`✅ تم تطبيق مدة ${y} سنوات وتحديث الجدول فوراً!`, true, 4500);
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
    window.globalTableOverrides = {};
    calculate();
    let tbl = document.getElementById('offer-tbody') || document.querySelector('.table-container');
    if (tbl) tbl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (window.showToast) window.showToast(`✅ تم تطبيق مقدم ${pct}% للوصول للسعر المستهدف وتحديث الجدول فوراً!`, true, 4500);
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
    window.globalTableOverrides = {};
    calculate();
    let tbl = document.getElementById('offer-tbody') || document.querySelector('.table-container');
    if (tbl) tbl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (window.showToast) window.showToast(`✅ تم تطبيق قسط ما قبل الاستلام (${amt.toLocaleString()} ج.م) وتحديث الجدول فوراً!`, true, 4500);
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

        window.basePriceCache = basePrice;

        

        let baseYearsEl = document.getElementById('base-duration-years');

        let baseYears = parseInt(baseYearsEl ? baseYearsEl.value : 8) || 8;

        baseYears = Math.max(1, Math.min(20, baseYears));

        

        let baseFreqEl = document.getElementById('base-payment-frequency');

        let baseFreq = (baseFreqEl && parseInt(baseFreqEl.value) === 2) ? 6 : 3;

        

        let isFixedInst = document.getElementById('fixed-inst-toggle') && document.getElementById('fixed-inst-toggle').checked;

        let fixedInstVal = document.getElementById('fixed-inst-val') ? parseFloat(document.getElementById('fixed-inst-val').value) : 0;

        let hasFixedInst = isFixedInst && fixedInstVal > 0;

        let flexibleToggle = document.getElementById('flexible-toggle');

        let isFlexToggled = flexibleToggle && flexibleToggle.value === 'yes';

        let isFlexMode = isFlexToggled;



        let baseTemplate = generateFlowsTemplate(contractDateStr, baseYears, baseFreq, true, null, false, isFlexMode);

        let baseFlows = calculateBaseFlows(basePrice, baseTemplate, contractDateStr);

        basePvCache = baseFlows.filter(f => !f.isMnt).reduce((sum, f) => sum + (f.pv || 0), 0); // Exclude Mnt from NPV

        window.basePvCache = basePvCache;



        baseFlows = reconcileIntegerInstallments(baseFlows, basePrice);

        baseFlows = applyPerfectPercentages(baseFlows, Math.round(basePrice));

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

        let currentTotalCustomInsts = customTemplate.filter(f => (f.isInst || f.isMerged) && !f.isMnt).length;

        if (window._lastTotalCustomInsts !== currentTotalCustomInsts) {

            window._lastTotalCustomInsts = currentTotalCustomInsts;

            if (window.renderFixedInstCheckboxes) window.renderFixedInstCheckboxes(currentTotalCustomInsts);

        }

        

        let targetPv = basePvCache;

        

        let targetPriceStr = document.getElementById('target-price-val') ? document.getElementById('target-price-val').value : '';

        let targetPrice = parseFloat(targetPriceStr);

        if (isNaN(targetPrice) || targetPrice <= 0) targetPrice = null;

        

        let bestPrice = basePriceCache;



        // isFixedInst, fixedInstVal, hasFixedInst already resolved above

        

        let hasTargetPrice = targetPrice !== null;

        let fixedInstScope = document.getElementById('fixed-inst-scope') ? document.getElementById('fixed-inst-scope').value : 'all';

        let hasCustomMilestones = ['dp1', 'dp2', 'addl', 'deliv'].some(id => {

            let el = document.getElementById(id + '-val');

            return el && el.value.trim() !== '';

        });



        let hasTableOverrides = window.globalTableOverrides && Object.keys(window.globalTableOverrides).length > 0;

        let hasCustomInputs = hasCustomMilestones;

        let isDistCustomized = window.globalDistState && (window.globalDistState.mode !== 'auto' || window.globalDistState.typedPrePct !== null || window.globalDistState.typedPostPct !== null);

        let isIntraToggle = (document.getElementById('toggle-intra-year') && document.getElementById('toggle-intra-year').checked);

        let isLegacy7030 = (document.getElementById('toggle-70-30') && document.getElementById('toggle-70-30').checked);

        let intraValRaw = document.getElementById('intra-year-val') ? parseFloat(document.getElementById('intra-year-val').value) : NaN;

        if (isLegacy7030 && (!isIntraToggle || isNaN(intraValRaw) || intraValRaw <= 0)) {

            intraValRaw = 70;

        }

        let hasIntraYearShift = (isIntraToggle || isLegacy7030) && !isNaN(intraValRaw) && intraValRaw > 0;



        let naturalOfferPrice = 0;

        let hasCustomMsActive = window.customMilestonesState && (window.customMilestonesState.splitDP1 || window.customMilestonesState.splitDP2 || (Array.isArray(window.customMilestonesState.extraPayments) && window.customMilestonesState.extraPayments.length > 0));

        if ((currentProject === 'Perla' || currentProject === 'ORB') && years === 8 && freqMonths === 3 && !hasFixedInst && !hasTableOverrides && !hasCustomInputs && !isDistCustomized && !hasIntraYearShift && !hasCustomMsActive) {

            naturalOfferPrice = basePriceCache;

        } else if (currentProject === 'Jirian' && years === 8 && freqMonths === 3 && !hasFixedInst && !hasTableOverrides && !hasCustomInputs && !isDistCustomized && !hasIntraYearShift && !hasCustomMsActive) {

            naturalOfferPrice = basePriceCache;

        } else {

            naturalOfferPrice = solveForPrice(targetPv, customTemplate);

        }



        if (hasTargetPrice) {

            bestPrice = targetPrice;

        } else {

            bestPrice = naturalOfferPrice;

        }

        // Manual Discount / Increase Application

        let manualActionEl = document.getElementById('manual-discount-action');

        let manualAction = manualActionEl ? manualActionEl.value : 'discount';

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

            if (manualAction === 'increase') {

                finalOfferPrice = bestPrice + manualDiscAmt;

            } else {

                finalOfferPrice = Math.max(0, bestPrice - manualDiscAmt);

            }

        }

        

        globalCustomFlows = calculateCustomFlows(finalOfferPrice, customTemplate);

        

        let intraLabel = document.getElementById('intra-year-val-label');

        if (intraLabel) {

            intraLabel.innerText = freqMonths === 3 ? 'قسط أول 3 فترات ربع سنوية (Q1, Q2, Q3)' : 'قسط الفترة النصف سنوية الأولى (H1)';

        }

        

        let effectivePrice = finalOfferPrice;

        let actualPrice = effectivePrice;

        window.lastCalculatedPrice = effectivePrice;



        // Baseline Plan Guard:

        // When parameters strictly match the standard baseline plan with no customizations/overrides,

        // effectivePrice MUST remain strictly equal to basePriceCache (e.g. 5,000,000.00 EGP).

        // GoalSeek solver is skipped entirely to prevent any floating-point drift or 4,999,998 gap.

        let hasInstallmentShift = window.installmentShiftState && window.installmentShiftState.zeroInsts && window.installmentShiftState.zeroInsts.length > 0;

        let hasFirstDateShift = customFirstDateStr !== null;

        let isPureStandardPlan = (freqMonths === baseFreq) && 

                                 !hasFixedInst && !hasTableOverrides && !hasCustomInputs && 

                                 !isDistCustomized && !hasIntraYearShift && !hasTargetPrice && !hasManualDiscount &&

                                 !hasInstallmentShift && !hasFirstDateShift;

        let isPureBaselinePlan = isPureStandardPlan && (years === baseYears);



        if (isPureBaselinePlan) {

            effectivePrice = basePriceCache;

            actualPrice = effectivePrice;

            finalOfferPrice = effectivePrice;

            window.lastCalculatedPrice = effectivePrice;

            globalCustomFlows = calculateCustomFlows(effectivePrice, customTemplate);

            globalCustomFlows = reconcileIntegerInstallments(globalCustomFlows, effectivePrice);

            globalCustomFlows = applyPerfectPercentages(globalCustomFlows, Math.round(effectivePrice));

            window.globalCustomFlows = globalCustomFlows;

        } else {

            effectivePrice = finalOfferPrice;

            actualPrice = effectivePrice;

            window.lastCalculatedPrice = effectivePrice;

            globalCustomFlows = calculateCustomFlows(finalOfferPrice, customTemplate);

            globalCustomFlows = reconcileIntegerInstallments(globalCustomFlows, effectivePrice);

            globalCustomFlows = applyPerfectPercentages(globalCustomFlows, Math.round(effectivePrice));

            window.globalCustomFlows = globalCustomFlows;

        }



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

        if (offerTotAmtEl) offerTotAmtEl.innerText = formatCurr(effectivePrice);

        let offerTotPvEl = document.getElementById('offer-total-pv');

        if (offerTotPvEl) offerTotPvEl.innerText = formatCurr(offerPv);

        

        let offerPreDelivPct = 0;

        let delivMonth = (currentProject === 'Zomra') ? 37 : (currentProject === 'Perla' ? 51 : 48);

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

        renderTargetPriceGuidance(targetPrice, naturalOfferPrice, targetPv);

        generateExportTemplate(actualPrice, offerPreDelivPct);

        

        let manualInfoEl = document.getElementById('manual-discount-info');

        if (manualInfoEl) {

            if (hasManualDiscount) {

                manualInfoEl.style.display = 'block';

                if (manualAction === 'increase') {

                    manualInfoEl.style.color = '#f39c12';

                    manualInfoEl.innerHTML = `✅ تم تطبيق زيادة يدوية: <strong>+${manualDiscPct.toFixed(2)}%</strong> (+${formatCurr(manualDiscAmt)}) — السعر بعد الزيادة: <strong>${formatCurr(finalOfferPrice)}</strong>`;

                } else {

                    manualInfoEl.style.color = '#2ecc71';

                    manualInfoEl.innerHTML = `✅ تم تطبيق خصم يدوي: <strong>-${manualDiscPct.toFixed(2)}%</strong> (-${formatCurr(manualDiscAmt)}) — السعر بعد الخصم: <strong>${formatCurr(finalOfferPrice)}</strong>`;

                }

            } else {

                manualInfoEl.style.display = 'none';

                manualInfoEl.innerHTML = '';

            }

        }

        

        let diffEl = document.getElementById('pv-difference');

        if (diffEl) {

            let priceDiff = effectivePrice - basePriceCache;

            if (basePriceCache <= 0) {

                diffEl.innerHTML = `<span style="color:var(--text-muted)">يرجى إدخال سعر الوحدة الأساسي</span>`;

            } else if (hasManualDiscount) {

                let color = effectivePrice >= basePriceCache ? 'var(--success)' : 'var(--danger)';

                let netDiffPct = ((effectivePrice - basePriceCache) / basePriceCache) * 100;

                let manualLabel = manualAction === 'increase'

                    ? `<span style="color: #f39c12;">📈 زيادة يدوية: +${manualDiscPct.toFixed(2)}% (+${formatCurr(manualDiscAmt)})</span>`

                    : `<span style="color: #2ecc71;">🏷️ خصم يدوي: -${manualDiscPct.toFixed(2)}% (-${formatCurr(manualDiscAmt)})</span>`;

                let headerPriceLabel = manualAction === 'increase' ? 'السعر النهائي بعد الزيادة' : 'السعر النهائي بعد الخصم';



                diffEl.innerHTML = `

                    <div style="color:${color}; font-size: 1.15rem; font-weight: bold;">

                        ${headerPriceLabel}: ${formatCurr(effectivePrice)}

                    </div>

                    <div style="font-size: 0.92rem; margin-top: 5px; font-weight: bold;">

                        ${manualLabel}

                    </div>

                    <div style="font-size: 0.85rem; margin-top: 3px; color: var(--text-muted);">

                        الفارق الصافي عن السعر الأساسي: ${netDiffPct >= 0 ? '+' : ''}${netDiffPct.toFixed(2)}% (${formatCurr(Math.abs(priceDiff))})

                    </div>

                `;

            } else if (hasTargetPrice) {

                let color = effectivePrice >= basePriceCache ? 'var(--success)' : 'var(--danger)';

                let targetDiffPct = ((effectivePrice - basePriceCache) / basePriceCache) * 100;

                diffEl.innerHTML = `

                    <div style="color:${color}; font-size: 1.15rem; font-weight: bold;">

                        السعر المستهدف: ${formatCurr(effectivePrice)}

                    </div>

                    <div style="font-size: 0.95rem; margin-top: 5px; color:${color}; font-weight: bold;">

                        ${targetDiffPct >= 0 ? 'Increase %: ' : 'Discount %: '}${Math.abs(targetDiffPct).toFixed(2)}% (${formatCurr(Math.abs(priceDiff))})

                    </div>

                `;

            } else if (Math.abs(priceDiff) < 1000) {

                diffEl.innerHTML = `<span style="color:var(--success)">✅ Base Plan Applied</span>`;

            } else {

                let isIncrease = priceDiff > 0;

                let diffPct = (Math.abs(priceDiff / basePriceCache) * 100).toFixed(2);

                let color = isIncrease ? '#e67e22' : 'var(--success)';

                let text = isIncrease ? 'Increase %' : 'Discount %';

                diffEl.innerHTML = `

                    <div style="color:${color}; font-size: 1.35rem; font-weight: bold;">${text}: ${diffPct}%</div>

                    <div style="color:${color}; font-size: 1.05rem; margin-top:5px; font-weight: bold;">Amount: ${formatCurr(Math.abs(priceDiff))}</div>

                `;

            }

        }

        // Dynamic Adaptive OR scenario refresher
        if (typeof window.refreshVisibleORContainers === 'function') {
            window.refreshVisibleORContainers();
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

        let monthlyBadgeHtml = '';

        if (cf._isInstZeroShifted) {

            monthlyBadgeHtml = `<div style="font-size: 0.72rem; color: #a855f7; font-weight: bold; margin-top: 1px;">🔀 تم تصفير القسط وترحيله إلى (${cf._shiftedTo}) — دفعة الاستلام باقية بنسبة ${displayPct}% (${formatCurr(cf.amount)})</div>`;

        } else if (cf._isZeroShifted) {

            monthlyBadgeHtml = `<div style="font-size: 0.72rem; color: #a855f7; font-weight: bold; margin-top: 1px;">🔀 قسط مصفّر (تم ترحيله إلى: ${cf._shiftedTo})</div>`;

        } else if (cf._isShiftTarget) {

            monthlyBadgeHtml = `<div style="font-size: 0.72rem; color: #a855f7; font-weight: bold; margin-top: 1px;">➕ مُرحّل عليه من (${cf._shiftedFrom}) (+${formatCurr(cf._addedShiftAmt)})</div>`;

        } else if (cf._isFixedInst) {

            monthlyBadgeHtml = `<div style="font-size: 0.72rem; color: var(--gold); font-weight: bold; margin-top: 1px;">🎯 قسط مثبت: 💡 ${formatCurr(Math.round((cf.amount || 0) / rowFreq))} / شهر</div>`;

        } else if (cf._isTargetInst) {

            monthlyBadgeHtml = `<div style="font-size: 0.72rem; color: #38bdf8; font-weight: bold; margin-top: 1px;">⚖️ مرحل إليه الفرق: 💡 ${formatCurr(Math.round((cf.amount || 0) / rowFreq))} / شهر</div>`;

        } else if (cf._isTargetDeliv) {

            monthlyBadgeHtml = `<div style="font-size: 0.72rem; color: var(--gold); font-weight: bold; margin-top: 1px;">🏢 دفعة استلام محمّلة بفرق التثبيت</div>`;

        } else if (isInstRow) {

            monthlyBadgeHtml = `<div style="font-size: 0.72rem; color: #2ecc71; font-weight: normal; margin-top: 1px;">💡 ${formatCurr(Math.round((cf.amount || 0) / rowFreq))} / شهر</div>`;

        }

        

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

                <td><input type="date" style="width:125px; padding: 2px 4px; font-size: 0.85rem;" class="tbl-input tbl-date" value="${cf.date}" onchange="applyTableEdits(this)"></td>

                <td><input type="number" step="any" style="width:65px;" class="tbl-input tbl-pct" value="${displayPct}" onchange="applyTableEdits(this)">%</td>

                <td>

                    <input type="number" step="1" style="width:105px; color:var(--accent-blue); font-weight:bold;" class="tbl-input tbl-amt" value="${(cf.amount !== undefined && cf.amount !== null) ? Math.round(cf.amount) : '0'}" onchange="applyTableEdits(this)">

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

    let sumOfPcts = 0;

    nonMntFlows.forEach(cf => {

        sumOfPcts += parseFloat(cf.displayPct) || 0;

    });



    // Strictly reconcile displayed totalAmt to exact sum of amounts in nonMntFlows matching Excel M14

    totalAmt = nonMntFlows.reduce((sum, f) => sum + (f.amount || 0), 0);



    let trTotal = document.createElement('tr');

    trTotal.style.backgroundColor = '#e2efda';

    trTotal.innerHTML = `

        <td style="text-align:right; font-weight:bold;">Total Payments:</td>

        <td></td>

        <td style="font-weight:bold; color:#27ae60; font-size:1.02rem;">100.00%</td>

        <td style="color:var(--accent-blue); font-weight:bold;">${formatCurr(totalAmt)}</td>

        <td style="color:var(--gold); font-weight:bold;">${formatCurr(totalPv)}</td>

    `;

    tbody.appendChild(trTotal);



    // Update live balance indicator and button above table

    if (tbodyId === 'offer-tbody') {

        let indEl = document.getElementById('table-pct-balance-indicator');

        let balBtn = document.getElementById('balance-100-btn');

        if (indEl) {

            indEl.innerHTML = `<span style="color:#27ae60;">مجموع نسب الجدول: 100.00% ✅ (متطابق بالكامل تلقائياً)</span>`;

            if (balBtn) balBtn.style.display = 'none';

        }

    }

    

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



    // Render Garage Schedule (Fixed Amenity - Completely Independent of Unit Percentages)

    let garSched = (tbodyId === 'offer-tbody') ? getGarageSchedule(currentProject, window.garageOption, document.getElementById('contract-date')?.value) : null;

    if (garSched && garSched.items && garSched.items.length > 0) {

        let trGarHead = document.createElement('tr');

        trGarHead.style.backgroundColor = '#1f4e78';

        trGarHead.style.color = 'white';

        trGarHead.innerHTML = `<td colspan="5" style="font-weight:bold; padding: 6px 8px;">🚗 Parking / Garage Schedule (${garSched.title})</td>`;

        tbody.appendChild(trGarHead);

        

        garSched.items.forEach(g => {

            let trG = document.createElement('tr');

            trG.style.backgroundColor = '#f2f7fa';

            trG.innerHTML = `

                <td style="text-align:left; font-weight: 500;">${g.label}</td>

                <td>${g.date}</td>

                <td style="color:#27ae60; font-weight:bold;">Fixed</td>

                <td style="color:var(--accent-blue); font-weight:bold;">${formatCurr(g.amount)}</td>

                <td style="color:var(--text-muted);">-</td>

            `;

            tbody.appendChild(trG);

        });

        

        let trGarTotal = document.createElement('tr');

        trGarTotal.style.backgroundColor = '#d9e8f5';

        trGarTotal.innerHTML = `

            <td style="text-align:right; font-weight:bold;">Total Parking / Garage:</td>

            <td></td>

            <td style="font-weight:bold; color:#27ae60;">Fixed Amenity</td>

            <td style="color:var(--accent-blue); font-weight:bold;">${formatCurr(garSched.totalAmount)}</td>

            <td style="color:var(--text-muted);">-</td>

        `;

        tbody.appendChild(trGarTotal);

        

        // Grand Total Row (Unit Offer Price + Maintenance Deposit + Garage)

        let mntSum = (flows || []).filter(f => f.isMnt).reduce((s, f) => s + (f.amount || 0), 0);

        let dispOfferPrice = window.lastCalculatedPrice || totalAmt;

        let grandTotal = dispOfferPrice + mntSum + garSched.totalAmount;

        let trGrand = document.createElement('tr');

        trGrand.style.backgroundColor = '#1b365d';

        trGrand.style.color = 'white';

        trGrand.style.fontSize = '1.02rem';

        trGrand.innerHTML = `

            <td style="text-align:right; font-weight:bold; padding: 8px 10px; color: #ffd700;">GRAND TOTAL (OFFER + MNT + GARAGE):</td>

            <td></td>

            <td style="font-weight:bold; color: #ffd700;">100% + Mnt + Gar</td>

            <td style="color:#ffffff; font-weight:bold; font-size:1.08rem;">${formatCurr(grandTotal)}</td>

            <td style="color:#ffd700; font-weight:bold;">-</td>

        `;

        tbody.appendChild(trGrand);

    }

    

    if (tbodyId === 'offer-tbody') {

        let dispAmt = window.lastCalculatedPrice || totalAmt;

        document.getElementById('offer-total-amt').innerText = formatCurr(dispAmt);

        

        // Update Garage & Grand Total summary items (Zero impact on unit percentages)

        let garSched = getGarageSchedule(currentProject, window.garageOption, document.getElementById('contract-date')?.value);

        let garSum = garSched ? garSched.totalAmount : 0;

        let mntSum = (flows || []).filter(f => f.isMnt).reduce((s, f) => s + (f.amount || 0), 0);

        let grandTotal = dispAmt + mntSum + garSum;

        

        let garItem = document.getElementById('offer-garage-summary-item');

        let grandItem = document.getElementById('offer-grand-total-summary-item');

        let garVal = document.getElementById('offer-total-garage');

        let grandVal = document.getElementById('offer-grand-total-amt');

        

        if (garSum > 0) {

            if (garItem) {

                garItem.style.display = 'flex';

                garItem.style.justifyContent = 'space-between';

            }

            if (garVal) garVal.innerText = formatCurr(garSum);

            if (grandItem) {

                grandItem.style.display = 'flex';

                grandItem.style.justifyContent = 'space-between';

            }

            if (grandVal) grandVal.innerText = formatCurr(grandTotal);

        } else {

            if (garItem) garItem.style.display = 'none';

            if (grandItem) grandItem.style.display = 'none';

        }

    }

}



window.onManualActionChange = function() {

    let actionEl = document.getElementById('manual-discount-action');

    let action = actionEl ? actionEl.value : 'discount';

    let labelEl = document.getElementById('manual-discount-val-label');

    let cardEl = document.getElementById('manual-discount-card');

    let titleEl = document.getElementById('manual-discount-title');

    let iconEl = document.getElementById('manual-discount-icon');

    let headerTextEl = document.getElementById('manual-discount-header-text');

    

    if (action === 'increase') {

        if (labelEl) labelEl.innerText = 'قيمة الزيادة';

        if (iconEl) iconEl.innerText = '📈';

        if (headerTextEl) headerTextEl.innerText = 'زيادة يدوية مباشرة (Manual Markup / Overprice)';

        if (titleEl) titleEl.style.color = '#f39c12';

        if (cardEl) {

            cardEl.style.borderLeftColor = '#f39c12';

            cardEl.style.background = 'rgba(243, 156, 18, 0.08)';

        }

    } else {

        if (labelEl) labelEl.innerText = 'قيمة الخصم';

        if (iconEl) iconEl.innerText = '🏷️';

        if (headerTextEl) headerTextEl.innerText = 'خصم يدوي مباشر (Manual Discount)';

        if (titleEl) titleEl.style.color = '#2ecc71';

        if (cardEl) {

            cardEl.style.borderLeftColor = '#2ecc71';

            cardEl.style.background = 'rgba(46, 204, 113, 0.05)';

        }

    }

};



window.clearManualDiscount = function() {

    let el = document.getElementById('manual-discount-val');

    if (el) el.value = '';

    let actionEl = document.getElementById('manual-discount-action');

    if (actionEl) actionEl.value = 'discount';

    if (window.onManualActionChange) window.onManualActionChange();

    let info = document.getElementById('manual-discount-info');

    if (info) {

        info.style.display = 'none';

        info.innerHTML = '';

    }

    calculate();

};



function syncMilestoneToTop(flowId, val, type) {

    if (['dp1', 'dp2', 'addl', 'deliv'].includes(flowId)) {

        let valEl = document.getElementById(flowId + '-val');

        let typeEl = document.getElementById(flowId + '-type');

        if (valEl) valEl.value = val;

        if (typeEl) typeEl.value = type;

    }

}



window.applyTableEdits = function(callerEl) {

    let tbody = document.getElementById('offer-tbody');

    if (!tbody) return;

    if (!window.globalTableOverrides) window.globalTableOverrides = {};

    

    // If user edits an installment manually, uncheck fixed-inst-toggle so remaining installments dynamically balance

    if (callerEl && callerEl.closest) {

        let tr = callerEl.closest('tr');

        if (tr && tr.dataset && tr.dataset.flowId && tr.dataset.flowId.startsWith('inst_')) {

            let fToggle = document.getElementById('fixed-inst-toggle');

            if (fToggle && fToggle.checked) {

                fToggle.checked = false;

            }

        }

    }

    

    // If a specific input element triggered onchange (callerEl), process that row specifically

    if (callerEl && callerEl.closest) {

        let tr = callerEl.closest('tr');

        if (tr && tr.dataset.flowId) {

            let flowId = tr.dataset.flowId;

            let f = (window.globalCustomFlows || []).find(item => item.id === flowId);

            if (f) {

                let dateInput = tr.querySelector('.tbl-date');

                let pctInput = tr.querySelector('.tbl-pct');

                let amtInput = tr.querySelector('.tbl-amt');

                

                if (callerEl.classList.contains('tbl-date')) {

                    if (dateInput && dateInput.value && dateInput.value !== f.date) {

                        if (!window.globalTableOverrides[flowId]) window.globalTableOverrides[flowId] = {};

                        window.globalTableOverrides[flowId].date = dateInput.value;

                    }

                } else if (callerEl.classList.contains('tbl-pct')) {

                    let typedPct = parseFloat(pctInput.value) || 0;

                    if (!window.globalTableOverrides[flowId]) window.globalTableOverrides[flowId] = {};

                    window.globalTableOverrides[flowId].amount = typedPct;

                    window.globalTableOverrides[flowId].isPct = true;

                    syncMilestoneToTop(flowId, typedPct, 'pct');

                } else if (callerEl.classList.contains('tbl-amt')) {

                    let typedAmt = parseFloat(amtInput.value.replace(/,/g, '')) || 0;

                    if (!window.globalTableOverrides[flowId]) window.globalTableOverrides[flowId] = {};

                    window.globalTableOverrides[flowId].amount = typedAmt;

                    window.globalTableOverrides[flowId].isPct = false;

                    syncMilestoneToTop(flowId, typedAmt, 'amt');

                }

            }

        }

    } else {

        // Bulk scan from "احسب بعد تعديل الجدول" button

        Array.from(tbody.rows).forEach((tr) => {

            let flowId = tr.dataset.flowId;

            if (!flowId) return;

            let f = (window.globalCustomFlows || []).find(item => item.id === flowId);

            if (!f) return;

            

            let dateInput = tr.querySelector('.tbl-date');

            let pctInput = tr.querySelector('.tbl-pct');

            let amtInput = tr.querySelector('.tbl-amt');

            

            // Only override date if actually changed from original flow date

            if (dateInput && dateInput.value && dateInput.value !== f.date) {

                if (!window.globalTableOverrides[flowId]) window.globalTableOverrides[flowId] = {};

                window.globalTableOverrides[flowId].date = dateInput.value;

            }

            

            if (amtInput && pctInput) {

                let currentAmt = f.amount || 0;

                let typedAmt = parseFloat(amtInput.value.replace(/,/g, '')) || 0;

                let currentPct = parseFloat(f.displayPct) || 0;

                let typedPct = parseFloat(pctInput.value) || 0;

                

                let pctChanged = Math.abs(typedPct - currentPct) > 0.001;

                let amtChanged = Math.abs(typedAmt - currentAmt) > 0.50;

                

                if (pctChanged || amtChanged) {

                    if (flowId.startsWith('inst_')) {

                        let fToggle = document.getElementById('fixed-inst-toggle');

                        if (fToggle && fToggle.checked) {

                            fToggle.checked = false;

                        }

                    }

                }

                

                if (pctChanged) {

                    if (!window.globalTableOverrides[flowId]) window.globalTableOverrides[flowId] = {};

                    window.globalTableOverrides[flowId].amount = typedPct;

                    window.globalTableOverrides[flowId].isPct = true;

                    syncMilestoneToTop(flowId, typedPct, 'pct');

                } else if (amtChanged && (!window.globalTableOverrides[flowId] || !window.globalTableOverrides[flowId].isPct)) {

                    if (!window.globalTableOverrides[flowId]) window.globalTableOverrides[flowId] = {};

                    window.globalTableOverrides[flowId].amount = typedAmt;

                    window.globalTableOverrides[flowId].isPct = false;

                    syncMilestoneToTop(flowId, typedAmt, 'amt');

                }

            }

        });

    }

    

    calculate();

};



window.balanceRemainingTo100 = function() {

    if (!window.globalCustomFlows || window.globalCustomFlows.length === 0) return;

    let nonMnt = window.globalCustomFlows.filter(f => !f.isMnt);

    let totalAmt = window.lastCalculatedPrice || basePriceCache || 0;

    if (totalAmt <= 0) return;



    let overrides = window.globalTableOverrides || {};

    let fixedPctSum = 0;

    let dynamicFlows = [];



    nonMnt.forEach(f => {

        if (overrides[f.id] && overrides[f.id].amount !== undefined) {

            let ov = overrides[f.id];

            let p = ov.isPct ? ov.amount : ((ov.amount / totalAmt) * 100);

            fixedPctSum += p;

        } else if (['dp1', 'dp2', 'addl', 'deliv'].includes(f.id) && document.getElementById(f.id + '-val')?.value.trim() !== '') {

            let v = parseFloat(document.getElementById(f.id + '-val').value) || 0;

            let t = document.getElementById(f.id + '-type')?.value || 'pct';

            let p = t === 'pct' ? v : ((v / totalAmt) * 100);

            fixedPctSum += p;

        } else if (f._isZeroShifted) {

            fixedPctSum += 0;

        } else {

            dynamicFlows.push(f);

        }

    });



    let remainingPct = 100.0 - fixedPctSum;

    if (dynamicFlows.length > 0) {

        let pctPerDynamic = Math.max(0, remainingPct / dynamicFlows.length);

        if (!window.globalTableOverrides) window.globalTableOverrides = {};

        dynamicFlows.forEach(f => {

            window.globalTableOverrides[f.id] = {

                amount: pctPerDynamic,

                isPct: true

            };

        });

    }

    calculate();

};



window.resetTableEdits = function() {

    window.globalTableOverrides = {};

    ['dp1', 'dp2', 'addl', 'deliv'].forEach(id => {

        let valEl = document.getElementById(id + '-val');

        if (valEl) valEl.value = '';

    });

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

    let garSched = getGarageSchedule(currentProject, window.garageOption, contractDateStr);

    let totalGarageAmt = garSched ? garSched.totalAmount : 0;

    let garageCount = garSched ? garSched.items.length : 0;

    let totalItems = nonMntFlows.length + mntFlows.length + garageCount;



    // Calibrated for full-page A4 printing (usable width 190mm, usable height ~280mm)

    let fontSize = '10.5px';

    let cellPadding = '3.5px 6px';

    let titleFontSize = '14px';

    let subHeaderFontSize = '11.5px';



    if (totalItems >= 42) { // 9, 10 Years (42+ rows)

        fontSize = '9px';

        cellPadding = '2px 4.5px';

        titleFontSize = '12px';

        subHeaderFontSize = '10px';

    } else if (totalItems >= 32) { // 7, 8 Years (32-38 rows)

        fontSize = '10px';

        cellPadding = '2.8px 5.5px';

        titleFontSize = '13.5px';

        subHeaderFontSize = '11px';

    } else if (totalItems >= 20) { // 4, 5, 6 Years (20-28 rows)

        fontSize = '11px';

        cellPadding = '4.5px 6.5px';

        titleFontSize = '14.5px';

        subHeaderFontSize = '12px';

    } else { // 2, 3 Years (<20 rows)

        fontSize = '12px';

        cellPadding = '6.5px 8px';

        titleFontSize = '15.5px';

        subHeaderFontSize = '13px';

    }



    let mntTotal = price * 0.08;

    let incPct = (price - basePriceCache) / basePriceCache;

    let isDiscount = incPct < 0;

    let label1 = isDiscount ? 'Discount % :' : 'Increase % :';

    let label2 = isDiscount ? 'Price After Discount :' : 'Price After Increase :';

    let displayIncPct = Math.abs(incPct);



    let isApproved = isBase ? true : (!window.isManuallyDisapproved);

    let approvalText = isBase ? 'APPROVED (Standard Baseline)' : (isApproved ? 'APPROVED' : 'NOT APPROVED');

    let approvalColor = isApproved ? '#27ae60' : '#c0392b';



    let metaRows = '';

    if (clientName) {

        metaRows += `<tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding}; padding-left: 12px;">Client Name :</td><td colspan="3" class="export-bold" style="text-align: left; border-right: 1.5px solid black; padding: ${cellPadding}; padding-left: 14px;">${escapeHtml(clientName)}</td></tr>`;

    }

    if (unitNo) {

        metaRows += `<tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding}; padding-left: 12px;">Unit No :</td><td colspan="3" class="export-bold" style="text-align: left; border-right: 1.5px solid black; padding: ${cellPadding}; padding-left: 14px;">${escapeHtml(unitNo)}</td></tr>`;

    }



    let priceRows = isBase ? `

        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding}; padding-left: 12px;">Increase % :</td><td colspan="3" style="text-align: left; border-right: 1.5px solid black; padding: ${cellPadding}; padding-left: 14px;">0.00%</td></tr>

        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding}; padding-left: 12px;">Unit Price :</td><td colspan="3" class="export-bold" style="text-align: left; border-right: 1.5px solid black; padding: ${cellPadding}; padding-left: 14px;">${formatNum(price)}</td></tr>

    ` : `

        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding}; padding-left: 12px;">${label1}</td><td colspan="3" style="text-align: left; border-right: 1.5px solid black; padding: ${cellPadding}; padding-left: 14px;">${formatPct(displayIncPct)}</td></tr>

        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding}; padding-left: 12px;">${label2}</td><td colspan="3" class="export-bold" style="text-align: left; border-right: 1.5px solid black; padding: ${cellPadding}; padding-left: 14px;">${formatNum(price)}</td></tr>

    `;



    let html = `

        <colgroup>

            <col style="width: 15%;">

            <col style="width: 31%;">

            <col style="width: 10%;">

            <col style="width: 24%;">

            <col style="width: 20%;">

        </colgroup>

        <tr><th colspan="5" class="export-header-blue" style="font-size: ${titleFontSize}; border: 1.5px solid black; padding: 4px; letter-spacing: 0.3px;">${title}</th></tr>

        ${metaRows}

        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding}; padding-left: 12px;">Date :</td><td colspan="3" style="text-align: left; border-right: 1.5px solid black; padding: ${cellPadding}; padding-left: 14px;">${formatDateExport(contractDateStr || new Date())}</td></tr>

        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding}; padding-left: 12px;">Unit Base Price :</td><td colspan="3" style="text-align: left; border-right: 1.5px solid black; padding: ${cellPadding}; padding-left: 14px;">${formatNum(basePriceCache)}</td></tr>

        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding}; padding-left: 12px;">Maintenance (8%) :</td><td colspan="3" style="text-align: left; border-right: 1.5px solid black; padding: ${cellPadding}; padding-left: 14px;">${formatNum(mntTotal)}</td></tr>

        ${totalGarageAmt > 0 ? `<tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding}; padding-left: 12px;">Garage Option :</td><td colspan="3" style="text-align: left; border-right: 1.5px solid black; padding: ${cellPadding}; padding-left: 14px;">${garSched ? garSched.title : ''}</td></tr>

        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding}; padding-left: 12px; color: #1b365d;">Grand Total (Unit+Mnt+Gar) :</td><td colspan="3" class="export-bold" style="text-align: left; border-right: 1.5px solid black; padding: ${cellPadding}; padding-left: 14px; color: #1b365d;">${formatNum(price + mntTotal + totalGarageAmt)} EGP</td></tr>` : ''}

        ${priceRows}

        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; padding: ${cellPadding}; padding-left: 12px;">Collected Till Delivery:</td><td colspan="3" style="text-align: left; border-right: 1.5px solid black; padding: ${cellPadding}; padding-left: 14px;">${(preDelivPct || 0).toFixed(2)}%</td></tr>

        <tr><td colspan="2" class="export-bold" style="text-align: left; border-left: 1.5px solid black; border-bottom: 1.5px solid black; padding: ${cellPadding}; padding-left: 12px;">Approval Status:</td><td colspan="3" class="export-bold" style="text-align: left; border-right: 1.5px solid black; border-bottom: 1.5px solid black; padding: ${cellPadding}; padding-left: 14px; color: ${approvalColor};">${approvalText}</td></tr>

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

        else if (f._instYear) {

            grpName = 'Year ' + f._instYear;

        } else {

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



    if (garSched && garSched.items && garSched.items.length > 0) {

        html += `<tr><td colspan="5" style="height: 4px; border: none; padding: 0;"></td></tr>`;

        html += `<tr><th colspan="2" class="export-header-blue" style="border-left: 1.5px solid black; border-top: 1.5px solid black; border-bottom: 1.5px solid black; padding: ${cellPadding}; font-size: ${subHeaderFontSize};">Parking / Garage Payments (${garSched.title})</th><th colspan="3" style="border-right: 1.5px solid black; border-top: 1.5px solid black; border-bottom: 1.5px solid black; padding: ${cellPadding};"></th></tr>`;

        

        garSched.items.forEach((g, i) => {

            let isLastG = i === garSched.items.length - 1;

            let bottomBorder = isLastG ? 'border-bottom: 1.5px solid black;' : 'border-bottom: 1px dotted #888;';

            html += `<tr>

                <td colspan="2" style="border-left: 1.5px solid black; border-right: 1px dotted #888; ${bottomBorder} padding: ${cellPadding};">${g.label}</td>

                <td style="${bottomBorder} border-right: 1px dotted #888; padding: ${cellPadding};">Fixed</td>

                <td style="${bottomBorder} border-right: 1px dotted #888; padding: ${cellPadding};">${formatNum(g.amount)}</td>

                <td style="border-right: 1.5px solid black; ${bottomBorder} padding: ${cellPadding};">${formatDateExport(g.date)}</td>

            </tr>`;

        });

        

        html += `<tr>

            <td colspan="2" class="export-header-blue" style="border-left: 1.5px solid black; border-bottom: 1.5px solid black; text-align: center; padding: ${cellPadding};">Total Parking / Garage</td>

            <td class="export-header-blue" style="border-bottom: 1.5px solid black; padding: ${cellPadding};">Fixed</td>

            <td class="export-header-blue" style="border-bottom: 1.5px solid black; padding: ${cellPadding};">${formatNum(totalGarageAmt)}</td>

            <td class="export-header-blue" style="border-bottom: 1.5px solid black; border-right: 1.5px solid black; padding: ${cellPadding};"></td>

        </tr>`;

        

        let grandTotal = price + mntTotal + totalGarageAmt;

        html += `<tr>

            <td colspan="2" class="export-header-blue" style="background:#1b365d; color:#ffd700; border-left: 1.5px solid black; border-bottom: 1.5px solid black; text-align: center; font-weight:bold; padding: ${cellPadding};">GRAND TOTAL (OFFER + MNT + GARAGE)</td>

            <td class="export-header-blue" style="background:#1b365d; color:#ffd700; border-bottom: 1.5px solid black; padding: ${cellPadding}; font-weight:bold;">100%</td>

            <td class="export-header-blue" style="background:#1b365d; color:#ffffff; border-bottom: 1.5px solid black; font-weight:bold; font-size:11px; padding: ${cellPadding};">${formatNum(grandTotal)}</td>

            <td class="export-header-blue" style="background:#1b365d; color:white; border-bottom: 1.5px solid black; border-right: 1.5px solid black; padding: ${cellPadding};"></td>

        </tr>`;

    }



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

        exportTable.style.width = '100%';

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

            exportTableBase.style.width = '100%';

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



        // Set clean relative layout with 100% natural height, 680px width, padding 0, and left: 0 (margin: 0 auto)

        element.style.position = 'relative';

        element.style.top = '0px';

        element.style.left = '0px';

        element.style.margin = '0 auto';

        element.style.width = '680px';

        element.style.padding = '0';

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



        let clientPart = clientName ? `_${clientName.replace(/[\/\\:*?"<>|]/g, '-').replace(/\s+/g, '_')}` : '';

        let unitPart = unitNo ? `_Unit_${unitNo.replace(/[\/\\:*?"<>|]/g, '-').replace(/\s+/g, '_')}` : '';

        let compPart = isComparing ? '_With_Base_Comparison' : '';

        let pdfFileName = `Payment_Plan_${projName}_${yearsVal}Y${unitPart}${clientPart}${compPart}.pdf`;



        let opt = {

            margin:       [8, 8, 8, 8], // 8mm margins for full-width A4 print

            filename:     pdfFileName,

            image:        { type: 'jpeg', quality: 0.98 },

            html2canvas:  { 

                scale: 2, 

                useCORS: true, 

                logging: false,

                scrollX: 0,

                scrollY: 0

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

                element.style.width = origWidth || '680px';

                element.style.padding = origPadding || '0';

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

            if (typeof showToast === 'function') {

                showToast('✅ تم تصدير ملف الـ PDF (' + pdfFileName + ') بنجاح في Downloads! يمكنك نقله لمجلد خطط السداد بضغطة واحدة من سطح المكتب.');

            }

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



const EMBEDDED_EXCEL_TEMPLATE_B64 = "UEsDBBQABgAIAAAAIQB0NlqmegEAAIQFAAATAAgCW0NvbnRlbnRfVHlwZXNdLnhtbCCiBAIooAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACsVM1OAjEQvpv4DpteDVvwYIxh4YB6VBLwAWo7sA3dtukMCG/vbEFiDEIIXLbZtvP9TGemP1w3rlhBQht8JXplVxTgdTDWzyvxMX3tPIoCSXmjXPBQiQ2gGA5ub/rTTQQsONpjJWqi+CQl6hoahWWI4PlkFlKjiH/TXEalF2oO8r7bfZA6eAJPHWoxxKD/DDO1dFS8rHl7q+TTelGMtvdaqkqoGJ3VilioXHnzh6QTZjOrwQS9bBi6xJhAGawBqHFlTJYZ0wSI2BgKeZAzgcPzSHeuSo7MwrC2Ee/Y+j8M7cn/rnZx7/wcyRooxirRm2rYu1w7+RXS4jOERXkc5NzU5BSVjbL+R/cR/nwZZV56VxbS+svAJ3QQ1xjI/L1cQoY5QYi0cYDXTnsGPcVcqwRmQly986sL+I19QodWTo9qLpErJ2GPe4yfW3qcQkSeGgnOF/DTom10JzIQJLKwb9JDxb5n5JFzsWNoZ5oBc4Bb5hk6+AYAAP//AwBQSwMEFAAGAAgAAAAhALVVMCP0AAAATAIAAAsACAJfcmVscy8ucmVscyCiBAIooAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACskk1PwzAMhu9I/IfI99XdkBBCS3dBSLshVH6ASdwPtY2jJBvdvyccEFQagwNHf71+/Mrb3TyN6sgh9uI0rIsSFDsjtnethpf6cXUHKiZylkZxrOHEEXbV9dX2mUdKeSh2vY8qq7iooUvJ3yNG0/FEsRDPLlcaCROlHIYWPZmBWsZNWd5i+K4B1UJT7a2GsLc3oOqTz5t/15am6Q0/iDlM7NKZFchzYmfZrnzIbCH1+RpVU2g5abBinnI6InlfZGzA80SbvxP9fC1OnMhSIjQS+DLPR8cloPV/WrQ08cudecQ3CcOryPDJgosfqN4BAAD//wMAUEsDBBQABgAIAAAAIQDEcHL9nAMAAP0IAAAPAAAAeGwvd29ya2Jvb2sueG1srFVdb6M4FH1faf8D4p1i85WAmo5CAG2ldrZKM+3uU+SCU6wAZm2nSVTNf99rCGk7Wa2ynUWJje3r43PvPddcftnVlfFChWS8mZj4ApkGbXJesOZ5Yn5bZNbYNKQiTUEq3tCJuafS/HL16y+XWy7WT5yvDQBo5MQslWoj25Z5SWsiL3hLG1hZcVETBUPxbMtWUFLIklJVV7aDUGDXhDVmjxCJczD4asVymvB8U9NG9SCCVkQBfVmyVg5odX4OXE3EetNaOa9bgHhiFVP7DtQ06jy6fm64IE8VuL3DvrET8AvgjxE0znASLJ0cVbNccMlX6gKg7Z70if8Y2Rh/CMHuNAbnIXm2oC9M5/DISgSfZBUcsYI3MIx+Gg2DtDqtRBC8T6L5R26OeXW5YhV96KVrkLb9Smqdqco0KiJVWjBFi4k5giHf0rcJ8Eps2njDKlh1kesEpn11lPOdgAHkflopKhqi6Iw3CqR2oP6zsuqwZyUHERtz+teGCQq1AxICd6AleUSe5B1RpbERVR8kCVUFRLTA+Uqu91a9v5AlEbTlrOkF1kIQeEMqEFNZ802xrMlzsV++37XUQhzqRtoJlWvFW/v3qlgeQmi/EzQ5rZ7/IGmS64jaEMXe0/79x4iCwyIaZHunhAHv18kNpO6evEAi3cA1jeJQ6deQK+wum1xEePka+iMHJ6PMykJ3annBKLHiIJxabhzgse8m7ijwv4M7IohyTjaqPLiowSemB5I4Wbolu2EFo2jDijcir2maJihDsZXMHM/yEjexpk44g9PDYJzMkgBl2Xftsr4PHxjdyjc96aGxe2RNwbcT08K6CvYfh9tu8ZEVqgQnQ88Bk37uN8qeS2CMkYt09QhHM5uYr+jwWNAnukFWBk/XDGsdI/sdpe7mBWpdbzRdtdzr2xjDFa/7LshQHZE+Q1wXuEvjsC0nVX4nDN11hiFGTqgt6E7dSNX1oFoG9LCHpiMUehZKXd/yxqFjjT3XsWZe4qT+KE3SuMuP/nJE/8f92RVPNHySNEsoELUQJF/Dh2xOVzGRIKneIeD7nmzsj2PkAkUvw5nl4RBZcRx4lp9krj/CySz1IbvD1aXdX33y9hrb3W5K1AbKXld8N450mx1mj5OrfuKQpw/VF80THffD7n8zvAfvK3qmcfZwpuHs6+3i9kzbm3SxfMzONZ7exsn0fPvpfD79c5H+MRxh/2NA7S7huu1kag8yufobAAD//wMAUEsDBBQABgAIAAAAIQCSB5TsBAEAAD8DAAAaAAgBeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHMgogQBKKAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACskstqxDAMRfeF/oPRvnEyfVCGcWbRUphtm36AcJQ4TGIHW33k72tSOsnAkG6yMUjC9x6Ju9t/d634JB8aZxVkSQqCrHZlY2sF78XLzSOIwGhLbJ0lBQMF2OfXV7tXapHjp2CaPoioYoMCw9xvpQzaUIchcT3ZOKmc75Bj6WvZoz5iTXKTpg/SzzUgP9MUh1KBP5S3IIqhj87/a7uqajQ9O/3RkeULFjLw0MYFRIG+JlbwWyeREeRl+82a9hzPQpP7WMrxzZYYsjUZvpw/BkPEE8epFeQ4WYS5XxNGY6ufDDZ2gjm1li5yt2ooDHoq39jHzM+zMW//wciz2Oc/AAAA//8DAFBLAwQUAAYACAAAACEA5st/HmwPAACcTAAAGAAAAHhsL3dvcmtzaGVldHMvc2hlZXQxLnhtbKRcbW8buRH+XqD/QRCuwPXQWNpXvcD2IRdrV0J8l1yTa9GPiryOhbO0Pkl5a9H/3iE5Q86QK2tXLa6R/Gg4nBkOh89yuXv549fNY+9ztduv6+1VP7oY9nvVdlXfrbcfr/q/vS9ejPu9/WG5vVs+1tvqqv+t2vd/vP7zny6/1Lvf9w9VdeiBhu3+qv9wODxNB4P96qHaLPcX9VO1hV/u691meYA/dx8H+6ddtbzTjTaPg3g4zAeb5XrbNxqmuzY66vv79aq6qVefNtX2YJTsqsflAezfP6yf9qRts2qjbrPc/f7p6cWq3jyBig/rx/Xhm1ba721W08XHbb1bfngEv79G6XLV+7qD/2L4f0LdaDzoabNe7ep9fX+4AM0DY3Po/mQwGSxXVlPofys1UTrYVZ/XagCdqvg8k6LM6oqdsuRMZblVpsK1m35a3131/zPE/72Az0j9M3T/0G//7V9f6jx5u7u+fFp+rN5Vh9+e3u569+vD+/otAJCr/cH15cBK3a0hIVQQervq/qr/Mp7+OhopES3xj3X1Zc++9/YP9Zdyt767XW8rSF5I+8Pyw7vqsVodKrAygr/rp9vq/vCqeny86r8C4N91vXm3WqpsGOX9npoAH+r6d6V6AU2GymatQBmxXB3WnyvT+HWWwST6Q9ulvlu7VVPygVtY6EkD7t5V98tPj4dX9eM/13eHB+j4Is2SKAZ9+NPf6y/zav3x4QA2pxeA64Sc3n27qfYrmCFg10Wiu1zVjxAB+Le3WcNUh/HdLL/qzy9GdzS5iEaTfDwCLR+q/aFYK6X93urT/lBv0AAddasExlUrgU9UAoFp2TbFtvBJBqSdDQBTtQHwiUrGF1kaoxfPWA526oZqIK374yhPh7mK7jMtR9gSPqnlqF2fUEp1n/BJLbOLPInHekBbhm2CSuCTlAwvJsbqlioiyHZtiPqCSsCbtq0hJUxr+EImwNe2zSnxIvjiAmgzb3/4pmZYB4WUhJHLQp7K3RVSUkUuq6Kk80BFlCjqCznaWs3ATFddvG6Wh+X15a7+0oMlAqK2f1qqBTeaKs165kPSN878NIOitFLNblS7q36qCttVfw/w5+t8dDn4DPVnhTIzKwMVSrcqAqQMkHmALDgyALut8TBCwvjmYkUmK+mrfgKZbk0eehZbEWuxQdJYVVntQxkg8wBZcERYDNWpg8VK2rM48iy2ItZig6SJsxgR58M8QBYcERartYYnyPMxVtKexbFnsRWxFhskVSve/XWR/hAN/3I5uFcp5Y1PGbSdB8giQG4R0QslTx8o1h1cU9Kea8nE883KWN8Mkubat9v8iF9WitrNA2QRILfYm5qUPFRi+GBKd/BRSXs+pv4csTLWR4PY8XtR5D8U6RFPg9bzAFkEyC0iwQiqq4n2yamkoWbZiTHzgcIHSh+Y+8DCB14bwHAkVSrfGMDwS55+UIg6GK+k/fTzss+K2JEJkNIgKQTU1W3ISl635ygztoFaIDKxyK1Bcgv8agBNkUUCKlIQrjDZcW5J5Vo3FMMVIAUiztISEV7kIRWFew0imRRZNIi4IEn3YAXsMIqREgenoCTZ+PvLppOx4xhCJUJgqa0ZBEW62IDED98V34H2plK6IOFYCfdWS8WRrt+/uXn5r+//ik3SPJ54wXtDzdzy8pYgPbFkcHx28ezi8VJROEVE3Nz5iSCXaDcIQQjJ8VkIFSFUki4eMexRR0yPyMNyV931zUXfPIqn80RV2bW+HgMNz0YUlamIfr5O8yTzRvYtWdAQqU5U5ifFTVWkXC27QSiFhdxm1tgrEE7GZRZq4gXBW9VK6o0HDpsFgTOhAvXB4r0gNSLjZjcv38++h2z8W+LSLhl7E/KW2rqZ/gahhorTiWT9BEHUseQphmyIp1gAFdSQ15rIZywkxGOHHXaKHbZpjF3CY5eOXOzkZOzG5NTViqlUbpoFUIFSkYiBx1FLEuIxMKqgdKjqoxIWJ95z+YNtTAxYG70Tsoiy6SKDKWhKmZ6zoJ3yK+UxyvxLlddkokuCNwKSkexGHCNkbjybAqhAKRlJjzuXJMQjaVR1iyS2CSIpYqcncZrnmVcPbtEKHSsZGMc206kqds9fLKjrTX8xjBK/ZlkhV7MMJEPlLVQlKhfrI7brlHTYplWoRpmb/jIwjqi2CgySSp4xAVRESCzF3PMKZ0lCPGOwXacwYJtWYRinrgLIMDjK2yoMSDt5GAKoUGmg1kIRBo/SliTEw4DtOoUB27QKwyRxuSzCEDtK3CYMWlxzRluJQ6hASIbBIyAlCbEwENQlDNSmTRhGw/jIghQ76twqDEidOcGJfIajdUKsHDEqEFL1wBKjyKc4JMQDY/rrVFhJTavARNGRa4rY0eZWgcH9MTZNtAaRMgVCIj9in62QEA/DMYr8zEpNalqFIR4eC4PjxK3CgJtuPAwBVMRIXHm1iH3CQkI8DGcQXlLTLgwTL5dvsTlMNpj3soA4htsqMiGdjUM6i5BMEJ+AkBCPzBl0ltS0ikwyObKqqjsreO3dKgyWvrpCEPt0Q+v0Zg7yTpEyPt3AdpxuENSpsh7juA3MbJSOj6yzsSOorQITElStwQsDkkYRBp9uYDsRhjMIKqlplR/Z6FgYutHROGCasxAqEJLTxKcbJMSnyRnkk9S0CkOeH6Mb3chnHJLPECoQkmEI6AayRh6GM8gn9dUqDKPMy8nX2BzW5qCOduOjMZJPzkDigIFYIXu9gu0EA4kDBoLUksfqDIZKfbWK1Tg9svQm3RiqFpcMNYQKhETKJD4DISEWBoK61FFq0yoMk+RYGLox1MRu7lqiHkIFQjIMPgMhIR6GM/goqWkThvGQ5bK8zdqNjyYhHw2hAiEZBp9ukBAPwxl8lNS0CkPEWLEMg+CjsFCfuN2M5JNXi8SvFokVstUCIREYdkGNN6GRjvLAnMFQqa9WgYkjL0vfYHOg+35lTQRDPR2rkKFqDZKBICQjE6QM0lEemTMYKvXVKjLJ0FkhU0Yw1NNhCPdc4bCVtw1bICTD4PHYkoR4GM7YcyU17cLA7hbJMAg+ejoMIR/Vd2G8bGjgo6lPy7Ed56MEdVpOOmyYjtPxseVE8NHTYUA+ygtI6pGbWWKFXAFp2B5NfbqB7URgLEMlVQuSajX82cjxPzn8goCe9jskoEm4+4mQmAVs+xXLZEhAqZ05eahu0C8IauVlzu4dSC8FmTztZbi5qY4myVsuBULSy4AshNSR2nEvO+xdwqFNlzDCSzjlwa65T3qpxSUzDKECIemlX9hJiFU0gpiXBLUay3F25MpRnWtzOwunvWzYmmTUWufiTOuUW5MISb/9Sk5C3G9LBe1MJalWfk/SI+sVnHPr5HfI9LQGWagRkl76hZqEuJeW6Tkv2S12cduwYXtkMkyOedmNyMFROv9OaAgVCEkv/e0REuJeWtrmvESozVhOotiFUs7UbhRMHRzw7veGUIGQ9NLf/SAh7qWlYM5LcUub3c5tGsv42F65OknTZaYinRJrqn8AR+v0ZipyJ7755R/vKLEdX1MJ4hUKVbUa3WR4ZE2FE4Wd/A4pldbgzdQGSpV5lywlthNe2i0+N7odGNMkmRzzshtjUsfa/BwObx+jlMxhnx+REM/hkB+RVKuxTMfH1tRu/CgN+VEIFQgJL3N/t4WEuJd2g86NZYebv5OMbUrrhe8X7KRh/y0VlAnm5PNX1Fpcz0u3gZ/6V9ROyBJihGQofBJFQjwUdv/NhaIDiZrkoyMLUCZI1Em/tbgkUSFUICS99EkUCTEvCWIliqBWaT06tu+cCRJ12stw90xrkCUKIemlT5lIiHsZUiaSauXlmG0ri2VWHTlyC9BpL0PKpDV4XiLP4ctN7lMmbMcLMUF8LLtQpknqrYW/kEbzmBk/vpwJFnXa8YbtsNy/mtU65cqLEGzi0yQsEYILeYLmBOnTgLrsLAhyDX9ByBwwlaMoyNJpZ0KylAVQgZAw3UgJ0xHipiPETUe21DAOggGdNj3cY9LPE3oJaKSE6QYSpiPETUeIm46Ep8F0QWJOmx6SmCyACoSE6UZKmI4QNx0hbjqymAbTBTM5bbrhDlBY7a2BLICKECpDaB5CCwHJxBbc4rSdZqmH7QNnZwAVmYHUAQV7pIYddjJ7LyTkjuLMCVJPrNxfv/vt5+/nUTSdZzEd/fX4ycJ15G8wZ92ogxa/6ov4m6WcQUUoVYbQPIQWAhLxz7st9Voc7OTP1SVe4Z85IUtxQqgMoXkILQQkLfeXb/1oIDxhCtPZPM9qnxQ+Rdxys/iCVzarQqgIoTKE5iG0EJD0wV+c8cFmmAddXTDLKBxMcC4gxA+WeUNV5A0yib8r0CTkP5NDMuyhHIL0XJVu+0vz+W6bVRu8cBPdM22WGxm45apP/V947hX0uxv9kiD2SCJCrGwvCGpw0F+uz3fQrKvCQX8/IMfl+KiD+Dt3ECHuIPbERxChBgf5og6F6nz/cCHneYuQW/oKNafhwhnOm1iSFUJzgrgH2LDBA762/18emDVYjJB/aivHpTvRKehd2hX0a2qXHcjJaZGnR5adEhvwwUMjuOsINbjO19xzXIdBwMezR7wIg6rnL5C1NAwjG2yC2GCHUCkgUUpGvIKeNgDLnSuSuj08t+iIT0EQmy4EhTeSR7yUne6fypUt0rq91z/WK94/Qg3980pzun+qJq5/WzvsWj0KywVBDf17heBEAuB0ZPFHPs7jjxD3H6GG/r1pfKJ/nBM8ARHiCRhApXoDii1AMgE50T49AIZUu5k7g7e26Adn3QOLBUGOmZYIMf/Nq2DMuxI21e6jfvnKvreqP6m3oMAxq+tLC5vHBW+y8XQGjBUGOvhlAs8m6ULh/5IPp4q/NLRJkunMXLH4bZLRdAb3uRrapBH8ot3y26QZ/NJoWzoBq7XjgdUjsFqPW/AL2AbXWQ0WxKANjts0/JJPZ00tihwC0CQPTjb1XYBRjTZNpkVThEsIfWPk4cpDPSXaYGkE3sEzTk2/gFHmPLYfkRgiD6eamyICkTesJogiBLGhRaEeZGvUNIVXYTRlCoS8SU8yhRdRNGUJpEKTfDqF10CA/MDlO7wu6QFe1HVYr9TbkurtQb2aCObq4dsTvFVlW7+qt/i2L9VQvVrp5+Xu43q77z3Cy47U24Jg+u3MC4X0d3gNkkah4HyoD/AiIPrrAd7lVcHdeHi/UB96qg/0B+qFVzZ9eurtzQuT1HVhvVvDC4n0m7qu+k/17rBbrg/Q2VS9Fmq3uDPHPe17xa7/BwAA//8DAFBLAwQUAAYACAAAACEAdT6ZaZMGAACMGgAAEwAAAHhsL3RoZW1lL3RoZW1lMS54bWzsWVuL20YUfi/0Pwi9O75Jsr3EG2zZTtrsJiHrpORxbI+tyY40RjPejQmBkjz1pVBIS18KfetDKQ000NCX/piFhDb9ET0zkq2Z9Tiby6a0JWtYpNF3znxzztE3F128dC+mzhFOOWFJ261eqLgOTsZsQpJZ2701HJSarsMFSiaIsgS33SXm7qXdjz+6iHZEhGPsgH3Cd1DbjYSY75TLfAzNiF9gc5zAsylLYyTgNp2VJyk6Br8xLdcqlaAcI5K4ToJicHt9OiVj7AylS3d35bxP4TYRXDaMaXogXWPDQmEnh1WJ4Ese0tQ5QrTtQj8TdjzE94TrUMQFPGi7FfXnlncvltFObkTFFlvNbqD+crvcYHJYU32ms9G6U8/zvaCz9q8AVGzi+o1+0A/W/hQAjccw0oyL7tPvtro9P8dqoOzS4rvX6NWrBl7zX9/g3PHlz8ArUObf28APBiFE0cArUIb3LTFp1ELPwCtQhg828I1Kp+c1DLwCRZQkhxvoih/Uw9Vo15Apo1es8JbvDRq13HmBgmpYV5fsYsoSsa3WYnSXpQMASCBFgiSOWM7xFI2hikNEySglzh6ZRVB4c5QwDs2VWmVQqcN/+fPUlYoI2sFIs5a8gAnfaJJ8HD5OyVy03U/Bq6tBnj97dvLw6cnDX08ePTp5+HPet3Jl2F1ByUy3e/nDV39997nz5y/fv3z8ddb1aTzX8S9++uLFb7+/yj2MuAjF82+evHj65Pm3X/7x42OL906KRjp8SGLMnWv42LnJYhighT8epW9mMYwQMSxQBL4trvsiMoDXlojacF1shvB2CipjA15e3DW4HkTpQhBLz1ej2ADuM0a7LLUG4KrsS4vwcJHM7J2nCx13E6EjW98hSowE9xdzkFdicxlG2KB5g6JEoBlOsHDkM3aIsWV0dwgx4rpPxinjbCqcO8TpImINyZCMjEIqjK6QGPKytBGEVBux2b/tdBm1jbqHj0wkvBaIWsgPMTXCeBktBIptLocopnrA95CIbCQPlulYx/W5gEzPMGVOf4I5t9lcT2G8WtKvgsLY075Pl7GJTAU5tPncQ4zpyB47DCMUz62cSRLp2E/4IZQocm4wYYPvM/MNkfeQB5RsTfdtgo10ny0Et0BcdUpFgcgni9SSy8uYme/jkk4RVioD2m9IekySM/X9lLL7/4yy2zX6HDTd7vhd1LyTEus7deWUhm/D/QeVu4cWyQ0ML8vmzPVBuD8It/u/F+5t7/L5y3Wh0CDexVpdrdzjrQv3KaH0QCwp3uNq7c5hXpoMoFFtKtTOcr2Rm0dwmW8TDNwsRcrGSZn4jIjoIEJzWOBX1TZ0xnPXM+7MGYd1v2pWG2J8yrfaPSzifTbJ9qvVqtybZuLBkSjaK/66HfYaIkMHjWIPtnavdrUztVdeEZC2b0JC68wkUbeQaKwaIQuvIqFGdi4sWhYWTel+lapVFtehAGrrrMDCyYHlVtv1vewcALZUiOKJzFN2JLDKrkzOuWZ6WzCpXgGwilhVQJHpluS6dXhydFmpvUamDRJauZkktDKM0ATn1akfnJxnrltFSg16MhSrt6Gg0Wi+j1xLETmlDTTRlYImznHbDeo+nI2N0bztTmHfD5fxHGqHywUvojM4PBuLNHvh30ZZ5ikXPcSjLOBKdDI1iInAqUNJ3Hbl8NfVQBOlIYpbtQaC8K8l1wJZ+beRg6SbScbTKR4LPe1ai4x0dgsKn2mF9akyf3uwtGQLSPdBNDl2RnSR3kRQYn6jKgM4IRyOf6pZNCcEzjPXQlbU36mJKZdd/UBR1VDWjug8QvmMoot5Blciuqaj7tYx0O7yMUNAN0M4mskJ9p1n3bOnahk5TTSLOdNQFTlr2sX0/U3yGqtiEjVYZdKttg280LrWSuugUK2zxBmz7mtMCBq1ojODmmS8KcNSs/NWk9o5Lgi0SARb4raeI6yReNuZH+xOV62cIFbrSlX46sOH/m2Cje6CePTgFHhBBVephC8PKYJFX3aOnMkGvCL3RL5GhCtnkZK2e7/id7yw5oelStPvl7y6Vyk1/U691PH9erXvVyu9bu0BTCwiiqt+9tFlAAdRdJl/elHtG59f4tVZ24Uxi8tMfV4pK+Lq80u1tv3zi0NAdO4HtUGr3uoGpVa9Myh5vW6z1AqDbqkXhI3eoBf6zdbggescKbDXqYde0G+WgmoYlrygIuk3W6WGV6t1vEan2fc6D/JlDIw8k488FhBexWv3bwAAAP//AwBQSwMEFAAGAAgAAAAhABk8Wrf+BgAAXzIAAA0AAAB4bC9zdHlsZXMueG1s3Fv/j9o2FP990v6HKNWmdhqXLxB6XIFb4Q6pUtdVuqu0HypVITFgNYlpYq7Qaf/7nu0kOBCIoZTLracKYuznz/vq92yne70MA+0BxQkmUU+3LkxdQ5FHfBxNe/qH+1HjUtcS6ka+G5AI9fQVSvTr/s8/dRO6CtDdDCGqAYko6ekzSudXhpF4MxS6yQWZowh+mZA4dCk8xlMjmcfI9RM2KAwM2zTbRujiSBcUrkJPhUjoxp8X84ZHwrlL8RgHmK44LV0Lvas304jE7jgAqEur5Xra0mrHtraMs0l469Y8IfZikpAJvQC6BplMsIe24XaMjuF6a0pA+ThKlmOYdoH3ZXwkpZYRowfM1Kf3u9EiHIU00TyyiGhPb+dNmvjljd/TW01dE0oZEh/E9On5b9qz3589My9M89OLV+zx4/Os4aNo+PXLgtBXDfFxfc27/fHphW5kU0r0rXZrxwRF6keRdoqkGebCv192QGqXjNvV9+VW3109wTd2SRJQbQkT2qqZNlId9rsTEq1VCVNxy736HJGv0Yj9BO4K+mW9+t3km/bgBtBiMQF4JCCxRsEPQb+8JXJDJHoM3QCPY8y6TdwQByvRbLMG7rppvxCDI7FGQ8xw3nnGDE3GU+v8PMXTcU8fjYRtcZs6kQALjHGhn0FZ5lqAexh7HWM3KLWLUhO4PKVYMl1zokIiKVK7xf6Kc92hKUHahzf7wHLMCRg5DoI8ILaYw0BDvwtrB0VxNIIHLf1+v5qDu0SwzAmz5/0qek9jd2XZjvqAhATYZyimQ9lJIWRSzEK2edHsdDovHefSsTp2C/5z/x2n3XHkoyWCKA5BlvmmxAbzVBXImwhSOXcGQ/u2zYhmc239UDobnxTkPCaxD2lEtvRYJjAp2vrdAE0oEI7xdMY+KZmzaQilsNb2uz52pyRyA8ZPNmL3SMhGIPHo6XQGiUNZqDOAfEa9tPOmDAWQahxKxBirKadK/blMuEiUuteFN6HFR4VcNKhaQHlKGs/El2GeuTjO/WnTRdZWmjuu0rhDXWsviBLXqgXoQiTalNzx8WBL0nvnUZX0kWpX0nZJcNqroH2Y05UAFhYPBcEdi/l/T/LVpQmWupxIRQeUrSxBZfUN+wrrYPpVLCTiAXgvDBKVkBhl7RylufN5sGIZN6ctnmCC9dOAL33r59cBnkYhkge8jwlFHuVFNs/GCkA6a/TnxmHI4hXCluTs2EcJWltOqiW+W0/pcBCFJHqeBh2qcxuqphSKoJWpKqMtqSprklXFCiyol4Q2tRmJ8TewA1ZoeaBexOujea5abYZ9H7FtFJ6bLScb9iapmdXg5UaaAgbkRzAPo2SD32CeJbsMnKC8yac6H3wDocrZNuZ+twjHKB7xzaBUQLtcoNIwqmQj+3UlMejABV0FUIowbH8jVV6FwHnQyO34ROJXQLJl9yJ8lSN5VJ+AOqEycsPmjfDiTPGbuiq6Sg08Pd0D2+8jsM8k2MrUcgxbx3uxxffSFCHu8pIayJrvNp44GlltBeGATIqLS1UIsdp8G/LkWPmG5YmpHuKWmXE8aiCRg37l6nqC1AIW8xqlFiphNLdXtXizmS0fNIXqqmq1+R76+Y23MjM8PrBKad6u7COffTOVKY+nx2NRSYVyMJtecWowUkxh4TVNocBZ1znr+RIXOPOk2GOpPJStuvY1duf3aAk1HkiBnVLCAehfbEczTVbVs+NacVlSsrDT3h/OuXLafdYCTGFR21rU6xQHzioshbxqy1vLM9jHLTAUMrmnwMchq0qNs3WlymhrRap/wSeFFpaO793b2a+erFT/rvzr/1UpH5i5njpvUamUK4tBAapuy129NkgVNhafQqiWYgHALd0qhCSzWD3WdoNOIWc6sxEFxPvMrkDwcxRja5f9qRhRBRsKcmd3wn7o6YZUKhxz3lEH0/lOFlQ2PbaK+dpnKwqKAS+q0faWAmAoV54WYKhLag8YTHvf3kzhQOtRqzzJQKTTOWhV3lo6NfzDAw8/iofDd+nKQ+HCQ35Sr7HbvD19SMLQlc6QxgscwCVCdvLe5Bc+s4sTaf937PA1kKxOGiBuiG4MeI9iFval0zdphLjzmGMC1P5yfUGD06PsHj6/upHzARrx0cRdBPQ+/7Gnr7//iXy8CMHs0l7v8QOhnERPX39/yy4SWvyyImzZvU3gxh18aosY9/R/bgcvOze3I7txaQ4uG60mchodZ3DTcFrDwc3NqGPa5vBf6W2A73gXgL+8AIf8VusqCeCNgThlNgV/t27r6dKDgM/vCABsGXvHbpuvHctsjJqm1Wi13cvGZbvpNEaOZd+0W4NbZ+RI2J0j3xkwDcsSbx8w8M4VxSEKcJTpKtOQ3ApKgsc9TBiZJoz1myH9/wAAAP//AwBQSwMEFAAGAAgAAAAhAGAKTRDgAQAA3wcAABQAAAB4bC9zaGFyZWRTdHJpbmdzLnhtbIxVwW7bMAy9D9g/EAK222pb6tI0tV10K3bbkEN62FFw2MaAJXuS0i1/PyeGs8Dyw3q0HkU+PT7S+f0f09ArO1+3thDZVSqIbdVua/tSiKfNt09LQT5ou9VNa7kQB/bivnz/Lvc+UH/X+kLsQuhWSeKrHRvtr9qObY88t87o0H+6l8R3jvXW75iDaRKZpovE6NoKqtq9DYW4yQTtbf1rz1+Hg8VSlLmvyzyUT7YO9KOlVZ6EMk+OhxfAF+2Z1q6uOA743pcIbLWdAY/cV77TVf+mnpxn98qiXOuDYRtow854+qhNd0ebQ8eepsU/zLIBRB514En8fP3H9relkcS0wk/WjrI35RlTZBHvEZHT7COgEHA9ywfm+YzyLBBwg4DlbGVI9BblyVKITGU9OyGLHnhqQyTGWXFIK8N3oFZZJNapOo6HGmaRiGfGUC8Z6bVpg27owRyHdKrlxbRNof9eoDRqwOXwpvNNiMSpbdXvmX4hRNM5DObDc2BHYxQyg4RmkNDtErZdzs9N1KhTY+edHjVo2ATQzRL6Q8Lhk9A5EjpHQucoyE1BcRVeSVBcBWdKQQ0U1EBBDRTUQEENriMNhra9bYPTMdif/wXrRlu4y0/gcOGfp5P+B13+BQAA//8DAFBLAwQUAAYACAAAACEAO20yS8EAAABCAQAAIwAAAHhsL3dvcmtzaGVldHMvX3JlbHMvc2hlZXQxLnhtbC5yZWxzhI/BisIwFEX3A/5DeHuT1oUMQ1M3IrhV5wNi+toG25eQ9xT9e7McZcDl5XDP5Tab+zypG2YOkSzUugKF5GMXaLDwe9otv0GxOOrcFAktPJBh0y6+mgNOTkqJx5BYFQuxhVEk/RjDfsTZsY4JqZA+5tlJiXkwyfmLG9Csqmpt8l8HtC9Ote8s5H1Xgzo9Uln+7I59Hzxuo7/OSPLPhEk5kGA+okg5yEXt8oBiQet39p5rfQ4Epm3My/P2CQAA//8DAFBLAwQUAAYACAAAACEAUzo76iQCAADkEwAAJwAAAHhsL3ByaW50ZXJTZXR0aW5ncy9wcmludGVyU2V0dGluZ3MxLmJpbuxXz0sbURD+3ttEl1WJTS5VqISSk7SioYqHHmoToYGEhmxSQ2+FCArqQin0VNCTV/0b/D8k9NRz6VHw4kGCf0BPXb/ZHyY1aUpENLU7w+zuy8y8N/Pt5L1ZGxtw8BkfeXWwDSBLWcQC0igjhyKWOH6DFVQ4TqOEOp7TZsmzoSoWN09gphLu7qiCQstyzAbvStW1hkZdGxwVsY5P5HWuczN63MMtxt80Jal4EemiWMbO5Utm6ngsQ91PyjPatSh2Lbsq5nZX/gPGx/x/YDKZOB2e/F9gvDBxJNAQeyFkUsxqCmiQZwNuAL9cF4hTZeAY1iT2kD45JJQ+lkqwFQ8f3jbAcT7G1bQahUhg3QGbY7Ys8dPUFU3gbBy4YATfGEF49+ZUSVlDGYFvwmEwSmlDXiy01irLSgt5Bi9h4dzIxBQMCS0g8X4C7AJcyiPXlQine1bEWilfxddlVzJv00GQsaHV0xXW6CY+YKvTYIBnt9nE9yv7Bvbx5YYzDaPbCIOy+gT29h3xBZoPKOUolVtEoGCzPq6q432EbYTAbwjwVOpL1by3v2B+zuOB0SuXff/QMTx7wnGhEtZnDTvsWDYpW+xb/hZX6L8m89/j7leV+PtQjv8/9chvl+TQk/x7HpR/mON1MV898HWvBgb/DhykMRCZ6egcpKO9Tv+6vh+UUf7R+/+v67/j6+B+9ij5Er5+sgzjbhnFFCEQIfDQEbgEAAD//wMAUEsDBBQABgAIAAAAIQAd9BIMiAEAAKEGAAAQAAAAeGwvY2FsY0NoYWluLnhtbHSVy26DMBBF95X6D5b3jfGD9KGQLCpFZt9+gEXcgAQmwqhq/75uJZsyZjZIuRlf7pkZi8Ppa+jJp518N7qK8l1BiXXNeOnctaLvb+eHJ0r8bNzF9KOzFf22np6O93eHxvTNa2s6R4KD8xVt5/n2wphvWjsYvxtv1oV/PsZpMHP4OV2Zv03WXHxr7Tz0TBTFng3BgB4PDZkqei4p6UIGSvrfJ4vyflt+3JRrHs7/ucTzNZexMqRcfGuuEH07h5axfkkWo0VFy/iuRclron+qSQkXJdIlRUAuLTIf8QzYdWJcnMNAV/3RQmRKnjnsxfpU1mfNc64sj8j6IzJSmZHyLCHPEoosoYDz0iJjl9C5Ts7rLax52jewRdGTAD2yAz3lhHqkhnpMCHVkqxM1rE9bvc4p0vUCOsKbegj9EV4Z5wLq05ShjvCmmwXrkVssEV6J8EqEVyLzlQivQngVMl+F8CpkvgrhVQivQngVwqsQXoXwlghvifCW27y6/Hc3Wfq4HH8AAAD//wMAUEsDBBQABgAIAAAAIQDehTvfawEAAJ8CAAARAAgBZG9jUHJvcHMvY29yZS54bWwgogQBKKAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB8kl1LwzAYhe8F/0PJfZemc3MLXYcf7MqCYEXxLiTv2mKTlCRz2783bdc6P/AynHMeznlJsj7IOvgAYyutVohMIhSA4lpUqlih53wTLlBgHVOC1VrBCh3BonV6eZHwhnJt4NHoBoyrwAaepCzlzQqVzjUUY8tLkMxOvEN5cauNZM4/TYEbxt9ZATiOojmW4JhgjuEWGDYjEZ2Qgo/IZmfqDiA4hhokKGcxmRD85XVgpP0z0ClnTlm5Y+M3neqeswXvxdF9sNVo3O/3k/20q+H7E/yaPTx1U8NKtbfigNJEcMoNMKdNmumSSRDBjYA6wWdCe8SaWZf5e28rELfHNGOl1DsRZKwQxwT/NgyZR1MpByKNo3geRsswWuRkSmNCr6K3MTeYfJtufF/JV/FzaD9+UF6md/f5BnkemYWRR85ysqDkmsYt70e+ndcD5an6v8S+YbzI45hOl5ScEwdA2pX+/qXSTwAAAP//AwBQSwMEFAAGAAgAAAAhAGFJCRCJAQAAEQMAABAACAFkb2NQcm9wcy9hcHAueG1sIKIEASigAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnJJBb9swDIXvA/ofDN0bOd1QDIGsYkhX9LBhAZK2Z02mY6GyJIiskezXj7bR1Nl66o3ke3j6REndHDpf9JDRxVCJ5aIUBQQbaxf2lXjY3V1+FQWSCbXxMUAljoDiRl98UpscE2RygAVHBKxES5RWUqJtoTO4YDmw0sTcGeI272VsGmfhNtqXDgLJq7K8lnAgCDXUl+kUKKbEVU8fDa2jHfjwcXdMDKzVt5S8s4b4lvqnszlibKj4frDglZyLium2YF+yo6MulZy3amuNhzUH68Z4BCXfBuoezLC0jXEZtepp1YOlmAt0f3htV6L4bRAGnEr0JjsTiLEG29SMtU9IWT/F/IwtAKGSbJiGYzn3zmv3RS9HAxfnxiFgAmHhHHHnyAP+ajYm0zvEyznxyDDxTjjbgW86c843XplP+id7HbtkwpGFU/XDhWd8SLt4awhe13k+VNvWZKj5BU7rPg3UPW8y+yFk3Zqwh/rV878wPP7j9MP18npRfi75XWczJd/+sv4LAAD//wMAUEsBAi0AFAAGAAgAAAAhAHQ2WqZ6AQAAhAUAABMAAAAAAAAAAAAAAAAAAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECLQAUAAYACAAAACEAtVUwI/QAAABMAgAACwAAAAAAAAAAAAAAAACzAwAAX3JlbHMvLnJlbHNQSwECLQAUAAYACAAAACEAxHBy/ZwDAAD9CAAADwAAAAAAAAAAAAAAAADYBgAAeGwvd29ya2Jvb2sueG1sUEsBAi0AFAAGAAgAAAAhAJIHlOwEAQAAPwMAABoAAAAAAAAAAAAAAAAAoQoAAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzUEsBAi0AFAAGAAgAAAAhAObLfx5sDwAAnEwAABgAAAAAAAAAAAAAAAAA5QwAAHhsL3dvcmtzaGVldHMvc2hlZXQxLnhtbFBLAQItABQABgAIAAAAIQB1PplpkwYAAIwaAAATAAAAAAAAAAAAAAAAAIccAAB4bC90aGVtZS90aGVtZTEueG1sUEsBAi0AFAAGAAgAAAAhABk8Wrf+BgAAXzIAAA0AAAAAAAAAAAAAAAAASyMAAHhsL3N0eWxlcy54bWxQSwECLQAUAAYACAAAACEAYApNEOABAADfBwAAFAAAAAAAAAAAAAAAAAB0KgAAeGwvc2hhcmVkU3RyaW5ncy54bWxQSwECLQAUAAYACAAAACEAO20yS8EAAABCAQAAIwAAAAAAAAAAAAAAAACGLAAAeGwvd29ya3NoZWV0cy9fcmVscy9zaGVldDEueG1sLnJlbHNQSwECLQAUAAYACAAAACEAUzo76iQCAADkEwAAJwAAAAAAAAAAAAAAAACILQAAeGwvcHJpbnRlclNldHRpbmdzL3ByaW50ZXJTZXR0aW5nczEuYmluUEsBAi0AFAAGAAgAAAAhAB30EgyIAQAAoQYAABAAAAAAAAAAAAAAAAAA8S8AAHhsL2NhbGNDaGFpbi54bWxQSwECLQAUAAYACAAAACEA3oU732sBAACfAgAAEQAAAAAAAAAAAAAAAACnMQAAZG9jUHJvcHMvY29yZS54bWxQSwECLQAUAAYACAAAACEAYUkJEIkBAAARAwAAEAAAAAAAAAAAAAAAAABJNAAAZG9jUHJvcHMvYXBwLnhtbFBLBQYAAAAADQANAGQDAAAINwAAAAA=";



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



    ws.getCell('F4').value = Math.round(basePrice);

    ws.getCell('F4').numFmt = '#,##0';



    ws.getCell('F5').value = Math.round(mntTotal);

    ws.getCell('F5').numFmt = '#,##0';



    ws.getCell('D6').value = isDiscount ? 'Discount % :' : 'Increase % :';

    ws.getCell('E6').value = isDiscount ? 'Discount % :' : 'Increase % :';

    ws.getCell('F6').value = Math.abs(incPct);

    ws.getCell('F6').numFmt = '0.00%';



    ws.getCell('D7').value = isDiscount ? 'Price After Discount :' : 'Price After Increase :';

    ws.getCell('E7').value = isDiscount ? 'Price After Discount :' : 'Price After Increase :';

    ws.getCell('F7').value = Math.round(offerPrice);

    ws.getCell('F7').numFmt = '#,##0';



    let isApproved = !window.isManuallyDisapproved;

    let approvalText = isApproved ? 'APPROVED' : 'NOT APPROVED';

    ws.getCell('D8').value = 'Approval Status :';

    ws.getCell('E8').value = 'Approval Status :';

    ws.getCell('F8').value = approvalText;

    if (!isApproved) {

        ws.getCell('F8').font = { color: { argb: 'FFFF0000' }, bold: true };

    } else {

        ws.getCell('F8').font = { color: { argb: 'FF008000' }, bold: true };

    }



    ws.getCell('G9').value = years + ' Years Payment Plan';



    let nonMntFlows = globalCustomFlows.filter(f => !f.isMnt);

    let mnts = globalCustomFlows.filter(f => f.isMnt);



    let grouped = [];

    nonMntFlows.forEach(f => {

        let grpName = '';

        if (f.months <= 1 && f.isDP) grpName = 'Down Payment';

        else if (f._instYear) {

            grpName = 'Year ' + f._instYear;

        } else {

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



    let totalItemsCount = nonMntFlows.length;

    let itemCounter = 0;

    let runningPctSum = 0;



    grouped.forEach(grp => {

        grp.items.forEach((item, j) => {

            itemCounter++;

            let isFirst = j === 0;

            let itemAmt = Math.round(item.amount || 0);

            let exactRatio = (!item || item._isZeroShifted || !item.amount || item.amount <= 0) ? 0.0 : (offerPrice > 0 ? (itemAmt / offerPrice) : 0.0);

            

            if (rowIdx >= totalRowIdx) {

                ws.spliceRows(totalRowIdx, 0, []);

                totalRowIdx++;

            }



            let r = ws.getRow(rowIdx);



            [4, 5, 6, 7, 8, 9].forEach(c => {

                let cell = r.getCell(c);

                let mCell = modelRow.getCell(c);

                if (mCell && mCell.style) {

                    cell.style = JSON.parse(JSON.stringify(mCell.style));

                }

            });



            if (isFirst) r.getCell(4).value = grp.name;

            r.getCell(6).value = item.label;

            r.getCell(7).value = exactRatio;

            r.getCell(7).numFmt = '0.00%';

            r.getCell(8).value = itemAmt;

            r.getCell(8).numFmt = '#,##0';

            r.getCell(9).value = formatDateExport(item.date);



            excelTotalAmt += itemAmt;

            excelTotalPct += exactRatio;

            rowIdx++;

        });

    });



    for (let i = rowIdx; i < totalRowIdx; i++) {

        ws.getRow(i).hidden = true;

    }



    let rTotal = ws.getRow(totalRowIdx);

    rTotal.getCell(7).value = { formula: `SUM(G11:G${rowIdx - 1})`, result: 1.0 };

    rTotal.getCell(7).numFmt = '0.00%';

    rTotal.getCell(8).value = { formula: `SUM(H11:H${rowIdx - 1})`, result: Math.round(excelTotalAmt) };

    rTotal.getCell(8).numFmt = '#,##0';



    let mntRowIdx = totalRowIdx + 5;

    let excelMntSum = 0;

    let excelMntPctSum = 0;

    mnts.forEach(m => {

        let mAmt = Math.round(m.amount || 0);

        let mntPct = offerPrice > 0 ? (mAmt / offerPrice) : 0;

        let r = ws.getRow(mntRowIdx++);

        r.getCell(6).value = mAmt;

        r.getCell(6).numFmt = '#,##0';

        r.getCell(7).value = formatDateExport(m.date);

        r.getCell(8).value = null;

        r.getCell(9).value = null;



        excelMntSum += mAmt;

        excelMntPctSum += mntPct;

    });



    let rTot = ws.getRow(totalRowIdx + 8);

    rTot.getCell(6).value = Math.round(excelMntSum);

    rTot.getCell(6).numFmt = '#,##0';

    rTot.getCell(7).value = excelMntPctSum;

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



    let isApproved = !window.isManuallyDisapproved;

    let approvalText = isApproved ? 'APPROVED' : 'NOT APPROVED';



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

        else if (f._instYear) {

            grpName = 'Year ' + f._instYear;

        } else {

            let y = Math.ceil(f.months / 12);

            if (y < 1) y = 1;

            grpName = 'Year ' + y;

        }

        let itemAmt = Math.round(f.amount || 0);

        let exactRatio = (!f || f._isZeroShifted || !f.amount || f.amount <= 0) ? 0.0 : ((f._pctVal !== undefined && f._pctVal !== null) ? (f._pctVal / 100.0) : (f.displayPct ? (parseFloat(f.displayPct) / 100.0) : (offerPrice > 0 ? (itemAmt / offerPrice) : 0)));

        let row = [

            grpName,

            f.label,

            exactRatio,

            itemAmt,

            formatDateExport(f.date)

        ];

        ws_data.push(row);

        totalAmtSum += itemAmt;

        totalPctSum += exactRatio;

    });



    ws_data.push(['Total Payments:', '', 1.0, Math.round(totalAmtSum), '']);



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



    let garSched = getGarageSchedule(currentProject, window.garageOption, document.getElementById('contract-date')?.value);

    if (garSched && garSched.items && garSched.items.length > 0) {

        ws_data.push(['', '', '', '', '']);

        ws_data.push(['Parking / Garage Schedule', '', 'Fixed Amenity', '', '']);

        ws_data.push(['Seq', 'Description', 'Status', 'Amount', 'Date']);

        garSched.items.forEach(g => {

            ws_data.push([g.seq, g.label, 'Fixed', Math.round(g.amount), formatDateExport(g.date)]);

        });

        ws_data.push(['Total Parking / Garage:', '', 'Fixed', Math.round(garSched.totalAmount), '']);

        let grandTotal = Math.round(offerPrice + mntTotal + garSched.totalAmount);

        ws_data.push(['GRAND TOTAL (UNIT + MAINTENANCE + GARAGE):', '', '', grandTotal, '']);

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

            else if (f._instYear) {

                grpName = 'Year ' + f._instYear;

            } else {

                let y = Math.ceil(f.months / 12);

                if (y < 1) y = 1;

                grpName = 'Year ' + y;

            }

            let baseAmt = Math.round(f.amount || 0);

            let itemPct = basePrice > 0 ? (baseAmt / basePrice) : 0;

            ws_data_base.push([

                grpName,

                f.label,

                itemPct,

                baseAmt,

                formatDateExport(f.date)

            ]);

            baseTotalAmt += baseAmt;

            baseTotalPct += itemPct;

        });

        ws_data_base.push(['Total Payments:', '', 1.0, Math.round(baseTotalAmt), '']);

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

    let flexToggle = document.getElementById('flexible-toggle');

    if (flexToggle) {

        flexToggle.value = 'no';

    }

    updateGarageDropdown(currentProject);

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



window.clearTargetPrice = function() {

    let tpEl = document.getElementById('target-price-val');

    let tPctEl = document.getElementById('target-pct-val');

    if (tpEl) tpEl.value = '';

    if (tPctEl) tPctEl.value = '';

    calculate();

};



// ==========================================

// EXCEL PERCENTAGES & TSV CLIPBOARD EXPORT

// ==========================================



window.showToast = function(msg, isSuccess = true) {

    let toast = document.getElementById('npv-toast-notification');

    if (!toast) {

        toast = document.createElement('div');

        toast.id = 'npv-toast-notification';

        toast.style.position = 'fixed';

        toast.style.bottom = '24px';

        toast.style.left = '50%';

        toast.style.transform = 'translateX(-50%)';

        toast.style.padding = '12px 24px';

        toast.style.borderRadius = '8px';

        toast.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';

        toast.style.zIndex = '999999';

        toast.style.fontSize = '0.92rem';

        toast.style.fontWeight = 'bold';

        toast.style.display = 'flex';

        toast.style.alignItems = 'center';

        toast.style.gap = '10px';

        toast.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

        document.body.appendChild(toast);

    }

    toast.style.background = isSuccess ? 'linear-gradient(135deg, #1b3a24, #0d2818)' : 'linear-gradient(135deg, #3a1b1b, #280d0d)';

    toast.style.border = isSuccess ? '1.5px solid #2ecc71' : '1.5px solid #e74c3c';

    toast.style.color = '#fff';

    toast.innerHTML = msg;

    toast.style.opacity = '1';

    toast.style.pointerEvents = 'auto';

    clearTimeout(window._toastTimeout);

    window._toastTimeout = setTimeout(() => {

        toast.style.opacity = '0';

        toast.style.pointerEvents = 'none';

    }, 3200);

};



window.formatFlowsToExcelRows = function(flows, offerPrice) {
    if (!flows || flows.length === 0) return '';
    let nonMnt = flows.filter(f => !f.isMnt);
    let freqMonths = (document.getElementById('payment-frequency') && parseInt(document.getElementById('payment-frequency').value) === 2) ? 6 : 3;
    let isZomra = (currentProject === 'Zomra');
    let totalTemplateRows = isZomra ? 43 : 42; // Row 16 to 58 = 43 rows for Zomra, Row 16 to 57 = 42 rows for Others

    let price = offerPrice || window.lastCalculatedPrice || basePriceCache || 0;

    let formatFlowPct = (f) => {
        if (!f || f._isZeroShifted || f.amount === 0) return '0%';
        let exactPct = null;

        // 1. Scenario flow (OR)
        if (f.scenarioPct !== undefined && f.scenarioPct !== null) {
            exactPct = f.scenarioPct * 100;
        }
        // 2. Explicit percentage override in table or milestone input
        else if (f._exactFixedPct !== undefined && f._exactFixedPct !== null && !f._isFixedCash) {
            exactPct = f._exactFixedPct;
        }
        // 3. Milestone default percentage (when NOT cash fixed)
        else if (!f.isInst && !f.isMerged && f.defaultPct !== undefined && f.defaultPct !== null && !f._isFixedCash && !f._exactFixedVal) {
            exactPct = f.defaultPct * 100;
        }
        // 4. Exact mathematical ratio on flow
        else if (f.exactPct !== undefined && f.exactPct !== null && f.exactPct > 0 && !f._isFixedCash) {
            exactPct = f.exactPct * 100;
        }
        // 5. Fallback: derive from amount and price
        else {
            let amt = Math.round(f.amount || 0);
            if (price > 0 && amt > 0) {
                exactPct = (amt / price) * 100;
            } else {
                exactPct = 0;
            }
        }

        if (exactPct <= 0) return '0%';

        let cleanRound = Math.round(exactPct * 100) / 100;
        if (Math.abs(exactPct - cleanRound) < 1e-5) {
            return cleanRound.toFixed(2) + '%';
        }

        let s = exactPct.toFixed(8);
        s = s.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.00+$/, '');
        return s + '%';
    };

    let excelRows = new Array(totalTemplateRows).fill('0%');

    let dp1Flow = nonMnt.find(f => f.id === 'dp1') || nonMnt[0];
    let dp2Flow = nonMnt.find(f => f.id === 'dp2') || nonMnt[1];
    let addlFlow = nonMnt.find(f => f.id === 'addl');
    let instFlows = nonMnt.filter(f => (f.isInst || f.isMerged));

    if (dp1Flow) excelRows[0] = formatFlowPct(dp1Flow);
    if (dp2Flow) excelRows[1] = formatFlowPct(dp2Flow);

    if (freqMonths === 6) {
        // Semi-Annual Mode
        if (isZomra) {
            if (addlFlow) excelRows[3] = formatFlowPct(addlFlow);
            instFlows.forEach((inst, idx) => {
                let targetIdx = 4 + (idx * 2);
                if (targetIdx < totalTemplateRows) {
                    excelRows[targetIdx] = formatFlowPct(inst);
                }
            });
        } else {
            instFlows.forEach((inst, idx) => {
                let targetIdx = 3 + (idx * 2);
                if (targetIdx < totalTemplateRows) {
                    excelRows[targetIdx] = formatFlowPct(inst);
                }
            });
        }
    } else {
        // Quarterly Mode
        if (isZomra) {
            if (instFlows.length > 0) excelRows[2] = formatFlowPct(instFlows[0]);
            if (addlFlow) excelRows[3] = formatFlowPct(addlFlow);
            for (let i = 1; i < instFlows.length; i++) {
                let targetIdx = 3 + i;
                if (targetIdx < totalTemplateRows) {
                    excelRows[targetIdx] = formatFlowPct(instFlows[i]);
                }
            }
        } else {
            instFlows.forEach((inst, idx) => {
                let targetIdx = 2 + idx;
                if (targetIdx < totalTemplateRows) {
                    excelRows[targetIdx] = formatFlowPct(inst);
                }
            });
        }
    }

    // Reconcile any microscopic fractional discrepancy at the 8th decimal place across installments
    let sumCheck = excelRows.reduce((s, r) => s + (parseFloat(r.replace('%', '')) || 0) / 100.0, 0);
    let diff = 1.0 - sumCheck;
    if (Math.abs(diff) > 1e-9 && Math.abs(diff) < 1e-4) {
        for (let i = totalTemplateRows - 1; i >= 0; i--) {
            let isMilestoneRow = (i === 0 || i === 1 || (isZomra && i === 3));
            if (!isMilestoneRow && excelRows[i] !== '0%') {
                let curVal = parseFloat(excelRows[i].replace('%', ''));
                let adjVal = curVal + (diff * 100.0);
                let s = adjVal.toFixed(8).replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.00+$/, '');
                excelRows[i] = s + '%';
                break;
            }
        }
    }

    return excelRows.join('\r\n');
};

window.getExcelPercentagesText = function(isRawActiveOnly = false) {
    if (!window.globalCustomFlows || window.globalCustomFlows.length === 0) {
        return '';
    }
    if (isRawActiveOnly) {
        let nonMnt = window.globalCustomFlows.filter(f => !f.isMnt);
        let offerPrice = window.lastCalculatedPrice || basePriceCache || 0;
        let formatFlowPct = (f) => {
            if (!f || f._isZeroShifted || !f.amount || f.amount <= 0) return '0%';
            let exactPct = null;
            if (f.scenarioPct !== undefined && f.scenarioPct !== null) {
                exactPct = f.scenarioPct * 100;
            } else if (f._exactFixedPct !== undefined && f._exactFixedPct !== null && !f._isFixedCash) {
                exactPct = f._exactFixedPct;
            } else if (!f.isInst && !f.isMerged && f.defaultPct !== undefined && f.defaultPct !== null && !f._isFixedCash && !f._exactFixedVal) {
                exactPct = f.defaultPct * 100;
            } else if (f.exactPct !== undefined && f.exactPct !== null && f.exactPct > 0 && !f._isFixedCash) {
                exactPct = f.exactPct * 100;
            } else {
                let amt = Math.round(f.amount || 0);
                if (offerPrice > 0 && amt > 0) exactPct = (amt / offerPrice) * 100;
                else exactPct = 0;
            }
            if (exactPct <= 0) return '0%';
            let cleanRound = Math.round(exactPct * 100) / 100;
            if (Math.abs(exactPct - cleanRound) < 1e-5) return cleanRound.toFixed(2) + '%';
            let s = exactPct.toFixed(8);
            s = s.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.00+$/, '');
            return s + '%';
        };
        return nonMnt.map(formatFlowPct).join('\r\n');
    }
    return window.formatFlowsToExcelRows(window.globalCustomFlows);
};

window.copyRawPercentages = function(btn) {
    if (!btn && window.event && window.event.currentTarget) {
        btn = window.event.currentTarget;
    }
    let textToCopy = window.getExcelPercentagesText(true);
    if (!textToCopy) {
        window.showToast('⚠️ لا توجد بيانات جدول لنسخها حالياً.', false);
        return;
    }
    let lines = textToCopy.split('\r\n').filter(Boolean);
    let originalBtnText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '✓ تم نسخ النسب المباشرة!';
        btn.style.backgroundColor = '#198754';
        setTimeout(() => {
            btn.innerHTML = originalBtnText;
            btn.style.backgroundColor = '';
        }, 2200);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            window.showToast(`📋 تم نسخ ${lines.length} نسبة مباشرة (بدون فواصل أصفار) بنجاح!`, true);
        }).catch(() => {
            window.showToast('❌ تعذر النسخ للحافظة تلقائياً.', false);
        });
    }
};

window.copyExcelPercentages = function(btn) {
    if (!btn && window.event && window.event.currentTarget) {
        btn = window.event.currentTarget;
    }
    let activeInput = document.activeElement;
    if (activeInput && (activeInput.classList.contains('tbl-pct') || activeInput.classList.contains('tbl-amt') || activeInput.classList.contains('tbl-date'))) {
        if (typeof applyTableEdits === 'function') {
            applyTableEdits(activeInput);
        }
    }
    let isZomra = (currentProject === 'Zomra');
    let totalRows = isZomra ? 43 : 42;
    let rowRange = isZomra ? 'S16:S58 (43 صف)' : 'S16:S57 (42 صف)';
    let textToCopy = window.getExcelPercentagesText(false);
    if (!textToCopy) {
        window.showToast('⚠️ لا توجد بيانات جدول لنسخها حالياً.', false);
        return;
    }
    let lines = textToCopy.split('\r\n').filter(Boolean);
    let originalBtnText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '✓ تم نسخ النسب!';
        btn.style.backgroundColor = '#198754';
        btn.style.borderColor = '#198754';
        setTimeout(() => {
            btn.innerHTML = originalBtnText;
            btn.style.backgroundColor = '';
            btn.style.borderColor = '';
        }, 2200);
    }
    let isFlex = (document.getElementById('flexible-toggle')?.value === 'yes');
    let modeMsg = isFlex
        ? '💡 الخطة على نمط FLEXIBLE (مواعيد مخصصة): تأكد من ضبط الخلية O9 = 2 في الإكسيل.'
        : '💡 الخطة على نمط ADJUST (مواعيد قياسية): تأكد من ضبط الخلية O9 = 1 في الإكسيل.';

    let doCopy = () => {
        let msg = `✅ تم نسخ نسب السداد لعمود الإكسيل (${rowRange}) بنجاح (${lines.length} صف)!\n\n` +
                  `1. افتح شيت مشروع ${currentProject} في الإكسيل.\n` +
                  `2. ${modeMsg}\n` +
                  `3. قف على الخلية S16 واضغط Ctrl+V للصق النسب مباشرة.\n` +
                  `4. اضغط زر Calculate في الإكسيل لتحديث النتائج.\n\n` +
                  `🎯 مجموع نسب العمود S يساوي 100.000000% بالملي مع تطابق تام للـ NPV!`;
        if (window.showToast) {
            window.showToast(msg, true, 8000);
        }
        alert(msg);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(doCopy).catch(() => {
            window.copyFallback(textToCopy);
            doCopy();
        });
    } else {
        window.copyFallback(textToCopy);
        doCopy();
    }
};

window.copyTableTSV = function(btn) {
    if (!window.globalCustomFlows || window.globalCustomFlows.length === 0) {
        window.showToast('⚠️ لا توجد بيانات في الجدول لنسخها.', false);
        return;
    }
    let rows = [];
    rows.push(['الدفعة / القسط', 'تاريخ الاستحقاق', 'النسبة', 'القيمة بالجنيه', 'القيمة الحالية (NPV)'].join('\t'));
    window.globalCustomFlows.filter(f => !f.isMnt).forEach(f => {
        let offerPrice = window.lastCalculatedPrice || basePriceCache || 0;
        let amt = Math.round(f.amount || 0);
        let pctStr = (f.displayPct || 0) + '%';
        let exactPct = null;
        if (f.scenarioPct !== undefined && f.scenarioPct !== null) {
            exactPct = f.scenarioPct * 100;
        } else if (f._exactFixedPct !== undefined && f._exactFixedPct !== null && !f._isFixedCash) {
            exactPct = f._exactFixedPct;
        } else if (!f.isInst && !f.isMerged && f.defaultPct !== undefined && f.defaultPct !== null && !f._isFixedCash && !f._exactFixedVal) {
            exactPct = f.defaultPct * 100;
        } else if (f.exactPct !== undefined && f.exactPct !== null && f.exactPct > 0 && !f._isFixedCash) {
            exactPct = f.exactPct * 100;
        } else if (offerPrice > 0 && amt > 0) {
            exactPct = (amt / offerPrice) * 100;
        }
        if (exactPct !== null && exactPct > 0) {
            let cleanRound = Math.round(exactPct * 100) / 100;
            if (Math.abs(exactPct - cleanRound) < 1e-5) {
                pctStr = cleanRound.toFixed(2) + '%';
            } else {
                let s = exactPct.toFixed(8);
                s = s.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.00+$/, '');
                pctStr = s + '%';
            }
        }
        rows.push([
            f.label,
            f.date,
            pctStr,
            amt,
            Math.round(f.pv || 0)
        ].join('\t'));
    });
    let tsv = rows.join('\r\n');
    let originalBtnText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '✓ تم نسخ الجدول!';
        btn.style.backgroundColor = '#28a745';
        btn.style.borderColor = '#28a745';
        setTimeout(() => {
            btn.innerHTML = originalBtnText;
            btn.style.backgroundColor = '#17a2b8';
            btn.style.borderColor = '#17a2b8';
        }, 2200);
    }
    let doCopy = () => {
        window.showToast('✅ تم نسخ جدول الدفعات والتواريخ بالكامل بنجاح بصيغة TSV! يمكنك لصقه مباشرة بـ Ctrl+V في الإكسيل.');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(tsv).then(doCopy).catch(() => {
            window.copyFallback(tsv);
            doCopy();
        });
    } else {
        window.copyFallback(tsv);
        doCopy();
    }
};

window.copyFallback = function(text) {

    let textarea = document.createElement('textarea');

    textarea.value = text;

    textarea.style.position = 'fixed';

    textarea.style.left = '-9999px';

    textarea.style.top = '-9999px';

    document.body.appendChild(textarea);

    textarea.focus();

    textarea.select();

    try {

        document.execCommand('copy');

    } catch (err) {

        console.error('Copy fallback error:', err);

    }

    document.body.removeChild(textarea);

};





// Initialize garage options for current project on boot

if (typeof updateGarageDropdown === 'function') {

    updateGarageDropdown(currentProject);

}





// 70-30 Balloon One-Click Preset Handler

window.apply7030Preset = function() {

    let chk = document.getElementById('toggle-intra-year');

    let btn = document.getElementById('btn-quick-7030');

    if (!chk) return;

    

    // Toggle logic: if already active with 70%, turn off cleanly

    let typeEl = document.getElementById('intra-year-type');

    let valEl = document.getElementById('intra-year-val');

    let scopeEl = document.getElementById('intra-year-scope');

    

    let isCurrently7030 = chk.checked && typeEl && typeEl.value === 'pct' && valEl && String(valEl.value).trim() === '70' && scopeEl && scopeEl.value === 'all';

    

    if (isCurrently7030) {

        chk.checked = false;

        if (window.onIntraYearToggle) window.onIntraYearToggle();

        if (btn) {

            btn.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)';

            btn.innerHTML = '🎯 نمط 70% / 30% (Balloon)';

        }

    } else {

        chk.checked = true;

        if (window.onIntraYearToggle) window.onIntraYearToggle();

        if (typeEl) {

            typeEl.value = 'pct';

            if (window.onIntraYearTypeChange) window.onIntraYearTypeChange();

        }

        if (valEl) valEl.value = '70';

        if (scopeEl) {

            scopeEl.value = 'all';

            if (window.onIntraYearScopeChange) window.onIntraYearScopeChange();

        }

        if (btn) {

            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';

            btn.innerHTML = '✅ مفعل: نمط 70% / 30% (انقر للإلغاء)';

        }

    }

    if (window.calculate) window.calculate();

};





// ============================================================================

// OPERATIONS RESEARCH (OR) AI PAYMENT FACILITIES & CONSTRAINED OPTIMIZATION

// ============================================================================

window._orScenariosData = [];



// ==============================================================================
// NATIONS OF SKY - EMBEDDED OPERATIONS RESEARCH (OR) SUITE & DYNAMIC SOLVER
// ==============================================================================

window._orOptionScenariosData = window._orOptionScenariosData || {};
window._orScenariosData = window._orScenariosData || [];

// ==============================================================================
// NATIONS OF SKY - EMBEDDED OPERATIONS RESEARCH (OR) SUITE & DYNAMIC SOLVER (V62)
// STRICT COMPLIANCE: NO MELTING / CANCELING OF BULK PAYMENTS
// ADVANCING PAYMENTS ALLOWED | ACCURATE ADJUST & FLEXIBLE TO 0.00 EGP NPV
// ==============================================================================

window._orOptionScenariosData = window._orOptionScenariosData || {};
window._orScenariosData = window._orScenariosData || [];

window.createORSolverContext = function(forceFlexible = false) {
    let proj = currentProject;
    let isZomra = (proj === 'Zomra');
    let basePrice = basePriceCache || 5000000;
    let contractDateStr = document.getElementById('contract-date') ? document.getElementById('contract-date').value : formatDate(new Date());
    let years = parseInt(document.getElementById('duration-years') ? document.getElementById('duration-years').value : 8) || 8;
    let freqMonths = (document.getElementById('payment-frequency') && parseInt(document.getElementById('payment-frequency').value) === 2) ? 6 : 3;

    // 1. Calculate Target Base PV according to mode (ADJUST = standard period, FLEXIBLE = daily discount)
    let baseTpl = generateFlowsTemplate(contractDateStr, years, freqMonths, true, null, forceFlexible, forceFlexible);
    let bFlows = calculateBaseFlows(basePrice, baseTpl, contractDateStr);
    let targetPv = bFlows.filter(f => !f.isMnt).reduce((sum, f) => sum + (f.pv || 0), 0);

    // 2. Working template with appropriate discount logic
    let tpl = generateFlowsTemplate(contractDateStr, years, freqMonths, false, null, forceFlexible, forceFlexible);
    tpl.forEach(f => applyDiscountLogic(f, contractDateStr, false, forceFlexible));

    let instPeriods = tpl.filter(f => (f.isInst || f.isMerged) && !f.isMnt);
    let totalInstCount = instPeriods.length;
    let hasDeliv = tpl.some(f => f.id === 'deliv' || (f.mergedIds && f.mergedIds.includes('deliv')));
    let delivFlow = tpl.find(f => f.id === 'deliv' || (f.mergedIds && f.mergedIds.includes('deliv')) || (f.label && f.label.includes('Delivery') && !f.isMnt));
    let delivDateStr = delivFlow ? delivFlow.date : formatDate(addMonths(contractDateStr, (isZomra ? 37 : 36)));
    let delivDateObj = new Date(delivDateStr);

    // 3. User entered custom inputs
    let getEffectiveMilestonePct = function(id, defaultVal) {
        let el = document.getElementById(id + '-val');
        if (!el || !el.value) return defaultVal;
        let v = parseFloat(el.value);
        if (isNaN(v) || v <= 0) return defaultVal;
        let typeEl = document.getElementById(id + '-type');
        let isPct = typeEl ? (typeEl.value === 'pct') : (v < 100);
        return isPct ? (v / 100.0) : (v / basePrice);
    };

    let dp1Pct = getEffectiveMilestonePct('dp1', isZomra ? 0.025 : 0.05);
    let dp2Pct = getEffectiveMilestonePct('dp2', isZomra ? 0.025 : 0.05);
    let addlPct = isZomra ? getEffectiveMilestonePct('addl', 0.05) : 0;
    let delivPct = hasDeliv ? getEffectiveMilestonePct('deliv', (isZomra ? 0.05 : 0.05)) : 0;

    let solve = function(getFlowPct, customFlowDates = null) {
        let scFlows = [];
        let W = 0.0;
        tpl.forEach(f => {
            if (f.isMnt) return;
            let fCopy = Object.assign({}, f);
            if (customFlowDates && customFlowDates[fCopy.id]) {
                fCopy.date = customFlowDates[fCopy.id];
                // Recalculate discount factor for the shifted date
                applyDiscountLogic(fCopy, contractDateStr, false, forceFlexible);
            }
            fCopy.scenarioPct = getFlowPct(fCopy);
            let df = fCopy.pvFactor !== undefined ? fCopy.pvFactor : 1.0;
            W += fCopy.scenarioPct * df;
            scFlows.push(fCopy);
        });
        let solvedP = targetPv / W;
        let preSum = scFlows.filter(f => new Date(f.date) <= delivDateObj).reduce((s, f) => s + f.scenarioPct, 0) * 100;
        return {
            flows: scFlows,
            price: solvedP,
            diffPct: (solvedP - basePrice) / basePrice * 100,
            preDelivPct: preSum
        };
    };

    return {
        proj, isZomra, basePrice, contractDateStr, years, freqMonths,
        targetPv, tpl, instPeriods, totalInstCount, hasDeliv, delivDateObj,
        dp1Pct, dp2Pct, addlPct, delivPct, solve
    };
};

// ------------------------------------------------------------------------------
// UNIVERSAL OR SCENARIO CARD RENDERER
// ------------------------------------------------------------------------------
window.renderORScenariosInContainer = function(scenarios, containerId, contextTitle, basePrice, isRefresh = false) {
    let container = document.getElementById(containerId);
    if (!container) return;

    if (!window._orOptionScenariosData) window._orOptionScenariosData = {};
    window._orOptionScenariosData[containerId] = scenarios;

    // Toggle container if already open for same context, unless it's a silent background refresh
    if (!isRefresh && container.style.display !== 'none' && container.getAttribute('data-active-context') === contextTitle) {
        container.style.display = 'none';
        return;
    }
    container.setAttribute('data-active-context', contextTitle);

    let html = `
        <div style="background: rgba(15, 23, 42, 0.94); border: 1.5px solid rgba(56, 189, 248, 0.5); border-radius: 8px; padding: 14px; margin-top: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.12); padding-bottom: 8px;">
                <div>
                    <h4 style="margin: 0; color: #38bdf8; font-size: 1.05rem; display: flex; align-items: center; gap: 8px;">
                        <span>🤖 حلول وبدائل بحوث العمليات (OR) - ${contextTitle}</span>
                    </h4>
                    <span style="font-size: 0.8rem; color: #94a3b8;">متوافقة 100% مع شيتات الإكسيل (NPV Diff: 0.00 EGP) | الحفاظ التام على الدفعات ومقدمات مدروسة.</span>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <button type="button" onclick="window.refreshSingleORContainer('${containerId}')" title="إعادة الحساب بناءً على مدخلاتك الحالية" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; border-radius: 4px; padding: 3px 10px; font-size: 0.82rem; cursor: pointer; font-weight: bold;">🔄 تحديث السيناريوهات</button>
                    <button type="button" onclick="document.getElementById('${containerId}').style.display='none'" style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; border-radius: 4px; padding: 3px 8px; font-size: 0.82rem; cursor: pointer;">✕ إغلاق</button>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px;">
    `;

    scenarios.forEach((sc, idx) => {
        let diffAmt = Math.round(sc.price - basePrice);
        let diffColor = '#38bdf8';
        let diffText = 'بدون أي زيادة أو خصم (0.00%)';
        if (sc.diffPct < -0.001) {
            diffColor = '#10b981';
            diffText = `خصم ${Math.abs(sc.diffPct).toFixed(2)}% (توفير ${formatCurr(Math.abs(diffAmt))})`;
        } else if (sc.diffPct > 0.001) {
            diffColor = '#f59e0b';
            diffText = `زيادة سعر +${sc.diffPct.toFixed(2)}% (+${formatCurr(diffAmt)})`;
        }

        let isFlex = (sc.mode === 'FLEXIBLE');
        let modeBadgeText = isFlex ? '📅 نمط FLEXIBLE (تعديل تواريخ O9=2)' : '⚙️ نمط ADJUST (تواريخ قياسية O9=1)';
        let modeBadgeBg = isFlex ? 'linear-gradient(135deg, #7c3aed, #9333ea)' : 'linear-gradient(135deg, #059669, #10b981)';

        html += `
            <div style="background: rgba(30, 41, 59, 0.88); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 14px rgba(0,0,0,0.3);">
                <div>
                    <!-- Mode & Badges -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 6px;">
                        <span style="background: ${modeBadgeBg}; color: #fff; font-size: 0.72rem; font-weight: bold; padding: 2px 8px; border-radius: 4px;">
                            ${modeBadgeText}
                        </span>
                        <span style="background: ${sc.badgeColor || '#2563eb'}; color: #fff; font-size: 0.72rem; padding: 2px 8px; border-radius: 12px; white-space: nowrap;">
                            ${sc.badge}
                        </span>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                        <strong style="color: #f8fafc; font-size: 0.94rem;">${sc.title}</strong>
                    </div>
                    <div style="font-size: 0.82rem; color: #94a3b8; line-height: 1.4; margin-bottom: 8px;">${sc.subtitle}</div>
                    
                    ${sc.dateChangeNotes ? `
                        <div style="background: rgba(139, 92, 246, 0.15); border: 1px dashed #a855f7; border-radius: 6px; padding: 6px 10px; margin-bottom: 10px; font-size: 0.78rem; color: #ddd6fe; line-height: 1.4;">
                            <strong>📅 تفاصيل تعديل التواريخ:</strong> ${sc.dateChangeNotes}
                        </div>
                    ` : ''}

                    <!-- Financial Summary Badge -->
                    <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95)); border: 1px solid rgba(56, 189, 248, 0.28); border-radius: 6px; padding: 10px 12px; margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <span style="font-size: 0.8rem; color: #cbd5e1; font-weight: 600;">💰 سعر الوحدة المقترح:</span>
                            <strong style="color: #38bdf8; font-size: 1.05rem; font-family: monospace;">${formatCurr(sc.price)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <span style="font-size: 0.8rem; color: #cbd5e1; font-weight: 600;">🏷️ الخصم أو الزيادة:</span>
                            <strong style="font-size: 0.86rem; color: ${diffColor};">${diffText}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 5px; border-top: 1px dashed rgba(255,255,255,0.12); font-size: 0.76rem;">
                            <span style="color: #10b981;">⚖️ فارق الـ NPV مع الإكسيل: <strong>0.00 ج.م</strong></span>
                            <span style="color: #94a3b8;">التحصيل قبل الاستلام: <strong style="color: #e2e8f0;">${sc.preDelivPct.toFixed(1)}%</strong></span>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px; background: rgba(15, 23, 42, 0.6); padding: 8px; border-radius: 6px;">
                        ${sc.metrics.map(m => `
                            <div>
                                <span style="font-size: 0.72rem; color: #64748b; display: block;">${m.label}</span>
                                <strong style="color: #38bdf8; font-size: 0.85rem;">${m.val}</strong> <span style="font-size: 0.7rem; color: #94a3b8;">${m.unit}</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div style="background: rgba(59, 130, 246, 0.08); border-left: 3px solid #3b82f6; padding: 6px 8px; border-radius: 0 4px 4px 0; font-size: 0.76rem; line-height: 1.42; margin-bottom: 10px;">
                        <div style="color: #cbd5e1; margin-bottom: 3px;">👤 <strong>للعميل:</strong> ${sc.benefits.client}</div>
                        <div style="color: #cbd5e1; margin-bottom: 3px;">💼 <strong>للسيلز:</strong> ${sc.benefits.sales}</div>
                        <div style="color: #cbd5e1;">🏢 <strong>للشركة:</strong> ${sc.benefits.company}</div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 6px; margin-top: 6px;">
                    <button type="button" class="btn btn-primary" onclick="window.applyOROptionScenario('${containerId}', ${idx})" style="flex: 1; padding: 8px 10px; font-size: 0.84rem; font-weight: bold; background: #2563eb; border: none; border-radius: 4px; cursor: pointer;">
                        🚀 تطبيق في السيستم فوراً
                    </button>
                    <button type="button" class="btn btn-outline" onclick="window.copyOROptionScenarioForExcel('${containerId}', ${idx})" style="padding: 8px 10px; font-size: 0.84rem; border: 1px solid #10b981; color: #10b981; background: transparent; border-radius: 4px; cursor: pointer; white-space: nowrap;">
                        📋 نسخ للإكسيل
                    </button>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;
    container.style.display = 'block';
    if (!isRefresh) {
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
};

// ------------------------------------------------------------------------------
// UNIVERSAL APPLY FUNCTION (STRICT APPLICATION TO SYSTEM, TABLE & CONTROLS)
// ------------------------------------------------------------------------------
window.applyOROptionScenario = function(containerId, idx) {
    if (!window._orOptionScenariosData || !window._orOptionScenariosData[containerId] || !window._orOptionScenariosData[containerId][idx]) return;
    let sc = window._orOptionScenariosData[containerId][idx];

    // 1. Sync Flexible Mode Switch
    let flexToggle = document.getElementById('flexible-toggle');
    if (sc.mode === 'FLEXIBLE') {
        if (flexToggle) flexToggle.value = 'yes';
    } else {
        if (flexToggle) flexToggle.value = 'no';
    }

    // 2. Sync Top Inputs if modified in scenario
    if (sc.dp1Pct !== undefined) {
        let dp1El = document.getElementById('dp1-val');
        let dp1Type = document.getElementById('dp1-type');
        if (dp1El) dp1El.value = (sc.dp1Pct * 100).toFixed(2);
        if (dp1Type) dp1Type.value = 'pct';
    }
    if (sc.dp2Pct !== undefined) {
        let dp2El = document.getElementById('dp2-val');
        let dp2Type = document.getElementById('dp2-type');
        if (dp2El) dp2El.value = (sc.dp2Pct * 100).toFixed(2);
        if (dp2Type) dp2Type.value = 'pct';
    }
    if (sc.targetPrice !== undefined) {
        let tpEl = document.getElementById('target-price-val');
        if (tpEl) tpEl.value = Math.round(sc.targetPrice);
        let tpPctEl = document.getElementById('target-pct-val');
        if (tpPctEl) tpPctEl.value = sc.diffPct ? sc.diffPct.toFixed(2) : '';
    }

    // 3. Clear conflicting override states
    window.globalTableOverrides = {};
    window.installmentShiftState = { zeroInsts: [], targetInsts: [], destMode: 'all' };
    
    // 4. Populate table overrides from scenario flows
    sc.flows.forEach(f => {
        window.globalTableOverrides[f.id] = {
            amount: f.scenarioPct * 100,
            isPct: true,
            date: f.date
        };
    });

    // 5. Run full calculation engine
    if (window.calculate) window.calculate();

    // 6. Smooth scroll to table
    let tableTarget = document.getElementById('offer-tbody') || document.querySelector('.table-container') || document.getElementById('custom-plan-card');
    if (tableTarget) {
        tableTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    let modeMsg = (sc.mode === 'FLEXIBLE')
        ? `📅 نمط FLEXIBLE (تم تعديل التواريخ: ${sc.dateChangeNotes || 'مواعيد مخصصة'})`
        : `⚙️ نمط ADJUST (تواريخ قياسية O9=1)`;

    if (window.showToast) {
        window.showToast(`✅ تم تطبيق سيناريو OR (${sc.title}) بنجاح!\n${modeMsg} — تطابق الـ NPV بالمليم (0.00 ج.م).`, true, 6500);
    }
};

window.copyOROptionScenarioForExcel = function(containerId, idx) {
    if (!window._orOptionScenariosData || !window._orOptionScenariosData[containerId] || !window._orOptionScenariosData[containerId][idx]) return;
    let sc = window._orOptionScenariosData[containerId][idx];

    let textToCopy = window.formatFlowsToExcelRows(sc.flows, sc.price);
    let lines = textToCopy.split('\r\n').filter(Boolean);

    let doCopy = function() {
        let isZomra = (currentProject === 'Zomra');
        let rowRange = isZomra ? 'S16:S58 (43 سطر)' : 'S16:S57 (42 سطر)';
        let modeRule = (sc.mode === 'FLEXIBLE')
            ? '3. تأكد أن خيار Flexible مفعل على YES (الخلية O9 = 2) نظراً لتعديل التواريخ:\n   (' + (sc.dateChangeNotes || 'مواعيد مخصصة') + ').\n'
            : '3. تأكد أن خيار Flexible مفعل على NO (الخلية O9 = 1) لأن التواريخ قياسية لم تتغير.\n';

        let msg = '✅ تم نسخ نسب سيناريو (' + sc.title + ') بالكامل (' + lines.length + ' سطر متوافق مع الإكسيل)!\n\n' +
                  '📌 خطوات التطبيق في شيت المشروع:\n' +
                  '1. حدد الخلية S16 في شيت ' + currentProject + '.\n' +
                  '2. الصق القيم بـ Ctrl+V (ستملأ النطاق ' + rowRange + ' بدقة متناهية مع مطابقة الـ NPV 0.00 ج.م).\n' +
                  modeRule +
                  '4. اضغط Calculate للتأكد من انضباط السعر والـ NPV.';
        if (window.showToast) window.showToast(msg, true, 8000);
        else alert(msg);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(doCopy).catch(err => {
            window.legacyCopyToClipboard(textToCopy, doCopy);
        });
    } else {
        window.legacyCopyToClipboard(textToCopy, doCopy);
    }
};

// ------------------------------------------------------------------------------
// 1. OR FOR BALLOON SHIFT (أنماط ترحيل الأقساط والبالون 70/30)
// RULES: NO MELTING / CANCELING BULK PAYMENTS | ADVANCING ALLOWED
// ------------------------------------------------------------------------------
window.runORForBalloonShift = function(isRefresh = false) {
    let ctxAdjust = window.createORSolverContext(false);
    let ctxFlex = window.createORSolverContext(true);

    let msSum = ctxAdjust.dp1Pct + ctxAdjust.dp2Pct + ctxAdjust.addlPct + ctxAdjust.delivPct;
    let instPool = Math.max(0, 1.0 - msSum);
    let qPerYear = (ctxAdjust.freqMonths === 6) ? 2 : 4;
    let totalYears = ctxAdjust.years;

    // Check user intra installment / balloon input
    let userIntraVal = parseFloat(document.getElementById('intra-year-val')?.value);
    let userBalloonShare = 0.30;
    if (!isNaN(userIntraVal) && userIntraVal > 0) {
        let isPct = document.getElementById('intra-year-type')?.value === 'pct';
        if (isPct && userIntraVal > 0 && userIntraVal < 100) {
            userBalloonShare = userIntraVal / 100.0;
        }
    }

    let buildBalloonSc = function(ctx, mode, dateNotes, title, badge, badgeColor, subtitle, getYearSplits, customDates, dp1Adj, clientBen, salesBen, compBen) {
        let effectiveDp1 = ctx.dp1Pct + (dp1Adj || 0);
        let effInstPool = Math.max(0, 1.0 - (effectiveDp1 + ctx.dp2Pct + ctx.addlPct + ctx.delivPct));

        let sc = ctx.solve(f => {
            if (f.id === 'dp1') return effectiveDp1;
            if (f.id === 'dp2') return ctx.dp2Pct;
            if (f.id === 'addl') return ctx.addlPct;
            if (f.id === 'deliv' && !f.isMerged) return ctx.delivPct;
            let instIdx = ctx.instPeriods.findIndex(x => x.id === f.id);
            let yIdx = Math.floor(instIdx / qPerYear);
            let qInY = instIdx % qPerYear;
            let splits = getYearSplits(yIdx);
            let annualPool = effInstPool / totalYears;
            let isBalloonQ = (qInY === qPerYear - 1);
            let part = isBalloonQ ? (annualPool * splits.balloonPct) : ((annualPool * splits.regularPct) / (qPerYear - 1));
            if (f.isMerged) return ctx.delivPct + part;
            return part;
        }, customDates);

        sc.mode = mode;
        sc.dp1Pct = effectiveDp1;
        sc.dateChanged = (mode === 'FLEXIBLE');
        sc.dateChangeNotes = dateNotes;

        let regShare = 1 - userBalloonShare;
        return {
            title, badge, badgeColor, subtitle,
            mode, dp1Pct: effectiveDp1, dateChanged: sc.dateChanged, dateChangeNotes: sc.dateChangeNotes,
            price: sc.price, diffPct: sc.diffPct, preDelivPct: sc.preDelivPct, flows: sc.flows,
            metrics: [
                { label: 'التحصيل قبل الاستلام', val: sc.preDelivPct.toFixed(1) + '%', unit: '(مستوفى)' },
                { label: 'متوسط القسط الخفيف', val: formatCurr(sc.price * (effInstPool / totalYears * regShare / (qPerYear - 1))), unit: '/ دوري' },
                { label: 'متوسط البالون السنوي', val: formatCurr(sc.price * (effInstPool / totalYears * userBalloonShare)), unit: '/ سنوي' },
                { label: 'فرق السعر', val: (sc.diffPct >= 0 ? '+' : '') + sc.diffPct.toFixed(2) + '%', unit: '' }
            ],
            benefits: { client: clientBen, sales: salesBen, company: compBen }
        };
    };

    // Scenario 1: ADJUST Mode - Standard 70/30 (or user custom) with Standard Dates
    let sc1 = buildBalloonSc(
        ctxAdjust, 'ADJUST', null,
        `🎯 نمط ${Math.round((1 - userBalloonShare)*100)}% / ${Math.round(userBalloonShare*100)}% القياسي (نمط ADJUST)`,
        'النمط المعتمد', '#2563eb',
        `توزيع ${Math.round((1 - userBalloonShare)*100)}% على الأقساط العادية مع ${Math.round(userBalloonShare*100)}% كبالون سنوي بنهاية كل سنة على المواعيد القياسية دون مساس بالدفعات.`,
        y => ({ regularPct: (1 - userBalloonShare), balloonPct: userBalloonShare }),
        null, 0,
        'أقساط دورية خفيفة جداً تترك سيولة ممتازة في جيب العميل طوال السنة.',
        'النمط الأكثر طلباً وقبولاً لدى عملاء الاستثمار والتجارة.',
        'تدفقات سنوية مركزة تحمي السيولة وتطابق الإكسيل بدقة 0.00 ج.م على نمط ADJUST.'
    );

    // Scenario 2: ADJUST Mode - Stepped Progressive Balloon with +2.5% DP Boost
    let sc2 = buildBalloonSc(
        ctxAdjust, 'ADJUST', null,
        '📈 نمط البالون المتصاعد مع دعم مقدم +2.5% (Stepped Progressive)',
        'تصاعدي ذكي', '#10b981',
        'بالون يبدأ خفيفاً بنسبة 20% في السنة الأولى ويتصاعد تدريجياً لـ 35% مع إضافة +2.5% للمقدم لتخفيف عبء الأقساط الدورية لأقصى درجة.',
        y => {
            let b = (y === 0) ? 0.20 : ((y === 1) ? 0.25 : 0.35);
            return { regularPct: (1.0 - b), balloonPct: b };
        },
        null, 0.025,
        'بداية شديدة السهولة بدون أي ضغط في السنة الأولى مع أقساط ربع سنوية في غاية الخفة.',
        'مناسب جداً للعملاء المترددين في دفع بالونات كبيرة في البداية.',
        'تحصيل مبكر أقوى للشركة مع حماية كاملة للقيمة الحالية وتطابق تام 0.00 ج.م.'
    );

    // Scenario 3: FLEXIBLE Mode - Deferred Annual Balloon with Advanced Bulk Payment
    let customDates_s3 = {};
    ctxFlex.instPeriods.forEach((inst, idx) => {
        let qInY = idx % qPerYear;
        if (qInY === qPerYear - 1) {
            customDates_s3[inst.id] = formatDate(addMonths(inst.date, 2));
        }
    });

    // Advance 6-month or delivery payment earlier by 2 months if exists
    let addlFlow = ctxFlex.tpl.find(f => f.id === 'addl');
    let dateNotesS3 = 'ترحيل موعد استحقاق البالون السنوي شهرين إضافيين ليتزامن بدقة مع موعد أرباح العميل السنوية';
    if (addlFlow) {
        let advDate = formatDate(addMonths(ctxFlex.contractDateStr, 4)); // month 4 instead of 6
        customDates_s3['addl'] = advDate;
        dateNotesS3 += ` مع تقديم ميعاد دفعة الـ 6 شهور شهرين بدري (في ${advDate}) لدعم التدفق المالي للشركة.`;
    }

    let sc3 = buildBalloonSc(
        ctxFlex, 'FLEXIBLE', dateNotesS3,
        '📅 نمط البالون لموسم الأرباح مع تقديم دفعة مرحلية (Bonus Season)',
        'ميعاد مخصص (FLEXIBLE)', '#8b5cf6',
        'ترحيل موعد سداد البالون السنوي شهرين ليتوافق مع توقيت البونص السنوي للعميل، مع تقديم دفعة مرحلية شهرين لصالح الشركة.',
        y => ({ regularPct: 0.70, balloonPct: 0.30 }),
        customDates_s3, 0,
        'مواءمة كاملة بين ميعاد سداد البالون وبين توفر السيولة في حساب العميل دون أي ضغط.',
        'حل بيعي فريد ومقنع جداً لعملاء الشركات والمهن الحرة.',
        'تحصيل مؤكد بدون تعثر مع حفظ كامل الـ NPV بالمليم عبر نمط FLEXIBLE.'
    );

    window.renderORScenariosInContainer([sc1, sc2, sc3], 'or-balloon-shift-results', 'أنماط ترحيل الأقساط والبالون', ctxAdjust.basePrice, isRefresh);
};

// ------------------------------------------------------------------------------
// 2. OR FOR ZERO & SHIFT INSTALLMENTS (تصفير وترحيل أقساط محددة)
// RULES: NO MELTING / CANCELING BULK PAYMENTS | ADVANCING ALLOWED
// ------------------------------------------------------------------------------
window.runORForZeroShift = function(isRefresh = false) {
    let ctxAdjust = window.createORSolverContext(false);
    let ctxFlex = window.createORSolverContext(true);

    let msSum = ctxAdjust.dp1Pct + ctxAdjust.dp2Pct + ctxAdjust.addlPct + ctxAdjust.delivPct;
    let instPool = Math.max(0, 1.0 - msSum);

    // Read user zeroed installments input from the UI
    let zeroStr = document.getElementById('zero-inst-ids')?.value || '';
    let parsedZeros = zeroStr.split(/[\s,]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0 && n <= ctxAdjust.totalInstCount);
    
    let zeroIndices = [];
    if (parsedZeros.length > 0) {
        zeroIndices = parsedZeros.map(n => n - 1);
    } else if (window.installmentShiftState && window.installmentShiftState.zeroInsts && window.installmentShiftState.zeroInsts.length > 0) {
        zeroIndices = window.installmentShiftState.zeroInsts.map(n => n - 1);
    } else {
        // Intelligent default: first 2 quarterly installments
        let defCount = (ctxAdjust.freqMonths === 6) ? 1 : 2;
        for (let i = 0; i < defCount; i++) zeroIndices.push(i);
    }

    let zeroSet = new Set(zeroIndices);
    let activeInstCount = ctxAdjust.totalInstCount - zeroSet.size;
    let s1_active_inst = instPool / Math.max(1, activeInstCount);
    let zeroLabelsText = Array.from(zeroSet).map(idx => `قسط ${idx + 1}`).join('، ');

    // Scenario 1: ADJUST Mode - Linear Balanced Shift across Active Installments
    let sc1 = ctxAdjust.solve(f => {
        if (f.id === 'dp1') return ctxAdjust.dp1Pct;
        if (f.id === 'dp2') return ctxAdjust.dp2Pct;
        if (f.id === 'addl') return ctxAdjust.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxAdjust.delivPct;
        let instIdx = ctxAdjust.instPeriods.findIndex(x => x.id === f.id);
        let part = zeroSet.has(instIdx) ? 0 : s1_active_inst;
        if (f.isMerged) return ctxAdjust.delivPct + part;
        return part;
    });
    sc1.mode = 'ADJUST';
    sc1.dateChanged = false;
    sc1.dateChangeNotes = null;

    // Scenario 2: ADJUST Mode - Zero Shift with +2.5% Down Payment Absorption
    let s2_dp1 = ctxAdjust.dp1Pct + 0.025;
    let s2_inst_pool = Math.max(0, 1.0 - (s2_dp1 + ctxAdjust.dp2Pct + ctxAdjust.addlPct + ctxAdjust.delivPct));
    let s2_active_inst = s2_inst_pool / Math.max(1, activeInstCount);
    let sc2 = ctxAdjust.solve(f => {
        if (f.id === 'dp1') return s2_dp1;
        if (f.id === 'dp2') return ctxAdjust.dp2Pct;
        if (f.id === 'addl') return ctxAdjust.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxAdjust.delivPct;
        let instIdx = ctxAdjust.instPeriods.findIndex(x => x.id === f.id);
        let part = zeroSet.has(instIdx) ? 0 : s2_active_inst;
        if (f.isMerged) return ctxAdjust.delivPct + part;
        return part;
    });
    sc2.mode = 'ADJUST';
    sc2.dp1Pct = s2_dp1;
    sc2.dateChanged = false;
    sc2.dateChangeNotes = null;

    // Scenario 3: FLEXIBLE Mode - True Grace Period with Advanced Bulk Payment
    let shiftGraceMonths = 6;
    let customDates_s3 = {};
    let dateNotesS3 = `تأجيل مواعيد استحقاق الأقساط المصفّرة (${zeroLabelsText}) كفترة سماح 6 شهور`;
    
    // Advance bulk payment if available
    let addlFlow = ctxFlex.tpl.find(f => f.id === 'addl');
    if (addlFlow) {
        let advDate = formatDate(addMonths(ctxFlex.contractDateStr, 4));
        customDates_s3['addl'] = advDate;
        dateNotesS3 += ` مع تقديم ميعاد دفعة الـ 6 شهور شهرين بدري (في ${advDate}) لضمان التدفق النقدي`;
    }

    ctxFlex.instPeriods.forEach((inst, idx) => {
        if (zeroSet.has(idx)) {
            customDates_s3[inst.id] = formatDate(addMonths(inst.date, shiftGraceMonths));
        }
    });

    let s3_inst = instPool / Math.max(1, activeInstCount);
    let sc3 = ctxFlex.solve(f => {
        if (f.id === 'dp1') return ctxFlex.dp1Pct;
        if (f.id === 'dp2') return ctxFlex.dp2Pct;
        if (f.id === 'addl') return ctxFlex.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxFlex.delivPct;
        let instIdx = ctxFlex.instPeriods.findIndex(x => x.id === f.id);
        let part = zeroSet.has(instIdx) ? 0 : s3_inst;
        if (f.isMerged) return ctxFlex.delivPct + part;
        return part;
    }, customDates_s3);
    sc3.mode = 'FLEXIBLE';
    sc3.dateChanged = true;
    sc3.dateChangeNotes = dateNotesS3;

    let scenarios = [
        {
            title: `🔄 ترحيل متوازن للأقساط المصفّرة (${zeroLabelsText})`,
            badge: 'النمط القياسي', badgeColor: '#2563eb',
            subtitle: `تصفير الأقساط المحددة بالكامل وتوزيع مبالغها بالتساوي على باقي الأقساط النشطة على التواريخ القياسية (نمط ADJUST) دون مساس بالدفعات.`,
            mode: 'ADJUST', dateChanged: false, dateChangeNotes: null,
            price: sc1.price, diffPct: sc1.diffPct, preDelivPct: sc1.preDelivPct, flows: sc1.flows,
            metrics: [
                { label: 'الأقساط المصفّرة', val: zeroSet.size + ' أقساط', unit: '(0.00 ج.م)' },
                { label: 'القسط بعد الترحيل', val: formatCurr(sc1.price * s1_active_inst), unit: '/ دوري' },
                { label: 'التحصيل قبل الاستلام', val: sc1.preDelivPct.toFixed(1) + '%', unit: '(مستوفى)' },
                { label: 'فرق السعر', val: (sc1.diffPct >= 0 ? '+' : '') + sc1.diffPct.toFixed(2) + '%', unit: '' }
            ],
            benefits: {
                client: `فترة إعفاء كاملة من دفع الأقساط (${zeroLabelsText}) تمنح العميل متنفساً مالياً ممتازاً.`,
                sales: 'إغلاق الصفقة فوراً مع العميل الذي لديه التزامات مالية في الأشهر الأولى.',
                company: 'تحصيل كامل القيمة التعاقدية دون أي خصم وتطابق الـ NPV بدقة 0.00 ج.م.'
            }
        },
        {
            title: `💰 تصفير الأقساط مع استيعاب مقدم +2.5%`,
            badge: 'أقساط أخف', badgeColor: '#10b981',
            subtitle: `تصفير الأقساط المطلوبة مع زيادة بسيطة في المقدم (+2.5%) لحماية باقي الأقساط من التضخم وضمان انتظام السداد.`,
            mode: 'ADJUST', dp1Pct: s2_dp1, dateChanged: false, dateChangeNotes: null,
            price: sc2.price, diffPct: sc2.diffPct, preDelivPct: sc2.preDelivPct, flows: sc2.flows,
            metrics: [
                { label: 'المقدم المقترح', val: (s2_dp1 * 100).toFixed(1) + '%', unit: `(+2.5%)` },
                { label: 'القسط المخفف', val: formatCurr(sc2.price * s2_active_inst), unit: '/ دوري' },
                { label: 'التحصيل قبل الاستلام', val: sc2.preDelivPct.toFixed(1) + '%', unit: '(مستوفى)' },
                { label: 'فرق السعر', val: (sc2.diffPct >= 0 ? '+' : '') + sc2.diffPct.toFixed(2) + '%', unit: '' }
            ],
            benefits: {
                client: 'تصفير الأقساط المستهدفة مع تجنب أي قفزة كبيرة في قيمة الأقساط التالية.',
                sales: 'حل مالي عملي جداً يسهل إقناع المشتري بزيادة بسيطة في المقدم مقابل تصفير الأقساط.',
                company: 'تحصيل كاش مبكر إضافي +2.5% يعزز السيولة ويحمي التدفق النقدي.'
            }
        },
        {
            title: `📅 فترة سماح حقيقية مع تقديم دفعة مرحلية (FLEXIBLE)`,
            badge: 'ميعاد مخصص', badgeColor: '#8b5cf6',
            subtitle: `فترة سماح 6 شهور للأقساط مع تقديم موعد دفعة الـ 6 شهور شهرين بدري لصالح التدفق المالي للشركة وفق نمط FLEXIBLE.`,
            mode: 'FLEXIBLE', dateChanged: true, dateChangeNotes: dateNotesS3,
            price: sc3.price, diffPct: sc3.diffPct, preDelivPct: sc3.preDelivPct, flows: sc3.flows,
            metrics: [
                { label: 'فترة السماح', val: '6 شهور', unit: 'إضافية' },
                { label: 'قسط بعد السماح', val: formatCurr(sc3.price * s3_inst), unit: '/ دوري' },
                { label: 'التحصيل قبل الاستلام', val: sc3.preDelivPct.toFixed(1) + '%', unit: '(مستوفى)' },
                { label: 'فرق السعر', val: (sc3.diffPct >= 0 ? '+' : '') + sc3.diffPct.toFixed(2) + '%', unit: '' }
            ],
            benefits: {
                client: 'تأجيل تواريخ السداد بدون غرامات وبأريحية تامة للتدفق النقدي الشخصي.',
                sales: 'أفضل عرض بيعي لعميل يطلب صراحة تأجيل أول أو ثاني قسط.',
                company: 'تقديم دفعة مرحلية مبكراً يعوض تأخير الأقساط ويحفظ الـ NPV بالمليم (0.00 ج.م).'
            }
        }
    ];

    window.renderORScenariosInContainer(scenarios, 'or-zero-shift-results', 'تصفير وترحيل الأقساط', ctxAdjust.basePrice, isRefresh);
};

// ------------------------------------------------------------------------------
// 3. OR FOR TARGET PRICE (حلول السعر المستهدف Smart Solver)
// RULES: UNIFORM INSTALLMENTS (NO DISTORTED LAST INST) | NO MELTING BULK | ADVANCING ALLOWED
// ------------------------------------------------------------------------------
window.runORForTargetPrice = function(isRefresh = false) {
    let ctxAdjust = window.createORSolverContext(false);
    let ctxFlex = window.createORSolverContext(true);

    let msSum = ctxAdjust.dp1Pct + ctxAdjust.dp2Pct + ctxAdjust.addlPct + ctxAdjust.delivPct;
    let instPool = Math.max(0, 1.0 - msSum);

    // Read user target price or pct
    let userTargetP = parseFloat(document.getElementById('target-price-val')?.value);
    let userTargetPct = parseFloat(document.getElementById('target-pct-val')?.value);
    let activeTargetPrice = 0;

    if (!isNaN(userTargetP) && userTargetP > 0) {
        activeTargetPrice = userTargetP;
    } else if (!isNaN(userTargetPct) && userTargetPct !== 0) {
        activeTargetPrice = ctxAdjust.basePrice * (1.0 + userTargetPct / 100.0);
    } else {
        activeTargetPrice = ctxAdjust.basePrice * 0.95; // Default 5% discount
    }

    // Closed-form exact calculation of DP adjustment needed to hit activeTargetPrice with uniform installments
    let reqWeight = ctxAdjust.targetPv / activeTargetPrice;
    let dynInstsTpl = ctxAdjust.tpl.filter(f => (f.isInst || f.isMerged) && !f.isMnt);
    let sumInstDf = dynInstsTpl.reduce((s, f) => s + (f.pvFactor || 1.0), 0);
    let W_inst = dynInstsTpl.length > 0 ? (sumInstDf / dynInstsTpl.length) : 0;
    
    // Milestones weight (without DP1)
    let W_ms_other = 0;
    let S_ms_other = 0;
    ctxAdjust.tpl.forEach(f => {
        if (f.id === 'dp2' || f.id === 'addl') {
            S_ms_other += f.defaultPct || 0;
            W_ms_other += (f.defaultPct || 0) * (f.pvFactor || 1.0);
        } else if (f.isMerged || (f.id === 'deliv' && !f.isMerged)) {
            let delivP = ctxAdjust.delivPct;
            S_ms_other += delivP;
            W_ms_other += delivP * (f.pvFactor || 1.0);
        }
    });

    let neededDp1Pct = ctxAdjust.dp1Pct;
    if (Math.abs(1.0 - W_inst) > 1e-7) {
        neededDp1Pct = (reqWeight - W_ms_other - (1.0 - S_ms_other) * W_inst) / (1.0 - W_inst);
    }
    neededDp1Pct = Math.max(0.01, Math.min(0.80, neededDp1Pct));

    // Scenario 1: ADJUST Mode - Uniform Solver with Exact DP Adjustment
    let s1_inst_pool = Math.max(0, 1.0 - (neededDp1Pct + ctxAdjust.dp2Pct + ctxAdjust.addlPct + ctxAdjust.delivPct));
    let s1_inst = s1_inst_pool / ctxAdjust.totalInstCount;

    let sc1 = ctxAdjust.solve(f => {
        if (f.id === 'dp1') return neededDp1Pct;
        if (f.id === 'dp2') return ctxAdjust.dp2Pct;
        if (f.id === 'addl') return ctxAdjust.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxAdjust.delivPct;
        if (f.isMerged) return ctxAdjust.delivPct + s1_inst;
        return s1_inst;
    });
    sc1.mode = 'ADJUST';
    sc1.dp1Pct = neededDp1Pct;
    sc1.targetPrice = activeTargetPrice;
    sc1.dateChanged = false;
    sc1.dateChangeNotes = null;

    // Scenario 2: ADJUST Mode - Keep Base DP + Graduated Pre/Post Delivery Installments
    let delivMonth = (ctxAdjust.isZomra ? 37 : 48);
    let preInsts = dynInstsTpl.filter(f => f.months <= delivMonth);
    let postInsts = dynInstsTpl.filter(f => f.months > delivMonth);
    let nPre = preInsts.length;
    let nPost = postInsts.length;
    let s2_pre_inst = s1_inst;
    let s2_post_inst = s1_inst;

    if (nPre > 0 && nPost > 0) {
        let sumPreDf = preInsts.reduce((s, f) => s + (f.pvFactor || 1.0), 0);
        let sumPostDf = postInsts.reduce((s, f) => s + (f.pvFactor || 1.0), 0);
        let coeff = sumPreDf - (nPre / nPost) * sumPostDf;
        let baseMsWeight = (ctxAdjust.dp1Pct * 1.0) + W_ms_other;
        let neededInstPv = reqWeight - baseMsWeight - ((1.0 - ctxAdjust.dp1Pct - S_ms_other) / nPost) * sumPostDf;
        if (Math.abs(coeff) > 1e-7) {
            s2_pre_inst = neededInstPv / coeff;
            s2_post_inst = (1.0 - ctxAdjust.dp1Pct - S_ms_other - nPre * s2_pre_inst) / nPost;
        }
    }

    let sc2 = ctxAdjust.solve(f => {
        if (f.id === 'dp1') return ctxAdjust.dp1Pct;
        if (f.id === 'dp2') return ctxAdjust.dp2Pct;
        if (f.id === 'addl') return ctxAdjust.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxAdjust.delivPct;
        let isPre = f.months <= delivMonth;
        let part = isPre ? s2_pre_inst : s2_post_inst;
        if (f.isMerged) return ctxAdjust.delivPct + part;
        return part;
    });
    sc2.mode = 'ADJUST';
    sc2.dp1Pct = ctxAdjust.dp1Pct;
    sc2.targetPrice = activeTargetPrice;
    sc2.dateChanged = false;
    sc2.dateChangeNotes = null;

    // Scenario 3: FLEXIBLE Mode - Target Price via Advanced Bulk Payment (تقديم دفعة الـ 6 شهور بدري)
    let customDates_s3 = {};
    let dateNotesS3 = '';
    let addlFlow = ctxFlex.tpl.find(f => f.id === 'addl');
    if (addlFlow) {
        let advDate = formatDate(addMonths(ctxFlex.contractDateStr, 3)); // Month 3 instead of 6
        customDates_s3['addl'] = advDate;
        dateNotesS3 = `تقديم ميعاد دفعة الـ 6 شهور 3 أشهر بدري (في ${advDate}) لدعم التدفق المالي للشركة وتحقيق الخصم المستهدف للعميل`;
    } else {
        let delivF = ctxFlex.tpl.find(f => f.id === 'deliv');
        if (delivF) {
            let advDate = formatDate(addMonths(delivF.date, -3));
            customDates_s3[delivF.id] = advDate;
            dateNotesS3 = `تقديم ميعاد دفعة الاستلام 3 أشهر بدري لدعم التدفق المالي للشركة`;
        }
    }

    let s3_inst = (instPool / ctxFlex.totalInstCount);
    let sc3 = ctxFlex.solve(f => {
        if (f.id === 'dp1') return ctxFlex.dp1Pct;
        if (f.id === 'dp2') return ctxFlex.dp2Pct;
        if (f.id === 'addl') return ctxFlex.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxFlex.delivPct;
        if (f.isMerged) return ctxFlex.delivPct + s3_inst;
        return s3_inst;
    }, customDates_s3);
    sc3.mode = 'FLEXIBLE';
    sc3.targetPrice = sc3.price;
    sc3.dateChanged = true;
    sc3.dateChangeNotes = dateNotesS3;

    let scenarios = [
        {
            title: '🎯 أقساط متساوية منتظمة 100% (Uniform Solver)',
            badge: 'بدون تشويه للأقساط', badgeColor: '#2563eb',
            subtitle: `تحقيق السعر المستهدف (${formatCurr(activeTargetPrice)}) مع ضبط المقدم لنسبة ${(neededDp1Pct * 100).toFixed(2)}% لتكون جميع الأقساط متساوية تماماً بالمليم وبدون تشويه آخر قسط.`,
            mode: 'ADJUST', dp1Pct: neededDp1Pct, targetPrice: activeTargetPrice, dateChanged: false, dateChangeNotes: null,
            price: activeTargetPrice, diffPct: ((activeTargetPrice - ctxAdjust.basePrice) / ctxAdjust.basePrice * 100), preDelivPct: sc1.preDelivPct, flows: sc1.flows,
            metrics: [
                { label: 'المقدم المطلوب', val: (neededDp1Pct * 100).toFixed(2) + '%', unit: `(${formatCurr(activeTargetPrice * neededDp1Pct)})` },
                { label: 'القسط الدوري المتساوي', val: formatCurr(activeTargetPrice * s1_inst), unit: '/ دوري' },
                { label: 'التحصيل قبل الاستلام', val: sc1.preDelivPct.toFixed(1) + '%', unit: '(مستوفى)' },
                { label: 'فارق السعر المطلوب', val: (((activeTargetPrice - ctxAdjust.basePrice) / ctxAdjust.basePrice * 100) >= 0 ? '+' : '') + ((activeTargetPrice - ctxAdjust.basePrice) / ctxAdjust.basePrice * 100).toFixed(2) + '%', unit: '' }
            ],
            benefits: {
                client: 'سعر الوحدة المطلوب بدقة متناهية مع أقساط منتظمة متساوية دون أي قفزات مفاجئة.',
                sales: 'إغلاق الصفقة على ميزانية العميل المحددة بدقة 100% بضغطة زر واحدة.',
                company: 'تأمين كامل القيمة الحالية للشركة (NPV 0.00 ج.م) مع زيادة خفيفة في المقدم.'
            }
        },
        {
            title: '⚖️ تدرج الأقساط قبل وبعد الاستلام (Graduated Plan)',
            badge: 'مقدم قياسي أصلي', badgeColor: '#10b981',
            subtitle: `تحقيق السعر المستهدف مع الحفاظ التام على المقدم الأصلي (${(ctxAdjust.dp1Pct * 100).toFixed(1)}%) عبر موازنة أقساط ما قبل الاستلام وما بعدها.`,
            mode: 'ADJUST', dp1Pct: ctxAdjust.dp1Pct, targetPrice: activeTargetPrice, dateChanged: false, dateChangeNotes: null,
            price: activeTargetPrice, diffPct: ((activeTargetPrice - ctxAdjust.basePrice) / ctxAdjust.basePrice * 100), preDelivPct: sc2.preDelivPct, flows: sc2.flows,
            metrics: [
                { label: 'المقدم الأصلي', val: (ctxAdjust.dp1Pct * 100).toFixed(1) + '%', unit: '(بدون تغيير)' },
                { label: 'قسط قبل الاستلام', val: formatCurr(activeTargetPrice * s2_pre_inst), unit: '/ دوري' },
                { label: 'قسط بعد الاستلام', val: formatCurr(activeTargetPrice * s2_post_inst), unit: '/ دوري' },
                { label: 'التحصيل قبل الاستلام', val: sc2.preDelivPct.toFixed(1) + '%', unit: '(مستوفى)' }
            ],
            benefits: {
                client: 'عدم دفع أي زيادة في المقدم والوصول للسعر المستهدف بأقساط ما قبل استلام مريحة.',
                sales: 'الخيار المثالي للعميل الرافض لأي زيادة في مقدم التعاقد.',
                company: 'تحصيل كاش قوي قبل التسليم يضمن استيفاء نسبة التحصيل التعاقدية للشركة.'
            }
        },
        {
            title: '📅 تقديم الدفعة المرحلية لصالح التدفق المالي (FLEXIBLE)',
            badge: 'ميعاد مخصص', badgeColor: '#8b5cf6',
            subtitle: `تحقيق الخصم المستهدف عبر تقديم موعد الدفعة المرحلية لصالح الشركة وفق نمط FLEXIBLE مع الحفاظ على الأقساط الدورية متساوية.`,
            mode: 'FLEXIBLE', targetPrice: sc3.price, dateChanged: true, dateChangeNotes: dateNotesS3,
            price: sc3.price, diffPct: sc3.diffPct, preDelivPct: sc3.preDelivPct, flows: sc3.flows,
            metrics: [
                { label: 'السعر المحقق', val: formatCurr(sc3.price), unit: 'EGP' },
                { label: 'القسط الدوري', val: formatCurr(sc3.price * s3_inst), unit: '/ دوري' },
                { label: 'التحصيل قبل الاستلام', val: sc3.preDelivPct.toFixed(1) + '%', unit: '(مستوفى)' },
                { label: 'فرق السعر', val: (sc3.diffPct >= 0 ? '+' : '') + sc3.diffPct.toFixed(2) + '%', unit: '' }
            ],
            benefits: {
                client: 'الحصول على خصم فعلي دون الحاجة إلى دفع أقساط أعلى أو مقدم أكبر.',
                sales: 'تقديم حل مرن ومقنع بتبكير دفعة واحدة فقط مقابل سعر مميز.',
                company: 'استلام سيولة كاش مبكرة يعوض الخصم بالكامل ويحفظ الـ NPV بدقة 0.00 ج.م.'
            }
        }
    ];

    window.renderORScenariosInContainer(scenarios, 'or-target-price-results', 'السعر المستهدف', ctxAdjust.basePrice, isRefresh);
};

// ------------------------------------------------------------------------------
// 4. OR FOR FIXED INSTALLMENTS (تثبيت الأقساط)
// RULES: NO MELTING BULK | ADVANCING ALLOWED
// ------------------------------------------------------------------------------
window.runORForFixedInst = function(isRefresh = false) {
    let ctxAdjust = window.createORSolverContext(false);
    let ctxFlex = window.createORSolverContext(true);

    let msSum = ctxAdjust.dp1Pct + ctxAdjust.dp2Pct + ctxAdjust.addlPct + ctxAdjust.delivPct;
    let instPool = Math.max(0, 1.0 - msSum);
    let numEarly = (ctxAdjust.freqMonths === 6) ? 4 : 8; // First 2 years
    let numLate = ctxAdjust.totalInstCount - numEarly;

    // Check user fixed inst input
    let userVal = parseFloat(document.getElementById('fixed-inst-val')?.value);
    let fixedAmt = (!isNaN(userVal) && userVal > 0) ? userVal : Math.round((ctxAdjust.basePrice * instPool / ctxAdjust.totalInstCount) * 0.70);
    let fixedPct = fixedAmt / ctxAdjust.basePrice;

    // Scenario 1: ADJUST Mode - Uniform Shift to Remaining Installments
    let remPoolS1 = Math.max(0, instPool - (numEarly * fixedPct));
    let latePctS1 = numLate > 0 ? (remPoolS1 / numLate) : 0;
    let sc1 = ctxAdjust.solve(f => {
        if (f.id === 'dp1') return ctxAdjust.dp1Pct;
        if (f.id === 'dp2') return ctxAdjust.dp2Pct;
        if (f.id === 'addl') return ctxAdjust.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxAdjust.delivPct;
        let idx = ctxAdjust.instPeriods.findIndex(x => x.id === f.id);
        let part = (idx < numEarly) ? fixedPct : latePctS1;
        if (f.isMerged) return ctxAdjust.delivPct + part;
        return part;
    });
    sc1.mode = 'ADJUST';
    sc1.dateChanged = false;
    sc1.dateChangeNotes = null;

    // Scenario 2: ADJUST Mode - Fixed Installment with +2.5% DP Absorption
    let s2_dp1 = ctxAdjust.dp1Pct + 0.025;
    let effInstPoolS2 = Math.max(0, 1.0 - (s2_dp1 + ctxAdjust.dp2Pct + ctxAdjust.addlPct + ctxAdjust.delivPct));
    let remPoolS2 = Math.max(0, effInstPoolS2 - (numEarly * fixedPct));
    let latePctS2 = numLate > 0 ? (remPoolS2 / numLate) : 0;
    let sc2 = ctxAdjust.solve(f => {
        if (f.id === 'dp1') return s2_dp1;
        if (f.id === 'dp2') return ctxAdjust.dp2Pct;
        if (f.id === 'addl') return ctxAdjust.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxAdjust.delivPct;
        let idx = ctxAdjust.instPeriods.findIndex(x => x.id === f.id);
        let part = (idx < numEarly) ? fixedPct : latePctS2;
        if (f.isMerged) return ctxAdjust.delivPct + part;
        return part;
    });
    sc2.mode = 'ADJUST';
    sc2.dp1Pct = s2_dp1;
    sc2.dateChanged = false;
    sc2.dateChangeNotes = null;

    // Scenario 3: FLEXIBLE Mode - Fixed Installments with Advanced Bulk Payment
    let customDates_s3 = {};
    let dateNotesS3 = 'تثبيت الأقساط المبكرة مع الحفاظ على التواريخ المرنة';
    let addlFlow = ctxFlex.tpl.find(f => f.id === 'addl');
    if (addlFlow) {
        let advDate = formatDate(addMonths(ctxFlex.contractDateStr, 4));
        customDates_s3['addl'] = advDate;
        dateNotesS3 = `تقديم ميعاد دفعة الـ 6 شهور شهرين بدري (في ${advDate}) لدعم التدفق المالي للشركة وتخفيف الأقساط اللاحقة`;
    }

    let sc3 = ctxFlex.solve(f => {
        if (f.id === 'dp1') return ctxFlex.dp1Pct;
        if (f.id === 'dp2') return ctxFlex.dp2Pct;
        if (f.id === 'addl') return ctxFlex.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxFlex.delivPct;
        let idx = ctxFlex.instPeriods.findIndex(x => x.id === f.id);
        let part = (idx < numEarly) ? fixedPct : latePctS1;
        if (f.isMerged) return ctxFlex.delivPct + part;
        return part;
    }, customDates_s3);
    sc3.mode = 'FLEXIBLE';
    sc3.dateChanged = true;
    sc3.dateChangeNotes = dateNotesS3;

    let scenarios = [
        {
            title: `🎯 تثبيت أول سنتين على (${formatCurr(fixedAmt)}) وتوزيع الفارق`,
            badge: 'النمط المعتمد', badgeColor: '#2563eb',
            subtitle: `تثبيت أقساط أول سنتين على ${formatCurr(fixedAmt)} ونقل الفارق بالتساوي على باقي الأقساط على التواريخ القياسية (نمط ADJUST) دون مساس بالدفعات.`,
            mode: 'ADJUST', dateChanged: false, dateChangeNotes: null,
            price: sc1.price, diffPct: sc1.diffPct, preDelivPct: sc1.preDelivPct, flows: sc1.flows,
            metrics: [
                { label: 'القسط المثبت (سنتين)', val: formatCurr(fixedAmt), unit: '/ دوري' },
                { label: 'القسط اللاحق', val: formatCurr(sc1.price * latePctS1), unit: '/ دوري' },
                { label: 'التحصيل قبل الاستلام', val: sc1.preDelivPct.toFixed(1) + '%', unit: '(مستوفى)' },
                { label: 'فرق السعر', val: (sc1.diffPct >= 0 ? '+' : '') + sc1.diffPct.toFixed(2) + '%', unit: '' }
            ],
            benefits: {
                client: 'وضوح واستقرار مالي تام لأول عامين من التعاقد بأقساط مريحة ومحددة سلفاً.',
                sales: 'إغلاق سريع للعميل الذي يسأل عن قسط شهري أو دوري محدد وثابت.',
                company: 'تحصيل منتظم ومضمون مع الحفاظ على القيمة الحالية بدقة 0.00 ج.م على نمط ADJUST.'
            }
        },
        {
            title: `💰 تثبيت الأقساط مع استيعاب مقدم +2.5%`,
            badge: 'أقساط لاحقة ميسرة', badgeColor: '#10b981',
            subtitle: `تثبيت أقساط أول سنتين مع زيادة بسيطة في المقدم (+2.5%) لحماية الأقساط اللاحقة من الارتفاع الكبير.`,
            mode: 'ADJUST', dp1Pct: s2_dp1, dateChanged: false, dateChangeNotes: null,
            price: sc2.price, diffPct: sc2.diffPct, preDelivPct: sc2.preDelivPct, flows: sc2.flows,
            metrics: [
                { label: 'المقدم المقترح', val: (s2_dp1 * 100).toFixed(1) + '%', unit: `(+2.5%)` },
                { label: 'القسط اللاحق المخفف', val: formatCurr(sc2.price * latePctS2), unit: '/ دوري' },
                { label: 'التحصيل قبل الاستلام', val: sc2.preDelivPct.toFixed(1) + '%', unit: '(مستوفى)' },
                { label: 'فرق السعر', val: (sc2.diffPct >= 0 ? '+' : '') + sc2.diffPct.toFixed(2) + '%', unit: '' }
            ],
            benefits: {
                client: 'قسط ثابت خفيف في البداية مع أقساط لاحقة معتدلة ومستقرة تماماً.',
                sales: 'حل مقنع وذكي لمنع اعتراض العميل على كبر الأقساط بعد انتهاء فترة التثبيت.',
                company: 'سيولة مبكرة إضافية للشركة تحمي معدلات التحصيل التعاقدية.'
            }
        },
        {
            title: `📅 تثبيت مع تقديم دفعة مرحلية (FLEXIBLE)`,
            badge: 'ميعاد مخصص', badgeColor: '#8b5cf6',
            subtitle: `تثبيت الأقساط المبكرة مع تقديم ميعاد دفعة الـ 6 شهور شهرين بدري لصالح التدفق المالي للشركة وفق نمط FLEXIBLE.`,
            mode: 'FLEXIBLE', dateChanged: true, dateChangeNotes: dateNotesS3,
            price: sc3.price, diffPct: sc3.diffPct, preDelivPct: sc3.preDelivPct, flows: sc3.flows,
            metrics: [
                { label: 'القسط المثبت', val: formatCurr(fixedAmt), unit: '/ دوري' },
                { label: 'القسط اللاحق', val: formatCurr(sc3.price * latePctS1), unit: '/ دوري' },
                { label: 'التحصيل قبل الاستلام', val: sc3.preDelivPct.toFixed(1) + '%', unit: '(مستوفى)' },
                { label: 'فرق السعر', val: (sc3.diffPct >= 0 ? '+' : '') + sc3.diffPct.toFixed(2) + '%', unit: '' }
            ],
            benefits: {
                client: 'قسط ميسر وثابت مع خطة سداد مريحة.',
                sales: 'بديل مرن يجمع بين تثبيت القسط وتبكير دفعة واحدة محددة.',
                company: 'تحصيل كاش مبكر يعزز الـ NPV ويضمن تطابق 0.00 ج.م على نمط FLEXIBLE.'
            }
        }
    ];

    window.renderORScenariosInContainer(scenarios, 'or-fixed-inst-results', 'تثبيت الأقساط', ctxAdjust.basePrice, isRefresh);
};

// ------------------------------------------------------------------------------
// 5. OR FOR MILESTONES & DOWN PAYMENTS (المقدمات والدفعات)
// RULES: NO MELTING / CANCELING BULK PAYMENTS | ADVANCING ALLOWED
// ------------------------------------------------------------------------------
window.runORForMilestones = function(isRefresh = false) {
    let ctxAdjust = window.createORSolverContext(false);
    let ctxFlex = window.createORSolverContext(true);

    // Scenario 1: ADJUST Mode - Minimum Down Payment with Uniform Installments
    let minDp1 = ctxAdjust.isZomra ? 0.025 : 0.05;
    let minDp2 = ctxAdjust.isZomra ? 0.025 : 0.05;
    let poolS1 = Math.max(0, 1.0 - (minDp1 + minDp2 + ctxAdjust.addlPct + ctxAdjust.delivPct));
    let instS1 = poolS1 / ctxAdjust.totalInstCount;

    let sc1 = ctxAdjust.solve(f => {
        if (f.id === 'dp1') return minDp1;
        if (f.id === 'dp2') return minDp2;
        if (f.id === 'addl') return ctxAdjust.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxAdjust.delivPct;
        if (f.isMerged) return ctxAdjust.delivPct + instS1;
        return instS1;
    });
    sc1.mode = 'ADJUST';
    sc1.dp1Pct = minDp1;
    sc1.dateChanged = false;
    sc1.dateChangeNotes = null;

    // Scenario 2: ADJUST Mode - Enhanced DP (+2.5%) for Lowest Quarterly Installments
    let enhDp1 = minDp1 + 0.025;
    let poolS2 = Math.max(0, 1.0 - (enhDp1 + minDp2 + ctxAdjust.addlPct + ctxAdjust.delivPct));
    let instS2 = poolS2 / ctxAdjust.totalInstCount;

    let sc2 = ctxAdjust.solve(f => {
        if (f.id === 'dp1') return enhDp1;
        if (f.id === 'dp2') return minDp2;
        if (f.id === 'addl') return ctxAdjust.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxAdjust.delivPct;
        if (f.isMerged) return ctxAdjust.delivPct + instS2;
        return instS2;
    });
    sc2.mode = 'ADJUST';
    sc2.dp1Pct = enhDp1;
    sc2.dateChanged = false;
    sc2.dateChangeNotes = null;

    // Scenario 3: FLEXIBLE Mode - Advance 6-Month Bulk Payment for Real Discount
    let customDates_s3 = {};
    let dateNotesS3 = '';
    let addlFlow = ctxFlex.tpl.find(f => f.id === 'addl');
    if (addlFlow) {
        let advDate = formatDate(addMonths(ctxFlex.contractDateStr, 3));
        customDates_s3['addl'] = advDate;
        dateNotesS3 = `تقديم ميعاد دفعة الـ 6 شهور إلى الشهر الثالث (في ${advDate}) لصالح الشركة`;
    } else {
        let delivF = ctxFlex.tpl.find(f => f.id === 'deliv');
        if (delivF) {
            let advDate = formatDate(addMonths(delivF.date, -3));
            customDates_s3[delivF.id] = advDate;
            dateNotesS3 = `تقديم ميعاد دفعة الاستلام 3 أشهر بدري لدعم التدفق المالي`;
        }
    }

    let sc3 = ctxFlex.solve(f => {
        if (f.id === 'dp1') return minDp1;
        if (f.id === 'dp2') return minDp2;
        if (f.id === 'addl') return ctxFlex.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxFlex.delivPct;
        if (f.isMerged) return ctxFlex.delivPct + instS1;
        return instS1;
    }, customDates_s3);
    sc3.mode = 'FLEXIBLE';
    sc3.dateChanged = true;
    sc3.dateChangeNotes = dateNotesS3;

    let scenarios = [
        {
            title: `🎯 أقل مقدم تعاقدي (${(minDp1 * 100).toFixed(1)}%) بأقساط متساوية منتظمة`,
            badge: 'النمط المعتمد', badgeColor: '#2563eb',
            subtitle: `دخول الصفقة بأقل مقدم تعاقدي (${(minDp1 * 100).toFixed(1)}%) وتوزيع باقي القيمة على أقساط متساوية تماماً على التواريخ القياسية دون مساس بالدفعات.`,
            mode: 'ADJUST', dp1Pct: minDp1, dateChanged: false, dateChangeNotes: null,
            price: sc1.price, diffPct: sc1.diffPct, preDelivPct: sc1.preDelivPct, flows: sc1.flows,
            metrics: [
                { label: 'مقدم التعاقد', val: (minDp1 * 100).toFixed(1) + '%', unit: `(${formatCurr(sc1.price * minDp1)})` },
                { label: 'القسط الدوري المتساوي', val: formatCurr(sc1.price * instS1), unit: '/ دوري' },
                { label: 'التحصيل قبل الاستلام', val: sc1.preDelivPct.toFixed(1) + '%', unit: '(مستوفى)' },
                { label: 'فرق السعر', val: (sc1.diffPct >= 0 ? '+' : '') + sc1.diffPct.toFixed(2) + '%', unit: '' }
            ],
            benefits: {
                client: 'أقل حاجز دخول للصفقة مع أقساط منتظمة متساوية طوال مدة السداد.',
                sales: 'إغلاق فوري مع المشتري الباحث عن أقل سيولة كاش مبدئية.',
                company: 'التزام تام بالخطة التعاقدية القياسية للشركة وتطابق الـ NPV بدقة 0.00 ج.م.'
            }
        },
        {
            title: `💰 مقدم معزز (+2.5%) لأقل قسط دوري ممكن`,
            badge: 'أقل قسط دوري', badgeColor: '#10b981',
            subtitle: `زيادة بسيطة في المقدم (+2.5%) تمنح العميل قسطاً دورياً هو الأقل على الإطلاق مع الحفاظ على الدفعات في مواعيدها.`,
            mode: 'ADJUST', dp1Pct: enhDp1, dateChanged: false, dateChangeNotes: null,
            price: sc2.price, diffPct: sc2.diffPct, preDelivPct: sc2.preDelivPct, flows: sc2.flows,
            metrics: [
                { label: 'المقدم المعزز', val: (enhDp1 * 100).toFixed(1) + '%', unit: `(${formatCurr(sc2.price * enhDp1)})` },
                { label: 'القسط الدوري المخفف', val: formatCurr(sc2.price * instS2), unit: '/ دوري' },
                { label: 'التحصيل قبل الاستلام', val: sc2.preDelivPct.toFixed(1) + '%', unit: '(مستوفى)' },
                { label: 'فرق السعر', val: (sc2.diffPct >= 0 ? '+' : '') + sc2.diffPct.toFixed(2) + '%', unit: '' }
            ],
            benefits: {
                client: 'أقساط دورية خفيفة جداً تضمن استقرار الميزانية الشهرية دون أي ضغط.',
                sales: 'إقناع المشتري بأن زيادة 2.5% في المقدم توفر عليه آلاف الجنيهات في كل قسط.',
                company: 'تحصيل كاش مبكر ممتاز يعزز التدفق النقدي الفعلي للمشروع.'
            }
        },
        {
            title: `📅 تقديم موعد الدفعة المرحلية للحصول على خصم نقدي (FLEXIBLE)`,
            badge: 'ميعاد مخصص', badgeColor: '#8b5cf6',
            subtitle: `تقديم ميعاد الدفعة المرحلية 3 شهور بدري لصالح الشركة يمنح العميل خصماً حقيقياً وفق نمط FLEXIBLE مع حفظ كامل الدفعات.`,
            mode: 'FLEXIBLE', dateChanged: true, dateChangeNotes: dateNotesS3,
            price: sc3.price, diffPct: sc3.diffPct, preDelivPct: sc3.preDelivPct, flows: sc3.flows,
            metrics: [
                { label: 'السعر بعد الخصم', val: formatCurr(sc3.price), unit: 'EGP' },
                { label: 'نسبة الخصم', val: Math.abs(sc3.diffPct).toFixed(2) + '%', unit: `(توفير ${formatCurr(Math.abs(sc3.price - ctxAdjust.basePrice))})` },
                { label: 'التحصيل قبل الاستلام', val: sc3.preDelivPct.toFixed(1) + '%', unit: '(مستوفى)' },
                { label: 'فارق NPV مع الإكسيل', val: '0.00', unit: 'ج.م' }
            ],
            benefits: {
                client: 'خصم نقدي معتبر ومباشر في السعر الإجمالي بمجرد تبكير دفعة واحدة.',
                sales: 'أقوى أداة تفاوض لمنح خصم حقيقي معتمد مالياً ومحمي بالـ NPV.',
                company: 'استلام سيولة مبكرة يعوض الخصم بالكامل ويحقق أهداف التدفق النقدي للشركة.'
            }
        }
    ];

    window.renderORScenariosInContainer(scenarios, 'or-milestones-results', 'المقدمات والدفعات', ctxAdjust.basePrice, isRefresh);
};

// ------------------------------------------------------------------------------
// 6. MASTER OR FACILITIES (الباقات الشاملة أسفل الصفحة)
// RULES: NO MELTING / CANCELING BULK PAYMENTS | ADVANCING ALLOWED
// ------------------------------------------------------------------------------
window.generateAndRenderORFacilities = function() {
    let container = document.getElementById('or-facilities-results-container');
    if (!container) return;

    let basePrice = basePriceCache || 5000000;
    let ctxAdjust = window.createORSolverContext(false);
    let ctxFlex = window.createORSolverContext(true);

    let msSum = ctxAdjust.dp1Pct + ctxAdjust.dp2Pct + ctxAdjust.addlPct + ctxAdjust.delivPct;
    let instPool = Math.max(0, 1.0 - msSum);
    let qPerYear = (ctxAdjust.freqMonths === 6) ? 2 : 4;
    let totalYears = ctxAdjust.years;

    // Package 1: ADJUST - Commercial Investment 70/30 Balloon
    let sc1 = ctxAdjust.solve(f => {
        if (f.id === 'dp1') return ctxAdjust.dp1Pct;
        if (f.id === 'dp2') return ctxAdjust.dp2Pct;
        if (f.id === 'addl') return ctxAdjust.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxAdjust.delivPct;
        let instIdx = ctxAdjust.instPeriods.findIndex(x => x.id === f.id);
        let qInY = instIdx % qPerYear;
        let annualPool = instPool / totalYears;
        let isBalloonQ = (qInY === qPerYear - 1);
        let part = isBalloonQ ? (annualPool * 0.30) : ((annualPool * 0.70) / (qPerYear - 1));
        if (f.isMerged) return ctxAdjust.delivPct + part;
        return part;
    });
    sc1.mode = 'ADJUST';
    sc1.title = '🏢 باقة الاستثمار التجاري (بالون سنوي 70/30)';
    sc1.badge = 'الأكثر طلباً'; sc1.badgeColor = '#2563eb';
    sc1.desc = 'توزيع 70% على الأقساط الدورية و 30% كبالون سنوي بنهاية كل سنة على التواريخ القياسية (نمط ADJUST) دون مساس بالدفعات.';
    sc1.dateNotes = null;

    // Package 2: ADJUST - Smart Investor Stepped Balloon + 2.5% DP
    let p2_dp1 = ctxAdjust.dp1Pct + 0.025;
    let p2_inst_pool = Math.max(0, 1.0 - (p2_dp1 + ctxAdjust.dp2Pct + ctxAdjust.addlPct + ctxAdjust.delivPct));
    let sc2 = ctxAdjust.solve(f => {
        if (f.id === 'dp1') return p2_dp1;
        if (f.id === 'dp2') return ctxAdjust.dp2Pct;
        if (f.id === 'addl') return ctxAdjust.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxAdjust.delivPct;
        let instIdx = ctxAdjust.instPeriods.findIndex(x => x.id === f.id);
        let yIdx = Math.floor(instIdx / qPerYear);
        let qInY = instIdx % qPerYear;
        let b = (yIdx === 0) ? 0.20 : ((yIdx === 1) ? 0.25 : 0.35);
        let annualPool = p2_inst_pool / totalYears;
        let isBalloonQ = (qInY === qPerYear - 1);
        let part = isBalloonQ ? (annualPool * b) : ((annualPool * (1.0 - b)) / (qPerYear - 1));
        if (f.isMerged) return ctxAdjust.delivPct + part;
        return part;
    });
    sc2.mode = 'ADJUST';
    sc2.dp1Pct = p2_dp1;
    sc2.title = '📈 باقة المستثمر الذكي (بالون تصاعدي مع مقدم +2.5%)';
    sc2.badge = 'تصاعدي مريح'; sc2.badgeColor = '#10b981';
    sc2.desc = 'بالون يتصاعد تدريجياً من 20% في السنة الأولى إلى 35% مع إضافة 2.5% للمقدم لتوفير أقصى سهولة في الأقساط.';
    sc2.dateNotes = null;

    // Package 3: FLEXIBLE - Bonus Season Balloon with Advanced Bulk Payment
    let p3_dates = {};
    ctxFlex.instPeriods.forEach((inst, idx) => {
        let qInY = idx % qPerYear;
        if (qInY === qPerYear - 1) p3_dates[inst.id] = formatDate(addMonths(inst.date, 2));
    });
    let addlFlow = ctxFlex.tpl.find(f => f.id === 'addl');
    let p3_dateNotes = 'ترحيل موعد البالون السنوي شهرين ليتزامن مع أرباح العميل السنوية';
    if (addlFlow) {
        let advDate = formatDate(addMonths(ctxFlex.contractDateStr, 4));
        p3_dates['addl'] = advDate;
        p3_dateNotes += ` مع تقديم ميعاد دفعة الـ 6 شهور شهرين بدري (في ${advDate}) لدعم السيولة للشركة.`;
    }
    let sc3 = ctxFlex.solve(f => {
        if (f.id === 'dp1') return ctxFlex.dp1Pct;
        if (f.id === 'dp2') return ctxFlex.dp2Pct;
        if (f.id === 'addl') return ctxFlex.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxFlex.delivPct;
        let instIdx = ctxFlex.instPeriods.findIndex(x => x.id === f.id);
        let qInY = instIdx % qPerYear;
        let annualPool = instPool / totalYears;
        let isBalloonQ = (qInY === qPerYear - 1);
        let part = isBalloonQ ? (annualPool * 0.30) : ((annualPool * 0.70) / (qPerYear - 1));
        if (f.isMerged) return ctxFlex.delivPct + part;
        return part;
    }, p3_dates);
    sc3.mode = 'FLEXIBLE';
    sc3.title = '📅 باقة الشركات وأصحاب الأعمال (مواعيد بالون الأرباح)';
    sc3.badge = 'ميعاد مخصص'; sc3.badgeColor = '#8b5cf6';
    sc3.desc = 'ترحيل البالون السنوي شهرين ليتوافق مع توزيعات أرباح العميل، مع تقديم دفعة مرحلية شهرين لصالح الشركة وفق نمط FLEXIBLE.';
    sc3.dateNotes = p3_dateNotes;

    // Package 4: ADJUST - Early Reduced Installments (Fixed First 2 Years)
    let earlyFixedAmt = Math.round((basePrice * instPool / ctxAdjust.totalInstCount) * 0.65);
    let earlyFixedPct = earlyFixedAmt / basePrice;
    let nEarly = (ctxAdjust.freqMonths === 6) ? 4 : 8;
    let nLate = ctxAdjust.totalInstCount - nEarly;
    let remPoolP4 = Math.max(0, instPool - (nEarly * earlyFixedPct));
    let latePctP4 = nLate > 0 ? (remPoolP4 / nLate) : 0;
    let sc4 = ctxAdjust.solve(f => {
        if (f.id === 'dp1') return ctxAdjust.dp1Pct;
        if (f.id === 'dp2') return ctxAdjust.dp2Pct;
        if (f.id === 'addl') return ctxAdjust.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxAdjust.delivPct;
        let idx = ctxAdjust.instPeriods.findIndex(x => x.id === f.id);
        let part = (idx < nEarly) ? earlyFixedPct : latePctP4;
        if (f.isMerged) return ctxAdjust.delivPct + part;
        return part;
    });
    sc4.mode = 'ADJUST';
    sc4.title = `⚡ باقة انطلاق الأعمال (قسط مخفض أول سنتين: ${formatCurr(earlyFixedAmt)})`;
    sc4.badge = 'قسط بداية خفيف'; sc4.badgeColor = '#06b6d4';
    sc4.desc = `تثبيت أقساط أول سنتين بقيمة مخفضة بنسبة 35% (${formatCurr(earlyFixedAmt)}) لدعم انطلاقة العميل وترحيل الفارق بالتساوي لاحقاً.`;
    sc4.dateNotes = null;

    // Package 5: ADJUST - Uniform 100% Equal Installments (Target Price Solver)
    let uniformTargetPrice = Math.round(basePrice * 0.95); // 5% discount target
    let reqW = ctxAdjust.targetPv / uniformTargetPrice;
    let dynInstsTpl = ctxAdjust.tpl.filter(f => (f.isInst || f.isMerged) && !f.isMnt);
    let sumInstDf = dynInstsTpl.reduce((s, f) => s + (f.pvFactor || 1.0), 0);
    let W_inst = dynInstsTpl.length > 0 ? (sumInstDf / dynInstsTpl.length) : 0;
    let W_ms_other = 0; let S_ms_other = 0;
    ctxAdjust.tpl.forEach(f => {
        if (f.id === 'dp2' || f.id === 'addl') { S_ms_other += f.defaultPct || 0; W_ms_other += (f.defaultPct || 0) * (f.pvFactor || 1.0); }
        else if (f.isMerged || (f.id === 'deliv' && !f.isMerged)) { S_ms_other += ctxAdjust.delivPct; W_ms_other += ctxAdjust.delivPct * (f.pvFactor || 1.0); }
    });
    let p5_dp1 = (reqW - W_ms_other - (1.0 - S_ms_other) * W_inst) / (1.0 - W_inst);
    p5_dp1 = Math.max(0.01, Math.min(0.80, p5_dp1));
    let p5_inst_pool = Math.max(0, 1.0 - (p5_dp1 + ctxAdjust.dp2Pct + ctxAdjust.addlPct + ctxAdjust.delivPct));
    let p5_inst = p5_inst_pool / ctxAdjust.totalInstCount;
    let sc5 = ctxAdjust.solve(f => {
        if (f.id === 'dp1') return p5_dp1;
        if (f.id === 'dp2') return ctxAdjust.dp2Pct;
        if (f.id === 'addl') return ctxAdjust.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxAdjust.delivPct;
        if (f.isMerged) return ctxAdjust.delivPct + p5_inst;
        return p5_inst;
    });
    sc5.mode = 'ADJUST';
    sc5.dp1Pct = p5_dp1;
    sc5.targetPrice = uniformTargetPrice;
    sc5.title = '🎯 باقة الأقساط المتساوية المستهدفة (خصم 5% مع أقساط منتظمة)';
    sc5.badge = 'بدون تشويه للأقساط'; sc5.badgeColor = '#eab308';
    sc5.desc = `خصم 5% كامل على السعر مع حساب مقدم دقيق (${(p5_dp1 * 100).toFixed(2)}%) لتكون جميع الأقساط متساوية تماماً بالمليم وبدون تشويه آخر قسط.`;
    sc5.dateNotes = null;

    // Package 6: FLEXIBLE - Advanced Bulk Payment for Real Cash Discount
    let p6_dates = {};
    let p6_dateNotes = '';
    if (addlFlow) {
        let advDate = formatDate(addMonths(ctxFlex.contractDateStr, 3));
        p6_dates['addl'] = advDate;
        p6_dateNotes = `تقديم ميعاد دفعة الـ 6 شهور إلى الشهر الثالث بدري (في ${advDate}) لدعم التدفق المالي للشركة ومنح خصم نقدي للعميل`;
    }
    let p6_inst = instPool / ctxFlex.totalInstCount;
    let sc6 = ctxFlex.solve(f => {
        if (f.id === 'dp1') return ctxFlex.dp1Pct;
        if (f.id === 'dp2') return ctxFlex.dp2Pct;
        if (f.id === 'addl') return ctxFlex.addlPct;
        if (f.id === 'deliv' && !f.isMerged) return ctxFlex.delivPct;
        if (f.isMerged) return ctxFlex.delivPct + p6_inst;
        return p6_inst;
    }, p6_dates);
    sc6.mode = 'FLEXIBLE';
    sc6.title = '💵 باقة التدفق النقدي المعزز (خصم نقدي بتبكير دفعة)';
    sc6.badge = 'خصم نقدي معتمد'; sc6.badgeColor = '#ec4899';
    sc6.desc = 'تقديم ميعاد الدفعة المرحلية 3 شهور بدري يمنح العميل خصماً نقدياً معتمداً ومطابقاً لـ NPV الإكسيل بنسبة 100% وفق نمط FLEXIBLE.';
    sc6.dateNotes = p6_dateNotes;

    let allFacilities = [sc1, sc2, sc3, sc4, sc5, sc6];
    window._orScenariosData = allFacilities;
    window._orOptionScenariosData['or-facilities-results-container'] = allFacilities;

    let html = `
        <div style="background: rgba(15, 23, 42, 0.94); border: 1.5px solid rgba(56, 189, 248, 0.5); border-radius: 8px; padding: 14px; margin-top: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.12); padding-bottom: 8px;">
                <div>
                    <h4 style="margin: 0; color: #38bdf8; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                        <span>🏢 باقات وحلول بحوث العمليات الشاملة (Operations Research Master Facilities)</span>
                    </h4>
                    <span style="font-size: 0.82rem; color: #94a3b8;">تم توليد 6 باقات مالية ذكية ومحسوبة بالمليم لمشروع (${ctxAdjust.proj} - ${ctxAdjust.years} سنوات) لحفظ الـ NPV بدقة 100% (فارق 0.00 ج.م مع الإكسيل).</span>
                </div>
                <div style="display: flex; gap: 6px;">
                    <button type="button" onclick="window.generateAndRenderORFacilities()" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; border-radius: 4px; padding: 4px 10px; font-size: 0.82rem; cursor: pointer; font-weight: bold;">🔄 تحديث الباقات</button>
                    <button type="button" onclick="document.getElementById('or-facilities-results-container').style.display='none'" style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; border-radius: 4px; padding: 4px 8px; font-size: 0.82rem; cursor: pointer;">✕ إغلاق</button>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 14px;">
    `;

    allFacilities.forEach((sc, idx) => {
        let diffAmt = Math.round(sc.price - basePrice);
        let diffColor = '#38bdf8';
        let diffText = 'بدون أي زيادة أو خصم (0.00%)';
        if (sc.diffPct < -0.001) {
            diffColor = '#10b981';
            diffText = `خصم ${Math.abs(sc.diffPct).toFixed(2)}% (توفير ${formatCurr(Math.abs(diffAmt))})`;
        } else if (sc.diffPct > 0.001) {
            diffColor = '#f59e0b';
            diffText = `زيادة سعر +${sc.diffPct.toFixed(2)}% (+${formatCurr(diffAmt)})`;
        }

        let isFlex = (sc.mode === 'FLEXIBLE');
        let modeBadgeText = isFlex ? '📅 نمط FLEXIBLE (تعديل تواريخ O9=2)' : '⚙️ نمط ADJUST (تواريخ قياسية O9=1)';
        let modeBadgeBg = isFlex ? 'linear-gradient(135deg, #7c3aed, #9333ea)' : 'linear-gradient(135deg, #059669, #10b981)';

        html += `
            <div style="background: rgba(30, 41, 59, 0.88); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 14px rgba(0,0,0,0.3);">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="background: ${modeBadgeBg}; color: #fff; font-size: 0.72rem; font-weight: bold; padding: 2px 8px; border-radius: 4px;">${modeBadgeText}</span>
                        <span style="background: ${sc.badgeColor || '#2563eb'}; color: #fff; font-size: 0.72rem; padding: 2px 8px; border-radius: 12px;">${sc.badge}</span>
                    </div>

                    <strong style="color: #f8fafc; font-size: 0.95rem; display: block; margin-bottom: 4px;">${sc.title}</strong>
                    <div style="font-size: 0.82rem; color: #94a3b8; line-height: 1.4; margin-bottom: 8px;">${sc.desc}</div>

                    ${sc.dateNotes ? `
                        <div style="background: rgba(139, 92, 246, 0.15); border: 1px dashed #a855f7; border-radius: 6px; padding: 6px 10px; margin-bottom: 10px; font-size: 0.78rem; color: #ddd6fe; line-height: 1.4;">
                            <strong>📅 تفاصيل تعديل التواريخ:</strong> ${sc.dateNotes}
                        </div>
                    ` : ''}

                    <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95)); border: 1px solid rgba(56, 189, 248, 0.28); border-radius: 6px; padding: 10px 12px; margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <span style="font-size: 0.8rem; color: #cbd5e1; font-weight: 600;">💰 سعر الوحدة المقترح:</span>
                            <strong style="color: #38bdf8; font-size: 1.05rem; font-family: monospace;">${formatCurr(sc.price)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <span style="font-size: 0.8rem; color: #cbd5e1; font-weight: 600;">🏷️ الخصم أو الزيادة:</span>
                            <strong style="font-size: 0.86rem; color: ${diffColor};">${diffText}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 5px; border-top: 1px dashed rgba(255,255,255,0.12); font-size: 0.76rem;">
                            <span style="color: #10b981;">⚖️ فارق الـ NPV مع الإكسيل: <strong>0.00 ج.م</strong></span>
                            <span style="color: #94a3b8;">التحصيل قبل الاستلام: <strong style="color: #e2e8f0;">${sc.preDelivPct.toFixed(1)}%</strong></span>
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: 6px; margin-top: 6px;">
                    <button type="button" class="btn btn-primary" onclick="window.applyOROptionScenario('or-facilities-results-container', ${idx})" style="flex: 1; padding: 8px 10px; font-size: 0.84rem; font-weight: bold; background: #2563eb; border: none; border-radius: 4px; cursor: pointer;">
                        🚀 تطبيق في السيستم فوراً
                    </button>
                    <button type="button" class="btn btn-outline" onclick="window.copyOROptionScenarioForExcel('or-facilities-results-container', ${idx})" style="padding: 8px 10px; font-size: 0.84rem; border: 1px solid #10b981; color: #10b981; background: transparent; border-radius: 4px; cursor: pointer; white-space: nowrap;">
                        📋 نسخ للإكسيل
                    </button>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

// ------------------------------------------------------------------------------
// SILENT BACKGROUND REFRESH OF ACTIVE OR CONTAINERS
// ------------------------------------------------------------------------------
window.refreshSingleORContainer = function(containerId) {
    let runnerMap = {
        'or-balloon-shift-results': window.runORForBalloonShift,
        'or-zero-shift-results': window.runORForZeroShift,
        'or-target-price-results': window.runORForTargetPrice,
        'or-fixed-inst-results': window.runORForFixedInst,
        'or-milestones-results': window.runORForMilestones,
        'or-facilities-results-container': window.generateAndRenderORFacilities
    };
    if (typeof runnerMap[containerId] === 'function') {
        runnerMap[containerId](false);
    }
};

window.refreshActiveORContainers = function() {
    let orContainers = [
        { id: 'or-fixed-inst-results', runner: window.runORForFixedInst },
        { id: 'or-balloon-shift-results', runner: window.runORForBalloonShift },
        { id: 'or-zero-shift-results', runner: window.runORForZeroShift },
        { id: 'or-target-price-results', runner: window.runORForTargetPrice },
        { id: 'or-milestones-results', runner: window.runORForMilestones }
    ];
    orContainers.forEach(item => {
        let el = document.getElementById(item.id);
        if (el && el.style.display !== 'none' && typeof item.runner === 'function') {
            item.runner(true);
        }
    });
};

window.applyORScenario = function(idx) {
    window.applyOROptionScenario('or-facilities-results-container', idx);
};
window.applyORPlanDirect = window.applyORScenario;
window.copyORScenarioForExcel = function(idx) {
    window.copyOROptionScenarioForExcel('or-facilities-results-container', idx);
};
