const assert = require('assert');
const M = require('./math.js');
global.MatrixMath = M;
const H = require('./history.js');
const F = M.Fraction.from;
const mat = values => values.map(row => row.map(value => F(String(value))));
const strings = matrix => matrix.map(row => row.map(String));

// Frações exatas
assert.strictEqual(F('1/2').add(F('1/3')).toString(), '5/6');
assert.strictEqual(F('-1/2').add(F('3/2')).toString(), '1');
assert.strictEqual(F('2/3').mul(F('3/4')).toString(), '1/2');
assert.strictEqual(F('4/6').toString(), '2/3');
assert.throws(() => F('1/0'), /denominador/i);

// Operações elementares
const base2 = mat([[1, 2], [3, 4]]);
assert.deepStrictEqual(strings(M.addRows(base2, 1, 0, F('-3'))), [['1', '2'], ['0', '-2']]);
assert.deepStrictEqual(strings(M.swapCols(base2, 0, 1)), [['2', '1'], ['4', '3']]);

// Determinante e inversa
assert.strictEqual(M.determinant(base2).value.toString(), '-2');
const inverseBase = mat([[2, 1], [5, 3]]);
const inverse = M.inverse(inverseBase);
assert.strictEqual(inverse.invertible, true);
assert.deepStrictEqual(strings(inverse.inverse), [['3', '-1'], ['-5', '2']]);
assert.strictEqual(M.isIdentity(M.multiplyMatrices(inverseBase, inverse.inverse), 2), true);
assert.strictEqual(M.inverse(mat([[1, 2], [2, 4]])).invertible, false);

// JSON de matrizes
assert.deepStrictEqual(M.parseMatrixJSON('[[2,4],[1,2]]'), mat([[2, 4], [1, 2]]));
assert.deepStrictEqual(M.parseMatrixJSON('[ ["1/2", "2/3"], ["-3/4", 1] ]'), mat([['1/2', '2/3'], ['-3/4', 1]]));
assert.throws(() => M.parseMatrixJSON('[[1,2],[3]]'), /mesmo tamanho/i);
assert.strictEqual(H.matrixToJSONString(mat([['1/2', 2], ['-3/4', 1]])), '[\n  [\n    "1/2",\n    2\n  ],\n  [\n    "-3/4",\n    1\n  ]\n]');

// Comparação racional: 1/2 e 2/4 são equivalentes
assert.deepStrictEqual(M.getChangedCells(mat([['1/2']]), mat([['2/4']])), []);
assert.deepStrictEqual(M.getChangedCells(base2, mat([[1, 2], [0, -2]])), [{ row: 1, col: 0 }, { row: 1, col: 1 }]);

// Sarrus x algoritmo geral
const matrix3 = mat([[2, -1, 3], [4, 0, 1], [5, 2, -2]]);
const sarrus = M.determinantSarrus(matrix3);
assert.strictEqual(sarrus.value.toString(), M.determinant(matrix3).value.toString());
assert.strictEqual(sarrus.positiveTerms.length, 3);
assert.strictEqual(sarrus.negativeTerms.length, 3);

// Laplace linha/coluna, menores e sinais
assert.strictEqual(M.cofactorSign(0, 0), 1);
assert.strictEqual(M.cofactorSign(0, 1), -1);
assert.deepStrictEqual(M.createMinor(matrix3, 0, 0), mat([[0, 1], [2, -2]]));
assert.strictEqual(M.determinantLaplace(matrix3, 'row', 0).toString(), M.determinant(matrix3).value.toString());
assert.strictEqual(M.determinantLaplace(matrix3, 'col', 1).toString(), M.determinant(matrix3).value.toString());
const matrix4 = mat([[1, 2, 0, 1], [2, 5, 1, 0], [0, 1, 3, 2], [1, 0, 2, 4]]);
assert.strictEqual(M.determinantLaplace(matrix4, 'row', 0).toString(), M.determinant(matrix4).value.toString());
assert.strictEqual(M.determinantLaplace(matrix4, 'col', 2).toString(), M.determinant(matrix4).value.toString());
const suggestion = M.recommendLaplaceAxis(mat([[1, 0, 0], [2, 3, 4], [0, 5, 6]]));
assert.strictEqual(suggestion.axis, 'row');
assert.strictEqual(suggestion.index, 0);
assert.strictEqual(suggestion.zeros, 2);

// Troca de coluna inverte determinante
assert.strictEqual(M.determinant(M.swapCols(matrix3, 0, 1)).value.toString(), M.determinant(matrix3).value.neg().toString());

// Histórico estruturado + contadores
const session = H.createSession({ mode: 'study', problemType: 'determinant', initialMatrix: base2 });
let next = M.addRows(session.currentMatrix, 1, 0, F('-3'));
H.commit(session, next, { type: 'add', rowA: 1, rowB: 0, k: F('-3') }, 'L2 ← L2 - 3L1');
next = M.swapRows(session.currentMatrix, 0, 1);
H.commit(session, next, { type: 'swap', rowA: 0, rowB: 1, k: '1' }, 'L1 ↔ L2');
next = M.swapCols(session.currentMatrix, 0, 1);
H.commit(session, next, { type: 'swapCol', rowA: 0, rowB: 1, k: '1' }, 'C1 ↔ C2');
let stats = H.swapStats(session);
assert.deepStrictEqual(stats, { rowSwaps: 1, columnSwaps: 1, total: 2, sign: 1 });
assert.strictEqual(H.determinantTransformFactor(session).toString(), '1');
const exported = H.sessionToJSONData(session);
assert.strictEqual(exported.steps.length, 4);
assert.strictEqual(exported.steps[1].type, 'rowAdd');
assert.strictEqual(exported.steps[1].operation.factor, '-3');
assert.deepStrictEqual(exported.steps[1].before, [[1, 2], [3, 4]]);
assert.deepStrictEqual(exported.steps[1].after, [[1, 2], [0, -2]]);

// Paridade das trocas
const parity = H.createSession({ mode: 'study', problemType: 'determinant', initialMatrix: matrix3 });
assert.strictEqual(H.swapStats(parity).sign, 1);
H.commit(parity, M.swapRows(parity.currentMatrix, 0, 1), { type: 'swap', rowA: 0, rowB: 1 }, 'swap');
assert.strictEqual(H.swapStats(parity).sign, -1);
H.commit(parity, M.swapRows(parity.currentMatrix, 1, 2), { type: 'swap', rowA: 1, rowB: 2 }, 'swap');
assert.strictEqual(H.swapStats(parity).sign, 1);
H.commit(parity, M.swapCols(parity.currentMatrix, 0, 1), { type: 'swapCol', rowA: 0, rowB: 1 }, 'swapCol');
assert.strictEqual(H.swapStats(parity).sign, -1);

// Escala entra no fator acumulado: matriz atual = fator * det inicial
const scaleSession = H.createSession({ mode: 'study', problemType: 'determinant', initialMatrix: base2 });
H.commit(scaleSession, M.scaleRow(scaleSession.currentMatrix, 0, F('2')), { type: 'scale', rowA: 0, rowB: 0, k: F('2') }, 'L1 ← 2L1');
assert.strictEqual(H.determinantTransformFactor(scaleSession).toString(), '2');
assert.strictEqual(M.determinant(scaleSession.currentMatrix).value.div(H.determinantTransformFactor(scaleSession)).toString(), '-2');

console.log('✓ Todos os testes matemáticos e de histórico passaram.');

// 2.3 — trocas com a mesma linha/coluna são inválidas
assert.throws(() => M.swapRows(base2, 0, 0), /linhas diferentes/i);
assert.throws(() => M.swapCols(base2, 1, 1), /colunas diferentes/i);

// 2.3 — Laplace com único coeficiente não nulo preserva o multiplicador
const uniqueLaplace = mat([
  [2, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1]
]);
const uniqueExpansion = M.laplaceExpansion(uniqueLaplace, 'col', 0);
const uniqueNonZero = uniqueExpansion.terms.filter(term => !term.element.isZero());
assert.strictEqual(uniqueNonZero.length, 1);
assert.strictEqual(uniqueNonZero[0].element.toString(), '2');
assert.strictEqual(uniqueNonZero[0].minorDet.toString(), '1');
assert.strictEqual(uniqueNonZero[0].term.toString(), '2');
assert.strictEqual(uniqueExpansion.value.toString(), '2');

// 2.3 — sinal de trocas anteriores entra no fechamento do determinante
const signSession = H.createSession({ mode: 'study', problemType: 'determinant', initialMatrix: uniqueLaplace });
H.commit(
  signSession,
  M.swapRows(signSession.currentMatrix, 0, 1),
  { type: 'swap', rowA: 0, rowB: 1 },
  'L1 ↔ L2'
);
const currentDet = M.determinantLaplace(signSession.currentMatrix, 'col', 0);
assert.strictEqual(currentDet.toString(), '-2');
assert.strictEqual(H.swapStats(signSession).sign, -1);
assert.strictEqual(H.determinantTransformFactor(signSession).toString(), '-1');
assert.strictEqual(currentDet.div(H.determinantTransformFactor(signSession)).toString(), '2');

// 2.3 — eventos de Laplace fazem parte do histórico/exportação estruturada
const analysisSession = H.createSession({ mode: 'study', problemType: 'determinant', initialMatrix: uniqueLaplace });
H.logAnalysisEvent(analysisSession, {
  type: 'laplaceExpansion',
  description: 'Expansão de Laplace pela coluna 1',
  matrix: uniqueLaplace,
  metadata: {
    axis: 'col',
    index: 0,
    coefficient: F('2'),
    expression: 'det(A) = 2·det(M11)'
  }
});
H.logAnalysisEvent(analysisSession, {
  type: 'laplaceResult',
  description: 'Laplace concluído',
  matrix: uniqueLaplace,
  metadata: {
    currentDeterminant: F('2'),
    transformFactor: F('1'),
    originalDeterminant: F('2')
  }
});
const analysisExport = H.sessionToJSONData(analysisSession);
assert.strictEqual(analysisExport.analysisEvents.length, 2);
assert.strictEqual(analysisExport.timeline.length, 3);
assert.strictEqual(analysisExport.analysisEvents[0].metadata.coefficient, 2);
assert.strictEqual(analysisExport.analysisEvents[1].metadata.originalDeterminant, 2);

console.log('✓ Testes 2.3 de Laplace, sinal, histórico e trocas inválidas passaram.');
