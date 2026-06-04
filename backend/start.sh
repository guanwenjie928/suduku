#!/bin/bash
cd /root/sudoku-new/backend
exec python3 -m uvicorn main:app --host 127.0.0.1 --port 8083
