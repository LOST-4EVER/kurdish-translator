/**
 * app-editor.js — Subtitle Editor, Undo/Redo Engine, Search & Sync Controller.
 */
const AppEditor = (() => {
  let els = {};
  let state = {
    workCues: null,
    baseCues: null,
    rowEls: null,
    lastActiveRow: null,
    dirty: false,
    undoStack: [],
    redoStack: [],
    lastCommittedState: '',
    editDebounceTimer: null,
    editorObserver: null,
    searchMatchIndices: [],
    currentSearchMatchPos: -1,
    callbacks: {
      onCueEdit: null,
      onUndoRedo: null,
      onDownloadNeedRefresh: null,
      onSeekCue: null,
    },
  };

  const stripTags = (text) => (text || '').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '');
  const displayText = (text) => stripTags(text).replace(/\\N/g, '\n');
  const hasArabic = (text) => /[\u0600-\u06ff]/.test(text);
  const dirFor = (text) => (hasArabic(text) ? 'rtl' : 'ltr');

  function init(domEls, callbacks = {}) {
    els = domEls;
    state.callbacks = { ...state.callbacks, ...callbacks };
    bindEvents();
  }

  function autoGrow(el) {
    if (!el || el.scrollHeight === 0) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  function setCues(workCues, baseCues) {
    state.workCues = workCues;
    state.baseCues = baseCues;
    initHistory(workCues);
    buildEditor();
  }

  function initHistory(cues) {
    state.undoStack = [];
    state.redoStack = [];
    state.lastCommittedState = JSON.stringify(cues || []);
    updateUndoRedoUI();
    checkEditsState();
  }

  function recordPreEditSnapshot() {
    if (!state.workCues) return;
    const currentJson = JSON.stringify(state.workCues);
    if (currentJson === state.lastCommittedState) {
      state.undoStack.push(JSON.parse(currentJson));
      if (state.undoStack.length > 60) state.undoStack.shift();
      state.redoStack = [];
      updateUndoRedoUI();
    }
  }

  function pushUndoState() {
    clearTimeout(state.editDebounceTimer);
    if (!state.workCues) return;
    const currentJson = JSON.stringify(state.workCues);
    if (currentJson !== state.lastCommittedState) {
      state.lastCommittedState = currentJson;
      updateUndoRedoUI();
      checkEditsState();
      if (state.callbacks.onDownloadNeedRefresh) state.callbacks.onDownloadNeedRefresh();
    }
  }

  function updateUndoRedoUI() {
    const disabled = state.undoStack.length === 0;
    const redoDisabled = state.redoStack.length === 0;
    ['undoBtn', 'fsUndoBtn', 'fsEdUndoBtn'].forEach((k) => {
      if (els[k]) els[k].disabled = disabled;
    });
    ['redoBtn', 'fsRedoBtn', 'fsEdRedoBtn'].forEach((k) => {
      if (els[k]) els[k].disabled = redoDisabled;
    });
  }

  function hasEdits() {
    if (!state.baseCues || !state.workCues) return false;
    if (state.baseCues.length !== state.workCues.length) return true;
    for (let i = 0; i < state.workCues.length; i++) {
      if (state.workCues[i].text !== state.baseCues[i].text) return true;
    }
    return false;
  }

  function checkEditsState() {
    const edited = hasEdits();
    state.dirty = edited;
    if (els.edDownloadBtn) {
      if (edited) {
        els.edDownloadBtn.style.display = 'inline-flex';
        els.edDownloadBtn.classList.add('has-edits');
      } else {
        els.edDownloadBtn.style.display = 'none';
        els.edDownloadBtn.classList.remove('has-edits');
      }
    }
    updateStatus();
    return edited;
  }

  function updateStatus() {
    if (!els.editorStatus) return;
    const saveEditsChecked = els.saveEditsToggle ? els.saveEditsToggle.checked : true;
    els.editorStatus.textContent = state.dirty
      ? (saveEditsChecked ? 'Your edits will appear in the download' : 'Edits appear here only — not in the download')
      : 'Synced with the preview — edits apply live';
  }

  function performUndo() {
    if (!state.undoStack.length) return;
    clearTimeout(state.editDebounceTimer);
    const currentSnapshot = state.workCues.map((c) => ({ ...c }));
    state.redoStack.push(currentSnapshot);
    const prev = state.undoStack.pop();
    state.workCues = prev.map((c) => ({ ...c }));
    state.lastCommittedState = JSON.stringify(state.workCues);
    state.dirty = hasEdits();
    updateUndoRedoUI();
    restoreCuesState();
    checkEditsState();
    if (state.callbacks.onUndoRedo) state.callbacks.onUndoRedo(state.workCues);
  }

  function performRedo() {
    if (!state.redoStack.length) return;
    clearTimeout(state.editDebounceTimer);
    const currentSnapshot = state.workCues.map((c) => ({ ...c }));
    state.undoStack.push(currentSnapshot);
    const next = state.redoStack.pop();
    state.workCues = next.map((c) => ({ ...c }));
    state.lastCommittedState = JSON.stringify(state.workCues);
    state.dirty = hasEdits();
    updateUndoRedoUI();
    restoreCuesState();
    checkEditsState();
    if (state.callbacks.onUndoRedo) state.callbacks.onUndoRedo(state.workCues);
  }

  function restoreCuesState() {
    if (state.rowEls && state.rowEls.length === state.workCues.length) {
      state.workCues.forEach((c, i) => {
        const row = state.rowEls[i];
        if (row) {
          const input = row.querySelector('.ed-input');
          if (input) {
            const val = displayText(c.text);
            if (input.value !== val) {
              input.value = val;
              input.setAttribute('dir', dirFor(val));
              autoGrow(input);
            }
          }
        }
      });
    } else {
      buildEditor();
    }
    if (state.callbacks.onDownloadNeedRefresh) state.callbacks.onDownloadNeedRefresh();
  }

  function applyCueEdit(i, text) {
    if (i < 0 || !state.workCues || !state.workCues[i]) return;
    if (state.workCues[i].text === text) return;

    recordPreEditSnapshot();

    state.workCues[i].text = text;
    if (typeof Translator !== 'undefined' && Translator.normalizeForSearch) {
      state.workCues[i]._normText = Translator.normalizeForSearch(text);
    } else {
      state.workCues[i]._normText = (text || '').toLowerCase();
    }

    if (typeof SubtitlePlayer !== 'undefined' && SubtitlePlayer.updateText) {
      SubtitlePlayer.updateText(i, stripTags(text));
    }
    state.dirty = true;

    // Sync corresponding textarea in the editor list
    const row = state.rowEls ? state.rowEls[i] : null;
    if (row) {
      const input = row.querySelector('.ed-input');
      const val = displayText(text);
      if (input && input.value !== val) {
        input.value = val;
        input.setAttribute('dir', dirFor(val));
        autoGrow(input);
      }
    }

    clearTimeout(state.editDebounceTimer);
    state.editDebounceTimer = setTimeout(() => {
      state.lastCommittedState = JSON.stringify(state.workCues);
      updateUndoRedoUI();
      checkEditsState();
      if (state.callbacks.onDownloadNeedRefresh) state.callbacks.onDownloadNeedRefresh();
    }, 400);

    checkEditsState();
    if (state.callbacks.onCueEdit) state.callbacks.onCueEdit(i, text);
  }

  function buildEditor() {
    const list = els.editorList;
    if (!list) return;
    list.innerHTML = '';
    const showTime = els.showTimeToggle ? els.showTimeToggle.checked : true;

    if (!state.workCues || !state.workCues.length) {
      const empty = document.createElement('p');
      empty.className = 'ed-empty';
      empty.textContent = 'Load a subtitle file to edit it here.';
      list.appendChild(empty);
      if (els.edCount) els.edCount.textContent = '';
      return;
    }
    if (els.edCount) els.edCount.textContent = `· ${state.workCues.length}`;

    const frag = document.createDocumentFragment();
    const rows = new Array(state.workCues.length);
    const inputs = new Array(state.workCues.length);

    state.workCues.forEach((c, i) => {
      const row = document.createElement('div');
      row.className = 'ed-row';
      row.dataset.index = i;
      rows[i] = row;

      const meta = document.createElement('div');
      meta.className = 'ed-meta';

      const idx = document.createElement('span');
      idx.className = 'ed-idx';
      idx.textContent = String(i + 1).padStart(2, '0');

      const time = document.createElement('span');
      time.className = 'ed-time';
      const startStr = typeof SubParser !== 'undefined' ? SubParser.fmtSRT(c.start) : '';
      const endStr = typeof SubParser !== 'undefined' ? SubParser.fmtSRT(c.end) : '';
      time.innerHTML = `<span class="ed-time-start">${startStr}</span><span class="ed-time-sep">➔</span><span class="ed-time-end">${endStr}</span>`;
      time.classList.toggle('hidden', !showTime);

      meta.appendChild(idx);
      meta.appendChild(time);
      row.appendChild(meta);

      const input = document.createElement('textarea');
      input.className = 'ed-input';
      input.value = displayText(c.text);
      input.setAttribute('dir', dirFor(input.value));
      input.setAttribute('aria-label', `Cue ${i + 1} text`);
      inputs[i] = input;
      row.appendChild(input);
      frag.appendChild(row);
    });
    list.appendChild(frag);

    if (state.editorObserver) {
      state.editorObserver.disconnect();
    }
    state.editorObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const input = entry.target;
          autoGrow(input);
          state.editorObserver.unobserve(input);
        }
      });
    }, {
      root: els.editorList,
      rootMargin: '100px',
    });

    inputs.forEach((input) => {
      state.editorObserver.observe(input);
    });

    state.rowEls = rows;
    state.lastActiveRow = null;
    if (els.edSearchInput && els.edSearchInput.value.trim()) {
      filterEditor();
    }
  }

  function updateSearchBadge(matchCount, currentPos) {
    const badge = els.edSearchCount;
    const nav = els.edSearchNav;
    if (!badge) return;

    if (matchCount === 0) {
      badge.textContent = '0';
      badge.classList.remove('hidden');
      if (nav) nav.classList.add('hidden');
      return;
    }

    const pos = currentPos >= 0 ? currentPos + 1 : 1;
    let label = `${pos} / ${matchCount}`;
    if (els.kurdishDigitsToggle && els.kurdishDigitsToggle.checked && typeof Translator !== 'undefined' && Translator.normalizeDigits) {
      label = Translator.normalizeDigits(label, true);
    }
    badge.textContent = label;
    badge.classList.remove('hidden');
    if (nav) nav.classList.remove('hidden');
  }

  function goToSearchMatch(index, scroll = true) {
    if (!state.searchMatchIndices || state.searchMatchIndices.length === 0) return;
    state.currentSearchMatchPos = (index + state.searchMatchIndices.length) % state.searchMatchIndices.length;
    const cueIdx = state.searchMatchIndices[state.currentSearchMatchPos];

    if (state.rowEls) {
      state.rowEls.forEach((row, i) => {
        if (!row) return;
        if (i === cueIdx) {
          row.classList.add('search-current-match');
          if (scroll) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          row.classList.remove('search-current-match');
        }
      });
    }

    updateSearchBadge(state.searchMatchIndices.length, state.currentSearchMatchPos);

    if (els.syncVideoToggle && els.syncVideoToggle.checked && SubtitlePlayer && typeof SubtitlePlayer.seekToCue === 'function') {
      SubtitlePlayer.seekToCue(cueIdx);
    }
  }

  function nextSearchMatch() {
    if (state.searchMatchIndices.length === 0) return;
    goToSearchMatch(state.currentSearchMatchPos + 1);
  }

  function prevSearchMatch() {
    if (state.searchMatchIndices.length === 0) return;
    goToSearchMatch(state.currentSearchMatchPos - 1);
  }

  function filterEditor() {
    if (!els.edSearchInput) return;
    const rawQuery = els.edSearchInput.value.trim();
    const clearBtn = els.edSearchClearBtn;
    const countBadge = els.edSearchCount;
    const nav = els.edSearchNav;

    state.searchMatchIndices = [];
    state.currentSearchMatchPos = -1;

    if (!rawQuery) {
      if (clearBtn) clearBtn.classList.add('hidden');
      if (countBadge) countBadge.classList.add('hidden');
      if (nav) nav.classList.add('hidden');
      if (state.rowEls) {
        state.rowEls.forEach((row) => {
          if (row) {
            row.classList.remove('search-hidden', 'search-matched', 'search-current-match');
          }
        });
      }
      return;
    }

    if (clearBtn) clearBtn.classList.remove('hidden');

    const normQuery = typeof Translator !== 'undefined' && Translator.normalizeForSearch
      ? Translator.normalizeForSearch(rawQuery)
      : rawQuery.toLowerCase();
    const lowerQuery = rawQuery.toLowerCase();

    if (state.rowEls && state.workCues) {
      state.workCues.forEach((cue, i) => {
        const row = state.rowEls[i];
        if (!row) return;
        const text = cue.text || '';
        const normText = cue._normText !== undefined ? cue._normText : (
          typeof Translator !== 'undefined' && Translator.normalizeForSearch
            ? (cue._normText = Translator.normalizeForSearch(text))
            : text.toLowerCase()
        );
        const lowerText = text.toLowerCase();
        const time = `${SubParser.fmtSRT(cue.start)} ${SubParser.fmtSRT(cue.end)}`.toLowerCase();
        const cueNum = String(i + 1);

        const matches =
          normText.includes(normQuery) ||
          lowerText.includes(lowerQuery) ||
          time.includes(normQuery) ||
          time.includes(lowerQuery) ||
          cueNum === rawQuery ||
          `#${cueNum}` === rawQuery;

        if (matches) {
          state.searchMatchIndices.push(i);
          row.classList.remove('search-hidden');
          row.classList.add('search-matched');
        } else {
          row.classList.add('search-hidden');
          row.classList.remove('search-matched', 'search-current-match');
        }
      });
    }

    if (state.searchMatchIndices.length > 0) {
      goToSearchMatch(0, false);
    } else {
      updateSearchBadge(0, -1);
    }
  }

  function scrollRowIntoView(row) {
    const list = els.editorList;
    if (!list || !row) return;
    if (els.syncVideoToggle && !els.syncVideoToggle.checked) return;
    const r = row.getBoundingClientRect();
    const b = list.getBoundingClientRect();
    if (r.top < b.top + 8 || r.bottom > b.bottom - 8) {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function highlightActiveCue(idx) {
    if (idx < 0 || !state.rowEls || !state.rowEls[idx]) return;
    if (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('ed-input')) return;
    if (state.lastActiveRow && state.lastActiveRow.classList) state.lastActiveRow.classList.remove('active');
    const row = state.rowEls[idx];
    if (row && row.classList) {
      row.classList.add('active');
      state.lastActiveRow = row;
      scrollRowIntoView(row);
    }
  }

  function bindEvents() {
    if (els.editorList) {
      // Event delegation for input in rows
      els.editorList.addEventListener('input', (e) => {
        if (!e.target || !e.target.classList.contains('ed-input')) return;
        const input = e.target;
        const row = input.closest('.ed-row');
        if (!row) return;
        const i = parseInt(row.dataset.index, 10);
        autoGrow(input);
        input.setAttribute('dir', dirFor(input.value));
        applyCueEdit(i, input.value);
      });

      // Row click to seek/play
      els.editorList.addEventListener('click', (e) => {
        const row = e.target.closest('.ed-row');
        if (!row) return;
        const i = parseInt(row.dataset.index, 10);
        if (state.callbacks.onSeekCue) state.callbacks.onSeekCue(i);
      });
    }

    if (els.undoBtn) els.undoBtn.addEventListener('click', performUndo);
    if (els.redoBtn) els.redoBtn.addEventListener('click', performRedo);

    if (els.edSearchInput) {
      els.edSearchInput.addEventListener('input', filterEditor);
      els.edSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) prevSearchMatch();
          else nextSearchMatch();
        } else if (e.key === 'Escape') {
          els.edSearchInput.value = '';
          filterEditor();
        }
      });
    }

    if (els.edSearchClearBtn) {
      els.edSearchClearBtn.addEventListener('click', () => {
        if (els.edSearchInput) {
          els.edSearchInput.value = '';
          filterEditor();
          els.edSearchInput.focus();
        }
      });
    }

    if (els.edSearchNextBtn) els.edSearchNextBtn.addEventListener('click', nextSearchMatch);
    if (els.edSearchPrevBtn) els.edSearchPrevBtn.addEventListener('click', prevSearchMatch);

    if (els.showTimeToggle) {
      els.showTimeToggle.addEventListener('change', () => {
        if (state.rowEls) {
          state.rowEls.forEach((row) => {
            const time = row.querySelector('.ed-time');
            if (time) time.classList.toggle('hidden', !els.showTimeToggle.checked);
          });
        }
      });
    }

    if (els.saveEditsToggle) {
      els.saveEditsToggle.addEventListener('change', () => {
        updateStatus();
        if (state.callbacks.onDownloadNeedRefresh) state.callbacks.onDownloadNeedRefresh();
      });
    }

    // Global keyboard shortcuts for Undo / Redo
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement !== els.edSearchInput) return;
        e.preventDefault();
        performUndo();
      } else if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
        if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement !== els.edSearchInput) return;
        e.preventDefault();
        performRedo();
      }
    });
  }

  return {
    init,
    setCues,
    applyCueEdit,
    buildEditor,
    autoGrow,
    performUndo,
    performRedo,
    pushUndoState,
    recordPreEditSnapshot,
    filterEditor,
    goToSearchMatch,
    nextSearchMatch,
    prevSearchMatch,
    highlightActiveCue,
    hasEdits,
    checkEditsState,
    updateStatus,
    getWorkCues: () => state.workCues,
    getBaseCues: () => state.baseCues,
    isDirty: () => state.dirty,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppEditor;
}
