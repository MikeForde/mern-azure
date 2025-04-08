// tak/takRoutes.js
const express = require('express');
const router = express.Router();
const { sendCotMessage } = require('./takConnector');
const { resolveId } = require('../utils/resolveId');
const { gzipEncode } = require('../compression/gzipUtils');

// POST /tak/test – Sends a COT message.
// You can provide a custom COT message via a "cot" property in the JSON body.
router.post('/test', (req, res) => {
  const cotMessage = req.body.cot || `<event version="2.0" uid="TAK-Example" type="a-f-G-U-C" how="m-g" time="2023-12-19T12:34:56Z" start="2023-12-19T12:34:56Z" stale="2023-12-19T12:39:56Z">
    <detail>
      <contact callsign="Example" />
    </detail>
  </event>`;

  sendCotMessage(cotMessage, (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ message: result });
    }
  });
});

router.post('/ips', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Missing 'id' field in request body" });
    }

    // Resolve the IPS record using either packageUUID or ObjectId.
    const ipsRecord = await resolveId(id);
    if (!ipsRecord) {
      return res.status(404).json({ error: 'IPS record not found' });
    }

    // Convert the IPS record to a JSON string.
    const ipsText = JSON.stringify(ipsRecord, null, 2);

    // Compress the JSON string with gzip and encode the result in Base64.
    const compressedBuffer = await gzipEncode(ipsText);
    const base64Gzip = compressedBuffer.toString('base64');

    // Generate timestamps for the CoT message.
    const now = new Date();
    const timeStr = now.toISOString();
    // Set the stale time to one hour from now.
    const staleTime = new Date(now.getTime() + 60 * 60000).toISOString();
    const productionTime = timeStr; // Using current time for production_time

    // Generate a unique uid using the packageUUID if available.
    const uid = ipsRecord.packageUUID 
      ? `ANDROID-${ipsRecord.packageUUID}__MED`
      : `ANDROID-${ipsRecord._id}__MED`;

    // Construct the CoT message with the gzipped, Base64 encoded IPS data in the <remarks> element.
    const cotMessage = `<event version="2.0" uid="${uid}" type="a-f-A" time="${timeStr}" start="${timeStr}" stale="${staleTime}" how="h-g" access="Undefined">
  <point lat="52" lon="1.5" hae="9999999" ce="9999999" le="9999999" />
  <detail>
    <status readiness="true" />
    <color argb="-1" />
    <link uid="ANDROID-464496edc9400227" production_time="${productionTime}" type="a-f-G-U-C" parent_callsign="Wibble" relation="p-p" />
    <usericon iconsetpath="6d781afb-89a6-4c07-b2b9-a89748b6a38f/General/health.png" />
    <contact callsign="Wobble" />
    <ipsData encoding="gzipBase64">${base64Gzip}</ipsData>
  </detail>
</event>`;

    // Send the CoT message.
    sendCotMessage(cotMessage, (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      return res.json({ message: result, cot: cotMessage });
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
