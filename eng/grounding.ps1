#!/usr/bin/env pwsh
# Launcher for the C# `grounding` CLI (PowerShell Core; mirrors eng/grounding).
# Incrementally builds (Release) and forwards all arguments.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dll = Join-Path $root 'src/grounding/bin/Release/net11.0/grounding.dll'
dotnet build (Join-Path $root 'src/grounding') -c Release --nologo --verbosity quiet | Out-Null
dotnet $dll @args
