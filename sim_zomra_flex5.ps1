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
    return $amt / [math]::Pow(1 + $rate, ($months / 12.0))
}

$basePv = getPv ($basePrice * 0.025) 0
$basePv += getPv ($basePrice * 0.025) 1
$basePv += getPv ($basePrice * 0.05) 6
$basePv += getPv ($basePrice * 0.05) 36
$remAmt = $basePrice - ($basePrice * 0.15)
for ($i = 0; $i -lt 40; $i++) {
    $m = 3 + $i * 3
    $basePv += getPv ($remAmt / 40) $m
}

function calcCustomPv($testPrice) {
    $testPv = 0
    $rem = $testPrice
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
Write-Output "DP1=0% vs Base 2.5%,2.5%,5%,5%: $pct %"
