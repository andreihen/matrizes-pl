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
      let pivotRow = col;
      while (pivotRow < size && augmented[pivotRow][col].isZero()) pivotRow++;
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
    multiplyMatrices,
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
