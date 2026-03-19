import { useState, useRef, useEffect, useContext } from 'react'
import { Container, Form, Button, Alert, Row, Col, ButtonGroup } from 'react-bootstrap'
import { PatientContext } from '../PatientContext'

const MAX_RESTORE_CHARS = 300000
const MAX_VISIBLE_ERRORS = 100

export default function IPSchemaValidator() {
  const { setSelectedPatient } = useContext(PatientContext)

  const [result, setResult] = useState(null)
  const [mode, setMode] = useState('NPS') // 'NPS' | 'NHSSCR' | 'EPS'
  const [inputSize, setInputSize] = useState(0)
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [submitResult, setSubmitResult] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nhsScrLenient, setNhsScrLenient] = useState(false)

  const inputRef = useRef(null)

  const endpoint =
    mode === 'NHSSCR'
      ? '/ipsNhsScrVal'
      : mode === 'EPS'
        ? '/epsVal'
        : '/ipsUniVal'

  const labels =
    mode === 'NHSSCR'
      ? {
        title: 'NHS SCR JSON Validator',
        helper: 'Paste your NHS SCR IPS Bundle here (you can also paste a single resource e.g. Patient)',
        schemaLabel: 'NHS SCR',
        resultValidKey: 'validNhsScr',
        resultErrorsKey: 'errorsNhsScr'
      }
      : mode === 'EPS'
        ? {
          title: 'EPS JSON Validator',
          helper: 'Paste your EPS Bundle here (you can also paste a single resource e.g. Patient)',
          schemaLabel: 'EPS',
          resultValidKey: 'validEps',
          resultErrorsKey: 'errorsEps'
        }
        : {
          title: 'NPS JSON Validator',
          helper: 'Paste your NPS Bundle here (note, you can also paste a single resource e.g. Patient)',
          schemaLabel: 'NPS',
          resultValidKey: 'validNps',
          resultErrorsKey: 'errorsNps'
        }

  const safeParseJson = (text) => {
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  const normalizeErrorResult = (body, fallbackMessage = 'Validation failed') => ({
    valid: false,
    errors: body?.errors || [{ path: '', message: body?.message || fallbackMessage }],
    validNps: false,
    errorsNps: body?.errorsNps || body?.errors || [],
    validNhsScr: false,
    errorsNhsScr: body?.errorsNhsScr || body?.errors || [],
    validEps: false,
    errorsEps: body?.errorsEps || body?.errors || [],
    validFhirR4: body?.validFhirR4 || false,
    errorsFhirR4: body?.errorsFhirR4 || []
  })

  const getInputValue = () => inputRef.current?.value || ''

  useEffect(() => {
    try {
      const savedPayload = sessionStorage.getItem('ips:lastPayload')
      const savedMode = sessionStorage.getItem('ips:lastMode')

      if (savedMode === 'NPS' || savedMode === 'NHSSCR' || savedMode === 'EPS') {
        setMode(savedMode)
        setResult(null)
      }

      if (savedPayload) {
        if (savedPayload.length <= MAX_RESTORE_CHARS) {
          if (inputRef.current) {
            inputRef.current.value = savedPayload
          }
          setInputSize(savedPayload.length)
        } else {
          console.warn(`Skipped restoring validator payload: too large (${savedPayload.length} chars)`)
        }
        setResult(null)
      }
    } catch (e) {
      console.warn('Could not restore validator payload/mode:', e)
    }
  }, [])

  const jumpToPath = (path) => {
    const el = inputRef.current
    if (!el || !path) return

    try {
      const text = el.value || ''
      const segments = path.split('/').filter(Boolean)

      let pos = 0

      if (segments[0] === 'entry') {
        const entryIdx = parseInt(segments[1], 10)
        if (!Number.isInteger(entryIdx) || entryIdx < 0) return

        let matchPos = -1
        let start = 0

        for (let i = 0; i <= entryIdx; i++) {
          matchPos = text.indexOf('"resource":', start)
          if (matchPos === -1) return
          start = matchPos + 10
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
        if (!last) return
        const idx = text.indexOf(`"${last}"`)
        if (idx === -1) return
        pos = idx
      }

      el.focus()
      el.setSelectionRange(pos, Math.min(pos + 1, text.length))

      const before = text.substring(0, pos)
      const lineNumber = before.split('\n').length
      const lh = parseInt(window.getComputedStyle(el).lineHeight, 10) || 18
      el.scrollTop = Math.max(0, (lineNumber - 3) * lh)
    } catch (e) {
      console.warn('jumpToPath failed:', e)
    }
  }

  const validate = async () => {
    setResult(null)
    setSubmitResult(null)
    setShowAllErrors(false)

    const input = getInputValue()
    setInputSize(input.length)

    if (!input.trim()) {
      setResult(
        normalizeErrorResult(
          { message: 'Please paste some JSON before validating.' },
          'Please paste some JSON before validating.'
        )
      )
      return
    }

    const parsed = safeParseJson(input)
    if (!parsed) {
      setResult(
        normalizeErrorResult(
          { message: 'Input is not valid JSON.' },
          'Input is not valid JSON.'
        )
      )
      return
    }

    const validationUrl =
      mode === 'NHSSCR' && nhsScrLenient
        ? `${endpoint}?lenient=true`
        : endpoint

    try {
      const resp = await fetch(validationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: input
      })

      const rawText = await resp.text()
      const body = safeParseJson(rawText)

      if (resp.ok) {
        if (body) {
          setResult(body)
        } else {
          setResult(
            normalizeErrorResult(
              { message: 'Validator returned a non-JSON success response.' },
              'Validator returned a non-JSON success response.'
            )
          )
        }
      } else {
        setResult(
          normalizeErrorResult(
            body || { message: rawText || `Validation failed (${resp.status})` },
            body?.message || rawText || `Validation failed (${resp.status})`
          )
        )
      }
    } catch (err) {
      setResult(
        normalizeErrorResult(
          { message: 'Validation request failed: ' + (err?.message || 'Unknown error') },
          'Validation request failed'
        )
      )
    }
  }

  const addAsRecord = async () => {
    setSubmitResult(null)

    const input = getInputValue()
    setInputSize(input.length)

    if (!input.trim()) {
      setSubmitResult({
        ok: false,
        message: 'Please paste some JSON before submitting.'
      })
      return
    }

    const parsed = safeParseJson(input)
    if (!parsed) {
      setSubmitResult({
        ok: false,
        message: 'Input is not valid JSON.'
      })
      return
    }

    try {
      setIsSubmitting(true)

      const resp = await fetch('/ipsbundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: input
      })

      const rawText = await resp.text()
      const body = safeParseJson(rawText)

      if (!resp.ok) {
        setSubmitResult({
          ok: false,
          message: body?.message || rawText || `Failed to add record (${resp.status})`
        })
        return
      }

      if (!body || typeof body !== 'object') {
        setSubmitResult({
          ok: false,
          message: 'Record was submitted, but the server response was not valid JSON.'
        })
        return
      }

      setSelectedPatient(body)

      try {
        sessionStorage.setItem('ips:lastPayload', input)
        sessionStorage.setItem('ips:lastMode', mode)
      } catch (e) {
        console.warn('Could not persist validator payload/mode:', e)
      }

      setSubmitResult({
        ok: true,
        message: `Record added successfully${body?._id ? ` (ID: ${body._id})` : ''}. Current patient set to ${body?.patient?.given || ''} ${body?.patient?.name || ''}`.trim(),
        record: body
      })
    } catch (err) {
      setSubmitResult({
        ok: false,
        message: 'Submission failed: ' + (err?.message || 'Unknown error')
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const schemaValid = result ? !!result[labels.resultValidKey] : false
  const schemaErrors = result ? (result[labels.resultErrorsKey] || []) : []
  const fhirErrors = result ? (result.errorsFhirR4 || []) : []

  const visibleSchemaErrors = showAllErrors ? schemaErrors : schemaErrors.slice(0, MAX_VISIBLE_ERRORS)
  const visibleFhirErrors = showAllErrors ? fhirErrors : fhirErrors.slice(0, MAX_VISIBLE_ERRORS)

  const hiddenSchemaCount = Math.max(0, schemaErrors.length - visibleSchemaErrors.length)
  const hiddenFhirCount = Math.max(0, fhirErrors.length - visibleFhirErrors.length)

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
                setSubmitResult(null)
              }}
            >
              NPS
            </Button>

            <Button
              variant={mode === 'NHSSCR' ? 'primary' : 'outline-primary'}
              onClick={() => {
                setMode('NHSSCR')
                setResult(null)
                setSubmitResult(null)
              }}
            >
              NHS SCR
            </Button>

            <Button
              variant={mode === 'EPS' ? 'primary' : 'outline-primary'}
              onClick={() => {
                setMode('EPS')
                setResult(null)
                setSubmitResult(null)
              }}
            >
              EPS
            </Button>
          </ButtonGroup>
          {mode === 'NHSSCR' && (
            <Form.Check
              className="mt-3"
              type="switch"
              id="nhsscr-lenient-mode"
              label="Lenient NHS SCR validation (allow additional properties outside schema)"
              checked={nhsScrLenient}
              onChange={(e) => {
                setNhsScrLenient(e.target.checked)
                setResult(null)
                setSubmitResult(null)
              }}
            />
          )}
        </Col>
      </Row>

      <Form.Group controlId="jsonInput" className="mt-3">
        <Form.Label>
          {labels.helper}
          <div className="text-muted small mt-1">
            Size: {inputSize.toLocaleString()} characters
          </div>
        </Form.Label>

        <Form.Control
          as="textarea"
          rows={20}
          ref={inputRef}
          defaultValue=""
          onChange={(e) => setInputSize(e.target.value.length)}
          placeholder='{ "resourceType": "Bundle", ... }'
          className="resultTextArea"
          spellCheck={false}
        />
      </Form.Group>

      <div className="mt-2 d-flex gap-2">
        <Button onClick={validate}>Validate</Button>
        <Button
          variant="success"
          onClick={addAsRecord}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Adding...' : 'Add as Record'}
        </Button>
      </div>

      {submitResult && (
        <Alert variant={submitResult.ok ? 'success' : 'warning'} className="mt-3">
          <div><strong>{submitResult.ok ? 'Record Added' : 'Record Not Added'}</strong></div>
          <div>{submitResult.message}</div>
          {submitResult.ok && submitResult.record?._id && (
            <div className="mt-1">
              <strong>Mongo ID:</strong> {submitResult.record._id}
            </div>
          )}
          {submitResult.ok && submitResult.record?.packageUUID && (
            <div>
              <strong>Package UUID:</strong> {submitResult.record.packageUUID}
            </div>
          )}
        </Alert>
      )}

      {result && (
        <>
          <Alert variant="secondary" className="mt-3">
            <div><strong>{labels.schemaLabel}:</strong> {schemaValid ? '✅ Valid' : '❌ Invalid'}</div>
            <div><strong>FHIR R4:</strong> {result.validFhirR4 ? '✅ Valid' : '❌ Invalid'}</div>
            {mode === 'NHSSCR' && (
              <div><strong>Mode:</strong> {result.validationMode === 'lenient' ? 'Lenient' : 'Strict'}</div>
            )}
          </Alert>

          {(schemaValid && result.validFhirR4) ? (
            <Alert variant="success" className="mt-3">
              ✅ Valid ({labels.schemaLabel} + FHIR R4)!
            </Alert>
          ) : (
            <Alert variant="danger" className="mt-3">
              <h5>Validation Issues</h5>

              {!schemaValid && schemaErrors.length > 0 && (
                <>
                  <h6 className="mt-2">{labels.schemaLabel}</h6>
                  <ul>
                    {visibleSchemaErrors.map((err, i) => (
                      <li
                        key={`schema-${i}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => jumpToPath(err.path)}
                      >
                        <strong>{err.path || '/'}</strong>: {err.message}
                      </li>
                    ))}
                  </ul>
                  {hiddenSchemaCount > 0 && (
                    <div className="mb-2">
                      <em>{hiddenSchemaCount} more {labels.schemaLabel} errors hidden.</em>
                    </div>
                  )}
                </>
              )}

              {!result.validFhirR4 && fhirErrors.length > 0 && (
                <>
                  <h6 className="mt-2">FHIR R4</h6>
                  <ul>
                    {visibleFhirErrors.map((err, i) => (
                      <li
                        key={`fhir-${i}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => jumpToPath(err.path)}
                      >
                        <strong>{err.path || '/'}</strong>: {err.message}
                      </li>
                    ))}
                  </ul>
                  {hiddenFhirCount > 0 && (
                    <div className="mb-2">
                      <em>{hiddenFhirCount} more FHIR R4 errors hidden.</em>
                    </div>
                  )}
                </>
              )}

              {(hiddenSchemaCount > 0 || hiddenFhirCount > 0) && (
                <Button
                  variant="outline-light"
                  size="sm"
                  onClick={() => setShowAllErrors(true)}
                >
                  Show all errors
                </Button>
              )}
            </Alert>
          )}
        </>
      )}
    </Container>
  )
}