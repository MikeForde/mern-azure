// tak/takRoutes.js
const express = require('express');
const router = express.Router();
const { sendCotMessage } = require('./takConnector');
const { resolveId } = require('../utils/resolveId');
const { gzipEncode } = require('../compression/gzipUtils');

// POST /tak/test – Sends a COT message.
// You can provide a custom COT message via a "cot" property in the JSON body.
router.post('/test', (req, res) => {
  const cotMessage = req.body.cot || `<event version="2.0" uid="TAK-Example" type="a-f-G-U-C" how="m-g" time="2026-12-19T12:34:56Z" start="2026-12-19T12:34:56Z" stale="2026-12-19T12:39:56Z">
    <detail>
      <contact callsign="MF-ATAK-Phone-PS53" />
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
  <point lat="52" lon="-2.5" hae="9999999" ce="9999999" le="9999999" />
  <detail>
    <status readiness="true" />
    <color argb="-1" />
    <link uid="ANDROID-464496edc9400227" production_time="${productionTime}" type="a-f-G-U-C" parent_callsign="MF-ATAK" relation="p-p" />
    <usericon iconsetpath="6d781afb-89a6-4c07-b2b9-a89748b6a38f/General/health.png" />
    <contact callsign="IPS MERN Patient" />
    <__group name="Cyan" role="Team Member"/>
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

// GET /tak/browser/:id – Returns an HTML page with nicely formatted IPS record data.
router.get('/browser/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).send('Missing IPS record id in the URL.');
    }

    // Resolve the IPS record using the same utility as the /ips route.
    const ipsRecord = await resolveId(id);
    if (!ipsRecord) {
      return res.status(404).send('IPS record not found.');
    }

    // Create an HTML page to display the IPS record nicely.
    // Basic inline CSS and responsive meta tags make it usable on small screens.
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=0.75">
        <title>IPS Record - ${ipsRecord.packageUUID}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; padding: 0; }
          h1 { font-size: 24px; margin-bottom: 10px; }
          h2 { font-size: 20px; margin-top: 20px; }
          p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          .record { background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          /* Style for the button */
          #sendToWinTAK {
            padding: 10px 20px;
            font-size: 16px;
            margin-top: 20px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <h1 style="color: white !important;">IPS Record Details</h1>
        <div class="record">
          <p><strong>Package UUID:</strong> ${ipsRecord.packageUUID}</p>
          <p><strong>Time Stamp:</strong> ${new Date(ipsRecord.timeStamp).toLocaleString()}</p>
          <h2>Patient Details</h2>
          <p><strong>Name:</strong> ${ipsRecord.patient.name}</p>
          <p><strong>Given Name:</strong> ${ipsRecord.patient.given}</p>
          <p><strong>Date of Birth:</strong> ${new Date(ipsRecord.patient.dob).toLocaleDateString()}</p>
          <p><strong>Gender:</strong> ${ipsRecord.patient.gender || 'N/A'}</p>
          <p><strong>Nation:</strong> ${ipsRecord.patient.nation}</p>
          <p><strong>Practitioner:</strong> ${ipsRecord.patient.practitioner}</p>
          <p><strong>Organization:</strong> ${ipsRecord.patient.organization || 'N/A'}</p>

          <h2>Medications</h2>
          ${ipsRecord.medication && ipsRecord.medication.length ? `
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Date</th>
                  <th>Dosage</th>
                  <th>System</th>
                  <th>Code</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${ipsRecord.medication.map(med =>
      `<tr>
                    <td>${med.name || 'N/A'}</td>
                    <td>${med.date ? new Date(med.date).toLocaleDateString() : 'N/A'}</td>
                    <td>${med.dosage || 'N/A'}</td>
                    <td>${med.system || 'N/A'}</td>
                    <td>${med.code || 'N/A'}</td>
                    <td>${med.status || 'N/A'}</td>
                  </tr>`
    ).join('')}
              </tbody>
            </table>
          ` : '<p>No medications available.</p>'}

          <h2>Allergies</h2>
          ${ipsRecord.allergies && ipsRecord.allergies.length ? `
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Criticality</th>
                  <th>Date</th>
                  <th>System</th>
                  <th>Code</th>
                </tr>
              </thead>
              <tbody>
                ${ipsRecord.allergies.map(allergy =>
      `<tr>
                    <td>${allergy.name || 'N/A'}</td>
                    <td>${allergy.criticality || 'N/A'}</td>
                    <td>${allergy.date ? new Date(allergy.date).toLocaleDateString() : 'N/A'}</td>
                    <td>${allergy.system || 'N/A'}</td>
                    <td>${allergy.code || 'N/A'}</td>
                  </tr>`
    ).join('')}
              </tbody>
            </table>
          ` : '<p>No allergies available.</p>'}

          <h2>Conditions</h2>
          ${ipsRecord.conditions && ipsRecord.conditions.length ? `
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Date</th>
                  <th>System</th>
                  <th>Code</th>
                </tr>
              </thead>
              <tbody>
                ${ipsRecord.conditions.map(condition =>
      `<tr>
                    <td>${condition.name || 'N/A'}</td>
                    <td>${condition.date ? new Date(condition.date).toLocaleDateString() : 'N/A'}</td>
                    <td>${condition.system || 'N/A'}</td>
                    <td>${condition.code || 'N/A'}</td>
                  </tr>`
    ).join('')}
              </tbody>
            </table>
          ` : '<p>No conditions available.</p>'}

          <h2>Observations</h2>
          ${ipsRecord.observations && ipsRecord.observations.length ? `
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Date</th>
                  <th>System</th>
                  <th>Code</th>
                  <th>Value</th>
                  <th>Value Code</th>
                  <th>Body Site</th>
                </tr>
              </thead>
              <tbody>
                ${ipsRecord.observations.map(obs =>
      `<tr>
                    <td>${obs.name || 'N/A'}</td>
                    <td>${obs.date ? new Date(obs.date).toLocaleDateString() : 'N/A'}</td>
                    <td>${obs.system || 'N/A'}</td>
                    <td>${obs.code || 'N/A'}</td>
                    <td>${obs.value || 'N/A'}</td>
                    <td>${obs.valueCode || 'N/A'}</td>
                    <td>${obs.bodySite || 'N/A'}</td>
                  </tr>`
    ).join('')}
              </tbody>
            </table>
          ` : '<p>No observations available.</p>'}

          <h2>Immunizations</h2>
          ${ipsRecord.immunizations && ipsRecord.immunizations.length ? `
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>System</th>
                  <th>Code</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${ipsRecord.immunizations.map(imm =>
      `<tr>
                    <td>${imm.name || 'N/A'}</td>
                    <td>${imm.system || 'N/A'}</td>
                    <td>${imm.code || 'N/A'}</td>
                    <td>${imm.date ? new Date(imm.date).toLocaleDateString() : 'N/A'}</td>
                    <td>${imm.status || 'N/A'}</td>
                  </tr>`
    ).join('')}
              </tbody>
            </table>
          ` : '<p>No immunizations available.</p>'}
        </div>
        <button id="sendToWinTAK">Send Message to WinTAK</button>
        <script>
        document.getElementById('sendToWinTAK').addEventListener('click', function() {
          if (window.chrome && window.chrome.webview && window.chrome.webview.postMessage) {
            window.chrome.webview.postMessage({
              action: 'RecordViewed',
              data: {
                packageUUID: "${ipsRecord.packageUUID}",
                info: "User clicked the Send Message button."
              }
            });
          } else {
            console.error("WebView messaging is not available.");
          }
        });
      </script>
      </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.send(html);
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

module.exports = router;
