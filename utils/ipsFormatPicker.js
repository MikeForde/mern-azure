const { generateIPSBundleUnified } = require('../servercontrollers/servercontrollerfuncs/generateIPSBundleUnified');
const { generateIPSBundle } = require('../servercontrollers/servercontrollerfuncs/generateIPSBundle');
const { generateIPSBundleLegacy } = require('../servercontrollers/servercontrollerfuncs/generateIPSBundleLegacy');

function pickIPSFormat(headerValue) {
    const format = headerValue || 'unified';

    switch (format) {
        case 'inter':
            return generateIPSBundle;
        case 'legacy':
            return generateIPSBundleLegacy;
        case 'unified':
        default:
            return generateIPSBundleUnified;
    }
}

module.exports = { pickIPSFormat };
