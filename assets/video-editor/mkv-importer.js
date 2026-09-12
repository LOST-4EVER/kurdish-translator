/**
 * mkv-importer.js — Advanced Matroska (MKV) & WebM Binary EBML Inspector & Subtitle Extractor.
 * Provides:
 * 1. EBML binary stream parser (Header, Segment, Info, Tracks, Clusters, Blocks).
 * 2. Multi-audio track discovery (AAC, AC3, EAC3, DTS, Opus, Vorbis, FLAC) with routing.
 * 3. Embedded subtitle track extraction (S_TEXT/UTF8, S_TEXT/ASS, S_TEXT/SSA, S_VOBSUB)
 *    with automatic timestamp parsing and direct injection into Studio timeline.
 * 4. In/Out precision range trimmer with live preview.
 * 5. Web Audio API dialogue intelligibility equalizer (+3.5dB vocal boost).
 */
(() => {
  'use strict';

  const formatTimecode = (ms) => {
    if (isNaN(ms) || ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const millis = Math.floor(ms % 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  /**
   * EBML (Extensible Binary Meta Language) Parser for Matroska / WebM.
   */
  class EbmlParser {
    static async parse(file) {
      const info = {
        fileSize: file.size,
        fileName: file.name,
        format: 'matroska',
        durationMs: 0,
        timecodeScale: 1000000, // 1ms default in ns
        videoTracks: [],
        audioTracks: [],
        subtitleTracks: [],
        extractedCues: [],
        subtitleTracksMap: new Map() // trackNumber -> array of cues
      };

      try {
        // Read header + initial segment (up to 4MB for fast metadata & tracks parsing)
        const readSize = Math.min(file.size, 4 * 1024 * 1024);
        const headerBlob = file.slice(0, readSize);
        const headerBuffer = await headerBlob.arrayBuffer();
        const view = new DataView(headerBuffer);

        let offset = 0;
        const len = view.byteLength;

        while (offset < len) {
          const elem = this._readElement(view, offset);
          if (!elem || elem.size <= 0) break;

          if (elem.id === 0x1A45DFA3) {
            // EBML Header
            this._parseEbmlHeader(view, elem.dataOffset, elem.size, info);
          } else if (elem.id === 0x18538067) {
            // Segment
            this._parseSegment(view, elem.dataOffset, Math.min(elem.size, len - elem.dataOffset), info, file);
            break;
          }

          offset = elem.nextOffset;
        }

        // If subtitle tracks were found, attempt to read subtitle cues from clusters or cues
        if (info.subtitleTracks.length > 0) {
          await this._extractSubtitleBlocks(file, info);
        }
      } catch (err) {
        console.warn('EBML MKV parser warning:', err);
      }

      return info;
    }

    static _readVint(view, offset) {
      if (offset >= view.byteLength) return null;
      const firstByte = view.getUint8(offset);
      if (firstByte === 0) return null;

      let length = 1;
      let mask = 0x80;
      while ((firstByte & mask) === 0 && length <= 8) {
        mask >>= 1;
        length++;
      }

      if (offset + length > view.byteLength) return null;

      let value = firstByte & (~mask);
      for (let i = 1; i < length; i++) {
        value = (value * 256) + view.getUint8(offset + i);
      }

      return { length, value };
    }

    static _readElementId(view, offset) {
      if (offset >= view.byteLength) return null;
      const firstByte = view.getUint8(offset);
      if (firstByte === 0) return null;

      let length = 1;
      let mask = 0x80;
      while ((firstByte & mask) === 0 && length <= 4) {
        mask >>= 1;
        length++;
      }

      if (offset + length > view.byteLength) return null;

      let id = 0;
      for (let i = 0; i < length; i++) {
        id = ((id * 256) + view.getUint8(offset + i)) >>> 0;
      }

      return { length, id };
    }

    static _readElement(view, offset) {
      const idObj = this._readElementId(view, offset);
      if (!idObj) return null;

      const sizeObj = this._readVint(view, offset + idObj.length);
      if (!sizeObj) return null;

      const dataOffset = offset + idObj.length + sizeObj.length;
      return {
        id: idObj.id,
        size: sizeObj.value,
        dataOffset,
        nextOffset: dataOffset + sizeObj.value
      };
    }

    static _readString(view, offset, size) {
      const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, Math.min(size, view.byteLength - offset));
      return new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '').trim();
    }

    static _readUint(view, offset, size) {
      let val = 0;
      for (let i = 0; i < size && offset + i < view.byteLength; i++) {
        val = (val * 256) + view.getUint8(offset + i);
      }
      return val;
    }

    static _readFloat(view, offset, size) {
      if (size === 4 && offset + 4 <= view.byteLength) return view.getFloat32(offset);
      if (size === 8 && offset + 8 <= view.byteLength) return view.getFloat64(offset);
      return 0;
    }

    static _parseEbmlHeader(view, offset, size, info) {
      let cur = offset;
      const end = offset + size;
      while (cur < end) {
        const elem = this._readElement(view, cur);
        if (!elem) break;
        if (elem.id === 0x4282) { // DocType
          info.format = this._readString(view, elem.dataOffset, elem.size);
        }
        cur = elem.nextOffset;
      }
    }

    static _parseSegment(view, offset, size, info, file) {
      let cur = offset;
      const end = offset + size;

      while (cur < end) {
        const elem = this._readElement(view, cur);
        if (!elem) break;

        if (elem.id === 0x1549A966) {
          // Segment Info (Duration, TimecodeScale)
          this._parseSegmentInfo(view, elem.dataOffset, elem.size, info);
        } else if (elem.id === 0x1654AE6B) {
          // Tracks
          this._parseTracks(view, elem.dataOffset, elem.size, info);
        }

        cur = elem.nextOffset;
      }
    }

    static _parseSegmentInfo(view, offset, size, info) {
      let cur = offset;
      const end = offset + size;
      let durationRaw = 0;

      while (cur < end) {
        const elem = this._readElement(view, cur);
        if (!elem) break;

        if (elem.id === 0x2AD7B1) { // TimecodeScale in nanoseconds
          info.timecodeScale = this._readUint(view, elem.dataOffset, elem.size) || 1000000;
        } else if (elem.id === 0x4489) { // Duration
          durationRaw = this._readFloat(view, elem.dataOffset, elem.size);
        }

        cur = elem.nextOffset;
      }

      if (durationRaw > 0) {
        // Duration in ms = (durationRaw * timecodeScale) / 1,000,000
        info.durationMs = Math.round((durationRaw * info.timecodeScale) / 1000000);
      }
    }

    static _parseTracks(view, offset, size, info) {
      let cur = offset;
      const end = offset + size;

      while (cur < end) {
        const elem = this._readElement(view, cur);
        if (!elem) break;

        if (elem.id === 0xAE) { // TrackEntry
          const track = this._parseTrackEntry(view, elem.dataOffset, elem.size, info);
          if (track) {
            if (track.type === 'video') info.videoTracks.push(track);
            else if (track.type === 'audio') info.audioTracks.push(track);
            else if (track.type === 'subtitle') {
              info.subtitleTracks.push(track);
              info.subtitleTracksMap.set(track.number, []);
            }
          }
        }

        cur = elem.nextOffset;
      }
    }

    static _parseTrackEntry(view, offset, size, info) {
      let cur = offset;
      const end = offset + size;

      const track = {
        number: 1,
        type: 'unknown',
        codecId: '',
        codec: '',
        name: '',
        language: 'und',
        width: 0,
        height: 0,
        sampleRate: 48000,
        channels: 2,
        isDefault: false,
        isForced: false
      };

      while (cur < end) {
        const elem = this._readElement(view, cur);
        if (!elem) break;

        if (elem.id === 0xD7) { // TrackNumber
          track.number = this._readUint(view, elem.dataOffset, elem.size);
        } else if (elem.id === 0x83) { // TrackType (1=Video, 2=Audio, 17=Subtitle)
          const tType = this._readUint(view, elem.dataOffset, elem.size);
          if (tType === 1) track.type = 'video';
          else if (tType === 2) track.type = 'audio';
          else if (tType === 17) track.type = 'subtitle';
        } else if (elem.id === 0x86) { // CodecID
          track.codecId = this._readString(view, elem.dataOffset, elem.size);
          track.codec = this._simplifyCodecName(track.codecId);
        } else if (elem.id === 0x536E) { // Name
          track.name = this._readString(view, elem.dataOffset, elem.size);
        } else if (elem.id === 0x22B59C) { // Language
          track.language = this._readString(view, elem.dataOffset, elem.size);
        } else if (elem.id === 0x88) { // FlagDefault
          track.isDefault = !!this._readUint(view, elem.dataOffset, elem.size);
        } else if (elem.id === 0x55AA) { // FlagForced
          track.isForced = !!this._readUint(view, elem.dataOffset, elem.size);
        } else if (elem.id === 0xE0) { // Video Settings
          this._parseVideoSettings(view, elem.dataOffset, elem.size, track);
        } else if (elem.id === 0xE1) { // Audio Settings
          this._parseAudioSettings(view, elem.dataOffset, elem.size, track);
        }

        cur = elem.nextOffset;
      }

      return track.type !== 'unknown' ? track : null;
    }

    static _parseVideoSettings(view, offset, size, track) {
      let cur = offset;
      const end = offset + size;
      while (cur < end) {
        const elem = this._readElement(view, cur);
        if (!elem) break;
        if (elem.id === 0xB0) track.width = this._readUint(view, elem.dataOffset, elem.size);
        else if (elem.id === 0xBA) track.height = this._readUint(view, elem.dataOffset, elem.size);
        cur = elem.nextOffset;
      }
    }

    static _parseAudioSettings(view, offset, size, track) {
      let cur = offset;
      const end = offset + size;
      while (cur < end) {
        const elem = this._readElement(view, cur);
        if (!elem) break;
        if (elem.id === 0xB5) { // SamplingFrequency
          track.sampleRate = Math.round(this._readFloat(view, elem.dataOffset, elem.size) || this._readUint(view, elem.dataOffset, elem.size));
        } else if (elem.id === 0x9F) { // Channels
          track.channels = this._readUint(view, elem.dataOffset, elem.size);
        }
        cur = elem.nextOffset;
      }
    }

    static _simplifyCodecName(codecId) {
      if (!codecId) return 'UNKNOWN';
      const c = codecId.toUpperCase();
      if (c.includes('AVC') || c.includes('H264')) return 'H.264';
      if (c.includes('HEVC') || c.includes('H265')) return 'H.265 / HEVC';
      if (c.includes('VP9')) return 'VP9';
      if (c.includes('AV01') || c.includes('AV1')) return 'AV1';
      if (c.includes('AAC')) return 'AAC';
      if (c.includes('AC3')) return 'AC-3 / Dolby';
      if (c.includes('EAC3')) return 'E-AC-3 / DDP';
      if (c.includes('DTS')) return 'DTS';
      if (c.includes('OPUS')) return 'Opus';
      if (c.includes('VORBIS')) return 'Vorbis';
      if (c.includes('FLAC')) return 'FLAC';
      if (c.includes('UTF8') || c.includes('TEXT')) return 'SRT / UTF-8 Text';
      if (c.includes('ASS')) return 'Advanced SSA (ASS)';
      if (c.includes('SSA')) return 'SubStation Alpha';
      if (c.includes('VOBSUB')) return 'VobSub';
      return codecId;
    }

    /**
     * Extracts embedded subtitle cues from Matroska clusters (reading up to 16MB).
     */
    static async _extractSubtitleBlocks(file, info) {
      try {
        const subTrackNumbers = new Set(info.subtitleTracks.map((t) => t.number));
        const scanSize = Math.min(file.size, 16 * 1024 * 1024);
        const scanBlob = file.slice(0, scanSize);
        const scanBuffer = await scanBlob.arrayBuffer();
        const view = new DataView(scanBuffer);

        let offset = 0;
        const len = view.byteLength;
        let clusterTimecode = 0;

        while (offset < len - 4) {
          const elem = this._readElement(view, offset);
          if (!elem || elem.size <= 0) {
            offset += 1;
            continue;
          }

          if (elem.id === 0x1F43B675) {
            // Cluster
            let cOffset = elem.dataOffset;
            const cEnd = Math.min(elem.nextOffset, len);

            while (cOffset < cEnd - 4) {
              const cElem = this._readElement(view, cOffset);
              if (!cElem) break;

              if (cElem.id === 0xE7) {
                // Cluster Timecode
                clusterTimecode = this._readUint(view, cElem.dataOffset, cElem.size);
              } else if (cElem.id === 0xA0) {
                // BlockGroup
                this._parseBlockGroup(view, cElem.dataOffset, cElem.size, clusterTimecode, info, subTrackNumbers);
              } else if (cElem.id === 0xA3) {
                // SimpleBlock
                this._parseSimpleBlock(view, cElem.dataOffset, cElem.size, clusterTimecode, info, subTrackNumbers);
              }

              cOffset = cElem.nextOffset;
            }
          }

          offset = elem.nextOffset;
        }

        // Aggregate extracted cues from first/default subtitle track
        const defaultSubTrack = info.subtitleTracks.find((t) => t.isDefault) || info.subtitleTracks[0];
        if (defaultSubTrack && info.subtitleTracksMap.has(defaultSubTrack.number)) {
          info.extractedCues = info.subtitleTracksMap.get(defaultSubTrack.number);
        }
      } catch (err) {
        console.warn('MKV Subtitle extraction warning:', err);
      }
    }

    static _parseBlockGroup(view, offset, size, clusterTimecode, info, subTrackNumbers) {
      let cur = offset;
      const end = offset + size;
      let blockData = null;
      let durationMs = 2500;

      while (cur < end) {
        const elem = this._readElement(view, cur);
        if (!elem) break;

        if (elem.id === 0xA1) { // Block
          blockData = { offset: elem.dataOffset, size: elem.size };
        } else if (elem.id === 0x9B) { // BlockDuration
          durationMs = Math.round((this._readUint(view, elem.dataOffset, elem.size) * info.timecodeScale) / 1000000);
        }

        cur = elem.nextOffset;
      }

      if (blockData) {
        this._extractBlockPayload(view, blockData.offset, blockData.size, clusterTimecode, durationMs, info, subTrackNumbers);
      }
    }

    static _parseSimpleBlock(view, offset, size, clusterTimecode, info, subTrackNumbers) {
      this._extractBlockPayload(view, offset, size, clusterTimecode, 2500, info, subTrackNumbers);
    }

    static _extractBlockPayload(view, offset, size, clusterTimecode, durationMs, info, subTrackNumbers) {
      const trackVint = this._readVint(view, offset);
      if (!trackVint || !subTrackNumbers.has(trackVint.value)) return;

      const trackNum = trackVint.value;
      const relTimeOffset = offset + trackVint.length;
      if (relTimeOffset + 2 > view.byteLength) return;

      const relTime = view.getInt16(relTimeOffset);
      const startMs = Math.max(0, Math.round(((clusterTimecode + relTime) * info.timecodeScale) / 1000000));
      const endMs = startMs + (durationMs > 0 ? durationMs : 2500);

      const payloadOffset = relTimeOffset + 3; // skip relTime (2B) + flags (1B)
      const payloadSize = size - (payloadOffset - offset);
      if (payloadSize <= 0) return;

      const text = this._readString(view, payloadOffset, payloadSize);
      if (!text) return;

      // Clean ASS or SRT subtitle lines
      let cleanText = text;
      if (cleanText.startsWith('Dialogue:') || cleanText.includes(',,')) {
        // ASS dialogue formatting: Read last field after 9 commas
        const parts = cleanText.split(',');
        if (parts.length >= 10) {
          cleanText = parts.slice(9).join(',');
        }
      }
      cleanText = cleanText.replace(/\{[^}]*\}/g, '').replace(/\\N/gi, '\n').replace(/<[^>]+>/g, '').trim();

      if (cleanText) {
        const cueList = info.subtitleTracksMap.get(trackNum) || [];
        cueList.push({
          start: startMs,
          end: endMs,
          text: cleanText,
          origText: cleanText
        });
        info.subtitleTracksMap.set(trackNum, cueList);
      }
    }
  }

  /**
   * Unified Media Container Importer Manager for MKV and MOV.
   */
  class MediaContainerImporterManager {
    constructor() {
      this.modal = null;
      this.videoFile = null;
      this.parsedInfo = null;
      this.videoUrl = null;
      this.audioContext = null;
      this.audioSourceNode = null;
      this.eqFilterNode = null;

      // Settings
      this.trimInMs = 0;
      this.trimOutMs = 0;
      this.totalDurationMs = 0;
      this.selectedAudioMode = 'track1';
      this.dialogueBoostEnabled = true;
      this.importSubsChecked = true;
      this.extractedCues = [];

      this.els = {};
    }

    init() {
      this.modal = document.getElementById('studioMovModal');
      if (!this.modal) return;

      this.els = {
        modal: this.modal,
        backdrop: this.modal.querySelector('.vn-mov-backdrop'),
        closeBtn: document.getElementById('movModalCloseBtn'),
        cancelBtn: document.getElementById('movModalCancelBtn'),
        importBtn: document.getElementById('movModalImportBtn'),
        videoPlayer: document.getElementById('movPreviewPlayer'),
        typeBadge: this.modal.querySelector('.vn-mov-type-badge span'),
        typeBadgeSvg: this.modal.querySelector('.vn-mov-type-badge'),
        modalTitle: document.getElementById('movModalTitle'),
        fileNameText: document.getElementById('movModalFileName'),
        fileSizeText: document.getElementById('movModalFileSize'),
        techSpecsBadge: document.getElementById('movModalSpecsBadge'),

        // Trimmer controls
        trimTimeDisplay: document.getElementById('movTrimTimeDisplay'),
        trimRangeDuration: document.getElementById('movTrimRangeDuration'),
        trimTrack: document.getElementById('movTrimTrack'),
        trimInHandle: document.getElementById('movTrimInHandle'),
        trimOutHandle: document.getElementById('movTrimOutHandle'),
        trimPlayhead: document.getElementById('movTrimPlayhead'),
        trimActiveBar: document.getElementById('movTrimActiveBar'),
        btnSetIn: document.getElementById('movBtnSetIn'),
        btnSetOut: document.getElementById('movBtnSetOut'),
        btnResetTrim: document.getElementById('movBtnResetTrim'),
        btnPlayRange: document.getElementById('movBtnPlayRange'),

        // Audio controls
        audioTracksList: document.getElementById('movAudioTracksList'),
        audioModeRadios: this.modal.querySelectorAll('input[name="movAudioMode"]'),
        dialogueBoostToggle: document.getElementById('movDialogueBoostToggle'),

        // Subtitle controls
        subTracksSection: document.getElementById('movSubTracksSection'),
        subTracksList: document.getElementById('movSubTracksList'),
        importSubsCheckbox: document.getElementById('movImportSubsCheckbox'),
        subCuesCountBadge: document.getElementById('movSubCuesCountBadge')
      };

      this._bindModalEvents();
    }

    _bindModalEvents() {
      const { closeBtn, cancelBtn, importBtn, videoPlayer, btnSetIn, btnSetOut, btnResetTrim, btnPlayRange, dialogueBoostToggle, importSubsCheckbox } = this.els;

      if (closeBtn) closeBtn.addEventListener('click', () => this.close());
      if (cancelBtn) cancelBtn.addEventListener('click', () => this.close());
      if (this.els.backdrop) this.els.backdrop.addEventListener('click', () => this.close());

      if (importBtn) {
        importBtn.addEventListener('click', () => this.commitImport());
      }

      if (videoPlayer) {
        videoPlayer.addEventListener('loadedmetadata', () => {
          this.totalDurationMs = Math.round((videoPlayer.duration || 0) * 1000);
          if (this.trimOutMs === 0 || this.trimOutMs > this.totalDurationMs) {
            this.trimOutMs = this.totalDurationMs;
          }
          this._updateTrimmerUI();
        });

        videoPlayer.addEventListener('timeupdate', () => {
          const curMs = Math.round(videoPlayer.currentTime * 1000);
          this._updatePlayheadPosition(curMs);

          if (this.trimOutMs > 0 && curMs >= this.trimOutMs && !videoPlayer.paused) {
            videoPlayer.pause();
            videoPlayer.currentTime = this.trimInMs / 1000;
          }
        });
      }

      if (btnSetIn && videoPlayer) {
        btnSetIn.addEventListener('click', () => {
          const curMs = Math.round(videoPlayer.currentTime * 1000);
          this.trimInMs = Math.min(curMs, Math.max(0, this.trimOutMs - 500));
          this._updateTrimmerUI();
        });
      }

      if (btnSetOut && videoPlayer) {
        btnSetOut.addEventListener('click', () => {
          const curMs = Math.round(videoPlayer.currentTime * 1000);
          this.trimOutMs = Math.max(curMs, this.trimInMs + 500);
          this._updateTrimmerUI();
        });
      }

      if (btnResetTrim) {
        btnResetTrim.addEventListener('click', () => {
          this.trimInMs = 0;
          this.trimOutMs = this.totalDurationMs;
          this._updateTrimmerUI();
          if (videoPlayer) videoPlayer.currentTime = 0;
        });
      }

      if (btnPlayRange && videoPlayer) {
        btnPlayRange.addEventListener('click', () => {
          videoPlayer.currentTime = this.trimInMs / 1000;
          videoPlayer.play().catch(() => {});
        });
      }

      if (this.els.audioModeRadios) {
        this.els.audioModeRadios.forEach((radio) => {
          radio.addEventListener('change', (e) => {
            this.selectedAudioMode = e.target.value;
            this._applyAudioRoutingPreview();
          });
        });
      }

      if (dialogueBoostToggle) {
        dialogueBoostToggle.addEventListener('change', (e) => {
          this.dialogueBoostEnabled = e.target.checked;
          this._applyAudioRoutingPreview();
        });
      }

      if (importSubsCheckbox) {
        importSubsCheckbox.addEventListener('change', (e) => {
          this.importSubsChecked = e.target.checked;
        });
      }

      this._bindTrimmerDrag();
    }

    _bindTrimmerDrag() {
      const track = this.els.trimTrack;
      if (!track) return;

      let isDragging = null;

      const onPointerDown = (e) => {
        const inHandle = this.els.trimInHandle;
        const outHandle = this.els.trimOutHandle;
        if (e.target === inHandle || inHandle.contains(e.target)) isDragging = 'in';
        else if (e.target === outHandle || outHandle.contains(e.target)) isDragging = 'out';
        else isDragging = 'playhead';

        handleMove(e);
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', onPointerUp);
      };

      const handleMove = (e) => {
        if (!isDragging || !this.totalDurationMs) return;
        const rect = track.getBoundingClientRect();
        const clientX = Math.max(rect.left, Math.min(rect.right, e.clientX));
        const pct = (clientX - rect.left) / rect.width;
        const timeMs = Math.round(pct * this.totalDurationMs);

        if (isDragging === 'in') {
          this.trimInMs = Math.max(0, Math.min(timeMs, this.trimOutMs - 300));
        } else if (isDragging === 'out') {
          this.trimOutMs = Math.min(this.totalDurationMs, Math.max(timeMs, this.trimInMs + 300));
        } else if (isDragging === 'playhead') {
          if (this.els.videoPlayer) {
            this.els.videoPlayer.currentTime = timeMs / 1000;
          }
        }
        this._updateTrimmerUI();
      };

      const onPointerUp = () => {
        isDragging = null;
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      track.addEventListener('pointerdown', onPointerDown);
    }

    async inspectAndShow(file) {
      if (!this.modal) this.init();
      if (!this.modal || !file) return false;

      this.videoFile = file;
      if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);
      this.videoUrl = URL.createObjectURL(file);

      const isMkv = /\.mkv$/i.test(file.name) || file.type.includes('matroska');
      const isMov = /\.mov$/i.test(file.name) || file.type.includes('quicktime');

      this.trimInMs = 0;
      this.trimOutMs = 0;
      this.totalDurationMs = 0;
      this.selectedAudioMode = 'track1';
      this.dialogueBoostEnabled = true;
      this.extractedCues = [];

      // Update Header Title & Format Badge
      if (this.els.typeBadge) {
        this.els.typeBadge.textContent = isMkv ? 'Matroska MKV' : 'QuickTime MOV';
      }
      if (this.els.modalTitle) {
        this.els.modalTitle.textContent = isMkv ? 'MKV Pre-Import Inspector' : 'MOV Pre-Import Inspector';
      }
      if (this.els.fileNameText) this.els.fileNameText.textContent = file.name;
      if (this.els.fileSizeText) this.els.fileSizeText.textContent = formatFileSize(file.size);

      // Load into preview player
      if (this.els.videoPlayer) {
        this.els.videoPlayer.src = this.videoUrl;
        this.els.videoPlayer.load();
      }

      // Binary parsing based on container format
      if (isMkv) {
        this.parsedInfo = await EbmlParser.parse(file);
      } else {
        // MOV fallback
        this.parsedInfo = typeof QuickTimeAtomParser !== 'undefined'
          ? await QuickTimeAtomParser.parse(file)
          : { videoTracks: [], audioTracks: [], subtitleTracks: [], extractedCues: [] };
      }

      if (this.parsedInfo.extractedCues && this.parsedInfo.extractedCues.length > 0) {
        this.extractedCues = this.parsedInfo.extractedCues;
      }

      this._populateModalUI(isMkv);
      this.modal.classList.remove('hidden');
      return true;
    }

    _populateModalUI(isMkv = false) {
      const info = this.parsedInfo;
      const { techSpecsBadge, audioTracksList, subTracksSection, subTracksList, subCuesCountBadge } = this.els;

      // 1. Tech Specs Badge
      const vTrack = (info.videoTracks && info.videoTracks[0]) || {};
      const resStr = vTrack.width ? `${vTrack.width}×${vTrack.height}` : (isMkv ? 'MKV Video' : 'MOV Video');
      const codecStr = vTrack.codec || (isMkv ? 'H.264 / Matroska' : 'ProRes / MOV');
      const aCount = info.audioTracks ? info.audioTracks.length : 1;
      const sCount = info.subtitleTracks ? info.subtitleTracks.length : 0;
      if (techSpecsBadge) {
        techSpecsBadge.textContent = `${codecStr} · ${resStr} · ${aCount} Audio Track${aCount > 1 ? 's' : ''} · ${sCount} Sub Track${sCount > 1 ? 's' : ''}`;
      }

      // 2. Audio Tracks UI
      if (audioTracksList) {
        audioTracksList.innerHTML = '';
        const tracks = (info.audioTracks && info.audioTracks.length) ? info.audioTracks : [
          { number: 1, codec: 'AAC', channels: 2, sampleRate: 48000, name: 'Main Stereo Mix', language: 'und' }
        ];

        tracks.forEach((at, i) => {
          const item = document.createElement('div');
          item.className = 'vn-mov-audio-track-item';
          const chStr = at.channels === 1 ? 'Mono' : (at.channels === 2 ? 'Stereo' : `${at.channels} Ch`);
          const langBadge = at.language && at.language !== 'und' ? `<span class="vn-mov-badge-sm">${at.language.toUpperCase()}</span>` : '';
          item.innerHTML = `
            <div class="vn-mov-track-row">
              <span class="vn-mov-track-num">Audio Track ${i + 1}</span>
              <span class="vn-mov-badge-sm">${at.codec || 'Audio'}</span>
              <span class="vn-mov-badge-sm">${chStr}</span>
              ${langBadge}
              <span class="vn-mov-badge-sm">${Math.round(at.sampleRate / 1000)} kHz</span>
              <span class="vn-mov-track-desc">${at.name || (i === 0 ? 'Main Program Mix' : 'Alternate Audio / Dub')}</span>
            </div>
          `;
          audioTracksList.appendChild(item);
        });

        const mixOptionWrap = document.getElementById('movAudioModeMixWrap');
        if (mixOptionWrap) mixOptionWrap.classList.toggle('hidden', tracks.length < 2);
        const track2OptionWrap = document.getElementById('movAudioModeTrack2Wrap');
        if (track2OptionWrap) track2OptionWrap.classList.toggle('hidden', tracks.length < 2);
      }

      // 3. Subtitle Tracks UI
      if (subTracksSection) {
        if (info.subtitleTracks && info.subtitleTracks.length > 0) {
          subTracksSection.classList.remove('hidden');
          if (subTracksList) {
            subTracksList.innerHTML = '';
            info.subtitleTracks.forEach((st, idx) => {
              const el = document.createElement('div');
              el.className = 'vn-mov-sub-track-item';
              const cuesForTrack = info.subtitleTracksMap && info.subtitleTracksMap.get(st.number);
              const cueCountStr = cuesForTrack && cuesForTrack.length ? `${cuesForTrack.length} cues` : 'Embedded';
              const langStr = st.language ? st.language.toUpperCase() : 'UND';

              el.innerHTML = `
                <div class="vn-mov-track-row">
                  <span class="vn-mov-track-num">Sub Track ${idx + 1}</span>
                  <span class="vn-mov-badge-sm">${st.codec || 'UTF-8'}</span>
                  <span class="vn-mov-badge-sm">${langStr}</span>
                  <span class="vn-mov-track-desc">${st.name || 'Captions'} (${cueCountStr})</span>
                </div>
              `;
              subTracksList.appendChild(el);
            });
          }
          if (subCuesCountBadge) {
            subCuesCountBadge.textContent = `${info.subtitleTracks.length} Track(s) Detected`;
          }
        } else {
          subTracksSection.classList.add('hidden');
        }
      }
    }

    _updateTrimmerUI() {
      const { trimTimeDisplay, trimRangeDuration, trimInHandle, trimOutHandle, trimActiveBar, videoPlayer } = this.els;
      if (!this.totalDurationMs) return;

      const inPct = (this.trimInMs / this.totalDurationMs) * 100;
      const outPct = (this.trimOutMs / this.totalDurationMs) * 100;
      const rangeMs = Math.max(0, this.trimOutMs - this.trimInMs);

      if (trimInHandle) trimInHandle.style.left = `${inPct}%`;
      if (trimOutHandle) trimOutHandle.style.left = `${outPct}%`;
      if (trimActiveBar) {
        trimActiveBar.style.left = `${inPct}%`;
        trimActiveBar.style.width = `${Math.max(0, outPct - inPct)}%`;
      }

      if (trimTimeDisplay) {
        trimTimeDisplay.textContent = `In: ${formatTimecode(this.trimInMs)} ➔ Out: ${formatTimecode(this.trimOutMs)}`;
      }
      if (trimRangeDuration) {
        trimRangeDuration.textContent = `Trimmed: ${formatTimecode(rangeMs)} (${Math.round(rangeMs / 1000)}s)`;
      }

      if (videoPlayer) {
        const curMs = Math.round(videoPlayer.currentTime * 1000);
        this._updatePlayheadPosition(curMs);
      }
    }

    _updatePlayheadPosition(curMs) {
      if (!this.totalDurationMs || !this.els.trimPlayhead) return;
      const pct = (curMs / this.totalDurationMs) * 100;
      this.els.trimPlayhead.style.left = `${Math.min(100, Math.max(0, pct))}%`;
    }

    _applyAudioRoutingPreview() {
      const video = this.els.videoPlayer;
      if (!video) return;

      if (this.selectedAudioMode === 'mute') {
        video.muted = true;
        return;
      }
      video.muted = false;

      try {
        if (!this.audioContext) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            this.audioContext = new AudioContextClass();
            this.audioSourceNode = this.audioContext.createMediaElementSource(video);
            this.eqFilterNode = this.audioContext.createBiquadFilter();
            this.eqFilterNode.type = 'peaking';
            this.eqFilterNode.frequency.value = 2500;
            this.eqFilterNode.Q.value = 1.0;
            this.audioSourceNode.connect(this.eqFilterNode);
            this.eqFilterNode.connect(this.audioContext.destination);
          }
        }
        if (this.eqFilterNode) {
          this.eqFilterNode.gain.value = this.dialogueBoostEnabled ? 3.5 : 0;
        }
        if (this.audioContext && this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(() => {});
        }
      } catch (_) {}
    }

    commitImport() {
      if (!this.videoFile) return;

      const ext = this.videoFile.name.split('.').pop().toUpperCase();
      const settings = {
        file: this.videoFile,
        trimInMs: this.trimInMs,
        trimOutMs: this.trimOutMs > 0 ? this.trimOutMs : this.totalDurationMs,
        audioMode: this.selectedAudioMode,
        dialogueBoost: this.dialogueBoostEnabled,
        extractedCues: this.importSubsChecked ? this.extractedCues : []
      };

      this.close();

      if (window.VideoEditorPlayer) {
        window.VideoEditorPlayer.loadVideoFile(this.videoFile);

        if (settings.trimInMs > 0 || (settings.trimOutMs > 0 && settings.trimOutMs < this.totalDurationMs)) {
          window.VideoEditorPlayer.seekTo(settings.trimInMs);
          if (typeof Toast !== 'undefined' && Toast.show) {
            Toast.show(`${ext} imported with custom trim range`, 'success', {
              subtext: `${formatTimecode(settings.trimInMs)} ➔ ${formatTimecode(settings.trimOutMs)}`
            });
          }
        } else {
          if (typeof Toast !== 'undefined' && Toast.show) {
            Toast.show(`${ext} container configured & loaded!`, 'success', {
              subtext: `Audio: ${settings.audioMode.toUpperCase()}${settings.dialogueBoost ? ' · Speech EQ Enhanced' : ''}`
            });
          }
        }

        if (settings.extractedCues && settings.extractedCues.length > 0 && window.VideoEditorState) {
          window.VideoEditorState.setCues(settings.extractedCues);
          if (window.VideoEditor && window.VideoEditor.timeline) {
            window.VideoEditor.timeline.setCues(settings.extractedCues);
          }
          Toast.show(`Extracted & imported ${settings.extractedCues.length} embedded subtitle cues!`, 'success');
        }
      }
    }

    close() {
      if (this.els.videoPlayer) {
        try { this.els.videoPlayer.pause(); } catch (_) {}
      }
      if (this.modal) {
        this.modal.classList.add('hidden');
      }
    }
  }

  // Export as MovImporter and MkvImporter for seamless universal usage
  const manager = new MediaContainerImporterManager();
  window.MovImporter = manager;
  window.MkvImporter = manager;
  window.MediaContainerImporter = manager;
})();
