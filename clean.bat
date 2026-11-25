@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Shikimori Explorer - Очистка проекта перед переносом

echo ======================================================
echo    Shikimori Explorer - Очистка проекта
echo ======================================================
echo.
echo Этот скрипт подготовит проект к переносу или архивации:
echo  [x] Папка .cache - кэш запросов Shikimori, Wikidata, ACDB
echo  [x] Папка node_modules - если была установлена
echo  [x] Системный мусор и логи: *.log, *.tmp, Thumbs.db, .DS_Store
echo.

set "CONFIRM="
set /p CONFIRM="Выполнить очистку? [Y/N, Enter = Y]: "
if /i "%CONFIRM:~0,1%"=="N" goto CANCEL

echo.
echo [1/4] Очистка кэша .cache...
if exist ".cache" (
    rd /s /q ".cache" 2>nul
    if not exist ".cache" (
        echo   -- Папка .cache успешно удалена.
    ) else (
        echo   -- Внимание: некоторые файлы кэша не удалось удалить.
    )
) else (
    echo   -- Папка .cache уже отсутствует.
)

echo.
echo [2/4] Проверка node_modules...
if exist "node_modules" (
    echo   -- Удаление node_modules...
    rd /s /q "node_modules" 2>nul
    echo   -- Папка node_modules удалена.
) else (
    echo   -- Папка node_modules отсутствует.
)

echo.
echo [3/4] Очистка временных файлов и логов...
del /f /q /s *.log >nul 2>&1
del /f /q /s *.tmp >nul 2>&1
del /f /q /s Thumbs.db >nul 2>&1
del /f /q /s .DS_Store >nul 2>&1
del /f /q npm-debug.log* >nul 2>&1
del /f /q yarn-error.log* >nul 2>&1
del /f /q pnpm-debug.log* >nul 2>&1
echo   -- Временные файлы и логи очищены.

echo.
echo [4/4] Проверка портативного Node.js bin\node.exe...
if not exist "bin\node.exe" (
    echo   -- bin\node.exe отсутствует.
    goto FINISH
)

echo   Файл bin\node.exe занимает ~90 МБ.
echo   - Если удалить: архив проекта будет весить всего ~1-2 МБ.
echo     (потребуется установленный Node.js на новом ПК)
echo   - Если оставить: проект запустится через start.bat даже без Node.js.
echo.

set "DEL_NODE="
set /p DEL_NODE="Удалить bin\node.exe для минимального веса архива? [y/N, Enter = N]: "
if /i "%DEL_NODE:~0,1%"=="Y" (
    del /f /q "bin\node.exe" 2>nul
    if not exist "bin\node.exe" (
        echo   -- bin\node.exe удален. Вес проекта теперь минимален.
    ) else (
        echo   -- Не удалось удалить bin\node.exe.
    )
) else (
    echo   -- bin\node.exe сохранен. Портативный запуск работает.
)

:FINISH
echo.
echo ======================================================
echo   Готово. Проект очищен и готов к переносу или сжатию.
echo ======================================================
echo.
pause
exit /b 0

:CANCEL
echo.
echo Отмена операции. Ничего не было удалено.
timeout /t 2 >nul
exit /b 0
