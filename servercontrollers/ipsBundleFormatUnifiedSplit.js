const { resolveId } = require('../utils/resolveId');
const { generateIPSBundleUnified, protectIPSBundle } = require('./servercontrollerfuncs/generateIPSBundleUnified');
const { gzipEncode } = require('../compression/gzipUtils'); // <-- adjust path to your gzipUtils.js

function parseIso(s) {
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function getResourceDateMillis(resource) {
  if (!resource || !resource.resourceType) return null;

  switch (resource.resourceType) {
    case "AllergyIntolerance":
      return parseIso(resource.onsetDateTime);
    case "Condition":
      return parseIso(resource.onsetDateTime);
    case "Observation":
      return parseIso(resource.effectiveDateTime);
    case "Procedure":
      return parseIso(resource.performedDateTime);
    case "MedicationRequest":
      return parseIso(resource.authoredOn);
    default:
      return null;
  }
}

function splitBundleByTimestamp(bundle, cutoffIso) {
  const cutoffMs = parseIso(cutoffIso);
  if (cutoffMs == null) {
    throw new Error(`Invalid cutoff timestamp: ${cutoffIso}`);
  }

  const patientEntry = bundle.entry.find(e => e.resource?.resourceType === "Patient");
  const orgEntry     = bundle.entry.find(e => e.resource?.resourceType === "Organization");

  // Map Medication.id -> MedicationRequest.authoredOn
  const medReqs = bundle.entry
    .filter(e => e.resource?.resourceType === "MedicationRequest")
    .map(e => e.resource);

  const medTimeByMedicationId = new Map(); // "med1" -> authoredOn ms
  for (const mr of medReqs) {
    const ms = parseIso(mr.authoredOn);
    const ref = mr?.medicationReference?.reference; // "Medication/med1"
    if (!ms || !ref) continue;
    const parts = String(ref).split("/");
    if (parts.length === 2 && parts[0] === "Medication") {
      medTimeByMedicationId.set(parts[1], ms);
    }
  }

  const roEntries = [];
  const rwEntries = [];

  function placeEntry(entry, dateMs) {
    const isAfter = (dateMs != null) ? (dateMs > cutoffMs) : false;
    (isAfter ? rwEntries : roEntries).push(entry);
  }

  // NOTE: you currently include Patient+Org only in RO (not RW). Keeping as-is.
  if (patientEntry) roEntries.push(patientEntry);
  if (orgEntry)     roEntries.push(orgEntry);

  for (const entry of bundle.entry) {
    const r = entry.resource;
    if (!r) continue;

    if (r.resourceType === "Patient" || r.resourceType === "Organization") continue;

    if (r.resourceType === "Medication") {
      const ms = medTimeByMedicationId.get(r.id) ?? null;
      placeEntry(entry, ms);
      continue;
    }

    const ms = getResourceDateMillis(r);
    placeEntry(entry, ms);
  }

  function makeBundle(entries) {
    return {
      resourceType: "Bundle",
      id: bundle.id,
      timestamp: bundle.timestamp,
      type: bundle.type,
      total: entries.length,
      entry: entries
    };
  }

  return { roBundle: makeBundle(roEntries), rwBundle: makeBundle(rwEntries) };
}

async function getIPSUnifiedBundleSplit(req, res) {
  const id = req.params.id;

  try {
    const ips = await resolveId(id);
    if (!ips) return res.status(404).json({ message: "IPS record not found" });

    const protectQ = String(req.query.protect || '').trim();
    const hdr = (req.get('X-Field-Enc') || '').toLowerCase();

    const useJwe  = protectQ === '1' || hdr === 'jwe';
    const useOmit = protectQ === '2' || hdr === 'omit';

    let protectMethod = "none";
    if (useJwe) protectMethod = "jwe";
    else if (useOmit) protectMethod = "omit";

    const bundle = generateIPSBundleUnified(ips);
    const protectedBundle = await protectIPSBundle(bundle, protectMethod);

    // cutoff defaults to bundle.timestamp unless caller provides ?cutoff=...
    const cutoffIso = String(req.query.cutoff || protectedBundle.timestamp);

    const { roBundle, rwBundle } = splitBundleByTimestamp(protectedBundle, cutoffIso);

    // gzip behavior: default ON (gzip=1). allow ?gzip=0 to return plain JSON bundles.
    const gzipOn = String(req.query.gzip || '1').trim() !== '0';

    if (!gzipOn) {
      return res.json({
        id: protectedBundle.id,
        cutoff: cutoffIso,
        protect: protectMethod,
        encoding: "json",
        ro: roBundle,
        rw: rwBundle
      });
    }

    // Payload-level gzip: JSON -> UTF-8 -> gzip -> base64
    const roJson = JSON.stringify(roBundle);
    const rwJson = JSON.stringify(rwBundle);

    const roGz = await gzipEncode(roJson);
    const rwGz = await gzipEncode(rwJson);

    res.json({
      id: protectedBundle.id,
      cutoff: cutoffIso,
      protect: protectMethod,
      encoding: "gzip+base64",

      // helpful metadata for your demo UI
      roBytesJson: Buffer.byteLength(roJson, 'utf8'),
      rwBytesJson: Buffer.byteLength(rwJson, 'utf8'),
      roBytesGz: roGz.length,
      rwBytesGz: rwGz.length,

      // actual payloads
      roGzB64: roGz.toString('base64'),
      rwGzB64: rwGz.toString('base64')
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { getIPSUnifiedBundleSplit };
