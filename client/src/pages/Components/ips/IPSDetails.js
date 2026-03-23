import React from "react";
import { Button } from "react-bootstrap";
import { formatDate, formatDateNoTime } from "./ipsFormatters";

export default function IPSDetails({ ips, expanded, setExpanded }) {
  return (
    <div className="ips-details">
      <h5>IPS UUID: {ips.packageUUID}</h5>

      {!expanded && (
        <>
          <p>
            Patient: {ips.patient.given} {ips.patient.name}
          </p>
          <Button variant="link" onClick={() => setExpanded(true)}>
            Show More
          </Button>
        </>
      )}

      {expanded && (
        <>
          <h5>Timestamp: {formatDate(ips.timeStamp)}</h5>
          <h4>Patient Details:</h4>
          <p>Name: {ips.patient.name}</p>
          <p>Given Name: {ips.patient.given}</p>
          <p>DOB: {formatDateNoTime(ips.patient.dob)}</p>
          <p>Gender: {ips.patient.gender}</p>
          <p>Country: {ips.patient.nation}</p>
          <p>Practitioner: {ips.patient.practitioner}</p>
          <p>Organization: {ips.patient.organization}</p>
          <p>Identifier: {ips.patient.identifier}</p>
          <p>Identifier2: {ips.patient.identifier2}</p>

          {ips.medication?.length > 0 && (
            <>
              <h4>Medications:</h4>
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>System</th>
                      <th>Date</th>
                      <th>Dosage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ips.medication.map((med, index) => (
                      <tr key={index}>
                        <td>{med.name}</td>
                        <td>{med.code}</td>
                        <td>{med.system}</td>
                        <td>{formatDate(med.date)}</td>
                        <td>{med.dosage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {ips.allergies?.length > 0 && (
            <>
              <h4>Allergies:</h4>
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>System</th>
                      <th>Criticality</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ips.allergies.map((allergy, index) => (
                      <tr key={index}>
                        <td>{allergy.name}</td>
                        <td>{allergy.code}</td>
                        <td>{allergy.system}</td>
                        <td>{allergy.criticality}</td>
                        <td>{formatDateNoTime(allergy.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {ips.conditions?.length > 0 && (
            <>
              <h4>Conditions:</h4>
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>System</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ips.conditions.map((condition, index) => (
                      <tr key={index}>
                        <td>{condition.name}</td>
                        <td>{condition.code}</td>
                        <td>{condition.system}</td>
                        <td>{formatDateNoTime(condition.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {ips.observations?.length > 0 && (
            <>
              <h4>Observations:</h4>
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>System</th>
                      <th>Date</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ips.observations.map((observation, index) => (
                      <tr key={index}>
                        <td>{observation.name}</td>
                        <td>{observation.code}</td>
                        <td>{observation.system}</td>
                        <td>{formatDate(observation.date)}</td>
                        <td>{observation.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {ips.immunizations?.length > 0 && (
            <>
              <h4>Immunizations:</h4>
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Date</th>
                      <th>System</th>
                      <th>Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ips.immunizations.map((immunization, index) => (
                      <tr key={index}>
                        <td>{immunization.name}</td>
                        <td>{formatDate(immunization.date)}</td>
                        <td>{immunization.system}</td>
                        <td>{immunization.code}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {ips.procedures?.length > 0 && (
            <>
              <h4>Procedures:</h4>
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Date</th>
                      <th>System</th>
                      <th>Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ips.procedures.map((procedure, index) => (
                      <tr key={index}>
                        <td>{procedure.name}</td>
                        <td>{formatDate(procedure.date)}</td>
                        <td>{procedure.system}</td>
                        <td>{procedure.code}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <Button variant="link" onClick={() => setExpanded(false)}>
            Show Less
          </Button>
        </>
      )}
    </div>
  );
}