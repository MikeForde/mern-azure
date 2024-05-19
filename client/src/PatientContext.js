// src/PatientContext.js
import React, { createContext, useState } from 'react';

export const PatientContext = createContext();

export const PatientProvider = ({ children }) => {
  const [selectedPatients, setSelectedPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);

  return (
    <PatientContext.Provider value={{ selectedPatients, setSelectedPatients, selectedPatient, setSelectedPatient }}>
      {children}
    </PatientContext.Provider>
  );
};
