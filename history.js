(function (global) {
  'use strict';

  const M = global.MatrixMath || (typeof require !== 'undefined' ? require('./math.js') : null);

  function valueToJSON(value) {
    const fraction = M.Fraction.from(value);
    return fraction.d === 1 ? fraction.n : fraction.toString();
  }

  function matrixToJSONData(matrix) {
    return matrix.map(row => row.map(valueToJSON));
  }

  function matrixToJSONString(matrix, pretty = true) {
    return JSON.stringify(matrixToJSONData(matrix), null, pretty ? 2 : 0);
  }

  function operationToData(operation) {
    if (!operation) return null;
    const data = { type: operation.type };
    if (Number.isInteger(operation.rowA)) data.target = operation.rowA + 1;
    if (Number.isInteger(operation.rowB)) data.source = operation.rowB + 1;
    if (operation.type === 'swap') {
      data.rowA = operation.rowA + 1;
      data.rowB = operation.rowB + 1;
    } else if (operation.type === 'swapCol') {
      data.columnA = operation.rowA + 1;
      data.columnB = operation.rowB + 1;
      delete data.target;
      delete data.source;
    } else if (operation.k != null) {
      data.factor = M.Fraction.from(operation.k).toString();
    }
    return data;
  }

  function createStep({ index, type, description, before, after, operation = null, metadata = {} }) {
    return {
      step: index,
      type,
      description,
      operation: operationToData(operation),
      before: before ? M.cloneMatrix(before) : null,
      after: after ? M.cloneMatrix(after) : null,
      metadata: { ...metadata },
      timestamp: new Date().toISOString()
    };
  }

  function createSession({ mode = 'study', problemType = 'determinant', initialMatrix, augmentedAt = null }) {
    const initial = M.cloneMatrix(initialMatrix);
    return {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mode,
      problemType,
      initialMatrix: initial,
      currentMatrix: M.cloneMatrix(initial),
      history: [createStep({
        index: 0,
        type: 'initial',
        description: augmentedAt == null ? 'Matriz inicial' : 'Matriz inicial [A | I]',
        before: null,
        after: initial,
        metadata: { augmentedAt }
      })],
      redoStack: [],
      augmentedAt,
      createdAt: new Date().toISOString()
    };
  }

  function commit(session, nextMatrix, operation, description, metadata = {}) {
    const before = M.cloneMatrix(session.currentMatrix);
    const after = M.cloneMatrix(nextMatrix);
    const typeMap = {
      swap: 'rowSwap',
      swapCol: 'columnSwap',
      scale: 'rowScale',
      add: 'rowAdd'
    };
    const step = createStep({
      index: session.history.length,
      type: typeMap[operation?.type] || metadata.type || 'matrixChange',
      description,
      before,
      after,
      operation,
      metadata
    });
    session.currentMatrix = after;
    session.history.push(step);
    session.redoStack = [];
    return step;
  }

  function undo(session) {
    if (!session || session.history.length <= 1) return null;
    const removed = session.history.pop();
    session.redoStack.push(removed);
    session.currentMatrix = M.cloneMatrix(session.history.at(-1).after);
    return removed;
  }

  function redo(session) {
    if (!session || !session.redoStack.length) return null;
    const step = session.redoStack.pop();
    step.step = session.history.length;
    session.history.push(step);
    session.currentMatrix = M.cloneMatrix(step.after);
    return step;
  }

  function restart(session) {
    if (!session) return;
    session.currentMatrix = M.cloneMatrix(session.initialMatrix);
    session.history = [session.history[0]];
    session.redoStack = [];
  }

  function swapStats(session) {
    const stats = { rowSwaps: 0, columnSwaps: 0, total: 0, sign: 1 };
    if (!session) return stats;
    session.history.forEach(step => {
      if (step.type === 'rowSwap') stats.rowSwaps++;
      if (step.type === 'columnSwap') stats.columnSwaps++;
    });
    stats.total = stats.rowSwaps + stats.columnSwaps;
    stats.sign = stats.total % 2 === 0 ? 1 : -1;
    return stats;
  }

  function determinantTransformFactor(session) {
    let factor = new M.Fraction(1);
    if (!session) return factor;
    session.history.forEach(step => {
      if (step.type === 'rowSwap' || step.type === 'columnSwap') factor = factor.neg();
      if (step.type === 'rowScale' && step.operation?.factor != null) {
        factor = factor.mul(M.Fraction.from(step.operation.factor));
      }
    });
    return factor;
  }

  function stepToJSON(step) {
    return {
      step: step.step,
      type: step.type,
      description: step.description,
      operation: step.operation,
      before: step.before ? matrixToJSONData(step.before) : null,
      after: step.after ? matrixToJSONData(step.after) : null,
      metadata: step.metadata,
      timestamp: step.timestamp
    };
  }

  function sessionToJSONData(session, extra = {}) {
    return {
      version: '2.2',
      sessionId: session.id,
      mode: session.mode,
      problemType: session.problemType,
      createdAt: session.createdAt,
      initialMatrix: matrixToJSONData(session.initialMatrix),
      currentMatrix: matrixToJSONData(session.currentMatrix),
      augmentedAt: session.augmentedAt,
      steps: session.history.map(stepToJSON),
      determinantState: session.problemType === 'determinant' ? swapStats(session) : undefined,
      ...extra
    };
  }

  function sessionToJSONString(session, extra = {}) {
    return JSON.stringify(sessionToJSONData(session, extra), null, 2);
  }

  global.MatrixHistory = {
    valueToJSON,
    matrixToJSONData,
    matrixToJSONString,
    operationToData,
    createStep,
    createSession,
    commit,
    undo,
    redo,
    restart,
    swapStats,
    determinantTransformFactor,
    sessionToJSONData,
    sessionToJSONString
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.MatrixHistory;
})(typeof window !== 'undefined' ? window : globalThis);
