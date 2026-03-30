@echo off
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"

if not exist "%ROOT%config.yaml" (
  echo [ERROR] 未找到 config.yaml，请先在项目根目录完成配置
  exit /b 1
)

where uv >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未检测到 uv，请先安装 uv
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未检测到 pnpm，请先安装 pnpm
  exit /b 1
)

start "DeerFlow LangGraph" powershell -NoExit -Command "cd /d '%ROOT%backend'; uv run langgraph dev --no-browser --allow-blocking --host 0.0.0.0 --port 2024"
start "DeerFlow Gateway" powershell -NoExit -Command "cd /d '%ROOT%backend'; $env:PYTHONPATH='.'; uv run uvicorn app.gateway.app:app --host 0.0.0.0 --port 8001"
start "DeerFlow Frontend" powershell -NoExit -Command "cd /d '%ROOT%frontend'; $env:COREPACK_ENABLE_DOWNLOAD_PROMPT='0'; if (-not (Test-Path 'node_modules')) { pnpm install }; pnpm run dev"

echo 已启动 3 个窗口：
echo   - LangGraph: http://localhost:2024
echo   - Gateway:   http://localhost:8001
echo   - Frontend:  http://localhost:3000
echo 前端可直接访问：http://localhost:3000
exit /b 0
