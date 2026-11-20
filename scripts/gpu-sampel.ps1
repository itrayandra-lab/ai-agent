# Rata-rata pemakaian GPU 3D seluruh mesin selama 3 detik (persen). Dipakai ukur-beban.mjs.
try {
  $v = @(); 1..3 | ForEach-Object { $c = (Get-Counter '\GPU Engine(*engtype_3D)\Utilization Percentage' -ErrorAction Stop).CounterSamples; $v += ($c | Measure-Object CookedValue -Sum).Sum; Start-Sleep -Milliseconds 700 }
  [Math]::Round(($v | Measure-Object -Average).Average)
} catch { 'NaN' }
