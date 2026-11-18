$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
  & pnpm build
  if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
  & pnpm exec cap sync android
  if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed' }
  $jdk = Get-ChildItem "$projectRoot/.local/toolchains/jdk" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($jdk) { $env:JAVA_HOME = $jdk.FullName }
  # Keep the preview signing identity independent of ANDROID_USER_HOME and shell environment.
  $signingKey = "$projectRoot/.local/signing/debug.keystore"
  if (!(Test-Path -LiteralPath $signingKey)) {
    New-Item -ItemType Directory -Force (Split-Path $signingKey) | Out-Null
    $existingDebugKey = Join-Path $env:USERPROFILE '.android/debug.keystore'
    if (Test-Path -LiteralPath $existingDebugKey) {
      Copy-Item -LiteralPath $existingDebugKey -Destination $signingKey
    } else {
      & "$env:JAVA_HOME/bin/keytool.exe" -genkeypair -keystore $signingKey -storepass android -alias androiddebugkey -keypass android -dname 'CN=Android Debug,O=Android,C=US' -keyalg RSA -keysize 2048 -validity 10000
      if ($LASTEXITCODE -ne 0) { throw 'Preview signing key creation failed' }
    }
  }
  $localSdk = "$projectRoot/.local/toolchains/android-sdk"
  if (Test-Path "$localSdk/platforms") { $env:ANDROID_HOME = $localSdk }
  $env:GRADLE_USER_HOME = "$projectRoot/.local/gradle"
  $gradle = "$projectRoot/.local/toolchains/gradle/gradle-8.14.3/bin/gradle.bat"
  if (!(Test-Path $gradle)) { $gradle = "$projectRoot/android/gradlew.bat" }
  Push-Location "$projectRoot/android"
  try { & $gradle assembleDebug --no-daemon --console=plain; if ($LASTEXITCODE -ne 0) { throw 'Android build failed' } }
  finally { Pop-Location }
  New-Item -ItemType Directory -Force "$projectRoot/artifacts" | Out-Null
  Copy-Item -LiteralPath "$projectRoot/android/app/build/outputs/apk/debug/app-debug.apk" -Destination "$projectRoot/artifacts/seeeekon-android-preview.apk"
  (Get-FileHash "$projectRoot/artifacts/seeeekon-android-preview.apk" -Algorithm SHA256).Hash | Set-Content "$projectRoot/artifacts/seeeekon-android-preview.sha256"
  Write-Host 'APK: artifacts/seeeekon-android-preview.apk'
} finally { Pop-Location }
