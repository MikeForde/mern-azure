const { isValidObjectId } = require('mongoose');
const { validate: isValidUUID } = require('uuid');
const { IPSModel } = require('../models/IPSModel');

/**
 * Resolves an ID to an IPSModel record based on the following logic:
 * 1. If the ID is a valid UUID, search by `packageUUID`.
 * 2. If the ID is not a UUID, search by `packageUUID` first.
 * 3. If no record is found in step 2 and the ID is a valid MongoDB ObjectId, search by `_id`.
 *
 * @param {string} id - The ID to resolve.
 * @returns {Promise} - A promise resolving to the record or `null`.
 */
async function resolveId(id) {
    if (isValidUUID(id)) {
        console.log("Valid UUID, searching by packageUUID");
        return await IPSModel.findOne({ packageUUID: id });
    }

    console.log("Not a valid UUID, searching by packageUUID...");
    const record = await IPSModel.findOne({ packageUUID: id });
    if (!record && isValidObjectId(id)) {
        console.log("Searching by _id (MongoDB ObjectId)...");
        return await IPSModel.findById(id);
    }

    return record;
}

module.exports = { resolveId };
