// api/closure.js
/**
 * Вычисление замыкания системы функциональных зависимостей
 * Версия 16.0 - серверная часть (алгоритм защищён)
 */

// ============================================================
// АЛГОРИТМИЧЕСКАЯ ЧАСТЬ
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

function starProduct(cube1, cube2, n) {
    let result = 0;
    let yCount = 0;
    
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
            c = 0;    // 0 * 0 = 0
        } else if (a === 0 && b === 1) {
            c = 3;    // 0 * 1 = y
            yCount++;
        } else if (a === 0 && b === 2) {
            c = 0;    // 0 * x = 0
        } else if (a === 1 && b === 0) {
            c = 3;    // 1 * 0 = y
            yCount++;
        } else if (a === 1 && b === 1) {
            c = 1;    // 1 * 1 = 1
        } else if (a === 1 && b === 2) {
            c = 1;    // 1 * x = 1
        } else if (a === 2 && b === 0) {
            c = 0;    // x * 0 = 0
        } else if (a === 2 && b === 1) {
            c = 1;    // x * 1 = 1
        } else if (a === 2 && b === 2) {
            c = 2;    // x * x = x
        }
        
        // Если y более чем в одной позиции, результат пуст
        if (yCount > 1) {
            return null;
        }
        
        // Записываем результат
        // m(0) = 0, m(1) = 1, m(x) = x, m(y) = x
        let digit;
        if (c === 3) {
            digit = 2;  // y → x
        } else {
            digit = c;
        }
        result |= (digit << (i * 2));
    }
    
    // Проверяем: есть ли хотя бы один детерминант (1) в результате?
    let hasDet = false;
    for (let i = 0; i < n; i++) {
        const d = (result >> (i * 2)) & 3;
        if (d === 1) { hasDet = true; break; }
    }
    if (!hasDet) return null;
    
    // Проверяем: есть ли хотя бы одна функция (0) в результате?
    let hasFunc = false;
    for (let i = 0; i < n; i++) {
        const d = (result >> (i * 2)) & 3;
        if (d === 0) { hasFunc = true; break; }
    }
    if (!hasFunc) return null;
    
    return result;
}

function computeClosure(fds, n) {
    if (!n || fds.length === 0) return [];
    
    let closure = [...fds];
    let kkz = closure.length;
    
    if (kkz === 1) {
        return closure;
    }
    
    let changed = true;
    let iteration = 0;
    
    while (changed) {
        changed = false;
        iteration++;
        
        for (let i = 0; i < kkz - 1; i++) {
            for (let j = i + 1; j < kkz; j++) {
                const result = starProduct(closure[i], closure[j], n);
                
                if (result !== null) {
                    const kk = result;
                    
                    // Если КК равен ТК или ВК
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
                    
                    // Проверяем, не поглощается ли КК существующими кубами
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
// ФУНКЦИЯ СОРТИРОВКИ (для упорядочивания результатов)
// ============================================================

function sortFdsByNumbers(fdsList) {
    return fdsList.sort((a, b) => {
        const partsA = a.split('-');
        const partsB = b.split('-');
        const detA = partsA[0];
        const detB = partsB[0];
        const funcA = partsA.slice(1).join('-');
        const funcB = partsB.slice(1).join('-');
        
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
        
        const detCompare = compareNumericStrings(detA, detB);
        if (detCompare !== 0) return detCompare;
        return compareNumericStrings(funcA, funcB);
    });
}

// ============================================================
// ОБРАБОТЧИК HTTP-ЗАПРОСОВ (Vercel Serverless Function)
// ============================================================

export default async function handler(req, res) {
    // Разрешаем только POST
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Method Not Allowed. Use POST.' 
        });
    }

    try {
        const { fds, n } = req.body;

        // Валидация входных данных
        if (!fds || !Array.isArray(fds) || fds.length === 0) {
            return res.status(400).json({ 
                error: 'Invalid input: "fds" must be a non-empty array.' 
            });
        }
        if (!n || typeof n !== 'number' || n < 1) {
            return res.status(400).json({ 
                error: 'Invalid input: "n" must be a positive number.' 
            });
        }

        // Шаг 1: Преобразуем ФЗ в кубы
        const cubes = [];
        for (const tm of fds) {
            const parts = tm.split('-');
            const detPart = parts[0];
            const funcPart = parts[1];
            const det = detPart.split('*').map(x => parseInt(x, 10));
            const func = [parseInt(funcPart, 10)];
            cubes.push(encodeCube(det, func, n));
        }

        // Шаг 2: Вычисляем замыкание
        const resultCubes = computeClosure(cubes, n);

        // Шаг 3: Преобразуем кубы обратно в строки
        const closureNumeric = [];
        for (const cube of resultCubes) {
            const { det, func } = decodeCube(cube, n);
            if (func.length === 0 || det.length === 0) continue;
            const detStr = det.join('*');
            const funcStr = func.join('-');
            closureNumeric.push(detStr + '-' + funcStr);
        }

        // Шаг 4: Сортируем результат
        const sortedClosure = sortFdsByNumbers(closureNumeric);

        // Возвращаем результат
        return res.status(200).json({
            success: true,
            closure: sortedClosure,
            count: sortedClosure.length
        });

    } catch (error) {
        console.error('Error in calculate-closure:', error);
        return res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message 
        });
    }
}