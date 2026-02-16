// middlewares/jsonDecryptDezipMiddleware.js

const { decrypt } = require('../encryption/aesUtils');
const { gzipDecode } = require('../compression/gzipUtils');
const xml2js = require('xml2js');

/**
 * Middleware to handle decryption and decompression for JSON-based requests.
 */
async function jsonDecryptDezipMiddleware(req, res, next) {
    // Skip processing if it's already handled as raw binary
    if (req.headers['content-type'] === 'application/octet-stream') {
        return next();
    }

    const isEncrypted = req.headers['x-encrypted'] === 'true';
    const isGzip = req.headers['content-encoding']?.includes('gzip');
    const isBase64 = req.headers['content-encoding']?.includes('base64');
    const isInternalCall = req.headers['sec-fetch-site'] === 'same-origin';

    const forceDecode =
      req.headers['x-force-decode'] === 'true' ||
      req.headers['x-decode'] === 'true';

    const shouldProcess = (isEncrypted || isGzip || isBase64) && (!isInternalCall || forceDecode);

    if (shouldProcess) {
        try {
            // Collect raw binary data from the request
            const rawData = await new Promise((resolve, reject) => {
                const chunks = [];
                req.on('data', (chunk) => chunks.push(chunk));
                req.on('end', () => resolve(Buffer.concat(chunks)));
                req.on('error', (err) => reject(err));
            });

            let data = rawData;

            // If encrypted, decrypt the data (JSON-based approach)
            if (isEncrypted) {
                console.log('Incoming data claims to be encrypted. Base64 flag is:', isBase64);

                try {
                    const encryptedPayload = JSON.parse(data.toString('utf8'));
                    console.log('Parsed Encrypted Payload:', encryptedPayload);

                    // Ensure payload contains necessary fields
                    if (!encryptedPayload.encryptedData || !encryptedPayload.iv) {
                        throw new Error('Invalid encrypted payload format. Missing required fields.');
                    }

                    // Decrypt using our existing JSON-based approach in aesUtils
                    data = decrypt(encryptedPayload, isBase64);
                    console.log('Decrypted Data:', data.toString('utf8'));
                } catch (error) {
                    console.error('Decryption failed:', error.message);
                    throw new Error('Failed to decrypt request data.');
                }
            }

            // If gzip encoded, decompress the data
            if (isGzip) {
                console.log('Incoming data claims to be gzip...', data);
                data = await gzipDecode(data);
                console.log('Decompressed Data:', data);
            }

            // Attempt to parse as JSON, fallback to plain text
            const rawStr = data.toString('utf8');

            // If the endpoint is /test, do not attempt to parse as JSON or XML.
            if (req.path === '/test') {
                req.body = rawStr;
                return next();
            }

            try {
                // First, try to parse as JSON.
                req.body = JSON.parse(rawStr);
            } catch (jsonError) {
                try {
                    // Next, try to parse as XML.
                    req.body = await xml2js.parseStringPromise(rawStr, {
                        explicitArray: false,
                        normalizeTags: false
                    });
                } catch (xmlError) {
                    // If both JSON and XML fail, fallback to plain text.
                    req.body = rawStr;
                }
            }

            next();
        } catch (error) {
            console.error('Error processing request data:', error);
            res.status(400).send('Invalid request data');
        }
    } else {
        next();
    }
}

module.exports = jsonDecryptDezipMiddleware;
