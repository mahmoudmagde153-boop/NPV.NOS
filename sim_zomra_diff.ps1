$basePrice = 1000000

function getPv($amt, $diffDays) {
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

# Base: 2.5%, 2.5%, 5%, 5%
$basePv = getPv ($basePrice * 0.025) 0
$basePv += getPv ($basePrice * 0.025) 30
$basePv += getPv ($basePrice * 0.05) 182
$basePv += getPv ($basePrice * 0.05) 1126
$remAmt = $basePrice - ($basePrice * 0.15)
for ($i = 0; $i -lt 40; $i++) {
    $m = 3 + $i * 3
    $basePv += getPv ($remAmt / 40) ($m * 30.4167)
}

# Assume custom is "10 Years" flexible. No DP overrides?
# The user said "???? ????? ???? ??? ??????? ???? ????? 5.976%"
# What if custom is 0% DP, all installments?
function calcCustomPv($testPrice) {
    $testPv = 0
    $rem = $testPrice
    for ($i = 0; $i -lt 40; $i++) {
        $m = 3 + $i * 3
        $testPv += getPv ($rem / 40) ($m * 30.4167)
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
Write-Output "DP=0%: $pct %"

function calcCustomPv2($testPrice) {
    $testPv = getPv ($testPrice * 0.10) 0
    $rem = $testPrice - ($testPrice * 0.10)
    for ($i = 0; $i -lt 40; $i++) {
        $m = 3 + $i * 3
        $testPv += getPv ($rem / 40) ($m * 30.4167)
    }
    return $testPv
}
$low = 0
$high = 100000000
$bestPrice = 0
for ($i = 0; $i -lt 100; $i++) {
    $mid = ($low + $high) / 2
    $testPv = calcCustomPv2 $mid
    if ($testPv -gt $basePv) {
        $high = $mid
    } else {
        $low = $mid
    }
    $bestPrice = $mid
}
$pct = (($bestPrice - $basePrice) / $basePrice) * 100
Write-Output "DP=10%: $pct %"
