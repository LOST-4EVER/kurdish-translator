/**
 * app-decoder.js — File reader & text decoding utilities for subtitle files.
 */
const AppDecoder = (() => {
  /**
   * Reads a File or Blob and returns decoded plain text.
   * Auto-detects UTF-8 BOM, UTF-16 LE/BE, and falls back gracefully.
   * @param {File|Blob} file
   * @returns {Promise<string>}
   */
  function readTextFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file provided'));
        return;
      }

      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error(reader.error ? reader.error.message : 'Failed to read file'));
      };

      reader.onload = (e) => {
        try {
          const buffer = e.target.result;
          const bytes = new Uint8Array(buffer);
          const decoded = decodeBytes(bytes);
          resolve(decoded);
        } catch (err) {
          reject(err);
        }
      };

      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Decodes byte array into string using BOM or TextDecoder.
   * @param {Uint8Array} bytes
   * @returns {string}
   */
  function decodeBytes(bytes) {
    if (!bytes || bytes.length === 0) return '';

    // UTF-8 BOM
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return new TextDecoder('utf-8').decode(bytes.subarray(3));
    }

    // UTF-16 LE BOM
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    }

    // UTF-16 BE BOM
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    }

    // Heuristic UTF-16 check if many null bytes exist in alternating positions
    if (bytes.length >= 4) {
      let nullEvens = 0;
      let nullOdds = 0;
      const checkLen = Math.min(bytes.length, 512);
      for (let i = 0; i < checkLen; i++) {
        if (bytes[i] === 0) {
          if (i % 2 === 0) nullEvens++;
          else nullOdds++;
        }
      }
      if (nullOdds > checkLen * 0.25) {
        return new TextDecoder('utf-16le').decode(bytes);
      }
      if (nullEvens > checkLen * 0.25) {
        return new TextDecoder('utf-16be').decode(bytes);
      }
    }

    // Default UTF-8 with fatal fallback for Kurdish / Arabic Windows-1256
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
    } catch (e) {
      try {
        return new TextDecoder('windows-1256').decode(bytes).replace(/^\uFEFF/, '');
      } catch (e2) {
        return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
      }
    }
  }

  return {
    readTextFile,
    readFileAsText: readTextFile,
    decodeBytes,
  };
})();

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined' && typeof window === 'undefined') {
  module.exports = AppDecoder;
}
