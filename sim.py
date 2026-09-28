import math
from datetime import datetime
from dateutil.relativedelta import relativedelta

def addMonths(d, months):
    return d + relativedelta(months=months)

def getRateForYear(y):
    if y <= 1: return 0.20
    if y <= 2: return 0.20
    if y <= 3: return 0.20
    if y <= 4: return 0.19
    if y <= 5: return 0.18
    if y <= 6: return 0.17
    if y <= 7: return 0.16
    if y <= 8: return 0.16
    if y <= 9: return 0.15
    return 0.15

def getPeriod(months):
    if months <= 6: return 1
    if months <= 12: return 2
    if months <= 24: return 3
    if months <= 36: return 4
    if months <= 48: return 5
    if months <= 60: return 6
    if months <= 72: return 7
    if months <= 84: return 8
    if months <= 96: return 9
    if months <= 108: return 10
    if months <= 120: return 11
    if months <= 132: return 12
    return 13

def generateTemplate(project, freqMonths, years):
    flows = []
    cDate = datetime(2026, 9, 19)
    totalMonths = years * 12
    
    if project == 'Zomra':
        flows.append({'id': 'dp1', 'months': 0, 'isDP': True, 'pct': 0.025})
        flows.append({'id': 'dp2', 'months': 1, 'isDP': True, 'pct': 0.025})
        flows.append({'id': 'addl', 'months': 6, 'isDP': True, 'pct': 0.05})
        flows.append({'id': 'deliv', 'months': 37, 'isDP': True, 'pct': 0.05})
        flows.append({'id': 'mnt1', 'months': 25, 'isMnt': True})
        flows.append({'id': 'mnt2', 'months': 37, 'isMnt': True})
        numInst = years * (12 // freqMonths)
        startMonth = 4
        for i in range(numInst):
            m = startMonth + i * freqMonths
            flows.append({'id': f'inst_{i}', 'months': m, 'isInst': True})
    else: # Perla
        flows.append({'id': 'dp1', 'months': 0, 'isDP': True, 'pct': 0.05})
        flows.append({'id': 'dp2', 'months': 3, 'isDP': True, 'pct': 0.05})
        flows.append({'id': 'deliv', 'months': 48, 'isDP': True, 'pct': 0.05})
        flows.append({'id': 'mnt1', 'months': 36, 'isMnt': True})
        flows.append({'id': 'mnt2', 'months': 48, 'isMnt': True})
        startMonth = 3 + freqMonths
        curMonth = startMonth
        instList = []
        while curMonth <= totalMonths:
            instList.append(curMonth)
            curMonth += freqMonths
        if freqMonths == 6 and len(instList) > 0 and instList[-1] > totalMonths - 3:
            instList.pop()
        for i, m in enumerate(instList):
            flows.append({'id': f'inst_{i}', 'months': m, 'isInst': True})
            
    return flows

def applyDiscount(flow, contractDate):
    m = flow['months']
    period = getPeriod(m)
    y = period - 1
    rate = getRateForYear(y)
    
    dateStr = addMonths(contractDate, m)
    diffDays = (dateStr - contractDate).days
    
    factor = 1.0 / ((1.0 + rate) ** (diffDays / 365.0))
    flow['pv'] = flow['amount'] * factor

def calculateBaseFlows(price, template):
    flows = []
    contractDate = datetime(2026, 9, 19)
    insts = [f for f in template if f.get('isInst')]
    remAmt = price
    for f in template:
        new_f = dict(f)
        if new_f.get('isMnt'):
            new_f['amount'] = price * 0.04
        elif new_f.get('isDP'):
            new_f['amount'] = price * new_f['pct']
            remAmt -= new_f['amount']
        flows.append(new_f)
    
    instAmt = remAmt / len(insts)
    for f in flows:
        if f.get('isInst'):
            f['amount'] = instAmt
    
    for f in flows:
        applyDiscount(f, contractDate)
    
    return flows

def solveForPrice(basePv, template):
    low = 0
    high = 10000000
    bestPrice = 1000000
    for _ in range(50):
        mid = (low + high) / 2.0
        testPv = 0
        tempFlows = calculateBaseFlows(mid, template) # custom and base flow amounts are identical when no overrides are used!
        for f in tempFlows:
            if not f.get('isMnt'):
                testPv += f['pv']
        if testPv > basePv:
            high = mid
        else:
            low = mid
        bestPrice = mid
    return bestPrice

def testProject(project, years, freqMonths):
    baseTemplate = generateTemplate(project, 8, freqMonths)
    baseFlows = calculateBaseFlows(1000000, baseTemplate)
    basePv = sum(f['pv'] for f in baseFlows if not f.get('isMnt'))
    
    customTemplate = generateTemplate(project, years, freqMonths)
    customPrice = solveForPrice(basePv, customTemplate)
    
    pct = ((customPrice - 1000000) / 1000000) * 100.0
    print(f"{project} {years}Y Freq={freqMonths}M: {pct:.10f}%")

testProject('Zomra', 10, 3)
testProject('Perla', 10, 3)
testProject('Zomra', 10, 6)
testProject('Perla', 10, 6)
