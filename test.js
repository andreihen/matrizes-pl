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

// Gauss-Jordan didático: prioriza um 1 disponível antes de criar frações
const pivotOne = M.inverse(mat([[2, 1], [1, 1]]), true);
assert.strictEqual(pivotOne.steps[0].op, 'L1 ↔ L2');
const suggestedSwap = M.nextGaussJordanOperation(mat([[2, 1, 1, 0], [1, 1, 0, 1]]), 2);
assert.strictEqual(suggestedSwap.type, 'swap');
assert.strictEqual(suggestedSwap.rowB, 1);

// Sistemas lineares: solução única, infinitas soluções e sistema impossível
const uniqueSystem = M.solveLinearSystem(mat([[1, 1, 3], [1, -1, 1]]));
assert.strictEqual(uniqueSystem.type, 'unique');
assert.deepStrictEqual(uniqueSystem.solution.map(String), ['2', '1']);
assert.strictEqual(M.solveLinearSystem(mat([[1, 1, 2], [2, 2, 4]])).type, 'infinite');
assert.strictEqual(M.solveLinearSystem(mat([[1, 1, 2], [2, 2, 5]])).type, 'none');
assert.strictEqual(M.solveLinearSystem(mat([[5, 10]])).solution[0].toString(), '2');
const classroom3 = mat([[5, -3, 1, -1], [-4, 3, -1, -1], [9, 7, 5, -17]]);
const cramer3 = M.cramerRule(classroom3);
assert.strictEqual(cramer3.applicable, true);
assert.deepStrictEqual(cramer3.solution.map(String), ['-2', '-2', '3']);
assert.strictEqual(cramer3.det.toString(), '22');
const classroom4 = M.solveLinearSystem(mat([
  [2, 1, 3, -1, -4],
  [-1, 2, 1, 1, 11],
  [4, -5, -2, 2, -43],
  [3, 2, -1, -2, 3]
]));
assert.deepStrictEqual(classroom4.solution.map(String), ['-4', '5', '-1', '-2']);
for (const method of ['addition', 'substitution', 'comparison']) {
  const result = M.solveTwoByTwoMethod(mat([[1, 1, 5], [1, -1, 1]]), method);
  assert.deepStrictEqual(result.solution.map(String), ['3', '2']);
  assert.ok(result.steps.length >= 4);
}

// Operações e classificação de matrizes
assert.deepStrictEqual(strings(M.addMatrices(mat([[1, 2], [3, 4]]), mat([[4, 3], [2, 1]]))), [['5', '5'], ['5', '5']]);
assert.deepStrictEqual(strings(M.subtractMatrices(mat([[5, 4], [3, 2]]), mat([[1, 2], [3, 4]]))), [['4', '2'], ['0', '-2']]);
assert.deepStrictEqual(strings(M.scaleMatrix(mat([[1, -2]]), M.Fraction.from('1/2'))), [['1/2', '-1']]);
assert.deepStrictEqual(strings(M.transposeMatrix(mat([[1, 2, 3], [4, 5, 6]]))), [['1', '4'], ['2', '5'], ['3', '6']]);
assert.strictEqual(M.classifyMatrix(mat([[3, 0], [0, 3]])).scalar, true);
assert.strictEqual(M.classifyMatrix(mat([[1, 0], [0, 1]])).identity, true);

// Lista 3: regressão dos sete exercícios de escalonamento
const exerciseResults = [
  { matrix: [[5, -3, 3], [2, 1, -12]], type: 'unique', solution: ['-3', '-6'] },
  { matrix: [[1, -3, -70], [8, 14, 200]], type: 'unique', solution: ['-10', '20'] },
  { matrix: [[2, 4, 6, 2], [4, -1, -1, 3], [1, 1, -1, 6]], type: 'unique', solution: ['1', '3', '-2'] },
  { matrix: [[5, 2, -1, 4], [-1, -1, 2, 7], [2, -1, -4, 11]], type: 'unique', solution: ['40/9', '-25/3', '14/9'] },
  { matrix: [[1, 4, 2, 7], [-1, -4, -2, -7], [3, -1, -4, -1]], type: 'infinite' },
  { matrix: [[2, 1, 3, -1, -4], [-1, 2, 1, 1, 11], [4, -5, -2, 2, -43], [3, 2, -1, -2, 3]], type: 'unique', solution: ['-4', '5', '-1', '-2'] },
  { matrix: [[2, 1, 1, 1, 1], [3, 6, 3, 3, 6], [1, 1, 2, 1, 3], [1, 1, 1, 2, 4]], type: 'unique', solution: ['-1', '0', '1', '2'] }
];
exerciseResults.forEach(item => {
  const result = M.solveLinearSystem(mat(item.matrix));
  assert.strictEqual(result.type, item.type);
  if (item.solution) assert.deepStrictEqual(result.solution.map(String), item.solution);
});

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

// Trocas não podem usar a mesma linha/coluna
assert.throws(() => M.swapRows(base2, 0, 0), /linhas diferentes/i);
assert.throws(() => M.swapCols(base2, 1, 1), /colunas diferentes/i);

// Expressões algébricas com várias matrizes e multiplicação implícita
const exprA = mat([[1, 0], [0, 1]]);
const exprB = mat([[1, 2], [3, 4]]);
const exprC = mat([[2, 0], [0, 2]]);
const exprResult = M.evaluateMatrixExpression('2A + 4B*C', { A: exprA, B: exprB, C: exprC });
assert.deepStrictEqual(strings(exprResult.result), [['10', '16'], ['24', '34']]);
assert.deepStrictEqual(exprResult.references.sort(), ['A', 'B', 'C']);
assert.strictEqual(exprResult.steps.length, 4);
assert.deepStrictEqual(strings(M.evaluateMatrixExpression('1/2A + B', { A: exprA, B: exprB }).result), [['3/2', '2'], ['3', '9/2']]);
assert.throws(() => M.evaluateMatrixExpression('A + Z', { A: exprA }), /não foi definida/i);

// Geração reversa de sistema linear com solução fracionária exata
const generatedSolution = ['1/2', '1/5', '2'].map(F);
const generatedCoefficients = mat([[2, -5, 1], [1, 1, 1], [3, 0, -2]]);
const generatedSystem = M.buildLinearSystemFromSolution(generatedCoefficients, generatedSolution);
assert.deepStrictEqual(strings(generatedSystem), [
  ['2', '-5', '1', '2'],
  ['1', '1', '1', '27/10'],
  ['3', '0', '-2', '-5/2']
]);
assert.deepStrictEqual(M.solveLinearSystem(generatedSystem).solution.map(String), ['1/2', '1/5', '2']);
