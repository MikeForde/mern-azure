import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import QRPage from './pages/QRPage';
import DataUploadPage from './pages/DataUploadPage';
import AboutPage from './pages/AboutPage';
import NavigationBar from './appcomp/NavigationBar';
import ChangeLogPage from './pages/ChangelogPage';
import AboutWebAppPage from './pages/AboutWebappPage';

function App() {
  return (
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
        </Routes>
      </div>
    </Router>
  );
}

export default App;
