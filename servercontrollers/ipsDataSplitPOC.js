const { resolveId } = require('../utils/resolveId');
const { generateXMPPPlainText } = require('./servercontrollerfuncs/generateXMPPPlainText');
const { generateIPSBundleUnified, protectIPSBundle } = require('./servercontrollerfuncs/generateIPSBundleUnified');
const { gzipEncode } = require('../compression/gzipUtils');

async function getIPSDataSplitPOC(req, res) {
  const id = req.params.id;

  console.log("getIPSDataSplitPOC called with ID:", id);

  try {
    const ips = await resolveId(id);

    if (!ips) {
      return res.status(404).json({ message: "IPS record not found" });
    }

    const useJwe =
      String(req.query.protect || '').trim() === '1' ||
      (req.get('X-Field-Enc') || '').toLowerCase() === 'jwe';

    const useOmit =
      String(req.query.protect || '').trim() === '2' ||
      (req.get('X-Field-Enc') || '').toLowerCase() === 'omit';

    let protectMethod = "none";
    if (useJwe) protectMethod = "jwe";
    else if (useOmit) protectMethod = "omit";

    // RO: human-readable plaintext; omit Obs/Imm/Proc
    const roText = generateXMPPPlainText(ips, true);

    // RW: unified FHIR JSON, gzipped (POC)
    const rwBundle = generateIPSBundleUnified(ips);
    const protectedBundle = await protectIPSBundle(rwBundle, protectMethod);
    const rwJson = JSON.stringify(protectedBundle);
    const rwGzip = await gzipEncode(rwJson);

    // For transport, return base64 (easy for Android to decode)
    const rwGzipBase64 = rwGzip.toString('base64');

    res.json({
      id: ips.packageUUID,
      timestamp: ips.timeStamp,          // raw DB timestamp (ok for POC)
      ro: {
        type: "text/plain; charset=utf-8",
        omitObsImmProc: true,
        text: roText
      },
      rw: {
        type: "application/fhir+json",
        encoding: "gzip+base64",
        bytesBase64: rwGzipBase64,
        // optionally helpful:
        uncompressedBytes: Buffer.byteLength(rwJson, 'utf8'),
        compressedBytes: rwGzip.length
      }
    });
  } catch (err) {
    console.error("getIPSDataSplitPOC error:", err);
    res.status(400).json({ error: err.message });
  }
}

module.exports = { getIPSDataSplitPOC };
