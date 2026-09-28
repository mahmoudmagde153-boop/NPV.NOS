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
    # Let's try continuous daily discounting or monthly. Let's just use monthly 1.18^(months/12) as a proxy for Sheet1.
    # Wait, the sheet Sheet1 might use (1+rate)^(months/12)
    return $amt / [math]::Pow(1 + $rate, ($months / 12.0))
}

# Base: Ramadan Offer (2.5%, 2.5%, 5%, 5%)
$basePv = getPv ($basePrice * 0.025) 0
$basePv += getPv ($basePrice * 0.025) 1
$basePv += getPv ($basePrice * 0.05) 6
$basePv += getPv ($basePrice * 0.05) 36

$remAmt = $basePrice - ($basePrice * 0.15)
$instAmt = $remAmt / 40

for ($i = 0; $i -lt 40; $i++) {
    $m = 3 + $i * 3
    $basePv += getPv $instAmt $m
}

function calcCustomPv($testPrice) {
    # Custom: 10% DP, the rest over 40 installments (Flexible 10% for 10 years)
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
Write-Output "DP1=10% vs Base 2.5%,2.5%,5%,5%: $pct %"

# What if Base is 5%, 5% (Profile 9) ?
$basePv2 = getPv ($basePrice * 0.05) 0
$basePv2 += getPv ($basePrice * 0.05) 3 # let's say month 3
$remAmt2 = $basePrice - ($basePrice * 0.10)
for ($i = 0; $i -lt 40; $i++) {
    $m = 3 + $i * 3
    $basePv2 += getPv ($remAmt2 / 40) $m
}

$low = 0
$high = 100000000
$bestPrice = 0
for ($i = 0; $i -lt 100; $i++) {
    $mid = ($low + $high) / 2
    $testPv = calcCustomPv $mid
    if ($testPv -gt $basePv2) {
        $high = $mid
    } else {
        $low = $mid
    }
    $bestPrice = $mid
}
$pct = (($bestPrice - $basePrice) / $basePrice) * 100
Write-Output "DP1=10% vs Base 5%, 5%: $pct %"

