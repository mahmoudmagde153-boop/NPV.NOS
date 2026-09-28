$basePrice = 13685172
$targetPrice = 14492777

function calcPv($rate) {
    $pv = ($targetPrice * 0.05) # DP
    $remAmt = $targetPrice - ($targetPrice * 0.15)
    $instAmt = $remAmt / 40

    for ($i = 0; $i -lt 40; $i++) {
        $m = 3 + $i * 3
        $amt = $instAmt
        if ($m -eq 6 -or $m -eq 36) {
            $amt += ($targetPrice * 0.05)
        }
        $pv += $amt / [math]::Pow(1 + $rate, ($m / 12.0))
    }
    return $pv
}

$low = 0.0
$high = 1.0
$bestRate = 0
for ($i = 0; $i -lt 100; $i++) {
    $mid = ($low + $high) / 2
    $pv = calcPv $mid
    if ($pv -gt $basePrice) {
        $low = $mid
    } else {
        $high = $mid
    }
    $bestRate = $mid
}

Write-Output "Implied Rate: $bestRate"
