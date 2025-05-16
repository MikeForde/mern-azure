import React, { useState, useEffect, useRef } from 'react'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { Container, Form, Button, Alert } from 'react-bootstrap'

export default function IPSchemaValidator() {
  const [schemas, setSchemas] = useState({})
  const [input, setInput] = useState('')
  const [errors, setErrors] = useState(null)
  const inputRef = useRef(null)

  // Load schemas keyed by resourceType
  useEffect(() => {
    const names = [
      'Bundle','Patient','Organization',
      'MedicationRequest','Medication',
      'AllergyIntolerance','Condition','Observation'
    ]
    Promise.all(
      names.map(name =>
        fetch(`/ipsdef/${name}.schema.json`)
          .then(r => r.json())
          .then(js => ([name, js]))
      )
    ).then(pairs => setSchemas(Object.fromEntries(pairs)))
     .catch(console.error)
  }, [])

  const jumpToPath = (path) => {
    const el = inputRef.current;
    if (!el || !path) return;
    const text = el.value;
  
    // split and ignore leading empty
    const segments = path.split('/').filter(Boolean);
  
    let pos = 0;
    if (segments[0] === 'entry') {
      // e.g. [ 'entry','3','resource','Patient','code','coding', '0','system' ]
      const entryIdx = parseInt(segments[1], 10);
      // find the (entryIdx+1)th occurrence of `"resource":`
      let matchPos = -1, start = 0;
      for (let i = 0; i <= entryIdx; i++) {
        matchPos = text.indexOf('"resource":', start);
        if (matchPos === -1) return;
        start = matchPos + 1;
      }
      pos = matchPos;
  
      // now walk further into nested property names if provided
      // skip 'entry','N','resource','<Type>' => start at segments[3]
      for (let i = 3; i < segments.length; i++) {
        const prop = segments[i];
        const look = `"${prop}"`;
        const nextPos = text.indexOf(look, pos);
        if (nextPos === -1) break;
        pos = nextPos;
      }
    } else {
      // fallback: point to the last segment globally
      const last = segments[segments.length - 1];
      const idx = text.indexOf(`"${last}"`);
      if (idx === -1) return;
      pos = idx;
    }
  
    // focus, select, and scroll
    el.focus();
    el.setSelectionRange(pos, pos + 1);
    const before = text.substring(0, pos);
    const lineNumber = before.split('\n').length;
    const lh = parseInt(window.getComputedStyle(el).lineHeight, 10) || 18;
    el.scrollTop = (lineNumber - 1) * lh;
  }
  

  const validate = () => {
    setErrors(null)
    let obj
    try {
      obj = JSON.parse(input)
    } catch (err) {
      return setErrors([{ path: '', message: 'Invalid JSON: ' + err.message }])
    }

    // unwrap entry-wrapper
    if (!obj.resourceType && obj.resource?.resourceType) {
      obj = obj.resource
    }

    const ajv = new Ajv({ allErrors: true, strict: false })
    addFormats(ajv)
    // register each schema under its resourceType
    Object.entries(schemas).forEach(([name, schema]) => {
      ajv.addSchema(schema, name)
    })

    const topType = obj.resourceType
    if (!topType || !schemas[topType]) {
      return setErrors([{ path: '', message: `Unknown resourceType "${topType}"` }])
    }

    const allErrors = []

    if (topType === 'Bundle') {
      // 1) Validate envelope
      const bundleSchema = schemas['Bundle']
      const envelopeSchema = JSON.parse(JSON.stringify(bundleSchema))
      delete envelopeSchema.$id
      envelopeSchema.properties.entry.items.properties.resource = { type: 'object' }
      if (!ajv.validate(envelopeSchema, obj)) {
        (ajv.errors || []).forEach(e =>
          allErrors.push({ path: e.instancePath, message: e.message })
        )
      }
      // 2) Validate each entry.resource
      obj.entry?.forEach((en, idx) => {
        const res = en.resource
        const schemaName = res?.resourceType
        if (!schemaName || !schemas[schemaName]) {
          allErrors.push({
            path: `/entry/${idx}/resource/${schemaName}`,
            message: `Unknown or missing resourceType`
          })
        } else if (!ajv.validate(schemaName, res)) {
          (ajv.errors || []).forEach(e =>
            allErrors.push({
              path: `/entry/${idx}/resource/${schemaName}${e.instancePath}`,
              message: e.message
            })
          )
        }
      })
    } else {
      // single resource validation
      ajv.validate(topType, obj)
      ;(ajv.errors || []).forEach(e =>
        allErrors.push({ path: e.instancePath, message: e.message })
      )
    }

    setErrors(allErrors)
  }

  return (
    <Container className="mt-4">
      <h4>IPS Unified JSON Validator</h4>
      <Form.Group controlId="jsonInput">
        <Form.Label>Paste either whole Bundle or Single Resources here (JSON format)</Form.Label>
        <Form.Control
          className="text-area"
          as="textarea"
          rows={20}
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder='{ "resourceType": "Bundle", ... }'
        />
      </Form.Group>
      <Button className="mt-2" onClick={validate}>Validate</Button>

      {errors && (
        errors.length === 0
          ? <Alert variant="success" className="mt-3">✅ Valid!</Alert>
          : <Alert variant="danger" className="mt-3">
              <h5>Validation Errors</h5>
              <ul>
                {errors.map((err, i) => (
                  <li
                    key={i}
                    style={{ cursor: 'pointer' }}
                    onClick={() => jumpToPath(err.path)}
                  >
                    <strong>{err.path || '/'}</strong>: {err.message}
                  </li>
                ))}
              </ul>
            </Alert>
      )}
    </Container>
  )
}
