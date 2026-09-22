(function (global) {
  'use strict';

  const M = global.MatrixMath;
  const H = global.MatrixHistory;

  function escapeHTML(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function fractionHTML(value) {
    const fraction = M.Fraction.from(value);
    if (fraction.d === 1) return `<span class="number">${fraction.n}</span>`;
    const negative = fraction.n < 0;
    return `<span class="fraction" aria-label="${escapeHTML(fraction.toString())}">
      ${negative ? '<span class="fraction-sign">−</span>' : ''}
      <span class="fraction-stack">
        <span class="fraction-num">${Math.abs(fraction.n)}</span>
        <span class="fraction-bar"></span>
        <span class="fraction-den">${fraction.d}</span>
      </span>
    </span>`;
  }

  function showToast(message) {
    const toast = document.querySelector('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  async function copyText(text, successMessage = '✓ JSON copiado') {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand?.('copy');
      area.remove();
      showToast(ok ? successMessage : 'Não foi possível copiar automaticamente.');
      return Boolean(ok);
    }
  }

  function wireSmartZeroInput(input) {
    const selectZero = () => {
      if (input.value === '0') input.select();
    };
    input.addEventListener('focus', selectZero);
    input.addEventListener('pointerup', event => {
      if (input.value === '0') {
        event.preventDefault();
        input.select();
      }
    });
    input.addEventListener('beforeinput', event => {
      if (input.value !== '0') return;
      if (!event.inputType.startsWith('insert') || event.data == null) return;
      event.preventDefault();
      input.value = event.data;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function makeEditor(container, rows, cols, values = null, divider = null) {
    container.innerHTML = '';
    const matrix = document.createElement('div');
    matrix.className = 'matrix matrix-editor';
    for (let row = 0; row < rows; row++) {
      const rowElement = document.createElement('div');
      rowElement.className = 'matrix-row';
      for (let col = 0; col < cols; col++) {
        const input = document.createElement('input');
        input.className = 'matrix-input';
        input.inputMode = 'text';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.setAttribute('aria-label', `Linha ${row + 1}, coluna ${col + 1}`);
        input.value = values ? M.Fraction.from(values[row][col]).toString() : '0';
        if (divider !== null && col === divider) input.classList.add('aug-divider');
        wireSmartZeroInput(input);
        rowElement.appendChild(input);
      }
      matrix.appendChild(rowElement);
    }
    container.appendChild(matrix);
  }

  function parseGrid(container) {
    const rows = [...container.querySelectorAll('.matrix-row')];
    if (!rows.length) throw new Error('A matriz está vazia.');
    return rows.map((row, rowIndex) =>
      [...row.querySelectorAll('input')].map((input, colIndex) => {
        try {
          return M.Fraction.from(input.value);
        } catch {
          throw new Error(`Valor inválido em (${rowIndex + 1},${colIndex + 1}): ${input.value || 'vazio'}.`);
        }
      })
    );
  }

  function matrixHeader(title, matrix, copy = true) {
    const header = document.createElement('div');
    header.className = 'matrix-block-head';
    const label = document.createElement('strong');
    label.textContent = title || 'Matriz';
    header.appendChild(label);
    if (copy) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'copy-matrix-btn ghost';
      button.textContent = '⧉ Copiar JSON';
      button.setAttribute('aria-label', 'Copiar matriz como JSON');
      button.addEventListener('click', () => copyText(H.matrixToJSONString(matrix)));
      header.appendChild(button);
    }
    return header;
  }

  function renderMatrix(container, matrix, options = {}) {
    const {
      divider = null,
      editable = false,
      highlights = [],
      title = null,
      showCopyButton = true,
      compact = false
    } = options;
    container.innerHTML = '';

    if (!matrix) {
      container.innerHTML = '<p class="small-note">Nenhuma matriz carregada.</p>';
      return;
    }

    const block = document.createElement('div');
    block.className = `matrix-block${compact ? ' compact' : ''}`;
    block.appendChild(matrixHeader(title || (editable ? 'Matriz editável' : 'Matriz'), matrix, showCopyButton));

    const scroller = document.createElement('div');
    scroller.className = 'matrix-inner-scroll';
    const highlightMap = new Map(highlights.map(item => [`${item.row ?? item[0]}:${item.col ?? item[1]}`, item.state || 'highlight']));
    const box = document.createElement('div');
    box.className = `matrix${editable ? ' matrix-editor' : ''}`;

    matrix.forEach((row, rowIndex) => {
      const rowElement = document.createElement('div');
      rowElement.className = 'matrix-row';
      row.forEach((value, colIndex) => {
        let element;
        if (editable) {
          element = document.createElement('input');
          element.className = 'matrix-input';
          element.inputMode = 'text';
          element.autocomplete = 'off';
          element.spellcheck = false;
          element.value = M.Fraction.from(value).toString();
          element.setAttribute('aria-label', `Linha ${rowIndex + 1}, coluna ${colIndex + 1}`);
          wireSmartZeroInput(element);
        } else {
          element = document.createElement('div');
          element.className = 'matrix-cell';
          element.innerHTML = fractionHTML(value);
        }
        if (divider !== null && colIndex === divider) element.classList.add('aug-divider');
        const state = highlightMap.get(`${rowIndex}:${colIndex}`);
        if (state) {
          element.classList.add(`${state}-cell`);
          element.dataset.cellState = state;
          element.title = state === 'changed' ? 'Valor alterado' : state === 'correct' ? 'Alteração correta' : state === 'error' ? 'Valor incorreto' : 'Célula destacada';
        }
        rowElement.appendChild(element);
      });
      box.appendChild(rowElement);
    });

    scroller.appendChild(box);
    block.appendChild(scroller);
    container.appendChild(block);
  }

  function matrixHTML(matrix, options = {}) {
    const json = encodeURIComponent(H.matrixToJSONString(matrix));
    const title = escapeHTML(options.title || 'Matriz');
    const divider = options.divider ?? null;
    const compact = options.compact ? ' compact' : '';
    const rows = matrix.map((row, rowIndex) => `<div class="matrix-row">${row.map((value, colIndex) => {
      const dividerClass = divider !== null && colIndex === divider ? ' aug-divider' : '';
      return `<div class="matrix-cell${dividerClass}">${fractionHTML(value)}</div>`;
    }).join('')}</div>`).join('');
    return `<div class="matrix-block${compact}">
      <div class="matrix-block-head"><strong>${title}</strong><button type="button" class="copy-matrix-btn ghost" aria-label="Copiar matriz como JSON" data-copy-matrix="${json}">⧉ Copiar JSON</button></div>
      <div class="matrix-inner-scroll"><div class="matrix">${rows}</div></div>
    </div>`;
  }

  function bindGlobalCopyHandler() {
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-copy-matrix]');
      if (!button) return;
      copyText(decodeURIComponent(button.dataset.copyMatrix));
    });
  }

  function updateChangedCells(container, originalMatrix) {
    const inputs = [...container.querySelectorAll('.matrix-input')];
    const cols = originalMatrix[0]?.length || 0;
    const changed = [];
    inputs.forEach((input, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      input.classList.remove('changed-cell', 'correct-cell', 'error-cell');
      input.removeAttribute('data-cell-state');
      try {
        const current = M.Fraction.from(input.value);
        if (!current.equals(originalMatrix[row][col])) {
          input.classList.add('changed-cell');
          input.dataset.cellState = 'changed';
          input.title = 'Valor alterado';
          changed.push({ row, col });
        }
      } catch {
        input.classList.add('changed-cell');
        input.dataset.cellState = 'changed';
        input.title = 'Valor alterado (ainda inválido)';
        changed.push({ row, col });
      }
    });
    return changed;
  }

  function markComparison(container, expected, actual) {
    const inputs = [...container.querySelectorAll('.matrix-input')];
    const cols = expected[0].length;
    const states = [];
    inputs.forEach((input, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      input.classList.remove('changed-cell', 'correct-cell', 'error-cell');
      const sameAsExpected = M.Fraction.from(actual[row][col]).equals(expected[row][col]);
      const state = sameAsExpected ? 'correct' : 'error';
      input.classList.add(`${state}-cell`);
      input.dataset.cellState = state;
      input.title = sameAsExpected ? 'Valor correto' : 'Valor incorreto';
      states.push({ row, col, state });
    });
    return states;
  }

  function setFeedback(element, message, type = 'info') {
    element.className = `feedback ${type}`;
    element.textContent = message;
  }

  global.MatrixUI = {
    escapeHTML,
    fractionHTML,
    showToast,
    copyText,
    makeEditor,
    parseGrid,
    renderMatrix,
    matrixHTML,
    bindGlobalCopyHandler,
    updateChangedCells,
    markComparison,
    setFeedback,
    wireSmartZeroInput
  };
})(typeof window !== 'undefined' ? window : globalThis);
