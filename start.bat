@echo off
echo Starting AEGIS Mission Control Integration...
echo.

:: Start Backend
echo Initializing Python Backend (FastAPI)...
start cmd /k "cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000"

:: Wait for backend to start
timeout /t 5 /nobreak > nul

:: Start Frontend (Assume current dir or 'frontend' subdir)
if exist "frontend" (
    echo Entering frontend directory...
    start cmd /k "cd frontend && npm install && npm run dev"
) else (
    echo Running frontend in current directory...
    start cmd /k "npm install && npm run dev"
)

echo.
echo ══════════════════════════════════════════════════════════════
echo AEGIS IS STARTING:
echo Frontend:  http://localhost:5173
echo Backend:   http://localhost:8000
echo WebSocket: ws://localhost:8000/ws
echo ══════════════════════════════════════════════════════════════
echo.
pause
