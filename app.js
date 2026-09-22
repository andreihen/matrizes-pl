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
  $('#opCount').textContent = `${Math.max(0, H.getTimeline(session).length - 1)} etapas`;

  refreshOperationSelectors();
  renderHistory();
  updateSwapPanel();
  updateInverseStatus();
  if (state.operationMode === 'manual') prepareManualEditor();
  if (!inverse) {
    refreshLaplaceQuickControls();
    renderLaplaceStudy();
  }
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
  const isSwap = type === 'swap' || type === 'swapCol';
  const a = $('#rowA');
  const b = $('#rowB');

  $('#rowAWrap').childNodes[0].nodeValue = columns ? 'Coluna da operação ' : 'Linha da operação ';
  $('#rowBWrap').childNodes[0].nodeValue = columns
    ? 'Coluna de troca '
    : type === 'swap' ? 'Linha de troca ' : 'Linha do pivô ';
  $('#rowBWrap').classList.toggle('hidden', type === 'scale');
  $('#kWrap').classList.toggle('hidden', isSwap);

  [...b.options].forEach(option => {
    option.disabled = isSwap && option.value === a.value;
  });
  if (isSwap && b.value === a.value) {
    const alternative = [...b.options].find(option => !option.disabled);
    if (alternative) b.value = alternative.value;
  }

  const invalidSwap = isSwap && (a.value === b.value || a.options.length < 2);
  $('#applyBtn').disabled = invalidSwap;
  $('#checkBtn').disabled = invalidSwap;

  if (invalidSwap) {
    $('#operationPreview').textContent = columns
      ? 'Escolha duas colunas diferentes para realizar a troca.'
      : 'Escolha duas linhas diferentes para realizar a troca.';
    return;
  }

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
  $('#opCount').textContent = `${Math.max(0, H.getTimeline(session).length - 1)} etapas`;

  H.getTimeline(session).forEach((entry, timelineIndex) => {
    const card = document.createElement('article');
    card.className = `history-step${entry.kind === 'analysisEvent' ? ' analysis-event' : ''}`;

    if (entry.kind === 'matrixStep') {
      const step = entry.item;
      const title = document.createElement('div');
      title.className = 'history-step-title';
      title.textContent = step.step === 0
        ? 'Passo 0 — Matriz inicial'
        : `Passo ${step.step} — ${step.description}`;
      card.appendChild(title);

      if (step.operation) {
        const summary = document.createElement('div');
        summary.className = 'history-meta';
        summary.textContent = step.description;
        card.appendChild(summary);
      }

      const holder = document.createElement('div');
      card.appendChild(holder);
      UI.renderMatrix(holder, step.after, {
        divider: session.augmentedAt,
        title: `Matriz do passo ${step.step}`,
        compact: true
      });
    } else {
      const event = entry.item;
      const title = document.createElement('div');
      title.className = 'history-step-title';
      title.textContent = `Análise ${timelineIndex} — ${event.description}`;
      card.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'history-meta';
      if (event.type === 'laplaceExpansion') {
        const axis = event.metadata.axis === 'row' ? 'linha' : 'coluna';
        meta.textContent = `Expansão pela ${axis} ${Number(event.metadata.index) + 1}. ${event.metadata.expression || ''}`.trim();
      } else if (event.type === 'sarrusResolution') {
        meta.textContent = `Resultado do menor: ${event.metadata.result}.`;
      } else if (event.type === 'laplaceResult') {
        meta.textContent = `det(matriz atual) = ${event.metadata.currentDeterminant}; det(matriz inicial) = ${event.metadata.originalDeterminant}.`;
      } else if (event.type === 'directDeterminant') {
        meta.textContent = `Resultado: ${event.metadata.result}.`;
      } else {
        meta.textContent = event.description;
      }
      card.appendChild(meta);

      if (event.matrix) {
        const holder = document.createElement('div');
        card.appendChild(holder);
        UI.renderMatrix(holder, event.matrix, {
          title: event.metadata.label || 'Matriz analisada',
          compact: true
        });
      }
    }

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
  const recommendation = M.recommendLaplaceAxis(matrix);
  return {
    matrix: M.cloneMatrix(matrix),
    label,
    axis: recommendation.axis,
    index: recommendation.index,
    terms: null,
    resolvedValue: null,
    parentFrameIndex,
    parentTermIndex,
    sarrusResult: null,
    loggedFinal: false
  };
}

function currentLaplaceFrame() {
  return state.laplace.frames.at(-1) || null;
}

function rootLaplaceFrame() {
  return state.laplace.frames[0] || null;
}

function ensureLaplaceRoot() {
  const session = state.sessions.determinant;
  if (!session || !M.isSquare(session.currentMatrix)) return null;
  if (!state.laplace.frames.length) {
    state.laplace.frames = [newLaplaceFrame(session.currentMatrix, 'Matriz atual')];
  }
  return currentLaplaceFrame();
}

function laplaceTermCoefficient(term) {
  return term.element.mul(new M.Fraction(term.sign));
}

function laplaceExpressionText(frame) {
  if (!frame?.terms?.length) return '';
  const parts = frame.terms.map((term, index) => {
    const coefficient = laplaceTermCoefficient(term);
    const negative = coefficient.n < 0;
    const abs = coefficient.abs().toString();
    const minorLabel = `M${term.row + 1}${term.col + 1}`;
    const body = term.status === 'resolved'
      ? `${abs}·${term.minorResult.toString()}`
      : `${abs}·det(${minorLabel})`;
    if (index === 0) return `${negative ? '−' : ''}${body}`;
    return `${negative ? '−' : '+'} ${body}`;
  });
  return `det(${frame.label}) = ${parts.join(' ')}`;
}

function laplaceExpressionHTML(frame) {
  if (!frame?.terms?.length) return '';
  const parts = frame.terms.map((term, index) => {
    const coefficient = laplaceTermCoefficient(term);
    const negative = coefficient.n < 0;
    const abs = coefficient.abs();
    const minorLabel = `M${term.row + 1}${term.col + 1}`;
    const body = term.status === 'resolved'
      ? `${UI.fractionHTML(abs)} × ${UI.fractionHTML(term.minorResult)}`
      : `${UI.fractionHTML(abs)} × det(${minorLabel})`;
    const sign = index === 0 ? (negative ? '− ' : '') : (negative ? ' − ' : ' + ');
    return `${sign}${body}`;
  });
  return `<strong>det(${UI.escapeHTML(frame.label)})</strong> = ${parts.join('')}`;
}

function pathFactorToFrame(frameIndex) {
  let factor = new M.Fraction(1);
  let index = frameIndex;
  while (index > 0) {
    const frame = state.laplace.frames[index];
    const parent = state.laplace.frames[frame.parentFrameIndex];
    const term = parent?.terms?.[frame.parentTermIndex];
    if (!term) break;
    factor = factor.mul(laplaceTermCoefficient(term));
    index = frame.parentFrameIndex;
  }
  return factor;
}

function computeFrameValue(frame) {
  if (!frame?.terms || frame.terms.some(term => term.status === 'pending')) return null;
  return frame.terms.reduce(
    (sum, term) => sum.add(term.contribution || new M.Fraction(0)),
    new M.Fraction(0)
  );
}

function finalizeLaplaceRoot() {
  const session = state.sessions.determinant;
  const root = rootLaplaceFrame();
  if (!session || !root?.resolvedValue || root.loggedFinal) return;

  const factor = H.determinantTransformFactor(session);
  const stats = H.swapStats(session);
  const original = root.resolvedValue.div(factor);
  root.loggedFinal = true;
  root.originalDeterminant = original;

  H.logAnalysisEvent(session, {
    type: 'laplaceResult',
    description: `Laplace concluído: det(A original) = ${original.toString()}`,
    matrix: root.matrix,
    metadata: {
      currentDeterminant: root.resolvedValue,
      transformFactor: factor,
      originalDeterminant: original,
      rowSwaps: stats.rowSwaps,
      columnSwaps: stats.columnSwaps,
      swapSign: stats.sign
    }
  });
}

function propagateResolvedFrame(frameIndex) {
  const frame = state.laplace.frames[frameIndex];
  if (!frame || frame.resolvedValue == null) return;

  if (frame.parentFrameIndex == null) {
    finalizeLaplaceRoot();
    return;
  }

  const parent = state.laplace.frames[frame.parentFrameIndex];
  const term = parent?.terms?.[frame.parentTermIndex];
  if (!term) return;

  term.minorResult = M.Fraction.from(frame.resolvedValue);
  term.contribution = laplaceTermCoefficient(term).mul(term.minorResult);
  term.status = 'resolved';

  const parentValue = computeFrameValue(parent);
  if (parentValue) {
    parent.resolvedValue = parentValue;
    propagateResolvedFrame(frame.parentFrameIndex);
  }
}

function collapseResolvedLaplaceFrames() {
  while (state.laplace.frames.length > 1) {
    const frame = currentLaplaceFrame();
    if (frame?.resolvedValue == null) break;
    state.laplace.frames.pop();
  }
}

function logLaplaceExpansion(frame) {
  const session = state.sessions.determinant;
  if (!session) return;
  const axisLabel = frame.axis === 'row' ? 'linha' : 'coluna';
  H.logAnalysisEvent(session, {
    type: 'laplaceExpansion',
    description: `Expansão de Laplace pela ${axisLabel} ${frame.index + 1}`,
    matrix: frame.matrix,
    metadata: {
      label: frame.label,
      axis: frame.axis,
      index: frame.index,
      expression: laplaceExpressionText(frame),
      pathFactor: pathFactorToFrame(state.laplace.frames.length - 1),
      terms: frame.terms.map(term => ({
        row: term.row + 1,
        column: term.col + 1,
        element: term.element,
        cofactorSign: term.sign,
        coefficient: laplaceTermCoefficient(term),
        minorLabel: `M${term.row + 1}${term.col + 1}`,
        minor: term.minor
      }))
    }
  });
}

function expandLaplaceFrame(axis, index, { autoDescend = true } = {}) {
  const frame = ensureLaplaceRoot();
  if (!frame) return;

  frame.axis = axis;
  frame.index = index;
  frame.sarrusResult = null;
  frame.resolvedValue = null;
  frame.loggedFinal = false;

  const expansion = M.laplaceExpansion(frame.matrix, axis, index);
  frame.terms = expansion.terms.map(term => {
    const zero = term.element.isZero();
    const easy = term.minor.length <= 2;
    const minorResult = zero
      ? new M.Fraction(0)
      : easy
        ? (term.minor.length === 1 ? term.minor[0][0] : M.determinant2x2(term.minor))
        : null;
    const coefficient = term.element.mul(new M.Fraction(term.sign));
    return {
      ...term,
      status: zero || easy ? 'resolved' : 'pending',
      minorResult,
      contribution: zero
        ? new M.Fraction(0)
        : easy ? coefficient.mul(minorResult) : null
    };
  });

  logLaplaceExpansion(frame);

  const value = computeFrameValue(frame);
  if (value) {
    frame.resolvedValue = value;
    propagateResolvedFrame(state.laplace.frames.length - 1);
    collapseResolvedLaplaceFrames();
    refreshLaplaceQuickControls();
    renderLaplaceStudy();
    renderHistory();
    return;
  }

  const pendingNonZero = frame.terms
    .map((term, termIndex) => ({ term, termIndex }))
    .filter(item => item.term.status === 'pending' && !item.term.element.isZero());

  if (autoDescend && pendingNonZero.length === 1 && frame.matrix.length > 3) {
    openLaplaceTerm(pendingNonZero[0].termIndex, true);
    UI.showToast('Laplace aplicado: único termo não nulo, menor aberto automaticamente.');
    renderHistory();
    return;
  }

  refreshLaplaceQuickControls();
  renderLaplaceStudy();
  renderHistory();
}

function openLaplaceTerm(termIndex, automatic = false) {
  const parentIndex = state.laplace.frames.length - 1;
  const parent = state.laplace.frames[parentIndex];
  const term = parent?.terms?.[termIndex];
  if (!term || term.status !== 'pending') return;

  const label = `M${term.row + 1}${term.col + 1}`;
  state.laplace.frames.push(newLaplaceFrame(term.minor, label, parentIndex, termIndex));
  refreshLaplaceQuickControls();
  renderLaplaceStudy();
  if (!automatic) UI.showToast(`${label} aberto. Continue a conta a partir deste menor.`);
}

function resolveLaplaceFrameWithSarrus() {
  const frame = ensureLaplaceRoot();
  if (!frame || frame.matrix.length !== 3) return;

  frame.sarrusResult = M.determinantSarrus(frame.matrix);
  frame.resolvedValue = frame.sarrusResult.value;

  H.logAnalysisEvent(state.sessions.determinant, {
    type: 'sarrusResolution',
    description: `${frame.label} resolvido por Sarrus`,
    matrix: frame.matrix,
    metadata: {
      label: frame.label,
      result: frame.resolvedValue,
      pathFactor: pathFactorToFrame(state.laplace.frames.length - 1)
    }
  });

  propagateResolvedFrame(state.laplace.frames.length - 1);
  collapseResolvedLaplaceFrames();
  refreshLaplaceQuickControls();
  renderLaplaceStudy();
  renderHistory();
  UI.showToast('Sarrus concluído e resultado incorporado à conta de Laplace.');
}

function refreshLaplaceQuickControls() {
  const session = state.sessions.determinant;
  const controls = $('#laplaceQuickControls');
  if (!controls || !session || !M.isSquare(session.currentMatrix)) return;

  const frame = currentLaplaceFrame();
  const matrix = frame?.matrix || session.currentMatrix;
  const size = matrix.length;
  const recommendation = M.recommendLaplaceAxis(matrix);
  const axisSelect = $('#laplaceQuickAxis');
  const indexSelect = $('#laplaceQuickIndex');

  if (!frame && axisSelect.dataset.userChoice !== 'true') axisSelect.value = recommendation.axis;
  if (frame) axisSelect.value = frame.axis;

  const axis = axisSelect.value;
  const previousIndex = frame ? frame.index : Number(indexSelect.value || recommendation.index);
  indexSelect.innerHTML = '';
  for (let i = 0; i < size; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${axis === 'row' ? 'Linha' : 'Coluna'} ${i + 1}`;
    indexSelect.appendChild(option);
  }

  const preferred = frame
    ? frame.index
    : axis === recommendation.axis ? recommendation.index : Math.min(previousIndex, size - 1);
  indexSelect.value = String(Math.max(0, Math.min(size - 1, preferred)));

  $('#applyLaplaceBtn').disabled = size < 2 || Boolean(frame?.resolvedValue);
  $('#applyLaplaceBtn').textContent = size > 3 ? 'Reduzir por Laplace' : 'Aplicar Laplace';
  $('#studySarrusBtn').disabled = size !== 3 || Boolean(frame?.resolvedValue);
  $('#studySarrusBtn').classList.toggle('hidden', size !== 3);

  $('#laplaceSuggestion').textContent = size > 2
    ? `Sugestão: ${recommendation.axis === 'row' ? 'Linha' : 'Coluna'} ${recommendation.index + 1} (${recommendation.zeros} zero(s)). Você pode usar a sugestão ou escolher outra opção acima.`
    : 'Matriz 2×2: o determinante é resolvido diretamente por ad − bc.';
}

function applyQuickLaplace() {
  const frame = ensureLaplaceRoot();
  if (!frame) return;
  const axis = $('#laplaceQuickAxis').value;
  const index = Number($('#laplaceQuickIndex').value || 0);
  expandLaplaceFrame(axis, index);
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
  return `<div class="det-correction final-determinant">
    <div class="final-kicker">Resultado final</div>
    <h4>det(A original) = ${UI.fractionHTML(original)}</h4>
    <p>Laplace/Sarrus encontrou <strong>det(matriz atual) = ${UI.fractionHTML(currentDeterminant)}</strong>.</p>
    <p>Durante as operações houve ${stats.rowSwaps} troca(s) de linha e ${stats.columnSwaps} troca(s) de coluna. O <strong>sinal atual das trocas é ${swapFactor}</strong>.</p>
    <p>Fator total das operações que alteram o determinante: <strong>${UI.fractionHTML(factor)}</strong>.</p>
    <p class="formula">det(A original) = ${UI.fractionHTML(currentDeterminant)} ÷ ${UI.fractionHTML(factor)} = ${UI.fractionHTML(original)}</p>
  </div>`;
}

function rootExpressionHTML() {
  const root = rootLaplaceFrame();
  if (!root?.terms) return '';
  return `<div class="laplace-running-equation"><span>Conta principal</span><div>${laplaceExpressionHTML(root)}</div>${root.resolvedValue ? `<strong>det(matriz atual) = ${UI.fractionHTML(root.resolvedValue)}</strong>` : ''}</div>`;
}

function renderLaplaceStudy() {
  const host = $('#laplaceStudy');
  if (!host) return;
  host.innerHTML = '';

  const frame = currentLaplaceFrame();
  if (!frame) return;

  const frameIndex = state.laplace.frames.length - 1;
  const root = rootLaplaceFrame();
  const pathFactor = pathFactorToFrame(frameIndex);
  const breadcrumb = state.laplace.frames
    .map((item, index) => `<span class="breadcrumb-item${index === frameIndex ? ' active' : ''}">${UI.escapeHTML(item.label)} • ${item.matrix.length}×${item.matrix.length}</span>`)
    .join('<span class="breadcrumb-arrow">›</span>');

  let body = '';
  if (frame.sarrusResult) {
    body = sarrusHTML(frame.matrix, frame.label);
  } else if (frame.matrix.length === 2) {
    const value = M.determinant2x2(frame.matrix);
    if (frame.resolvedValue == null) {
      frame.resolvedValue = value;
      H.logAnalysisEvent(state.sessions.determinant, {
        type: 'directDeterminant',
        description: `${frame.label} resolvido como determinante 2×2`,
        matrix: frame.matrix,
        metadata: { label: frame.label, result: value, pathFactor }
      });
      propagateResolvedFrame(frameIndex);
      collapseResolvedLaplaceFrames();
      refreshLaplaceQuickControls();
      renderHistory();
      return renderLaplaceStudy();
    }
    body = `<div class="method-card"><h3>${UI.escapeHTML(frame.label)} — 2×2</h3>${UI.matrixHTML(frame.matrix, { title: frame.label })}<div class="result-box">ad − bc = <strong>${UI.fractionHTML(value)}</strong></div></div>`;
  } else if (!frame.terms) {
    body = `<div class="laplace-focus-card">
      <div class="focus-copy"><span class="focus-label">Matriz em foco</span><h3>${UI.escapeHTML(frame.label)} • ${frame.matrix.length}×${frame.matrix.length}</h3>${frameIndex > 0 ? `<p>Este menor entra na conta principal com fator acumulado <strong>${UI.fractionHTML(pathFactor)}</strong>.</p>` : '<p>Escolha a linha/coluna acima e aplique Laplace em um único passo.</p>'}</div>
      ${UI.matrixHTML(frame.matrix, { title: frame.label })}
    </div>`;
  } else {
    const nonZeroTerms = frame.terms
      .map((term, termIndex) => ({ term, termIndex }))
      .filter(({ term }) => !term.element.isZero());
    const zeroCount = frame.terms.length - nonZeroTerms.length;
    const terms = nonZeroTerms.map(({ term, termIndex }) => {
      const minorLabel = `M${term.row + 1}${term.col + 1}`;
      const coefficient = laplaceTermCoefficient(term);
      const status = term.status === 'resolved'
        ? `<span class="term-chip done">✓ ${minorLabel} = ${UI.fractionHTML(term.minorResult)}</span>`
        : `<span class="term-chip pending">○ ${minorLabel} pendente</span>`;
      return `<article class="laplace-term streamlined">
        <div class="laplace-term-top"><h4>${UI.fractionHTML(coefficient)} × det(${minorLabel})</h4>${status}</div>
        ${term.status === 'pending' ? UI.matrixHTML(term.minor, { compact: true, title: minorLabel }) : ''}
        ${term.contribution ? `<div class="term-contribution">Contribuição: <strong>${UI.fractionHTML(coefficient)} × ${UI.fractionHTML(term.minorResult)} = ${UI.fractionHTML(term.contribution)}</strong></div>` : ''}
        ${term.status === 'pending' ? `<button class="secondary" type="button" data-laplace-action="open" data-term="${termIndex}">Resolver ${minorLabel}</button>` : ''}
      </article>`;
    }).join('');

    body = `<div class="method-card laplace-stage-card">
      <div class="method-header"><div><h3>${UI.escapeHTML(frame.label)}</h3><p>${frame.axis === 'row' ? 'Linha' : 'Coluna'} ${frame.index + 1} expandida por Laplace.</p></div></div>
      <div class="laplace-equation">${laplaceExpressionHTML(frame)}</div>
      ${zeroCount ? `<div class="small-note">${zeroCount} termo(s) com coeficiente 0 foram eliminados automaticamente.</div>` : ''}
      <div class="laplace-terms">${terms || '<div class="small-note">Nenhum termo pendente.</div>'}</div>
      ${frame.resolvedValue ? `<div class="result-box">${UI.escapeHTML(frame.label)} = <strong>${UI.fractionHTML(frame.resolvedValue)}</strong></div>` : ''}
    </div>`;
  }

  const rootEquation = rootExpressionHTML();
  const correction = root?.resolvedValue ? determinantCorrectionHTML(root.resolvedValue) : '';
  const back = frameIndex > 0 ? '<button class="ghost laplace-back" type="button" data-laplace-action="back">← Voltar sem resolver este menor</button>' : '';
  host.innerHTML = `<div class="laplace-breadcrumb">${breadcrumb}</div>${rootEquation}${frameIndex > 0 ? `<div class="path-factor">Fator acumulado deste caminho: <strong>${UI.fractionHTML(pathFactor)}</strong></div>` : ''}${body}${correction}${back}`;
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
  const root = session.problemType === 'determinant' ? rootLaplaceFrame() : null;
  return H.sessionToJSONString(session, {
    determinantStudy: session.problemType === 'determinant' ? {
      swaps: H.swapStats(session),
      transformFactor: H.determinantTransformFactor(session),
      laplaceActive: state.laplace.frames.length > 0,
      laplaceCurrentDeterminant: root?.resolvedValue || null,
      originalDeterminant: root?.originalDeterminant || null
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

$('#laplaceQuickAxis').addEventListener('change', () => {
  $('#laplaceQuickAxis').dataset.userChoice = 'true';
  const frame = currentLaplaceFrame();
  if (frame && frame.resolvedValue == null) {
    frame.axis = $('#laplaceQuickAxis').value;
    frame.index = 0;
  }
  refreshLaplaceQuickControls();
});
$('#laplaceQuickIndex').addEventListener('change', () => {
  const frame = currentLaplaceFrame();
  if (frame && frame.resolvedValue == null) frame.index = Number($('#laplaceQuickIndex').value || 0);
});
$('#applyLaplaceBtn').addEventListener('click', applyQuickLaplace);
$('#studySarrusBtn').addEventListener('click', () => {
  const frame = ensureLaplaceRoot();
  if (!frame || frame.matrix.length !== 3) return;
  resolveLaplaceFrameWithSarrus();
});
$('#laplaceStudy').addEventListener('click', event => {
  const button = event.target.closest('[data-laplace-action]');
  if (!button) return;
  const action = button.dataset.laplaceAction;
  if (action === 'open') {
    openLaplaceTerm(Number(button.dataset.term));
  } else if (action === 'back') {
    if (state.laplace.frames.length > 1) state.laplace.frames.pop();
    refreshLaplaceQuickControls();
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
