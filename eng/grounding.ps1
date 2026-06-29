#!/usr/bin/env pwsh
# Launcher for the C# `grounding` CLI (PowerShell Core; mirrors eng/grounding).
# Builds once (Release) and forwards all arguments.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dll = Join-Path $root 'src/grounding/bin/Release/net11.0/grounding.dll'
if (-not (Test-Path $dll)) {
    dotnet build (Join-Path $root 'src/grounding') -c Release | Out-Null
}
dotnet $dll @args
