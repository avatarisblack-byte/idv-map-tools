# 生成 data/*.json：从汇总 JSON + 源码 txt + 底图 PNG 抽取每张地图的完整结构化数据
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = 'D:\@VibeCoding\idv-code-machine-tools'
$summaryPath = Join-Path $root 'codemachine_Distribution\output\_所有地图密码机汇总.json'
$summary = Get-Content $summaryPath -Raw -Encoding UTF8 | ConvertFrom-Json

$dataDir = Join-Path $root 'data'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

$maps = @($summary.PSObject.Properties.Name)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

foreach ($map in $maps) {
    $groups = $summary.$map   # 数组：{ group, points:[{x,y}] }

    # --- 构建唯一点位（按跨组首次出现的顺序编号 p1..pN） ---
    $pointList = New-Object System.Collections.Generic.List[object]
    $idMap = @{}
    $idx = 0
    $presets = New-Object System.Collections.Generic.List[object]
    $gIdx = 0

    foreach ($g in $groups) {
        $gIdx++
        $presetPoints = New-Object System.Collections.Generic.List[string]
        foreach ($pt in $g.points) {
            $x = [double]$pt.x
            $y = [double]$pt.y
            $key = ('{0:0.##}|{1:0.##}' -f $x, $y)
            if (-not $idMap.ContainsKey($key)) {
                $idx++
                $pointId = 'p' + $idx
                $idMap[$key] = $pointId
                $pointList.Add([pscustomobject]@{ id = $pointId; name = ('点位' + $idx); x = $x; y = $y })
            }
            $presetPoints.Add($idMap[$key])
        }
        $presets.Add([pscustomobject]@{ id = ('group' + $gIdx); name = $g.group; points = $presetPoints })
    }

    # --- 底图远程 URL（「无名称点」分组） ---
    $txtPath = Join-Path $root ('codemachine_Distribution\maps_input\' + $map + '.txt')
    $bgRemote = ''
    if (Test-Path $txtPath) {
        $raw = Get-Content $txtPath -Raw -Encoding UTF8
        $m = [regex]::Match($raw, '"无名称点"[^}]*?"bgImage":"([^"]+)"')
        if ($m.Success) { $bgRemote = $m.Groups[1].Value }
    }

    # --- 底图尺寸 ---
    $pngPath = Join-Path $root ('map_pic\' + $map + '_基本信息_无名称点.png')
    $w = 0; $h = 0
    if (Test-Path $pngPath) {
        $img = [System.Drawing.Image]::FromFile($pngPath)
        $w = $img.Width; $h = $img.Height
        $img.Dispose()
    }

    $obj = [ordered]@{
        mapName       = $map
        bgImage       = ('map_pic/' + $map + '_基本信息_无名称点.png')
        bgImageRemote = $bgRemote
        aspectW       = $w
        aspectH       = $h
        allPoints     = $pointList
        presets       = $presets
    }

    $json = $obj | ConvertTo-Json -Depth 8
    $outPath = Join-Path $dataDir ($map + '.json')
    [System.IO.File]::WriteAllText($outPath, $json, $utf8NoBom)

    Write-Output ("{0}: points={1} groups={2} size={3}x{4} remote={5}" -f $map, $pointList.Count, $presets.Count, $w, $h, ($bgRemote -ne ''))
}

Write-Output "DONE -> $dataDir"
