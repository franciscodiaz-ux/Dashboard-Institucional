@echo off
setlocal
cd /d "%~dp0"

set "COMMIT_MSG=Reestructura SIGA por año y semestre calendario"

echo ============================================
echo   CFT Laplace - Despliegue Dashboard
echo ============================================
echo.

echo [1/5] Publicando en Google Apps Script...
call clasp push
if errorlevel 1 goto :reauth_clasp
goto :git_status

:reauth_clasp
echo.
echo ------------------------------------------------
echo   CLASP NO PUDO PUBLICAR
echo ------------------------------------------------
echo Se intentara renovar la autenticacion de Google.
echo.
echo IMPORTANTE:
echo - Complete el inicio de sesion cuando clasp lo solicite.
echo - Al terminar, el despliegue continuara automaticamente.
echo.

call clasp logout >nul 2>&1
call clasp login --no-localhost
if errorlevel 1 goto :error_auth

echo.
echo Reintentando clasp push...
call clasp push
if errorlevel 1 goto :error_clasp

echo.
echo Autenticacion renovada y publicacion completada.

:git_status
echo.
echo [2/5] Revisando cambios Git...
git status
if errorlevel 1 goto :error

echo.
echo [3/5] Preparando cambios...
git add .
if errorlevel 1 goto :error

echo.
echo [4/5] Creando commit...
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo.
    echo No se creo un commit nuevo.
    echo Puede que no existan cambios pendientes.
)

echo.
echo [5/5] Enviando cambios a GitHub...
git push
if errorlevel 1 goto :error

echo.
echo ============================================
echo   DESPLIEGUE COMPLETADO
echo ============================================
echo.
pause
exit /b 0

:error_auth
echo.
echo ============================================
echo   ERROR DE AUTENTICACION CLASP
echo ============================================
echo No fue posible renovar la sesion de Google.
echo No se ejecuto ninguna operacion Git.
echo.
pause
exit /b 1

:error_clasp
echo.
echo ============================================
echo   ERROR DE PUBLICACION CLASP
echo ============================================
echo La autenticacion se renovo, pero clasp push
echo volvio a fallar. No se ejecuto Git.
echo.
pause
exit /b 1

:error
echo.
echo ============================================
echo   ERROR DURANTE EL DESPLIEGUE
echo ============================================
echo Revise el mensaje anterior.
echo.
pause
exit /b 1
