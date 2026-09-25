/**
 * video-editor-state.js — State/history store for Video Studio.
 * Keeps cue edits deterministic and safe for the timeline, overlay, and app sync.
 */
(() => {
  'use strict';

  const CMD = {
    UPDATE_TEXT: 'CMD_UPDATE_TEXT',
    UPDATE_TIMING: 'CMD_UPDATE_TIMING',
    SPLIT_CUE: 'CMD_SPLIT_CUE',
    ADD_CUE: 'CMD_ADD_CUE',
    DELETE_CUE: 'CMD_DELETE_CUE',
    NUDGE_TIMING: 'CMD_NUDGE_TIMING',
    SET_CUES: 'CMD_SET_CUES',
    UPDATE_CUE: 'CMD_UPDATE_CUE',
  };

  const copyCue = (cue) => (cue && typeof cue === 'object' ? { ...cue } : cue);
  const copyCues = (cues) => (Array.isArray(cues) ? cues.map(copyCue) : []);

  class VideoEditorStateManager {
    constructor() {
      this.cues = [];
      this.activeCue = null;
      this.activeCueIndex = -1;
      this.inspectorCue = null;
      this.inspectorCueIndex = -1;
      this.syncOffsetMs = 0;
      this.aspectRatio = '16:9';
      this.overlayConfig = {
        fontSize: '1.25',
        position: 'bottom',
        color: '#ffffff',
        bgColor: 'transparent',
        showOrig: this._readShowOriginal(),
      };
      this.undoStack = [];
      this.redoStack = [];
      this.maxHistorySteps = 600;
      this.listeners = {};
      this._lastTextEditTime = 0;
      this._lastTextEditIndex = -1;
      this.isDirty = false;
      this.lastSavedTimestamp = Date.now();
      this._autoSaveTimer = null;
    }

    _readShowOriginal() {
      try { return localStorage.getItem('kurdish_translator_studio_show_orig') !== '0'; } catch (_) { return true; }
    }

    on(event, cb) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(cb);
      return () => { this.listeners[event] = this.listeners[event].filter((fn) => fn !== cb); };
    }

    emit(event, data) {
      (this.listeners[event] || []).slice().forEach((cb) => {
        try { cb(data); } catch (err) { console.error(err); }
      });
    }

    markDirty() {
      if (!this.isDirty) {
        this.isDirty = true;
        this.emit('dirtyStateChange', { isDirty: true, lastSaved: this.lastSavedTimestamp });
      }
      clearTimeout(this._autoSaveTimer);
      this._autoSaveTimer = setTimeout(() => {
        try {
          if (this.cues.length) localStorage.setItem('kurdish_translator_studio_draft', JSON.stringify({ cues: this.cues, savedAt: Date.now() }));
        } catch (_) {}
      }, 3000);
    }

    markClean() {
      this.isDirty = false;
      this.lastSavedTimestamp = Date.now();
      this.emit('dirtyStateChange', { isDirty: false, lastSaved: this.lastSavedTimestamp });
    }

    saveToApp() {
      try {
        if (typeof window._updateAppWorkCues === 'function') window._updateAppWorkCues(this.cues, true);
        try { localStorage.setItem('kurdish_translator_studio_saved', JSON.stringify({ cues: this.cues, savedAt: Date.now() })); } catch (_) {}
        this.markClean();
        if (typeof Toast !== 'undefined') Toast.show('Saved to Project', 'success', { subtext: `${this.cues.length} subtitle cues committed.` });
        else if (window.VideoEditorUI && window.VideoEditorUI.showToast) window.VideoEditorUI.showToast('Saved all changes to project', 'success');
        return true;
      } catch (err) { console.error('saveToApp failed:', err); return false; }
    }

    canUndo() { return this.undoStack.length > 0; }
    canRedo() { return this.redoStack.length > 0; }

    _emitHistoryChange() {
      this.emit('undoRedoChange', { canUndo: this.canUndo(), canRedo: this.canRedo(), undoCount: this.undoStack.length, redoCount: this.redoStack.length });
    }

    _pushCommand(command) {
      this.undoStack.push(command);
      if (this.undoStack.length > this.maxHistorySteps) this.undoStack.shift();
      this.redoStack = [];
      this.markDirty();
      this._emitHistoryChange();
    }

    _reindex() {
      this.cues.sort((a, b) => (a.start || 0) - (b.start || 0));
      this.cues.forEach((cue, index) => { cue.index = index + 1; });
      if (this.activeCue) {
        const index = this.cues.indexOf(this.activeCue);
        if (index >= 0) this.activeCueIndex = index;
      }
    }

    setCues(newCues, recordHistory = true) {
      const nextCues = copyCues(newCues);
      if (recordHistory) this._pushCommand({ type: CMD.SET_CUES, prevCues: copyCues(this.cues), nextCues, prevActiveIndex: this.activeCueIndex });
      this.cues = nextCues;
      this._reindex();
      this.emit('cuesChange', this.cues);
      this._emitHistoryChange();
    }

    getCues() { return this.cues; }

    setActiveCue(cue, index) {
      this.activeCue = cue || null;
      this.activeCueIndex = Number.isInteger(index) ? index : -1;
      this.emit('activeCueChange', { cue: this.activeCue, index: this.activeCueIndex });
    }

    setSyncOffset(ms) { this.syncOffsetMs = Number.isFinite(Number(ms)) ? Number(ms) : 0; this.emit('syncOffsetChange', this.syncOffsetMs); }
    setOverlayConfig(config) { this.overlayConfig = Object.assign({}, this.overlayConfig, config || {}); this.emit('overlayConfigChange', this.overlayConfig); }

    pushUndo() { this._pushCommand({ type: CMD.SET_CUES, prevCues: copyCues(this.cues), nextCues: null, prevActiveIndex: this.activeCueIndex }); }

    _restoreCues(cues, activeIndex) {
      this.cues = copyCues(cues);
      this._reindex();
      if (this.cues.length && Number.isInteger(activeIndex) && activeIndex >= 0 && activeIndex < this.cues.length) this.setActiveCue(this.cues[activeIndex], activeIndex);
      else if (!this.cues.length) this.setActiveCue(null, -1);
      this.emit('cuesChange', this.cues);
    }

    undo() {
      const command = this.undoStack.pop();
      if (!command) return false;
      const before = copyCues(this.cues);
      const active = this.activeCueIndex;
      if (command.type === CMD.SET_CUES) this._restoreCues(command.prevCues, command.prevActiveIndex);
      else if (command.type === CMD.UPDATE_TEXT) { const cue = this.cues[command.index]; if (cue) { cue.text = command.prevText; this.emit('cuesChange', this.cues); } }
      else if (command.type === CMD.UPDATE_TIMING || command.type === CMD.NUDGE_TIMING) { const cue = this.cues[command.index]; if (cue) { cue.start = command.prevStart; cue.end = command.prevEnd; this._reindex(); this.emit('cuesChange', this.cues); } }
      else if (command.type === CMD.UPDATE_CUE) { if (this.cues[command.index]) { this.cues[command.index] = copyCue(command.prevCue); this._reindex(); this.emit('cuesChange', this.cues); } }
      else if (command.type === CMD.SPLIT_CUE) { this.cues[command.index] = copyCue(command.prevCue); this.cues.splice(command.index + 1, 1); this._reindex(); this.emit('cuesChange', this.cues); }
      else if (command.type === CMD.ADD_CUE) { this.cues.splice(command.index, 1); this._reindex(); this.emit('cuesChange', this.cues); }
      else if (command.type === CMD.DELETE_CUE) { this.cues.splice(command.index, 0, copyCue(command.deletedCue)); this._reindex(); this.emit('cuesChange', this.cues); }
      this.redoStack.push({ ...command, before, after: copyCues(this.cues), activeBefore: active, activeAfter: this.activeCueIndex });
      this._emitHistoryChange();
      return true;
    }

    redo() {
      const command = this.redoStack.pop();
      if (!command) return false;
      if (command.after) this._restoreCues(command.after, command.activeAfter);
      else return false;
      this.undoStack.push({ type: CMD.SET_CUES, prevCues: command.before, nextCues: command.after, prevActiveIndex: command.activeBefore });
      this._emitHistoryChange();
      return true;
    }

    updateCue(index, updatedCue, recordHistory = true) {
      if (index < 0 || index >= this.cues.length) return;
      const prevCue = copyCue(this.cues[index]);
      const nextCue = Object.assign({}, prevCue, updatedCue || {});
      if (recordHistory) this._pushCommand({ type: CMD.UPDATE_CUE, index, prevCue, nextCue });
      this.cues[index] = nextCue;
      if (this.activeCueIndex === index) this.activeCue = nextCue;
      this._reindex();
      this.emit('cuesChange', this.cues);
    }

    updateCueText(index, newText) {
      if (index < 0 || index >= this.cues.length) return;
      const text = String(newText == null ? '' : newText);
      const previous = this.cues[index].text || '';
      if (previous === text) return;
      const now = Date.now();
      const last = this.undoStack[this.undoStack.length - 1];
      if (this._lastTextEditIndex === index && now - this._lastTextEditTime < 850 && last && last.type === CMD.UPDATE_TEXT && last.index === index) last.nextText = text;
      else this._pushCommand({ type: CMD.UPDATE_TEXT, index, prevText: previous, nextText: text });
      this._lastTextEditTime = now;
      this._lastTextEditIndex = index;
      this.cues[index] = { ...this.cues[index], text };
      if (this.activeCueIndex === index) this.activeCue = this.cues[index];
      this.emit('cuesChange', this.cues);
    }

    updateCueTiming(index, startMs, endMs, recordHistory = true) {
      if (index < 0 || index >= this.cues.length) return;
      const start = Math.max(0, Math.round(Number(startMs) || 0));
      const end = Math.max(start + 100, Math.round(Number(endMs) || start + 100));
      const cue = this.cues[index];
      if (cue.start === start && cue.end === end) return;
      if (recordHistory) this._pushCommand({ type: CMD.UPDATE_TIMING, index, prevStart: cue.start, prevEnd: cue.end, nextStart: start, nextEnd: end });
      this.cues[index] = { ...cue, start, end };
      if (this.activeCueIndex === index) this.activeCue = this.cues[index];
      this._reindex();
      this.emit('cuesChange', this.cues);
    }

    splitCue(index, splitTimeMs) {
      const cue = this.cues[index];
      if (!cue || splitTimeMs <= cue.start + 200 || splitTimeMs >= cue.end - 200) return null;
      const prevCue = copyCue(cue);
      const newCue = { ...cue, start: splitTimeMs + 10, end: cue.end, origText: cue.origText || '' };
      this.cues[index] = { ...cue, end: splitTimeMs };
      this.cues.splice(index + 1, 0, newCue);
      this._reindex();
      this._pushCommand({ type: CMD.SPLIT_CUE, index, prevCue, newCue: copyCue(newCue), splitTimeMs });
      this.emit('cuesChange', this.cues);
      return this.cues[index + 1];
    }

    addCue(startMs, endMs = null, text = 'دەقی ژێرنووسی نوێ', origText = '') {
      const start = Math.max(0, Math.round(Number(startMs) || 0));
      const next = this.cues.find((cue) => cue.start > start);
      const end = Math.max(start + 200, Math.round(endMs == null ? Math.min(start + 2500, next ? Math.max(start + 400, next.start - 50) : start + 2500) : endMs));
      const cue = { start, end, text: text || 'دەقی ژێرنووسی نوێ', origText: origText || '' };
      const index = this.cues.findIndex((item) => item.start > start);
      const insertAt = index < 0 ? this.cues.length : index;
      this.cues.splice(insertAt, 0, cue);
      this._reindex();
      this._pushCommand({ type: CMD.ADD_CUE, index: insertAt, newCue: copyCue(cue) });
      this.emit('cuesChange', this.cues);
      return this.cues[insertAt];
    }

    deleteCue(index) {
      if (index < 0 || index >= this.cues.length) return false;
      const deletedCue = this.cues.splice(index, 1)[0];
      this._reindex();
      this._pushCommand({ type: CMD.DELETE_CUE, index, deletedCue: copyCue(deletedCue) });
      this.emit('cuesChange', this.cues);
      return true;
    }

    duplicateCue(index) {
      const cue = this.cues[index];
      if (!cue) return null;
      const duration = Math.max(500, cue.end - cue.start);
      return this.addCue(cue.end + 20, cue.end + 20 + duration, cue.text, cue.origText || '');
    }

    nudgeCue(index, deltaMs = 0) {
      const cue = this.cues[index];
      if (!cue || !deltaMs) return null;
      const duration = cue.end - cue.start;
      this.updateCueTiming(index, Math.max(0, cue.start + deltaMs), Math.max(0, cue.start + deltaMs) + duration);
      return this.cues[index];
    }

    nudgeCueTiming(index, startDeltaMs = 0, endDeltaMs = 0) {
      const cue = this.cues[index];
      if (!cue) return null;
      this.updateCueTiming(index, cue.start + startDeltaMs, cue.end + endDeltaMs);
      return this.cues[index];
    }
  }

  window.VideoEditorState = new VideoEditorStateManager();
})();
