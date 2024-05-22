import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import QRPage from './pages/QRPage';
import DataUploadPage from './pages/DataUploadPage';
import AboutPage from './pages/AboutPage';
import NavigationBar from './appcomp/NavigationBar';
import ChangeLogPage from './pages/ChangelogPage';
import AboutWebAppPage from './pages/AboutWebappPage';
import APIGETPage from './pages/APIGETPage';
import OffRoadPage from './pages/OffRoadPage';
import { PatientProvider } from './PatientContext';

function App() {
  return (
    <PatientProvider>
      <Router>
     <div style={{ paddingTop: '56px' }}> {/* Adjust the padding-top value based on your Navbar height */}
        <NavigationBar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/qr/:id?" element={<QRPage />} />
          <Route path="/bulkupload" element={<DataUploadPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/changelog" element={<ChangeLogPage />} />
          <Route path="/aboutwebapp" element={<AboutWebAppPage />} />
          <Route path="/api/:id?" element={<APIGETPage />} />
          <Route path="/ipsoffroad" element={<OffRoadPage/>} />
        </Routes>
      </div>
    </Router>
    </PatientProvider>
  );
}

export default App;
