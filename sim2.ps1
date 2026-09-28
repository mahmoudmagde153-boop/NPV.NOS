$basePrice = 13685172

$instList = @()
for ($i = 0; $i -lt 32; $i++) {
    $instList += (3 + $i * 3)
}

$remAmt = $basePrice - ($basePrice * 0.15)
$basePv = $basePrice * 0.10

function getPv($amt, $months) {
    return $amt / [math]::Pow(1.20, ($months / 12.0))
}

$basePv += getPv ($basePrice * 0.05) 37

foreach ($m in $instList) {
    $basePv += getPv ($remAmt / 32) $m
}

$customInstList = @()
for ($i = 0; $i -lt 40; $i++) {
    $customInstList += (3 + $i * 3)
}

function calcCustomPv($testPrice) {
    $testPv = ($testPrice * 0.025)
    $testPv += getPv ($testPrice * 0.025) 1
    $testPv += getPv ($testPrice * 0.05) 6
    $testPv += getPv ($testPrice * 0.05) 37
    $rem = $testPrice - ($testPrice * 0.15)
    foreach ($m in $customInstList) {
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
Write-Output "Perla Logic for Zomra: $pct %"
