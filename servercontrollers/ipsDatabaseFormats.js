// In ipsRawFormat.js

const { IPSModel } = require('../models/IPSModel');

function getIPSRaw(req, res) {
  const id = req.params.id;
  IPSModel.findById(id)
    .exec()
    .then((ips) => {
      if (!ips) {
        return res.status(404).json({ message: "IPS record not found" });
      }
      if (req.query.pretty === 'true') {
          // Return formatted JSON with indentation for readability
          const formattedJson = JSON.stringify(ips, null, "\t");
          res.send(formattedJson);
      } else {
          // Return JSON without formatting
          res.json(ips);
      }
    })
    .catch((err) => {
      res.status(400).send(err);
    });
}

function getAllIPS(req, res) {
  IPSModel.find({})
    .exec()
    .then((ipss) => {
      res.json(ipss);
    })
    .catch((err) => {
      res.status(400).send(err);
    });
}

module.exports = { getIPSRaw, getAllIPS };
