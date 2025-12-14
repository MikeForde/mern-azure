import React, { useState, useRef } from 'react'
import { Container, Form, Button, Alert } from 'react-bootstrap'

export default function IPSchemaValidator() {
  const [input, setInput] = useState('')
  const [errors, setErrors] = useState(null)
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
    setErrors(null)
    try {
      // send raw JSON text directly
      const resp = await fetch('/ipsUniVal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: input
      })
      const body = await resp.json()
      if (resp.ok) {
        setErrors(body.valid ? [] : body.errors)
      } else {
        // backend returned 400 for missing resourceType, etc
        setErrors(body.errors || [{ path: '', message: body.message || 'Validation failed' }])
      }
    } catch (err) {
      setErrors([{ path: '', message: 'Validation request failed: ' + err.message }])
    }
  }

  return (
    <Container className="mt-4">
      <h4>NPS JSON Validator</h4>
      <Form.Group controlId="jsonInput">
        <Form.Label>Paste your NPS Bundle or Resource JSON here</Form.Label>
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
