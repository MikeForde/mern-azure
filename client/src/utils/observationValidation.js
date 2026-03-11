// client/src/utils/observationValidation.js

export function isValidObservationValue(rawValue) {
  if (rawValue === null || rawValue === undefined) return true;

  const value = String(rawValue).trim();
  if (!value) return true;

  // If it does not start with a digit, leave it alone.
  // This keeps values like "A+", "Positive", "Alert", etc. valid.
  if (!/^\d/.test(value)) return true;

  // Accept:
  // - plain numeric values: 0.44
  // - numeric range: 120-80
  // - number + unit: 11 g/dl
  // - number + scientific-style unit text: 4.8 10*12/L
  // - number + percent: 9 %
  //
  // Rules:
  // - first numeric part required
  // - optional "-secondnumber"
  // - optional " space + unit text"
  // - unit text may include letters, digits, %, /, *, ., ^, -, parentheses
  const obsPattern = /^\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?(?:\s+[A-Za-z0-9%/.*^()[\]-]+)?$/;

  return obsPattern.test(value);
}

export function getObservationValueError(value) {
  if (isValidObservationValue(value)) return "";

  return 'Observation value is invalid. Examples: "60 bpm", "120-80 mmHg", "37.5 C", "4.8 10*12/L", "0.44"';
}