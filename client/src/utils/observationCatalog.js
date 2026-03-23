export const SNOMED_SYSTEM = "http://snomed.info/sct";

export const OBSERVATION_PRESETS = {
  "Blood Pressure": {
    name: "Blood Pressure",
    code: "75367002",
    system: SNOMED_SYSTEM,
  },
  "Pulse": {
    name: "Pulse",
    code: "78564009",
    system: SNOMED_SYSTEM,
  },
  "Temperature": {
    name: "Temperature",
    code: "386725007",
    system: SNOMED_SYSTEM,
  },
  "Resp Rate": {
    name: "Resp Rate",
    code: "86290005",
    system: SNOMED_SYSTEM,
  },
  "Oxygen Sats": {
    name: "Oxygen Sats",
    code: "103228002",
    system: SNOMED_SYSTEM,
  },
  "AVPU": {
    name: "AVPU",
    code: "1104441000000107",
    system: SNOMED_SYSTEM,
  },
  "GCS": {
    name: "GCS",
    code: "444323003",
    system: SNOMED_SYSTEM,
  },
  "Weight": {
    name: "Weight",
    code: "27113001",
    system: SNOMED_SYSTEM,
  },
};

export const OBSERVATION_OPTIONS = Object.keys(OBSERVATION_PRESETS);

export const getObservationPreset = (value) => {
  return OBSERVATION_PRESETS[value] || null;
};

export const applyObservationPreset = (observation, selectedName) => {
  const preset = getObservationPreset(selectedName);

  if (!preset) {
    return {
      ...observation,
      name: selectedName,
    };
  }

  return {
    ...observation,
    name: preset.name,
    code: preset.code,
    system: preset.system,
  };
};