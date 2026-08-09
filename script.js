// script.js
/**
 * KIMPL1 - Вычисление замыкания системы функциональных зависимостей
 * Версия 11.22 (исправлено удаление поглощённых кубов)
 */

const APP_VERSION = "11.22";

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
// АЛГОРИТМИЧЕСКАЯ ЧАСТЬ
// ============================================================

function krang(val, kubl, l, n, ib, ie) {
    let k0 = 0, k1 = 0, k2 = 0, k3 = 0;
    if (!val || val.length === 0) {
        return { val, kubl, k0, k1, k2, k3 };
    }
    let swapped = true;
    while (swapped) {
        swapped = false;
        for (let i = ib - 1; i < ie - 1; i++) {
            // Исправлено: правильный порядок сортировки
            let cond = (l === 0 && val[i] > val[i + 1]) || (l === 1 && val[i] < val[i + 1]);
            if (cond) {
                [val[i], val[i + 1]] = [val[i + 1], val[i]];
                [kubl[i], kubl[i + 1]] = [kubl[i + 1], kubl[i]];
                swapped = true;
            }
        }
    }
    for (let i = ib - 1; i < ie; i++) {
        if (val[i] === 1) k1++;
        else if (val[i] === 2) k2++;
        else if (val[i] === 3) k3++;
        else if (val[i] === 0) k0++;
    }
    return { val, kubl, k0, k1, k2, k3 };
}

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

function countValue(cube, val, n) {
    let count = 0;
    for (let i = 0; i < n; i++) {
        if (((cube >> (i * 2)) & 3) === val) count++;
    }
    return count;
}

function isCubeAbsorbed(absorber, absorbed, n) {
    // absorber поглощает absorbed, если все атрибуты absorbed
    // содержатся в absorber
    const r = absorber & absorbed;
    return r === absorbed && absorber !== absorbed;
}

function kimpl1(kubList, n, kc1) {
    if (!n || kc1 === 0) return { kub: [], ic: 0 };
    
    const g = n * 2;
    let kub = kubList.slice(0, kc1);
    let ic = kc1;
    let va = new Array(ic).fill(1);
    let k2 = 1;
    let k3 = 0;
    let ir = 0;
    let swi = 1;
    let swout = 1;
    let l = 0;
    let cz1 = [];
    let cz2 = [];
    let swz = 1;
    
    let iteration = 0;
    while (swout) {
        iteration++;
        let changed = false;
        const ik1 = ic - 1;
        const ih1 = k3;
        
        // Шаг 1: Склеивание (∗-произведение)
        for (let i1 = ih1; i1 < ik1; i1++) {
            const x = kub[i1];
            let ih2;
            if (swi || (!swi && (i1 + 1 > k2 + k3))) {
                ih2 = i1 + 1;
            } else {
                ih2 = k2 + k3;
            }
            
            for (let i2 = ih2; i2 < ic; i2++) {
                const y = kub[i2];
                let j = 0;
                let r = x & y;
                let p = 7;
                for (let iBit = 0; iBit < g; iBit += 2) {
                    if (((r >> iBit) & 3) === 0) {
                        j = iBit / 2;
                        p++;
                    }
                }
                
                // Если ровно одно различие
                if (p === 8 && j >= 0) {
                    // Создаём новый куб, устанавливая биты в 11
                    r = r | (3 << (j * 2));
                    let swkub = 1;
                    
                    // Проверяем, не существует ли уже такой куб
                    for (let i3 = 0; i3 < ic; i3++) {
                        const z = kub[i3];
                        const yTemp = r & z;
                        if (r === z || yTemp === r) {
                            swkub = 0;
                            break;
                        }
                    }
                    
                    if (swkub && ir > 0) {
                        for (let i3 = 0; i3 < ir; i3++) {
                            const z = swz ? cz1[i3] : cz2[i3];
                            const yTemp = r & z;
                            if (r === z || yTemp === r) {
                                swkub = 0;
                                break;
                            }
                        }
                    }
                    
                    if (swkub) {
                        ir++;
                        if (swz) {
                            cz1.push(r);
                        } else {
                            cz2.push(r);
                        }
                        changed = true;
                    }
                }
            }
        }
        
        swi = 0;
        if (!changed) {
            swout = 0;
            break;
        }
        
        // Шаг 2: Удаление поглощённых кубов
        if (ir > 0) {
            const tempCubes = swz ? cz1 : cz2;
            const tempVs = new Array(ir).fill(1);
            
            // Сортируем кубы по "общности" (кубы с большим количеством 3 идут первыми)
            const indexedCubes = tempCubes.map((cube, idx) => ({ cube, idx }));
            indexedCubes.sort((a, b) => {
                const count3a = countValue(a.cube, 3, n);
                const count3b = countValue(b.cube, 3, n);
                if (count3b !== count3a) return count3b - count3a;
                return a.cube - b.cube;
            });
            
            // Проверяем поглощение
            for (let i = 0; i < ir; i++) {
                if (tempVs[indexedCubes[i].idx] === 0) continue;
                const x = indexedCubes[i].cube;
                for (let j = i + 1; j < ir; j++) {
                    if (tempVs[indexedCubes[j].idx] === 0) continue;
                    const y = indexedCubes[j].cube;
                    
                    // Проверяем поглощение в обе стороны
                    if (isCubeAbsorbed(x, y, n)) {
                        // x поглощает y
                        tempVs[indexedCubes[j].idx] = 0;
                    } else if (isCubeAbsorbed(y, x, n)) {
                        // y поглощает x
                        tempVs[indexedCubes[i].idx] = 0;
                        break;
                    }
                }
            }
            
            // Формируем новый список кубов
            const newCubes = [];
            for (let i = 0; i < ir; i++) {
                if (tempVs[i] === 1) {
                    newCubes.push(tempCubes[i]);
                }
            }
            
            ir = newCubes.length;
            if (swz) cz1 = newCubes;
            else cz2 = newCubes;
        }
        
        // Шаг 3: Обновление основных кубов
        if (ir > 0) {
            const newCubes = swz ? cz1 : cz2;
            
            // Сортируем новые кубы
            const sortedCubes = newCubes.map((cube, idx) => ({ cube, idx }));
            sortedCubes.sort((a, b) => {
                const count3a = countValue(a.cube, 3, n);
                const count3b = countValue(b.cube, 3, n);
                if (count3b !== count3a) return count3b - count3a;
                return a.cube - b.cube;
            });
            
            const sortedValues = sortedCubes.map(item => item.cube);
            
            // Обновляем va для новых кубов
            const newVa = new Array(sortedValues.length).fill(0);
            for (let i = 0; i < sortedValues.length; i++) {
                let hasDet = false;
                let hasFunc = false;
                for (let j = 0; j < n; j++) {
                    const val = (sortedValues[i] >> (j * 2)) & 3;
                    if (val === 1) hasDet = true;
                    if (val === 2) hasFunc = true;
                }
                if (hasDet && hasFunc) newVa[i] = 3;
                else if (hasDet) newVa[i] = 1;
                else if (hasFunc) newVa[i] = 2;
                else newVa[i] = 0;
            }
            
            // Сортируем все кубы
            const krangResult = krang(newVa, sortedValues, l, n, 1, sortedValues.length);
            va = krangResult.val;
            kub = krangResult.kubl;
            
            k2 = krangResult.k2;
            k3 = krangResult.k3;
            
            ic = k3 + k2 + ir;
            const newKub = kub.slice(0, k3 + k2).concat(sortedValues);
            kub = newKub;
        }
        
        cz1 = [];
        cz2 = [];
        swz = 1;
        ir = 0;
        k2 = 1;
        k3 = 0;
        l = 1 - l; // переключение для сортировки
    }
    
    // Финальная очистка от поглощённых кубов
    const finalVs = new Array(ic).fill(1);
    for (let i = 0; i < ic; i++) {
        if (finalVs[i] === 0) continue;
        for (let j = i + 1; j < ic; j++) {
            if (finalVs[j] === 0) continue;
            if (isCubeAbsorbed(kub[i], kub[j], n)) {
                finalVs[j] = 0;
            } else if (isCubeAbsorbed(kub[j], kub[i], n)) {
                finalVs[i] = 0;
                break;
            }
        }
    }
    
    const finalKub = [];
    for (let i = 0; i < ic; i++) {
        if (finalVs[i] === 1) {
            finalKub.push(kub[i]);
        }
    }
    
    return { kub: finalKub, ic: finalKub.length };
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
    let html = '<table class="fds-table">';
    html += '<tbody>';
    for (let i = 0; i < appState.originalFds.length; i++) {
        const fd = appState.originalFds[i];
        if (!fd.tm) continue;
        html += `<tr>
            <td class="fd-number">${i + 1}</td>
            <td class="fd-tm">${escapeHtml(fd.tm)}</td>
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
    let html = '<table class="fds-table">';
    html += '<tbody>';
    for (let i = 0; i < appState.closureCform.length; i++) {
        html += `<tr>
            <td class="fd-number">${i + 1}</td>
            <td class="fd-tm">${escapeHtml(appState.closureCform[i])}</td>
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
    
    // Проверка на недопустимые символы
    const invalidChars = tmStr.match(/[^a-zA-Z0-9_*\-]/);
    if (invalidChars) {
        alert(`Недопустимый символ: "${invalidChars[0]}" в строке "${tmStr}"`);
        return false;
    }
    
    // Проверка на пустую левую часть
    const parts = tmStr.split('-');
    if (!parts[0] || parts[0].trim() === '') {
        alert(`Пустая левая часть в "${tmStr}"`);
        return false;
    }
    
    // Проверка на пустую правую часть
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
    
    // Валидация каждой ФЗ
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
    
    const numericTmList = appState.numericFds.map(fd => fd.tm);
    const n = appState.numericN;
    const kc1 = numericTmList.length;
    const kubList = numericTmList.map(tm => tmToCube(tm, n));
    
    const btnCalculate = document.getElementById('btnCalculate');
    btnCalculate.disabled = true;
    btnCalculate.textContent = '⏳ Расчёт...';
    document.getElementById('statusBar').textContent = "Вычисление замыкания...";
    
    setTimeout(() => {
        try {
            const { kub, ic } = kimpl1(kubList, n, kc1);
            const closureNumeric = [];
            for (let i = 0; i < ic; i++) {
                const tmStr = cubeToTm(kub[i], n);
                if (tmStr) closureNumeric.push(tmStr);
            }
            appState.closureResult = closureNumeric;
            appState.closureCform = closureNumeric.map(num => numericToCform(num, appState.attrMapReverse)).filter(c => c);
            appState.resultSaved = false;
            renderClosureTable();
            document.getElementById('statusBar').textContent = `Вычисление завершено. Всего ФЗ: ${ic}`;
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
// ГЕНЕРАЦИЯ XML ДЛЯ СОХРАНЕНИЯ
// ============================================================

function generateXmlContent() {
    const originalCformList = appState.originalFds.map(fd => fd.tm);
    
    let lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<fds>', '<fdsi>'];
    for (let idx = 0; idx < originalCformList.length; idx++) {
        lines.push(`    <fd${idx + 1}>${originalCformList[idx]}</fd${idx + 1}>`);
    }
    lines.push('</fdsi>');
    
    // Добавляем <fdsc> только если есть результат замыкания
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
                
                // Удаляем комментарии
                xmlString = xmlString.replace(/<!--[\s\S]*?-->/g, '');
                
                // Удаляем <fdsc> блоки
                xmlString = xmlString.replace(/<fdsc\b[^>]*>[\s\S]*?<\/fdsc>/gi, '');
                
                // Ищем все теги <fd...> кроме <fds>, <fdsi>, <fdsc>
                const fdRegex = /<fd(?!s)[^>]*>([^<]*)<\/fd[^>]*>/gi;
                const tmStrings = [];
                let match;
                while ((match = fdRegex.exec(xmlString)) !== null) {
                    const tmStr = match[1].trim();
                    if (tmStr) {
                        tmStrings.push(tmStr);
                    }
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
        alert("Нет данных для сохранения. Добавьте ФЗ или откройте файл.");
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
    
    const text = appState.closureCform.join('\n');
    navigator.clipboard.writeText(text).then(() => {
        document.getElementById('statusBar').textContent = "Результат скопирован в буфер обмена.";
    }).catch(() => {
        // fallback
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
        if (!response.ok) {
            throw new Error('Файл справки не найден');
        }
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
        helpContent.innerHTML = `<p style="color: red;">Ошибка загрузки справки: ${err.message}</p>
        <p>Убедитесь, что файл README.md находится в той же папке, что и index.html.</p>`;
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
    }
    else if (e.ctrlKey && e.key === 'r') { 
        e.preventDefault(); 
        if (!document.getElementById('btnCalculate').disabled) calculate(); 
    }
    else if (e.ctrlKey && e.shiftKey && e.key === 'S') { 
        e.preventDefault(); 
        if (!document.getElementById('btnSaveAs').disabled) saveAsFile(); 
    }
    else if (e.key === 'F1') { 
        e.preventDefault(); 
        loadHelp(); 
    }
});

// Инициализация
updateUI();
console.log(`KIMPL1 версия ${APP_VERSION} загружена`);