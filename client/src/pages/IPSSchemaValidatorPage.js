import React, { useState, useRef } from 'react'
import { Container, Form, Button, Alert } from 'react-bootstrap'

export default function IPSchemaValidator() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const inputRef = useRef(null)

  const jumpToPath = (path) => {
    const el = inputRef.current
    if (!el || !path) return
    const text = el.value
    const segments = path.split('/').filter(Boolean)

    let pos = 0
    if (segments[0] === 'entry') {
      const entryIdx = parseInt(segments[1], 10)
      let matchPos = -1, start = 0
      for (let i = 0; i <= entryIdx; i++) {
        matchPos = text.indexOf('"resource":', start)
        if (matchPos === -1) return
        start = matchPos + 1
      }
      pos = matchPos
      for (let i = 3; i < segments.length; i++) {
        const look = `"${segments[i]}"`
        const nextPos = text.indexOf(look, pos)
        if (nextPos === -1) break
        pos = nextPos
      }
    } else {
      const last = segments[segments.length - 1]
      const idx = text.indexOf(`"${last}"`)
      if (idx === -1) return
      pos = idx
    }

    el.focus()
    el.setSelectionRange(pos, pos + 1)
    const before = text.substring(0, pos)
    const lineNumber = before.split('\n').length
    const lh = parseInt(window.getComputedStyle(el).lineHeight, 10) || 18
    el.scrollTop = (lineNumber - 1) * lh
  }

  const validate = async () => {
    setResult(null)
    try {
      // send raw JSON text directly
      const resp = await fetch('/ipsUniVal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: input
      })
      const body = await resp.json()
      if (resp.ok) {
        setResult(body)
      } else {
        // backend returned 400 for missing resourceType, etc
        setResult({
          valid: false,
          errors: body.errors || [{ path: '', message: body.message || 'Validation failed' }],
          validNps: false,
          errorsNps: body.errors || [],
          validFhirR4: false,
          errorsFhirR4: []
        })
      }
    } catch (err) {
      setResult({
        valid: false,
        errors: [{ path: '', message: 'Validation request failed: ' + err.message }],
        validNps: false,
        errorsNps: [],
        validFhirR4: false,
        errorsFhirR4: []
      })
    }
  }

  return (
    <Container className="mt-4">
      <h4>NPS JSON Validator</h4>
      <Form.Group controlId="jsonInput">
        <Form.Label>Paste your NPS Bundle here (note, you can also paste a single resource e.g. Patient)</Form.Label>
        <Form.Control
          as="textarea"
          rows={20}
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder='{ "resourceType": "Bundle", ... }'
          className="resultTextArea"
        />
      </Form.Group>
      <Button className="mt-2" onClick={validate}>Validate</Button>

      {result && (
        <>
          <Alert variant="secondary" className="mt-3">
            <div><strong>NPS:</strong> {result.validNps ? '✅ Valid' : '❌ Invalid'}</div>
            <div><strong>FHIR R4:</strong> {result.validFhirR4 ? '✅ Valid' : '❌ Invalid'}</div>
          </Alert>

          {(result.validNps && result.validFhirR4) ? (
            <Alert variant="success" className="mt-3">✅ Valid (NPS + FHIR R4)!</Alert>
          ) : (
            <Alert variant="danger" className="mt-3">
              <h5>Validation Errors</h5>

              {!result.validNps && (result.errorsNps?.length > 0) && (
                <>
                  <h6 className="mt-2">NPS</h6>
                  <ul>
                    {result.errorsNps.map((err, i) => (
                      <li
                        key={`nps-${i}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => jumpToPath(err.path)}
                      >
                        <strong>{err.path || '/'}</strong>: {err.message}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {!result.validFhirR4 && (result.errorsFhirR4?.length > 0) && (
                <>
                  <h6 className="mt-2">FHIR R4</h6>
                  <ul>
                    {result.errorsFhirR4.map((err, i) => (
                      <li
                        key={`fhir-${i}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => jumpToPath(err.path)}
                      >
                        <strong>{err.path || '/'}</strong>: {err.message}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Alert>
          )}
        </>
      )}
    </Container>
  )
}
