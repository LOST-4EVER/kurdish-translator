/**
 * app-file.js — Subtitle file reader, byte decoder, format detector & dropzone handlers.
 */
const AppFile = (() => {
  const ALLOWED_EXT = ['srt', 'vtt', 'ass', 'ssa', 'sub', 'smi'];

  const formatSize = (n) =>
    n < 1024 ? `${n} B`
    : n < 1048576 ? `${(n / 1024).toFixed(1)} KB`
    : `${(n / 1048576).toFixed(1)} MB`;

  function cleanBaseName(name) {
    return (name || 'subtitles')
      .replace(/\.[a-zA-Z0-9]+$/, '')
      .replace(/\.(ckb|ku|krd|en|fa|ar|tr|es|fr|de|ja|ko|zh)$/i, '');
  }

  /** Read a file as text, auto-detecting BOM / UTF-16 / UTF-8 encoding. */
  function readFileAsText(f) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const bytes = new Uint8Array(reader.result);
        resolve(decodeBytes(bytes));
      };
      reader.readAsArrayBuffer(f);
    });
  }

  /**
   * Robust byte decoding with BOM detection (UTF-8, UTF-16LE, UTF-16BE) and heuristic BOM-less UTF-16 detection.
   */
  function decodeBytes(bytes) {
    let encoding = 'utf-8';
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) encoding = 'utf-8';
    else if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
    else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
    else {
      // BOM-less UTF-16: ASCII text stored in UTF-16 has a NUL byte in every other position.
      const sample = Math.min(bytes.length, 2048);
      let nulls = 0;
      for (let i = 0; i < sample; i++) if (bytes[i] === 0) nulls++;
      if (sample > 8 && nulls > sample * 0.3) {
        encoding = bytes[0] === 0 ? 'utf-16be' : 'utf-16le';
      }
    }
    try {
      return new TextDecoder(encoding).decode(bytes).replace(/^\uFEFF/, '');
    } catch {
      return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
    }
  }

  function hasFiles(e) {
    return !!(e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files'));
  }

  /**
   * Bind dropzone & whole-page drag-and-drop events.
   * @param {Object} options
   * @param {HTMLElement} options.dropzone
   * @param {HTMLInputElement} options.fileInput
   * @param {HTMLElement} [options.changeFile]
   * @param {(file: File) => void} options.onFile
   */
  function bindDropzone(options) {
    const { dropzone, fileInput, changeFile, onFile } = options;
    let dragCounter = 0;

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          onFile(e.target.files[0]);
        }
        e.target.value = '';
      });

      ['dragenter', 'dragover'].forEach((ev) =>
        dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); })
      );
      ['dragleave', 'drop'].forEach((ev) =>
        dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); })
      );
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        document.body.classList.remove('page-dropping');
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) onFile(f);
      });
      dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
      });
    }

    if (changeFile && fileInput) {
      changeFile.addEventListener('click', () => {
        fileInput.value = '';
        fileInput.click();
      });
    }

    // Whole-page drop target
    document.addEventListener('dragenter', (e) => {
      if (hasFiles(e)) { e.preventDefault(); dragCounter++; document.body.classList.add('page-dropping'); }
    });
    document.addEventListener('dragover', (e) => {
      if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
    });
    document.addEventListener('dragleave', () => {
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) document.body.classList.remove('page-dropping');
    });
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      document.body.classList.remove('page-dropping');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) onFile(f);
    });
  }

  return {
    ALLOWED_EXT,
    formatSize,
    cleanBaseName,
    readFileAsText,
    decodeBytes,
    hasFiles,
    bindDropzone,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppFile;
}
