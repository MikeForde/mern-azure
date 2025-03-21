// proto/grpcServer.js
require("dotenv").config();
const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

// Import the Mongoose model
// Adjust the path if your IPSModel file is located elsewhere
const { IPSModel } = require("../models/IPSModel");

// Load .proto definition
const PROTO_PATH = path.join(__dirname, "ips.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,  // or false, depending on your preference
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const { IPSService } = protoDescriptor.example;

// Implement the methods
async function getIPSRecord(call, callback) {
  const { patient_uuid } = call.request;

  try {
    // Query MongoDB for the matching record by UUID
    const doc = await IPSModel.findOne({ packageUUID: patient_uuid });
    if (!doc) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: "No IPS record found for that UUID.",
      });
    }

    // Construct the response object from the Mongoose document
    const response = {
      package_uuid: doc.packageUUID,
      time_stamp: doc.timeStamp ? doc.timeStamp.toISOString() : "",
      patient: {
        name: doc.patient.name,
        given: doc.patient.given,
        dob: doc.patient.dob ? doc.patient.dob.toISOString() : "",
        gender: doc.patient.gender || "",
        nation: doc.patient.nation,
        practitioner: doc.patient.practitioner,
        organization: doc.patient.organization || "",
      },
      medication: (doc.medication || []).map((m) => ({
        name: m.name || "",
        date: m.date ? m.date.toISOString() : "",
        dosage: m.dosage || "",
        system: m.system || "",
        code: m.code || "",
        status: m.status || "",
      })),
      allergies: (doc.allergies || []).map((a) => ({
        name: a.name || "",
        criticality: a.criticality || "",
        date: a.date ? a.date.toISOString() : "",
        system: a.system || "",
        code: a.code || "",
      })),
      conditions: (doc.conditions || []).map((c) => ({
        name: c.name || "",
        date: c.date ? c.date.toISOString() : "",
        system: c.system || "",
        code: c.code || "",
      })),
      observations: (doc.observations || []).map((o) => ({
        name: o.name || "",
        date: o.date ? o.date.toISOString() : "",
        system: o.system || "",
        code: o.code || "",
        value: o.value || "",
        value_code: o.valueCode || "",
        body_site: o.bodySite || "",
      })),
      immunizations: (doc.immunizations || []).map((i) => ({
        name: i.name || "",
        system: i.system || "",
        code: i.code || "",
        date: i.date ? i.date.toISOString() : "",
        status: i.status || "",
      })),
    };

    // Return the response
    callback(null, response);
  } catch (error) {
    console.error("Error in getIPSRecord:", error);
    callback({
      code: grpc.status.UNKNOWN,
      message: "Internal server error",
    });
  }
}

async function updatePatientGivenName(call, callback) {
  const { patient_uuid, new_given_name } = call.request;
  try {
    // 1) Find the doc by patient_uuid
    const doc = await IPSModel.findOne({ packageUUID: patient_uuid });
    if (!doc) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: "No IPS record found for that UUID.",
      });
    }

    // 2) Update the doc
    doc.patient.given = new_given_name;
    await doc.save(); // persist changes

    // 3) Construct response
    const response = {
      success: true,
      message: `Updated given name to '${new_given_name}'`,
    };
    callback(null, response);
  } catch (error) {
    console.error("Error in updatePatientGivenName:", error);
    callback({
      code: grpc.status.UNKNOWN,
      message: "Internal server error",
    });
  }
}

// Create & start the gRPC server
function startGrpcServer() {
  const server = new grpc.Server();

  server.addService(IPSService.service, {
    GetIPSRecord: getIPSRecord,
    UpdatePatientGivenName: updatePatientGivenName,
  });

  const grpcPort = process.env.GRPC_PORT || "50051";
  server.bindAsync(
    `0.0.0.0:${grpcPort}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error("Error starting gRPC server:", err);
        return;
      }
      console.log(`gRPC server running on port: ${port}`);
      server.start();
    }
  );
}

// Export
module.exports = {
  startGrpcServer,
};
