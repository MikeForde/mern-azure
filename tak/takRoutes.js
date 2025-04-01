// tak/takRoutes.js
const express = require('express');
const router = express.Router();
const { sendCotMessage } = require('./takConnector');

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

module.exports = router;
