$ErrorActionPreference = "Stop"

Write-Host "Starting Rasa Server..."
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd bot; $env:PYTHONIOENCODING='utf-8'; ..\.venv\Scripts\rasa run --enable-api --cors '*'" -WindowStyle Minimized

Write-Host "Waiting a few seconds for Rasa to start..."
Start-Sleep -Seconds 5

Write-Host "Starting Vosk Voice & WebSocket Server..."
.\.venv\Scripts\python.exe .\vosk_server.py
