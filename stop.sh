#!/bin/bash
# stop.sh
# Stops the SmartCheckAI development server running in the background

if [ -f .pid ]; then
  PID=$(cat .pid)
  echo "Stopping SmartCheckAI dev server (PID: $PID)..."
  kill $PID 2>/dev/null
  rm .pid
  echo "✅ Server stopped."
else
  echo "⚠️ No .pid file found. Is the server currently running via ./start.sh?"
  # Try to find and kill any running vite processes as a fallback
  PIDS=$(pgrep -f "vite")
  if [ ! -z "$PIDS" ]; then
    echo "Found running Vite processes. Killing them..."
    kill $PIDS
    echo "✅ Vite processes killed."
  fi
fi
