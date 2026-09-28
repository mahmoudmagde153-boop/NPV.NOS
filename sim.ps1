$basePrice = 1000000

function getZomraRate($diffDays) {
    if ($diffDays -lt 54) { return 0.19 }
    if ($diffDays -lt 419) { return 0.18 }
    if ($diffDays -lt 784) { return 0.15 }
    if ($diffDays -lt 1149) { return 0.13 }
    if ($diffDays -lt 1879) { return 0.10 }
    return 0.09
}

$contractDate = Get-Date -Year 2026 -Month 9 -Day 19
$totalMonths = 96
$freqMonths = 3

$baseFlows = @()
$baseFlows += @{ id='dp1'; months=0; amount=$basePrice * 0.05 }
$baseFlows += @{ id='addl'; months=6; amount=$basePrice * 0.05 }
$baseFlows += @{ id='deliv'; months=37; amount=$basePrice * 0.05 }

$instList = @()
for ($i = 0; $i -lt 32; $i++) {
    $instList += (3 + $i * 3)
}

$remAmt = $basePrice - ($basePrice * 0.15)
$instAmt = $remAmt / $instList.Length
foreach ($m in $instList) { $baseFlows += @{ id='inst'; months=$m; amount=$instAmt } }

$basePv = 0
foreach ($f in $baseFlows) {
    if ($f.id -eq 'dp1' -or $f.id -eq 'dp2') {
        $basePv += $f.amount
    } elseif ($f.id -eq 'addl') {
        $d = $contractDate.AddMonths($f.months)
        $diffDays = ($d - $contractDate).Days
        $r = getZomraRate $diffDays
        $basePv += $f.amount / [Math]::Pow(1.0 + $r, $diffDays / 365.0)
    } else {
        $d = $contractDate.AddMonths($f.months)
        $monthsDiff = ($d.Year - $contractDate.Year) * 12 + $d.Month - $contractDate.Month
        if ($d.Day -lt $contractDate.Day -and $d.Day -lt 28) { $monthsDiff-- }
        $y = [Math]::Floor($monthsDiff / 12)
        $ratesMap = @{0=0.18; 1=0.15; 2=0.13; 3=0.10; 4=0.10; 5=0.09; 6=0.09; 7=0.09; 8=0.09; 9=0.09; 10=0.09}
        $r = 0.09; if ($ratesMap.ContainsKey($y)) { $r = $ratesMap[$y] }
        $diffDays = ($d - $contractDate).Days
        $basePv += $f.amount / [Math]::Pow(1.0 + $r, $diffDays / 365.0)
    }
}

    $customInstList = @()
    for ($i = 0; $i -lt 40; $i++) {
        $customInstList += (3 + $i * 3)
    }

function calcCustomPv($testPrice) {
    $testPv = 0
    $customFlows = @()
    $customFlows += @{ id='dp1'; months=0; amount=$testPrice * 0.05 }
    $customFlows += @{ id='addl'; months=6; amount=$testPrice * 0.05 }
    $customFlows += @{ id='deliv'; months=37; amount=$testPrice * 0.05 }
    
    $rem = $testPrice - ($testPrice * 0.15)
    $cInstAmt = $rem / $customInstList.Length
    foreach ($m in $customInstList) { $customFlows += @{ id='inst'; months=$m; amount=$cInstAmt } }
    
    foreach ($f in $customFlows) {
        if ($f.id -eq 'dp1' -or $f.id -eq 'dp2') {
            $testPv += $f.amount
        } elseif ($f.id -eq 'addl') {
            $d = $contractDate.AddMonths($f.months)
            $diffDays = ($d - $contractDate).Days
            $r = getZomraRate $diffDays
            $testPv += $f.amount / [Math]::Pow(1.0 + $r, $diffDays / 365.0)
        } else {
            $d = $contractDate.AddMonths($f.months)
            $monthsDiff = ($d.Year - $contractDate.Year) * 12 + $d.Month - $contractDate.Month
            if ($d.Day -lt $contractDate.Day -and $d.Day -lt 28) { $monthsDiff-- }
            $y = [Math]::Floor($monthsDiff / 12)
            $ratesMap = @{0=0.18; 1=0.15; 2=0.13; 3=0.10; 4=0.10; 5=0.09; 6=0.09; 7=0.09; 8=0.09; 9=0.09; 10=0.09}
            $r = 0.09; if ($ratesMap.ContainsKey($y)) { $r = $ratesMap[$y] }
            $diffDays = ($d - $contractDate).Days
            $testPv += $f.amount / [Math]::Pow(1.0 + $r, $diffDays / 365.0)
        }
    }
    return $testPv
}

$low = 0
$high = 10000000
$bestPrice = 1000000
for ($i = 0; $i -lt 50; $i++) {
    $mid = ($low + $high) / 2.0
    $testPv = calcCustomPv $mid
    if ($testPv -gt $basePv) { $high = $mid } else { $low = $mid }
    $bestPrice = $mid
}

$pct = (($bestPrice - $basePrice) / $basePrice) * 100.0
Write-Host "Zomra 10Y Quarterly 15% DPs: $pct %"
