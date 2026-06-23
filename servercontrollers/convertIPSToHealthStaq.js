// servercontrollers/convertIPSToHealthStaq.js

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Convert an IPS collection/document Bundle into a FHIR transaction Bundle
 * suitable for submission to HealthStaq.
 *
 * Existing resource IDs are retained so that relative references such as
 * Patient/pt1 and Organization/org1 continue to resolve correctly.
 */
function buildHealthStaqTransaction(sourceBundle) {
    if (
        !sourceBundle ||
        sourceBundle.resourceType !== 'Bundle' ||
        !Array.isArray(sourceBundle.entry)
    ) {
        throw new Error(
            'The supplied data must be a FHIR Bundle containing an entry array.'
        );
    }

    const transactionBundle = structuredClone(sourceBundle);

    transactionBundle.type = 'transaction';

    // Bundle.total is intended for search/history result Bundles,
    // rather than transaction submissions.
    delete transactionBundle.total;

    transactionBundle.entry = transactionBundle.entry
        // .filter((entry) => {
        //     const resourceType = entry?.resource?.resourceType;

        //     // HealthStaq owns/creates its own Organization resource in returned summaries.
        //     // Do not push IPS MERN Organization resources to HealthStaq.
        //     return resourceType !== 'Organization';
        // })
        .map(
            (entry, index) => {
                const resource = entry?.resource;

                if (!resource?.resourceType) {
                    throw new Error(
                        `Bundle entry ${index} does not contain a resourceType.`
                    );
                }

                if (!resource.id) {
                    throw new Error(
                        `Bundle entry ${index} (${resource.resourceType}) ` +
                        'does not contain an id.'
                    );
                }

                const convertedEntry = {
                    resource,
                    request: {
                        method: 'PUT',
                        url:
                            `${resource.resourceType}/` +
                            encodeURIComponent(resource.id),
                    },
                };

                /*
                 * HealthStaq's example uses urn:uuid fullUrls.
                 * Only add that form when the resource ID is actually a UUID.
                 *
                 * For IDs such as pt1 and org1, fullUrl can be omitted because
                 * the PUT request URL identifies the target resource.
                 */
                if (UUID_PATTERN.test(resource.id)) {
                    convertedEntry.fullUrl = `urn:uuid:${resource.id}`;
                }

                return convertedEntry;
            }
        );

    return transactionBundle;
}

async function convertIPSToHealthStaq(req, res) {
    try {
        const transactionBundle =
            buildHealthStaqTransaction(req.body);

        return res
            .status(200)
            .type('application/fhir+json')
            .send(transactionBundle);
    } catch (error) {
        return res.status(400).json({
            error: error.message,
        });
    }
}

module.exports = {
    buildHealthStaqTransaction,
    convertIPSToHealthStaq,
};