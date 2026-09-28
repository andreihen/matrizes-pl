'use strict';

const M = window.MatrixMath;
const H = window.MatrixHistory;
const UI = window.MatrixUI;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const state = {
  baseMatrix: null,
  workspace: 'study',
  problemType: 'determinant',
  operationMode: 'managed',
  sessions: { determinant: null, inverse: null, linearSystem: null, matrixOperations: null },
  solveMatrix: null,
  matrixOperands: {},
  matrixExpressionPractice: null,
  generatedSystemSolution: null,
  showCalculationGuide: false,
  hintLevel: 0,
  laplace: { frames: [] }
};

// -----------------------------------------------------------------------------
// Entrada contextual
// -----------------------------------------------------------------------------

const matrixLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
function matrixNameForIndex(index) {
  const letter = matrixLetters[index % matrixLetters.length];
  const cycle = Math.floor(index / matrixLetters.length);
  return cycle === 0 ? letter : `${letter}${cycle}`;
}

function editorDimensions() {
  const first = Math.max(1, Math.min(6, Number($('#rows').value) || 3));
  const second = Math.max(1, Math.min(6, Number($('#cols').value) || 3));
  if (state.problemType === 'determinant' || state.problemType === 'inverse') {
    return { rows: first, cols: first };
  }
  if (state.problemType === 'linearSystem') {
    return { rows: first, cols: second + 1, variables: second };
  }
  return { rows: first, cols: second };
}

function problemTypeLabel(type = state.problemType) {
  return {
    determinant: 'Determinante', inverse: 'Inversa', linearSystem: 'Sistema linear', matrixOperations: 'Operações matriciais'
  }[type] || type;
}

function configureInputForProblemType({ rebuild = true } = {}) {
  const determinantLike = state.problemType === 'determinant' || state.problemType === 'inverse';
  const system = state.problemType === 'linearSystem';
  const operations = state.problemType === 'matrixOperations';
  $('#singleMatrixSetup').classList.toggle('hidden', operations);
  $('#matrixCollectionSetup').classList.toggle('hidden', !operations);
  $('#linearGeneratorSetup').classList.toggle('hidden', !system);
  $('#colsLabel').classList.toggle('hidden', determinantLike);
  $('#rowsLabelText').textContent = determinantLike ? 'Ordem da matriz' : system ? 'Equações' : 'Linhas';
  $('#colsLabelText').textContent = system ? 'Incógnitas' : 'Colunas';
  $('#startBtn').textContent = system ? 'Usar este sistema' : state.problemType === 'inverse' ? 'Usar esta matriz na inversa' : 'Usar esta matriz';
  $('#inputTypeHint').textContent = determinantLike
    ? 'Determinantes e inversas usam matrizes quadradas. Escolha a ordem e preencha os valores.'
    : system
      ? 'Escolha quantas equações e incógnitas deseja. A última coluna da matriz será o vetor de resultados b.'
      : 'Crie A, B, C... com dimensões independentes e depois escreva uma expressão algébrica usando essas letras.';
  $$('.setup-type').forEach(button => button.classList.toggle('active', button.dataset.problemType === state.problemType));
  $('#workspaceTypeBadge').textContent = problemTypeLabel();
  if (operations) {
    ensureMatrixOperandEditors();
  } else if (rebuild) {
    createEditor();
    if (system) syncSolutionInputs();
  }
}

function createEditor() {
  const { rows, cols, variables } = editorDimensions();
  if (state.problemType === 'linearSystem') { state.generatedSystemSolution = null; $('#revealGeneratedSolutionBtn')?.classList.add('hidden'); $('#generatedEquationPreview').innerHTML = ''; }
  $('#rows').value = rows;
  if (state.problemType === 'linearSystem') $('#cols').value = variables;
  else if (state.problemType !== 'determinant' && state.problemType !== 'inverse') $('#cols').value = cols;
  UI.makeEditor($('#matrixEditor'), rows, cols, null, state.problemType === 'linearSystem' ? cols - 1 : null);
  $('#validationMsg').textContent = '';
  if (state.problemType === 'linearSystem') syncSolutionInputs();
}

function randomMatrix(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => new M.Fraction(randomInteger(-5, 5)))
  );
}

function randomize() {
  const { rows, cols } = editorDimensions();
  if (state.problemType === 'linearSystem') { state.generatedSystemSolution = null; $('#revealGeneratedSolutionBtn')?.classList.add('hidden'); $('#generatedEquationPreview').innerHTML = ''; }
  UI.makeEditor($('#matrixEditor'), rows, cols, randomMatrix(rows, cols), state.problemType === 'linearSystem' ? cols - 1 : null);
}

function parseInputMatrix() {
  try {
    const matrix = UI.parseGrid($('#matrixEditor'));
    if ((state.problemType === 'determinant' || state.problemType === 'inverse') && !M.isSquare(matrix)) {
      throw new Error('Este tipo de estudo exige uma matriz quadrada.');
    }
    $('#validationMsg').textContent = '';
    return matrix;
  } catch (error) {
    $('#validationMsg').textContent = error.message;
    throw error;
  }
}

function hasActiveWork() {
  return Object.values(state.sessions).some(session => session?.history?.length > 1);
}

function confirmOverwrite() {
  return !hasActiveWork() || window.confirm('Carregar novos dados reiniciará as sessões atuais. Deseja continuar?');
}

function setBaseMatrix(matrix) {
  state.baseMatrix = M.cloneMatrix(matrix);
  state.solveMatrix = M.cloneMatrix(matrix);
  state.sessions = { determinant: null, inverse: null, linearSystem: null, matrixOperations: null };
  state.laplace.frames = [];
  ensureStudySession(state.problemType);
  refreshWorkspace();
}

function startMatrix({ skipConfirm = false } = {}) {
  if (!skipConfirm && !confirmOverwrite()) return;
  try {
    setBaseMatrix(parseInputMatrix());
    $('#validationMsg').textContent = state.problemType === 'linearSystem' ? '✓ Sistema carregado.' : '✓ Matriz carregada.';
    UI.showToast(state.problemType === 'linearSystem' ? 'Sistema carregado' : 'Matriz carregada');
  } catch { /* mensagem já exibida */ }
}

function loadJSON(text) {
  if (!confirmOverwrite()) return;
  try {
    const matrix = M.parseMatrixJSON(text);
    if (state.problemType === 'linearSystem') { state.generatedSystemSolution = null; $('#revealGeneratedSolutionBtn')?.classList.add('hidden'); $('#generatedEquationPreview').innerHTML = ''; }
    if ((state.problemType === 'determinant' || state.problemType === 'inverse') && !M.isSquare(matrix)) {
      throw new Error('O JSON precisa representar uma matriz quadrada neste modo.');
    }
    $('#rows').value = matrix.length;
    $('#cols').value = state.problemType === 'linearSystem' ? matrix[0].length - 1 : matrix[0].length;
    UI.makeEditor($('#matrixEditor'), matrix.length, matrix[0].length, matrix, state.problemType === 'linearSystem' ? matrix[0].length - 1 : null);
    setBaseMatrix(matrix);
    if (state.problemType === 'linearSystem') syncSolutionInputs();
    $('#validationMsg').textContent = '✓ JSON importado com sucesso.';
  } catch (error) {
    $('#validationMsg').textContent = error.message;
  }
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function variableNames(count) {
  return ['x', 'y', 'z', 'w', 'v', 'u'].slice(0, count);
}

function syncSolutionInputs() {
  const host = $('#solutionInputs');
  if (!host) return;
  const count = Math.max(1, Math.min(6, Number($('#cols').value) || 3));
  const previous = [...host.querySelectorAll('input')].map(input => input.value);
  host.innerHTML = variableNames(count).map((name, index) => `<label>${name} = <input data-solution-index="${index}" value="${UI.escapeHTML(previous[index] || (index === 0 ? '1/2' : index === 1 ? '1/5' : index === 2 ? '2' : '1'))}" inputmode="text" autocomplete="off"></label>`).join('');
  host.querySelectorAll('input').forEach(UI.wireSmartZeroInput);
}

const randomSolutionPool = ['-3', '-2', '-1', '-2/3', '-1/2', '-1/3', '1/5', '1/4', '1/3', '1/2', '2/3', '1', '2', '3'];

function randomizeSolutionValues() {
  syncSolutionInputs();
  $('#solutionInputs').querySelectorAll('input').forEach(input => {
    input.value = randomSolutionPool[Math.floor(Math.random() * randomSolutionPool.length)];
  });
  $('#generatedSystemInfo').textContent = 'Solução sorteada. Agora gere as equações lineares.';
}

function readSolutionValues() {
  return [...$('#solutionInputs').querySelectorAll('input')].map(input => M.Fraction.from(input.value));
}

function formatGeneratedEquations(augmented) {
  const names = variableNames(augmented[0].length - 1);
  const lines = augmented.map(row => {
    const terms = row.slice(0, -1).map((value, index) => {
      const f = M.Fraction.from(value);
      if (f.isZero()) return null;
      const sign = f.n < 0 ? '−' : '+';
      const abs = f.abs();
      const coefficient = abs.equals(new M.Fraction(1)) ? '' : abs.toString();
      return { sign, text: `${coefficient}${names[index]}` };
    }).filter(Boolean);
    let left = '';
    terms.forEach((term, index) => {
      if (index === 0) left += `${term.sign === '−' ? '−' : ''}${term.text}`;
      else left += ` ${term.sign} ${term.text}`;
    });
    return `${left} = ${row.at(-1)}`;
  });
  return `<div class="generated-equations"><strong>Sistema criado</strong>${lines.map((line, i) => `<div><span>${i + 1}</span><code>${UI.escapeHTML(line)}</code></div>`).join('')}</div>`;
}

function generateSystemWithSolution({ randomizeSolution = false } = {}) {
  try {
    if (randomizeSolution) randomizeSolutionValues();
    const solution = readSolutionValues();
    const size = solution.length;
    $('#rows').value = size;
    $('#cols').value = size;
    let coefficients;
    let attempts = 0;
    do {
      coefficients = randomMatrix(size, size);
      attempts += 1;
    } while (M.determinant(coefficients).value.isZero() && attempts < 200);
    if (M.determinant(coefficients).value.isZero()) throw new Error('Não foi possível gerar uma matriz de coeficientes invertível.');
    const augmented = M.buildLinearSystemFromSolution(coefficients, solution);
    UI.makeEditor($('#matrixEditor'), size, size + 1, augmented, size);
    state.generatedSystemSolution = solution;
    $('#generatedEquationPreview').innerHTML = formatGeneratedEquations(augmented);
    $('#generatedSystemInfo').textContent = 'Os termos independentes foram calculados a partir da solução escolhida. Use o sistema quando estiver pronto.';
    $('#revealGeneratedSolutionBtn').classList.remove('hidden');
  } catch (error) {
    $('#generatedSystemInfo').textContent = error.message;
  }
}

function revealGeneratedSolution() {
  if (!state.generatedSystemSolution) return;
  const names = variableNames(state.generatedSystemSolution.length);
  $('#generatedSystemInfo').innerHTML = `Solução usada: ${state.generatedSystemSolution.map((value, index) => `${names[index]} = <strong>${UI.fractionHTML(value)}</strong>`).join(', ')}.`;
}

// -----------------------------------------------------------------------------
// Coleção de matrizes para expressões
// -----------------------------------------------------------------------------

function matrixOperandCard(name, matrix = null) {
  const values = matrix || [[new M.Fraction(0), new M.Fraction(0)], [new M.Fraction(0), new M.Fraction(0)]];
  const card = document.createElement('article');
  card.className = 'operand-card';
  card.dataset.matrixName = name;
  card.innerHTML = `<div class="operand-card-head"><div><span class="operand-symbol">${name}</span><strong>Matriz ${name}</strong></div><button class="ghost operand-remove" type="button" data-operand-action="remove" aria-label="Remover matriz ${name}">Remover</button></div>
    <div class="operand-controls"><label>Linhas <input data-operand-rows type="number" min="1" max="6" value="${values.length}"></label><label>Colunas <input data-operand-cols type="number" min="1" max="6" value="${values[0].length}"></label><button class="secondary" type="button" data-operand-action="resize">Redimensionar</button><button class="ghost" type="button" data-operand-action="random">Aleatória</button><button class="ghost" type="button" data-operand-action="copy">⧉ JSON</button></div><div class="matrix-scroll operand-editor"></div>`;
  UI.makeEditor(card.querySelector('.operand-editor'), values.length, values[0].length, values);
  return card;
}

function ensureMatrixOperandEditors() {
  const host = $('#matrixCollectionEditors');
  if (host.children.length) return;
  host.appendChild(matrixOperandCard('A'));
  host.appendChild(matrixOperandCard('B'));
  updateOperandRemoveButtons();
}

function updateOperandRemoveButtons() {
  const cards = $$('#matrixCollectionEditors .operand-card');
  cards.forEach(card => card.querySelector('.operand-remove').disabled = cards.length <= 2);
  $('#addMatrixOperandBtn').disabled = false;
}

function addMatrixOperand(matrix = null) {
  const host = $('#matrixCollectionEditors');
  const next = matrixNameForIndex(host.children.length);
  host.appendChild(matrixOperandCard(next, matrix));
  updateOperandRemoveButtons();
}

function parseMatrixOperandsFromEditors() {
  const operands = {};
  $$('#matrixCollectionEditors .operand-card').forEach(card => {
    operands[card.dataset.matrixName] = UI.parseGrid(card.querySelector('.operand-editor'));
  });
  return operands;
}

function useMatrixCollection() {
  try {
    const operands = parseMatrixOperandsFromEditors();
    state.matrixOperands = Object.fromEntries(Object.entries(operands).map(([name, matrix]) => [name, M.cloneMatrix(matrix)]));
    state.baseMatrix = M.cloneMatrix(operands.A);
    state.solveMatrix = M.cloneMatrix(operands.A);
    state.sessions.matrixOperations = H.createSession({ mode: 'study', problemType: 'matrixOperations', initialMatrix: operands.A });
    state.matrixExpressionPractice = null;
    $('#matrixCollectionMsg').textContent = `✓ ${Object.keys(operands).length} matrizes carregadas.`;
    refreshWorkspace();
    UI.showToast('Matrizes carregadas');
  } catch (error) {
    $('#matrixCollectionMsg').textContent = error.message;
  }
}

function randomizeAllOperands() {
  $$('#matrixCollectionEditors .operand-card').forEach(card => {
    const rows = Math.max(1, Math.min(6, Number(card.querySelector('[data-operand-rows]').value) || 2));
    const cols = Math.max(1, Math.min(6, Number(card.querySelector('[data-operand-cols]').value) || 2));
    UI.makeEditor(card.querySelector('.operand-editor'), rows, cols, randomMatrix(rows, cols));
  });
}

function zeroAllOperands() {
  $$('#matrixCollectionEditors .operand-card').forEach(card => {
    const rows = Math.max(1, Math.min(6, Number(card.querySelector('[data-operand-rows]').value) || 2));
    const cols = Math.max(1, Math.min(6, Number(card.querySelector('[data-operand-cols]').value) || 2));
    UI.makeEditor(card.querySelector('.operand-editor'), rows, cols);
  });
}

// -----------------------------------------------------------------------------
// Sessions and navigation
// -----------------------------------------------------------------------------

function createStudySession(problemType) {
  if (!state.baseMatrix) return null;
  if (problemType === 'determinant') {
    return H.createSession({ mode: 'study', problemType, initialMatrix: state.baseMatrix });
  }
  if (problemType === 'linearSystem') {
    if (state.baseMatrix[0].length < 2) return null;
    return H.createSession({
      mode: 'study',
      problemType,
      initialMatrix: state.baseMatrix,
      augmentedAt: state.baseMatrix[0].length - 1
    });
  }
  if (problemType === 'matrixOperations') {
    return H.createSession({ mode: 'study', problemType, initialMatrix: state.baseMatrix });
  }
  if (!M.isSquare(state.baseMatrix)) return null;
  const size = state.baseMatrix.length;
  const augmented = M.augment(state.baseMatrix, M.identity(size));
  return H.createSession({ mode: 'study', problemType, initialMatrix: augmented, augmentedAt: size });
}

function ensureStudySession(problemType = state.problemType) {
  if (!state.sessions[problemType]) state.sessions[problemType] = createStudySession(problemType);
  return state.sessions[problemType];
}

function currentSession() {
  return ensureStudySession(state.problemType);
}

function setWorkspace(mode) {
  state.workspace = mode;
  refreshWorkspace();
}

function setProblemType(problemType, { reconfigureInput = true } = {}) {
  state.problemType = problemType;
  ensureStudySession(problemType);
  const source = studySourceMatrixForSolve();
  state.solveMatrix = source ? M.cloneMatrix(source) : null;
  state.laplace.frames = [];
  if (reconfigureInput) configureInputForProblemType();
  refreshWorkspace();
}

function refreshWorkspace() {
  $$('.workspace-mode').forEach(button => button.classList.toggle('active', button.dataset.workspace === state.workspace));
  $('#studyPanel').classList.toggle('hidden', state.workspace !== 'study');
  $('#solvePanel').classList.toggle('hidden', state.workspace !== 'solve');
  $('#problemType').value = state.problemType;
  $('#workspaceTypeBadge').textContent = problemTypeLabel();

  const inverse = state.problemType === 'inverse';
  const system = state.problemType === 'linearSystem';
  const matrixOperations = state.problemType === 'matrixOperations';
  $('#workspaceDescription').textContent = state.workspace === 'study'
    ? matrixOperations
      ? 'Pratique soma, subtração, produto, multiplicação por escalar, transpostas e classificação de matrizes.'
      : system
      ? 'Use operações de linha na matriz aumentada, acompanhe os pivôs e classifique as soluções do sistema.'
      : inverse
      ? 'Você realiza as operações em [A | I]; o sistema acompanha e confere cada passo.'
      : 'Você manipula a matriz, acompanha trocas e pode continuar por Laplace até chegar a Sarrus.'
    : matrixOperations
      ? 'As operações com matrizes ficam disponíveis no modo ESTUDAR.'
      : system
      ? 'O sistema reduz a matriz aumentada e classifica o sistema como possível determinado, possível indeterminado ou impossível.'
      : inverse
      ? 'O sistema mostra uma resolução completa da inversa por Gauss-Jordan.'
      : 'Escolha o método e compare uma resolução completa do determinante.';

  if (state.workspace === 'study') refreshStudy();
  else refreshSolve();
}

function studySourceMatrixForSolve() {
  const session = ensureStudySession(state.problemType);
  if (!session) return state.baseMatrix;
  if (state.problemType === 'inverse') {
    const size = session.augmentedAt;
    return session.initialMatrix.map(row => row.slice(0, size));
  }
  return session.currentMatrix;
}

// -----------------------------------------------------------------------------
// Study view
// -----------------------------------------------------------------------------

function refreshStudy() {
  const session = currentSession();
  const inverse = state.problemType === 'inverse';
  const system = state.problemType === 'linearSystem';
  const matrixOperations = state.problemType === 'matrixOperations';
  $('#studyTitle').textContent = matrixOperations ? 'Estudar operações com matrizes' : system ? 'Estudar sistemas lineares' : inverse ? 'Estudar inversa' : 'Estudar determinante';
  $('#studySubtitle').textContent = matrixOperations
    ? 'Monte A, B, C... e resolva expressões algébricas passo a passo, conferindo cada matriz intermediária.'
    : system
    ? 'Interprete a última coluna como os termos independentes e reduza a matriz aumentada por operações de linha.'
    : inverse
    ? 'Transforme [A | I] em [I | A⁻¹] usando operações de linha.'
    : 'Faça operações, acompanhe o efeito das trocas e siga por Laplace/Sarrus quando desejar.';

  if (!session) {
    $('#studyMatrix').innerHTML = '<div class="feedback error">Este modo exige uma matriz quadrada.</div>';
    return;
  }

  UI.renderMatrix($('#studyMatrix'), session.currentMatrix, {
    divider: session.augmentedAt,
    highlights: matrixOperations ? [] : operationHighlights(session),
    title: matrixOperations ? 'Matriz A' : inverse ? 'Matriz aumentada [A | I]' : system ? 'Matriz aumentada [A | b]' : 'Matriz atual'
  });

  $('#detStudyStats').classList.toggle('hidden', inverse || system || matrixOperations);
  $('#detStudyTools').classList.toggle('hidden', inverse || system || matrixOperations);
  $('#rowOperationCard').classList.toggle('hidden', matrixOperations);
  $('.history-card').classList.toggle('hidden', matrixOperations);
  $('#inverseStudyActions').classList.toggle('hidden', !inverse);
  $('#systemStudyActions').classList.toggle('hidden', !system);
  $('#matrixOperationsActions').classList.toggle('hidden', !matrixOperations);
  $('#hintBtn').classList.toggle('hidden', !inverse);
  $('#opCount').textContent = `${Math.max(0, session.history.length - 1)} operações`;

  refreshOperationSelectors();
  renderHistory();
  updateSwapPanel();
  updateInverseStatus();
  updateSystemStatus();
  if (matrixOperations) refreshMatrixOperationsStudy();
  if (state.operationMode === 'manual') prepareManualEditor();
  if (!inverse) renderLaplaceStudy();
}

function updateSwapPanel() {
  const session = state.sessions.determinant;
  const stats = H.swapStats(session);
  $('#rowSwapCount').textContent = stats.rowSwaps;
  $('#colSwapCount').textContent = stats.columnSwaps;
  $('#swapTotal').textContent = stats.total;
  $('#swapSign').textContent = stats.sign > 0 ? '+1' : '−1';
}

function readOperation() {
  const type = $('#opType').value;
  const operation = {
    type,
    rowA: Number($('#rowA').value),
    rowB: Number($('#rowB').value),
    k: '1'
  };
  if (!['swap', 'swapCol'].includes(type)) operation.k = M.Fraction.from($('#kInput').value);
  return operation;
}

function operationHighlights(session = currentSession()) {
  if (!session) return [];
  let operation;
  try { operation = readOperation(); } catch { return []; }
  const rows = session.currentMatrix.length;
  const cols = session.currentMatrix[0].length;
  const highlights = [];
  if (operation.type === 'swapCol') {
    for (let row = 0; row < rows; row++) {
      highlights.push({ row, col: operation.rowA, state: 'target' });
      highlights.push({ row, col: operation.rowB, state: 'target' });
    }
    return highlights;
  }
  for (let col = 0; col < cols; col++) {
    highlights.push({ row: operation.rowA, col, state: 'target' });
    if (operation.type === 'add') {
      highlights.push({ row: operation.rowB, col, state: 'pivot' });
    } else if (operation.type === 'swap') {
      highlights.push({ row: operation.rowB, col, state: 'target' });
    }
  }
  return highlights;
}

function refreshOperationSelectors() {
  const session = currentSession();
  if (!session) return;
  const inverse = state.problemType === 'inverse';
  const system = state.problemType === 'linearSystem';
  const swapColOption = $('#opType').querySelector('option[value="swapCol"]');
  swapColOption.disabled = inverse || system;
  if ((inverse || system) && $('#opType').value === 'swapCol') $('#opType').value = 'swap';

  const type = $('#opType').value;
  const columns = type === 'swapCol';
  const limit = columns ? session.currentMatrix[0].length : session.currentMatrix.length;
  const a = $('#rowA');
  const b = $('#rowB');
  const prevA = a.value;
  const prevB = b.value;
  [a, b].forEach(select => {
    select.innerHTML = '';
    for (let i = 0; i < limit; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = `${columns ? 'C' : 'L'}${i + 1}`;
      select.appendChild(option);
    }
  });
  if ([...a.options].some(option => option.value === prevA)) a.value = prevA;
  if ([...b.options].some(option => option.value === prevB)) b.value = prevB;
  updateOperationControls();
}

function updateOperationControls() {
  const type = $('#opType').value;
  const columns = type === 'swapCol';
  const rowAValue = $('#rowA').value;
  [...$('#rowB').options].forEach(option => {
    option.disabled = ['swap', 'swapCol'].includes(type) && option.value === rowAValue;
  });
  if (['swap', 'swapCol'].includes(type) && $('#rowB').value === rowAValue) {
    const alternative = [...$('#rowB').options].find(option => !option.disabled);
    if (alternative) $('#rowB').value = alternative.value;
  }
  $('#rowAWrap').childNodes[0].nodeValue = columns ? 'Coluna da operação ' : 'Linha da operação ';
  $('#rowBWrap').childNodes[0].nodeValue = columns ? 'Coluna de troca ' : 'Linha do pivô ';
  $('#rowBWrap').classList.toggle('hidden', type === 'scale');
  $('#kWrap').classList.toggle('hidden', ['swap', 'swapCol'].includes(type));
  try {
    $('#operationPreview').textContent = M.operationLabel(readOperation());
  } catch {
    $('#operationPreview').textContent = 'Revise o multiplicador.';
  }
  const session = currentSession();
  const swapImpossible = Boolean(session && ['swap', 'swapCol'].includes(type) && (columns ? session.currentMatrix[0].length : session.currentMatrix.length) < 2);
  $('#applyBtn').disabled = swapImpossible;
  $('#checkBtn').disabled = swapImpossible;
  if (swapImpossible) $('#operationPreview').textContent = columns ? 'Esta matriz não possui duas colunas diferentes para trocar.' : 'Esta matriz não possui duas linhas diferentes para trocar.';
  if (session && state.problemType !== 'matrixOperations' && $('#studyMatrix').children.length) {
    const inverse = state.problemType === 'inverse';
    const system = state.problemType === 'linearSystem';
    UI.renderMatrix($('#studyMatrix'), session.currentMatrix, {
      divider: session.augmentedAt,
      highlights: operationHighlights(session),
      title: inverse ? 'Matriz aumentada [A | I]' : system ? 'Matriz aumentada [A | b]' : 'Matriz atual'
    });
  }
  if (state.operationMode === 'manual' && session) prepareManualEditor();
}

function setOperationMode(mode) {
  state.operationMode = mode;
  $$('.operation-mode').forEach(button => button.classList.toggle('active', button.dataset.operationMode === mode));
  $('#manualEditorWrap').classList.toggle('hidden', mode !== 'manual');
  $('#applyBtn').classList.toggle('hidden', mode === 'manual');
  $('#checkBtn').classList.toggle('hidden', mode !== 'manual');
  if (mode === 'manual') prepareManualEditor();
}

function commitOperation(nextMatrix, operation) {
  const session = currentSession();
  const label = M.operationLabel(operation);
  H.commit(session, nextMatrix, operation, label);
  state.hintLevel = 0;
  state.laplace.frames = [];
  refreshStudy();
  UI.setFeedback($('#feedback'), `✓ Operação aplicada: ${label}.`, 'success');
}

function applyManagedOperation() {
  const session = currentSession();
  if (!session) return;
  try {
    const operation = readOperation();
    if (state.problemType !== 'determinant' && operation.type === 'swapCol') throw new Error('Troca de colunas não faz parte do Gauss-Jordan padrão.');
    commitOperation(M.applyOperation(session.currentMatrix, operation), operation);
  } catch (error) {
    UI.setFeedback($('#feedback'), error.message, 'error');
  }
}

function prepareManualEditor() {
  const session = currentSession();
  if (!session) return;
  UI.renderMatrix($('#manualEditor'), session.currentMatrix, {
    divider: session.augmentedAt,
    editable: true,
    highlights: operationHighlights(session),
    title: 'Resultado que você calculou'
  });
  renderCalculationGuide();
  $('#calculationGuide').classList.toggle('hidden', !state.showCalculationGuide);
  $('#showCalculationGuideBtn').textContent = state.showCalculationGuide ? 'Ocultar dica das contas' : '💡 Mostrar dica das contas';
  $('#changedSummary').textContent = 'Nenhuma célula alterada ainda.';
  const editableCells = new Set(operationHighlights(session)
    .filter(item => item.state === 'target')
    .map(item => `${item.row}:${item.col}`));
  const cols = session.currentMatrix[0].length;
  $('#manualEditor').querySelectorAll('.matrix-input').forEach((input, index) => {
    const inputRow = Math.floor(index / cols);
    const inputCol = index % cols;
    const editable = editableCells.has(`${inputRow}:${inputCol}`);
    input.readOnly = !editable;
    input.classList.toggle('locked-cell', !editable);
    input.setAttribute('aria-readonly', String(!editable));
    if (!editable) input.title = 'Somente as células amarelas podem ser editadas';
    input.addEventListener('input', () => updateManualChangedPreview());
    input.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const cols = session.currentMatrix[0].length;
      const row = Math.floor(index / cols);
      const col = index % cols;
      input.value = session.currentMatrix[row][col].toString();
      updateManualChangedPreview();
    });
  });
}

function renderCalculationGuide() {
  const session = currentSession();
  if (!session) return;
  const guide = $('#calculationGuide');
  try {
    const operation = readOperation();
    const formulas = [];
    if (operation.type === 'scale') {
      session.currentMatrix[operation.rowA].forEach((value, col) => {
        formulas.push(`c${col + 1}: ${value} × ${operation.k}`);
      });
    } else if (operation.type === 'add') {
      session.currentMatrix[operation.rowA].forEach((value, col) => {
        formulas.push(`c${col + 1}: ${value} + (${operation.k} × ${session.currentMatrix[operation.rowB][col]})`);
      });
    } else {
      formulas.push(M.operationLabel(operation), 'Os valores destacados trocam de posição; os demais permanecem iguais.');
    }
    guide.innerHTML = `<strong>Contas deste passo</strong><div class="calculation-list">${formulas.map(text => `<code>${UI.escapeHTML(text)}</code>`).join('')}</div>`;
  } catch {
    guide.textContent = 'Digite um multiplicador válido para visualizar as contas.';
  }
}

function toggleCalculationGuide() {
  state.showCalculationGuide = !state.showCalculationGuide;
  $('#calculationGuide').classList.toggle('hidden', !state.showCalculationGuide);
  $('#showCalculationGuideBtn').textContent = state.showCalculationGuide ? 'Ocultar dica das contas' : '💡 Mostrar dica das contas';
}

function updateManualChangedPreview() {
  const session = currentSession();
  if (!session) return;
  const changed = UI.updateChangedCells($('#manualEditor'), session.currentMatrix);
  $('#changedSummary').innerHTML = changed.length
    ? `<span>Alteradas:</span> ${changed.map(({ row, col }) => `<button class="restore-cell" type="button" data-restore-row="${row}" data-restore-col="${col}">↶ (${row + 1},${col + 1})</button>`).join(' ')}`
    : 'Nenhuma alteração matemática em relação à matriz anterior.';
}

function restoreManualCell(row, col) {
  const session = currentSession();
  if (!session) return;
  const cols = session.currentMatrix[0].length;
  const input = $('#manualEditor').querySelectorAll('.matrix-input')[row * cols + col];
  if (!input) return;
  input.value = session.currentMatrix[row][col].toString();
  updateManualChangedPreview();
  input.focus();
}

function markManualValidation(expected, actual, previous) {
  const inputs = [...$('#manualEditor').querySelectorAll('.matrix-input')];
  const cols = expected[0].length;
  inputs.forEach((input, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    input.classList.remove('correct-cell', 'error-cell');
    if (input.readOnly) return;
    const correct = M.Fraction.from(actual[row][col]).equals(expected[row][col]);
    if (!correct) {
      input.classList.add('error-cell');
      input.dataset.cellState = 'error';
      input.title = '✕ Valor incorreto';
    }
  });
}

function checkManualOperation() {
  const session = currentSession();
  if (!session) return;
  try {
    const operation = readOperation();
    if (state.problemType !== 'determinant' && operation.type === 'swapCol') throw new Error('Troca de colunas está bloqueada no método de Gauss-Jordan.');
    const expected = M.applyOperation(session.currentMatrix, operation);
    const actual = UI.parseGrid($('#manualEditor'));
    markManualValidation(expected, actual, session.currentMatrix);

    if (M.matricesEqual(actual, expected)) {
      commitOperation(actual, operation);
      return;
    }
    UI.setFeedback($('#feedback'), 'Há valores incorretos nas células vermelhas. Revise apenas as linhas ou colunas amarelas.', 'error');
  } catch (error) {
    UI.setFeedback($('#feedback'), error.message, 'error');
  }
}

function undo() {
  const session = currentSession();
  if (!H.undo(session)) return UI.setFeedback($('#feedback'), 'Não há operação para desfazer.', 'warn');
  state.laplace.frames = [];
  refreshStudy();
  UI.setFeedback($('#feedback'), 'Última operação desfeita.', 'info');
}

function redo() {
  const session = currentSession();
  const step = H.redo(session);
  if (!step) return UI.setFeedback($('#feedback'), 'Não há operação para refazer.', 'warn');
  refreshStudy();
  UI.setFeedback($('#feedback'), `Operação refeita: ${step.description}.`, 'info');
}

function restart() {
  const session = currentSession();
  H.restart(session);
  state.laplace.frames = [];
  refreshStudy();
  UI.setFeedback($('#feedback'), 'Sessão reiniciada.', 'info');
}

function renderHistory() {
  const session = currentSession();
  const target = $('#history');
  target.innerHTML = '';
  if (!session) return;
  session.history.forEach(step => {
    const card = document.createElement('article');
    card.className = 'history-step';
    const title = document.createElement('div');
    title.className = 'history-step-title';
    title.textContent = step.step === 0 ? 'Passo 0 — Matriz inicial' : `Passo ${step.step} — ${step.description}`;
    card.appendChild(title);
    if (step.operation) {
      const code = document.createElement('code');
      code.textContent = JSON.stringify(step.operation);
      card.appendChild(code);
    }
    const holder = document.createElement('div');
    card.appendChild(holder);
    UI.renderMatrix(holder, step.after, {
      divider: session.augmentedAt,
      title: `Matriz do passo ${step.step}`,
      compact: true
    });
    target.appendChild(card);
  });
}

function updateInverseStatus() {
  const box = $('#inverseStatus');
  if (state.problemType !== 'inverse') return;
  const session = currentSession();
  if (!session) return UI.setFeedback(box, 'A inversa exige uma matriz quadrada.', 'error');
  const size = session.augmentedAt;
  const left = session.currentMatrix.map(row => row.slice(0, size));
  if (M.isIdentity(left, size)) UI.setFeedback(box, '✓ Inversa encontrada. O lado esquerdo é I e o lado direito é A⁻¹.', 'success');
  else if (M.determinant(state.baseMatrix).value.isZero()) UI.setFeedback(box, 'Esta matriz é singular (det(A) = 0) e não possui inversa.', 'warn');
  else UI.setFeedback(box, 'Continue até transformar o lado esquerdo em I.', 'info');
}

function resetAugmented() {
  state.sessions.inverse = createStudySession('inverse');
  refreshStudy();
}

function verifyInverse() {
  const session = currentSession();
  if (!session) return;
  const size = session.augmentedAt;
  const left = session.currentMatrix.map(row => row.slice(0, size));
  if (!M.isIdentity(left, size)) return UI.setFeedback($('#inverseStatus'), 'O lado esquerdo ainda não é a identidade.', 'warn');
  const inverse = session.currentMatrix.map(row => row.slice(size));
  const valid = M.isIdentity(M.multiplyMatrices(state.baseMatrix, inverse), size);
  UI.setFeedback($('#inverseStatus'), valid ? '✓ Verificação concluída: A × A⁻¹ = I.' : 'A multiplicação não resultou em I.', valid ? 'success' : 'error');
}

function systemResultHTML(result, { includeSteps = false } = {}) {
  const variableNames = systemVariableNames(result.rref[0].length - 1);
  let conclusion;
  if (result.type === 'unique') {
    conclusion = `<div class="feedback success"><strong>SPD — sistema possível determinado.</strong><div class="solution-values">${result.solution.map((value, index) => `<span>${variableNames[index]} = ${UI.fractionHTML(value)}</span>`).join('')}</div></div>`;
  } else if (result.type === 'infinite') {
    conclusion = `<div class="feedback warn"><strong>SPI — sistema possível indeterminado.</strong><p>Variáveis livres: ${result.freeColumns.map(col => variableNames[col]).join(', ')}. Há infinitas soluções.</p></div>`;
  } else {
    conclusion = `<div class="feedback error"><strong>SI — sistema impossível.</strong><p>A linha ${result.inconsistentRow + 1} representa 0 = ${UI.fractionHTML(result.rref[result.inconsistentRow].at(-1))}.</p></div>`;
  }
  const steps = includeSteps && result.steps.length
    ? `<div class="system-steps">${result.steps.map((step, index) => `<div class="solution-step"><strong>Passo ${index + 1}: ${UI.escapeHTML(step.op)}</strong>${UI.matrixHTML(step.matrix, { divider: step.matrix[0].length - 1, title: `Passo ${index + 1}` })}</div>`).join('')}</div>`
    : '';
  return `${steps}${UI.matrixHTML(result.rref, { divider: result.rref[0].length - 1, title: 'Forma escalonada reduzida' })}${conclusion}`;
}

function systemVariableNames(count) {
  const common = ['x', 'y', 'z', 'w'];
  return Array.from({ length: count }, (_, index) => common[index] || `x${index + 1}`);
}

function equationText(row) {
  const variables = systemVariableNames(row.length - 1);
  const parts = [];
  row.slice(0, -1).forEach((value, index) => {
    const fraction = M.Fraction.from(value);
    if (fraction.isZero()) return;
    const negative = fraction.n < 0;
    const absolute = fraction.abs();
    const coefficient = absolute.equals(new M.Fraction(1)) ? '' : absolute.toString();
    const term = `${coefficient}${variables[index]}`;
    if (!parts.length) parts.push(`${negative ? '−' : ''}${term}`);
    else parts.push(`${negative ? '−' : '+'} ${term}`);
  });
  return `${parts.join(' ') || '0'} = ${row.at(-1)}`;
}

function systemEquationsHTML(matrix, solution = null) {
  const checks = solution ? matrix.map(row => {
    const lhs = row.slice(0, -1).reduce((sum, value, index) => sum.add(M.Fraction.from(value).mul(solution[index])), new M.Fraction(0));
    const ok = lhs.equals(row.at(-1));
    return `<li><code>${UI.escapeHTML(equationText(row))}</code><span>${UI.fractionHTML(lhs)} = ${UI.fractionHTML(row.at(-1))} ${ok ? '✓' : '✕'}</span></li>`;
  }).join('') : matrix.map(row => `<li><code>${UI.escapeHTML(equationText(row))}</code></li>`).join('');
  return `<div class="equation-card"><h4>${solution ? 'Verificação da solução' : 'Sistema em forma de equações'}</h4><ol>${checks}</ol></div>`;
}

function cramerResultHTML(matrix) {
  const cramer = M.cramerRule(matrix);
  const classification = M.solveLinearSystem(matrix);
  const variables = systemVariableNames(matrix[0].length - 1);
  if (!cramer.applicable) {
    return `${systemEquationsHTML(matrix)}${UI.matrixHTML(cramer.coefficients, { title: 'Matriz dos coeficientes A' })}<div class="feedback warn"><strong>Regra de Cramer não aplicável.</strong><p>${UI.escapeHTML(cramer.reason)} O sistema ainda pode ser SPI ou SI; abaixo está a classificação por escalonamento.</p></div>${systemResultHTML(classification)}`;
  }
  const determinants = cramer.replacements.map((item, index) => `<article class="cramer-item">${UI.matrixHTML(item.matrix, { compact: true, title: `D${variables[index]}` })}<p>D${variables[index]} = <strong>${UI.fractionHTML(item.det)}</strong></p><p>${variables[index]} = D${variables[index]} ÷ D = ${UI.fractionHTML(item.det)} ÷ ${UI.fractionHTML(cramer.det)} = <strong>${UI.fractionHTML(cramer.solution[index])}</strong></p></article>`).join('');
  return `${systemEquationsHTML(matrix)}<div class="method-card"><h3>Regra de Cramer</h3>${UI.matrixHTML(cramer.coefficients, { title: 'D — matriz dos coeficientes' })}<div class="result-box">D = det(A) = <strong>${UI.fractionHTML(cramer.det)}</strong></div><div class="cramer-grid">${determinants}</div></div>${systemEquationsHTML(matrix, cramer.solution)}`;
}

function elementarySystemResultHTML(matrix, method) {
  const result = M.solveTwoByTwoMethod(matrix, method);
  const names = { addition: 'Adição', substitution: 'Substituição', comparison: 'Comparação' };
  if (result.type !== 'unique') {
    return `${systemEquationsHTML(matrix)}<div class="feedback warn">O método foi interrompido porque este sistema não possui uma solução única.</div>${systemResultHTML(result)}`;
  }
  return `${systemEquationsHTML(matrix)}<div class="method-card"><h3>Método da ${names[method]}</h3><ol class="steps">${result.steps.map(step => `<li>${UI.escapeHTML(step)}</li>`).join('')}</ol></div>${systemEquationsHTML(matrix, result.solution)}${systemResultHTML(result)}`;
}

function renderSystemByMethod(matrix, method, { includeSteps = false } = {}) {
  if (method === 'cramer') return cramerResultHTML(matrix);
  if (['addition', 'substitution', 'comparison'].includes(method)) return elementarySystemResultHTML(matrix, method);
  const result = M.solveLinearSystem(matrix, includeSteps);
  return `${systemEquationsHTML(matrix)}${systemResultHTML(result, { includeSteps })}${result.type === 'unique' ? systemEquationsHTML(matrix, result.solution) : ''}`;
}

function updateSystemMethodControls() {
  const study = $('#systemStudyMethod');
  const solve = $('#solveSystemMethod');
  const matrix = state.problemType === 'linearSystem' ? (currentSession()?.currentMatrix || state.solveMatrix) : null;
  const isTwoByTwo = matrix?.length === 2 && matrix[0]?.length === 3;
  [study, solve].forEach(select => {
    if (!select) return;
    ['addition', 'substitution', 'comparison'].forEach(value => {
      const option = select.querySelector(`option[value="${value}"]`);
      if (option) option.disabled = !isTwoByTwo;
    });
    if (select.selectedOptions[0]?.disabled) select.value = 'gauss';
  });
  if (solve) {
    const labels = { gauss: 'Resolver por Gauss-Jordan', cramer: 'Resolver pela Regra de Cramer', addition: 'Resolver por adição', substitution: 'Resolver por substituição', comparison: 'Resolver por comparação' };
    $('#solveSystemBtn').textContent = labels[solve.value] || 'Resolver sistema';
  }
}

function updateSystemStatus() {
  if (state.problemType !== 'linearSystem') return;
  const session = currentSession();
  if (!session) return UI.setFeedback($('#systemStatus'), 'Use uma matriz aumentada com ao menos duas colunas.', 'error');
  const variables = session.currentMatrix[0].length - 1;
  UI.setFeedback($('#systemStatus'), `Sistema com ${variables} incógnita(s) e ${session.currentMatrix.length} equação(ões). A última coluna é b.`, 'info');
  updateSystemMethodControls();
}

function analyzeCurrentSystem() {
  const session = currentSession();
  if (!session) return;
  try {
    $('#systemStudyOutput').innerHTML = renderSystemByMethod(session.currentMatrix, $('#systemStudyMethod').value);
  } catch (error) {
    $('#systemStudyOutput').innerHTML = `<div class="feedback error">${UI.escapeHTML(error.message)}</div>`;
  }
}

function refreshMatrixOperationsStudy() {
  const output = $('#matrixReferences');
  if (!Object.keys(state.matrixOperands).length && state.baseMatrix) state.matrixOperands = { A: M.cloneMatrix(state.baseMatrix) };
  const entries = Object.entries(state.matrixOperands);
  output.innerHTML = entries.length
    ? entries.map(([name, matrix]) => `<div class="reference-card"><div class="reference-label">${name}</div>${UI.matrixHTML(matrix, { title: `Matriz ${name}`, compact: true })}</div>`).join('')
    : '<div class="feedback info">Carregue as matrizes A, B, C... na área de entrada acima.</div>';
  const input = $('#matrixExpressionInput');
  if (entries.length >= 2 && (!input.value.trim() || !entries.some(([name]) => input.value.includes(name)))) input.value = 'A + B';
}

function matrixExpressionStepDetails(step) {
  if (step.type === 'scale') {
    const matrix = step.leftKind === 'matrix' ? step.left : step.right;
    const scalar = step.leftKind === 'scalar' ? step.left : step.right;
    return `<ol class="matrix-cell-steps">${step.result.map((row, i) => row.map((value, j) => `<li>(${i + 1},${j + 1}): ${UI.fractionHTML(matrix[i][j])} × ${UI.fractionHTML(scalar)} = ${UI.fractionHTML(value)}</li>`).join('')).join('')}</ol>`;
  }
  if (step.type === 'add' || step.type === 'subtract') {
    const symbol = step.type === 'add' ? '+' : '−';
    return `<ol class="matrix-cell-steps">${step.result.map((row, i) => row.map((value, j) => `<li>(${i + 1},${j + 1}): ${UI.fractionHTML(step.left[i][j])} ${symbol} ${UI.fractionHTML(step.right[i][j])} = ${UI.fractionHTML(value)}</li>`).join('')).join('')}</ol>`;
  }
  if (step.type === 'multiply') {
    return `<ol class="matrix-cell-steps">${step.result.map((row, i) => row.map((value, j) => {
      const products = step.left[i].map((entry, k) => `${M.Fraction.from(entry)}·${M.Fraction.from(step.right[k][j])}`).join(' + ');
      return `<li>(${i + 1},${j + 1}): ${UI.escapeHTML(products)} = ${UI.fractionHTML(value)}</li>`;
    }).join('')).join('')}</ol>`;
  }
  return '';
}

function renderMatrixExpression(evaluation, practice = false) {
  state.matrixExpressionPractice = practice ? evaluation : null;
  const output = $('#matrixOperationsOutput');
  const steps = evaluation.steps.map((step, index) => {
    const title = `Etapa ${index + 1} — ${UI.escapeHTML(step.expression)}`;
    if (!practice) {
      return `<article class="expression-step"><div class="expression-step-head"><strong>${title}</strong><span class="step-kind">${step.type === 'multiply' ? 'produto matricial' : step.type === 'scale' ? 'multiplicação por escalar' : step.type === 'add' ? 'soma' : 'subtração'}</span></div>${matrixExpressionStepDetails(step)}${UI.matrixHTML(step.result, { title: `Resultado da etapa ${index + 1}`, compact: true })}</article>`;
    }
    return `<article class="expression-step practice-step" data-expression-step="${index}"><div class="expression-step-head"><strong>${title}</strong><span class="step-kind">Resolva esta etapa</span></div><p class="small-note">Digite a matriz resultante. O sistema compara cada posição com a resposta exata.</p><div class="expression-practice-editor" data-expression-editor="${index}"></div><div class="toolbar"><button type="button" data-expression-check="${index}">Conferir etapa</button><button class="ghost" type="button" data-expression-reveal="${index}">Mostrar resposta</button><button class="ghost" type="button" data-expression-copy="${index}">⧉ Copiar meu JSON</button></div><div class="expression-step-feedback small-note" data-expression-feedback="${index}"></div></article>`;
  }).join('');
  output.innerHTML = `<div class="expression-summary"><span>Expressão</span><strong>${UI.escapeHTML(evaluation.expression)}</strong><p>Matrizes usadas: ${evaluation.references.join(', ') || '—'}</p></div>${steps}<div class="expression-final"><h3>Resultado final</h3>${practice ? '<p>Conclua as etapas acima ou revele a solução quando quiser comparar.</p>' : UI.matrixHTML(evaluation.result, { title: evaluation.expression })}</div>`;
  if (practice) {
    evaluation.steps.forEach((step, index) => {
      const host = output.querySelector(`[data-expression-editor="${index}"]`);
      UI.makeEditor(host, step.result.length, step.result[0].length);
    });
  }
}

function calculateMatrixExpression(practice = false) {
  try {
    if (!Object.keys(state.matrixOperands).length) throw new Error('Carregue as matrizes antes de montar a expressão.');
    const evaluation = M.evaluateMatrixExpression($('#matrixExpressionInput').value, state.matrixOperands);
    renderMatrixExpression(evaluation, practice);
  } catch (error) {
    $('#matrixOperationsOutput').innerHTML = `<div class="feedback error">${UI.escapeHTML(error.message)}</div>`;
  }
}

function checkMatrixExpressionStep(index) {
  const evaluation = state.matrixExpressionPractice;
  const step = evaluation?.steps?.[index];
  if (!step) return;
  const card = $(`[data-expression-step="${index}"]`);
  const editor = card.querySelector(`[data-expression-editor="${index}"]`);
  const feedback = card.querySelector(`[data-expression-feedback="${index}"]`);
  try {
    const actual = UI.parseGrid(editor);
    UI.markComparison(editor, step.result, actual);
    if (M.matricesEqual(actual, step.result)) {
      card.dataset.correct = 'true';
      feedback.innerHTML = '<strong class="text-success">✓ Etapa correta.</strong> Continue para a próxima transformação.';
      const cards = [...$('#matrixOperationsOutput').querySelectorAll('.practice-step')];
      if (cards.length && cards.every(item => item.dataset.correct === 'true')) {
        $('#matrixOperationsOutput').querySelector('.expression-final').innerHTML = `<h3>✓ Expressão concluída</h3><p>Você acertou todas as matrizes intermediárias.</p>${UI.matrixHTML(evaluation.result, { title: evaluation.expression })}`;
      }
      return;
    }
    delete card.dataset.correct;
    const diff = M.firstDifference(actual, step.result);
    feedback.innerHTML = `<strong class="text-danger">✕ Há um erro em (${diff.row + 1},${diff.col + 1}).</strong> Você colocou ${UI.fractionHTML(diff.actual)}; o valor correto nesta etapa é ${UI.fractionHTML(diff.expected)}.`;
  } catch (error) {
    feedback.textContent = error.message;
  }
}

function revealMatrixExpressionStep(index) {
  const evaluation = state.matrixExpressionPractice;
  const step = evaluation?.steps?.[index];
  if (!step) return;
  const card = $(`[data-expression-step="${index}"]`);
  const editor = card.querySelector(`[data-expression-editor="${index}"]`);
  UI.makeEditor(editor, step.result.length, step.result[0].length, step.result);
  card.querySelector(`[data-expression-feedback="${index}"]`).innerHTML = 'Resposta exibida. Você ainda pode editar os valores e conferir novamente.';
}

function showHint() {
  const session = currentSession();
  if (!session) return;
  const operation = M.nextGaussJordanOperation(session.currentMatrix, session.augmentedAt);
  if (!operation) {
    const left = session.currentMatrix.map(row => row.slice(0, session.augmentedAt));
    const message = M.isIdentity(left, session.augmentedAt)
      ? 'O lado esquerdo já é a identidade. Agora confirme a inversa.'
      : 'Não há pivô não nulo disponível: a matriz é singular.';
    return UI.setFeedback($('#feedback'), `💡 ${message}`, 'info');
  }
  $('#opType').value = operation.type;
  refreshOperationSelectors();
  $('#rowA').value = operation.rowA;
  $('#rowB').value = operation.rowB;
  $('#kInput').value = M.Fraction.from(operation.k).toString();
  updateOperationControls();
  const reason = operation.type === 'swap'
    ? 'Há um 1 disponível nesta coluna; priorize colocá-lo como pivô.'
    : operation.type === 'scale'
      ? 'Não há 1 disponível nesta coluna; transforme o pivô atual em 1.'
      : 'O pivô já é 1; zere o próximo valor da coluna.';
  UI.setFeedback($('#feedback'), `💡 Próximo passo válido: ${M.operationLabel(operation)}. ${reason}`, 'info');
}

// -----------------------------------------------------------------------------
// Laplace study workflow
// -----------------------------------------------------------------------------

function newLaplaceFrame(matrix, label, parentFrameIndex = null, parentTermIndex = null) {
  return {
    matrix: M.cloneMatrix(matrix),
    label,
    axis: 'row',
    index: 0,
    terms: null,
    resolvedValue: matrix.length === 1 ? M.Fraction.from(matrix[0][0]) : null,
    parentFrameIndex,
    parentTermIndex,
    sarrusResult: null
  };
}

function startLaplaceStudy() {
  const session = state.sessions.determinant;
  if (!session || !M.isSquare(session.currentMatrix)) {
    $('#laplaceStudy').innerHTML = '<div class="feedback error">Laplace exige uma matriz quadrada.</div>';
    return;
  }
  if (session.currentMatrix.length < 2) return;
  state.laplace.frames = [newLaplaceFrame(session.currentMatrix, 'Matriz atual')];
  renderLaplaceStudy();
}

function currentLaplaceFrame() {
  return state.laplace.frames.at(-1) || null;
}

function computeFrameValue(frame) {
  if (!frame.terms || frame.terms.some(term => term.status === 'pending')) return null;
  return frame.terms.reduce((sum, term) => sum.add(term.contribution || new M.Fraction(0)), new M.Fraction(0));
}

function propagateResolvedFrame(frameIndex) {
  const frame = state.laplace.frames[frameIndex];
  if (!frame || frame.resolvedValue == null || frame.parentFrameIndex == null) return;
  const parent = state.laplace.frames[frame.parentFrameIndex];
  const term = parent?.terms?.[frame.parentTermIndex];
  if (!term) return;
  term.minorResult = M.Fraction.from(frame.resolvedValue);
  term.contribution = term.element.mul(new M.Fraction(term.sign)).mul(term.minorResult);
  term.status = 'resolved';
  term.resolutionTrace = { label: frame.label, matrix: M.cloneMatrix(frame.matrix), value: M.Fraction.from(frame.resolvedValue) };
  const parentValue = computeFrameValue(parent);
  if (parentValue) {
    parent.resolvedValue = parentValue;
    propagateResolvedFrame(frame.parentFrameIndex);
  }
}

function checkLaplaceMinor(termIndex) {
  const frame = currentLaplaceFrame();
  const term = frame?.terms?.[termIndex];
  const input = $(`[data-laplace-minor-input="${termIndex}"]`);
  if (!term || !input) return;
  input.classList.remove('error-cell');
  try {
    const value = M.Fraction.from(input.value);
    if (!value.equals(term.minorDet)) {
      input.classList.add('error-cell');
      return;
    }
    term.minorResult = value;
    term.contribution = term.element.mul(new M.Fraction(term.sign)).mul(value);
    term.status = 'resolved';
    const frameValue = computeFrameValue(frame);
    if (frameValue) {
      frame.resolvedValue = frameValue;
      propagateResolvedFrame(state.laplace.frames.length - 1);
    }
    renderLaplaceStudy();
  } catch {
    input.classList.add('error-cell');
  }
}

function laplaceCalculationHTML(frame) {
  if (!frame?.terms) return '';
  const pieces = frame.terms.map(term => {
    const sign = term.sign > 0 ? '+' : '−';
    const minor = term.minorResult == null ? `det(M${term.row + 1}${term.col + 1})` : term.minorResult.toString();
    return `${sign} (${term.element}) × (${minor})`;
  });
  const contributions = frame.terms.every(term => term.contribution != null)
    ? `<p>${frame.terms.map(term => term.contribution.toString()).join(' + ')} = <strong>${frame.resolvedValue}</strong></p>`
    : '<p class="small-note">Preencha ou resolva todos os menores para concluir a soma.</p>';
  return `<div class="laplace-calculation"><h4>Cálculos realizados</h4><p>${UI.escapeHTML(pieces.join(' '))}</p>${contributions}</div>`;
}

function renderDetMatrixContext() {
  const host = $('#detMatrixContext');
  const session = state.sessions.determinant;
  if (!host || !session) return;
  const frame = currentLaplaceFrame();
  host.innerHTML = `<div class="matrix-context-grid">
    <article><h4>Matriz original</h4><p>Base carregada no início.</p>${UI.matrixHTML(state.baseMatrix, { compact: true, title: 'Original' })}</article>
    <article><h4>Matriz atual</h4><p>Inclui operações de linhas, colunas e escalas já confirmadas.</p>${UI.matrixHTML(session.currentMatrix, { compact: true, title: 'Atual' })}</article>
    <article><h4>Matriz modificada</h4><p>${frame ? 'Menor que está sendo resolvido na expansão.' : 'Inicie Laplace para criar uma matriz modificada.'}</p>${frame ? UI.matrixHTML(frame.matrix, { compact: true, title: frame.label }) : ''}${frame ? '<button class="secondary" type="button" data-laplace-action="use-as-current">Usar como matriz atual</button>' : ''}</article>
  </div>`;
}

function useLaplaceFrameAsCurrent() {
  const frame = currentLaplaceFrame();
  if (!frame) return;
  state.sessions.determinant = H.createSession({ mode: 'study', problemType: 'determinant', initialMatrix: frame.matrix });
  state.laplace.frames = [];
  refreshStudy();
  UI.setFeedback($('#feedback'), 'A matriz modificada agora é a matriz atual. A matriz original continua preservada acima.', 'success');
}

function expandLaplaceFrame(axis, index, { autoDescend = true } = {}) {
  const frame = currentLaplaceFrame();
  if (!frame) return;
  frame.axis = axis;
  frame.index = index;
  const expansion = M.laplaceExpansion(frame.matrix, axis, index);
  frame.terms = expansion.terms.map(term => {
    const zero = term.element.isZero();
    const minorResult = zero ? new M.Fraction(0) : null;
    return {
      ...term,
      status: zero ? 'resolved' : 'pending',
      minorResult,
      contribution: zero ? new M.Fraction(0) : null
    };
  });
  const value = computeFrameValue(frame);
  if (value) {
    frame.resolvedValue = value;
    propagateResolvedFrame(state.laplace.frames.length - 1);
  }

  const pendingNonZero = frame.terms
    .map((term, termIndex) => ({ term, termIndex }))
    .filter(item => item.term.status === 'pending' && !item.term.element.isZero());
  if (autoDescend && pendingNonZero.length === 1 && frame.matrix.length > 3) {
    const { termIndex } = pendingNonZero[0];
    openLaplaceTerm(termIndex, true);
    UI.showToast('Apenas um termo não nulo: avançamos para o menor correspondente.');
    return;
  }
  renderLaplaceStudy();
}

function openLaplaceTerm(termIndex, automatic = false) {
  const parentIndex = state.laplace.frames.length - 1;
  const parent = state.laplace.frames[parentIndex];
  const term = parent?.terms?.[termIndex];
  if (!term || term.status !== 'pending') return;
  const label = `M${term.row + 1}${term.col + 1}`;
  const child = newLaplaceFrame(term.minor, label, parentIndex, termIndex);
  state.laplace.frames.push(child);
  if (child.matrix.length === 1) propagateResolvedFrame(state.laplace.frames.length - 1);
  renderLaplaceStudy();
  if (!automatic) UI.showToast(`${label} aberto para continuar a resolução.`);
}

function resolveLaplaceFrameWithSarrus() {
  const frame = currentLaplaceFrame();
  if (!frame || frame.matrix.length !== 3) return;
  frame.sarrusResult = M.determinantSarrus(frame.matrix);
  frame.resolvedValue = frame.sarrusResult.value;
  propagateResolvedFrame(state.laplace.frames.length - 1);
  renderLaplaceStudy();
}

function resolveLaplaceFrameDirect2x2() {
  const frame = currentLaplaceFrame();
  if (!frame || frame.matrix.length !== 2) return;
  frame.resolvedValue = M.determinant2x2(frame.matrix);
  propagateResolvedFrame(state.laplace.frames.length - 1);
  renderLaplaceStudy();
}

function recommendLaplace() {
  const frame = currentLaplaceFrame() || (state.sessions.determinant ? newLaplaceFrame(state.sessions.determinant.currentMatrix, 'Matriz atual') : null);
  if (!frame || !M.isSquare(frame.matrix)) return;
  if (!state.laplace.frames.length) state.laplace.frames = [frame];
  const recommendation = M.recommendLaplaceAxis(frame.matrix);
  frame.axis = recommendation.axis;
  frame.index = recommendation.index;
  $('#laplaceSuggestion').textContent = `Sugestão: ${recommendation.axis === 'row' ? 'Linha' : 'Coluna'} ${recommendation.index + 1}, com ${recommendation.zeros} zero(s).`;
  renderLaplaceStudy();
}

function sarrusHTML(matrix, label) {
  const result = M.determinantSarrus(matrix);
  const expanded = matrix.map(row => [...row, row[0], row[1]]);
  const grid = expanded.map((row, r) => row.map((value, c) => `<div class="sarrus-cell${c >= 3 ? ' duplicate' : ''}">${UI.fractionHTML(value)}</div>`).join('')).join('');
  const positives = result.positiveTerms.map(term => `<div class="term-row">+ ${term.factors.map(UI.fractionHTML).join(' × ')} = ${UI.fractionHTML(term.product)}</div>`).join('');
  const negatives = result.negativeTerms.map(term => `<div class="term-row">− ${term.factors.map(UI.fractionHTML).join(' × ')} = ${UI.fractionHTML(term.product)}</div>`).join('');
  return `<div class="method-card">
    <div class="method-header"><div><h3>Sarrus — ${UI.escapeHTML(label)}</h3><p>As duas primeiras colunas são repetidas à direita.</p></div></div>
    ${UI.matrixHTML(matrix, { title: label })}
    <div class="sarrus-board"><div class="sarrus-grid">${grid}</div></div>
    <div class="sarrus-terms"><div class="term-list"><h4>Diagonais positivas</h4>${positives}<strong>Soma: ${UI.fractionHTML(result.posSum)}</strong></div><div class="term-list"><h4>Diagonais negativas</h4>${negatives}<strong>Soma: ${UI.fractionHTML(result.negSum)}</strong></div></div>
    <div class="result-box">${UI.fractionHTML(result.posSum)} − (${UI.fractionHTML(result.negSum)}) = <strong>${UI.fractionHTML(result.value)}</strong></div>
  </div>`;
}

function sarrusPracticeHTML(matrix, label) {
  const result = M.determinantSarrus(matrix);
  const expanded = matrix.map(row => [...row, row[0], row[1]]);
  const grid = expanded.map((row, r) => row.map((value, c) => `<div class="sarrus-cell${c >= 3 ? ' duplicate' : ''}" data-grid-row="${r}" data-grid-col="${c}">${UI.fractionHTML(value)}</div>`).join('')).join('');
  const paths = {
    positive: [
      [[0, 0], [1, 1], [2, 2]], [[0, 1], [1, 2], [2, 3]], [[0, 2], [1, 3], [2, 4]]
    ],
    negative: [
      [[0, 2], [1, 1], [2, 0]], [[0, 3], [1, 2], [2, 1]], [[0, 4], [1, 3], [2, 2]]
    ]
  };
  const field = (kind, index, factors) => {
    const path = paths[kind][index].map(([row, col]) => `${row}:${col}`).join(',');
    return `<label class="sarrus-entry"><span>${factors.map(value => UI.fractionHTML(value)).join(' × ')}</span><input inputmode="text" data-sarrus-kind="${kind}" data-sarrus-index="${index}" data-sarrus-path="${path}" placeholder="produto" aria-label="Produto ${kind} ${index + 1}"></label>`;
  };
  return `<div class="method-card sarrus-practice" data-sarrus-label="${UI.escapeHTML(label)}">
    <div class="method-header"><div><h3>Sarrus para praticar — ${UI.escapeHTML(label)}</h3><p>Use as diagonais da grade, digite cada produto e depois as somas.</p></div></div>
    <div class="sarrus-board"><div class="sarrus-grid">${grid}</div></div>
    <div class="sarrus-terms">
      <div class="term-list"><h4>Diagonais positivas</h4>${result.positiveTerms.map((term, index) => field('positive', index, term.factors)).join('')}<label>Soma positiva <input inputmode="text" data-sarrus-kind="posSum"></label></div>
      <div class="term-list"><h4>Diagonais negativas</h4>${result.negativeTerms.map((term, index) => field('negative', index, term.factors)).join('')}<label>Soma negativa <input inputmode="text" data-sarrus-kind="negSum"></label></div>
    </div>
    <label class="sarrus-final">Determinante = soma positiva − soma negativa <input inputmode="text" data-sarrus-kind="value"></label>
    <div class="toolbar"><button type="button" data-laplace-action="check-sarrus">Conferir meu Sarrus</button><button class="secondary" type="button" data-laplace-action="show-sarrus">Mostrar resolução</button></div>
    <div class="sarrus-feedback small-note"></div>
  </div>`;
}

function highlightSarrusDiagonal(input) {
  const card = input.closest('.sarrus-practice');
  if (!card) return;
  card.querySelectorAll('.sarrus-cell').forEach(cell => cell.classList.remove('active-positive', 'active-negative'));
  const path = input.dataset.sarrusPath;
  if (!path) return;
  const active = new Set(path.split(','));
  const className = input.dataset.sarrusKind === 'positive' ? 'active-positive' : 'active-negative';
  card.querySelectorAll('.sarrus-cell').forEach(cell => {
    if (active.has(`${cell.dataset.gridRow}:${cell.dataset.gridCol}`)) cell.classList.add(className);
  });
}

function checkSarrusPractice() {
  const frame = currentLaplaceFrame();
  const card = $('#laplaceStudy').querySelector('.sarrus-practice');
  if (!frame || !card) return;
  const result = M.determinantSarrus(frame.matrix);
  const expected = {
    positive: result.positiveTerms.map(term => term.product),
    negative: result.negativeTerms.map(term => term.product),
    posSum: result.posSum,
    negSum: result.negSum,
    value: result.value
  };
  let correct = true;
  card.querySelectorAll('input[data-sarrus-kind]').forEach(input => {
    const kind = input.dataset.sarrusKind;
    const answer = input.dataset.sarrusIndex == null ? expected[kind] : expected[kind][Number(input.dataset.sarrusIndex)];
    input.classList.remove('correct-cell', 'error-cell');
    try {
      const ok = M.Fraction.from(input.value).equals(answer);
      input.classList.add(ok ? 'correct-cell' : 'error-cell');
      correct = correct && ok;
    } catch {
      input.classList.add('error-cell');
      correct = false;
    }
  });
  const feedback = card.querySelector('.sarrus-feedback');
  feedback.textContent = correct ? `✓ Sarrus correto: det = ${result.value}.` : 'Revise os campos em vermelho. Aceitamos inteiros e frações.';
  feedback.className = `sarrus-feedback feedback ${correct ? 'success' : 'error'}`;
  if (correct) {
    frame.sarrusResult = result;
    frame.resolvedValue = result.value;
    propagateResolvedFrame(state.laplace.frames.length - 1);
  }
}

function determinantCorrectionHTML(currentDeterminant) {
  const session = state.sessions.determinant;
  if (!session) return '';
  const stats = H.swapStats(session);
  const factor = H.determinantTransformFactor(session);
  const original = M.Fraction.from(currentDeterminant).div(factor);
  const swapFactor = stats.sign > 0 ? '+1' : '−1';
  return `<div class="det-correction">
    <h4>Fechamento da sessão</h4>
    <p>Trocas: ${stats.rowSwaps} de linha + ${stats.columnSwaps} de coluna = ${stats.total}. Fator de sinal das trocas: <strong>${swapFactor}</strong>.</p>
    <p>Fator acumulado de todas as operações que alteram o determinante: <strong>${UI.fractionHTML(factor)}</strong>.</p>
    <p>det(matriz atual) = ${UI.fractionHTML(currentDeterminant)} ⇒ det(matriz inicial) = ${UI.fractionHTML(currentDeterminant)} ÷ ${UI.fractionHTML(factor)} = <strong>${UI.fractionHTML(original)}</strong>.</p>
  </div>`;
}

function renderLaplaceStudy() {
  const host = $('#laplaceStudy');
  host.innerHTML = '';
  const frame = currentLaplaceFrame();
  const session = state.sessions.determinant;
  renderDetMatrixContext();
  if (!frame) {
    $('#studySarrusBtn').disabled = !session || session.currentMatrix.length !== 3;
    return;
  }

  const frameIndex = state.laplace.frames.length - 1;
  const breadcrumb = state.laplace.frames.map((item, index) => `<span class="breadcrumb-item${index === frameIndex ? ' active' : ''}">${UI.escapeHTML(item.label)} • ${item.matrix.length}×${item.matrix.length}</span>`).join('');
  const recommendation = M.recommendLaplaceAxis(frame.matrix);
  const options = Array.from({ length: frame.matrix.length }, (_, index) => `<option value="${index}" ${index === frame.index ? 'selected' : ''}>${frame.axis === 'row' ? 'Linha' : 'Coluna'} ${index + 1}</option>`).join('');

  let body = '';
  if (frame.sarrusResult) {
    body = `${sarrusHTML(frame.matrix, frame.label)}<div class="feedback success">✓ ${frame.label} resolvido por Sarrus: ${UI.fractionHTML(frame.resolvedValue)}.</div>`;
  } else if (frame.matrix.length === 1) {
    body = `<div class="method-card"><h3>${UI.escapeHTML(frame.label)} — caso base 1×1</h3>${UI.matrixHTML(frame.matrix, { title: frame.label })}<div class="result-box">det(${UI.escapeHTML(frame.label)}) = <strong>${UI.fractionHTML(frame.resolvedValue)}</strong></div></div>`;
  } else if (frame.matrix.length === 3 && frame.practiceSarrus) {
    body = sarrusPracticeHTML(frame.matrix, frame.label);
  } else {
    const terms = frame.terms ? frame.terms.map((term, termIndex) => {
      const sign = term.sign > 0 ? '+' : '−';
      const minorLabel = `M${term.row + 1}${term.col + 1}`;
      const stateLabel = term.element.isZero() ? 'Termo zero' : term.status === 'resolved' ? `✓ ${minorLabel} = ${UI.fractionHTML(term.minorResult)}` : `○ ${minorLabel} pendente`;
      return `<article class="laplace-term${term.element.isZero() ? ' zero-term' : ''}">
        <h4>${sign} ${UI.fractionHTML(term.element)} · det(${minorLabel})</h4>
        ${UI.matrixHTML(term.minor, { compact: true, title: minorLabel })}
        <p class="term-status">${stateLabel}</p>
        ${term.contribution ? `<div><strong>Contribuição:</strong> ${UI.fractionHTML(term.contribution)}</div>` : ''}
        ${term.status === 'pending' ? `<label class="minor-answer">det(${minorLabel}) <input inputmode="text" value="${UI.escapeHTML(term.draft || '')}" data-laplace-minor-input="${termIndex}" aria-label="Determinante de ${minorLabel}"></label><button type="button" data-laplace-action="check-minor" data-term="${termIndex}">Conferir valor</button><button class="secondary" type="button" data-laplace-action="open" data-term="${termIndex}">Resolver este menor passo a passo</button>` : ''}
        ${term.resolutionTrace ? `<details><summary>Ver página resolvida</summary>${UI.matrixHTML(term.resolutionTrace.matrix, { compact: true, title: term.resolutionTrace.label })}<p>Resultado: ${UI.fractionHTML(term.resolutionTrace.value)}</p></details>` : ''}
      </article>`;
    }).join('') : '<p class="small-note">Escolha a linha ou coluna e clique em “Expandir agora”.</p>';

    body = `<div class="method-card">
      <div class="method-header"><div><h3>Expansão de Laplace — ${UI.escapeHTML(frame.label)}</h3><p>Escolha uma linha/coluna. O sistema mantém todos os termos pendentes enquanto você resolve cada menor.</p></div></div>
      ${UI.matrixHTML(frame.matrix, { title: frame.label })}
      <div class="laplace-picker">
        <label>Expandir por <select id="laplaceStudyAxis"><option value="row" ${frame.axis === 'row' ? 'selected' : ''}>Linha</option><option value="col" ${frame.axis === 'col' ? 'selected' : ''}>Coluna</option></select></label>
        <label>Índice <select id="laplaceStudyIndex">${options}</select></label>
        <button type="button" data-laplace-action="expand">Expandir agora</button>
        <button class="ghost" type="button" data-laplace-action="recommend">Sugestão: ${recommendation.axis === 'row' ? 'L' : 'C'}${recommendation.index + 1} (${recommendation.zeros} zeros)</button>
        ${frame.matrix.length === 3 ? '<button class="secondary" type="button" data-laplace-action="practice-sarrus">Praticar Sarrus nesta 3×3</button><button class="ghost" type="button" data-laplace-action="sarrus">Mostrar Sarrus resolvido</button>' : ''}
        ${frame.matrix.length === 2 ? '<button class="secondary" type="button" data-laplace-action="direct-2x2">Usar fórmula ad − bc</button>' : ''}
      </div>
      ${frame.terms ? `<div class="laplace-terms">${terms}</div>` : terms}
      ${laplaceCalculationHTML(frame)}
      ${frame.resolvedValue ? `<div class="feedback success">✓ ${frame.label} resolvido: ${UI.fractionHTML(frame.resolvedValue)}</div>` : ''}
    </div>`;
  }

  const correction = frameIndex === 0 && frame.resolvedValue ? determinantCorrectionHTML(frame.resolvedValue) : '';
  host.innerHTML = `<div class="laplace-breadcrumb">${breadcrumb}</div>${body}${correction}${frameIndex > 0 ? '<div class="toolbar"><button class="ghost" type="button" data-laplace-action="back">← Voltar ao termo anterior</button></div>' : ''}`;
  host.querySelectorAll('input').forEach(input => UI.wireSmartZeroInput(input));
  renderDetMatrixContext();
}

// -----------------------------------------------------------------------------
// Solve view
// -----------------------------------------------------------------------------

function refreshSolve() {
  const inverse = state.problemType === 'inverse';
  const system = state.problemType === 'linearSystem';
  const matrixOperations = state.problemType === 'matrixOperations';
  $('#solveTitle').textContent = matrixOperations ? 'Operações com matrizes' : system ? 'Resolver sistema linear' : inverse ? 'Resolver inversa' : 'Resolver determinante';
  $('#solveDetControls').classList.toggle('hidden', inverse || system || matrixOperations);
  $('#solveInverseControls').classList.toggle('hidden', !inverse);
  $('#solveSystemControls').classList.toggle('hidden', !system);
  if (!state.solveMatrix && state.baseMatrix) state.solveMatrix = M.cloneMatrix(state.baseMatrix);
  UI.renderMatrix($('#solveMatrix'), state.solveMatrix, { title: 'Matriz usada na resolução' });
  updateSolveMethodAvailability();
  if (system) updateSystemMethodControls();
  if (matrixOperations) $('#solveOutput').innerHTML = '<div class="feedback info">No modo ESTUDAR você pode montar A, B, C... e praticar uma expressão inteira passo a passo.</div>';
}

function useStudyMatrixInSolve() {
  const matrix = studySourceMatrixForSolve();
  if (!matrix) return;
  state.solveMatrix = M.cloneMatrix(matrix);
  UI.renderMatrix($('#solveMatrix'), state.solveMatrix, { title: 'Matriz importada do estudo' });
  $('#solveSourceMsg').textContent = '✓ Cópia da matriz atual do estudo carregada. Alterações futuras no estudo não mudarão esta cópia.';
  updateSolveMethodAvailability();
}

function updateSolveMethodAvailability() {
  const matrix = state.solveMatrix;
  const size = matrix?.length || 0;
  const option = $('#solveDetMethod').querySelector('option[value="sarrus"]');
  if (option) option.disabled = !matrix || !M.isSquare(matrix) || size !== 3;
  if ($('#solveDetMethod').value === 'sarrus' && option.disabled) $('#solveDetMethod').value = 'auto';
  $('#solveLaplaceControls').classList.toggle('hidden', $('#solveDetMethod').value !== 'laplace');
  const index = $('#solveLaplaceIndex');
  index.innerHTML = '';
  for (let i = 0; i < size; i++) {
    const item = document.createElement('option');
    item.value = i;
    item.textContent = `${$('#solveLaplaceAxis').value === 'row' ? 'Linha' : 'Coluna'} ${i + 1}`;
    index.appendChild(item);
  }
}

function solveDeterminant() {
  const output = $('#solveOutput');
  output.innerHTML = '';
  const matrix = state.solveMatrix;
  if (!matrix || !M.isSquare(matrix)) {
    output.innerHTML = '<div class="feedback error">O determinante exige uma matriz quadrada.</div>';
    return;
  }
  let method = $('#solveDetMethod').value;
  if (method === 'auto') method = matrix.length === 2 ? 'direct' : matrix.length === 3 ? 'sarrus' : 'gauss';

  if (method === 'direct') {
    const [[a, b], [c, d]] = matrix;
    const value = M.determinant2x2(matrix);
    output.innerHTML = `<div class="method-card">${UI.matrixHTML(matrix, { title: 'A' })}<div class="formula">(${UI.fractionHTML(a)} × ${UI.fractionHTML(d)}) − (${UI.fractionHTML(b)} × ${UI.fractionHTML(c)}) = <strong>${UI.fractionHTML(value)}</strong></div></div>`;
  } else if (method === 'sarrus') {
    output.innerHTML = sarrusHTML(matrix, 'A');
  } else if (method === 'laplace') {
    const axis = $('#solveLaplaceAxis').value;
    const index = Number($('#solveLaplaceIndex').value || 0);
    const expansion = M.laplaceExpansion(matrix, axis, index);
    const cards = expansion.terms.map(term => `<article class="laplace-term${term.element.isZero() ? ' zero-term' : ''}"><h4>${term.sign > 0 ? '+' : '−'} ${UI.fractionHTML(term.element)} · det(M${term.row + 1}${term.col + 1})</h4>${UI.matrixHTML(term.minor, { compact: true, title: `M${term.row + 1}${term.col + 1}` })}<div>det(menor) = ${UI.fractionHTML(term.minorDet)}</div><strong>Termo = ${UI.fractionHTML(term.term)}</strong></article>`).join('');
    output.innerHTML = `<div class="method-card"><h3>Expansão de Laplace</h3>${UI.matrixHTML(matrix, { title: 'A' })}<div class="laplace-terms">${cards}</div><div class="result-box">det(A) = <strong>${UI.fractionHTML(expansion.value)}</strong></div></div>`;
  } else {
    const result = M.determinant(matrix, true);
    output.innerHTML = `<div class="method-card"><h3>Eliminação Gaussiana</h3>${UI.matrixHTML(matrix, { title: 'A' })}<div class="swap-summary"><strong>Trocas de linhas do algoritmo: ${result.rowSwaps}</strong><span>Fator de sinal: ${result.sign > 0 ? '+1' : '−1'}</span></div><ol class="steps">${result.steps.map(step => `<li>${UI.escapeHTML(step)}</li>`).join('')}</ol><div class="result-box">det(A) = <strong>${UI.fractionHTML(result.value)}</strong></div></div>`;
  }
}

function solveInverse() {
  const output = $('#solveOutput');
  output.innerHTML = '';
  const matrix = state.solveMatrix;
  if (!matrix || !M.isSquare(matrix)) return output.innerHTML = '<div class="feedback error">A inversa exige uma matriz quadrada.</div>';
  const result = M.inverse(matrix, true);
  if (!result.invertible) return output.innerHTML = '<div class="feedback error">Esta matriz não possui inversa.</div>';
  const start = M.augment(matrix, M.identity(matrix.length));
  const blocks = [`<div class="solution-step"><strong>Início — [A | I]</strong>${UI.matrixHTML(start, { divider: matrix.length, title: '[A | I]' })}</div>`];
  result.steps.forEach((step, index) => blocks.push(`<div class="solution-step"><strong>Passo ${index + 1}: ${UI.escapeHTML(step.op)}</strong>${UI.matrixHTML(step.matrix, { divider: matrix.length, title: `Passo ${index + 1}` })}</div>`));
  blocks.push(`<div class="solution-step"><strong>A⁻¹</strong>${UI.matrixHTML(result.inverse, { title: 'Matriz inversa A⁻¹' })}</div>`);
  output.innerHTML = blocks.join('');
}

function solveSystem() {
  const output = $('#solveOutput');
  output.innerHTML = '';
  const matrix = state.solveMatrix;
  if (!matrix || matrix[0].length < 2) {
    output.innerHTML = '<div class="feedback error">Informe uma matriz aumentada; a última coluna deve conter os termos independentes.</div>';
    return;
  }
  try {
    const method = $('#solveSystemMethod').value;
    output.innerHTML = `<div class="method-card"><h3>Resolução de sistema linear</h3><p class="small-note">A barra separa os coeficientes dos termos independentes.</p>${UI.matrixHTML(matrix, { divider: matrix[0].length - 1, title: 'Matriz aumentada [A | b]' })}${renderSystemByMethod(matrix, method, { includeSteps: true })}</div>`;
  } catch (error) {
    output.innerHTML = `<div class="feedback error">${UI.escapeHTML(error.message)}</div>`;
  }
}

// -----------------------------------------------------------------------------
// Export / history JSON
// -----------------------------------------------------------------------------

function currentSessionJSON() {
  const session = currentSession();
  if (!session) throw new Error('Nenhuma sessão disponível.');
  return H.sessionToJSONString(session, {
    determinantStudy: session.problemType === 'determinant' ? {
      swaps: H.swapStats(session),
      laplaceActive: state.laplace.frames.length > 0
    } : undefined
  });
}

async function copyHistoryJSON() {
  await UI.copyText(currentSessionJSON(), '✓ Histórico JSON copiado');
}

function downloadSessionJSON() {
  const text = currentSessionJSON();
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `matriz-${state.problemType}-sessao.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  UI.showToast('Sessão JSON exportada');
}

// -----------------------------------------------------------------------------
// Events
// -----------------------------------------------------------------------------

UI.bindGlobalCopyHandler();

$$('.setup-type').forEach(button => button.addEventListener('click', () => {
  $('#problemType').value = button.dataset.problemType;
  setProblemType(button.dataset.problemType);
}));
$('#resizeBtn').addEventListener('click', createEditor);
$('#clearBtn').addEventListener('click', createEditor);
$('#randomBtn').addEventListener('click', randomize);
$('#rows').addEventListener('change', () => { if (state.problemType === 'linearSystem') syncSolutionInputs(); });
$('#cols').addEventListener('change', () => { if (state.problemType === 'linearSystem') syncSolutionInputs(); });
$('#startBtn').addEventListener('click', () => startMatrix());
$('#loadJsonBtn').addEventListener('click', () => loadJSON($('#jsonInput').value));
$('#jsonFile').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => loadJSON(e.target.result);
  reader.onerror = () => $('#validationMsg').textContent = 'Não foi possível ler o arquivo.';
  reader.readAsText(file);
  event.target.value = '';
});
$('#matrixEditor').addEventListener('input', () => {
  if (state.problemType !== 'linearSystem' || !state.generatedSystemSolution) return;
  state.generatedSystemSolution = null;
  $('#revealGeneratedSolutionBtn').classList.add('hidden');
  $('#generatedSystemInfo').textContent = 'A matriz foi editada manualmente; a solução usada na geração anterior deixou de ser uma referência válida.';
});

$('#copyEditorBtn').addEventListener('click', async () => {
  try { await UI.copyText(H.matrixToJSONString(parseInputMatrix())); }
  catch { /* parseInputMatrix já exibe erro */ }
});

$('#randomizeSolutionBtn').addEventListener('click', randomizeSolutionValues);
$('#generateSystemBtn').addEventListener('click', () => generateSystemWithSolution());
$('#revealGeneratedSolutionBtn').addEventListener('click', revealGeneratedSolution);

$('#addMatrixOperandBtn').addEventListener('click', () => addMatrixOperand());
$('#startMatrixCollectionBtn').addEventListener('click', useMatrixCollection);
$('#randomizeAllMatricesBtn').addEventListener('click', randomizeAllOperands);
$('#zeroAllMatricesBtn').addEventListener('click', zeroAllOperands);
$('#matrixCollectionEditors').addEventListener('click', event => {
  const button = event.target.closest('[data-operand-action]');
  if (!button) return;
  const card = button.closest('.operand-card');
  const action = button.dataset.operandAction;
  if (action === 'remove') {
    card.remove();
    [...$('#matrixCollectionEditors').children].forEach((item, index) => {
      const name = matrixNameForIndex(index);
      item.dataset.matrixName = name;
      item.querySelector('.operand-symbol').textContent = name;
      item.querySelector('.operand-card-head strong').textContent = `Matriz ${name}`;
    });
    updateOperandRemoveButtons();
    return;
  }
  const rows = Math.max(1, Math.min(6, Number(card.querySelector('[data-operand-rows]').value) || 2));
  const cols = Math.max(1, Math.min(6, Number(card.querySelector('[data-operand-cols]').value) || 2));
  if (action === 'resize') UI.makeEditor(card.querySelector('.operand-editor'), rows, cols);
  if (action === 'random') UI.makeEditor(card.querySelector('.operand-editor'), rows, cols, randomMatrix(rows, cols));
  if (action === 'copy') {
    try { UI.copyText(H.matrixToJSONString(UI.parseGrid(card.querySelector('.operand-editor')))); }
    catch (error) { $('#matrixCollectionMsg').textContent = error.message; }
  }
});

$$('.workspace-mode').forEach(button => button.addEventListener('click', () => setWorkspace(button.dataset.workspace)));
$('#problemType').addEventListener('change', event => setProblemType(event.target.value));
$$('.operation-mode').forEach(button => button.addEventListener('click', () => setOperationMode(button.dataset.operationMode)));
$('#opType').addEventListener('change', refreshOperationSelectors);
$('#rowA').addEventListener('change', updateOperationControls);
$('#rowB').addEventListener('change', updateOperationControls);
$('#kInput').addEventListener('input', updateOperationControls);
$('#applyBtn').addEventListener('click', applyManagedOperation);
$('#checkBtn').addEventListener('click', checkManualOperation);
$('#undoBtn').addEventListener('click', undo);
$('#redoBtn').addEventListener('click', redo);
$('#restartBtn').addEventListener('click', restart);
$('#hintBtn').addEventListener('click', showHint);
$('#resetAugBtn').addEventListener('click', resetAugmented);
$('#verifyInverseBtn').addEventListener('click', verifyInverse);
$('#showCalculationGuideBtn').addEventListener('click', toggleCalculationGuide);

$('#startLaplaceStudyBtn').addEventListener('click', startLaplaceStudy);
$('#suggestLaplaceBtn').addEventListener('click', recommendLaplace);
$('#studySarrusBtn').addEventListener('click', () => {
  const session = state.sessions.determinant;
  if (!session || session.currentMatrix.length !== 3 || !M.isSquare(session.currentMatrix)) return;
  state.laplace.frames = [newLaplaceFrame(session.currentMatrix, 'Matriz atual')];
  state.laplace.frames[0].practiceSarrus = true;
  renderLaplaceStudy();
});
$('#laplaceStudy').addEventListener('change', event => {
  const frame = currentLaplaceFrame();
  if (!frame) return;
  if (event.target.id === 'laplaceStudyAxis') {
    frame.axis = event.target.value;
    frame.index = 0;
    frame.terms = null;
    renderLaplaceStudy();
  }
  if (event.target.id === 'laplaceStudyIndex') {
    frame.index = Number(event.target.value);
    expandLaplaceFrame(frame.axis, frame.index);
  }
});
$('#laplaceStudy').addEventListener('click', event => {
  const button = event.target.closest('[data-laplace-action]');
  if (!button) return;
  const action = button.dataset.laplaceAction;
  if (action === 'expand') {
    const frame = currentLaplaceFrame();
    expandLaplaceFrame(frame.axis, frame.index);
  } else if (action === 'recommend') {
    const frame = currentLaplaceFrame();
    const best = M.recommendLaplaceAxis(frame.matrix);
    frame.axis = best.axis;
    frame.index = best.index;
    frame.terms = null;
    renderLaplaceStudy();
  } else if (action === 'open') {
    openLaplaceTerm(Number(button.dataset.term));
  } else if (action === 'check-minor') {
    checkLaplaceMinor(Number(button.dataset.term));
  } else if (action === 'sarrus') {
    resolveLaplaceFrameWithSarrus();
  } else if (action === 'practice-sarrus') {
    const frame = currentLaplaceFrame();
    frame.practiceSarrus = true;
    renderLaplaceStudy();
  } else if (action === 'check-sarrus') {
    checkSarrusPractice();
  } else if (action === 'show-sarrus') {
    resolveLaplaceFrameWithSarrus();
  } else if (action === 'direct-2x2') {
    resolveLaplaceFrameDirect2x2();
  } else if (action === 'back') {
    state.laplace.frames.pop();
    renderLaplaceStudy();
  }
});
$('#laplaceStudy').addEventListener('focusin', event => {
  if (event.target.matches('[data-sarrus-path]')) highlightSarrusDiagonal(event.target);
});
$('#laplaceStudy').addEventListener('input', event => {
  if (!event.target.matches('[data-laplace-minor-input]')) return;
  const frame = currentLaplaceFrame();
  const term = frame?.terms?.[Number(event.target.dataset.laplaceMinorInput)];
  if (term) term.draft = event.target.value;
});
$('#detMatrixContext').addEventListener('click', event => {
  if (event.target.closest('[data-laplace-action="use-as-current"]')) useLaplaceFrameAsCurrent();
});

$('#copyHistoryBtn').addEventListener('click', copyHistoryJSON);
$('#downloadSessionBtn').addEventListener('click', downloadSessionJSON);
$('#useStudyMatrixBtn').addEventListener('click', useStudyMatrixInSolve);
$('#solveDetMethod').addEventListener('change', updateSolveMethodAvailability);
$('#solveLaplaceAxis').addEventListener('change', updateSolveMethodAvailability);
$('#solveDetBtn').addEventListener('click', solveDeterminant);
$('#solveInverseBtn').addEventListener('click', solveInverse);
$('#solveSystemBtn').addEventListener('click', solveSystem);
$('#analyzeSystemBtn').addEventListener('click', analyzeCurrentSystem);
$('#systemStudyMethod').addEventListener('change', updateSystemMethodControls);
$('#solveSystemMethod').addEventListener('change', updateSystemMethodControls);
$('#practiceMatrixExpressionBtn').addEventListener('click', () => calculateMatrixExpression(true));
$('#solveMatrixExpressionBtn').addEventListener('click', () => calculateMatrixExpression(false));
$('#matrixOperationsOutput').addEventListener('click', event => {
  const check = event.target.closest('[data-expression-check]');
  const reveal = event.target.closest('[data-expression-reveal]');
  const copy = event.target.closest('[data-expression-copy]');
  if (check) checkMatrixExpressionStep(Number(check.dataset.expressionCheck));
  if (reveal) revealMatrixExpressionStep(Number(reveal.dataset.expressionReveal));
  if (copy) {
    const editor = $(`[data-expression-editor="${copy.dataset.expressionCopy}"]`);
    try { UI.copyText(H.matrixToJSONString(UI.parseGrid(editor))); }
    catch (error) { UI.showToast(error.message); }
  }
});
$('#manualEditor').addEventListener('click', event => {
  const button = event.target.closest('[data-restore-row]');
  if (button) restoreManualCell(Number(button.dataset.restoreRow), Number(button.dataset.restoreCol));
});
$('#changedSummary').addEventListener('click', event => {
  const button = event.target.closest('[data-restore-row]');
  if (button) restoreManualCell(Number(button.dataset.restoreRow), Number(button.dataset.restoreCol));
});
$('#themeBtn').addEventListener('click', () => document.body.classList.toggle('dark'));

// Initial state
configureInputForProblemType();
refreshWorkspace();
