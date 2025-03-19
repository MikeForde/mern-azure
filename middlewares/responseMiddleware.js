// middlewares/responseMiddleware.js

const { encrypt, encryptBinary } = require('../encryption/aesUtils');
const { gzipEncode } = require('../compression/gzipUtils');

/**
 * Middleware to handle Gzip & AES encryption for responses.
 */
function responseMiddleware(req, res, next) {
    const originalSend = res.send;

    res.send = async function (body) {
        try {
            let modifiedBody = body;

            // Check headers
            const acceptEncoding = req.headers["accept-encoding"] || "";
            const acceptExtra = req.headers["accept-extra"] || "";
            const acceptEncryption = req.headers["accept-encryption"] || "";
            const isInternalCall = req.headers["sec-fetch-site"] === "same-origin";
            const isBinaryRequested = req.headers["accept"] === "application/octet-stream";

            let isCompressed = false;
            let isBase64 = acceptEncoding.includes("base64") || acceptExtra.includes("base64");
            let gzipReq = false;

            // 5A. If client requests raw binary, we handle it separately
            if (isBinaryRequested) {
                console.log("Returning response as encrypted + compressed binary.");

                // Convert to string if it's an object
                if (typeof modifiedBody === "object") {
                    modifiedBody = JSON.stringify(modifiedBody);
                } else if (Buffer.isBuffer(modifiedBody)) {
                    modifiedBody = modifiedBody.toString();
                }

                // 1) Compress
                let compressedData = await gzipEncode(Buffer.from(modifiedBody, 'utf8'));

                // 2) Encrypt the compressed data
                const binaryResponse = encryptBinary(compressedData);

                // Set headers
                res.set("Content-Type", "application/octet-stream");
                res.set("Content-Length", binaryResponse.length);
                res.set("X-Encrypted", "true");

                return originalSend.call(this, binaryResponse);
            }

            // 5B. Otherwise, fallback to JSON-based encryption and compression
            // Apply compression if requested and not an internal call
            if ((acceptEncoding.includes("gzip") && !isInternalCall)
                || acceptEncoding.includes("insomzip")
                || acceptExtra.includes("insomzip")) {
                gzipReq = true;
                console.log("Returning response using gzip compression...");

                // Convert body to string if it's an object
                if (typeof modifiedBody === "object") {
                    modifiedBody = JSON.stringify(modifiedBody);
                } else if (Buffer.isBuffer(modifiedBody)) {
                    modifiedBody = modifiedBody.toString();
                }

                // Compress
                const compressedData = await gzipEncode(modifiedBody);
                modifiedBody = compressedData;
                isCompressed = true;
                res.set("Content-Encoding", "gzip");
                res.set("Content-Type", "application/octet-stream");
            }

            // Apply JSON-based encryption if requested
            if (acceptEncryption === "aes256") {
                console.log("Returning response using AES-256 encryption. Base64 flag is:", isBase64);

                if (!gzipReq) {
                    if (typeof modifiedBody === "object" || Buffer.isBuffer(modifiedBody)) {
                        modifiedBody = JSON.stringify(modifiedBody);
                    } else {
                        modifiedBody = modifiedBody.toString();
                    }
                }

                // Encrypt using JSON-based encryption
                if (acceptExtra.includes("includeKey")) {
                    const { encryptedData, iv, mac, key: devKey } = encrypt(modifiedBody, isBase64);
                    modifiedBody = JSON.stringify({ encryptedData, iv, mac, key: devKey });
                } else {
                    const { encryptedData, iv, mac } = encrypt(modifiedBody, isBase64);
                    modifiedBody = JSON.stringify({ encryptedData, iv, mac });
                }

                res.set("Content-Type", "application/json");
                res.set("x-encrypted", "true");

                // Remove Content-Encoding if previously set
                if (isCompressed) {
                    res.removeHeader("Content-Encoding");
                }
            }

            // Send the final response
            return originalSend.call(this, modifiedBody);
        } catch (error) {
            console.error("Error processing response data:", error);
            res.status(500).send("Error processing response");
        }
    };

    next();
}

module.exports = responseMiddleware;
