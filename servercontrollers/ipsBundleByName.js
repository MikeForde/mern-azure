const { IPSModel } = require('../models/IPSModel');
const { pickIPSFormat } = require('../utils/ipsFormatPicker');

async function getIPSBundleByName(req, res) {
    const { name, given } = req.params;
  
    try {
      const nameRegex = new RegExp(`^${name}$`, 'i');
      const givenRegex = new RegExp(`^${given}$`, 'i');
  
      const ips = await IPSModel.findOne({
        "patient.name": nameRegex,
        "patient.given": givenRegex,
      }).exec();
  
      if (!ips) {
        return res.status(404).json({ message: "IPS record not found" });
      }
  
      const generateBundleFunction = pickIPSFormat(req.headers['x-ips-format']);
      const bundle = generateBundleFunction(ips);
  
      if (!bundle) {
        return res.status(500).json({ message: "Error generating IPS bundle" });
      }
  
      res.json(bundle);
    } catch (err) {
      console.error('Error in getIPSBundleByName:', err);
      res.status(400).send(err);
    }
  }
  

module.exports = { getIPSBundleByName };

