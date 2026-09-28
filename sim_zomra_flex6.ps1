$basePrice = 1000000

function getPv($amt, $months) {
    $diffDays = $months * 30.4166667
    $r = 0
    if ($diffDays -lt 54) { $r = 0.19 }
    elseif ($diffDays -lt 419) { $r = 0.18 }
    elseif ($diffDays -lt 784) { $r = 0.15 }
    elseif ($diffDays -lt 1149) { $r = 0.13 }
    elseif ($diffDays -lt 1514) { $r = 0.10 }
    elseif ($diffDays -lt 1879) { $r = 0.10 }
    else { $r = 0.09 }
    
    return $amt / [math]::Pow(1 + $r / 365.0, $diffDays)
}

# Base: 5% DP, 5% Addl(M6), 5% Deliv(M36)
$basePv = getPv ($basePrice * 0.05) 0
$basePv += getPv ($basePrice * 0.05) 6
$basePv += getPv ($basePrice * 0.05) 36

$remAmt = $basePrice - ($basePrice * 0.15)
$instAmt = $remAmt / 40

for ($i = 0; $i -lt 40; $i++) {
    $m = 3 + $i * 3
    $basePv += getPv $instAmt $m
}

function calcCustomPv($testPrice) {
    $testPv = getPv ($testPrice * 0.10) 0
    $rem = $testPrice - ($testPrice * 0.10)
    for ($i = 0; $i -lt 40; $i++) {
        $m = 3 + $i * 3
        $testPv += getPv ($rem / 40) $m
    }
    return $testPv
}

$low = 0
$high = 100000000
$bestPrice = 0
for ($i = 0; $i -lt 100; $i++) {
    $mid = ($low + $high) / 2
    $testPv = calcCustomPv $mid
    if ($testPv -gt $basePv) {
        $high = $mid
    } else {
        $low = $mid
    }
    $bestPrice = $mid
}
$pct = (($bestPrice - $basePrice) / $basePrice) * 100
Write-Output "DP1=10% vs Base 5%, 5%, 5%: $pct %"

