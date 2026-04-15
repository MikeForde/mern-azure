import { useState, useRef, useEffect, useContext } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Container, Form, Button, Alert, Row, Col, ButtonGroup } from 'react-bootstrap'
import { PatientContext } from '../PatientContext'

const MAX_RESTORE_CHARS = 300000
const MAX_VISIBLE_ERRORS = 100
const MODE_NPS = 'NPS'
const MODE_NPS_NFC = 'NPSNFC'
const MODE_NHS_SCR = 'NHSSCR'
const MODE_EPS = 'EPS'
const SPLIT_PART_RO = 'RO'
const SPLIT_PART_RW = 'RW'
const MODE_TO_QUERY = {
  [MODE_NPS]: 'nps',
  [MODE_NPS_NFC]: 'npsnfc',
  [MODE_NHS_SCR]: 'nhsscr',
  [MODE_EPS]: 'eps'
}
const QUERY_TO_MODE = Object.fromEntries(
  Object.entries(MODE_TO_QUERY).map(([mode, query]) => [query, mode])
)

const getModeFromQuery = (value) => QUERY_TO_MODE[String(value || '').trim().toLowerCase()] || null

export default function IPSchemaValidator() {
  const { setSelectedPatient } = useContext(PatientContext)
  const [searchParams, setSearchParams] = useSearchParams()

  const [result, setResult] = useState(null)
  const [mode, setMode] = useState(MODE_NPS)
  const [inputSizes, setInputSizes] = useState({ main: 0, ro: 0, rw: 0 })
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [submitResult, setSubmitResult] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nhsScrLenient, setNhsScrLenient] = useState(false)

  const inputRef = useRef(null)
  const roInputRef = useRef(null)
  const rwInputRef = useRef(null)
  const pendingSplitRestoreRef = useRef(null)

  const isSplitMode = mode === MODE_NPS_NFC
  const requestedMode = getModeFromQuery(searchParams.get('mode'))

  const endpoint =
    mode === MODE_NHS_SCR
      ? '/ipsNhsScrVal'
      : mode === MODE_EPS
        ? '/epsVal'
        : '/ipsUniVal'

  const labels =
    mode === MODE_NHS_SCR
      ? {
        title: 'NHS SCR JSON Validator',
        helper: 'Paste your NHS SCR IPS Bundle here (you can also paste a single resource e.g. Patient)',
        schemaLabel: 'NHS SCR',
        resultValidKey: 'validNhsScr',
        resultErrorsKey: 'errorsNhsScr'
      }
      : mode === MODE_EPS
        ? {
          title: 'EPS JSON Validator',
          helper: 'Paste your EPS Bundle here (you can also paste a single resource e.g. Patient)',
          schemaLabel: 'EPS',
          resultValidKey: 'validEps',
          resultErrorsKey: 'errorsEps'
        }
        : mode === MODE_NPS_NFC
          ? {
            title: 'NPS NFC JSON Validator',
            helper: 'Paste the Read Only (historical) and Read/Write (operational) NPS bundles here. They will be combined into one bundle before validation.',
            schemaLabel: 'NPS NFC',
            resultValidKey: 'validNps',
            resultErrorsKey: 'errorsNps'
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

  const buildClientValidationResult = ({ schemaErrors = [], fhirErrors = [], extra = {} } = {}) => ({
    valid: schemaErrors.length === 0 && fhirErrors.length === 0,
    errors: [...schemaErrors, ...fhirErrors],
    validNps: schemaErrors.length === 0,
    errorsNps: schemaErrors,
    validNhsScr: schemaErrors.length === 0,
    errorsNhsScr: schemaErrors,
    validEps: schemaErrors.length === 0,
    errorsEps: schemaErrors,
    validFhirR4: fhirErrors.length === 0,
    errorsFhirR4: fhirErrors,
    ...extra
  })

  const getInputRef = (part = 'main') => {
    if (part === SPLIT_PART_RO) return roInputRef
    if (part === SPLIT_PART_RW) return rwInputRef
    return inputRef
  }

  const getInputValue = (part = 'main') => getInputRef(part).current?.value || ''

  const setModeAndReset = (nextMode, syncQuery = true) => {
    setMode(nextMode)
    setResult(null)
    setSubmitResult(null)
    setShowAllErrors(false)

    if (syncQuery) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('mode', MODE_TO_QUERY[nextMode])
      setSearchParams(nextParams)
    }
  }

  const updateMainInputSize = (value) => setInputSizes((prev) => ({ ...prev, main: value.length }))
  const updateSplitInputSize = (part, value) => {
    setInputSizes((prev) => ({
      ...prev,
      [part === SPLIT_PART_RO ? 'ro' : 'rw']: value.length
    }))
  }

  const buildSplitValidationError = (errors) => buildClientValidationResult({
    schemaErrors: errors,
    extra: { validFhirR4: false }
  })

  const preparePayload = () => {
    if (!isSplitMode) {
      const input = getInputValue()
      updateMainInputSize(input)

      if (!input.trim()) {
        return {
          ok: false,
          validationResult: normalizeErrorResult(
            { message: 'Please paste some JSON before validating.' },
            'Please paste some JSON before validating.'
          ),
          submitMessage: 'Please paste some JSON before submitting.'
        }
      }

      const parsed = safeParseJson(input)
      if (!parsed) {
        return {
          ok: false,
          validationResult: normalizeErrorResult(
            { message: 'Input is not valid JSON.' },
            'Input is not valid JSON.'
          ),
          submitMessage: 'Input is not valid JSON.'
        }
      }

      return {
        ok: true,
        payloadJson: input,
        parsed,
        persistPayload: input
      }
    }

    const roInput = getInputValue(SPLIT_PART_RO)
    const rwInput = getInputValue(SPLIT_PART_RW)
    updateSplitInputSize(SPLIT_PART_RO, roInput)
    updateSplitInputSize(SPLIT_PART_RW, rwInput)

    const schemaErrors = []

    if (!roInput.trim()) {
      schemaErrors.push({
        path: '/',
        message: 'Read Only input is empty.',
        sourcePart: SPLIT_PART_RO,
        displayPath: '/',
        jumpPath: '/',
        jumpPart: SPLIT_PART_RO
      })
    }

    if (!rwInput.trim()) {
      schemaErrors.push({
        path: '/',
        message: 'Read/Write input is empty.',
        sourcePart: SPLIT_PART_RW,
        displayPath: '/',
        jumpPath: '/',
        jumpPart: SPLIT_PART_RW
      })
    }

    if (schemaErrors.length > 0) {
      return {
        ok: false,
        validationResult: buildSplitValidationError(schemaErrors),
        submitMessage: 'Please paste both Read Only and Read/Write JSON bundles before submitting.'
      }
    }

    const roParsed = safeParseJson(roInput)
    if (!roParsed) {
      return {
        ok: false,
        validationResult: buildSplitValidationError([{
          path: '/',
          message: 'Read Only input is not valid JSON.',
          sourcePart: SPLIT_PART_RO,
          displayPath: '/',
          jumpPath: '/',
          jumpPart: SPLIT_PART_RO
        }]),
        submitMessage: 'Read Only input is not valid JSON.'
      }
    }

    const rwParsed = safeParseJson(rwInput)
    if (!rwParsed) {
      return {
        ok: false,
        validationResult: buildSplitValidationError([{
          path: '/',
          message: 'Read/Write input is not valid JSON.',
          sourcePart: SPLIT_PART_RW,
          displayPath: '/',
          jumpPath: '/',
          jumpPart: SPLIT_PART_RW
        }]),
        submitMessage: 'Read/Write input is not valid JSON.'
      }
    }

    if (roParsed.resourceType !== 'Bundle') {
      return {
        ok: false,
        validationResult: buildSplitValidationError([{
          path: '/resourceType',
          message: 'Read Only input must be a FHIR Bundle.',
          sourcePart: SPLIT_PART_RO,
          displayPath: '/resourceType',
          jumpPath: '/resourceType',
          jumpPart: SPLIT_PART_RO
        }]),
        submitMessage: 'Read Only input must be a FHIR Bundle.'
      }
    }

    if (rwParsed.resourceType !== 'Bundle') {
      return {
        ok: false,
        validationResult: buildSplitValidationError([{
          path: '/resourceType',
          message: 'Read/Write input must be a FHIR Bundle.',
          sourcePart: SPLIT_PART_RW,
          displayPath: '/resourceType',
          jumpPath: '/resourceType',
          jumpPart: SPLIT_PART_RW
        }]),
        submitMessage: 'Read/Write input must be a FHIR Bundle.'
      }
    }

    const roEntries = Array.isArray(roParsed.entry) ? roParsed.entry : []
    const rwEntries = Array.isArray(rwParsed.entry) ? rwParsed.entry : []
    const combined = {
      ...roParsed,
      ...rwParsed,
      resourceType: 'Bundle',
      id: roParsed.id || rwParsed.id,
      identifier: roParsed.identifier || rwParsed.identifier,
      meta: roParsed.meta || rwParsed.meta,
      implicitRules: roParsed.implicitRules || rwParsed.implicitRules,
      language: roParsed.language || rwParsed.language,
      type: roParsed.type || rwParsed.type || 'document',
      timestamp: rwParsed.timestamp || roParsed.timestamp,
      total: roEntries.length + rwEntries.length,
      entry: [...roEntries, ...rwEntries]
    }

    return {
      ok: true,
      payloadJson: JSON.stringify(combined),
      parsed: combined,
      persistPayload: JSON.stringify({ type: 'split', ro: roInput, rw: rwInput }),
      splitMeta: {
        roCount: roEntries.length,
        rwCount: rwEntries.length,
        topLevelSources: {
          id: roParsed.id ? SPLIT_PART_RO : (rwParsed.id ? SPLIT_PART_RW : SPLIT_PART_RO),
          identifier: roParsed.identifier ? SPLIT_PART_RO : (rwParsed.identifier ? SPLIT_PART_RW : SPLIT_PART_RO),
          meta: roParsed.meta ? SPLIT_PART_RO : (rwParsed.meta ? SPLIT_PART_RW : SPLIT_PART_RO),
          implicitRules: roParsed.implicitRules ? SPLIT_PART_RO : (rwParsed.implicitRules ? SPLIT_PART_RW : SPLIT_PART_RO),
          language: roParsed.language ? SPLIT_PART_RO : (rwParsed.language ? SPLIT_PART_RW : SPLIT_PART_RO),
          type: roParsed.type ? SPLIT_PART_RO : (rwParsed.type ? SPLIT_PART_RW : SPLIT_PART_RO),
          timestamp: rwParsed.timestamp ? SPLIT_PART_RW : SPLIT_PART_RO,
          total: SPLIT_PART_RO,
          entry: SPLIT_PART_RO
        }
      }
    }
  }

  const getSplitEntryInfo = (path, message) => {
    const pathMatch = String(path || '').match(/^\/entry\/(\d+)(\/.*)?$/)
    if (pathMatch) {
      return {
        entryIndex: parseInt(pathMatch[1], 10),
        remainder: pathMatch[2] || ''
      }
    }

    const messageMatch = String(message || '').match(/\bin entry\[(\d+)\]/)
    if (messageMatch) {
      return {
        entryIndex: parseInt(messageMatch[1], 10),
        remainder: ''
      }
    }

    return null
  }

  const decorateSplitError = (err, splitMeta) => {
    const entryInfo = getSplitEntryInfo(err?.path, err?.message)

    if (entryInfo) {
      const isRoEntry = entryInfo.entryIndex < splitMeta.roCount
      const sourcePart = isRoEntry ? SPLIT_PART_RO : SPLIT_PART_RW
      const localIndex = isRoEntry ? entryInfo.entryIndex : entryInfo.entryIndex - splitMeta.roCount
      const localPath = `/entry/${localIndex}${entryInfo.remainder}`

      return {
        ...err,
        sourcePart,
        displayPath: localPath,
        jumpPath: localPath,
        jumpPart: sourcePart
      }
    }

    const topLevelKey = String(err?.path || '').split('/').filter(Boolean)[0]
    const sourcePart = splitMeta.topLevelSources[topLevelKey] || SPLIT_PART_RO

    return {
      ...err,
      sourcePart,
      displayPath: err?.path || '/',
      jumpPath: err?.path || '/',
      jumpPart: sourcePart
    }
  }

  const decorateSplitResult = (body, splitMeta) => {
    const errorsNps = (body?.errorsNps || []).map((err) => decorateSplitError(err, splitMeta))
    const errorsFhirR4 = (body?.errorsFhirR4 || []).map((err) => decorateSplitError(err, splitMeta))

    return {
      ...body,
      errorsNps,
      errorsFhirR4,
      errors: [...errorsNps, ...errorsFhirR4]
    }
  }

  useEffect(() => {
    try {
      const savedPayload = sessionStorage.getItem('ips:lastPayload')
      const savedMode = sessionStorage.getItem('ips:lastMode')

      if (savedMode === MODE_NPS || savedMode === MODE_NPS_NFC || savedMode === MODE_NHS_SCR || savedMode === MODE_EPS) {
        setMode(savedMode)
        setResult(null)
      }

      if (savedPayload) {
        if (savedPayload.length <= MAX_RESTORE_CHARS) {
          if (savedMode === MODE_NPS_NFC) {
            const parsedPayload = safeParseJson(savedPayload)
            pendingSplitRestoreRef.current = parsedPayload
          } else if (inputRef.current) {
            inputRef.current.value = savedPayload
            setInputSizes((prev) => ({ ...prev, main: savedPayload.length }))
          }
        } else {
          console.warn(`Skipped restoring validator payload: too large (${savedPayload.length} chars)`)
        }
        setResult(null)
      }
    } catch (e) {
      console.warn('Could not restore validator payload/mode:', e)
    }
  }, [])

  useEffect(() => {
    if (requestedMode && requestedMode !== mode) {
      setMode(requestedMode)
      setResult(null)
      setSubmitResult(null)
      setShowAllErrors(false)
    }
  }, [mode, requestedMode])

  useEffect(() => {
    if (mode !== MODE_NPS_NFC || !pendingSplitRestoreRef.current) return

    const parsedPayload = pendingSplitRestoreRef.current

    if (roInputRef.current && typeof parsedPayload?.ro === 'string') {
      roInputRef.current.value = parsedPayload.ro
    }

    if (rwInputRef.current && typeof parsedPayload?.rw === 'string') {
      rwInputRef.current.value = parsedPayload.rw
    }

    setInputSizes({
      main: 0,
      ro: typeof parsedPayload?.ro === 'string' ? parsedPayload.ro.length : 0,
      rw: typeof parsedPayload?.rw === 'string' ? parsedPayload.rw.length : 0
    })

    pendingSplitRestoreRef.current = null
  }, [mode])

  const jumpToPath = (path, part = 'main') => {
    const el = getInputRef(part).current
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

    const prepared = preparePayload()
    if (!prepared.ok) {
      setResult(prepared.validationResult)
      return
    }

    const validationUrl =
      mode === MODE_NHS_SCR && nhsScrLenient
        ? `${endpoint}?lenient=true`
        : endpoint

    try {
      const resp = await fetch(validationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: prepared.payloadJson
      })

      const rawText = await resp.text()
      const body = safeParseJson(rawText)

      if (resp.ok) {
        if (body) {
          setResult(isSplitMode ? decorateSplitResult(body, prepared.splitMeta) : body)
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

    const prepared = preparePayload()
    if (!prepared.ok) {
      setSubmitResult({
        ok: false,
        message: prepared.submitMessage
      })
      return
    }

    try {
      setIsSubmitting(true)

      const resp = await fetch('/ipsbundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: prepared.payloadJson
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
        sessionStorage.setItem('ips:lastPayload', prepared.persistPayload)
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
              variant={mode === MODE_NPS ? 'primary' : 'outline-primary'}
              onClick={() => setModeAndReset(MODE_NPS)}
            >
              NPS
            </Button>

            <Button
              variant={mode === MODE_NPS_NFC ? 'primary' : 'outline-primary'}
              onClick={() => setModeAndReset(MODE_NPS_NFC)}
            >
              NPS NFC
            </Button>

            <Button
              variant={mode === MODE_NHS_SCR ? 'primary' : 'outline-primary'}
              onClick={() => setModeAndReset(MODE_NHS_SCR)}
            >
              NHS SCR
            </Button>

            <Button
              variant={mode === MODE_EPS ? 'primary' : 'outline-primary'}
              onClick={() => setModeAndReset(MODE_EPS)}
            >
              EPS
            </Button>
          </ButtonGroup>
          {mode === MODE_NHS_SCR && (
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

      {isSplitMode ? (
        <>
          <div className="mt-3">
            <div>{labels.helper}</div>
            <div className="text-muted small mt-1">
              Combined size: {(inputSizes.ro + inputSizes.rw).toLocaleString()} characters
            </div>
          </div>

          <Row className="mt-2">
            <Col md={6}>
              <Form.Group controlId="jsonInputRo">
                <Form.Label>
                  Read Only (RO) - historical data
                  <div className="text-muted small mt-1">
                    Size: {inputSizes.ro.toLocaleString()} characters
                  </div>
                </Form.Label>

                <Form.Control
                  as="textarea"
                  rows={20}
                  ref={roInputRef}
                  defaultValue=""
                  onChange={(e) => updateSplitInputSize(SPLIT_PART_RO, e.target.value)}
                  placeholder='{ "resourceType": "Bundle", ... }'
                  className="resultTextArea"
                  spellCheck={false}
                />
              </Form.Group>
            </Col>

            <Col md={6} className="mt-3 mt-md-0">
              <Form.Group controlId="jsonInputRw">
                <Form.Label>
                  Read/Write (RW) - operational data
                  <div className="text-muted small mt-1">
                    Size: {inputSizes.rw.toLocaleString()} characters
                  </div>
                </Form.Label>

                <Form.Control
                  as="textarea"
                  rows={20}
                  ref={rwInputRef}
                  defaultValue=""
                  onChange={(e) => updateSplitInputSize(SPLIT_PART_RW, e.target.value)}
                  placeholder='{ "resourceType": "Bundle", ... }'
                  className="resultTextArea"
                  spellCheck={false}
                />
              </Form.Group>
            </Col>
          </Row>
        </>
      ) : (
        <Form.Group controlId="jsonInput" className="mt-3">
          <Form.Label>
            {labels.helper}
            <div className="text-muted small mt-1">
              Size: {inputSizes.main.toLocaleString()} characters
            </div>
          </Form.Label>

          <Form.Control
            as="textarea"
            rows={20}
            ref={inputRef}
            defaultValue=""
            onChange={(e) => updateMainInputSize(e.target.value)}
            placeholder='{ "resourceType": "Bundle", ... }'
            className="resultTextArea"
            spellCheck={false}
          />
        </Form.Group>
      )}

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
            {mode === MODE_NHS_SCR && (
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
                        onClick={() => jumpToPath(err.jumpPath || err.path, err.jumpPart || 'main')}
                      >
                        {err.sourcePart && <strong>[{err.sourcePart}] </strong>}
                        <strong>{err.displayPath || err.path || '/'}</strong>: {err.message}
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
                        onClick={() => jumpToPath(err.jumpPath || err.path, err.jumpPart || 'main')}
                      >
                        {err.sourcePart && <strong>[{err.sourcePart}] </strong>}
                        <strong>{err.displayPath || err.path || '/'}</strong>: {err.message}
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
