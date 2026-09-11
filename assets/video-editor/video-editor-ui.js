/**
 * video-editor-ui.js — UI Loader & DOM Reference Registry for Video Studio.
 * Dynamically loads and mounts the Video Studio HTML markup from video-editor.html
 * into the host container, ensuring the main index.html remains clean and unpolluted.
 */
(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  class VideoEditorUIManager {
    constructor() {
      this.isMounted = false;
      this.mountPromise = null;
      this.els = {};
    }

    /**
     * Mounts the Video Studio HTML markup into #tabVideoEditor and document.body.
     * Fetches assets/video-editor/video-editor.html, with fallback template handling.
     */
    async mount() {
      if (this.mountPromise) return this.mountPromise;

      this.mountPromise = (async () => {
        let container = $('#tabVideoEditor');
        if (!container) {
          container = document.createElement('div');
          container.id = 'tabVideoEditor';
          container.className = 'hidden vn-studio-root';
          const main = $('main') || document.body;
          main.appendChild(container);
        }

        // Check if already populated
        if (!container.querySelector('#studioTopBar')) {
          try {
            const resp = await fetch('assets/video-editor/video-editor.html');
            if (resp.ok) {
              const html = await resp.text();
              this._injectHTML(html, container);
            } else {
              throw new Error(`HTTP ${resp.status}`);
            }
          } catch (err) {
            console.warn('Could not fetch video-editor.html directly, using resilient fallback template:', err);
            this._injectHTML(this._getFallbackHTML(), container);
          }
        }

        this._initElements();
        this.isMounted = true;
        return this.els;
      })();

      return this.mountPromise;
    }

    _injectHTML(rawHtml, container) {
      const temp = document.createElement('div');
      temp.innerHTML = rawHtml;

      const studioRoot = temp.querySelector('#tabVideoEditor');
      if (studioRoot) {
        container.innerHTML = studioRoot.innerHTML;
        // Copy attributes
        Array.from(studioRoot.attributes).forEach((attr) => {
          if (attr.name !== 'id') container.setAttribute(attr.name, attr.value);
        });
      }

      // Modals
      const cueModal = temp.querySelector('#cueInfoModal');
      if (cueModal && !$('#cueInfoModal')) {
        document.body.appendChild(cueModal);
      }
      const burnModal = temp.querySelector('#studioBurnModal');
      if (burnModal && !$('#studioBurnModal')) {
        document.body.appendChild(burnModal);
      }
    }

    _initElements() {
      this.els = {
        tabVideoEditor: $('#tabVideoEditor'),

        // Header Navigation & Actions
        btnBackToApp: $('#studioBackBtn'),
        helpBtn: $('#studioHelpBtn'),
        aspectRatioSel: $('#studioAspectRatioSel'),
        videoFilename: $('#studioVideoFilename'),
        btnApplyCurrentSubs: $('#studioApplyCurrentSubsBtn'),
        appliedSubsBadge: $('#studioSubsBadge'),
        btnImportSubFile: $('#studioImportSubBtn'),
        subFileInput: $('#studioSubFileInput'),
        btnBurnExport: $('#studioBurnExportBtn'),

        // Player Stage & Viewport
        playerStage: $('#studioPlayerStage'),
        viewportWrapper: $('#studioViewportWrapper'),
        videoPlaceholder: $('#studioVideoPlaceholder'),
        videoDropzone: $('#studioVideoDropzone'),
        videoFileInput: $('#studioVideoFileInput'),
        btnBrowseVideo: $('#studioBrowseVideoBtn'),
        btnSampleVideo: $('#studioSampleVideoBtn'),
        videoPlayer: $('#studioVideoElement'),
        videoOverlayContainer: $('#studioSubtitleOverlay'),
        videoOverlayText: $('#studioSubtitleText'),
        videoOverlayOrig: $('#studioSubtitleOrig'),
        fsBtn: $('#studioFsBtn'),

        // Transport Controls
        timeDisplay: $('#studioTimeDisplay'),
        stepBackBtn: $('#studioStepBackBtn'),
        playPauseBtn: $('#studioPlayPauseBtn'),
        playIcon: $('#studioPlayIcon'),
        pauseIcon: $('#studioPauseIcon'),
        stepForwardBtn: $('#studioStepForwardBtn'),
        syncPillBtn: $('#studioSyncPillBtn'),
        syncOffsetDisplay: $('#studioSyncOffsetDisplay'),
        undoBtn: $('#studioUndoBtn'),
        redoBtn: $('#studioRedoBtn'),

        // Active Text Shower Strip
        textShowerCard: $('#studioTextShower'),
        textShowerNum: $('#studioTextShowerNum'),
        textShowerText: $('#studioTextShowerText'),
        textShowerPace: $('#studioTextShowerPace'),

        // Timeline Mount
        timelineContainer: $('#studioTimelineMount'),

        // Bottom Toolbar Buttons
        toolStyleBtn: $('#vnToolStyleBtn'),
        toolInspectBtn: $('#vnToolInspectBtn'),
        toolSplitBtn: $('#vnToolSplitBtn'),
        toolSyncBtn: $('#vnToolSyncBtn'),
        toolSpeedBtn: $('#vnToolSpeedBtn'),
        speedLabel: $('#vnSpeedLabel'),
        toolVolumeBtn: $('#vnToolVolumeBtn'),
        toolVideoChangeBtn: $('#vnToolVideoChangeBtn'),

        // Popovers
        popovers: {
          style: $('#vnStylePopover'),
          sync: $('#vnSyncPopover'),
          speed: $('#vnSpeedPopover'),
          volume: $('#vnVolumePopover'),
        },

        // Style Popover Controls
        subFontFamilySel: $('#studioSubFontFamilySel'),
        subFontSel: $('#studioSubFontSel'),
        subPosSel: $('#studioSubPosSel'),
        subColorSel: $('#studioSubColorSel'),
        subBgSel: $('#studioSubBgSel'),
        subShowOrigToggle: $('#studioSubShowOrigToggle'),
        closeStylePop: $('#vnStyleCloseBtn'),

        // Sync Popover Controls
        syncBigDisplay: $('#studioSyncBigDisplay'),
        offsetMinus500: $('#studioOffsetMinus500Btn'),
        offsetMinus100: $('#studioOffsetMinus100Btn'),
        offsetReset: $('#studioOffsetResetBtn'),
        offsetPlus100: $('#studioOffsetPlus100Btn'),
        offsetPlus500: $('#studioOffsetPlus500Btn'),
        closeSyncPop: $('#vnSyncCloseBtn'),

        // Speed Popover Controls
        closeSpeedPop: $('#vnSpeedCloseBtn'),

        // Volume Popover Controls
        volumeSlider: $('#studioVolumeSlider'),
        muteToggle: $('#studioMuteBtn'),
        closeVolumePop: $('#vnVolumeCloseBtn'),

        // Cue Info Inspector Modal
        cueInfoModal: $('#cueInfoModal'),
        cueInfoCloseBtn: $('#cueInfoCloseBtn'),
        cueInfoCueNum: $('#cueInfoCueNum'),
        cueInfoStartTime: $('#cueInfoStartTime'),
        cueInfoEndTime: $('#cueInfoEndTime'),
        cueInfoDuration: $('#cueInfoDuration'),
        cueInfoCpsVal: $('#cueInfoCpsVal'),
        cueInfoWpmVal: $('#cueInfoWpmVal'),
        cueInfoCharsVal: $('#cueInfoCharsVal'),
        cueInfoWordsVal: $('#cueInfoWordsVal'),
        cueInfoScriptVal: $('#cueInfoScriptVal'),
        cueInfoTextInput: $('#cueInfoTextInput'),
        cueInfoOrigText: $('#cueInfoOrigText'),
        cueInfoJumpBtn: $('#cueInfoJumpBtn'),
        cueInfoSaveBtn: $('#cueInfoSaveBtn'),

        // Burn / Export Modal
        burnModal: $('#studioBurnModal'),
        burnCloseBtn: $('#studioBurnCloseBtn'),
        burnProgressFill: $('#studioBurnProgressFill'),
        burnStatusText: $('#studioBurnStatusText'),
        burnPercentText: $('#studioBurnPercentText'),
        burnSuccessArea: $('#studioBurnSuccessArea'),
        burnDownloadLink: $('#studioBurnDownloadLink'),
        burnActionBtn: $('#studioBurnStartBtn'),
        burnCancelBtn: $('#studioBurnCancelBtn'),

        // Advanced Export Controls
        exportGpuBadge: $('#studioGpuBadge'),
        exportConfigArea: $('#exportConfigArea'),
        exportStageArea: $('#exportStageArea'),
        exportResolutionSel: $('#exportResolutionSel'),
        exportBitratePresetSel: $('#exportBitratePresetSel'),
        exportCustomBitrateRow: $('#exportCustomBitrateRow'),
        exportBitrateSlider: $('#exportBitrateSlider'),
        exportCustomBitrateNum: $('#exportCustomBitrateNum'),
        exportBitrateVal: $('#exportBitrateVal'),
        exportSpecDimensions: $('#exportSpecDimensions'),
        exportSpecSubs: $('#exportSpecSubs'),
        exportSpecDuration: $('#exportSpecDuration'),
        exportSpecSize: $('#exportSpecSize'),
        exportPreviewCanvas: $('#exportPreviewCanvas'),
        exportFpsPill: $('#exportFpsPill'),
        exportResPill: $('#exportResPill'),
        exportMetricFrames: $('#exportMetricFrames'),
        exportMetricElapsed: $('#exportMetricElapsed'),
        exportMetricEta: $('#exportMetricEta'),
        exportSuccessDetails: $('#exportSuccessDetails'),
        exportDownloadBtnText: $('#exportDownloadBtnText'),
        exportStartBtnText: $('#exportStartBtnText'),
      };
      return this.els;
    }

    getElements() {
      return this.els;
    }

    showToast(msg, type = 'info', sub = '') {
      if (typeof Toast !== 'undefined' && Toast.show) {
        Toast.show(msg, type, { subtext: sub });
      }
    }
    _getFallbackHTML() {
      return "<!-- ==========================================================================\n     VIDEO STUDIO WORKSTATION TEMPLATE\n     VN-Style Zero-Scroll Subtitle Synchronizer & Video Editor\n     ========================================================================== -->\n<div id=\"tabVideoEditor\" class=\"hidden vn-studio-root\">\n  <!-- VN-Style Top Header Bar -->\n  <header class=\"vn-header\" id=\"studioTopBar\">\n    <div class=\"vn-header-left\">\n      <button type=\"button\" class=\"vn-icon-btn\" id=\"studioBackBtn\" title=\"Back to main app\" aria-label=\"Back\">\n        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"><path d=\"M15 18l-6-6 6-6\"/></svg>\n      </button>\n      <button type=\"button\" class=\"vn-icon-btn\" id=\"studioHelpBtn\" title=\"Studio shortcuts &amp; tips\" aria-label=\"Help\">\n        <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\"/><line x1=\"12\" y1=\"17\" x2=\"12.01\" y2=\"17\"/></svg>\n      </button>\n      <!-- VN Aspect Ratio Dropdown -->\n      <div class=\"vn-aspect-dropdown-wrap\">\n        <select class=\"vn-aspect-select\" id=\"studioAspectRatioSel\" title=\"Aspect Ratio\">\n          <option value=\"original\">Original ▾</option>\n          <option value=\"16:9\" selected>16:9 (Cinema)</option>\n          <option value=\"9:16\">9:16 (Reels/TikTok)</option>\n          <option value=\"1:1\">1:1 (Square)</option>\n          <option value=\"4:3\">4:3 (TV)</option>\n          <option value=\"21:9\">21:9 (Ultrawide)</option>\n        </select>\n      </div>\n      <span class=\"vn-file-badge\" id=\"studioVideoFilename\" title=\"No video loaded\">No video loaded</span>\n    </div>\n\n    <div class=\"vn-header-right\">\n      <!-- Glowing Connect / Apply Subtitles Button -->\n      <button type=\"button\" class=\"vn-connect-btn\" id=\"studioApplyCurrentSubsBtn\" title=\"Load Kurdish subtitles from translation tab\">\n        <span class=\"vn-connect-pulse\"></span>\n        <svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/></svg>\n        <span id=\"studioSubsBadge\">Apply Kurdish Subs</span>\n      </button>\n\n      <!-- Hidden sub file input for manual file choice -->\n      <input type=\"file\" id=\"studioSubFileInput\" accept=\".srt,.vtt,.ass,.ssa,.sub,.smi\" hidden />\n      <button type=\"button\" class=\"vn-icon-btn\" id=\"studioImportSubBtn\" title=\"Import subtitle file (.srt, .vtt, .ass)\" aria-label=\"Import subtitle file\">\n        <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><polyline points=\"17 8 12 3 7 8\"/><line x1=\"12\" y1=\"3\" x2=\"12\" y2=\"15\"/></svg>\n      </button>\n\n      <!-- VN-Style Export / Burn Button -->\n      <button type=\"button\" class=\"vn-export-btn\" id=\"studioBurnExportBtn\" title=\"Burn Kurdish subtitles into video &amp; export\">\n        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"><path d=\"M12 3v12\"/><polyline points=\"7 8 12 3 17 8\"/><rect x=\"4\" y=\"17\" width=\"16\" height=\"4\" rx=\"1\"/></svg>\n        <span>Export</span>\n      </button>\n    </div>\n  </header>\n\n  <!-- Video Player Stage (Flex 1, centered, zero scroll) -->\n  <section class=\"vn-player-stage\" id=\"studioPlayerStage\">\n    <div class=\"vn-viewport-container\" id=\"studioViewportWrapper\" data-ratio=\"16:9\">\n      <!-- Video Element -->\n      <video id=\"studioVideoElement\" class=\"vn-video-element hidden\" playsinline></video>\n\n      <!-- Sleek Compact Dropzone when empty -->\n      <div class=\"vn-empty-dropzone\" id=\"studioVideoPlaceholder\">\n        <div class=\"vn-empty-box\" id=\"studioVideoDropzone\">\n          <svg class=\"vn-empty-icon\" width=\"40\" height=\"40\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\">\n            <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"3\"/>\n            <path d=\"m10 8 6 4-6 4V8z\"/>\n          </svg>\n          <h3 class=\"vn-empty-title\">Import Video File</h3>\n          <p class=\"vn-empty-subtitle\">Supports MOV, MP4 &amp; WebM · Processed 100% locally in your browser</p>\n          <div class=\"vn-empty-actions\">\n            <button type=\"button\" class=\"vn-btn-primary\" id=\"studioBrowseVideoBtn\">\n              <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><polyline points=\"17 8 12 3 7 8\"/><line x1=\"12\" y1=\"3\" x2=\"12\" y2=\"15\"/></svg>\n              <span>Choose Video</span>\n            </button>\n            <button type=\"button\" class=\"vn-btn-secondary\" id=\"studioSampleVideoBtn\">\n              <svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><polygon points=\"5 3 19 12 5 21 5 3\"/></svg>\n              <span>Try Sample Video</span>\n            </button>\n          </div>\n          <input type=\"file\" id=\"studioVideoFileInput\" accept=\"video/mp4,video/quicktime,video/webm,.mov,.mp4,.webm\" hidden />\n        </div>\n      </div>\n\n      <!-- Video Subtitle Overlay -->\n      <div class=\"vn-subtitle-overlay pos-bottom hidden\" id=\"studioSubtitleOverlay\">\n        <div class=\"vn-subtitle-text\" id=\"studioSubtitleText\" dir=\"rtl\"></div>\n        <div class=\"vn-subtitle-orig hidden\" id=\"studioSubtitleOrig\"></div>\n      </div>\n\n      <!-- Fullscreen / Expand Button in Corner -->\n      <button type=\"button\" class=\"vn-fs-corner-btn\" id=\"studioFsBtn\" title=\"Fullscreen player\" aria-label=\"Fullscreen\">\n        <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><path d=\"M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7\"/></svg>\n      </button>\n    </div>\n  </section>\n\n  <!-- VN Transport / Control Bar (Right below the video) -->\n  <section class=\"vn-transport-bar\">\n    <!-- Timecode Display: Current / Total -->\n    <div class=\"vn-timecode-wrap\">\n      <span class=\"vn-time-current\" id=\"studioTimeDisplay\">00:00.00 / 00:00.00</span>\n    </div>\n\n    <!-- Centered Play / Seek Controls -->\n    <div class=\"vn-playback-cluster\">\n      <button type=\"button\" class=\"vn-transport-btn\" id=\"studioStepBackBtn\" title=\"Previous cue (←)\" aria-label=\"Previous cue\">\n        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M6 6h2v12H6zm3.5 6l8.5 6V6z\"/></svg>\n      </button>\n      <button type=\"button\" class=\"vn-play-master-btn\" id=\"studioPlayPauseBtn\" title=\"Play / Pause (Space)\" aria-label=\"Play / Pause\">\n        <svg id=\"studioPlayIcon\" width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><polygon points=\"7 5 19 12 7 19 7 5\"/></svg>\n        <svg id=\"studioPauseIcon\" class=\"hidden\" width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><rect x=\"6\" y=\"5\" width=\"4\" height=\"14\" rx=\"1\"/><rect x=\"14\" y=\"5\" width=\"4\" height=\"14\" rx=\"1\"/></svg>\n      </button>\n      <button type=\"button\" class=\"vn-transport-btn\" id=\"studioStepForwardBtn\" title=\"Next cue (→)\" aria-label=\"Next cue\">\n        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z\"/></svg>\n      </button>\n    </div>\n\n    <!-- Right Side: Sync offset, Undo, Redo -->\n    <div class=\"vn-transport-right\">\n      <button type=\"button\" class=\"vn-sync-pill\" id=\"studioSyncPillBtn\" title=\"Adjust subtitle sync timing offset\">\n        <span id=\"studioSyncOffsetDisplay\">0ms</span>\n      </button>\n      <button type=\"button\" class=\"vn-icon-btn-small\" id=\"studioUndoBtn\" title=\"Undo change\" aria-label=\"Undo\">\n        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><path d=\"M9 14 4 9l5-5\"/><path d=\"M20 20v-7a4 4 0 0 0-4-4H4\"/></svg>\n      </button>\n      <button type=\"button\" class=\"vn-icon-btn-small\" id=\"studioRedoBtn\" title=\"Redo change\" aria-label=\"Redo\">\n        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><path d=\"m15 14 5-5-5-5\"/><path d=\"M4 20v-7a4 4 0 0 1 4-4h12\"/></svg>\n      </button>\n    </div>\n  </section>\n\n  <!-- Active Text Shower Strip -->\n  <section class=\"vn-text-shower-strip\" id=\"studioTextShower\" role=\"button\" tabindex=\"0\" title=\"Click to inspect &amp; edit active cue\">\n    <div class=\"vn-shower-badge\" id=\"studioTextShowerNum\">--</div>\n    <div class=\"vn-shower-content\" id=\"studioTextShowerText\">No active subtitle · Scrub timeline or play video</div>\n    <div class=\"vn-shower-cps hidden\" id=\"studioTextShowerPace\">-- CPS</div>\n    <svg class=\"vn-shower-chevron\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"m9 18 6-6-6-6\"/></svg>\n  </section>\n\n  <!-- VN Multi-Track Timeline Section -->\n  <section class=\"vn-timeline-section\">\n    <div id=\"studioTimelineMount\"></div>\n  </section>\n\n  <!-- VN Bottom Action Toolbar -->\n  <footer class=\"vn-bottom-bar\">\n    <button type=\"button\" class=\"vn-tool-btn\" id=\"vnToolStyleBtn\" title=\"Subtitle typography &amp; appearance\">\n      <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M4 7V4h16v3\"/><path d=\"M9 20h6\"/><path d=\"M12 4v16\"/></svg>\n      <span>Style</span>\n    </button>\n    <button type=\"button\" class=\"vn-tool-btn\" id=\"vnToolInspectBtn\" title=\"Subtitle text inspector &amp; editor\">\n      <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z\"/></svg>\n      <span>Edit</span>\n    </button>\n    <button type=\"button\" class=\"vn-tool-btn\" id=\"vnToolSplitBtn\" title=\"Split subtitle cue at current playhead\">\n      <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"6\" cy=\"6\" r=\"3\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><line x1=\"20\" y1=\"4\" x2=\"8.12\" y2=\"15.88\"/><line x1=\"14.47\" y1=\"14.48\" x2=\"20\" y2=\"20\"/><line x1=\"8.12\" y1=\"8.12\" x2=\"12\" y2=\"12\"/></svg>\n      <span>Split</span>\n    </button>\n    <button type=\"button\" class=\"vn-tool-btn\" id=\"vnToolSyncBtn\" title=\"Subtitle timing sync offset\">\n      <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><polyline points=\"12 6 12 12 16 14\"/></svg>\n      <span>Sync</span>\n    </button>\n    <button type=\"button\" class=\"vn-tool-btn\" id=\"vnToolSpeedBtn\" title=\"Playback Speed\">\n      <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m16.2 7.8-2 6.3-6.4 2 2-6.3z\"/></svg>\n      <span id=\"vnSpeedLabel\">1.0×</span>\n    </button>\n    <button type=\"button\" class=\"vn-tool-btn\" id=\"vnToolVolumeBtn\" title=\"Audio volume &amp; mute\">\n      <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><polygon points=\"11 5 6 9 2 9 2 15 6 15 11 19 11 5\"/><path d=\"M15.54 8.46a5 5 0 0 1 0 7.07\"/></svg>\n      <span>Volume</span>\n    </button>\n    <button type=\"button\" class=\"vn-tool-btn\" id=\"vnToolVideoChangeBtn\" title=\"Change video file\">\n      <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"2.18\" ry=\"2.18\"/><line x1=\"7\" y1=\"2\" x2=\"7\" y2=\"22\"/><line x1=\"17\" y1=\"2\" x2=\"17\" y2=\"22\"/><line x1=\"2\" y1=\"12\" x2=\"22\" y2=\"12\"/></svg>\n      <span>Video</span>\n    </button>\n  </footer>\n\n  <!-- Floating Popovers (Style, Sync, Speed, Volume) -->\n  <div class=\"vn-popover hidden\" id=\"vnStylePopover\">\n    <div class=\"vn-popover-header\">\n      <h4>Subtitle Style</h4>\n      <button type=\"button\" class=\"vn-popover-close\" id=\"vnStyleCloseBtn\" aria-label=\"Close style popover\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"></line><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"></line></svg></button>\n    </div>\n    <div class=\"vn-popover-body\">\n      <div class=\"vn-popover-row\">\n        <label>Font Size</label>\n        <select id=\"studioSubFontSel\" class=\"vn-pop-select\">\n          <option value=\"1\">Small</option>\n          <option value=\"1.25\" selected>Medium (Default)</option>\n          <option value=\"1.55\">Large</option>\n          <option value=\"1.9\">Extra Large</option>\n        </select>\n      </div>\n      <div class=\"vn-popover-row\">\n        <label>Position</label>\n        <select id=\"studioSubPosSel\" class=\"vn-pop-select\">\n          <option value=\"bottom\" selected>Bottom</option>\n          <option value=\"center\">Center</option>\n          <option value=\"top\">Top</option>\n        </select>\n      </div>\n      <div class=\"vn-popover-row\">\n        <label>Color</label>\n        <select id=\"studioSubColorSel\" class=\"vn-pop-select\">\n          <option value=\"#ffffff\" selected>White</option>\n          <option value=\"#fef08a\">Yellow</option>\n          <option value=\"#a6f4c5\">Cyan / Mint</option>\n          <option value=\"#d0bcff\">Purple</option>\n        </select>\n      </div>\n      <div class=\"vn-popover-row\">\n        <label>Background</label>\n        <select id=\"studioSubBgSel\" class=\"vn-pop-select\">\n          <option value=\"rgba(0, 0, 0, 0.75)\" selected>Dark Box</option>\n          <option value=\"rgba(0, 0, 0, 0.45)\">Soft Box</option>\n          <option value=\"transparent\">Transparent (Shadow only)</option>\n        </select>\n      </div>\n      <div class=\"vn-popover-row\">\n        <label style=\"display:flex; align-items:center; gap:8px; cursor:pointer;\">\n          <input type=\"checkbox\" id=\"studioSubShowOrigToggle\" />\n          <span>Show Original English Text</span>\n        </label>\n      </div>\n    </div>\n  </div>\n\n  <div class=\"vn-popover hidden\" id=\"vnSyncPopover\">\n    <div class=\"vn-popover-header\">\n      <h4>Subtitle Sync Offset</h4>\n      <button type=\"button\" class=\"vn-popover-close\" id=\"vnSyncCloseBtn\" aria-label=\"Close sync popover\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"></line><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"></line></svg></button>\n    </div>\n    <div class=\"vn-popover-body\">\n      <div class=\"vn-sync-display-box\" id=\"studioSyncBigDisplay\">0 ms</div>\n      <p class=\"vn-sync-desc\">Shift Kurdish subtitles earlier or later to match dialogue</p>\n      <div class=\"vn-sync-btn-grid\">\n        <button type=\"button\" class=\"vn-pop-btn\" id=\"studioOffsetMinus500Btn\">-500ms</button>\n        <button type=\"button\" class=\"vn-pop-btn\" id=\"studioOffsetMinus100Btn\">-100ms</button>\n        <button type=\"button\" class=\"vn-pop-btn vn-pop-btn-primary\" id=\"studioOffsetResetBtn\">Reset (0ms)</button>\n        <button type=\"button\" class=\"vn-pop-btn\" id=\"studioOffsetPlus100Btn\">+100ms</button>\n        <button type=\"button\" class=\"vn-pop-btn\" id=\"studioOffsetPlus500Btn\">+500ms</button>\n      </div>\n    </div>\n  </div>\n\n  <div class=\"vn-popover hidden\" id=\"vnSpeedPopover\">\n    <div class=\"vn-popover-header\">\n      <h4>Playback Speed</h4>\n      <button type=\"button\" class=\"vn-popover-close\" id=\"vnSpeedCloseBtn\" aria-label=\"Close speed popover\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"></line><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"></line></svg></button>\n    </div>\n    <div class=\"vn-popover-body\">\n      <div class=\"vn-speed-grid\">\n        <button type=\"button\" class=\"vn-speed-chip\" data-speed=\"0.5\">0.5×</button>\n        <button type=\"button\" class=\"vn-speed-chip\" data-speed=\"0.75\">0.75×</button>\n        <button type=\"button\" class=\"vn-speed-chip active\" data-speed=\"1\">1.0×</button>\n        <button type=\"button\" class=\"vn-speed-chip\" data-speed=\"1.25\">1.25×</button>\n        <button type=\"button\" class=\"vn-speed-chip\" data-speed=\"1.5\">1.5×</button>\n        <button type=\"button\" class=\"vn-speed-chip\" data-speed=\"2\">2.0×</button>\n      </div>\n    </div>\n  </div>\n\n  <div class=\"vn-popover hidden\" id=\"vnVolumePopover\">\n    <div class=\"vn-popover-header\">\n      <h4>Audio Volume</h4>\n      <button type=\"button\" class=\"vn-popover-close\" id=\"vnVolumeCloseBtn\" aria-label=\"Close volume popover\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"></line><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"></line></svg></button>\n    </div>\n    <div class=\"vn-popover-body\">\n      <div style=\"display:flex; align-items:center; gap:12px; margin-top:8px;\">\n        <button type=\"button\" class=\"vn-icon-btn\" id=\"studioMuteBtn\" title=\"Mute/Unmute\">\n          <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><polygon points=\"11 5 6 9 2 9 2 15 6 15 11 19 11 5\"/><path d=\"M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07\"/></svg>\n        </button>\n        <input type=\"range\" class=\"vn-volume-slider\" id=\"studioVolumeSlider\" min=\"0\" max=\"1\" step=\"0.05\" value=\"1\" />\n      </div>\n    </div>\n  </div>\n</div>\n\n<!-- Video Studio: Cue Info & Diagnostics Modal -->\n<div class=\"modal-backdrop hidden\" id=\"cueInfoModal\">\n  <div class=\"modal-card studio-modal-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"cueInfoModalTitle\">\n    <div class=\"modal-header\">\n      <div class=\"modal-title-group\">\n        <span class=\"modal-title-icon\" style=\"background: rgba(168, 85, 247, 0.15); color: #c084fc;\">\n          <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n            <circle cx=\"12\" cy=\"12\" r=\"10\"/>\n            <line x1=\"12\" y1=\"16\" x2=\"12\" y2=\"12\"/>\n            <line x1=\"12\" y1=\"8\" x2=\"12.01\" y2=\"8\"/>\n          </svg>\n        </span>\n        <div>\n          <h3 class=\"modal-title\" id=\"cueInfoModalTitle\">Subtitle Cue Inspector</h3>\n          <p class=\"modal-sub\" id=\"cueInfoModalSub\">Deep timing metrics, reading pace, and inline editor</p>\n        </div>\n      </div>\n      <button type=\"button\" class=\"modal-close-btn\" id=\"cueInfoCloseBtn\" aria-label=\"Close\">\n        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/></svg>\n      </button>\n    </div>\n\n    <div class=\"modal-body\" id=\"cueInfoModalBody\">\n      <div class=\"cue-inspector-grid\">\n        <div class=\"cue-timing-strip\">\n          <span class=\"cue-badge-pill\" id=\"cueInfoCueNum\">Cue #1</span>\n          <span class=\"cue-time-chip\"><strong id=\"cueInfoStartTime\">00:00.000</strong> ➔ <strong id=\"cueInfoEndTime\">00:00.000</strong></span>\n          <span class=\"cue-dur-chip\" id=\"cueInfoDuration\">0.000s</span>\n        </div>\n        <div class=\"cue-metrics-cards\">\n          <div class=\"cue-metric-item\">\n            <span class=\"cue-metric-label\">Reading Pace</span>\n            <span class=\"cue-metric-val\" id=\"cueInfoCpsVal\">0.0 char/s</span>\n          </div>\n          <div class=\"cue-metric-item\">\n            <span class=\"cue-metric-label\">Words / Min</span>\n            <span class=\"cue-metric-val\" id=\"cueInfoWpmVal\">0 wpm</span>\n          </div>\n          <div class=\"cue-metric-item\">\n            <span class=\"cue-metric-label\">Characters</span>\n            <span class=\"cue-metric-val\" id=\"cueInfoCharsVal\">0</span>\n          </div>\n          <div class=\"cue-metric-item\">\n            <span class=\"cue-metric-label\">Words</span>\n            <span class=\"cue-metric-val\" id=\"cueInfoWordsVal\">0</span>\n          </div>\n          <div class=\"cue-metric-item full-width\">\n            <span class=\"cue-metric-label\">Script Orientation</span>\n            <span class=\"cue-metric-val\" id=\"cueInfoScriptVal\">Kurdish Sorani (RTL)</span>\n          </div>\n        </div>\n        <div class=\"cue-edit-area\">\n          <label class=\"cue-input-label\" for=\"cueInfoTextInput\">Kurdish Subtitle Dialogue</label>\n          <textarea class=\"cue-textarea\" id=\"cueInfoTextInput\" rows=\"3\" placeholder=\"Enter Kurdish dialogue text...\" dir=\"rtl\"></textarea>\n        </div>\n        <div class=\"cue-orig-area hidden\">\n          <label class=\"cue-input-label\">Original Source Line</label>\n          <div class=\"cue-orig-preview\" id=\"cueInfoOrigText\"></div>\n        </div>\n      </div>\n    </div>\n\n    <div class=\"modal-footer\" style=\"display: flex; justify-content: space-between; align-items: center;\">\n      <button type=\"button\" class=\"studio-btn-secondary\" id=\"cueInfoJumpBtn\">Jump to Cue</button>\n      <button type=\"button\" class=\"studio-btn-primary\" id=\"cueInfoSaveBtn\">Save Changes</button>\n    </div>\n  </div>\n</div>\n\n<!-- Video Studio: Burn & Export Progress Modal -->\n<div class=\"modal-backdrop hidden\" id=\"studioBurnModal\">\n  <div class=\"modal-card studio-modal-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"studioBurnModalTitle\">\n    <div class=\"modal-header\">\n      <div class=\"modal-title-group\">\n        <span class=\"modal-title-icon\" style=\"background: rgba(244, 114, 182, 0.15); color: #f472b6;\">\n          <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\">\n            <path d=\"M12 2v8\"/>\n            <path d=\"M4.93 10.93a10 10 0 1 0 14.14 0\"/>\n          </svg>\n        </span>\n        <div>\n          <h3 class=\"modal-title\" id=\"studioBurnModalTitle\">Burn Subtitles into Video</h3>\n          <p class=\"modal-sub\">Render subtitles directly onto video frames using client-side WebM/MP4 recorder</p>\n        </div>\n      </div>\n      <button type=\"button\" class=\"modal-close-btn\" id=\"studioBurnCloseBtn\" aria-label=\"Close\">\n        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/></svg>\n      </button>\n    </div>\n\n    <div class=\"modal-body\">\n      <p style=\"font-size:0.9rem; color:var(--text-dim); line-height:1.6; margin-bottom:16px;\">\n        This will play and render the video through an offscreen canvas with your styled Kurdish subtitles baked into each frame, generating a downloadable video file directly in your browser.\n      </p>\n\n      <div class=\"burn-progress-track\" style=\"background:rgba(255,255,255,0.06); border-radius:8px; height:12px; overflow:hidden; margin-bottom:12px;\">\n        <div id=\"studioBurnProgressFill\" style=\"background:linear-gradient(90deg, #a855f7, #f472b6); height:100%; width:0%; transition:width 0.2s;\"></div>\n      </div>\n\n      <div style=\"display:flex; justify-content:space-between; font-size:0.85rem; color:var(--text-muted); margin-bottom:16px;\">\n        <span id=\"studioBurnStatusText\">Ready to burn</span>\n        <span id=\"studioBurnPercentText\">0%</span>\n      </div>\n\n      <div id=\"studioBurnSuccessArea\" class=\"hidden\" style=\"text-align:center; padding:16px; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3); border-radius:8px; margin-bottom:16px;\">\n        <h4 style=\"color:#4ade80; margin-bottom:8px;\">Rendering Complete!</h4>\n        <a id=\"studioBurnDownloadLink\" class=\"studio-btn-primary\" download=\"video_with_kurdish_subtitles.webm\" style=\"display:inline-flex; text-decoration:none; margin-top:8px;\">\n          Download Burned Video\n        </a>\n      </div>\n    </div>\n\n    <div class=\"modal-footer\" style=\"display: flex; justify-content: flex-end; gap: 8px;\">\n      <button type=\"button\" class=\"studio-btn-secondary\" id=\"studioBurnCancelBtn\">Cancel</button>\n      <button type=\"button\" class=\"studio-btn-primary\" id=\"studioBurnStartBtn\" style=\"background:#f472b6; color:#2c0827;\">Start Burning</button>\n    </div>\n  </div>\n</div>\n";
    }
  }

  window.VideoEditorUI = new VideoEditorUIManager();
})();
