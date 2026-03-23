// client/src/utils/immunizationTermShortener.js

const normalizeWhitespace = (text) => text.replace(/\s+/g, " ").trim();

const sentenceCaseFirst = (text) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : text;

export const shortenImmunizationTerm = (term) => {
  if (!term) return null;

  let working = term.trim();

  if (/^Vaccine product containing only\s+/i.test(working)) {
    working = working.replace(/^Vaccine product containing only\s+/i, "").trim();
    return sentenceCaseFirst(normalizeWhitespace(`${working} vaccine`));
  }

  if (/^Vaccine product containing\s+/i.test(working)) {
    working = working.replace(/^Vaccine product containing\s+/i, "").trim();
    return sentenceCaseFirst(normalizeWhitespace(`${working} vaccine`));
  }

  return null;
};