@echo off
rem Run the Todo app locally on Windows:
rem   Spring Boot backend (http://localhost:8080) + React/Vite frontend (http://localhost:5173).
rem
rem Usage:
rem   run.bat            start backend and frontend, each in its own window
rem   run.bat backend    start only the backend (in this window)
rem   run.bat frontend   start only the frontend (in this window)
rem   run.bat test       build and test both
rem
rem Todos are stored in a text file: backend\data\todos.txt
rem (override with: set TODO_DATA_FILE=C:\path\to\todos.txt).
rem
rem Requires: JDK 21+ on PATH or JAVA_HOME (JDK 25 is downloaded automatically
rem by the Gradle toolchain if missing), Node.js 20+ and npm.

setlocal EnableExtensions
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

where java >nul 2>nul || if not defined JAVA_HOME (
  echo error: Java not found. Install JDK 21+ and add it to PATH or set JAVA_HOME.
  exit /b 1
)
where npm >nul 2>nul || (
  echo error: npm not found. Install Node.js 20+.
  exit /b 1
)

set "BOOT_ARGS="
if defined TODO_DATA_FILE set "BOOT_ARGS=--args=--todo.data-file=%TODO_DATA_FILE%"

set "MODE=%~1"
if "%MODE%"=="" set "MODE=all"
if /i "%MODE%"=="all"      goto :all
if /i "%MODE%"=="backend"  goto :backend
if /i "%MODE%"=="frontend" goto :frontend
if /i "%MODE%"=="test"     goto :test
echo usage: %~nx0 [all^|backend^|frontend^|test]
exit /b 1

:install_frontend
if not exist "%FRONTEND%\node_modules" (
  echo ==^> Installing frontend dependencies
  pushd "%FRONTEND%"
  call npm ci || (popd & exit /b 1)
  popd
)
exit /b 0

:backend
echo ==^> Starting backend on http://localhost:8080
cd /d "%BACKEND%"
call gradlew.bat bootRun --console=plain %BOOT_ARGS%
exit /b %ERRORLEVEL%

:frontend
call :install_frontend || exit /b 1
echo ==^> Starting frontend on http://localhost:5173
cd /d "%FRONTEND%"
call npm run dev -- --port 5173 --strictPort
exit /b %ERRORLEVEL%

:test
call :install_frontend || exit /b 1
echo ==^> Backend: build + tests
pushd "%BACKEND%"
call gradlew.bat build --no-daemon || (popd & echo Backend checks FAILED & exit /b 1)
popd
echo ==^> Frontend: lint, typecheck, tests, build
pushd "%FRONTEND%"
call npm run lint      || (popd & echo Frontend lint FAILED & exit /b 1)
call npm run typecheck || (popd & echo Frontend typecheck FAILED & exit /b 1)
call npm test          || (popd & echo Frontend tests FAILED & exit /b 1)
call npm run build     || (popd & echo Frontend build FAILED & exit /b 1)
popd
echo ==^> All checks passed
exit /b 0

:all
call :install_frontend || exit /b 1
echo ==^> Starting backend in a new window
start "Todo backend" /d "%BACKEND%" cmd /k "gradlew.bat bootRun --console=plain %BOOT_ARGS%"

echo ==^> Waiting for backend on http://localhost:8080 ...
set /a TRIES=0
:wait_backend
curl -fs http://localhost:8080/api/todos >nul 2>nul && goto :backend_up
set /a TRIES+=1
if %TRIES% geq 180 (
  echo error: backend did not start within 3 minutes. Check the "Todo backend" window.
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto :wait_backend

:backend_up
echo ==^> Starting frontend in a new window
start "Todo frontend" /d "%FRONTEND%" cmd /k "npm run dev -- --port 5173 --strictPort"
timeout /t 3 /nobreak >nul
start "" http://localhost:5173
echo.
echo ==^> App: http://localhost:5173
echo     Close the "Todo backend" and "Todo frontend" windows (or press Ctrl+C in them) to stop.
exit /b 0
