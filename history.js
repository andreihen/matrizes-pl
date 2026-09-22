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

  function serializeExact(value) {
    if (value == null) return value;
    if (value instanceof M.Fraction) return valueToJSON(value);
    if (Array.isArray(value)) return value.map(serializeExact);
    if (typeof value === 'object') {
      const out = {};
      Object.entries(value).forEach(([key, item]) => {
        if (item !== undefined) out[key] = serializeExact(item);
      });
      return out;
    }
    return value;
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

  function createStep({ index, order = index, type, description, before, after, operation = null, metadata = {} }) {
    return {
      step: index,
      order,
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
        order: 0,
        type: 'initial',
        description: augmentedAt == null ? 'Matriz inicial' : 'Matriz inicial [A | I]',
        before: null,
        after: initial,
        metadata: { augmentedAt }
      })],
      analysisEvents: [],
      redoStack: [],
      augmentedAt,
      sequence: 0,
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
    session.sequence = (session.sequence || 0) + 1;
    const step = createStep({
      index: session.history.length,
      order: session.sequence,
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

  function logAnalysisEvent(session, { type, description, matrix = null, metadata = {} }) {
    if (!session) return null;
    session.sequence = (session.sequence || 0) + 1;
    const event = {
      event: session.analysisEvents.length + 1,
      order: session.sequence,
      type,
      description,
      matrix: matrix ? M.cloneMatrix(matrix) : null,
      metadata: { ...metadata },
      timestamp: new Date().toISOString()
    };
    session.analysisEvents.push(event);
    return event;
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
    session.sequence = (session.sequence || 0) + 1;
    step.order = session.sequence;
    session.history.push(step);
    session.currentMatrix = M.cloneMatrix(step.after);
    return step;
  }

  function restart(session) {
    if (!session) return;
    session.currentMatrix = M.cloneMatrix(session.initialMatrix);
    session.history = [session.history[0]];
    session.analysisEvents = [];
    session.redoStack = [];
    session.sequence = 0;
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
      order: step.order,
      type: step.type,
      description: step.description,
      operation: step.operation,
      before: step.before ? matrixToJSONData(step.before) : null,
      after: step.after ? matrixToJSONData(step.after) : null,
      metadata: serializeExact(step.metadata),
      timestamp: step.timestamp
    };
  }

  function analysisEventToJSON(event) {
    return {
      event: event.event,
      order: event.order,
      type: event.type,
      description: event.description,
      matrix: event.matrix ? matrixToJSONData(event.matrix) : null,
      metadata: serializeExact(event.metadata),
      timestamp: event.timestamp
    };
  }

  function getTimeline(session) {
    if (!session) return [];
    const steps = session.history.map(step => ({ kind: 'matrixStep', order: step.order ?? step.step, item: step }));
    const events = (session.analysisEvents || []).map(event => ({ kind: 'analysisEvent', order: event.order, item: event }));
    return [...steps, ...events].sort((a, b) => a.order - b.order);
  }

  function sessionToJSONData(session, extra = {}) {
    return {
      version: '2.3',
      sessionId: session.id,
      mode: session.mode,
      problemType: session.problemType,
      createdAt: session.createdAt,
      initialMatrix: matrixToJSONData(session.initialMatrix),
      currentMatrix: matrixToJSONData(session.currentMatrix),
      augmentedAt: session.augmentedAt,
      steps: session.history.map(stepToJSON),
      analysisEvents: (session.analysisEvents || []).map(analysisEventToJSON),
      timeline: getTimeline(session).map(entry => entry.kind === 'matrixStep'
        ? { kind: entry.kind, ...stepToJSON(entry.item) }
        : { kind: entry.kind, ...analysisEventToJSON(entry.item) }),
      determinantState: session.problemType === 'determinant' ? swapStats(session) : undefined,
      ...serializeExact(extra)
    };
  }

  function sessionToJSONString(session, extra = {}) {
    return JSON.stringify(sessionToJSONData(session, extra), null, 2);
  }

  global.MatrixHistory = {
    valueToJSON,
    matrixToJSONData,
    matrixToJSONString,
    serializeExact,
    operationToData,
    createStep,
    createSession,
    commit,
    logAnalysisEvent,
    undo,
    redo,
    restart,
    swapStats,
    determinantTransformFactor,
    stepToJSON,
    analysisEventToJSON,
    getTimeline,
    sessionToJSONData,
    sessionToJSONString
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.MatrixHistory;
})(typeof window !== 'undefined' ? window : globalThis);
