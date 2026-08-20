#!/bin/bash
# start.sh
# Starts the SmartCheckAI development server in the background

echo "Starting SmartCheckAI dev server..."
npm run dev > dev.log 2>&1 &
PID=$!
echo $PID > .pid

echo "✅ Server started in the background (PID: $PID)."
echo "👉 You can view the app at: http://localhost:5173"
echo "👉 To view real-time logs, run: tail -f dev.log"
echo "👉 To stop the server, run: ./stop.sh"
