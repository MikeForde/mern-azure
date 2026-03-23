// client/src/utils/medicationTermShortener.js

const UNIT_MAP = {
  milligram: "mg",
  gram: "g",
  microgram: "microgram",
  nanogram: "nanogram",
  milliliter: "ml",
  litre: "L",
  liter: "L",
};

const normalizeWhitespace = (text) => text.replace(/\s+/g, " ").trim();

const shortenUnit = (unit) => UNIT_MAP[(unit || "").toLowerCase()] || unit;

const sentenceCaseFirst = (text) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : text;

export const shortenMedicationTerm = (term) => {
  if (!term || !term.startsWith("Product containing precisely ")) {
    return null;
  }

  let working = term.replace(/^Product containing precisely\s+/i, "").trim();

  // e.g. propranolol hydrochloride 20 milligram/1 each conventional release oral tablet
  working = working.replace(
    /^(.+?)\s+(\d+(?:\.\d+)?)\s+([A-Za-z]+)\/1 each\s+(.+)$/i,
    (_, drug, strength, unit, form) => {
      return `${drug} ${strength} ${shortenUnit(unit)} ${form}`;
    }
  );

  // e.g. urea 50 milligram/1 gram shampoo
  working = working.replace(
    /^(.+?)\s+(\d+(?:\.\d+)?)\s+([A-Za-z]+)\/1\s+([A-Za-z]+)\s+(.+)$/i,
    (_, drug, strength, unit1, unit2, form) => {
      return `${drug} ${strength} ${shortenUnit(unit1)}/${unit2.toLowerCase()} ${form}`;
    }
  );

  // e.g. castor oil 1 milliliter/1 milliliter oral liquid
  working = working.replace(
    /^(.+?)\s+(\d+(?:\.\d+)?)\s+([A-Za-z]+)\/(\d+(?:\.\d+)?)\s+([A-Za-z]+)\s+(.+)$/i,
    (_, drug, n1, unit1, _n2, unit2, form) => {
      return `${drug} ${n1} ${shortenUnit(unit1)}/${shortenUnit(unit2)} ${form}`;
    }
  );

  return sentenceCaseFirst(normalizeWhitespace(working));
};