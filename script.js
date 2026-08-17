// script.js
/**
 * Вычисление замыкания системы функциональных зависимостей
 * Версия 15.6 - исходные ФЗ голубым, выведенные чёрным, сортировка по номерам
 */

const APP_VERSION = "15.6";

// ============================================================
// Хранилище данных
// ============================================================
let appState = {
    currentFile: null,
    originalFds: [],
    canonicalFds: [],
    attrMap: null,
    attrMapReverse: null,
    numericFds: [],
    numericN: null,
    closureResult: null,
    closureCform: null,
    resultSaved: true,
    isDataValid: false
};

// ============================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ УПРАВЛЕНИЯ РАСЧЁТОМ
// ============================================================
let cancelRequested = false;
let progressCallback = null;
let timeoutCallback = null;

// ============================================================
// РАБОТА С КУБАМИ
// ============================================================

function encodeCube(det, func, n) {
    let cube = 0;
    for (let i = 0; i < n; i++) {
        const attrNum = i + 1;
        let digit;
        if (det.includes(attrNum)) {
            digit = 1;  // детерминант
        } else if (func.includes(attrNum)) {
            digit = 0;  // функция
        } else {
            digit = 2;  // X - не участвует
        }
        cube |= (digit << (i * 2));
    }
    return cube;
}

function decodeCube(cube, n) {
    const det = [];
    const func = [];
    for (let i = 0; i < n; i++) {
        const digit = (cube >> (i * 2)) & 3;
        const attrNum = i + 1;
        if (digit === 1) det.push(attrNum);
        else if (digit === 0) func.push(attrNum);
    }
    return { det, func };
}

function cubeToStr(cube, n) {
    const { det, func } = decodeCube(cube, n);
    if (func.length === 0 || det.length === 0) return "";
    return det.join('*') + '-' + func.join('-');
}

function cubeToString(cube, n, attrMapReverse) {
    const { det, func } = decodeCube(cube, n);
    if (func.length === 0 || det.length === 0) return "";
    const detStr = det.map(a => attrMapReverse.get(a)).join('*');
    const funcStr = func.map(a => attrMapReverse.get(a)).join('-');
    return detStr + '-' + funcStr;
}

function starProduct(cube1, cube2, n) {
    let result = 0;
    let yCount = 0;
    let yPos = -1;
    
    for (let i = 0; i < n; i++) {
        const a = (cube1 >> (i * 2)) & 3;
        const b = (cube2 >> (i * 2)) & 3;
        let c;
        
        // Таблица покоординатного *-произведения
        // *  | 0  1  x
        // ---+---------
        // 0  | 0  y  0
        // 1  | y  1  1
        // x  | 0  1  x
        
        if (a === 0 && b === 0) {
            c = 0;
        } else if (a === 0 && b === 1) {
            c = 3;
            yCount++;
            yPos = i;
        } else if (a === 0 && b === 2) {
            c = 0;
        } else if (a === 1 && b === 0) {
            c = 3;
            yCount++;
            yPos = i;
        } else if (a === 1 && b === 1) {
            c = 1;
        } else if (a === 1 && b === 2) {
            c = 1;
        } else if (a === 2 && b === 0) {
            c = 0;
        } else if (a === 2 && b === 1) {
            c = 1;
        } else if (a === 2 && b === 2) {
            c = 2;
        }
        
        if (yCount > 1) {
            return null;
        }
        
        let digit;
        if (c === 3) {
            digit = 2;
        } else {
            digit = c;
        }
        result |= (digit << (i * 2));
    }
    
    let hasDet = false;
    for (let i = 0; i < n; i++) {
        const d = (result >> (i * 2)) & 3;
        if (d === 1) { hasDet = true; break; }
    }
    if (!hasDet) return null;
    
    let hasFunc = false;
    for (let i = 0; i < n; i++) {
        const d = (result >> (i * 2)) & 3;
        if (d === 0) { hasFunc = true; break; }
    }
    if (!hasFunc) return null;
    
    return result;
}

// ============================================================
// ОСНОВНОЙ АЛГОРИТМ ВЫЧИСЛЕНИЯ ЗАМЫКАНИЯ
// ============================================================

function computeClosure(fds, n, onProgress, onTimeout) {
    if (!n || fds.length === 0) return [];
    
    let closure = [...fds];
    let kkz = closure.length;
    
    if (kkz === 1) {
        return closure;
    }
    
    let changed = true;
    let iteration = 0;
    const TIMEOUT_MS = 10000;  // 10 секунд
    let lastProgressUpdate = Date.now();
    let startTime = Date.now();
    let timeoutShown = false;
    
    while (changed) {
        changed = false;
        iteration++;
        
        if (onProgress) {
            const now = Date.now();
            if (now - lastProgressUpdate > 200) {
                onProgress(iteration, kkz, closure.length);
                lastProgressUpdate = now;
            }
        }
        
        if (!timeoutShown && Date.now() - startTime > TIMEOUT_MS) {
            timeoutShown = true;
            if (onTimeout) {
                const shouldContinue = onTimeout(iteration, kkz);
                if (!shouldContinue) {
                    throw new Error('Расчёт прерван пользователем (таймаут)');
                }
                startTime = Date.now();
                timeoutShown = false;
            }
        }
        
        if (cancelRequested) {
            throw new Error('Расчёт отменён пользователем');
        }
        
        for (let i = 0; i < kkz - 1; i++) {
            for (let j = i + 1; j < kkz; j++) {
                const result = starProduct(closure[i], closure[j], n);
                
                if (result !== null) {
                    const kk = result;
                    
                    if (kk === closure[i]) {
                        closure.splice(i, 1);
                        kkz--;
                        changed = true;
                        break;
                    } else if (kk === closure[j]) {
                        closure.splice(j, 1);
                        kkz--;
                        changed = true;
                        break;
                    }
                    
                    let isAbsorbed = false;
                    for (let k = 0; k < kkz; k++) {
                        const spResult = starProduct(kk, closure[k], n);
                        if (spResult !== null && spResult === kk) {
                            isAbsorbed = true;
                            break;
                        }
                    }
                    
                    if (!isAbsorbed) {
                        closure.push(kk);
                        kkz++;
                        changed = true;
                        
                        const newIdx = kkz - 1;
                        const toRemove = [];
                        
                        for (let k = 0; k < newIdx; k++) {
                            const spResult = starProduct(kk, closure[k], n);
                            if (spResult !== null && spResult === closure[k]) {
                                toRemove.push(k);
                            }
                        }
                        
                        toRemove.sort((a, b) => b - a);
                        for (const idx of toRemove) {
                            closure.splice(idx, 1);
                            kkz--;
                        }
                        
                        break;
                    }
                }
            }
            
            if (changed) {
                break;
            }
        }
    }
    
    return closure;
}

// ============================================================
// ПРЕОБРАЗОВАНИЕ С-ФОРМЫ ↔ Ч-ФОРМА
// ============================================================

function parseCFormToTokens(cform) {
    const parts = cform.split('-');
    const determinantPart = parts[0];
    const functionPart = parts.slice(1).join('-');
    const determinants = determinantPart.split('*');
    const functions = functionPart ? functionPart.split('-') : [];
    return { determinants, functions };
}

function expandToCanonical(fdsList) {
    const canonical = [];
    for (const fd of fdsList) {
        if (!fd.tm) continue;
        const { determinants, functions } = parseCFormToTokens(fd.tm);
        const detStr = determinants.join('*');
        for (const func of functions) {
            canonical.push({ tm: `${detStr}-${func}` });
        }
    }
    return canonical;
}

function getUniqueAttributes(fdsList) {
    const attrs = new Set();
    for (const fd of fdsList) {
        if (!fd.tm) continue;
        const { determinants, functions } = parseCFormToTokens(fd.tm);
        determinants.forEach(d => attrs.add(d));
        functions.forEach(f => attrs.add(f));
    }
    return Array.from(attrs).sort((a, b) => {
        // Сортировка по номерам: 1,2,3,...,9,10,11,...
        const numA = parseInt(a);
        const numB = parseInt(b);
        return numA - numB;
    });
}

function cformToNumeric(tmStr, attrMap) {
    if (!tmStr) return "";
    const { determinants, functions } = parseCFormToTokens(tmStr);
    const detNums = determinants.map(d => attrMap.get(d).toString());
    const funcNums = functions.map(f => attrMap.get(f).toString());
    return detNums.join('*') + '-' + funcNums.join('-');
}

function numericToCform(numStr, attrMapReverse) {
    if (!numStr) return "";
    const parts = numStr.split('-');
    const determinantPart = parts[0];
    const functionPart = parts.length > 1 ? parts[1] : "";
    const detTokens = determinantPart.split('*');
    const funcTokens = functionPart ? functionPart.split('-') : [];
    const detCform = detTokens.map(t => attrMapReverse.get(parseInt(t))).join('*');
    const funcCform = funcTokens.map(t => attrMapReverse.get(parseInt(t))).join('-');
    return detCform + '-' + funcCform;
}

function convertFdsListToNumeric(fdsList, attrMap) {
    const result = [];
    for (const fd of fdsList) {
        if (!fd.tm) continue;
        const numericTm = cformToNumeric(fd.tm, attrMap);
        if (numericTm) result.push({ tm: numericTm });
    }
    return result;
}

// ============================================================
// ФУНКЦИИ ОТОБРАЖЕНИЯ
// ============================================================

function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Функция сортировки ФЗ по номерам атрибутов
function sortFdsByNumbers(fdsList) {
    return fdsList.sort((a, b) => {
        // Разбиваем на левую и правую части
        const partsA = a.split('-');
        const partsB = b.split('-');
        const detA = partsA[0];
        const detB = partsB[0];
        const funcA = partsA.slice(1).join('-');
        const funcB = partsB.slice(1).join('-');
        
        // Функция для сравнения строк с числами
        function compareNumericStrings(strA, strB) {
            const tokensA = strA.split(/[*\-]/);
            const tokensB = strB.split(/[*\-]/);
            const minLen = Math.min(tokensA.length, tokensB.length);
            
            for (let i = 0; i < minLen; i++) {
                const numA = parseInt(tokensA[i]);
                const numB = parseInt(tokensB[i]);
                if (numA !== numB) return numA - numB;
            }
            return tokensA.length - tokensB.length;
        }
        
        // Сначала сравниваем левые части
        const detCompare = compareNumericStrings(detA, detB);
        if (detCompare !== 0) return detCompare;
        
        // Затем правые части
        return compareNumericStrings(funcA, funcB);
    });
}

function renderEditableTable() {
    const leftPanel = document.getElementById('leftPanel');
    if (appState.originalFds.length === 0) {
        leftPanel.innerHTML = '<div class="placeholder">Нет данных. Добавьте ФЗ или откройте файл.</div>';
        return;
    }
    let html = '<table class="fds-table">';
    html += '<tbody>';
    for (let i = 0; i < appState.originalFds.length; i++) {
        const fd = appState.originalFds[i];
        const tmStr = fd.tm;
        const displayValue = tmStr === "" ? "" : escapeHtml(tmStr);
        html += `<tr data-index="${i}">
            <td class="fd-number">${i + 1}</td>
            <td class="fd-tm editable" contenteditable="true">${displayValue}</td>
            <td class="fd-action"><button class="delete-row-btn" data-index="${i}">🗑️</button></td>
        </tr>`;
    }
    html += '</tbody></table>';
    leftPanel.innerHTML = html;
    
    document.querySelectorAll('#leftPanel .editable').forEach(cell => {
        if (cell.innerText.trim() === "") {
            cell.classList.add('empty-placeholder');
            cell.setAttribute('data-placeholder', 'Введите ФЗ (A-B-C, A*B-C)');
        }
        cell.addEventListener('focus', () => {
            if (cell.innerText.trim() === "") {
                cell.innerText = "";
                cell.classList.remove('empty-placeholder');
            }
        });
        cell.addEventListener('blur', (e) => {
            const row = cell.closest('tr');
            const index = parseInt(row.dataset.index);
            let newTm = cell.innerText.trim();
            if (newTm === "") {
                deleteFdAt(index);
                return;
            }
            if (newTm !== appState.originalFds[index].tm) {
                updateFdAt(index, newTm);
            } else {
                cell.innerText = appState.originalFds[index].tm;
            }
        });
    });
    
    document.querySelectorAll('#leftPanel .delete-row-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            deleteFdAt(index);
        });
    });
}

function renderCenterPanel() {
    const centerPanel = document.getElementById('centerPanel');
    if (!appState.isDataValid || appState.originalFds.length === 0) {
        centerPanel.innerHTML = '<div class="placeholder">Нажмите «Проверить» для проверки данных.</div>';
        return;
    }
    
    const canonicalList = appState.canonicalFds.map(fd => fd.tm);
    
    let html = '<table class="fds-table">';
    html += '<tbody>';
    for (let i = 0; i < canonicalList.length; i++) {
        html += `<tr>
            <td class="fd-number">${i + 1}</td>
            <td class="fd-tm" style="color: #0d6efd;">${escapeHtml(canonicalList[i])}</td>
        </tr>`;
    }
    html += '</tbody></table>';
    centerPanel.innerHTML = html;
    document.getElementById('attrInfo').textContent = `Количество атрибутов: ${appState.numericN !== null ? appState.numericN : '?'}`;
}

function renderClosureTable() {
    const rightPanel = document.getElementById('rightPanel');
    if (!appState.closureCform || appState.closureCform.length === 0) {
        rightPanel.innerHTML = '<div class="placeholder">Нет результатов. Нажмите «Рассчитать».</div>';
        return;
    }
    
    // Исходные ФЗ (в канонической форме) для определения, какие являются исходными
    const originalCanonical = appState.canonicalFds.map(fd => fd.tm);
    const originalSet = new Set(originalCanonical);
    
    // Копируем и сортируем все ФЗ из замыкания
    const sortedFds = sortFdsByNumbers([...appState.closureCform]);
    
    let html = '<table class="fds-table">';
    html += '<tbody>';
    for (let i = 0; i < sortedFds.length; i++) {
        const fd = sortedFds[i];
        // Если ФЗ есть в исходных — голубым, иначе — чёрным
        const color = originalSet.has(fd) ? '#0d6efd' : '#000000';
        html += `<tr>
            <td class="fd-number">${i + 1}</td>
            <td class="fd-tm" style="color: ${color};">${escapeHtml(fd)}</td>
        </tr>`;
    }
    html += '</tbody></table>';
    rightPanel.innerHTML = html;
}

// ============================================================
// ДЕЙСТВИЯ С ДАННЫМИ
// ============================================================

function updateFdAt(index, newTm) {
    appState.originalFds[index] = { tm: newTm };
    appState.isDataValid = false;
    appState.canonicalFds = null;
    appState.numericFds = null;
    appState.numericN = null;
    appState.closureResult = null;
    appState.closureCform = null;
    document.getElementById('centerPanel').innerHTML = '<div class="placeholder">Нажмите «Проверить» после ввода данных.</div>';
    document.getElementById('rightPanel').innerHTML = '<div class="placeholder">Нет результатов</div>';
    document.getElementById('attrInfo').textContent = 'Количество атрибутов: —';
    document.getElementById('btnCalculate').disabled = true;
    updateUI();
}

function deleteFdAt(index) {
    appState.originalFds.splice(index, 1);
    appState.isDataValid = false;
    appState.canonicalFds = null;
    appState.numericFds = null;
    appState.numericN = null;
    appState.closureResult = null;
    appState.closureCform = null;
    document.getElementById('centerPanel').innerHTML = '<div class="placeholder">Нажмите «Проверить» после ввода данных.</div>';
    document.getElementById('rightPanel').innerHTML = '<div class="placeholder">Нет результатов</div>';
    document.getElementById('attrInfo').textContent = 'Количество атрибутов: —';
    document.getElementById('btnCalculate').disabled = true;
    updateUI();
}

function addEmptyFd() {
    appState.originalFds.push({ tm: "" });
    appState.isDataValid = false;
    appState.canonicalFds = null;
    appState.numericFds = null;
    appState.numericN = null;
    appState.closureResult = null;
    appState.closureCform = null;
    document.getElementById('centerPanel').innerHTML = '<div class="placeholder">Нажмите «Проверить» после ввода данных.</div>';
    document.getElementById('rightPanel').innerHTML = '<div class="placeholder">Нет результатов</div>';
    document.getElementById('attrInfo').textContent = 'Количество атрибутов: —';
    document.getElementById('btnCalculate').disabled = true;
    updateUI();
}

function clearAllPanels() {
    appState.currentFile = null;
    appState.originalFds = [];
    appState.canonicalFds = null;
    appState.attrMap = null;
    appState.attrMapReverse = null;
    appState.numericFds = null;
    appState.numericN = null;
    appState.closureResult = null;
    appState.closureCform = null;
    appState.isDataValid = false;
    appState.resultSaved = true;
    updateUI();
    document.getElementById('statusBar').textContent = "Готов. Откройте файл или введите ФЗ вручную.";
    document.getElementById('fileInfo').textContent = "Файл: не загружен";
    document.getElementById('attrInfo').textContent = "Количество атрибутов: —";
    document.getElementById('centerPanel').innerHTML = '<div class="placeholder">Нажмите «Проверить» после ввода данных.</div>';
    document.getElementById('rightPanel').innerHTML = '<div class="placeholder">Нет результатов</div>';
}

function checkData() {
    if (appState.originalFds.length === 0) {
        alert("Нет данных для проверки. Добавьте ФЗ или откройте файл.");
        return;
    }
    
    const hasEmpty = appState.originalFds.some(fd => !fd.tm || fd.tm.trim() === "");
    if (hasEmpty) {
        alert("Есть пустые строки. Заполните или удалите их.");
        return;
    }
    
    const canonicalFds = expandToCanonical(appState.originalFds);
    if (canonicalFds.length === 0) {
        alert("Не удалось преобразовать ФЗ в каноническую форму.");
        return;
    }
    
    const uniqueAttrs = getUniqueAttributes(canonicalFds);
    if (uniqueAttrs.length === 0) {
        alert("Не удалось определить атрибуты. Проверьте правильность введённых ФЗ.");
        return;
    }
    
    appState.attrMap = new Map();
    appState.attrMapReverse = new Map();
    uniqueAttrs.forEach((attr, idx) => {
        appState.attrMap.set(attr, idx + 1);
        appState.attrMapReverse.set(idx + 1, attr);
    });
    
    appState.canonicalFds = canonicalFds;
    appState.numericFds = convertFdsListToNumeric(canonicalFds, appState.attrMap);
    appState.numericN = uniqueAttrs.length;
    appState.isDataValid = true;
    appState.closureCform = null;
    
    renderCenterPanel();
    document.getElementById('statusBar').textContent = `Проверка выполнена. Найдено атрибутов: ${appState.numericN}`;
    document.getElementById('btnCalculate').disabled = false;
    document.getElementById('rightPanel').innerHTML = '<div class="placeholder">Нет результатов</div>';
}

// ============================================================
// ОБРАБОТЧИК КНОПКИ "РАССЧИТАТЬ"
// ============================================================

function calculate() {
    if (!appState.isDataValid) {
        alert("Данные не проверены. Сначала нажмите «Проверить».");
        return;
    }
    if (!appState.numericFds || appState.numericFds.length === 0) {
        alert("Нет данных для расчёта.");
        return;
    }
    if (!appState.numericN) {
        alert("Не удалось определить количество атрибутов.");
        return;
    }
    
    const n = appState.numericN;
    const numericTmList = appState.numericFds.map(fd => fd.tm);
    
    const cubes = [];
    for (const tm of numericTmList) {
        const parts = tm.split('-');
        const detPart = parts[0];
        const funcPart = parts[1];
        const det = detPart.split('*').map(x => parseInt(x, 10));
        const func = [parseInt(funcPart, 10)];
        cubes.push(encodeCube(det, func, n));
    }
    
    const btnCalculate = document.getElementById('btnCalculate');
    const statusBar = document.getElementById('statusBar');
    
    const toolbar = document.querySelector('.toolbar');
    const btnCancel = document.createElement('button');
    btnCancel.id = 'btnCancel';
    btnCancel.textContent = '⏹ Отмена';
    btnCancel.style.backgroundColor = '#dc3545';
    btnCancel.style.color = 'white';
    btnCancel.style.borderColor = '#dc3545';
    toolbar.appendChild(btnCancel);
    
    const progressContainer = document.createElement('div');
    progressContainer.id = 'progressContainer';
    progressContainer.style.cssText = 'margin: 8px 0; padding: 8px 16px; background: #e9ecef; border-radius: 8px; display: none;';
    progressContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-family: monospace;">
            <span id="progressText">Итерация: 0, Найдено ФЗ: 0</span>
            <span id="progressTime">Время: 0с</span>
        </div>
        <div style="width: 100%; height: 4px; background: #dee2e6; border-radius: 2px; margin-top: 4px; overflow: hidden;">
            <div id="progressBar" style="width: 0%; height: 100%; background: #0d6efd; border-radius: 2px; transition: width 0.3s;"></div>
        </div>
    `;
    statusBar.parentNode.insertBefore(progressContainer, statusBar);
    
    cancelRequested = false;
    let startTime = Date.now();
    let lastProgressUpdate = Date.now();
    
    function updateProgress(iteration, kkz, total) {
        const progressText = document.getElementById('progressText');
        const progressBar = document.getElementById('progressBar');
        const progressTime = document.getElementById('progressTime');
        
        if (progressText) {
            progressText.textContent = `Итерация: ${iteration}, Найдено ФЗ: ${kkz}`;
        }
        if (progressBar) {
            const pct = Math.min(iteration * 2, 95);
            progressBar.style.width = pct + '%';
        }
        if (progressTime) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            progressTime.textContent = `Время: ${elapsed}с`;
        }
    }
    
    function handleTimeout(iteration, kkz) {
        return new Promise((resolve) => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const shouldContinue = confirm(
                `Расчёт выполняется уже ${elapsed} секунд.\n` +
                `Итерация: ${iteration}, найдено ФЗ: ${kkz}\n\n` +
                'Продолжить расчёт?'
            );
            resolve(shouldContinue);
        });
    }
    
    btnCalculate.disabled = true;
    btnCalculate.textContent = '⏳ Расчёт...';
    statusBar.textContent = 'Вычисление замыкания...';
    progressContainer.style.display = 'block';
    
    btnCancel.onclick = function() {
        cancelRequested = true;
        btnCancel.textContent = '⏳ Отмена...';
        btnCancel.disabled = true;
        statusBar.textContent = 'Отмена расчёта...';
    };
    
    setTimeout(async () => {
        try {
            const resultCubes = await new Promise((resolve, reject) => {
                setTimeout(() => {
                    try {
                        const result = computeClosure(
                            cubes, 
                            n,
                            updateProgress,
                            handleTimeout
                        );
                        resolve(result);
                    } catch (err) {
                        reject(err);
                    }
                }, 10);
            });
            
            if (cancelRequested) {
                statusBar.textContent = 'Расчёт отменён пользователем.';
                btnCalculate.disabled = false;
                btnCalculate.innerHTML = '⚡ Рассчитать';
                btnCancel.remove();
                progressContainer.remove();
                return;
            }
            
            const closureNumeric = [];
            for (const cube of resultCubes) {
                const { det, func } = decodeCube(cube, n);
                if (func.length === 0 || det.length === 0) continue;
                const detStr = det.join('*');
                const funcStr = func.join('-');
                closureNumeric.push(detStr + '-' + funcStr);
            }
            
            appState.closureResult = closureNumeric;
            appState.closureCform = closureNumeric.map(num => numericToCform(num, appState.attrMapReverse)).filter(c => c);
            appState.resultSaved = false;
            renderClosureTable();
            
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            statusBar.textContent = `Вычисление завершено за ${elapsed}с. Всего ФЗ: ${appState.closureCform.length}`;
            
            const progressBar = document.getElementById('progressBar');
            if (progressBar) progressBar.style.width = '100%';
            
        } catch (err) {
            if (err.message.includes('отменён')) {
                statusBar.textContent = 'Расчёт отменён пользователем.';
            } else if (err.message.includes('таймаут')) {
                statusBar.textContent = `Расчёт прерван: ${err.message}`;
            } else {
                console.error(err);
                statusBar.textContent = `Ошибка: ${err.message}`;
                alert("Ошибка при вычислении: " + err.message);
            }
        } finally {
            btnCalculate.disabled = false;
            btnCalculate.innerHTML = '⚡ Рассчитать';
            btnCancel.remove();
            progressContainer.remove();
        }
    }, 100);
}

// ============================================================
// ГЕНЕРАЦИЯ XML ДЛЯ СОХРАНЕНИЯ
// ============================================================

function generateXmlContent() {
    const originalCformList = appState.originalFds.map(fd => fd.tm);
    
    let lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<fds>', '<fdsi>'];
    for (let idx = 0; idx < originalCformList.length; idx++) {
        lines.push(`    <fd${idx + 1}>${originalCformList[idx]}</fd${idx + 1}>`);
    }
    lines.push('</fdsi>');
    
    if (appState.closureCform && appState.closureCform.length > 0) {
        const sortedClosure = sortFdsByNumbers([...appState.closureCform]);
        lines.push('<fdsc>');
        for (let idx = 0; idx < sortedClosure.length; idx++) {
            lines.push(`    <fd${idx + 1}>${sortedClosure[idx]}</fd${idx + 1}>`);
        }
        lines.push('</fdsc>');
    }
    
    lines.push('</fds>');
    return lines.join("\n");
}

// ============================================================
// РАБОТА С ФАЙЛАМИ
// ============================================================

async function parseXmlFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                let xmlString = e.target.result;
                xmlString = xmlString.replace(/<!--[\s\S]*?-->/g, '');
                xmlString = xmlString.replace(/<fdsc\b[^>]*>[\s\S]*?<\/fdsc>/gi, '');
                
                const fdRegex = /<fd(?!s)[^>]*>([^<]*)<\/fd[^>]*>/gi;
                const tmStrings = [];
                let match;
                while ((match = fdRegex.exec(xmlString)) !== null) {
                    const tmStr = match[1].trim();
                    if (tmStr) tmStrings.push(tmStr);
                }
                
                if (tmStrings.length === 0) {
                    reject(new Error("Не найдено ни одной ФЗ (нет тегов <fd...>)"));
                    return;
                }
                resolve({ fdsList: tmStrings.map(tm => ({ tm })) });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("Ошибка чтения файла"));
        reader.readAsText(file);
    });
}

function loadFromFile(file) {
    parseXmlFile(file).then(({ fdsList }) => {
        clearAllPanels();
        appState.currentFile = file;
        appState.originalFds = fdsList;
        appState.isDataValid = false;
        appState.canonicalFds = null;
        appState.numericFds = null;
        appState.numericN = null;
        appState.closureCform = null;
        updateUI();
        document.getElementById('statusBar').textContent = `Файл загружен: ${file.name}. Нажмите «Проверить» для продолжения.`;
        document.getElementById('fileInfo').textContent = `Файл: ${file.name}`;
    }).catch(err => alert("Ошибка загрузки файла: " + err.message));
}

async function saveAsFile() {
    if (appState.originalFds.length === 0) {
        alert("Нет данных для сохранения.");
        return;
    }
    
    let suggestedName = 'fds.xml';
    if (appState.currentFile) {
        suggestedName = appState.currentFile.name;
    }
    
    const xmlContent = generateXmlContent();
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    
    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: suggestedName,
            types: [{ description: 'XML files', accept: { 'application/xml': ['.xml'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        appState.resultSaved = true;
        updateUI();
        document.getElementById('statusBar').textContent = `Сохранено в: ${handle.name}`;
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error(err);
            alert("Ошибка при сохранении: " + err.message);
        }
    }
}

// ============================================================
// КОПИРОВАНИЕ РЕЗУЛЬТАТА
// ============================================================

function copyClosureToClipboard() {
    if (!appState.closureCform || appState.closureCform.length === 0) {
        alert("Нет результата для копирования.");
        return;
    }
    
    const sortedClosure = sortFdsByNumbers([...appState.closureCform]);
    const text = sortedClosure.join('\n');
    
    navigator.clipboard.writeText(text).then(() => {
        document.getElementById('statusBar').textContent = "Результат скопирован в буфер обмена.";
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        document.getElementById('statusBar').textContent = "Результат скопирован в буфер обмена.";
    });
}

// ============================================================
// СПРАВКА
// ============================================================

let helpPages = [];
let currentHelpPageIndex = 0;

async function loadHelp() {
    const helpModal = document.getElementById('helpModal');
    const helpContent = document.getElementById('helpContent');
    const helpToc = document.getElementById('helpToc');
    
    helpModal.style.display = 'flex';
    helpContent.innerHTML = '<p>Загрузка справки...</p>';
    helpToc.innerHTML = '';
    
    try {
        const response = await fetch('README.md');
        if (!response.ok) throw new Error('Файл справки не найден');
        const markdown = await response.text();
        const html = marked.parse(markdown);
        
        const pages = [];
        let currentPage = '';
        let pageTitle = '';
        let hasContent = false;
        
        const sections = html.split(/(<h1>.*?<\/h1>|<h2>.*?<\/h2>)/);
        
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            if (section.startsWith('<h1>')) {
                if (currentPage.trim() && hasContent) {
                    pages.push({ title: pageTitle || 'Введение', content: currentPage });
                }
                pageTitle = section.replace(/<\/?h1>/g, '').trim();
                currentPage = section;
                hasContent = true;
            } else if (section.startsWith('<h2>')) {
                if (currentPage.trim() && hasContent) {
                    pages.push({ title: pageTitle || 'Введение', content: currentPage });
                }
                pageTitle = section.replace(/<\/?h2>/g, '').trim();
                currentPage = section;
                hasContent = true;
            } else {
                currentPage += section;
            }
        }
        if (currentPage.trim() && hasContent) {
            pages.push({ title: pageTitle || 'Введение', content: currentPage });
        }
        
        if (pages.length === 0) {
            pages.push({ title: 'Справка', content: html });
        }
        
        helpPages = pages;
        currentHelpPageIndex = 0;
        renderHelpToc();
        renderHelpPage();
    } catch (err) {
        helpContent.innerHTML = `<p style="color: red;">Ошибка загрузки справки: ${err.message}</p>`;
    }
}

function renderHelpToc() {
    const helpToc = document.getElementById('helpToc');
    let html = '<div style="font-weight: 600; color: #6c757d; font-size: 13px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Содержание</div>';
    for (let i = 0; i < helpPages.length; i++) {
        const active = i === currentHelpPageIndex ? 'active' : '';
        html += `<div class="help-toc-item ${active}" data-page="${i}">${helpPages[i].title}</div>`;
    }
    helpToc.innerHTML = html;
    
    document.querySelectorAll('.help-toc-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.page);
            if (index !== currentHelpPageIndex) {
                currentHelpPageIndex = index;
                renderHelpToc();
                renderHelpPage();
            }
        });
    });
}

function renderHelpPage() {
    const helpContent = document.getElementById('helpContent');
    const page = helpPages[currentHelpPageIndex];
    helpContent.innerHTML = page.content;
    helpContent.scrollTop = 0;
}

function closeHelpModal() {
    document.getElementById('helpModal').style.display = 'none';
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА
// ============================================================

function updateUI() {
    const btnCheck = document.getElementById('btnCheck');
    const btnCalculate = document.getElementById('btnCalculate');
    const btnSaveAs = document.getElementById('btnSaveAs');
    const fileInfoSpan = document.getElementById('fileInfo');
    const versionSpan = document.getElementById('versionInfo');
    
    if (versionSpan) versionSpan.textContent = `Версия: ${APP_VERSION}`;
    
    if (appState.originalFds.length > 0) {
        btnCheck.disabled = false;
        btnSaveAs.disabled = false;
        fileInfoSpan.textContent = `Файл: ${appState.currentFile?.name || 'ручной ввод'}`;
        renderEditableTable();
    } else {
        btnCheck.disabled = true;
        btnCalculate.disabled = true;
        btnSaveAs.disabled = true;
        fileInfoSpan.textContent = 'Файл: не загружен';
        document.getElementById('leftPanel').innerHTML = '<div class="placeholder">Нет данных. Добавьте ФЗ или откройте файл.</div>';
        document.getElementById('centerPanel').innerHTML = '<div class="placeholder">Нажмите «Проверить» после ввода данных.</div>';
        document.getElementById('rightPanel').innerHTML = '<div class="placeholder">Нет результатов</div>';
        document.getElementById('attrInfo').textContent = 'Количество атрибутов: —';
    }
    if (appState.isDataValid) {
        btnCalculate.disabled = false;
        renderCenterPanel();
    } else if (appState.originalFds.length > 0) {
        btnCalculate.disabled = true;
        document.getElementById('centerPanel').innerHTML = '<div class="placeholder">Нажмите «Проверить» для проверки данных.</div>';
    }
    if (appState.closureCform && appState.closureCform.length > 0) {
        btnSaveAs.disabled = false;
    }
}

// ============================================================
// НАСТРОЙКА СОБЫТИЙ
// ============================================================

const toolbar = document.querySelector('.toolbar');
const btnCopy = document.createElement('button');
btnCopy.id = 'btnCopy';
btnCopy.title = 'Копировать результат';
btnCopy.innerHTML = '📋 Копировать';
btnCopy.addEventListener('click', copyClosureToClipboard);
toolbar.appendChild(btnCopy);

const fileInput = document.getElementById('fileInput');
fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) loadFromFile(file);
};

document.getElementById('btnOpen').addEventListener('click', () => {
    clearAllPanels();
    fileInput.value = '';
    fileInput.click();
});
document.getElementById('btnAddRow').addEventListener('click', addEmptyFd);
document.getElementById('btnCheck').addEventListener('click', checkData);
document.getElementById('btnCalculate').addEventListener('click', calculate);
document.getElementById('btnSaveAs').addEventListener('click', saveAsFile);
document.getElementById('btnHelp').addEventListener('click', loadHelp);
document.querySelector('.close-modal').addEventListener('click', closeHelpModal);
document.getElementById('helpModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('helpModal')) {
        closeHelpModal();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        document.getElementById('btnOpen').click();
    } else if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        if (!document.getElementById('btnCalculate').disabled) calculate();
    } else if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        if (!document.getElementById('btnSaveAs').disabled) saveAsFile();
    } else if (e.key === 'F1') {
        e.preventDefault();
        loadHelp();
    }
});

updateUI();
console.log(`Версия ${APP_VERSION} загружена`);