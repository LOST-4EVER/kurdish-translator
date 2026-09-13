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
      const helpModal = temp.querySelector('#studioHelpModal');
      if (helpModal && !$('#studioHelpModal')) {
        document.body.appendChild(helpModal);
      }
      const movModal = temp.querySelector('#studioMovModal');
      if (movModal && !$('#studioMovModal')) {
        document.body.appendChild(movModal);
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
        moreBtn: $('#studioMoreBtn'),

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
        quickOrigBtn: $('#studioQuickOrigBtn'),
        syncPillBtn: $('#studioSyncPillBtn'),
        syncOffsetDisplay: $('#studioSyncOffsetDisplay'),
        undoBtn: $('#studioUndoBtn'),
        redoBtn: $('#studioRedoBtn'),

        // Active Text Shower Strip
        textShowerCard: $('#studioTextShower'),
        textShowerNum: $('#studioTextShowerNum'),
        textShowerText: $('#studioTextShowerText'),
        textShowerPace: $('#studioTextShowerPace'),

        // Layout Resizer Bar & Timeline Section
        studioResizerBar: $('#studioResizerBar'),
        timelineSection: $('#studioTimelineSection'),
        snapGuideX: $('#studioSnapGuideX'),
        snapGuideY: $('#studioSnapGuideY'),

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
        toolSubToolsBtn: $('#vnToolSubToolsBtn'),
        toolVideoChangeBtn: $('#vnToolVideoChangeBtn'),

        // Popovers
        popovers: {
          style: $('#vnStylePopover'),
          sync: $('#vnSyncPopover'),
          speed: $('#vnSpeedPopover'),
          volume: $('#vnVolumePopover'),
          tools: $('#vnSubToolsPopover'),
          more: $('#vnMoreMenuPopover'),
        },

        // Mobile More Menu Controls
        closeMorePop: $('#vnMoreCloseBtn'),
        moreImportSubBtn: $('#vnMoreImportSubBtn'),
        moreChangeVideoBtn: $('#vnMoreChangeVideoBtn'),
        moreSampleVideoBtn: $('#vnMoreSampleVideoBtn'),
        moreHelpBtn: $('#vnMoreHelpBtn'),

        // Sub Tools Controls
        closeSubToolsPop: $('#vnSubToolsCloseBtn'),
        btnToolAutoSplit: $('#btnToolAutoSplit'),
        btnToolCleanOrthography: $('#btnToolCleanOrthography'),
        toolSubSearchInput: $('#toolSubSearchInput'),
        toolSubReplaceInput: $('#toolSubReplaceInput'),
        btnToolSearchReplace: $('#btnToolSearchReplace'),
        btnToolShiftMinus500: $('#btnToolShiftMinus500'),
        btnToolShiftMinus100: $('#btnToolShiftMinus100'),
        toolSubShiftInput: $('#toolSubShiftInput'),
        btnToolShiftPlus100: $('#btnToolShiftPlus100'),
        btnToolShiftPlus500: $('#btnToolShiftPlus500'),
        btnToolApplyShift: $('#btnToolApplyShift'),

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
        burnShareBtn: $('#studioBurnShareBtn'),
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

        // Subtitle Quick Edit Bubble
        bubbleEditor: $('#vnSubtitleBubbleEditor'),
        bubbleCueBadge: $('#vnBubbleCueBadge'),
        bubbleTimeTag: $('#vnBubbleTimeTag'),
        bubblePace: $('#vnBubblePace'),
        bubbleNudgeStartMinus: $('#vnBubbleNudgeStartMinus'),
        bubbleNudgeEndPlus: $('#vnBubbleNudgeEndPlus'),
        bubbleSplitBtn: $('#vnBubbleSplitBtn'),
        bubbleDeleteBtn: $('#vnBubbleDeleteBtn'),
        bubbleCloseBtn: $('#vnBubbleCloseBtn'),
        bubbleTextarea: $('#vnBubbleTextarea'),
        bubbleOrigText: $('#vnBubbleOrigText'),
        bubbleFontFamilySel: $('#vnBubbleFontFamilySel'),
        bubbleSizeGroup: $('#vnBubbleSizeGroup'),
        bubblePosGroup: $('#vnBubblePosGroup'),
        bubbleColorGroup: $('#vnBubbleColorGroup'),
        bubbleBgSel: $('#vnBubbleBgSel'),

        // Auxiliary Track File Inputs
        musicFileInput: $('#studioMusicFileInput'),
        stickerFileInput: $('#studioStickerFileInput'),

        // Help Modal
        helpModal: $('#studioHelpModal'),
        helpCloseBtn: $('#studioHelpCloseBtn'),
        helpDoneBtn: $('#studioHelpDoneBtn'),

        // Export Tabs & Subtitle Only Export
        exportTabVideoBtn: $('#exportTabVideoBtn'),
        exportTabSubBtn: $('#exportTabSubBtn'),
        exportSubOnlyArea: $('#exportSubOnlyArea'),
        studioSubExportFormatSel: $('#studioSubExportFormatSel'),
        studioSubExportEncodingSel: $('#studioSubExportEncodingSel'),
        studioDirectSubDownloadBtn: $('#studioDirectSubDownloadBtn'),
        studioDirectSubShareBtn: $('#studioDirectSubShareBtn'),
        exportModalFooter: $('#exportModalFooter'),

        // Quick Open-up Panel
        quickPanel: $('#vnQuickTextPanel'),
        quickBackdrop: $('#vnQuickBackdrop'),
        quickCueBadge: $('#vnQuickCueBadge'),
        quickTimeTag: $('#vnQuickTimeTag'),
        quickDurTag: $('#vnQuickDurTag'),
        quickPace: $('#vnQuickPace'),
        quickPrevBtn: $('#vnQuickPrevBtn'),
        quickPlayBtn: $('#vnQuickPlayBtn'),
        quickNextBtn: $('#vnQuickNextBtn'),
        quickNudgeMinus: $('#vnQuickNudgeMinus'),
        quickNudgePlus: $('#vnQuickNudgePlus'),
        quickUndoBtn: $('#vnQuickUndoBtn'),
        quickRedoBtn: $('#vnQuickRedoBtn'),
        quickDoneBtn: $('#vnQuickDoneBtn'),
        quickKurdishToggleBtn: $('#vnQuickKurdishToggleBtn'),
        quickTextarea: $('#vnQuickTextarea'),
        quickKurdishBar: $('#vnQuickKurdishBar'),
        quickKurdishChips: $('#vnQuickKurdishChips'),
        quickFixOrthographyBtn: $('#vnQuickFixOrthographyBtn'),
        quickInsertBreakBtn: $('#vnQuickInsertBreakBtn'),
        quickOrigBox: $('#vnQuickOrigBox'),
        quickOrigText: $('#vnQuickOrigText'),
        quickCopyOrigBtn: $('#vnQuickCopyOrigBtn'),
        quickSplitBtn: $('#vnQuickSplitBtn'),
        quickDeleteBtn: $('#vnQuickDeleteBtn'),
        quickTimingToggleBtn: $('#vnQuickTimingToggleBtn'),
        quickStyleToggleBtn: $('#vnQuickStyleToggleBtn'),
        quickCharCount: $('#vnQuickCharCount'),
        quickTimingTray: $('#vnQuickTimingTray'),
        quickStartMinus500: $('#vnQuickStartMinus500'),
        quickStartMinus100: $('#vnQuickStartMinus100'),
        quickStartVal: $('#vnQuickStartVal'),
        quickStartPlus100: $('#vnQuickStartPlus100'),
        quickStartPlus500: $('#vnQuickStartPlus500'),
        quickEndMinus500: $('#vnQuickEndMinus500'),
        quickEndMinus100: $('#vnQuickEndMinus100'),
        quickEndVal: $('#vnQuickEndVal'),
        quickEndPlus100: $('#vnQuickEndPlus100'),
        quickEndPlus500: $('#vnQuickEndPlus500'),
        quickFormatTray: $('#vnQuickFormatTray'),
        quickFontFamilySel: $('#vnQuickFontFamilySel'),
        quickSizeGroup: $('#vnQuickSizeGroup'),
        quickColorGroup: $('#vnQuickColorGroup'),
        quickBgSel: $('#vnQuickBgSel'),
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
    return `
<div id="tabVideoEditor" class="hidden vn-studio-root">
  <header class="vn-header" id="studioTopBar">
    <div class="vn-header-left">
      <button type="button" class="vn-icon-btn" id="studioBackBtn" title="Back to main app" aria-label="Back">
        <span class="vn-btn-emoji"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg></span>
      </button>
      <button type="button" class="vn-icon-btn" id="studioHelpBtn" title="Studio shortcuts &amp; tips" aria-label="Help">
        <span class="vn-btn-emoji"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></span>
      </button>
      <div class="vn-aspect-dropdown-wrap">
        <select class="vn-aspect-select" id="studioAspectRatioSel" title="Aspect Ratio">
          <option value="original" selected>Original ▾</option>
          <option value="16:9">16:9 (Cinema)</option>
          <option value="9:16">9:16 (Reels/TikTok)</option>
          <option value="1:1">1:1 (Square)</option>
          <option value="4:3">4:3 (TV)</option>
          <option value="21:9">21:9 (Ultrawide)</option>
        </select>
      </div>
      <span class="vn-file-badge" id="studioVideoFilename" title="No video loaded">No video loaded</span>
    </div>

    <div class="vn-header-right">
      <button type="button" class="vn-connect-btn" id="studioApplyCurrentSubsBtn" title="Load Kurdish subtitles from translation tab">
        <span class="vn-connect-pulse"></span>
        <span class="vn-btn-emoji"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></span>
        <span id="studioSubsBadge">Apply Kurdish Subs</span>
      </button>
      <input type="file" id="studioSubFileInput" accept=".srt,.vtt,.ass,.ssa,.sub,.smi" hidden />
      <button type="button" class="vn-icon-btn" id="studioImportSubBtn" title="Import subtitle file (.srt, .vtt, .ass)" aria-label="Import subtitle file">
        <span class="vn-btn-emoji"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></span>
      </button>
      <button type="button" class="vn-export-btn" id="studioBurnExportBtn" title="Burn Kurdish subtitles into video &amp; export">
        <span class="vn-btn-emoji"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg></span>
        <span>Export</span>
      </button>
    </div>
  </header>

  <section class="vn-player-stage" id="studioPlayerStage">
    <div class="vn-viewport-container" id="studioViewportWrapper" data-ratio="16:9">
      <video id="studioVideoElement" class="vn-video-element hidden" playsinline></video>
      <div class="vn-empty-dropzone" id="studioVideoPlaceholder">
        <div class="vn-empty-box" id="studioVideoDropzone">
          <div class="vn-empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg></div>
          <h3 class="vn-empty-title">Import Video File</h3>
          <p class="vn-empty-subtitle">Supports MOV, MP4 &amp; WebM · Processed 100% locally in your browser</p>
          <div class="vn-empty-actions">
            <button type="button" class="vn-btn-primary" id="studioBrowseVideoBtn">
              <span class="vn-btn-emoji"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></span>
              <span>Choose Video</span>
            </button>
            <button type="button" class="vn-btn-secondary" id="studioSampleVideoBtn">
              <span class="vn-btn-emoji"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></span>
              <span>Try Sample Video</span>
            </button>
          </div>
          <input type="file" id="studioVideoFileInput" accept="video/mp4,video/quicktime,video/webm,.mov,.mp4,.webm" hidden />
        </div>
      </div>
      <div class="vn-subtitle-overlay pos-bottom hidden" id="studioSubtitleOverlay" tabindex="0" role="button" aria-label="Subtitle overlay, drag to move or click to edit">
        <div class="vn-sub-drag-indicator" title="Drag to reposition subtitles">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
        </div>
        <div class="vn-subtitle-text" id="studioSubtitleText" dir="rtl"></div>
        <div class="vn-subtitle-orig hidden" id="studioSubtitleOrig"></div>
      </div>
      <div class="vn-snap-guide vn-snap-guide-x hidden" id="studioSnapGuideX"></div>
      <div class="vn-snap-guide vn-snap-guide-y hidden" id="studioSnapGuideY"></div>
      <button type="button" class="vn-fs-corner-btn" id="studioFsBtn" title="Fullscreen player" aria-label="Fullscreen">
        <span class="vn-btn-emoji"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg></span>
      </button>
    </div>
  </section>

  <section class="vn-transport-bar">
    <div class="vn-timecode-wrap">
      <span class="vn-time-current" id="studioTimeDisplay">00:00.00 / 00:00.00</span>
    </div>
    <div class="vn-playback-cluster">
      <button type="button" class="vn-transport-btn" id="studioStepBackBtn" title="Previous cue (←)" aria-label="Previous cue">
        <span class="vn-btn-emoji"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg></span>
      </button>
      <button type="button" class="vn-play-master-btn" id="studioPlayPauseBtn" title="Play / Pause (Space)" aria-label="Play / Pause">
        <span id="studioPlayIcon" class="vn-btn-emoji"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></span>
        <span id="studioPauseIcon" class="vn-btn-emoji hidden"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg></span>
      </button>
      <button type="button" class="vn-transport-btn" id="studioStepForwardBtn" title="Next cue (→)" aria-label="Next cue">
        <span class="vn-btn-emoji"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg></span>
      </button>
    </div>
    <div class="vn-transport-right">
      <button type="button" class="vn-sync-pill" id="studioSyncPillBtn" title="Adjust subtitle sync timing offset">
        <span id="studioSyncOffsetDisplay">0ms</span>
      </button>
      <button type="button" class="vn-icon-btn-small" id="studioUndoBtn" title="Undo change" aria-label="Undo">
        <span class="vn-btn-emoji"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg></span>
      </button>
      <button type="button" class="vn-icon-btn-small" id="studioRedoBtn" title="Redo change" aria-label="Redo">
        <span class="vn-btn-emoji"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"></path></svg></span>
      </button>
    </div>
  </section>

  <section class="vn-text-shower-strip" id="studioTextShower" role="button" tabindex="0" title="Click to inspect &amp; edit active cue">
    <div class="vn-shower-badge" id="studioTextShowerNum">--</div>
    <div class="vn-shower-content" id="studioTextShowerText">No active subtitle · Scrub timeline or play video</div>
    <div class="vn-shower-cps hidden" id="studioTextShowerPace">-- CPS</div>
    <span class="vn-shower-chevron"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg></span>
  </section>

  <div class="vn-studio-resizer" id="studioResizerBar" role="separator" aria-orientation="horizontal" tabindex="0" title="Drag up or down to resize player and timeline">
    <div class="vn-resizer-line"></div>
    <div class="vn-resizer-handle">
      <span class="vn-resizer-dot"></span>
      <span class="vn-resizer-dot"></span>
      <span class="vn-resizer-dot"></span>
    </div>
    <div class="vn-resizer-line"></div>
  </div>

  <section class="vn-timeline-section" id="studioTimelineSection">
    <div id="studioTimelineMount"></div>
  </section>

  <footer class="vn-bottom-bar">
    <button type="button" class="vn-tool-btn" id="vnToolStyleBtn" title="Subtitle typography &amp; appearance">
      <span class="vn-tool-emoji"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path></svg></span>
      <span>Style</span>
    </button>
    <button type="button" class="vn-tool-btn" id="vnToolInspectBtn" title="Subtitle text inspector &amp; editor">
      <span class="vn-tool-emoji"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></span>
      <span>Edit</span>
    </button>
    <button type="button" class="vn-tool-btn" id="vnToolSplitBtn" title="Split subtitle cue at current playhead">
      <span class="vn-tool-emoji"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg></span>
      <span>Split</span>
    </button>
    <button type="button" class="vn-tool-btn" id="vnToolSyncBtn" title="Subtitle timing sync offset">
      <span class="vn-tool-emoji"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></span>
      <span>Sync</span>
    </button>
    <button type="button" class="vn-tool-btn" id="vnToolSpeedBtn" title="Playback Speed">
      <span class="vn-tool-emoji"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg></span>
      <span id="vnSpeedLabel">1.0×</span>
    </button>
    <button type="button" class="vn-tool-btn" id="vnToolVolumeBtn" title="Audio volume &amp; mute">
      <span class="vn-tool-emoji"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg></span>
      <span>Volume</span>
    </button>
    <button type="button" class="vn-tool-btn" id="vnToolVideoChangeBtn" title="Change video file">
      <span class="vn-tool-emoji"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg></span>
      <span>Video</span>
    </button>
  </footer>

  <div class="vn-popover hidden" id="vnStylePopover">
    <div class="vn-popover-header">
      <h4>Subtitle Style</h4>
      <button type="button" class="vn-popover-close" id="vnStyleCloseBtn" aria-label="Close style popover"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
    </div>
    <div class="vn-popover-body">
      <div class="vn-popover-row">
        <label>Font Size</label>
        <select id="studioSubFontSel" class="vn-pop-select">
          <option value="1">Small</option>
          <option value="1.25" selected>Medium (Default)</option>
          <option value="1.55">Large</option>
          <option value="1.9">Extra Large</option>
        </select>
      </div>
      <div class="vn-popover-row">
        <label>Position</label>
        <select id="studioSubPosSel" class="vn-pop-select">
          <option value="bottom" selected>Bottom</option>
          <option value="center">Center</option>
          <option value="top">Top</option>
        </select>
      </div>
      <div class="vn-popover-row">
        <label>Color</label>
        <select id="studioSubColorSel" class="vn-pop-select">
          <option value="#ffffff" selected>White</option>
          <option value="#fef08a">Yellow</option>
          <option value="#a6f4c5">Cyan / Mint</option>
          <option value="#d0bcff">Purple</option>
        </select>
      </div>
      <div class="vn-popover-row">
        <label>Background</label>
        <select id="studioSubBgSel" class="vn-pop-select">
          <option value="transparent" selected>Transparent (Shadow only)</option>
          <option value="rgba(0, 0, 0, 0.75)">Dark Box</option>
          <option value="rgba(0, 0, 0, 0.45)">Soft Box</option>
        </select>
      </div>
      <div class="vn-popover-row">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" id="studioSubShowOrigToggle" />
          <span>Show Original English Text</span>
        </label>
      </div>
    </div>
  </div>

  <div class="vn-popover hidden" id="vnSyncPopover">
    <div class="vn-popover-header">
      <h4>Subtitle Sync Offset</h4>
      <button type="button" class="vn-popover-close" id="vnSyncCloseBtn" aria-label="Close sync popover"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
    </div>
    <div class="vn-popover-body">
      <div class="vn-sync-display-box" id="studioSyncBigDisplay">0 ms</div>
      <p class="vn-sync-desc">Shift Kurdish subtitles earlier or later to match dialogue</p>
      <div class="vn-sync-btn-grid">
        <button type="button" class="vn-pop-btn" id="studioOffsetMinus500Btn">-500ms</button>
        <button type="button" class="vn-pop-btn" id="studioOffsetMinus100Btn">-100ms</button>
        <button type="button" class="vn-pop-btn vn-pop-btn-primary" id="studioOffsetResetBtn">Reset (0ms)</button>
        <button type="button" class="vn-pop-btn" id="studioOffsetPlus100Btn">+100ms</button>
        <button type="button" class="vn-pop-btn" id="studioOffsetPlus500Btn">+500ms</button>
      </div>
    </div>
  </div>

  <div class="vn-popover hidden" id="vnSpeedPopover">
    <div class="vn-popover-header">
      <h4>Playback Speed</h4>
      <button type="button" class="vn-popover-close" id="vnSpeedCloseBtn" aria-label="Close speed popover"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
    </div>
    <div class="vn-popover-body">
      <div class="vn-speed-grid">
        <button type="button" class="vn-speed-chip" data-speed="0.5">0.5×</button>
        <button type="button" class="vn-speed-chip" data-speed="0.75">0.75×</button>
        <button type="button" class="vn-speed-chip active" data-speed="1">1.0×</button>
        <button type="button" class="vn-speed-chip" data-speed="1.25">1.25×</button>
        <button type="button" class="vn-speed-chip" data-speed="1.5">1.5×</button>
        <button type="button" class="vn-speed-chip" data-speed="2">2.0×</button>
      </div>
    </div>
  </div>

  <div class="vn-popover hidden" id="vnVolumePopover">
    <div class="vn-popover-header">
      <h4>Audio Volume</h4>
      <button type="button" class="vn-popover-close" id="vnVolumeCloseBtn" aria-label="Close volume popover"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
    </div>
    <div class="vn-popover-body">
      <div style="display:flex; align-items:center; gap:12px; margin-top:8px;">
        <button type="button" class="vn-icon-btn" id="studioMuteBtn" title="Mute/Unmute">
          <span class="vn-btn-emoji"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg></span>
        </button>
        <input type="range" class="vn-volume-slider" id="studioVolumeSlider" min="0" max="1" step="0.05" value="1" />
      </div>
    </div>
  </div>
</div>
      `;
    }
  }

  window.VideoEditorUI = new VideoEditorUIManager();
})();
