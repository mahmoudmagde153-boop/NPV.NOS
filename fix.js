const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

// I will just replace the entire generateFlowsTemplate function body
let regex = /function generateFlowsTemplate\(contractDateStr, years, freqMonths, isBase = false\) \{([\s\S]*?)function calculateCustomFlows/g;
let newBody = `function generateFlowsTemplate(contractDateStr, years, freqMonths, isBase = false) {
    let flows = [];
    let totalMonths = years * 12;
    
    // Check for overridden installment count
    let overrideEl = document.getElementById(isBase ? 'base-inst-count' : 'custom-inst-count');
    let overrideInstCount = (overrideEl && overrideEl.value) ? parseInt(overrideEl.value) : null;
    
    // Check for overridden percentages (if empty, fallback to defaults)
    let getOverridePct = (id, def) => {
        let el = document.getElementById(isBase ? 'base-'+id : id+'-val');
        if (el && el.value) {
            let typeEl = document.getElementById(isBase ? 'base-'+id+'-type' : id+'-type');
            if (!typeEl || typeEl.value === 'pct') {
                return parseFloat(el.value) / 100;
            }
        }
        return def;
    };
    
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
        
        let numInst = overrideInstCount !== null && overrideInstCount !== "" ? parseInt(overrideInstCount) : (years * (12 / freqMonths));
        for (let i = 0; i < numInst; i++) {
            let m = 4 + i * freqMonths;
            let dStr = formatDate(addMonths(contractDateStr, m));
            flows.push({ id: \`inst_\${i}\`, label: 'Installment ' + (i+1), date: dStr, months: m, isInst: true });
            
            // Add Annual Bonus if this is the end-of-year installment
            if ((i + 1) % (12 / freqMonths) === 0) {
                let yr = (i + 1) / (12 / freqMonths);
                flows.push({ id: \`annual_\${yr}\`, label: \`Annual Bonus Yr \${yr}\`, date: dStr, months: m, isAnnual: true, defaultPct: getOverridePct('annual', 0) });
            }
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
        
        let curMonth = 3 + freqMonths; // 6 (Quarterly) or 9 (Semi-annual)
        let instList = [];
        
        if (numInst !== null) {
            for (let i=0; i<numInst; i++) {
                instList.push(curMonth);
                curMonth += freqMonths;
            }
        } else {
            while (curMonth <= totalMonths) { instList.push(curMonth); curMonth += freqMonths; }
            if (freqMonths === 6 && instList.length > 0 && instList[instList.length-1] > totalMonths - 3) instList.pop(); 
        }
        
        instList.forEach((m, i) => {
            let dStr = formatDate(addMonths(contractDateStr, m));
            flows.push({ id: \`inst_\${i}\`, label: 'Installment ' + (i+1), date: dStr, months: m, isInst: true });
            
            // Add Annual Bonus if this is the end-of-year installment
            if ((i + 1) % (12 / freqMonths) === 0) {
                let yr = (i + 1) / (12 / freqMonths);
                flows.push({ id: \`annual_\${yr}\`, label: \`Annual Bonus Yr \${yr}\`, date: dStr, months: m, isAnnual: true, defaultPct: getOverridePct('annual', 0) });
            }
        });
    }
    
    let mergedFlows = [];
    let shouldMerge = document.getElementById('merge-delivery-toggle') ? document.getElementById('merge-delivery-toggle').checked : true;
    if (shouldMerge) {
        let instsByDate = {};
        flows.forEach(f => {
            if (f.isInst || f.isDP) {
                if (!instsByDate[f.date]) instsByDate[f.date] = [];
                instsByDate[f.date].push(f);
            }
        });
        let processedIds = new Set();
        flows.forEach(f => {
            if (processedIds.has(f.id)) return;
            if (f.id === 'deliv') {
                if (instsByDate[f.date] && instsByDate[f.date].length > 0) {
                    let match = instsByDate[f.date][0];
                    let mergedId = f.id + '_' + match.id;
                    mergedFlows.push({
                        id: mergedId,
                        label: 'Delivery + ' + match.label,
                        date: f.date,
                        months: f.months,
                        isMerged: true,
                        mergedIds: [f.id, match.id]
                    });
                    processedIds.add(f.id);
                    processedIds.add(match.id);
                } else {
                    mergedFlows.push(f);
                }
            } else if (!processedIds.has(f.id)) {
                mergedFlows.push(f);
            }
        });
    } else {
        mergedFlows = flows;
    }
    
    // Only return the ones up to max months if there's no override
    return mergedFlows;
}

function calculateCustomFlows`;
content = content.replace(regex, newBody);
fs.writeFileSync('app.js', content, 'utf8');
