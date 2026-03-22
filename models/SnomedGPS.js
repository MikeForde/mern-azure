const mongoose = require("mongoose");

const snomedGPSSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    term: { type: String, required: true },
    term_clean: { type: String, required: true, index: true },
    semantic_tag: { type: String, index: true },
  },
  {
    collection: "snomedgps",
    versionKey: false,
  }
);

snomedGPSSchema.index({ semantic_tag: 1, term_clean: 1 });

module.exports = mongoose.model("SnomedGPS", snomedGPSSchema);