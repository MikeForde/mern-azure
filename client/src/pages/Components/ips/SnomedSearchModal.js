import React, { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Table } from "react-bootstrap";
import axios from "axios";

const SNOMED_SYSTEM = "http://snomed.info/sct";

export default function SnomedSearchModal({
  show,
  onHide,
  title = "Search SNOMED GPS",
  tag,
  onSelect,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const minLength = useMemo(() => 3, []);

  useEffect(() => {
    if (!show) {
      setQuery("");
      setResults([]);
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;

    const trimmed = query.trim();
    if (trimmed.length < minLength) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);

        const response = await axios.get("/snomedgps/search", {
          params: {
            q: trimmed,
            tag,
            limit: 30,
          },
        });

        setResults(response.data || []);
      } catch (err) {
        console.error("SNOMED GPS search failed:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, show, tag, minLength]);

  const handleSelect = (item) => {
    onSelect({
      name: item.term_clean,
      code: item.code,
      system: SNOMED_SYSTEM,
    });
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label>Search</Form.Label>
          <Form.Control
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter at least 3 characters"
            autoFocus
          />
        </Form.Group>

        {loading && <div className="mb-2">Searching...</div>}

        {!loading && query.trim().length >= minLength && results.length === 0 && (
          <div className="text-muted">No matches found.</div>
        )}

        {results.length > 0 && (
          <div className="table-responsive">
            <Table bordered hover size="sm">
              <thead>
                <tr>
                  <th>Term</th>
                  <th>Tag</th>
                  <th>Code</th>
                  <th style={{ width: "90px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr key={`${item.code}-${item.term_clean}`}>
                    <td>{item.term_clean}</td>
                    <td>{item.semantic_tag}</td>
                    <td>{item.code}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleSelect(item)}
                      >
                        Use
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}