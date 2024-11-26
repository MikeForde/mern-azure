const zlib = require('zlib');

/**
 * Compress data into Gzip format
 * @param {Buffer | string} data - The data to be compressed (can be JSON, text, or XML)
 * @returns {Promise<Buffer>} - The compressed gzip data
 */
function gzipEncode(data) {
    return new Promise((resolve, reject) => {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
        zlib.gzip(buffer, (err, compressedData) => {
            if (err) {
                return reject(err);
            }
            resolve(compressedData);
        });
    });
}

/**
 * Decompress Gzip data
 * @param {Buffer} compressedData - The compressed gzip data
 * @returns {Promise<string>} - The decompressed data as a string
 */
function gzipDecode(compressedData) {
    return new Promise((resolve, reject) => {
        zlib.gunzip(compressedData, (err, decompressedData) => {
            if (err) {
                return reject(err);
            }
            resolve(decompressedData.toString('utf-8'));
        });
    });
}

module.exports = { gzipEncode, gzipDecode };
