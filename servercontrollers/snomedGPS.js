const SnomedGPS = require("../models/SnomedGPS");

const parseLimit = (value, defaultValue = 25, maxValue = 200) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return defaultValue;
  return Math.min(parsed, maxValue);
};

const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PROJECTION = {
  _id: 0,
  code: 1,
  term_clean: 1,
  term: 1,
  semantic_tag: 1,
};

const getSemanticTagFilter = (tag) => {
  switch ((tag || "").trim().toLowerCase()) {
    case "":
      return {};

    case "medication":
      return {
        semantic_tag: {
          $in: [
            "clinical drug",
            "medicinal product",
            "medicinal product form",
          ],
        },
      };

    case "allergyintolerance":
      return {
        semantic_tag: "substance",
      };

    case "immunization":
      return {
        semantic_tag: {
          $in: ["medicinal product", "medicinal product form"],
        },
        term_clean: /^Vaccine product containing/i,
      };

    case "observation":
      return {
        semantic_tag: "observable entity",
      };

    default:
      return {
        semantic_tag: tag,
      };
  }
};

const buildSearchFilter = (tag, q) => {
  const trimmedTag = (tag || "").trim();
  const trimmedQ = (q || "").trim();

  const baseFilter = getSemanticTagFilter(trimmedTag);

  if (!trimmedQ) {
    return baseFilter;
  }

  const escaped = escapeRegex(trimmedQ);
  const containsRegex = new RegExp(escaped, "i");

  if (trimmedTag.toLowerCase() === "allergyintolerance") {
    const allergyToPrefixRegex = new RegExp(`^Allergy to ${escaped}`, "i");

    return {
      $or: [
        {
          semantic_tag: "substance",
          $or: [
            { term_clean: containsRegex },
            { term: containsRegex },
            { code: containsRegex },
          ],
        },
        {
          semantic_tag: "disorder",
          term_clean: allergyToPrefixRegex,
        },
      ],
    };
  }

  return {
    ...baseFilter,
    $or: [
      { term_clean: containsRegex },
      { term: containsRegex },
      { code: containsRegex },
    ],
  };
};

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
    const concept = await SnomedGPS.findOne({ code }, PROJECTION).lean();

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

    const filter = getSemanticTagFilter(tag);

    const results = await SnomedGPS.find(filter, PROJECTION)
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

    const filter = buildSearchFilter(tag, q);

    const results = await SnomedGPS.find(filter, PROJECTION)
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