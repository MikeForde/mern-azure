const { resolveId } = require('../utils/resolveId');
const { IPSModel } = require('../models/IPSModel');

// Fetch a single IPS record by ID in raw format
async function getIPSRaw(req, res) {
    const id = req.params.id;

    try {
        // Resolve the ID and fetch the IPS record
        const ips = await resolveId(id);

        if (!ips) {
            return res.status(404).json({ message: "IPS record not found" });
        }

        // Check if 'pretty' query parameter is true and format accordingly
        if (req.query.pretty === 'true') {
            const formattedJson = JSON.stringify(ips, null, "\t");
            res.send(formattedJson);
        } else {
            res.json(ips);
        }
    } catch (error) {
        console.error("Error fetching IPS record:", error);
        res.status(400).send(error.message || "Invalid request");
    }
}

// Fetch all IPS records
async function getAllIPS(req, res) {
    try {
      const ipss = await IPSModel.find({}).exec();
      res.json(ipss);
    } catch (error) {
      console.error("Error fetching all IPS records:", error);
      res.status(400).send(error.message || "Invalid request");
    }
  }
  

module.exports = { getIPSRaw, getAllIPS };
