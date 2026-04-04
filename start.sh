#!/bin/bash
echo "Starting AEGIS Simulation System (UNIX)..."

# Launch Backend
(cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000) &
B_PID=$!

# Launch Frontend
if [ -d "frontend" ]; then
    (cd frontend && npm install && npm run dev) &
    F_PID=$!
else
    (npm install && npm run dev) &
    F_PID=$!
fi

echo "AEGIS running at http://localhost:5173"
echo "Backend PID: $B_PID, Frontend PID: $F_PID"

wait $F_PID
