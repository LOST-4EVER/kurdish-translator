/**
 * video-editor-state.js — High-Performance State & History Store for Video Studio.
 * Handles cues array, active playhead cue, timing offsets, styling options,
 * and advanced granular command/diff undo/redo operations with typing coalescing
 * and zero-lag O(1) state mutations.
 */
(() => {
  'use strict';

  // Command types for granular, low-memory history recording
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

  class VideoEditorStateManager {
    constructor() {
      this.cues = [];
      this.activeCue = null;
      this.activeCueIndex = -1;
      this.inspectorCue = null;
      this.inspectorCueIndex = -1;
      this.syncOffsetMs = 0;

      this.aspectRatio = '16:9';
      let savedShowOrig = false;
      try {
        savedShowOrig = localStorage.getItem('kurdish_translator_studio_show_orig') !== '0';
      } catch (_) {}

      this.overlayConfig = {
        fontSize: '1.25', // rem
        position: 'bottom', // 'bottom' | 'center' | 'top'
        color: '#ffffff',
        bgColor: 'transparent',
        showOrig: savedShowOrig,
      };

      this.undoStack = [];
      this.redoStack = [];
      this.maxHistorySteps = 600;
      this.listeners = {};
      this._lastTextEditTime = 0;
      this._lastTextEditIndex = -1;
    }

    on(event, cb) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(cb);
      return () => {
        this.listeners[event] = this.listeners[event].filter((f) => f !== cb);
      };
    }

    emit(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach((cb) => {
          try { cb(data); } catch (e) { console.error(e); }
        });
      }
    }

    canUndo() {
      return this.undoStack.length > 0;
    }

    canRedo() {
      return this.redoStack.length > 0;
    }

    _emitHistoryChange() {
      this.emit('undoRedoChange', {
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoCount: this.undoStack.length,
        redoCount: this.redoStack.length,
      });
    }

    _pushCommand(cmd) {
      this.undoStack.push(cmd);
      if (this.undoStack.length > this.maxHistorySteps) {
        this.undoStack.shift();
      }
      this.redoStack = [];
      this._emitHistoryChange();
    }

    _reindex() {
      for (let i = 0; i < this.cues.length; i++) {
        this.cues[i].index = i + 1;
      }
    }

    setCues(newCues, recordHistory = true) {
      if (recordHistory) {
        const prevCues = this.cues.map((c) => ({ ...c }));
        const nextCues = Array.isArray(newCues) ? newCues.map((c) => ({ ...c })) : [];
        this._pushCommand({
          type: CMD.SET_CUES,
          prevCues,
          nextCues,
          prevActiveIndex: this.activeCueIndex,
        });
      }
      this.cues = Array.isArray(newCues) ? newCues.map((c) => ({ ...c })) : [];
      this._reindex();
      this.emit('cuesChange', this.cues);
      this._emitHistoryChange();
    }

    getCues() {
      return this.cues;
    }

    setActiveCue(cue, index) {
      this.activeCue = cue;
      this.activeCueIndex = index;
      this.emit('activeCueChange', { cue, index });
    }

    setSyncOffset(ms) {
      this.syncOffsetMs = ms;
      this.emit('syncOffsetChange', this.syncOffsetMs);
    }

    setOverlayConfig(newConfig) {
      this.overlayConfig = Object.assign(this.overlayConfig, newConfig);
      this.emit('overlayConfigChange', this.overlayConfig);
    }

    /**
     * Backward-compatible pushUndo: creates a lightweight command or snapshot
     */
    pushUndo() {
      const prevCues = this.cues.map((c) => ({ ...c }));
      this._pushCommand({
        type: CMD.SET_CUES,
        prevCues,
        nextCues: null,
        prevActiveIndex: this.activeCueIndex,
      });
    }

    undo() {
      if (!this.undoStack.length) return false;
      const cmd = this.undoStack.pop();

      // Haptic feedback if supported on mobile devices
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(15); } catch (_) {}
      }

      switch (cmd.type) {
        case CMD.UPDATE_TEXT: {
          if (cmd.index >= 0 && cmd.index < this.cues.length) {
            const currentText = this.cues[cmd.index].text;
            this.cues[cmd.index].text = cmd.prevText;
            this.activeCueIndex = cmd.index;
            this.activeCue = this.cues[cmd.index];
            this.redoStack.push({ ...cmd, nextText: currentText });
            this.emit('cuesChange', this.cues);
          }
          break;
        }

        case CMD.UPDATE_TIMING:
        case CMD.NUDGE_TIMING: {
          if (cmd.index >= 0 && cmd.index < this.cues.length) {
            this.cues[cmd.index].start = cmd.prevStart;
            this.cues[cmd.index].end = cmd.prevEnd;
            this.activeCueIndex = cmd.index;
            this.activeCue = this.cues[cmd.index];
            this.redoStack.push(cmd);
            this.emit('cuesChange', this.cues);
          }
          break;
        }

        case CMD.UPDATE_CUE: {
          if (cmd.index >= 0 && cmd.index < this.cues.length) {
            const currentCue = { ...this.cues[cmd.index] };
            this.cues[cmd.index] = { ...cmd.prevCue };
            this.activeCueIndex = cmd.index;
            this.activeCue = this.cues[cmd.index];
            this.redoStack.push({ ...cmd, nextCue: currentCue });
            this.emit('cuesChange', this.cues);
          }
          break;
        }

        case CMD.SPLIT_CUE: {
          if (cmd.index >= 0 && cmd.index < this.cues.length) {
            this.cues[cmd.index] = { ...cmd.prevCue };
            if (this.cues[cmd.index + 1]) {
              this.cues.splice(cmd.index + 1, 1);
            }
            this._reindex();
            this.activeCueIndex = cmd.index;
            this.activeCue = this.cues[cmd.index];
            this.redoStack.push(cmd);
            this.emit('cuesChange', this.cues);
          }
          break;
        }

        case CMD.ADD_CUE: {
          if (cmd.index >= 0 && cmd.index < this.cues.length) {
            this.cues.splice(cmd.index, 1);
            this._reindex();
            this.activeCueIndex = Math.max(0, cmd.index - 1);
            this.activeCue = this.cues[this.activeCueIndex] || null;
            this.redoStack.push(cmd);
            this.emit('cuesChange', this.cues);
          }
          break;
        }

        case CMD.DELETE_CUE: {
          this.cues.splice(cmd.index, 0, { ...cmd.deletedCue });
          this._reindex();
          this.activeCueIndex = cmd.index;
          this.activeCue = this.cues[this.activeCueIndex];
          this.redoStack.push(cmd);
          this.emit('cuesChange', this.cues);
          break;
        }

        case CMD.SET_CUES: {
          const currentCues = this.cues.map((c) => ({ ...c }));
          this.redoStack.push({
            type: CMD.SET_CUES,
            prevCues: currentCues,
            nextCues: cmd.prevCues,
            prevActiveIndex: this.activeCueIndex,
          });
          this.cues = cmd.prevCues.map((c) => ({ ...c }));
          this._reindex();
          if (typeof cmd.prevActiveIndex === 'number' && cmd.prevActiveIndex >= 0 && cmd.prevActiveIndex < this.cues.length) {
            this.activeCueIndex = cmd.prevActiveIndex;
            this.activeCue = this.cues[this.activeCueIndex];
          }
          this.emit('cuesChange', this.cues);
          break;
        }

        default: {
          // Legacy snapshot support
          if (cmd.cues) {
            const currentSnapshot = {
              cues: JSON.stringify(this.cues),
              activeCueIndex: this.activeCueIndex,
            };
            this.redoStack.push(currentSnapshot);
            this.cues = JSON.parse(cmd.cues);
            if (typeof cmd.activeCueIndex === 'number' && cmd.activeCueIndex >= 0 && cmd.activeCueIndex < this.cues.length) {
              this.activeCueIndex = cmd.activeCueIndex;
              this.activeCue = this.cues[this.activeCueIndex];
            }
            this.emit('cuesChange', this.cues);
          }
        }
      }

      this._emitHistoryChange();
      return true;
    }

    redo() {
      if (!this.redoStack.length) return false;
      const cmd = this.redoStack.pop();

      // Haptic feedback if supported on mobile devices
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(15); } catch (_) {}
      }

      switch (cmd.type) {
        case CMD.UPDATE_TEXT: {
          if (cmd.index >= 0 && cmd.index < this.cues.length) {
            const prevText = this.cues[cmd.index].text;
            this.cues[cmd.index].text = cmd.nextText;
            this.activeCueIndex = cmd.index;
            this.activeCue = this.cues[cmd.index];
            this.undoStack.push({ ...cmd, prevText });
            this.emit('cuesChange', this.cues);
          }
          break;
        }

        case CMD.UPDATE_TIMING:
        case CMD.NUDGE_TIMING: {
          if (cmd.index >= 0 && cmd.index < this.cues.length) {
            this.cues[cmd.index].start = cmd.nextStart;
            this.cues[cmd.index].end = cmd.nextEnd;
            this.activeCueIndex = cmd.index;
            this.activeCue = this.cues[cmd.index];
            this.undoStack.push(cmd);
            this.emit('cuesChange', this.cues);
          }
          break;
        }

        case CMD.UPDATE_CUE: {
          if (cmd.index >= 0 && cmd.index < this.cues.length) {
            const prevCue = { ...this.cues[cmd.index] };
            this.cues[cmd.index] = { ...cmd.nextCue };
            this.activeCueIndex = cmd.index;
            this.activeCue = this.cues[cmd.index];
            this.undoStack.push({ ...cmd, prevCue });
            this.emit('cuesChange', this.cues);
          }
          break;
        }

        case CMD.SPLIT_CUE: {
          if (cmd.index >= 0 && cmd.index < this.cues.length) {
            this.cues[cmd.index].end = cmd.splitTimeMs;
            this.cues.splice(cmd.index + 1, 0, { ...cmd.newCue });
            this._reindex();
            this.activeCueIndex = cmd.index + 1;
            this.activeCue = this.cues[this.activeCueIndex];
            this.undoStack.push(cmd);
            this.emit('cuesChange', this.cues);
          }
          break;
        }

        case CMD.ADD_CUE: {
          this.cues.splice(cmd.index, 0, { ...cmd.newCue });
          this._reindex();
          this.activeCueIndex = cmd.index;
          this.activeCue = this.cues[this.activeCueIndex];
          this.undoStack.push(cmd);
          this.emit('cuesChange', this.cues);
          break;
        }

        case CMD.DELETE_CUE: {
          if (cmd.index >= 0 && cmd.index < this.cues.length) {
            this.cues.splice(cmd.index, 1);
            this._reindex();
            this.activeCueIndex = Math.min(cmd.index, this.cues.length - 1);
            this.activeCue = this.cues[this.activeCueIndex] || null;
            this.undoStack.push(cmd);
            this.emit('cuesChange', this.cues);
          }
          break;
        }

        case CMD.SET_CUES: {
          const currentCues = this.cues.map((c) => ({ ...c }));
          this.undoStack.push({
            type: CMD.SET_CUES,
            prevCues: currentCues,
            nextCues: cmd.nextCues,
            prevActiveIndex: this.activeCueIndex,
          });
          this.cues = cmd.nextCues ? cmd.nextCues.map((c) => ({ ...c })) : [];
          this._reindex();
          this.emit('cuesChange', this.cues);
          break;
        }

        default: {
          if (cmd.cues) {
            const currentSnapshot = {
              cues: JSON.stringify(this.cues),
              activeCueIndex: this.activeCueIndex,
            };
            this.undoStack.push(currentSnapshot);
            this.cues = JSON.parse(cmd.cues);
            if (typeof cmd.activeCueIndex === 'number' && cmd.activeCueIndex >= 0 && cmd.activeCueIndex < this.cues.length) {
              this.activeCueIndex = cmd.activeCueIndex;
              this.activeCue = this.cues[this.activeCueIndex];
            }
            this.emit('cuesChange', this.cues);
          }
        }
      }

      this._emitHistoryChange();
      return true;
    }

    updateCue(index, updatedCue, recordHistory = true) {
      if (index >= 0 && index < this.cues.length) {
        if (recordHistory) {
          this._pushCommand({
            type: CMD.UPDATE_CUE,
            index,
            prevCue: { ...this.cues[index] },
            nextCue: { ...this.cues[index], ...updatedCue },
          });
        }
        this.cues[index] = { ...this.cues[index], ...updatedCue };
        if (this.activeCueIndex === index) {
          this.activeCue = this.cues[index];
        }
        this.emit('cuesChange', this.cues);
      }
    }

    updateCueText(index, newText) {
      if (index >= 0 && index < this.cues.length) {
        const prevText = this.cues[index].text;
        if (prevText === newText) return;

        const now = Date.now();
        const isConsecutiveTyping = (
          this._lastTextEditIndex === index &&
          (now - this._lastTextEditTime) < 850 &&
          this.undoStack.length > 0 &&
          this.undoStack[this.undoStack.length - 1].type === CMD.UPDATE_TEXT &&
          this.undoStack[this.undoStack.length - 1].index === index
        );

        if (isConsecutiveTyping) {
          // Coalesce continuous typing in the same cue into one clean undo step
          this.undoStack[this.undoStack.length - 1].nextText = newText;
        } else {
          this._pushCommand({
            type: CMD.UPDATE_TEXT,
            index,
            prevText,
            nextText,
            timestamp: now,
          });
        }

        this._lastTextEditTime = now;
        this._lastTextEditIndex = index;

        this.cues[index] = { ...this.cues[index], text: newText };
        if (this.activeCueIndex === index) {
          this.activeCue = this.cues[index];
        }
        this.emit('cuesChange', this.cues);
      }
    }

    updateCueTiming(index, newStartMs, newEndMs, recordHistory = true) {
      if (index >= 0 && index < this.cues.length) {
        const start = Math.max(0, Math.round(newStartMs));
        const end = Math.max(start + 100, Math.round(newEndMs));
        const prevStart = this.cues[index].start;
        const prevEnd = this.cues[index].end;

        if (prevStart === start && prevEnd === end) return;

        if (recordHistory) {
          this._pushCommand({
            type: CMD.UPDATE_TIMING,
            index,
            prevStart,
            prevEnd,
            nextStart: start,
            nextEnd: end,
          });
        }

        this.cues[index] = { ...this.cues[index], start, end };
        if (this.activeCueIndex === index) {
          this.activeCue = this.cues[index];
        }
        this.emit('cuesChange', this.cues);
      }
    }

    splitCue(index, splitTimeMs) {
      if (index < 0 || index >= this.cues.length) return null;
      const original = this.cues[index];
      if (splitTimeMs <= original.start + 200 || splitTimeMs >= original.end - 200) {
        return null;
      }

      const prevCue = { ...original };
      const originalEnd = original.end;
      original.end = splitTimeMs;

      const newCue = {
        index: this.cues.length + 1,
        start: splitTimeMs + 10,
        end: originalEnd,
        text: original.text,
        origText: original.origText || '',
      };

      this.cues.splice(index + 1, 0, newCue);
      this._reindex();

      this._pushCommand({
        type: CMD.SPLIT_CUE,
        index,
        prevCue,
        newCue: { ...newCue },
        splitTimeMs,
      });

      this.emit('cuesChange', this.cues);
      return newCue;
    }

    addCue(startMs, endMs, text = 'نووسینی نوێی کوردی', origText = '') {
      const newCue = {
        index: this.cues.length + 1,
        start: Math.max(0, Math.round(startMs)),
        end: Math.max(startMs + 500, Math.round(endMs || startMs + 2000)),
        text: text || 'نووسینی نوێی کوردی',
        origText: origText || '',
      };

      // Find insertion point
      let insertIndex = this.cues.length;
      for (let i = 0; i < this.cues.length; i++) {
        if (this.cues[i].start > newCue.start) {
          insertIndex = i;
          break;
        }
      }

      this.cues.splice(insertIndex, 0, newCue);
      this._reindex();

      this._pushCommand({
        type: CMD.ADD_CUE,
        index: insertIndex,
        newCue: { ...newCue },
      });

      this.emit('cuesChange', this.cues);
      return newCue;
    }

    deleteCue(index) {
      if (index < 0 || index >= this.cues.length) return false;
      const deletedCue = { ...this.cues[index] };

      this.cues.splice(index, 1);
      this._reindex();

      this._pushCommand({
        type: CMD.DELETE_CUE,
        index,
        deletedCue,
      });

      this.emit('cuesChange', this.cues);
      return true;
    }

    nudgeCueTiming(index, startDeltaMs = 0, endDeltaMs = 0) {
      if (index < 0 || index >= this.cues.length) return null;
      const cue = this.cues[index];
      const prevStart = cue.start;
      const prevEnd = cue.end;

      cue.start = Math.max(0, cue.start + startDeltaMs);
      cue.end = Math.max(cue.start + 200, cue.end + endDeltaMs);

      this._pushCommand({
        type: CMD.NUDGE_TIMING,
        index,
        prevStart,
        prevEnd,
        nextStart: cue.start,
        nextEnd: cue.end,
      });

      this.emit('cuesChange', this.cues);
      return cue;
    }
  }

  window.VideoEditorState = new VideoEditorStateManager();
})();
