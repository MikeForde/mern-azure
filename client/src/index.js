import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import { PatientProvider } from './PatientContext';

ReactDOM.render(
  <PatientProvider>
    <App />
  </PatientProvider>,
  document.getElementById('root')
);
