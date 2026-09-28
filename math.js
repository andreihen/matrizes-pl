(function (global) {
  'use strict';

  // ============================================================
  // Rational arithmetic
  // ============================================================

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) [a, b] = [b, a % b];
    return a || 1;
  }

  class Fraction {
    constructor(numerator = 0, denominator = 1) {
      if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
        throw new Error('Fraction requer numerador e denominador inteiros.');
      }
      if (denominator === 0) throw new Error('Denominador não pode ser zero.');

      if (denominator < 0) {
        numerator *= -1;
        denominator *= -1;
      }

      if (numerator === 0) {
        this.n = 0;
        this.d = 1;
        return;
      }

      const divisor = gcd(numerator, denominator);
      this.n = numerator / divisor;
      this.d = denominator / divisor;
    }

    static from(value) {
      if (value instanceof Fraction) return value;
      if (typeof value === 'number' && Number.isInteger(value)) {
        return new Fraction(value, 1);
      }
      if (typeof value !== 'string') throw new Error('Valor inválido.');

      const text = value.trim();
      if (!text) throw new Error('Campo vazio.');

      if (/^[+-]?\d+$/.test(text)) {
        return new Fraction(parseInt(text, 10), 1);
      }

      const fractionMatch = text.match(/^([+-]?\d+)\/([+-]?\d+)$/);
      if (fractionMatch) {
        return new Fraction(
          parseInt(fractionMatch[1], 10),
          parseInt(fractionMatch[2], 10)
        );
      }

      throw new Error(`Valor inválido: ${value}`);
    }

    add(other) {
      const o = Fraction.from(other);
      return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d);
    }

    sub(other) {
      const o = Fraction.from(other);
      return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d);
    }

    mul(other) {
      const o = Fraction.from(other);
      return new Fraction(this.n * o.n, this.d * o.d);
    }

    div(other) {
      const o = Fraction.from(other);
      if (o.n === 0) throw new Error('Divisão por zero.');
      return new Fraction(this.n * o.d, this.d * o.n);
    }

    neg() {
      return new Fraction(-this.n, this.d);
    }

    abs() {
      return new Fraction(Math.abs(this.n), this.d);
    }

    equals(other) {
      const o = Fraction.from(other);
      return this.n === o.n && this.d === o.d;
    }

    isZero() {
      return this.n === 0;
    }

    toString() {
      return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`;
    }

    toNumber() {
      return this.n / this.d;
    }
  }

  // ============================================================
  // Matrix construction and parsing
  // ============================================================

  function cloneMatrix(matrix) {
    return matrix.map(row => row.map(value => Fraction.from(value)));
  }

  function identity(size) {
    return Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, col) => new Fraction(row === col ? 1 : 0))
    );
  }

  function augment(left, right) {
    if (left.length !== right.length) {
      throw new Error('As matrizes precisam ter a mesma quantidade de linhas.');
    }
    return left.map((row, index) => [
      ...row.map(Fraction.from),
      ...right[index].map(Fraction.from)
    ]);
  }

  function isSquare(matrix) {
    return matrix.length > 0 && matrix.every(row => row.length === matrix.length);
  }

  function validateMatrixData(data) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('O JSON deve conter uma matriz (array não vazio de arrays).');
    }

    if (!Array.isArray(data[0]) || data[0].length === 0) {
      throw new Error('A matriz deve ter pelo menos uma coluna.');
    }

    const columnCount = data[0].length;
    data.forEach((row, rowIndex) => {
      if (!Array.isArray(row)) {
        throw new Error(`A linha ${rowIndex + 1} não é um array.`);
      }
      if (row.length !== columnCount) {
        throw new Error('Todas as linhas devem ter o mesmo tamanho.');
      }
      row.forEach((value, colIndex) => {
        try {
          Fraction.from(value);
        } catch (error) {
          throw new Error(
            `Valor inválido na posição (${rowIndex + 1},${colIndex + 1}): ${String(value)}.`
          );
        }
      });
    });

    return data;
  }

  function parseMatrixJSON(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(`Falha ao importar JSON: ${error.message}`);
    }

    validateMatrixData(parsed);
    return cloneMatrix(parsed);
  }

  // ============================================================
  // Elementary operations
  // ============================================================

  function assertRow(matrix, row) {
    if (!Number.isInteger(row) || row < 0 || row >= matrix.length) {
      throw new Error('Linha inexistente.');
    }
  }

  function assertColumn(matrix, col) {
    if (!matrix.length || !Number.isInteger(col) || col < 0 || col >= matrix[0].length) {
      throw new Error('Coluna inexistente.');
    }
  }

  function swapRows(matrix, firstRow, secondRow) {
    assertRow(matrix, firstRow);
    assertRow(matrix, secondRow);
    if (firstRow === secondRow) throw new Error('Escolha duas linhas diferentes para realizar a troca.');
    const result = cloneMatrix(matrix);
    [result[firstRow], result[secondRow]] = [result[secondRow], result[firstRow]];
    return result;
  }

  function swapCols(matrix, firstCol, secondCol) {
    assertColumn(matrix, firstCol);
    assertColumn(matrix, secondCol);
    if (firstCol === secondCol) throw new Error('Escolha duas colunas diferentes para realizar a troca.');
    const result = cloneMatrix(matrix);
    result.forEach(row => {
      [row[firstCol], row[secondCol]] = [row[secondCol], row[firstCol]];
    });
    return result;
  }

  function scaleRow(matrix, row, scalar) {
    assertRow(matrix, row);
    const k = Fraction.from(scalar);
    if (k.isZero()) {
      throw new Error('O multiplicador não pode ser zero em uma operação elementar invertível.');
    }
    const result = cloneMatrix(matrix);
    result[row] = result[row].map(value => value.mul(k));
    return result;
  }

  function addRows(matrix, targetRow, sourceRow, scalar) {
    assertRow(matrix, targetRow);
    assertRow(matrix, sourceRow);
    const k = Fraction.from(scalar);
    const result = cloneMatrix(matrix);
    result[targetRow] = result[targetRow].map((value, col) =>
      value.add(result[sourceRow][col].mul(k))
    );
    return result;
  }

  function applyOperation(matrix, operation) {
    switch (operation.type) {
      case 'swap':
        return swapRows(matrix, operation.rowA, operation.rowB);
      case 'swapCol':
        return swapCols(matrix, operation.rowA, operation.rowB);
      case 'scale':
        return scaleRow(matrix, operation.rowA, operation.k);
      case 'add':
        return addRows(matrix, operation.rowA, operation.rowB, operation.k);
      default:
        throw new Error('Operação desconhecida.');
    }
  }

  function operationLabel(operation) {
    const a = operation.rowA + 1;
    const b = (operation.rowB ?? 0) + 1;

    if (operation.type === 'swap') return `L${a} ↔ L${b}`;
    if (operation.type === 'swapCol') return `C${a} ↔ C${b}`;
    if (operation.type === 'scale') {
      return `L${a} ← (${Fraction.from(operation.k).toString()})L${a}`;
    }

    const k = Fraction.from(operation.k);
    const sign = k.n < 0 ? '-' : '+';
    return `L${a} ← L${a} ${sign} (${k.abs().toString()})L${b}`;
  }

  // ============================================================
  // Determinants, minors, cofactors and Sarrus
  // ============================================================

  function createMinor(matrix, removedRow, removedCol) {
    if (!isSquare(matrix)) throw new Error('Menores exigem uma matriz quadrada.');
    assertRow(matrix, removedRow);
    assertColumn(matrix, removedCol);
    return matrix
      .filter((_, row) => row !== removedRow)
      .map(values => values.filter((_, col) => col !== removedCol));
  }

  function cofactorSign(row, col) {
    return (row + col) % 2 === 0 ? 1 : -1;
  }

  function determinant2x2(matrix) {
    if (!isSquare(matrix) || matrix.length !== 2) {
      throw new Error('A fórmula direta exige uma matriz 2×2.');
    }
    return matrix[0][0].mul(matrix[1][1]).sub(matrix[0][1].mul(matrix[1][0]));
  }

  function determinant(matrix, withSteps = false) {
    if (!isSquare(matrix)) throw new Error('Determinante exige matriz quadrada.');
    const size = matrix.length;
    if (size === 1) return { value: Fraction.from(matrix[0][0]), steps: [], rowSwaps: 0, sign: 1 };

    const work = cloneMatrix(matrix);
    let determinantValue = new Fraction(1);
    let swaps = 0;
    const steps = [];

    for (let col = 0; col < size; col++) {
      let pivotRow = col;
      while (pivotRow < size && work[pivotRow][col].isZero()) pivotRow++;

      if (pivotRow === size) {
        if (withSteps) {
          steps.push(`Coluna ${col + 1}: não existe pivô não nulo. Portanto, det(A) = 0.`);
        }
        return { value: new Fraction(0), steps, rowSwaps: swaps, sign: swaps % 2 ? -1 : 1 };
      }

      if (pivotRow !== col) {
        [work[pivotRow], work[col]] = [work[col], work[pivotRow]];
        swaps++;
        if (withSteps) {
          steps.push(`L${col + 1} ↔ L${pivotRow + 1}: trocar duas linhas inverte o sinal do determinante.`);
        }
      }

      const pivot = work[col][col];
      determinantValue = determinantValue.mul(pivot);
      if (withSteps) {
        steps.push(`Pivô ${col + 1}: ${pivot.toString()}. Produto parcial dos pivôs: ${determinantValue.toString()}.`);
      }

      for (let row = col + 1; row < size; row++) {
        if (work[row][col].isZero()) continue;
        const factor = work[row][col].div(pivot);
        for (let c = col; c < size; c++) {
          work[row][c] = work[row][c].sub(factor.mul(work[col][c]));
        }
        if (withSteps) {
          steps.push(`L${row + 1} ← L${row + 1} - (${factor.toString()})L${col + 1}: somar um múltiplo de outra linha não altera o determinante.`);
        }
      }
    }

    if (swaps % 2) determinantValue = determinantValue.neg();
    if (withSteps) steps.push(`det(A) = ${determinantValue.toString()}.`);
    return { value: determinantValue, steps, rowSwaps: swaps, sign: swaps % 2 ? -1 : 1 };
  }

  function determinantLaplace(matrix, axis = 'row', index = 0) {
    if (!isSquare(matrix)) throw new Error('Laplace exige uma matriz quadrada.');
    const size = matrix.length;
    if (size === 1) return Fraction.from(matrix[0][0]);
    if (size === 2) return determinant2x2(matrix);
    if (!['row', 'col'].includes(axis)) throw new Error('Eixo de Laplace inválido.');
    if (!Number.isInteger(index) || index < 0 || index >= size) {
      throw new Error('Linha/coluna de expansão inválida.');
    }

    let sum = new Fraction(0);
    for (let cursor = 0; cursor < size; cursor++) {
      const row = axis === 'row' ? index : cursor;
      const col = axis === 'row' ? cursor : index;
      const element = Fraction.from(matrix[row][col]);
      if (element.isZero()) continue;
      const minor = createMinor(matrix, row, col);
      const minorDet = determinantLaplace(minor, 'row', 0);
      const signedElement = element.mul(new Fraction(cofactorSign(row, col)));
      sum = sum.add(signedElement.mul(minorDet));
    }
    return sum;
  }

  function laplaceExpansion(matrix, axis = 'row', index = 0) {
    if (!isSquare(matrix)) throw new Error('Laplace exige uma matriz quadrada.');
    const size = matrix.length;
    if (size < 2) throw new Error('A expansão de Laplace requer matriz de ordem pelo menos 2.');
    if (!['row', 'col'].includes(axis)) throw new Error('Eixo de Laplace inválido.');
    if (!Number.isInteger(index) || index < 0 || index >= size) {
      throw new Error('Linha/coluna de expansão inválida.');
    }

    const terms = [];
    let value = new Fraction(0);

    for (let cursor = 0; cursor < size; cursor++) {
      const row = axis === 'row' ? index : cursor;
      const col = axis === 'row' ? cursor : index;
      const element = Fraction.from(matrix[row][col]);
      const sign = cofactorSign(row, col);
      const minor = createMinor(matrix, row, col);
      const minorDet = minor.length === 1
        ? Fraction.from(minor[0][0])
        : determinantLaplace(minor, 'row', 0);
      const term = element.mul(new Fraction(sign)).mul(minorDet);
      value = value.add(term);
      terms.push({ row, col, element, sign, minor, minorDet, term });
    }

    return { axis, index, terms, value };
  }

  function determinantSarrus(matrix) {
    if (!isSquare(matrix) || matrix.length !== 3) {
      throw new Error('Sarrus requer matriz 3×3.');
    }

    const m = cloneMatrix(matrix);
    const positiveCoords = [
      [[0, 0], [1, 1], [2, 2]],
      [[0, 1], [1, 2], [2, 0]],
      [[0, 2], [1, 0], [2, 1]]
    ];
    const negativeCoords = [
      [[0, 2], [1, 1], [2, 0]],
      [[0, 0], [1, 2], [2, 1]],
      [[0, 1], [1, 0], [2, 2]]
    ];

    const buildTerm = coords => {
      const factors = coords.map(([row, col]) => m[row][col]);
      const product = factors.reduce((acc, value) => acc.mul(value), new Fraction(1));
      return { coords, factors, product };
    };

    const positiveTerms = positiveCoords.map(buildTerm);
    const negativeTerms = negativeCoords.map(buildTerm);
    const posSum = positiveTerms.reduce((acc, term) => acc.add(term.product), new Fraction(0));
    const negSum = negativeTerms.reduce((acc, term) => acc.add(term.product), new Fraction(0));

    return {
      positiveTerms,
      negativeTerms,
      pos: positiveTerms.map(term => term.product),
      neg: negativeTerms.map(term => term.product),
      posSum,
      negSum,
      value: posSum.sub(negSum)
    };
  }

  // ============================================================
  // Inverse and comparison helpers
  // ============================================================

  function inverse(matrix, withSteps = false) {
    if (!isSquare(matrix)) throw new Error('Inversa exige matriz quadrada.');
    const size = matrix.length;
    let augmented = augment(cloneMatrix(matrix), identity(size));
    const steps = [];

    for (let col = 0; col < size; col++) {
      // Didactic priority: reuse an exact 1 as pivot whenever one is available.
      let pivotRow = -1;
      for (let row = col; row < size; row++) {
        if (augmented[row][col].equals(new Fraction(1))) {
          pivotRow = row;
          break;
        }
      }
      if (pivotRow < 0) {
        pivotRow = col;
        while (pivotRow < size && augmented[pivotRow][col].isZero()) pivotRow++;
      }
      if (pivotRow === size) return { invertible: false, inverse: null, steps };

      if (pivotRow !== col) {
        augmented = swapRows(augmented, col, pivotRow);
        if (withSteps) {
          steps.push({ op: `L${col + 1} ↔ L${pivotRow + 1}`, matrix: cloneMatrix(augmented) });
        }
      }

      const pivot = augmented[col][col];
      if (!pivot.equals(new Fraction(1))) {
        const reciprocal = new Fraction(pivot.d, pivot.n);
        augmented = scaleRow(augmented, col, reciprocal);
        if (withSteps) {
          steps.push({ op: `L${col + 1} ← (${reciprocal.toString()})L${col + 1}`, matrix: cloneMatrix(augmented) });
        }
      }

      for (let row = 0; row < size; row++) {
        if (row === col || augmented[row][col].isZero()) continue;
        const scalar = augmented[row][col].neg();
        augmented = addRows(augmented, row, col, scalar);
        if (withSteps) {
          steps.push({
            op: `L${row + 1} ← L${row + 1} + (${scalar.toString()})L${col + 1}`,
            matrix: cloneMatrix(augmented)
          });
        }
      }
    }

    return {
      invertible: true,
      inverse: augmented.map(row => row.slice(size)),
      steps,
      augmented
    };
  }

  function nextGaussJordanOperation(matrix, size) {
    if (!matrix?.length || !Number.isInteger(size) || size < 1) return null;
    const one = new Fraction(1);
    for (let col = 0; col < size; col++) {
      let unitColumn = true;
      for (let row = 0; row < size; row++) {
        const expected = row === col ? one : new Fraction(0);
        if (!Fraction.from(matrix[row][col]).equals(expected)) {
          unitColumn = false;
          break;
        }
      }
      if (unitColumn) continue;

      if (!Fraction.from(matrix[col][col]).equals(one)) {
        let oneRow = -1;
        for (let row = col + 1; row < size; row++) {
          if (Fraction.from(matrix[row][col]).equals(one)) {
            oneRow = row;
            break;
          }
        }
        if (oneRow >= 0) return { type: 'swap', rowA: col, rowB: oneRow, k: one };

        if (Fraction.from(matrix[col][col]).isZero()) {
          let nonZeroRow = col + 1;
          while (nonZeroRow < size && Fraction.from(matrix[nonZeroRow][col]).isZero()) nonZeroRow++;
          if (nonZeroRow >= size) return null;
          return { type: 'swap', rowA: col, rowB: nonZeroRow, k: one };
        }
        const pivot = Fraction.from(matrix[col][col]);
        return { type: 'scale', rowA: col, rowB: col, k: new Fraction(pivot.d, pivot.n) };
      }

      for (let row = 0; row < size; row++) {
        if (row === col || Fraction.from(matrix[row][col]).isZero()) continue;
        return { type: 'add', rowA: row, rowB: col, k: Fraction.from(matrix[row][col]).neg() };
      }
    }
    return null;
  }

  function solveLinearSystem(augmented, withSteps = false) {
    validateMatrixData(augmented);
    const rows = augmented.length;
    const cols = augmented[0].length;
    if (cols < 2) throw new Error('O sistema precisa de ao menos uma incógnita e uma coluna de resultados.');
    const variables = cols - 1;
    let work = cloneMatrix(augmented);
    const steps = [];
    const pivotColumns = [];
    let pivotRow = 0;

    for (let col = 0; col < variables && pivotRow < rows; col++) {
      let selected = -1;
      for (let row = pivotRow; row < rows; row++) {
        if (work[row][col].equals(new Fraction(1))) { selected = row; break; }
      }
      if (selected < 0) {
        selected = pivotRow;
        while (selected < rows && work[selected][col].isZero()) selected++;
      }
      if (selected >= rows) continue;
      if (selected !== pivotRow) {
        work = swapRows(work, pivotRow, selected);
        if (withSteps) steps.push({ op: `L${pivotRow + 1} ↔ L${selected + 1}`, matrix: cloneMatrix(work) });
      }
      const pivot = work[pivotRow][col];
      if (!pivot.equals(new Fraction(1))) {
        const reciprocal = new Fraction(pivot.d, pivot.n);
        work = scaleRow(work, pivotRow, reciprocal);
        if (withSteps) steps.push({ op: `L${pivotRow + 1} ← (${reciprocal})L${pivotRow + 1}`, matrix: cloneMatrix(work) });
      }
      for (let row = 0; row < rows; row++) {
        if (row === pivotRow || work[row][col].isZero()) continue;
        const scalar = work[row][col].neg();
        work = addRows(work, row, pivotRow, scalar);
        if (withSteps) steps.push({ op: `L${row + 1} ← L${row + 1} + (${scalar})L${pivotRow + 1}`, matrix: cloneMatrix(work) });
      }
      pivotColumns.push(col);
      pivotRow++;
    }

    const inconsistentRow = work.findIndex(row =>
      row.slice(0, variables).every(value => value.isZero()) && !row[variables].isZero()
    );
    if (inconsistentRow >= 0) {
      return { type: 'none', rref: work, steps, pivotColumns, freeColumns: [], inconsistentRow };
    }
    const freeColumns = Array.from({ length: variables }, (_, col) => col).filter(col => !pivotColumns.includes(col));
    if (freeColumns.length) return { type: 'infinite', rref: work, steps, pivotColumns, freeColumns };
    const solution = Array.from({ length: variables }, () => new Fraction(0));
    pivotColumns.forEach((col, row) => { solution[col] = work[row][variables]; });
    return { type: 'unique', rref: work, steps, pivotColumns, freeColumns, solution };
  }

  function cramerRule(augmented) {
    validateMatrixData(augmented);
    const rows = augmented.length;
    const variables = augmented[0].length - 1;
    if (rows !== variables) throw new Error('A Regra de Cramer exige o mesmo número de equações e incógnitas.');
    const coefficients = augmented.map(row => row.slice(0, variables));
    const constants = augmented.map(row => row[variables]);
    const det = determinant(coefficients).value;
    if (det.isZero()) {
      return { applicable: false, reason: 'det(A) = 0; Cramer não fornece solução única.', det, coefficients, constants };
    }
    const replacements = [];
    const solution = [];
    for (let col = 0; col < variables; col++) {
      const matrix = coefficients.map((row, rowIndex) => row.map((value, columnIndex) =>
        columnIndex === col ? constants[rowIndex] : value
      ));
      const variableDet = determinant(matrix).value;
      replacements.push({ col, matrix, det: variableDet });
      solution.push(variableDet.div(det));
    }
    return { applicable: true, det, coefficients, constants, replacements, solution };
  }

  function solveTwoByTwoMethod(augmented, method = 'addition') {
    validateMatrixData(augmented);
    if (augmented.length !== 2 || augmented[0].length !== 3) {
      throw new Error('Este método didático exige um sistema 2×2.');
    }
    if (!['addition', 'substitution', 'comparison'].includes(method)) throw new Error('Método 2×2 inválido.');
    const result = solveLinearSystem(augmented);
    if (result.type !== 'unique') return { method, ...result, steps: [] };
    const [[a, b, c], [d, e, f]] = cloneMatrix(augmented);
    const [x, y] = result.solution;
    const steps = [];

    if (method === 'addition') {
      const eliminateX = !a.isZero() && !d.isZero();
      const firstCoefficient = eliminateX ? a : b;
      const secondCoefficient = eliminateX ? d : e;
      const m1 = secondCoefficient;
      const m2 = firstCoefficient.neg();
      const remaining1 = eliminateX ? b.mul(m1) : a.mul(m1);
      const remaining2 = eliminateX ? e.mul(m2) : d.mul(m2);
      const remaining = remaining1.add(remaining2);
      const rhs = c.mul(m1).add(f.mul(m2));
      const variable = eliminateX ? 'y' : 'x';
      steps.push(`Multiplique E1 por ${m1} e E2 por ${m2} para cancelar ${eliminateX ? 'x' : 'y'}.`);
      steps.push(`Somando as equações: ${remaining}${variable} = ${rhs}.`);
      steps.push(`${variable} = ${rhs} ÷ ${remaining} = ${eliminateX ? y : x}.`);
      steps.push(`Substituindo na primeira equação: ${eliminateX ? `x = ${x}` : `y = ${y}`}.`);
    }

    if (method === 'substitution') {
      const candidates = [
        { row: 0, variable: 0, coefficient: a, other: b, rhs: c },
        { row: 0, variable: 1, coefficient: b, other: a, rhs: c },
        { row: 1, variable: 0, coefficient: d, other: e, rhs: f },
        { row: 1, variable: 1, coefficient: e, other: d, rhs: f }
      ].filter(item => !item.coefficient.isZero());
      const chosen = candidates.find(item => item.coefficient.abs().equals(new Fraction(1))) || candidates[0];
      const isolated = chosen.variable === 0 ? 'x' : 'y';
      const otherName = chosen.variable === 0 ? 'y' : 'x';
      const constantPart = chosen.rhs.div(chosen.coefficient);
      const otherFactor = chosen.other.neg().div(chosen.coefficient);
      steps.push(`Isole ${isolated} na equação ${chosen.row + 1}: ${isolated} = ${constantPart} + (${otherFactor})${otherName}.`);
      steps.push(`Substitua essa expressão na outra equação e resolva ${otherName}.`);
      steps.push(`${otherName} = ${chosen.variable === 0 ? y : x}.`);
      steps.push(`Voltando à expressão isolada: ${isolated} = ${chosen.variable === 0 ? x : y}.`);
    }

    if (method === 'comparison') {
      const compareX = !a.isZero() && !d.isZero();
      const variable = compareX ? 'x' : 'y';
      const otherName = compareX ? 'y' : 'x';
      const coeff1 = compareX ? a : b;
      const coeff2 = compareX ? d : e;
      const other1 = compareX ? b : a;
      const other2 = compareX ? e : d;
      const constant1 = c.div(coeff1);
      const factor1 = other1.neg().div(coeff1);
      const constant2 = f.div(coeff2);
      const factor2 = other2.neg().div(coeff2);
      steps.push(`Isole ${variable} em E1: ${variable} = ${constant1} + (${factor1})${otherName}.`);
      steps.push(`Isole ${variable} em E2: ${variable} = ${constant2} + (${factor2})${otherName}.`);
      steps.push(`Compare as expressões: ${constant1} + (${factor1})${otherName} = ${constant2} + (${factor2})${otherName}.`);
      steps.push(`${otherName} = ${compareX ? y : x} e, substituindo, ${variable} = ${compareX ? x : y}.`);
    }
    return { method, type: 'unique', solution: result.solution, rref: result.rref, steps };
  }

  function multiplyMatrices(a, b) {
    if (!a.length || !b.length || a[0].length !== b.length) {
      throw new Error('Dimensões incompatíveis para multiplicação.');
    }

    return Array.from({ length: a.length }, (_, row) =>
      Array.from({ length: b[0].length }, (_, col) => {
        let sum = new Fraction(0);
        for (let k = 0; k < b.length; k++) {
          sum = sum.add(Fraction.from(a[row][k]).mul(b[k][col]));
        }
        return sum;
      })
    );
  }

  function addMatrices(a, b) {
    if (!a.length || a.length !== b.length || a.some((row, index) => row.length !== b[index]?.length)) {
      throw new Error('Soma exige matrizes com as mesmas dimensões.');
    }
    return a.map((row, i) => row.map((value, j) => Fraction.from(value).add(b[i][j])));
  }

  function subtractMatrices(a, b) {
    if (!a.length || a.length !== b.length || a.some((row, index) => row.length !== b[index]?.length)) {
      throw new Error('Subtração exige matrizes com as mesmas dimensões.');
    }
    return a.map((row, i) => row.map((value, j) => Fraction.from(value).sub(b[i][j])));
  }

  function scaleMatrix(matrix, scalar) {
    const k = Fraction.from(scalar);
    return matrix.map(row => row.map(value => Fraction.from(value).mul(k)));
  }

  function transposeMatrix(matrix) {
    validateMatrixData(matrix);
    return Array.from({ length: matrix[0].length }, (_, col) => matrix.map(row => Fraction.from(row[col])));
  }

  function classifyMatrix(matrix) {
    validateMatrixData(matrix);
    const rows = matrix.length;
    const cols = matrix[0].length;
    const square = rows === cols;
    const zero = matrix.every(row => row.every(value => Fraction.from(value).isZero()));
    const diagonal = square && matrix.every((row, i) => row.every((value, j) => i === j || Fraction.from(value).isZero()));
    const diagonalValues = diagonal ? matrix.map((row, i) => Fraction.from(row[i])) : [];
    const scalar = diagonal && diagonalValues.every(value => value.equals(diagonalValues[0]));
    const identityMatrix = scalar && diagonalValues[0]?.equals(new Fraction(1));
    const symmetric = square && matrix.every((row, i) => row.every((value, j) => Fraction.from(value).equals(matrix[j][i])));
    return {
      rows, cols, square, rectangular: !square, row: rows === 1, column: cols === 1,
      zero, diagonal, scalar, identity: identityMatrix, symmetric
    };
  }

  function isIdentity(matrix, size = matrix.length) {
    if (matrix.length !== size || matrix.some(row => row.length < size)) return false;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const expected = new Fraction(row === col ? 1 : 0);
        if (!Fraction.from(matrix[row][col]).equals(expected)) return false;
      }
    }
    return true;
  }

  function matricesEqual(a, b) {
    return a.length === b.length && a.every((row, i) =>
      row.length === b[i].length && row.every((value, j) =>
        Fraction.from(value).equals(b[i][j])
      )
    );
  }

  function getChangedCells(original, edited) {
    if (!original || !edited || original.length !== edited.length) return [];
    const changed = [];
    for (let row = 0; row < original.length; row++) {
      if (original[row].length !== edited[row].length) return [];
      for (let col = 0; col < original[row].length; col++) {
        if (!Fraction.from(original[row][col]).equals(edited[row][col])) {
          changed.push({ row, col });
        }
      }
    }
    return changed;
  }

  function recommendLaplaceAxis(matrix) {
    if (!isSquare(matrix)) throw new Error('Laplace exige matriz quadrada.');
    let best = { axis: 'row', index: 0, zeros: -1 };
    matrix.forEach((row, index) => {
      const zeros = row.filter(value => Fraction.from(value).isZero()).length;
      if (zeros > best.zeros) best = { axis: 'row', index, zeros };
    });
    for (let col = 0; col < matrix.length; col++) {
      let zeros = 0;
      for (let row = 0; row < matrix.length; row++) {
        if (Fraction.from(matrix[row][col]).isZero()) zeros++;
      }
      if (zeros > best.zeros) best = { axis: 'col', index: col, zeros };
    }
    return best;
  }

  // ============================================================
  // Expressões algébricas com várias matrizes
  // ============================================================

  function isMatrixValue(value) {
    return Array.isArray(value) && value.length > 0 && Array.isArray(value[0]);
  }

  function matrixExpressionTokens(expression) {
    const input = String(expression || '').replace(/\s+/g, '');
    if (!input) throw new Error('Digite uma expressão, por exemplo A + B ou 2A + 4B*C.');
    const tokens = [];
    let index = 0;
    while (index < input.length) {
      const slice = input.slice(index);
      const number = slice.match(/^\d+(?:\/\d+)?/);
      if (number) {
        tokens.push({ type: 'number', value: number[0] });
        index += number[0].length;
        continue;
      }
      const identifier = slice.match(/^[A-Z][A-Z0-9_]*/i);
      if (identifier) {
        tokens.push({ type: 'identifier', value: identifier[0].toUpperCase() });
        index += 1;
        continue;
      }
      const char = input[index];
      if ('+-*()'.includes(char)) {
        tokens.push({ type: char, value: char });
        index += 1;
        continue;
      }
      throw new Error(`Símbolo inválido na expressão: ${char}`);
    }
    return tokens;
  }

  function parseMatrixExpression(expression) {
    const tokens = matrixExpressionTokens(expression);
    let position = 0;
    const peek = () => tokens[position] || null;
    const consume = type => {
      const token = peek();
      if (!token || (type && token.type !== type)) {
        throw new Error(`Expressão inválida perto de ${token?.value || 'fim da expressão'}.`);
      }
      position += 1;
      return token;
    };
    const startsPrimary = token => token && ['number', 'identifier', '(', '+', '-'].includes(token.type);

    function parsePrimary() {
      const token = peek();
      if (!token) throw new Error('Expressão incompleta.');
      if (token.type === '+' || token.type === '-') {
        consume(token.type);
        return { type: 'unary', op: token.type, child: parsePrimary() };
      }
      if (token.type === 'number') {
        consume('number');
        return { type: 'scalar', value: Fraction.from(token.value), repr: Fraction.from(token.value).toString() };
      }
      if (token.type === 'identifier') {
        consume('identifier');
        return { type: 'matrixRef', name: token.value, repr: token.value };
      }
      if (token.type === '(') {
        consume('(');
        const node = parseAddSub();
        consume(')');
        return { type: 'group', child: node };
      }
      throw new Error(`Token inesperado: ${token.value}`);
    }

    function parseMultiply() {
      let node = parsePrimary();
      while (true) {
        const token = peek();
        if (token?.type === '*') {
          consume('*');
          node = { type: 'binary', op: '*', left: node, right: parsePrimary() };
          continue;
        }
        // Multiplicação implícita: 2A, 3(B+C), AB.
        if (startsPrimary(token) && !['+', '-'].includes(token.type)) {
          node = { type: 'binary', op: '*', left: node, right: parsePrimary(), implicit: true };
          continue;
        }
        break;
      }
      return node;
    }

    function parseAddSub() {
      let node = parseMultiply();
      while (peek() && (peek().type === '+' || peek().type === '-')) {
        const op = consume(peek().type).type;
        node = { type: 'binary', op, left: node, right: parseMultiply() };
      }
      return node;
    }

    const ast = parseAddSub();
    if (position !== tokens.length) throw new Error(`Expressão inválida perto de ${peek().value}.`);
    return ast;
  }

  function expressionNodeText(node) {
    if (node.type === 'scalar') return node.repr;
    if (node.type === 'matrixRef') return node.name;
    if (node.type === 'group') return `(${expressionNodeText(node.child)})`;
    if (node.type === 'unary') return `${node.op}${expressionNodeText(node.child)}`;
    if (node.type === 'binary') {
      const left = expressionNodeText(node.left);
      const right = expressionNodeText(node.right);
      if (node.op === '*' && node.implicit) return `${left}${right}`;
      return `${left} ${node.op === '*' ? '×' : node.op} ${right}`;
    }
    return '?';
  }

  function evaluateMatrixExpression(expression, matrices) {
    const ast = typeof expression === 'string' ? parseMatrixExpression(expression) : expression;
    const references = new Set();
    const steps = [];

    function evaluate(node) {
      if (node.type === 'scalar') return { kind: 'scalar', value: Fraction.from(node.value), repr: node.repr };
      if (node.type === 'matrixRef') {
        const matrix = matrices?.[node.name];
        if (!matrix) throw new Error(`A matriz ${node.name} não foi definida.`);
        validateMatrixData(matrix);
        references.add(node.name);
        return { kind: 'matrix', value: cloneMatrix(matrix), repr: node.name };
      }
      if (node.type === 'group') {
        const result = evaluate(node.child);
        return { ...result, repr: `(${result.repr})` };
      }
      if (node.type === 'unary') {
        const child = evaluate(node.child);
        if (node.op === '+') return child;
        if (child.kind === 'scalar') return { kind: 'scalar', value: child.value.neg(), repr: `-${child.repr}` };
        const result = scaleMatrix(child.value, new Fraction(-1));
        const step = { type: 'scale', expression: `-${child.repr}`, leftKind: 'scalar', rightKind: 'matrix', left: new Fraction(-1), right: cloneMatrix(child.value), result: cloneMatrix(result) };
        steps.push(step);
        return { kind: 'matrix', value: result, repr: `-${child.repr}` };
      }
      if (node.type !== 'binary') throw new Error('Nó de expressão desconhecido.');

      const left = evaluate(node.left);
      const right = evaluate(node.right);
      const repr = expressionNodeText(node);
      let result;
      let type;

      if (node.op === '+' || node.op === '-') {
        if (left.kind === 'scalar' && right.kind === 'scalar') {
          result = node.op === '+' ? left.value.add(right.value) : left.value.sub(right.value);
          return { kind: 'scalar', value: result, repr };
        }
        if (left.kind !== 'matrix' || right.kind !== 'matrix') {
          throw new Error('Soma e subtração exigem duas matrizes de mesmas dimensões.');
        }
        result = node.op === '+' ? addMatrices(left.value, right.value) : subtractMatrices(left.value, right.value);
        type = node.op === '+' ? 'add' : 'subtract';
      } else if (node.op === '*') {
        if (left.kind === 'scalar' && right.kind === 'scalar') {
          return { kind: 'scalar', value: left.value.mul(right.value), repr };
        }
        if (left.kind === 'scalar' && right.kind === 'matrix') {
          result = scaleMatrix(right.value, left.value);
          type = 'scale';
        } else if (left.kind === 'matrix' && right.kind === 'scalar') {
          result = scaleMatrix(left.value, right.value);
          type = 'scale';
        } else if (left.kind === 'matrix' && right.kind === 'matrix') {
          result = multiplyMatrices(left.value, right.value);
          type = 'multiply';
        }
      }

      if (!result) throw new Error('Não foi possível avaliar a expressão matricial.');
      steps.push({
        type,
        expression: repr,
        leftKind: left.kind,
        rightKind: right.kind,
        left: left.kind === 'matrix' ? cloneMatrix(left.value) : Fraction.from(left.value),
        right: right.kind === 'matrix' ? cloneMatrix(right.value) : Fraction.from(right.value),
        result: cloneMatrix(result)
      });
      return { kind: 'matrix', value: result, repr };
    }

    const evaluated = evaluate(ast);
    if (evaluated.kind !== 'matrix') throw new Error('A expressão precisa resultar em uma matriz.');
    return {
      ast,
      expression: expressionNodeText(ast),
      result: cloneMatrix(evaluated.value),
      steps,
      references: [...references]
    };
  }

  // ============================================================
  // Geração reversa de sistemas lineares
  // ============================================================

  function buildLinearSystemFromSolution(coefficients, solution) {
    validateMatrixData(coefficients);
    const vector = solution.map(value => Fraction.from(value));
    if (!vector.length) throw new Error('Informe ao menos uma incógnita.');
    if (coefficients.some(row => row.length !== vector.length)) {
      throw new Error('Cada equação deve ter um coeficiente para cada incógnita.');
    }
    const constants = multiplyMatrices(coefficients, vector.map(value => [value])).map(row => row[0]);
    return coefficients.map((row, index) => [...row.map(Fraction.from), constants[index]]);
  }

  function firstDifference(actual, expected) {
    for (let row = 0; row < expected.length; row++) {
      for (let col = 0; col < expected[row].length; col++) {
        if (!Fraction.from(actual[row][col]).equals(expected[row][col])) {
          return {
            row,
            col,
            actual: Fraction.from(actual[row][col]),
            expected: Fraction.from(expected[row][col])
          };
        }
      }
    }
    return null;
  }

  function explainDifference(previous, operation, diff) {
    const row = diff.row;
    const col = diff.col;

    if (operation.type === 'swap') {
      return `Na posição (${row + 1},${col + 1}), o valor deveria vir da linha trocada. O correto é ${diff.expected}, mas você colocou ${diff.actual}.`;
    }

    if (operation.type === 'swapCol') {
      return `Na posição (${row + 1},${col + 1}), o valor deveria vir da coluna trocada. O correto é ${diff.expected}, mas você colocou ${diff.actual}.`;
    }

    if (operation.type === 'scale' && row === operation.rowA) {
      const before = previous[row][col];
      const scalar = Fraction.from(operation.k);
      return `Há um erro na posição (${row + 1},${col + 1}). Cálculo correto: ${before} × ${scalar} = ${diff.expected}. Você colocou ${diff.actual}.`;
    }

    if (operation.type === 'add' && row === operation.rowA) {
      const base = previous[row][col];
      const source = previous[operation.rowB][col];
      const scalar = Fraction.from(operation.k);
      return `Há um erro na posição (${row + 1},${col + 1}). Cálculo correto: ${base} + (${scalar})·${source} = ${diff.expected}. Você colocou ${diff.actual}.`;
    }

    return `A posição (${row + 1},${col + 1}) deveria permanecer ${diff.expected}, mas você digitou ${diff.actual}.`;
  }

  const API = {
    Fraction,
    cloneMatrix,
    identity,
    augment,
    isSquare,
    validateMatrixData,
    parseMatrixJSON,
    swapRows,
    swapCols,
    scaleRow,
    addRows,
    applyOperation,
    operationLabel,
    createMinor,
    cofactorSign,
    determinant2x2,
    determinant,
    determinantLaplace,
    laplaceExpansion,
    determinantSarrus,
    inverse,
    nextGaussJordanOperation,
    solveLinearSystem,
    cramerRule,
    solveTwoByTwoMethod,
    multiplyMatrices,
    addMatrices,
    subtractMatrices,
    scaleMatrix,
    transposeMatrix,
    classifyMatrix,
    parseMatrixExpression,
    evaluateMatrixExpression,
    buildLinearSystemFromSolution,
    isIdentity,
    matricesEqual,
    getChangedCells,
    recommendLaplaceAxis,
    firstDifference,
    explainDifference
  };

  global.MatrixMath = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
