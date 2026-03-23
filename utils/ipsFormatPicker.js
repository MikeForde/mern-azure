const { generateIPSBundleUnified } = require('../servercontrollers/servercontrollerfuncs/generateIPSBundleUnified');
const { generateIPSBundle } = require('../servercontrollers/servercontrollerfuncs/generateIPSBundle');
const { generateIPSBundleLegacy } = require('../servercontrollers/servercontrollerfuncs/generateIPSBundleLegacy');
const { generateIPSBundleNHSSCR } = require('../servercontrollers/servercontrollerfuncs/generateIPSBundleNHSSCR');  
const { generateIPSBundleEPS } = require('../servercontrollers/servercontrollerfuncs/generateIPSBundleEPS');

function pickIPSFormat(headerValue) {
    const format = headerValue || 'unified';

    switch (format) {
        case 'inter':
            return generateIPSBundle;
        case 'legacy':
            return generateIPSBundleLegacy;
        case 'nhsscr':
            return generateIPSBundleNHSSCR;
        case 'euro' :
            return generateIPSBundleEPS;
        case 'unified':
        default:
            return generateIPSBundleUnified;
    }
}

module.exports = { pickIPSFormat };
