$basePrice = 13685172
$targetPrice = 14492777

function getZomraRate($months) {
    $year = [math]::Floor($months / 12)
    if ($year -eq 0 -or $year -eq 1) { return 0.18 }
    if ($year -eq 2) { return 0.15 }
    if ($year -eq 3) { return 0.13 }
    if ($year -eq 4) { return 0.10 }
    return 0.09
}

$pv = ($targetPrice * 0.05) # DP
$remAmt = $targetPrice - ($targetPrice * 0.15)
$instAmt = $remAmt / 40

for ($i = 0; $i -lt 40; $i++) {
    $m = 3 + $i * 3
    $amt = $instAmt
    if ($m -eq 6 -or $m -eq 36) {
        $amt += ($targetPrice * 0.05)
    }
    $rate = getZomraRate $m
    $pv += $amt / [math]::Pow(1 + $rate, ($m / 12.0))
}

Write-Output "Calculated PV: $pv"
Write-Output "Expected PV: $basePrice"
$ratio = $pv / $basePrice
Write-Output "Ratio: $ratio"
