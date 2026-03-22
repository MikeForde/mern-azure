const SnomedGPS = require("../models/SnomedGPS");

const parseLimit = (value, defaultValue = 25, maxValue = 200) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return defaultValue;
  return Math.min(parsed, maxValue);
};

const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /snomedgps/tags
const getSnomedTags = async (req, res) => {
  try {
    const tags = await SnomedGPS.distinct("semantic_tag", {
      semantic_tag: { $exists: true, $ne: "" },
    });

    res.json(tags.sort((a, b) => a.localeCompare(b)));
  } catch (err) {
    console.error("getSnomedTags error:", err);
    res.status(500).json({ error: "Failed to retrieve SNOMED semantic tags" });
  }
};

// GET /snomedgps/code/:code
const getSnomedByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const concept = await SnomedGPS.findOne({ code }).lean();

    if (!concept) {
      return res.status(404).json({ error: "SNOMED concept not found" });
    }

    res.json(concept);
  } catch (err) {
    console.error("getSnomedByCode error:", err);
    res.status(500).json({ error: "Failed to retrieve SNOMED concept" });
  }
};

// GET /snomedgps/picklist/:tag?limit=100
const getSnomedPicklistByTag = async (req, res) => {
  try {
    const { tag } = req.params;
    const limit = parseLimit(req.query.limit, 100, 1000);

    const results = await SnomedGPS.find(
      { semantic_tag: tag },
      { _id: 0, code: 1, term_clean: 1, term: 1, semantic_tag: 1 }
    )
      .sort({ term_clean: 1 })
      .limit(limit)
      .lean();

    res.json(results);
  } catch (err) {
    console.error("getSnomedPicklistByTag error:", err);
    res.status(500).json({ error: "Failed to retrieve SNOMED picklist" });
  }
};

// GET /snomedgps/search?q=asth&tag=disorder&limit=25
const searchSnomedGPS = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const tag = (req.query.tag || "").trim();
    const limit = parseLimit(req.query.limit, 25, 200);

    const filter = {};

    if (tag) {
      filter.semantic_tag = tag;
    }

    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      filter.$or = [
        { term_clean: regex },
        { term: regex },
        { code: regex },
      ];
    }

    const results = await SnomedGPS.find(
      filter,
      { _id: 0, code: 1, term_clean: 1, term: 1, semantic_tag: 1 }
    )
      .sort({ term_clean: 1 })
      .limit(limit)
      .lean();

    res.json(results);
  } catch (err) {
    console.error("searchSnomedGPS error:", err);
    res.status(500).json({ error: "Failed to search SNOMED GPS" });
  }
};

module.exports = {
  getSnomedTags,
  getSnomedByCode,
  getSnomedPicklistByTag,
  searchSnomedGPS,
};