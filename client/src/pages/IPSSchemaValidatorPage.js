import React, { useState, useRef, useEffect } from 'react'
import { Container, Form, Button, Alert, Row, Col, ButtonGroup } from 'react-bootstrap'

export default function IPSchemaValidator() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const [mode, setMode] = useState('NPS') // 'NPS' | 'NHSSCR'
  const inputRef = useRef(null)

  const endpoint = mode === 'NHSSCR' ? '/ipsNhsScrVal' : '/ipsUniVal'

  const labels = mode === 'NHSSCR'
    ? {
      title: 'NHS SCR JSON Validator',
      helper: 'Paste your NHS SCR IPS Bundle here (you can also paste a single resource e.g. Patient)',
      schemaLabel: 'NHS SCR',
      resultValidKey: 'validNhsScr',
      resultErrorsKey: 'errorsNhsScr'
    }
    : {
      title: 'NPS JSON Validator',
      helper: 'Paste your NPS Bundle here (note, you can also paste a single resource e.g. Patient)',
      schemaLabel: 'NPS',
      resultValidKey: 'validNps',
      resultErrorsKey: 'errorsNps'
    }

  // Auto-load payload + mode when coming from APIGETPage
  useEffect(() => {
    try {
      const savedPayload = sessionStorage.getItem('ips:lastPayload');
      const savedMode = sessionStorage.getItem('ips:lastMode'); // "NPS" or "NHSSCR"

      if (savedMode) {
        setMode(savedMode);
        setResult(null);
      }
      if (savedPayload) {
        setInput(savedPayload);
        setResult(null);
      }
    } catch (e) {
      console.warn('Could not restore validator payload/mode:', e);
    }
  }, []);

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
      const resp = await fetch(endpoint, {
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
          // provide both possible result shapes so UI doesn't crash
          validNps: false,
          errorsNps: body.errors || [],
          validNhsScr: false,
          errorsNhsScr: body.errors || [],
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
        validNhsScr: false,
        errorsNhsScr: [],
        validFhirR4: false,
        errorsFhirR4: []
      })
    }
  }

  const schemaValid = result ? !!result[labels.resultValidKey] : false
  const schemaErrors = result ? (result[labels.resultErrorsKey] || []) : []

  return (
    <Container className="mt-4">
      <Row className="align-items-center">
        <Col>
          <h4 className="mb-0">{labels.title}</h4>
        </Col>
        <Col xs="auto">
          <ButtonGroup aria-label="Validator mode">
            <Button
              variant={mode === 'NPS' ? 'primary' : 'outline-primary'}
              onClick={() => {
                setMode('NPS')
                setResult(null)
              }}
            >
              NPS
            </Button>

            <Button
              variant={mode === 'NHSSCR' ? 'primary' : 'outline-primary'}
              onClick={() => {
                setMode('NHSSCR')
                setResult(null)
              }}
            >
              NHS SCR
            </Button>
          </ButtonGroup>
        </Col>
      </Row>

      <Form.Group controlId="jsonInput" className="mt-3">
        <Form.Label>{labels.helper}</Form.Label>
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

      <div className="mt-2 d-flex gap-2">
        <Button onClick={validate}>Validate</Button>
      </div>

      {result && (
        <>
          <Alert variant="secondary" className="mt-3">
            <div><strong>{labels.schemaLabel}:</strong> {schemaValid ? '✅ Valid' : '❌ Invalid'}</div>
            <div><strong>FHIR R4:</strong> {result.validFhirR4 ? '✅ Valid' : '❌ Invalid'}</div>
          </Alert>

          {(schemaValid && result.validFhirR4) ? (
            <Alert variant="success" className="mt-3">✅ Valid ({labels.schemaLabel} + FHIR R4)!</Alert>
          ) : (
            <Alert variant="danger" className="mt-3">
              <h5>Validation Errors</h5>

              {!schemaValid && (schemaErrors.length > 0) && (
                <>
                  <h6 className="mt-2">{labels.schemaLabel}</h6>
                  <ul>
                    {schemaErrors.map((err, i) => (
                      <li
                        key={`schema-${i}`}
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