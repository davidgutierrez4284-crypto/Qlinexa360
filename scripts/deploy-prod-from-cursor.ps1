# Alias retrocompatible — usar deploy-prod.ps1
# From repo root: .\scripts\deploy-prod-from-cursor.ps1 [-RunPrismaMigrate] [-Force] ...

param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipEcsUpdate,
    [switch]$RunPrismaMigrate,
    [switch]$Force
)

$argsList = @()
if ($SkipBackend) { $argsList += "-SkipBackend" }
if ($SkipFrontend) { $argsList += "-SkipFrontend" }
if ($SkipEcsUpdate) { $argsList += "-SkipEcsUpdate" }
if ($RunPrismaMigrate) { $argsList += "-RunPrismaMigrateLocal" }
if ($Force) { $argsList += "-Force" }

& (Join-Path $PSScriptRoot "deploy-prod.ps1") @argsList
