import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import QRPage from './pages/QRPage';
import DataUploadPage from './pages/DataUploadPage';
import NavigationBar from './appcomp/NavigationBar';

function App() {
  return (
    <Router>
      <NavigationBar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/qr" element={<QRPage />} />
        <Route path="/bulkupload" element={<DataUploadPage />} />
      </Routes>
    </Router>
  );
}

export default App;
