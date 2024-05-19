// src/PatientContext.js
import React, { createContext, useState } from 'react';

export const PatientContext = createContext();

export const PatientProvider = ({ children }) => {
  const [selectedPatients, setSelectedPatients] = useState([]);

  return (
    <PatientContext.Provider value={{ selectedPatients, setSelectedPatients }}>
      {children}
    </PatientContext.Provider>
  );
};
