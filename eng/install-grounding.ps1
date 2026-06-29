#!/usr/bin/env pwsh
# Publish the Native AOT `grounding` binary and install it on PATH (mirrors eng/install-grounding.sh)
# so it runs without `dotnet`. Optional arg: the runtime identifier (RID).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$rid = if ($args.Count -ge 1) { $args[0] } else {
    $os = if ($IsWindows) { 'win' } elseif ($IsMacOS) { 'osx' } else { 'linux' }
    $arch = ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture).ToString().ToLower()
    if ($arch -eq 'x64') { } elseif ($arch -eq 'arm64') { } else { $arch = 'x64' }
    "$os-$arch"
}
$dest = if ($env:DOTNET_TOOLS) { $env:DOTNET_TOOLS } else { Join-Path $HOME '.dotnet/tools' }
$ext = if ($IsWindows) { '.exe' } else { '' }

Write-Host "Publishing Native AOT for $rid ..."
dotnet publish (Join-Path $root 'src/grounding/grounding.csproj') -c Release -r $rid | Out-Null
$bin = Join-Path $root "src/grounding/bin/Release/net11.0/$rid/publish/grounding$ext"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item $bin (Join-Path $dest "grounding$ext") -Force
Write-Host "Installed native grounding -> $(Join-Path $dest "grounding$ext")"
& (Join-Path $dest "grounding$ext") --version
