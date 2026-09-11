/**
 * video-editor-state.js — Central State & History Store for Video Studio.
 * Handles cues array, active playhead cue, timing offsets, styling options,
 * and multi-level undo/redo operations.
 */
(() => {
  'use strict';

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
        fontSize: '1.25', // rem
        position: 'bottom', // 'bottom' | 'center' | 'top'
        color: '#ffffff',
        bgColor: 'rgba(0, 0, 0, 0.75)',
        showOrig: false,
      };

      this.undoStack = [];
      this.redoStack = [];
      this.listeners = {};
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

    setCues(newCues, recordHistory = true) {
      if (recordHistory) this.pushUndo();
      this.cues = Array.isArray(newCues) ? newCues.map((c) => ({ ...c })) : [];
      this.emit('cuesChange', this.cues);
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

    pushUndo() {
      this.undoStack.push(JSON.stringify(this.cues));
      if (this.undoStack.length > 35) this.undoStack.shift();
      this.redoStack = [];
    }

    undo() {
      if (!this.undoStack.length) return false;
      this.redoStack.push(JSON.stringify(this.cues));
      this.cues = JSON.parse(this.undoStack.pop());
      this.emit('cuesChange', this.cues);
      return true;
    }

    redo() {
      if (!this.redoStack.length) return false;
      this.undoStack.push(JSON.stringify(this.cues));
      this.cues = JSON.parse(this.redoStack.pop());
      this.emit('cuesChange', this.cues);
      return true;
    }

    updateCue(index, updatedCue) {
      if (index >= 0 && index < this.cues.length) {
        this.pushUndo();
        this.cues[index] = { ...this.cues[index], ...updatedCue };
        this.emit('cuesChange', this.cues);
      }
    }

    splitCue(index, splitTimeMs) {
      if (index < 0 || index >= this.cues.length) return null;
      const original = this.cues[index];
      if (splitTimeMs <= original.start + 200 || splitTimeMs >= original.end - 200) {
        return null;
      }

      this.pushUndo();
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
      // Reindex
      this.cues.forEach((c, idx) => { c.index = idx + 1; });
      this.emit('cuesChange', this.cues);
      return newCue;
    }
  }

  window.VideoEditorState = new VideoEditorStateManager();
})();
