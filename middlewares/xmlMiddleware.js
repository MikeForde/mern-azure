// middlewares/xmlMiddleware.js

const xmlparser = require("express-xml-bodyparser");
const getRawBody = require("raw-body");

/**
 * Middleware to handle XML parsing for non-/test endpoints.
 */
async function xmlMiddleware(req, res, next) {
    if (req.path === "/test") {
        // If Content-Type indicates text, just proceed.
        if (req.headers["content-type"] && req.headers["content-type"].includes("text")) {
            return next();
        }

        // Otherwise, if not already parsed, read the raw body as UTF-8 text.
        try {
            if (!req.body || Object.keys(req.body).length === 0) {
                req.body = await getRawBody(req, { encoding: "utf8" });
            }
            next();
        } catch (err) {
            next(err);
        }
    } else {
        // Use XML parser middleware for all other routes
        xmlparser({ normalizeTags: false })(req, res, next);
    }
}

module.exports = xmlMiddleware;
