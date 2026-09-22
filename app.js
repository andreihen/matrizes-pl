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
  sessions: { determinant: null, inverse: null },
  solveMatrix: null,
  hintLevel: 0,
  laplace: { frames: [] }
};

// -----------------------------------------------------------------------------
// Matrix input
// -----------------------------------------------------------------------------

function editorDimensions() {
  return {
    rows: Math.max(1, Math.min(6, Number($('#rows').value) || 3)),
    cols: Math.max(1, Math.min(6, Number($('#cols').value) || 3))
  };
}

function createEditor() {
  const { rows, cols } = editorDimensions();
  $('#rows').value = rows;
  $('#cols').value = cols;
  UI.makeEditor($('#matrixEditor'), rows, cols);
  $('#validationMsg').textContent = '';
}

function loadExample(values) {
  const matrix = values.map(row => row.map(M.Fraction.from));
  $('#rows').value = matrix.length;
  $('#cols').value = matrix[0].length;
  UI.makeEditor($('#matrixEditor'), matrix.length, matrix[0].length, matrix);
  $('#validationMsg').textContent = 'Exemplo carregado. Clique em “Usar esta matriz”.';
}

function randomize() {
  const { rows, cols } = editorDimensions();
  const matrix = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => new M.Fraction(Math.floor(Math.random() * 7) - 3))
  );
  UI.makeEditor($('#matrixEditor'), rows, cols, matrix);
}

function parseInputMatrix() {
  try {
    const matrix = UI.parseGrid($('#matrixEditor'));
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
  return !hasActiveWork() || window.confirm('Carregar uma nova matriz reiniciará as sessões atuais. Deseja continuar?');
}

function setBaseMatrix(matrix) {
  state.baseMatrix = M.cloneMatrix(matrix);
  state.solveMatrix = M.cloneMatrix(matrix);
  state.sessions = { determinant: null, inverse: null };
  state.laplace.frames = [];
  ensureStudySession('determinant');
  if (state.problemType === 'inverse') ensureStudySession('inverse');
  refreshWorkspace();
}

function startMatrix({ skipConfirm = false } = {}) {
  if (!skipConfirm && !confirmOverwrite()) return;
  try {
    setBaseMatrix(parseInputMatrix());
    $('#validationMsg').textContent = '✓ Matriz carregada.';
    UI.showToast('Matriz carregada');
  } catch { /* mensagem já exibida */ }
}

function loadJSON(text) {
  if (!confirmOverwrite()) return;
  try {
    const matrix = M.parseMatrixJSON(text);
    $('#rows').value = matrix.length;
    $('#cols').value = matrix[0].length;
    UI.makeEditor($('#matrixEditor'), matrix.length, matrix[0].length, matrix);
    setBaseMatrix(matrix);
    $('#validationMsg').textContent = '✓ Matriz JSON importada com sucesso.';
  } catch (error) {
    $('#validationMsg').textContent = error.message;
  }
}

// -----------------------------------------------------------------------------
// Sessions and navigation
// -----------------------------------------------------------------------------

function createStudySession(problemType) {
  if (!state.baseMatrix) return null;
  if (problemType === 'determinant') {
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

function setProblemType(problemType) {
  state.problemType = problemType;
  ensureStudySession(problemType);
  state.laplace.frames = [];
  refreshWorkspace();
}

function refreshWorkspace() {
  $$('.workspace-mode').forEach(button => button.classList.toggle('active', button.dataset.workspace === state.workspace));
  $('#studyPanel').classList.toggle('hidden', state.workspace !== 'study');
  $('#solvePanel').classList.toggle('hidden', state.workspace !== 'solve');
  $('#problemType').value = state.problemType;

  const inverse = state.problemType === 'inverse';
  $('#workspaceDescription').textContent = state.workspace === 'study'
    ? inverse
      ? 'Você realiza as operações em [A | I]; o sistema acompanha e confere cada passo.'
      : 'Você manipula a matriz, acompanha trocas e pode continuar por Laplace até chegar a Sarrus.'
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
  $('#studyTitle').textContent = inverse ? 'Estudar inversa' : 'Estudar determinante';
  $('#studySubtitle').textContent = inverse
    ? 'Transforme [A | I] em [I | A⁻¹] usando operações de linha.'
    : 'Faça operações, acompanhe o efeito das trocas e siga por Laplace/Sarrus quando desejar.';

  if (!session) {
    $('#studyMatrix').innerHTML = '<div class="feedback error">Este modo exige uma matriz quadrada.</div>';
    return;
  }

  UI.renderMatrix($('#studyMatrix'), session.currentMatrix, {
    divider: session.augmentedAt,
    title: inverse ? 'Matriz aumentada [A | I]' : 'Matriz atual'
  });

  $('#detStudyStats').classList.toggle('hidden', inverse);
  $('#detStudyTools').classList.toggle('hidden', inverse);
  $('#inverseStudyActions').classList.toggle('hidden', !inverse);
  $('#hintBtn').classList.toggle('hidden', !inverse);
  $('#opCount').textContent = `${Math.max(0, session.history.length - 1)} operações`;

  refreshOperationSelectors();
  renderHistory();
  updateSwapPanel();
  updateInverseStatus();
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

function refreshOperationSelectors() {
  const session = currentSession();
  if (!session) return;
  const inverse = state.problemType === 'inverse';
  const swapColOption = $('#opType').querySelector('option[value="swapCol"]');
  swapColOption.disabled = inverse;
  if (inverse && $('#opType').value === 'swapCol') $('#opType').value = 'swap';

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
  $('#rowAWrap').childNodes[0].nodeValue = columns ? 'Coluna da operação ' : 'Linha da operação ';
  $('#rowBWrap').childNodes[0].nodeValue = columns ? 'Coluna de troca ' : 'Linha do pivô ';
  $('#rowBWrap').classList.toggle('hidden', type === 'scale');
  $('#kWrap').classList.toggle('hidden', ['swap', 'swapCol'].includes(type));
  try {
    $('#operationPreview').textContent = M.operationLabel(readOperation());
  } catch {
    $('#operationPreview').textContent = 'Revise o multiplicador.';
  }
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
    if (state.problemType === 'inverse' && operation.type === 'swapCol') throw new Error('Troca de colunas não faz parte do Gauss-Jordan padrão da inversa.');
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
    title: 'Resultado que você calculou'
  });
  $('#changedSummary').textContent = 'Nenhuma célula alterada ainda.';
  $('#manualEditor').querySelectorAll('.matrix-input').forEach(input => {
    input.addEventListener('input', () => updateManualChangedPreview());
  });
}

function updateManualChangedPreview() {
  const session = currentSession();
  if (!session) return;
  const changed = UI.updateChangedCells($('#manualEditor'), session.currentMatrix);
  $('#changedSummary').textContent = changed.length
    ? `Alteradas: ${changed.map(({ row, col }) => `(${row + 1},${col + 1})`).join(', ')}.`
    : 'Nenhuma alteração matemática em relação à matriz anterior.';
}

function markManualValidation(expected, actual, previous) {
  const inputs = [...$('#manualEditor').querySelectorAll('.matrix-input')];
  const cols = expected[0].length;
  inputs.forEach((input, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    input.classList.remove('changed-cell', 'correct-cell', 'error-cell');
    const changed = !M.Fraction.from(actual[row][col]).equals(previous[row][col]);
    if (!changed) return;
    const correct = M.Fraction.from(actual[row][col]).equals(expected[row][col]);
    input.classList.add(correct ? 'correct-cell' : 'error-cell');
    input.dataset.cellState = correct ? 'correct' : 'error';
    input.title = correct ? '✓ Alteração correta' : '✕ Alteração incorreta';
  });
}

function checkManualOperation() {
  const session = currentSession();
  if (!session) return;
  try {
    const operation = readOperation();
    if (state.problemType === 'inverse' && operation.type === 'swapCol') throw new Error('Troca de colunas está bloqueada no método da inversa.');
    const expected = M.applyOperation(session.currentMatrix, operation);
    const actual = UI.parseGrid($('#manualEditor'));
    markManualValidation(expected, actual, session.currentMatrix);

    if (M.matricesEqual(actual, expected)) {
      commitOperation(actual, operation);
      return;
    }
    const difference = M.firstDifference(actual, expected);
    UI.setFeedback($('#feedback'), M.explainDifference(session.currentMatrix, operation, difference), 'error');
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

function showHint() {
  const session = currentSession();
  if (!session) return;
  state.hintLevel = (state.hintLevel % 3) + 1;
  const messages = [
    'Procure o próximo pivô no lado esquerdo e tente torná-lo igual a 1.',
    'Depois do pivô, use a linha dele para zerar os demais valores da mesma coluna.',
    'Lembre-se: toda operação deve ser aplicada à linha inteira de [A | I].'
  ];
  UI.setFeedback($('#feedback'), `💡 ${messages[state.hintLevel - 1]}`, 'info');
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
    resolvedValue: null,
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
  const parentValue = computeFrameValue(parent);
  if (parentValue) {
    parent.resolvedValue = parentValue;
    propagateResolvedFrame(frame.parentFrameIndex);
  }
}

function expandLaplaceFrame(axis, index, { autoDescend = true } = {}) {
  const frame = currentLaplaceFrame();
  if (!frame) return;
  frame.axis = axis;
  frame.index = index;
  const expansion = M.laplaceExpansion(frame.matrix, axis, index);
  frame.terms = expansion.terms.map(term => {
    const zero = term.element.isZero();
    const easy = term.minor.length <= 2;
    const minorResult = zero ? new M.Fraction(0) : easy
      ? (term.minor.length === 1 ? term.minor[0][0] : M.determinant2x2(term.minor))
      : null;
    return {
      ...term,
      status: zero || easy ? 'resolved' : 'pending',
      minorResult,
      contribution: zero ? new M.Fraction(0) : easy
        ? term.element.mul(new M.Fraction(term.sign)).mul(minorResult)
        : null
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
  state.laplace.frames.push(newLaplaceFrame(term.minor, label, parentIndex, termIndex));
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
  } else if (frame.matrix.length === 2) {
    const value = M.determinant2x2(frame.matrix);
    frame.resolvedValue = value;
    propagateResolvedFrame(frameIndex);
    body = `<div class="method-card"><h3>${UI.escapeHTML(frame.label)} — 2×2</h3>${UI.matrixHTML(frame.matrix, { title: frame.label })}<div class="result-box">ad − bc = <strong>${UI.fractionHTML(value)}</strong></div></div>`;
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
        ${term.status === 'pending' ? `<button class="secondary" type="button" data-laplace-action="open" data-term="${termIndex}">Continuar com este menor</button>` : ''}
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
        ${frame.matrix.length === 3 ? '<button class="secondary" type="button" data-laplace-action="sarrus">Resolver esta 3×3 com Sarrus</button>' : ''}
      </div>
      ${frame.terms ? `<div class="laplace-terms">${terms}</div>` : terms}
      ${frame.resolvedValue ? `<div class="feedback success">✓ ${frame.label} resolvido: ${UI.fractionHTML(frame.resolvedValue)}</div>` : ''}
    </div>`;
  }

  const correction = frameIndex === 0 && frame.resolvedValue ? determinantCorrectionHTML(frame.resolvedValue) : '';
  host.innerHTML = `<div class="laplace-breadcrumb">${breadcrumb}</div>${body}${correction}${frameIndex > 0 ? '<div class="toolbar"><button class="ghost" type="button" data-laplace-action="back">← Voltar ao termo anterior</button></div>' : ''}`;
}

// -----------------------------------------------------------------------------
// Solve view
// -----------------------------------------------------------------------------

function refreshSolve() {
  const inverse = state.problemType === 'inverse';
  $('#solveTitle').textContent = inverse ? 'Resolver inversa' : 'Resolver determinante';
  $('#solveDetControls').classList.toggle('hidden', inverse);
  $('#solveInverseControls').classList.toggle('hidden', !inverse);
  if (!state.solveMatrix && state.baseMatrix) state.solveMatrix = M.cloneMatrix(state.baseMatrix);
  UI.renderMatrix($('#solveMatrix'), state.solveMatrix, { title: 'Matriz usada na resolução' });
  updateSolveMethodAvailability();
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

$('#resizeBtn').addEventListener('click', createEditor);
$('#clearBtn').addEventListener('click', createEditor);
$('#randomBtn').addEventListener('click', randomize);
$('#example2Btn').addEventListener('click', () => loadExample([[2, 4], [1, 2]]));
$('#example3Btn').addEventListener('click', () => loadExample([[2, -1, 3], [4, 0, 1], [5, 2, -2]]));
$('#example4Btn').addEventListener('click', () => loadExample([[1, 2, 0, 1], [2, 5, 1, 0], [0, 1, 3, 2], [1, 0, 2, 4]]));
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
$('#copyEditorBtn').addEventListener('click', async () => {
  try { await UI.copyText(H.matrixToJSONString(parseInputMatrix())); }
  catch { /* parseInputMatrix já exibe erro */ }
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

$('#startLaplaceStudyBtn').addEventListener('click', startLaplaceStudy);
$('#suggestLaplaceBtn').addEventListener('click', recommendLaplace);
$('#studySarrusBtn').addEventListener('click', () => {
  const session = state.sessions.determinant;
  if (!session || session.currentMatrix.length !== 3 || !M.isSquare(session.currentMatrix)) return;
  state.laplace.frames = [newLaplaceFrame(session.currentMatrix, 'Matriz atual')];
  resolveLaplaceFrameWithSarrus();
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
  } else if (action === 'sarrus') {
    resolveLaplaceFrameWithSarrus();
  } else if (action === 'back') {
    state.laplace.frames.pop();
    renderLaplaceStudy();
  }
});

$('#copyHistoryBtn').addEventListener('click', copyHistoryJSON);
$('#downloadSessionBtn').addEventListener('click', downloadSessionJSON);
$('#useStudyMatrixBtn').addEventListener('click', useStudyMatrixInSolve);
$('#solveDetMethod').addEventListener('change', updateSolveMethodAvailability);
$('#solveLaplaceAxis').addEventListener('change', updateSolveMethodAvailability);
$('#solveDetBtn').addEventListener('click', solveDeterminant);
$('#solveInverseBtn').addEventListener('click', solveInverse);
$('#themeBtn').addEventListener('click', () => document.body.classList.toggle('dark'));

// Initial state
createEditor();
loadExample([[2, -1, 3], [4, 0, 1], [5, 2, -2]]);
startMatrix({ skipConfirm: true });
