// src/App.js
import React, { useEffect, useContext } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import QRPage from './pages/QRPage';
import AnimatedQR2Page from './pages/AnimatedQR2Page';
import AnimatedQRReaderPage from './pages/AnimatedQRReaderPage';
import DataUploadPage from './pages/DataUploadPage';
import AboutPage from './pages/AboutPage';
import NavigationBar from './appcomp/NavigationBar';
import ChangeLogPage from './pages/ChangelogPage';
import AboutWebAppPage from './pages/AboutWebappPage';
import APIGETPage from './pages/APIGETPage';
// import OffRoadPage from './pages/OffRoadPage';
// import OffRoadPOSTPage from './pages/OffRoadPOSTPage';
// import NLDPOSTPage from './pages/NLDPOSTPage';
import UnifiedPostPage from './pages/UnifiedPostPage';
import UnifiedIPSGetPage from './pages/UnifiedIPSGetPage';
import NFCReaderPage from './pages/NFCReaderPage';
import BEERGardenPage from './pages/BEERGardenPage';
import APIDocumentationPage from './pages/APIDocumentationPage';
import IPSchemaViewer from './pages/IPSSchemaViewerPage';
import IPSchemaValidator from './pages/IPSSchemaValidatorPage';
import JWEDecryptPage from './pages/JWEDecryptPage';
import JWEMultiRecipientPage from './pages/JWEMultiRecipientPage';
import PayloadPage from './pages/PayloadPage';  
import { PatientContext } from './PatientContext';
import { PatientProvider } from './PatientContext';
import { LoadingProvider } from './contexts/LoadingContext';
import LoadingSpinner from './components/LoadingSpinner';
import io from 'socket.io-client';

function SocketListener() {
  const { setSelectedPatients, setSelectedPatient } = useContext(PatientContext);

  useEffect(() => {
    // connect to the same origin (or API_BASE_URL)
    const socket = io(/* process.env.REACT_APP_API_BASE_URL || */);

    socket.on('ipsUpdated', updated => {
      setSelectedPatients(curr =>
        curr.map(p => (p._id === updated._id ? updated : p))
      );
      setSelectedPatient(curr =>
        curr && curr._id === updated._id ? updated : curr
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [setSelectedPatients, setSelectedPatient]);

  return null; // as doesn't render anything
}

function App() {
  return (
    <PatientProvider>
      <SocketListener />
      <LoadingProvider>
        <Router>
          <div style={{ paddingTop: '56px' }}> {/* Adjust the padding-top value based on Navbar height */}
            <NavigationBar />
            <LoadingSpinner />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/qr/:id?" element={<QRPage />} />
              <Route path="/animatedqr2/:id?" element={<AnimatedQR2Page />} />
              <Route path="/animatedqrreader" element={<AnimatedQRReaderPage />} />
              <Route path="/bulkupload" element={<DataUploadPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/changelog" element={<ChangeLogPage />} />
              <Route path="/aboutwebapp" element={<AboutWebAppPage />} />
              <Route path="/api/:id?" element={<APIGETPage />} />
              <Route path="/nfc-reader" element={<NFCReaderPage />} />
              {/* <Route path="/ipsoffroad" element={<OffRoadPage />} />
              <Route path="/offroadpost/:id?" element={<OffRoadPOSTPage />} /> */}
              <Route path="/beergarden/:id?" element={<BEERGardenPage />} />
              <Route path="/apidocumentation" element={<APIDocumentationPage />} />
              <Route path="/puships" element={<UnifiedPostPage />} />
              <Route path="/fetchips" element={<UnifiedIPSGetPage />} />
              <Route path="/schemaviewer" element={<IPSchemaViewer />} />
              <Route path="/schemavalidator" element={<IPSchemaValidator />} />
              <Route path="/cwix/payload" element={<PayloadPage />} />
              <Route path="/viewer" element={<PayloadPage />} />
              <Route path="/jwe-decrypt" element={<JWEDecryptPage />} />
              <Route path="/jwe-multi" element={<JWEMultiRecipientPage />} />
            </Routes>
          </div>
        </Router>
      </LoadingProvider>
    </PatientProvider>
  );
}

export default App;
