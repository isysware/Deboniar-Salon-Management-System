$timestamp = (Get-Date).ToString("yyyy-MM-ddTHH-mm-ss")
$targetDir = "deployment-builds/$timestamp"
New-Item -ItemType Directory -Force -Path "$targetDir/frontend" | Out-Null
New-Item -ItemType Directory -Force -Path "$targetDir/backend" | Out-Null

Write-Host "Copying frontend dist..."
Copy-Item -Path "frontend/dist/*" -Destination "$targetDir/frontend" -Recurse -Force

Write-Host "Copying backend runtime files..."
Copy-Item -Path "backend/src" -Destination "$targetDir/backend" -Recurse -Force
Copy-Item -Path "backend/prisma" -Destination "$targetDir/backend" -Recurse -Force
Copy-Item -Path "backend/scripts" -Destination "$targetDir/backend" -Recurse -Force
Copy-Item -Path "backend/package.json" -Destination "$targetDir/backend" -Force
Copy-Item -Path "backend/package-lock.json" -Destination "$targetDir/backend" -Force

Write-Host "Compressing frontend..."
Compress-Archive -Path "$targetDir/frontend/*" -DestinationPath "$targetDir/frontend-build.zip" -Force

Write-Host "Compressing backend..."
Compress-Archive -Path "$targetDir/backend/*" -DestinationPath "$targetDir/backend-build.zip" -Force

Write-Host "Updating deployment-builds root zips..."
Copy-Item -Path "$targetDir/frontend-build.zip" -Destination "deployment-builds/frontend-build.zip" -Force
Copy-Item -Path "$targetDir/backend-build.zip" -Destination "deployment-builds/backend-build.zip" -Force

Set-Content -Path "deployment-builds/latest-build-path.txt" -Value "deployment-builds/$timestamp"
Write-Host "BUILD_PACKAGED_SUCCESSFULLY: $targetDir"
