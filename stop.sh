#!/bin/bash
# stop.sh
# Stops both SmartCheckAI frontend and backend services

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================="
echo "🛑 Stopping SmartCheckAI Services"
echo "=========================================="

# Stop Backend
if [ -f .backend_pid ]; then
  BPID=$(cat .backend_pid)
  echo "Stopping FastAPI backend (PID: $BPID)..."
  kill $BPID 2>/dev/null
  rm -f .backend_pid
  echo "✅ Backend stopped."
else
  PIDS=$(pgrep -f "uvicorn backend.main:app")
  if [ ! -z "$PIDS" ]; then
    echo "Killing uvicorn backend processes ($PIDS)..."
    kill $PIDS 2>/dev/null
  fi
fi

# Stop Frontend
if [ -f .frontend_pid ]; then
  FPID=$(cat .frontend_pid)
  echo "Stopping Vite frontend (PID: $FPID)..."
  kill $FPID 2>/dev/null
  rm -f .frontend_pid .pid
  echo "✅ Frontend stopped."
elif [ -f .pid ]; then
  FPID=$(cat .pid)
  echo "Stopping Vite frontend (PID: $FPID)..."
  kill $FPID 2>/dev/null
  rm -f .pid
  echo "✅ Frontend stopped."
else
  VPIDS=$(pgrep -f "vite")
  if [ ! -z "$VPIDS" ]; then
    echo "Found running Vite processes. Killing them..."
    kill $VPIDS 2>/dev/null
    echo "✅ Vite processes killed."
  fi
fi

echo "=========================================="
echo "✨ All services stopped cleanly."
echo "=========================================="
