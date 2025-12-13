const { resolveId } = require('../utils/resolveId');
const { generateIPSBundleUnified, protectIPSBundle } = require('./servercontrollerfuncs/generateIPSBundleUnified');

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

  // Find Patient + Organization entries (always included in BOTH so each bundle is self-contained)
  const patientEntry = bundle.entry.find(e => e.resource?.resourceType === "Patient");
  const orgEntry     = bundle.entry.find(e => e.resource?.resourceType === "Organization");

  // Build a map: MedicationRequest -> Medication reference, and Medication id -> request time
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

  // helper to push into RO/RW based on date
  function placeEntry(entry, dateMs) {
    // undated resources: keep in RO by default (conservative)
    const isAfter = (dateMs != null) ? (dateMs > cutoffMs) : false;
    (isAfter ? rwEntries : roEntries).push(entry);
  }

  // Add patient/org to both (so the RW bundle still resolves Patient/pt1 references)
//   if (patientEntry) { roEntries.push(patientEntry); rwEntries.push(patientEntry); }
//   if (orgEntry)     { roEntries.push(orgEntry);     rwEntries.push(orgEntry); }

if (patientEntry) { roEntries.push(patientEntry); }
  if (orgEntry)     { roEntries.push(orgEntry);  }

  for (const entry of bundle.entry) {
    const r = entry.resource;
    if (!r) continue;

    // already added above
    if (r.resourceType === "Patient" || r.resourceType === "Organization") continue;

    // Medication resources have no date — tie them to their MedicationRequest authoredOn
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

    const useJwe =
      String(req.query.protect || '').trim() === '1' ||
      (req.get('X-Field-Enc') || '').toLowerCase() === 'jwe';

    const useOmit =
      String(req.query.protect || '').trim() === '2' ||
      (req.get('X-Field-Enc') || '').toLowerCase() === 'omit';

    let protectMethod = "none";
    if (useJwe) protectMethod = "jwe";
    else if (useOmit) protectMethod = "omit";

    const bundle = generateIPSBundleUnified(ips);
    const protectedBundle = await protectIPSBundle(bundle, protectMethod);

    // cutoff defaults to bundle.timestamp unless caller provides ?cutoff=...
    const cutoffIso = String(req.query.cutoff || protectedBundle.timestamp);

    const { roBundle, rwBundle } = splitBundleByTimestamp(protectedBundle, cutoffIso);

    res.json({
      id: protectedBundle.id,
      cutoff: cutoffIso,
      protect: protectMethod,
      ro: roBundle,
      rw: rwBundle
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { getIPSUnifiedBundleSplit };
