#!/bin/bash
# start.sh
# Starts both the SmartCheckAI frontend and FastAPI backend servers in the background

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================="
echo "🚀 Starting SmartCheckAI Unified Services"
echo "=========================================="

# 1. Start FastAPI Backend (Port 8000)
if [ -f "backend/venv/bin/uvicorn" ]; then
  echo "👉 Launching FastAPI backend on http://127.0.0.1:8000..."
  ./backend/venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload > backend.log 2>&1 &
  BACKEND_PID=$!
  echo $BACKEND_PID > .backend_pid
  echo "✅ Backend started (PID: $BACKEND_PID)"
else
  echo "⚠️ Python virtual environment not found at backend/venv! Backend not started."
fi

# 2. Start Vite Frontend (Port 5173)
echo "👉 Launching Vite frontend on http://localhost:5173..."
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > .frontend_pid
echo $FRONTEND_PID > .pid
echo "✅ Frontend started (PID: $FRONTEND_PID)"

echo "------------------------------------------"
echo "🌐 App URLs:"
echo "   - Frontend UI:  http://localhost:5173"
echo "   - Backend API:  http://localhost:8000"
echo "   - API Docs:     http://localhost:8000/docs"
echo "------------------------------------------"
echo "📋 Logs:"
echo "   - Frontend: tail -f frontend.log"
echo "   - Backend:  tail -f backend.log"
echo "🛑 To stop both: ./stop.sh"
echo "=========================================="
