// servercontrollers/servercontrollerfuncs.js

// Helper function to recursively simplify the XML-to-JSON structure.
// This converts nodes like <type value="document"/> from
// { "$": { "value": "document" } } (or an array with a single element)
// to simply "document". It also removes any "xmlns" attribute.
function simplify(obj) {
  if (Array.isArray(obj)) {
    if (obj.length === 1) {
      return simplify(obj[0]);
    }
    return obj.map(simplify);
  } else if (typeof obj === 'object' && obj !== null) {
    // If the object has a "$" key, remove the "xmlns" attribute if present.
    if (obj.hasOwnProperty('$') && typeof obj['$'] === 'object') {
      if (obj['$'].hasOwnProperty('xmlns')) {
        delete obj['$'].xmlns;
      }
      // If the "$" object becomes empty, remove it.
      if (Object.keys(obj['$']).length === 0) {
        delete obj['$'];
      }
    }
    // If the object only has a "$" key, return its value (if present)
    if (Object.keys(obj).length === 1 && obj.hasOwnProperty('$')) {
      if (obj['$'] && obj['$'].hasOwnProperty('value')) {
        return obj['$'].value;
      }
      return obj['$'];
    }
    const newObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        newObj[key] = simplify(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

// Convert FHIR XML JSON to our desired output.
// If the object is a wrapper with a single key (e.g., { "Bundle": { ... } }),
// then that key is used as the resourceType and its contents are merged.
function isPlainObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

/**
 * Unwrap either:
 *
 *   { Bundle: { ... } }
 *
 * into:
 *
 *   { resourceType: "Bundle", ... }
 *
 * or:
 *
 *   { root: { resourceType: "Bundle", ... } }
 *
 * into the contents of root.
 */
function unwrapFhirResource(value) {
  if (!isPlainObject(value)) {
    return value;
  }

  const keys = Object.keys(value);

  if (keys.length !== 1) {
    return value;
  }

  const wrapperName = keys[0];
  const wrapperContent = value[wrapperName];

  // Never spread primitive values such as meta.profile strings.
  if (!isPlainObject(wrapperContent)) {
    return value;
  }

  // Handle XML shaped as:
  // <root>
  //   <resourceType>Bundle</resourceType>
  //   ...
  // </root>
  if (
    wrapperName === 'root' &&
    typeof wrapperContent.resourceType === 'string'
  ) {
    return wrapperContent;
  }

  // Handle normal FHIR XML wrappers such as:
  // <Bundle>...</Bundle>
  // <Patient>...</Patient>
  if (/^[A-Z][A-Za-z0-9]*$/.test(wrapperName)) {
    return {
      resourceType: wrapperName,
      ...wrapperContent
    };
  }

  return value;
}

function convertFhirXmlJson(obj) {
  const simplified = simplify(obj);

  function convert(value, mayBeResourceWrapper = false) {
    if (Array.isArray(value)) {
      return value.map(item => convert(item, mayBeResourceWrapper));
    }

    if (!isPlainObject(value)) {
      return value;
    }

    const current = mayBeResourceWrapper
      ? unwrapFhirResource(value)
      : value;

    const result = {};

    for (const [key, child] of Object.entries(current)) {
      if (key === 'resource') {
        if (Array.isArray(child)) {
          result[key] = child.map(item => convert(item, true));
        } else {
          result[key] = convert(child, true);
        }
      } else {
        result[key] = convert(child, false);
      }
    }

    return result;
  }

  // Only the top-level object and objects inside "resource"
  // may be FHIR resource wrappers.
  return convert(simplified, true);
}

// Helper to ensure that specific fields (e.g., "coding", "name", "given")
// are always arrays.
function ensureArrayForFields(obj, fields) {
  if (Array.isArray(obj)) {
    return obj.map(item => ensureArrayForFields(item, fields));
  } else if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (fields.includes(key)) {
          // Wrap the value in an array if it isn't already
          obj[key] = Array.isArray(obj[key]) ? obj[key] : [obj[key]];
        }
        // Recursively ensure subfields are processed
        obj[key] = ensureArrayForFields(obj[key], fields);
      }
    }
  }
  return obj;
}

// Revised objectToHtml function that wraps each array item as its own tag.
function objectToHtml(tag, content) {
  if (Array.isArray(content)) {
    // Each element gets its own tag.
    return content.map(item => objectToHtml(tag, item)).join("");
  } else if (typeof content === 'object' && content !== null) {
    let innerHtml = "";
    for (const childTag in content) {
      if (content.hasOwnProperty(childTag)) {
        innerHtml += objectToHtml(childTag, content[childTag]);
      }
    }
    return `<${tag}>${innerHtml}</${tag}>`;
  } else {
    // For primitive types, simply wrap them.
    return `<${tag}>${content}</${tag}>`;
  }
}

// Process "text" fields to reassemble inner HTML. If a "text" field has a "div" property,
// convert that property into an HTML string.
function processTextFields(obj) {
  if (Array.isArray(obj)) {
    return obj.map(processTextFields);
  } else if (typeof obj === 'object' && obj !== null) {
    if (obj.hasOwnProperty("text") && typeof obj.text === "object" && obj.text !== null) {
      if (obj.text.hasOwnProperty("div")) {
        obj.text.div = objectToHtml("div", obj.text.div);
      }
    }
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        obj[key] = processTextFields(obj[key]);
      }
    }
  }
  return obj;
}

// Main function to convert FHIR XML JSON to IPS JSON.
function convertFhirXmlToJson(xmlJson) {
  let fhirJson = convertFhirXmlJson(xmlJson);
  fhirJson = ensureArrayForFields(fhirJson, ['coding', 'name', 'given']);
  fhirJson = processTextFields(fhirJson);
  return fhirJson;
}

module.exports = {
  convertFhirXmlToJson,
  simplify,
  convertFhirXmlJson,
  ensureArrayForFields,
  objectToHtml,
  processTextFields,
  isPlainObject,
  unwrapFhirResource
};
