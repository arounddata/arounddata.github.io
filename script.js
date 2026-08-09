// script.js
/**
 * Вычисление замыкания системы функциональных зависимостей
 * Версия 12.0 - алгоритм на основе правил вывода
 */

const APP_VERSION = "12.0";

// ============================================================
// Хранилище данных
// ============================================================
let appState = {
    currentFile: null,
    originalFds: [],           // исходные ФЗ (составная форма, как ввёл пользователь)
    canonicalFds: [],          // каноническая форма (для расчёта)
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
// АЛГОРИТМ ВЫЧИСЛЕНИЯ ЗАМЫКАНИЯ (на основе правил вывода)
// ============================================================

function getDeterminants(cube, n) {
    const det = [];
    for (let i = 0; i < n; i++) {
        const digit = (cube >> (i * 2)) & 3;
        if (digit === 1) det.push(i + 1);
    }
    return det;
}

function getFunctions(cube, n) {
    const func = [];
    for (let i = 0; i < n; i++) {
        const digit = (cube >> (i * 2)) & 3;
        if (digit === 2) func.push(i + 1);
    }
    return func;
}

function createCube(determinants, functions, n) {
    let cube = 0;
    for (let i = 0; i < n; i++) {
        const attrNum = i + 1;
        let digit = 3; // по умолчанию не используется
        if (determinants.includes(attrNum)) {
            digit = 1;
        } else if (functions.includes(attrNum)) {
            digit = 2;
        }
        cube |= (digit << (i * 2));
    }
    return cube;
}

function isTrivial(cube, n) {
    const det = getDeterminants(cube, n);
    const func = getFunctions(cube, n);
    for (const attr of func) {
        if (!det.includes(attr)) return false;
    }
    return true;
}

function containsFd(list, cube) {
    for (const fd of list) {
        if (fd === cube) return true;
    }
    return false;
}

function applyTransitivity(fd1, fd2, n) {
    // fd1: X→Y, fd2: Y→Z, результат: X→Z
    const det1 = getDeterminants(fd1, n);
    const func1 = getFunctions(fd1, n);
    const det2 = getDeterminants(fd2, n);
    const func2 = getFunctions(fd2, n);
    
    if (func1.length === 0 || det2.length === 0) return null;
    
    // Проверяем, что все атрибуты из func1 есть в det2
    for (const attr of func1) {
        if (!det2.includes(attr)) return null;
    }
    
    // Проверяем, что результат не тривиальный
    const newCube = createCube(det1, func2, n);
    if (isTrivial(newCube, n)) return null;
    
    return newCube;
}

function applyPseudoTransitivity(fd1, fd2, n) {
    // fd1: X→Y, fd2: Y*Z→W, результат: X*Z→W
    const det1 = getDeterminants(fd1, n);
    const func1 = getFunctions(fd1, n);
    const det2 = getDeterminants(fd2, n);
    const func2 = getFunctions(fd2, n);
    
    if (func1.length === 0 || det2.length === 0) return null;
    
    // Проверяем, что все атрибуты из func1 есть в det2
    for (const attr of func1) {
        if (!det2.includes(attr)) return null;
    }
    
    // Формируем новые детерминанты: X + (Z \ Y)
    const newDet = [...det1];
    for (const attr of det2) {
        if (!func1.includes(attr) && !newDet.includes(attr)) {
            newDet.push(attr);
        }
    }
    
    // Проверяем, что результат не тривиальный
    const newCube = createCube(newDet, func2, n);
    if (isTrivial(newCube, n)) return null;
    
    // Проверяем, что новые детерминанты не совпадают с func2
    // (иначе это тривиальная зависимость)
    let allInDet = true;
    for (const attr of func2) {
        if (!newDet.includes(attr)) {
            allInDet = false;
            break;
        }
    }
    if (allInDet) return null;
    
    return newCube;
}

function computeClosure(fds, n) {
    if (!n || fds.length === 0) return [];
    
    // Копируем все исходные ФЗ
    let closure = [...fds];
    let changed = true;
    let iteration = 0;
    
    while (changed && iteration < 100) {
        changed = false;
        iteration++;
        const newFds = [];
        const currentLength = closure.length;
        
        for (let i = 0; i < currentLength; i++) {
            for (let j = 0; j < currentLength; j++) {
                if (i === j) continue;
                
                const fd1 = closure[i];
                const fd2 = closure[j];
                
                // Транзитивность: X→Y и Y→Z => X→Z
                const result1 = applyTransitivity(fd1, fd2, n);
                if (result1 !== null && !containsFd(closure, result1) && !containsFd(newFds, result1)) {
                    newFds.push(result1);
                    changed = true;
                }
                
                // Псевдотранзитивность: X→Y и Y*Z→W => X*Z→W
                const result2 = applyPseudoTransitivity(fd1, fd2, n);
                if (result2 !== null && !containsFd(closure, result2) && !containsFd(newFds, result2)) {
                    newFds.push(result2);
                    changed = true;
                }
            }
        }
        
        if (changed) {
            closure = closure.concat(newFds);
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
    return Array.from(attrs).sort();
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

function groupByDeterminants(fdsList) {
    const groups = {};
    for (const fd of fdsList) {
        const parts = fd.split('-');
        const det = parts[0];
        const func = parts[1];
        if (!groups[det]) groups[det] = [];
        groups[det].push(func);
    }
    
    const result = [];
    for (const det in groups) {
        const funcs = groups[det].sort();
        result.push(det + '-' + funcs.join('-'));
    }
    return result.sort();
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
    
    // Группируем по детерминантам для отображения в составной форме
    const grouped = groupByDeterminants(appState.originalFds.map(fd => fd.tm));
    
    let html = '<table class="fds-table">';
    html += '<tbody>';
    for (let i = 0; i < grouped.length; i++) {
        html += `<tr>
            <td class="fd-number">${i + 1}</td>
            <td class="fd-tm">${escapeHtml(grouped[i])}</td>
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
    
    // Группируем по детерминантам для отображения в составной форме
    const grouped = groupByDeterminants(appState.closureCform);
    
    let html = '<table class="fds-table">';
    html += '<tbody>';
    for (let i = 0; i < grouped.length; i++) {
        html += `<tr>
            <td class="fd-number">${i + 1}</td>
            <td class="fd-tm">${escapeHtml(grouped[i])}</td>
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

function validateCForm(tmStr) {
    if (!tmStr || tmStr.trim() === '') return false;
    
    const invalidChars = tmStr.match(/[^a-zA-Z0-9_*\-]/);
    if (invalidChars) {
        alert(`Недопустимый символ: "${invalidChars[0]}" в строке "${tmStr}"`);
        return false;
    }
    
    const parts = tmStr.split('-');
    if (!parts[0] || parts[0].trim() === '') {
        alert(`Пустая левая часть в "${tmStr}"`);
        return false;
    }
    if (parts.length < 2 || !parts[1] || parts[1].trim() === '') {
        alert(`Пустая правая часть в "${tmStr}"`);
        return false;
    }
    return true;
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
    
    for (const fd of appState.originalFds) {
        if (!validateCForm(fd.tm)) return;
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
    const kubList = numericTmList.map(tm => tmToCube(tm, n));
    
    const btnCalculate = document.getElementById('btnCalculate');
    btnCalculate.disabled = true;
    btnCalculate.textContent = '⏳ Расчёт...';
    document.getElementById('statusBar').textContent = "Вычисление замыкания...";
    
    setTimeout(() => {
        try {
            // Вычисляем замыкание
            const closureCubes = computeClosure(kubList, n);
            
            // Преобразуем обратно в строки
            const closureNumeric = [];
            for (const cube of closureCubes) {
                const tmStr = cubeToTm(cube, n);
                if (tmStr) closureNumeric.push(tmStr);
            }
            
            appState.closureResult = closureNumeric;
            appState.closureCform = closureNumeric
                .map(num => numericToCform(num, appState.attrMapReverse))
                .filter(c => c);
            
            appState.resultSaved = false;
            renderClosureTable();
            document.getElementById('statusBar').textContent = `Вычисление завершено. Всего ФЗ: ${appState.closureCform.length}`;
            btnCalculate.disabled = false;
            btnCalculate.innerHTML = '⚡ Рассчитать';
        } catch (err) {
            console.error(err);
            document.getElementById('statusBar').textContent = `Ошибка: ${err.message}`;
            alert("Ошибка при вычислении: " + err.message);
            btnCalculate.disabled = false;
            btnCalculate.innerHTML = '⚡ Рассчитать';
        }
    }, 100);
}

// ============================================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С КУБАМИ
// ============================================================

function tmToCube(tmStr, n) {
    if (!n || !tmStr) return 0;
    const parts = tmStr.split('-');
    const determinantPart = parts[0];
    const functionPart = parts.length > 1 ? parts[1] : "";
    let determinants = [];
    if (determinantPart.includes('*')) {
        determinants = determinantPart.split('*').map(x => parseInt(x, 10));
    } else {
        determinants = determinantPart ? [parseInt(determinantPart, 10)] : [];
    }
    let functions = [];
    if (functionPart) {
        if (functionPart.includes('-')) {
            functions = functionPart.split('-').map(x => parseInt(x, 10));
        } else {
            functions = [parseInt(functionPart, 10)];
        }
    }
    let value = 0;
    for (let i = 0; i < n; i++) {
        const attrNum = i + 1;
        let digit;
        if (determinants.includes(attrNum)) {
            digit = 1;
        } else if (functions.includes(attrNum)) {
            digit = 2;
        } else {
            digit = 3;
        }
        value |= (digit << (i * 2));
    }
    return value;
}

function cubeToTm(cubeValue, n) {
    if (!n) return "";
    const determinants = [];
    const functions = [];
    for (let i = 0; i < n; i++) {
        const digit = (cubeValue >> (i * 2)) & 3;
        if (digit === 1) determinants.push((i + 1).toString());
        else if (digit === 2) functions.push((i + 1).toString());
    }
    if (functions.length === 0) return "";
    return determinants.join("*") + "-" + functions.join("-");
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
        lines.push('<fdsc>');
        for (let idx = 0; idx < appState.closureCform.length; idx++) {
            lines.push(`    <fd${idx + 1}>${appState.closureCform[idx]}</fd${idx + 1}>`);
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

// Горячие клавиши
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

// Инициализация
updateUI();
console.log(`Версия ${APP_VERSION} загружена`);