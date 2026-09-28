$basePrice = 1000000

function getZomraRate($months) {
    $year = [math]::Floor($months / 12) + 1
    if ($year -eq 1) { return 0.18 }
    if ($year -eq 2) { return 0.15 }
    if ($year -eq 3) { return 0.13 }
    if ($year -eq 4) { return 0.10 }
    if ($year -eq 5) { return 0.10 }
    return 0.09
}

function getPv($amt, $months) {
    $rate = getZomraRate $months
    # Quarterly compounding
    $quarters = $months / 3.0
    return $amt / [math]::Pow(1 + $rate / 4.0, $quarters)
}

# Base Ramadan Offer
$basePv = getPv ($basePrice * 0.025) 0
$basePv += ($basePrice * 0.025) / [math]::Pow(1 + 0.18 / 12.0, 1) # Monthly compounding for 1 month? Let's just use 1/3 of a quarter
$basePv += getPv ($basePrice * 0.05) 6
$basePv += getPv ($basePrice * 0.05) 36

$remAmt = $basePrice - ($basePrice * 0.15)
$instAmt = $remAmt / 40

for ($i = 0; $i -lt 40; $i++) {
    $m = 3 + $i * 3
    $basePv += getPv $instAmt $m
}

function calcCustomPv($testPrice) {
    # Custom: 10% DP, the rest over 40 installments
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
Write-Output "DP1=10%: $pct %"

