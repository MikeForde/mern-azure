import { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Button, Alert, Form, DropdownButton, Dropdown, Toast, ToastContainer } from 'react-bootstrap';
import './Page.css';
import { PatientContext } from '../PatientContext';
import { useLoading } from '../contexts/LoadingContext';
import pako from 'pako';

const NPS_NFC_EMPTY_RW_OPTION = '__after_latest__';

function parseIso(value) {
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function getReferenceId(reference, expectedType) {
  if (!reference || typeof reference !== 'string') return null;

  const trimmed = reference.trim();
  if (!trimmed) return null;

  const urnMatch = trimmed.match(/^urn:(uuid|oid):(.+)$/i);
  if (urnMatch) return urnMatch[2];

  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length >= 2) {
    if (!expectedType || parts[0] === expectedType) return parts[1];
    return null;
  }

  return trimmed;
}

function getResourceDateValue(resource) {
  if (!resource || !resource.resourceType) return null;

  switch (resource.resourceType) {
    case 'AllergyIntolerance':
      return resource.onsetDateTime || null;
    case 'Condition':
      return resource.onsetDateTime || null;
    case 'Observation':
      return resource.effectiveDateTime || null;
    case 'Procedure':
      return resource.performedDateTime || null;
    case 'MedicationRequest':
      return resource.authoredOn || null;
    default:
      return null;
  }
}

function buildSplitBundle(bundle, entries) {
  return {
    resourceType: 'Bundle',
    id: bundle.id,
    identifier: bundle.identifier,
    meta: bundle.meta,
    implicitRules: bundle.implicitRules,
    language: bundle.language,
    type: bundle.type,
    timestamp: bundle.timestamp,
    total: entries.length,
    entry: entries
  };
}

function splitNpsBundleAtDate(bundle, cutoffIso) {
  const cutoffMs = parseIso(cutoffIso);
  if (cutoffMs == null) {
    throw new Error(`Invalid cutoff date: ${cutoffIso}`);
  }

  const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
  const roEntries = [];
  const rwEntries = [];
  const medicationDateById = new Map();

  entries.forEach((entry) => {
    const resource = entry?.resource;
    if (resource?.resourceType !== 'MedicationRequest') return;

    const requestDateMs = parseIso(resource.authoredOn);
    const medicationId = getReferenceId(resource?.medicationReference?.reference, 'Medication');
    if (!medicationId || requestDateMs == null) return;

    if (!medicationDateById.has(medicationId) || requestDateMs > medicationDateById.get(medicationId)) {
      medicationDateById.set(medicationId, requestDateMs);
    }
  });

  entries.forEach((entry) => {
    const resource = entry?.resource;
    if (!resource) return;

    if (resource.resourceType === 'Patient' || resource.resourceType === 'Organization') {
      roEntries.push(entry);
      return;
    }

    const dateValue = getResourceDateValue(resource);
    const dateMs = resource.resourceType === 'Medication'
      ? (medicationDateById.get(resource.id) ?? null)
      : parseIso(dateValue);

    if (dateMs == null || dateMs < cutoffMs) {
      roEntries.push(entry);
      return;
    }

    rwEntries.push(entry);
  });

  return {
    roBundle: buildSplitBundle(bundle, roEntries),
    rwBundle: buildSplitBundle(bundle, rwEntries)
  };
}

function getBundleDateOptions(bundle) {
  const countsByDate = new Map();

  (Array.isArray(bundle?.entry) ? bundle.entry : []).forEach((entry) => {
    const resource = entry?.resource;
    const dateValue = getResourceDateValue(resource);
    const dateMs = parseIso(dateValue);
    if (dateMs == null || !dateValue) return;

    if (!countsByDate.has(dateValue)) {
      countsByDate.set(dateValue, { value: dateValue, millis: dateMs, count: 0 });
    }

    countsByDate.get(dateValue).count += 1;
  });

  return Array.from(countsByDate.values())
    .sort((a, b) => a.millis - b.millis)
    .map((item) => ({
      value: item.value,
      label: `${item.value} (${item.count} resource${item.count === 1 ? '' : 's'})`
    }));
}

function APIGETPage() {
  const { selectedPatients, selectedPatient, setSelectedPatient } = useContext(PatientContext);
  const { startLoading, stopLoading } = useLoading();
  const [data, setData] = useState('');
  const [mode, setMode] = useState('ipsunified');
  const [modeText, setModeText] = useState('NPS JSON Bundle - /nps/:id');
  const [showNotification, setShowNotification] = useState(false);
  const [responseSize, setResponseSize] = useState(0);
  const [useCompressionAndEncryption, setUseCompressionAndEncryption] = useState(false);
  const [useIncludeKey, setUseIncludeKey] = useState(false);
  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVariant, setToastVariant] = useState('info');
  const [isWriting, setIsWriting] = useState(false);
  const [useFieldEncrypt, setUseFieldEncrypt] = useState(false); // => protect=1 (JWE)
  const [useIdOmit, setUseIdOmit] = useState(false);             // => protect=2 (omit)
  const [useNpsNfcSplit, setUseNpsNfcSplit] = useState(false);
  const [npsNfcDateOptions, setNpsNfcDateOptions] = useState([]);
  const [npsNfcCutoff, setNpsNfcCutoff] = useState('');
  const [npsNfcSplitData, setNpsNfcSplitData] = useState(null);
  const [npsNfcSplitError, setNpsNfcSplitError] = useState(null);

  // IPS narrative toggle (only for mode === 'ips')
  const [useIpsNarrative, setUseIpsNarrative] = useState(false); // => narrative=1

  // NHS SCR IPS narrative toggle (only for mode === 'ipsnhsscr')
  const [useIpsNhsscrNarrative, setUseIpsNhsscrNarrative] = useState(false); // => narrative=1

  // EPS narrative toggles (only for mode === 'ipseps')
  const [useIpsEpsNarrative, setUseIpsEpsNarrative] = useState(false); // => narrative=1

  // ---------- On-page validation (NPS + NHS SCR JSON modes) ----------
  const [valLoading, setValLoading] = useState(false);
  const [valResult, setValResult] = useState(null);   // response JSON from validator
  const [valError, setValError] = useState(null);     // network / parse error
  const [showValErrors, setShowValErrors] = useState(false);

  const navigate = useNavigate();
  const showNpsNfcControls = mode === 'ipsunified' && !useCompressionAndEncryption;
  const showNpsNfcSplitView = showNpsNfcControls && useNpsNfcSplit && !!npsNfcSplitData;

  const handleRecordChange = (recordId) => {
    const record = selectedPatients.find((record) => record._id === recordId);
    startLoading();
    setSelectedPatient(record);
  };

  useEffect(() => {
    if (selectedPatient) {
      const fetchData = async () => {
        let endpoint;
        if (mode === 'ipsbeerwithdelim') {
          endpoint = `/ipsbeer/${selectedPatient._id}/pipe`;
        } else {
          endpoint = `/${mode}/${selectedPatient._id}`;
        }

        // add protect flag for ipsunified only
        if (mode === 'ipsunified') {
          if (useFieldEncrypt) {
            endpoint += (endpoint.includes('?') ? '&' : '?') + 'protect=1';
          } else if (useIdOmit) {
            endpoint += (endpoint.includes('?') ? '&' : '?') + 'protect=2';
          }
        }

        // add narrative flags for IPS and NHS SCR IPS
        if (
          (mode === 'ips' && useIpsNarrative) ||
          (mode === 'ipsnhsscr' && useIpsNhsscrNarrative) ||
          (mode === 'ipseps' && useIpsEpsNarrative)
        ) {
          endpoint += (endpoint.includes('?') ? '&' : '?') + 'narrative=1';
        }

        console.log('Fetching data from:', endpoint);
        try {
          const headers = {};
          if (useCompressionAndEncryption) {
            headers['Accept-Extra'] = 'insomzip, base64';
            headers['Accept-Encryption'] = 'aes256';
            if (useIncludeKey) {
              headers['Accept-Extra'] = 'insomzip, base64, includeKey';
            }
          }

          const response = await axios.get(endpoint, { headers });
          let responseData;

          if (useCompressionAndEncryption) {
            setResponseSize(JSON.stringify(response.data).length);
            responseData = JSON.stringify(response.data, null, 2);
          } else if (mode === 'ipsbasic' || mode === 'ipsbeer' || mode === 'ipsbeerwithdelim' || mode === 'ipshl72x' || mode === 'ipsplaintext') {
            responseData = response.data;
            setResponseSize(responseData.length);
          } else if (mode === 'ipsxml') {
            responseData = formatXML(response.data);
            setResponseSize(responseData.length);
          } else {
            setResponseSize(JSON.stringify(response.data).length);
            responseData = JSON.stringify(response.data, null, 2);
          }

          setData(responseData);
          console.log('Data:', responseData);
          setShowNotification(false);
        } catch (error) {
          console.error('Error fetching IPS record:', error);
        } finally {
          stopLoading();
        }
      };

      fetchData();
    }
  }, [
    selectedPatient,
    mode,
    useCompressionAndEncryption,
    stopLoading,
    startLoading,
    useIncludeKey,
    useFieldEncrypt,
    useIdOmit,
    useIpsNarrative,
    useIpsNhsscrNarrative,
    useIpsEpsNarrative
  ]);

  const handleDownloadData = () => {
    if (!selectedPatient) return;

    // 1) Format today as YYYYMMDD
    const today = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const yyyymmdd = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;

    // 2) Pull patient info
    const { packageUUID, patient: { name: familyName, given: givenName } } = selectedPatient;

    console.log('Patient:', selectedPatient);

    // 3) Decide extension & MIME type
    let extension, mimeType;
    if (useCompressionAndEncryption) {
      extension = 'json';
      mimeType = 'application/json';
    } else if (mode === 'ipsxml') {
      extension = 'xml';
      mimeType = 'application/xml';
    } else if (
      ['ipsbasic', 'ipsbeer', 'ipsbeerwithdelim', 'ipshl72x', 'ipsplaintext'].includes(mode)
    ) {
      extension = 'txt';
      mimeType = 'text/plain';
    } else {
      extension = 'json';
      mimeType = 'application/json';
    }

    // 4) Build filename: date-FAMILY_GIVEN_last6_apitype.ext
    const sanitize = str =>
      str
        .normalize('NFKD')                   // strip accents
        .replace(/[\u0300-\u036f]/g, '')     // remove remaining diacritics
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')          // only allow A–Z,0–9 → underscore
        .replace(/_+/g, '_')                 // collapse repeats
        .replace(/^_|_$/g, '');              // trim leading/trailing underscores

    const fam = sanitize(familyName);
    const giv = sanitize(givenName);
    const last6 = packageUUID.slice(-6);
    // 4) Suffix for GE
    const ikSuffix = useIncludeKey && useCompressionAndEncryption ? '_ik' : '';
    const ceSuffix = useCompressionAndEncryption ? '_ce' : '';
    const pmSuffix = mode === 'ipsunified' ? useFieldEncrypt ? '_jwefld' : (useIdOmit ? '_omit' : '') : '';
    const narSuffix =
      ((mode === 'ips' && useIpsNarrative) ||
        (mode === 'ipsnhsscr' && useIpsNhsscrNarrative) || (mode === 'ipseps' && useIpsEpsNarrative))
        ? '_narr'
        : '';
    const fileName = `${yyyymmdd}-${fam}_${giv}_${last6}_${mode}${narSuffix}${pmSuffix}${ceSuffix}${ikSuffix}.${extension}`;

    // 5) Create & click the download link
    const blob = new Blob([data], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleModeChange = (selectedMode) => {
    startLoading();
    setMode(selectedMode);

    // reset narrative toggles when leaving their modes
    if (selectedMode !== 'ips') setUseIpsNarrative(false);
    if (selectedMode !== 'ipsnhsscr') setUseIpsNhsscrNarrative(false);
    if (selectedMode !== 'ipsunified') setUseNpsNfcSplit(false);

    switch (selectedMode) {
      case 'ips':
        setModeText('IPS JSON Bundle - /ips/:id or /ipsbyname/:name/:given');
        break;
      case 'ipsnhsscr':
        setModeText('NHS SCR IPS JSON Bundle - /ipsnhsscr/:id');
        break;
      case 'ipseps':
        setModeText('EPS IPS JSON Bundle - /ipseps/:id');
        break;
      case 'ipsxml':
        setModeText('IPS XML Bundle - /ipsxml/:id');
        break;
      case 'ipslegacy':
        setModeText('NPS Legacy JSON Bundle - /ipslegacy/:id');
        break;
      case 'ipsunified':
        setModeText('NPS JSON Bundle - /nps/:id');
        break;
      case 'ipsmongo':
        setModeText('IPS NoSQL - /ipsmongo/:id');
        break;
      case 'ipsbasic':
        setModeText('IPS Minimal - /ipsbasic/:id');
        break;
      case 'ipsbeer':
        setModeText('IPS BEER - /ipsbeer/:id');
        break;
      case 'ipsbeerwithdelim':
        setModeText('IPS BEER - /ipsbeer/:id/pipe)');
        break;
      case 'ipshl72x':
        setModeText('IPS HL7 2.x - /ipshl72x/:id');
        break;
      case 'ipsplaintext':
        setModeText('IPS Plain Text - /ipsplaintext/:id');
        break;
      default:
        setModeText('NPS JSON Bundle - /ipsunified/:id');
    }
  };

  const formatXML = (xml) => {
    const formatted = xml.replace(/></g, '>\n<');
    return formatted;
  };

  useEffect(() => {
    if (!showNpsNfcControls || !useNpsNfcSplit || !data) {
      setNpsNfcDateOptions([]);
      setNpsNfcCutoff('');
      setNpsNfcSplitData(null);
      setNpsNfcSplitError(null);
      return;
    }

    try {
      const parsed = JSON.parse(data);
      if (!parsed || parsed.resourceType !== 'Bundle') {
        throw new Error('Displayed NPS data is not a FHIR Bundle.');
      }

      const resourceDateOptions = getBundleDateOptions(parsed);
      const dateOptions = resourceDateOptions.length > 0
        ? [
          ...resourceDateOptions,
          { value: NPS_NFC_EMPTY_RW_OPTION, label: 'After latest dated resource (RW empty)' }
        ]
        : [];
      const defaultCutoff = resourceDateOptions[Math.floor(resourceDateOptions.length / 2)]?.value || '';
      const nextCutoff = dateOptions.some((option) => option.value === npsNfcCutoff)
        ? npsNfcCutoff
        : defaultCutoff;

      const split = nextCutoff === NPS_NFC_EMPTY_RW_OPTION
        ? {
          roBundle: buildSplitBundle(parsed, Array.isArray(parsed.entry) ? parsed.entry : []),
          rwBundle: buildSplitBundle(parsed, [])
        }
        : nextCutoff
          ? splitNpsBundleAtDate(parsed, nextCutoff)
          : {
            roBundle: buildSplitBundle(parsed, Array.isArray(parsed.entry) ? parsed.entry : []),
            rwBundle: buildSplitBundle(parsed, [])
          };

      setNpsNfcDateOptions(dateOptions);
      setNpsNfcCutoff(nextCutoff);
      setNpsNfcSplitData({
        cutoff: nextCutoff,
        roBundle: split.roBundle,
        rwBundle: split.rwBundle,
        roJson: JSON.stringify(split.roBundle, null, 2),
        rwJson: JSON.stringify(split.rwBundle, null, 2)
      });
      setNpsNfcSplitError(
        resourceDateOptions.length > 0
          ? null
          : 'No dated resources were found. All resources remain in the Read Only section.'
      );
    } catch (err) {
      setNpsNfcDateOptions([]);
      setNpsNfcCutoff('');
      setNpsNfcSplitData(null);
      setNpsNfcSplitError(`Could not split NPS bundle for NFC view: ${err.message}`);
    }
  }, [data, npsNfcCutoff, showNpsNfcControls, useNpsNfcSplit]);

  const handleNfcWriteMode = async (nfctype) => {
    try {
      if (nfctype === 'copyurl') {
        // Dev only: copy gzipped data URL to clipboard
        const gzipped = pako.gzip(data);
        const base64 = btoa(String.fromCharCode(...gzipped))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const url = `${window.location.origin}/cwix/payload?d=${base64}`;
        await navigator.clipboard.writeText(url);
        setToastMsg('Gzipped data URL copied to clipboard!');
        setToastVariant('success');
        setShowToast(true);
        return;
      }

      if (!('NDEFReader' in window)) {
        setToastMsg('Web NFC not supported on this device/browser.');
        setToastVariant('warning');
        setShowToast(true);
        return;
      }
      setIsWriting(true);
      const writer = new window.NDEFReader();
      if (nfctype === 'plain') {
        await writer.write(data);
      } else if (nfctype === 'binary') {
        const resp = await axios.get(
          `/${mode}/${selectedPatient._id}`, { headers: { Accept: 'application/octet-stream' }, responseType: 'arraybuffer' }
        );
        await writer.write({ records: [{ recordType: 'mime', mediaType: 'application/x.ips.gzip.aes256.v1-0', data: new Uint8Array(resp.data) }] });
      } else if (nfctype === 'gzipbin') {
        // Gzip the visible text and write as a binary MIME record (no encryption)
        const gzipped = pako.gzip(data); // Uint8Array
        await writer.write({
          records: [{
            recordType: 'mime',
            mediaType: 'application/x.ips.gzip.v1-0', // custom; use 'application/gzip' if you prefer
            data: gzipped
          }]
        });
      } else if (nfctype === 'url') {
        const gzipped = pako.gzip(data);
        const base64 = btoa(String.fromCharCode(...gzipped))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const url = `${window.location.origin}/cwix/payload?d=${base64}`;
        await writer.write({ records: [{ recordType: 'url', data: url }] });
      }
      setToastMsg(`NFC write success (${nfctype})!`);
      setToastVariant('success');
    } catch (err) {
      console.error(err);
      setToastMsg(`NFC write failed: ${err.message}`);
      setToastVariant('danger');
    } finally {
      setIsWriting(false);
      setShowToast(true);
    }
  };

  // ---------- On-page validation helpers ----------
  const isJsonModeForValidation =
    (mode === 'ipsunified' || mode === 'ipsnhsscr' || mode === 'ipseps') &&
    !useCompressionAndEncryption; // avoid validating compressed/encrypted wrapper JSON

  const validatorEndpoint = mode === 'ipseps' ? '/epsVal' : (mode === 'ipsnhsscr' ? '/ipsNhsScrVal' : '/npsVal');

  useEffect(() => {
    let cancelled = false;

    async function runValidation() {
      // reset state whenever it shouldn't validate
      if (!isJsonModeForValidation || !data || typeof data !== 'string') {
        setValResult(null);
        setValError(null);
        setValLoading(false);
        return;
      }

      // quick sanity: must look like JSON
      const trimmed = data.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        setValResult(null);
        setValError('Displayed data is not JSON (cannot validate).');
        setValLoading(false);
        return;
      }

      // ensure it's valid JSON before POST (gives friendlier error)
      try {
        JSON.parse(trimmed);
      } catch (e) {
        setValResult(null);
        setValError(`Displayed JSON is invalid: ${e.message}`);
        setValLoading(false);
        return;
      }

      setValLoading(true);
      setValError(null);
      setValResult(null);

      try {
        const resp = await fetch(validatorEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: trimmed
        });

        const body = await resp.json().catch(() => null);

        if (cancelled) return;

        if (!resp.ok) {
          const msg =
            body?.message ||
            (body?.errors?.[0]?.message) ||
            `Validator returned HTTP ${resp.status}`;
          setValError(msg);
          setValResult(body);
        } else {
          setValResult(body);
        }
      } catch (err) {
        if (cancelled) return;
        setValError('Validation request failed: ' + err.message);
      } finally {
        if (!cancelled) setValLoading(false);
      }
    }

    // small debounce so we don't hammer the validator during rapid updates
    const t = setTimeout(runValidation, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [data, isJsonModeForValidation, mode, useCompressionAndEncryption, validatorEndpoint]); // validate whenever payload/mode changes


  // ---------- Jump to validator (carry payload + mode via sessionStorage) ----------
  const openValidatorPage = () => {
    try {
      if (showNpsNfcSplitView) {
        sessionStorage.setItem('ips:lastPayload', JSON.stringify({
          type: 'split',
          ro: npsNfcSplitData.roJson,
          rw: npsNfcSplitData.rwJson
        }));
        sessionStorage.setItem('ips:lastMode', 'NPSNFC');
      } else {
        const validatorMode = mode === 'ipseps' ? 'EPS' : (mode === 'ipsnhsscr' ? 'NHSSCR' : 'NPS');
        sessionStorage.setItem('ips:lastPayload', data || '');
        sessionStorage.setItem('ips:lastMode', validatorMode);
      }
    } catch (e) {
      console.warn('Could not store payload for validator:', e);
    }

    // Navigate within the React app (SPA)
    navigate(showNpsNfcSplitView ? '/schemavalidator?mode=npsnfc' : '/schemavalidator');
  };

  return (
    <div className="app">
      <div className="container">
        <h3>
          API GET - IPS Data: {responseSize}
          <Link
            to="/apidocumentation"
            title="API documentation page"
            style={{
              marginLeft: '8px',
              fontSize: '0.80em',
              textDecoration: 'none',
              opacity: 0.6,
              transition: 'opacity 0.2s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.6)}
          >
            (Full API)
          </Link>
        </h3>
        {selectedPatients.length > 0 && selectedPatient && (
          <>
            {/* --- Top row: patient + API dropdowns side-by-side --- */}
            <div className="row g-2 mb-2 align-items-center">
              <div className="col-auto">
                <DropdownButton
                  id="dropdown-record"
                  title={`Patient: ${selectedPatient.patient.given} ${selectedPatient.patient.name}`}
                  onSelect={handleRecordChange}
                  size="sm"
                  variant="secondary"
                >
                  {selectedPatients.map((record) => (
                    <Dropdown.Item
                      key={record._id}
                      eventKey={record._id}
                      active={selectedPatient && selectedPatient._id === record._id}
                    >
                      {record.patient.given} {record.patient.name}
                    </Dropdown.Item>
                  ))}
                </DropdownButton>
              </div>

              <div className="col-auto">
                <DropdownButton
                  id="dropdown-mode"
                  title={`API: ${modeText}`}
                  onSelect={handleModeChange}
                  size="sm"
                  variant="secondary"
                >
                  <Dropdown.Item eventKey="ipsunified">NPS JSON Bundle - /nps/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsnhsscr">NHS SCR IPS JSON Bundle - /ipsnhsscr/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipseps">EPS JSON Bundle - /ipseps/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipshl72x">IPS HL7 2.3 - /ipshl72x/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsmongo">IPS NoSQL - /ipsmongo/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsbeer">IPS BEER - /ipsbeer/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsbeerwithdelim">IPS BEER - /ipsbeer/:id/pipe</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsbasic">IPS Minimal - /ipsbasic/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ips">IPS JSON Bundle - /ips/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsxml">IPS XML Bundle - /ipsxml/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipslegacy">NPS Legacy JSON Bundle - /ipslegacy/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsplaintext">IPS Plain Text - /ipsplaintext/:id</Dropdown.Item>
                </DropdownButton>
              </div>
            </div>

            {/* --- Second row: compact checkbox bar --- */}
            <div className="row g-3 mb-3 align-items-center flex-wrap small">
              <div className="col-auto">
                <Form.Check
                  type="checkbox"
                  id="compressionEncryption"
                  label="Gzip + Encrypt (aes256 base64)"
                  checked={useCompressionAndEncryption}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setUseCompressionAndEncryption(v);
                  }}
                />
              </div>

              <div className="col-auto">
                <Form.Check
                  type="checkbox"
                  id="includeKey"
                  label="Include key in response"
                  checked={useIncludeKey}
                  onChange={(e) => setUseIncludeKey(e.target.checked)}
                />
              </div>

              <div className="col-auto">
                <Form.Check
                  type="checkbox"
                  id="fldEnc"
                  label="Field-Level Id Encrypt"
                  disabled={mode !== 'ipsunified'}
                  checked={useFieldEncrypt}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setUseFieldEncrypt(v);
                    if (v) setUseIdOmit(false);
                  }}
                />
              </div>

              <div className="col-auto">
                <Form.Check
                  type="checkbox"
                  id="idOmit"
                  label="Id Omit"
                  disabled={mode !== 'ipsunified'}
                  checked={useIdOmit}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setUseIdOmit(v);
                    if (v) setUseFieldEncrypt(false);
                  }}
                />
              </div>

              {showNpsNfcControls && (
                <div className="col-auto">
                  <Form.Check
                    type="checkbox"
                    id="npsNfcSplit"
                    label="NPS NFC split (RO/RW)"
                    checked={useNpsNfcSplit}
                    onChange={(e) => setUseNpsNfcSplit(e.target.checked)}
                  />
                </div>
              )}

              {showNpsNfcControls && useNpsNfcSplit && (
                <div className="col-auto">
                  <Form.Label htmlFor="npsNfcCutoff" className="mb-1">
                    Split from resource date
                  </Form.Label>
                  <Form.Select
                    id="npsNfcCutoff"
                    size="sm"
                    value={npsNfcCutoff}
                    onChange={(e) => setNpsNfcCutoff(e.target.value)}
                    disabled={npsNfcDateOptions.length === 0}
                  >
                    {npsNfcDateOptions.length === 0 ? (
                      <option value="">No dated resources</option>
                    ) : (
                      npsNfcDateOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))
                    )}
                  </Form.Select>
                </div>
              )}

              {/* show only in IPS mode */}
              {mode === 'ips' && (
                <div className="col-auto">
                  <Form.Check
                    type="checkbox"
                    id="ipsNarrative"
                    label="Include narrative (composition)"
                    checked={useIpsNarrative}
                    onChange={(e) => setUseIpsNarrative(e.target.checked)}
                  />
                </div>
              )}
              {/* show only in NHS SCR IPS mode */}
              {mode === 'ipsnhsscr' && (
                <div className="col-auto">
                  <Form.Check
                    type="checkbox"
                    id="ipsNhsscrNarrative"
                    label="Include narrative (composition)"
                    checked={useIpsNhsscrNarrative}
                    onChange={(e) => setUseIpsNhsscrNarrative(e.target.checked)}
                  />
                </div>
              )}
              {/* show only in EPS IPS mode */}
              {mode === 'ipseps' && (
                <div className="col-auto">
                  <Form.Check
                    type="checkbox"
                    id="ipsEpsNarrative"
                    label="Include narrative (composition)"
                    checked={useIpsEpsNarrative}
                    onChange={(e) => setUseIpsEpsNarrative(e.target.checked)}
                  />
                </div>
              )}
            </div>
          </>
        )}
        {showNotification ? (
          <Alert variant="danger">Data is too large to display. Please try a different mode.</Alert>
        ) : (
          <>
            {showNpsNfcControls && useNpsNfcSplit && npsNfcSplitError && !npsNfcSplitData && (
              <Alert variant="warning" className="mb-2">{npsNfcSplitError}</Alert>
            )}

            {showNpsNfcSplitView ? (
              <>
                <Alert variant={npsNfcSplitError ? 'warning' : 'secondary'} className="mb-2">
                  <div>
                    <strong>NPS NFC split view (for illustrative purposes only):</strong>{' '}
                    {npsNfcCutoff === NPS_NFC_EMPTY_RW_OPTION
                      ? 'RO contains all resources; RW contains no entries.'
                      : npsNfcCutoff
                      ? `RO contains resources before ${npsNfcCutoff}; RW contains resources on and after ${npsNfcCutoff}.`
                      : 'All resources are currently in the Read Only section.'}
                  </div>
                  <div>
                    RO entries: {npsNfcSplitData.roBundle.total} | RW entries: {npsNfcSplitData.rwBundle.total}
                  </div>
                  {npsNfcSplitError && <div>{npsNfcSplitError}</div>}
                </Alert>

                <div className="row g-3">
                  <div className="col-md-6">
                    <Form.Group controlId="npsNfcRoData">
                      <Form.Label>Read Only (RO) - historical data</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={10}
                        value={npsNfcSplitData.roJson}
                        readOnly
                        className="resultTextArea apiGetResultTextAreaDouble"
                      />
                    </Form.Group>
                  </div>

                  <div className="col-md-6">
                    <Form.Group controlId="npsNfcRwData">
                      <Form.Label>Read/Write (RW) - operational data</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={10}
                        value={npsNfcSplitData.rwJson}
                        readOnly
                        className="resultTextArea apiGetResultTextAreaDouble"
                      />
                    </Form.Group>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-area">
                <Form.Control
                  as="textarea"
                  rows={10}
                  value={data}
                  readOnly
                  className="resultTextArea apiGetResultTextArea"
                />
              </div>
            )}

            {/* ---------- On-page validation panel ---------- */}
            {(mode === 'ipsunified' || mode === 'ipsnhsscr' || mode === 'ipseps') && (
              <div className="mt-2">
                {useCompressionAndEncryption ? (
                  <Alert variant="secondary" className="mb-2">
                    Validation disabled because <strong>Gzip + Encrypt</strong> is enabled (displayed JSON is a wrapper).
                  </Alert>
                ) : valLoading ? (
                  <Alert variant="secondary" className="mb-2">
                    Validating ({mode === 'ipseps' ? 'EPS' : (mode === 'ipsnhsscr' ? 'NHS SCR IPS' : (showNpsNfcSplitView ? 'NPS NFC' : 'NPS'))})...
                  </Alert>
                ) : valError ? (
                  <Alert variant="warning" className="mb-2">
                    <strong>Validation:</strong> {valError}
                  </Alert>
                ) : valResult ? (
                  <Alert variant={valResult.valid ? "success" : "danger"} className="mb-2">
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <div>
                        <strong>Validation ({mode === 'ipseps' ? 'EPS' : (mode === 'ipsnhsscr' ? 'NHS SCR IPS' : (showNpsNfcSplitView ? 'NPS NFC' : 'NPS'))}):</strong>
                        {valResult.valid ? "✅ Valid" : "❌ Invalid"}
                        {!!valResult.errors?.length && (
                          <> — {valResult.errors.length} error(s)</>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          onClick={openValidatorPage}
                          disabled={!data}
                        >
                          Go to Validator ({mode === 'ipseps' ? 'EPS' : (mode === 'ipsnhsscr' ? 'NHS SCR IPS' : (showNpsNfcSplitView ? 'NPS NFC' : 'NPS'))})
                        </Button>

                        {!valResult.valid && (
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => setShowValErrors(v => !v)}
                          >
                            {showValErrors ? 'Hide errors' : 'Show errors'}
                          </Button>
                        )}
                      </div>
                    </div>

                    {!valResult.valid && showValErrors && (valResult.errors?.length > 0) && (
                      <ul className="mt-2 mb-0" style={{ cursor: 'default' }}>
                        {valResult.errors.slice(0, 50).map((e, i) => (
                          <li key={i}>
                            <strong>{e.path || '/'}</strong>: {e.message}
                          </li>
                        ))}
                        {valResult.errors.length > 50 && (
                          <li>…and {valResult.errors.length - 50} more</li>
                        )}
                      </ul>
                    )}
                  </Alert>
                ) : null}
              </div>
            )}
          </>
        )}
        <div className="container">
          <div className="row mb-3 align-items-start">
            <div className="col-auto">
              <Button onClick={handleDownloadData} disabled={!data}>
                {showNpsNfcSplitView ? 'Download Combined Data' : 'Download Data'}
              </Button>
            </div>

            {(mode === 'ips' || mode === 'ipsnhsscr' || mode === 'ipseps') && (
              <div className="col-auto">
                <Button
                  variant="primary"
                  disabled={!data}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(data || '');
                      setToastMsg('IPS bundle copied to clipboard. Opening IPS Viewer...');
                      setToastVariant('success');
                      setShowToast(true);
                    } catch (err) {
                      console.error(err);
                      setToastMsg('Could not copy to clipboard (browser permissions). Opening IPS Viewer anyway...');
                      setToastVariant('warning');
                      setShowToast(true);
                    } finally {
                      window.open('https://ipsviewer.com', '_blank');
                    }
                  }}
                >
                  Open IPS Viewer
                </Button>
              </div>
            )}

            <div className="col-auto">
              <DropdownButton
                variant={isWriting ? 'dark' : 'primary'}
                title={isWriting ? 'Writing...' : (showNpsNfcSplitView ? 'Write to NFC (combined bundle)' : 'Write to NFC')}
                disabled={!data || isWriting}
                onSelect={handleNfcWriteMode}
              >
                <Dropdown.Item eventKey="plain">{showNpsNfcSplitView ? 'Combined NPS Bundle' : 'As Shown Above'}</Dropdown.Item>
                <Dropdown.Item eventKey="binary">Binary (AES256 + gzip) - regardless to above</Dropdown.Item>
                <Dropdown.Item eventKey="gzipbin">{showNpsNfcSplitView ? 'Gzip combined bundle' : 'Gzip (as shown)'}</Dropdown.Item>
                <Dropdown.Item eventKey="url">Gzipped Data URL</Dropdown.Item>
                <Dropdown.Item eventKey="copyurl">Gzipped Data URL - CopyPaste Buffer Only</Dropdown.Item>
              </DropdownButton>
            </div>
          </div>
        </div>

      </div>
      {/* Floating Toast, just like in IPS.js */}
      <ToastContainer
        position="bottom-end"
        className="p-3"
        style={{ zIndex: 9999 }}
      >
        <Toast
          onClose={() => setShowToast(false)}
          show={showToast}
          bg={toastVariant}
          delay={4000}
          autohide
        >
          <Toast.Header>
            <strong className="me-auto">IPS MERN NFC</strong>
          </Toast.Header>
          <Toast.Body className={toastVariant === 'light' ? '' : 'text-white'}>
            {toastMsg}
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}

export default APIGETPage;
