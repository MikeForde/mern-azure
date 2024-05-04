require("dotenv").config();
const express = require("express");
const ReadPreference = require("mongodb").ReadPreference;
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { IPSModel } = require("./models/IPSModel");
const { getIPSBundle } = require('./servercontrollers/ipsBundleFormat');
const { getIPSRaw, getAllIPS } = require('./servercontrollers/ipsDatabaseFormats');
const getIPSBasic = require("./servercontrollers/ipsBasicFormat");

const { DB_CONN } = process.env;

const api = express();
api.use(cors()); // enable CORS on all our requests
api.use(express.json()); // parses incoming requests with JSON payloads
api.use(express.urlencoded({ extended: false })); // parses incoming requests with urlencoded payloads

mongoose
    .connect(DB_CONN, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("DB connection successful"))
    .catch(console.error);

api.get("/ips/all", getAllIPS);

api.get("/ipsraw/:id", getIPSRaw);

api.get("/ips/:id", getIPSBundle);

api.get("/ipsbasic/:id", getIPSBasic);
  
  
api.post("/ips", (req, res) => {
    console.log("req.body", req.body);

    const newIPS = new IPSModel(req.body);

    newIPS
        .save()
        .then((newIPS) => {
            res.json(newIPS);
        })
        .catch((err) => {
            res.status(400).send(err);
        });
});

api.put("/ips/:id", (req, res) => {
    const { id } = req.params;

    if (id) {
        IPSModel.findById(id)
            .read(ReadPreference.NEAREST)
            .exec()
            .then((ips) => {
                //ips.isDone = !ips.isDone;
                ips.save().then((updatedIPS) => {
                    res.json(updatedIPS);
                });
            })
            .catch((err) => {
                res.status(400).send(err);
            });
    } else {
        res.status(404).send("IPS not found.");
    }
});

api.delete("/ips/:id", (req, res) => {
    const { id } = req.params;

    if (id) {
        IPSModel.findByIdAndRemove(id)
            .then((ips) => {
                res.json(ips._id);
            })
            .catch((err) => {
                res.status(400).send(err);
            });
    }
});

api.use(express.static(path.join(__dirname, "client", "build")));
api.get("/*", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "build", "index.html"));
});

const port = process.env.PORT || 5000;
api.listen(port, () => {
    console.log(`Server is running on port: ${port}`)
  })