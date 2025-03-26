const express = require('express');
const axios = require('axios');
const { resolveId } = require('../utils/resolveId'); // your function to get the IPS record

const router = express.Router();

router.post('/pmr/:id', async (req, res) => {
    const id = req.params.id;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    // This creates an ID like: IPS-1UK-MER01-2023MAR10Z1015-01
    const patientId = `IPS-1UK-MER01-${year}${month}${day}Z${hour}${minute}-01`;
    try {
        // 1. Retrieve the IPS record from MongoDB
        const ipsRecord = await resolveId(id);
        if (!ipsRecord) {
            return res.status(404).send('IPS record not found');
        }

        // 2. Get an access token from IdentityServer
        const tokenResponse = await axios.post(
            'https://track.medis.org.uk/identity/connect/token',
            new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: 'IPSMERN',
                client_secret: 'e7d42f7c-d087-4789-9fc1-71e679bb8c8b',
                scope: 'medmmapi'
            }).toString(),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );
        const accessToken = tokenResponse.data.access_token;

        //console.log("Access Token", accessToken);

        // 3. Build the PMR XML using data from the IPS record.
        // Adjust the substitutions as needed.
        const pmrXml = `
<urn:PatientMovementRequest mtfid="PMR" xmlns:urn="urn:nato:mtf:adatp-3:june%202021:pmr">
  <MessageIdentifier setid="MSGID" setSeq="3">
    <MessageTextFormatIdentifier ffSeq="1" ffirnFudn="FF1018-2">PMR</MessageTextFormatIdentifier>
    <Standard ffSeq="2" ffirnFudn="FF1589-8">ADATP-3</Standard>
    <Version ffSeq="3" ffirnFudn="FF1589-9">JUNE 2021</Version>
    <Originator ffSeq="4" ffirnFudn="FF1029-1">NATION</Originator>
    <MessageSerialNumber ffSeq="5" ffirnFudn="FF1012-7">PMR001</MessageSerialNumber>    
    <ReferenceTimeOfPublication ffSeq="6">
      <MonthNameAbbreviated ffirnFudn="FF1004-1">JUN</MonthNameAbbreviated>
    </ReferenceTimeOfPublication>
    <Policy ffSeq="9" ffirnFudn="FF1288-5">NATO</Policy>
    <Sensitivity ffSeq="10" ffirnFudn="FF1288-12">UNCLASSIFIED</Sensitivity>
  </MessageIdentifier>
  <PatientDetails setid="PATDET" setSeq="6">
    <PatientId ffSeq="1" ffirnFudn="FF1012-230">${patientId}</PatientId>
    <PatientIdStatus ffSeq="2" ffirnFudn="FF1584-39">PERM</PatientIdStatus>
    <PatientSecondName ffSeq="3" ffirnFudn="FF1022-26">${ipsRecord.patient.name || 'Unknown'}</PatientSecondName>
    <PatientFirstNameS ffSeq="4" ffirnFudn="FF1022-3">${ipsRecord.patient.given || 'Unknown'}</PatientFirstNameS>
    <DateOfBirth ffSeq="5" ffirnFudn="FF2001-1">
      <Day>${ipsRecord.patient.dob ? new Date(ipsRecord.patient.dob).getDate() : ''}</Day>
      <MonthNameAbbreviated>${ipsRecord.patient.dob ? new Date(ipsRecord.patient.dob).toLocaleString('en-US', { month: 'short' }).toUpperCase() : ''}</MonthNameAbbreviated>
      <Year4Digit>${ipsRecord.patient.dob ? new Date(ipsRecord.patient.dob).getFullYear() : ''}</Year4Digit>
    </DateOfBirth>
    <Gender ffSeq="6" ffirnFudn="FF1286-2">${(ipsRecord.patient.gender || 'UNKNOWN').toUpperCase()}</Gender>
    <Weight ffSeq="7" ffirnFudn="FF1194-4">100</Weight>
    <Age ffSeq="8" ffirnFudn="FF1023-3">22</Age>
    <Unit ffSeq="9">
      <UnitName ffirnFudn="FF1022-48">FN1</UnitName>
    </Unit>
    <Nationality ffSeq="10">
      <GeographicalEntity ffirnFudn="FF1265-1">${ipsRecord.patient.nation || 'UNK'}</GeographicalEntity>
    </Nationality>
    <PatientStatus ffSeq="11" ffirnFudn="FF1282-5">E</PatientStatus>
    <PatientType ffSeq="12" ffirnFudn="FF1282-4">E</PatientType>
  </PatientDetails>
  <PatientReady setid="PATREAD" setSeq="7">
    <PatientReadyToMove ffSeq="1" ffirnFudn="FF2033-1">
      <Day>31</Day>
      <HourTime>23</HourTime>
      <MinuteTime>59</MinuteTime>
      <TimeZone>Z</TimeZone>
      <MonthNameAbbreviated>DEC</MonthNameAbbreviated>
      <Year4Digit>2023</Year4Digit>
    </PatientReadyToMove>
  </PatientReady>
  <MtfTransfer setid="MTFTRANS" setSeq="8">
    <MtfOrigination ffSeq="1">
      <UnitName ffirnFudn="FF1022-48">UK1</UnitName>
    </MtfOrigination>
    <RequestingUnitLocation ffSeq="2">
      <NationalGridSystemCoordinates ffirnFudn="FF1911-1">11111</NationalGridSystemCoordinates>
    </RequestingUnitLocation>
    <MtfDestination ffSeq="3">
      <UnitName ffirnFudn="FF1022-48">FN1</UnitName>
    </MtfDestination>
    <DestinationUnitLocation ffSeq="4">
      <NationalGridSystemCoordinates ffirnFudn="FF1911-1">22222</NationalGridSystemCoordinates>
    </DestinationUnitLocation>
  </MtfTransfer>
  <ReasonForMovement setid="GENTEXT" setSeq="9">
    <TextIndicator ffSeq="1" ffirnFudn="FF1009-1">TI</TextIndicator>
    <FreeText xml:space="preserve" ffSeq="2" ffirnFudn="FF1006-1">Reason for movement - IPS MERN API Test</FreeText>
  </ReasonForMovement>
  <Diagnosis setid="GENTEXT" setSeq="10">
    <TextIndicator ffSeq="1" ffirnFudn="FF1009-1">TI</TextIndicator>
    <FreeText xml:space="preserve" ffSeq="2" ffirnFudn="FF1006-1">${ipsRecord.conditions.map(c => c.name).join(', ') || 'No conditions'}</FreeText>
  </Diagnosis>
  <ClinicalHistory setid="GENTEXT" setSeq="12">
    <TextIndicator ffSeq="1" ffirnFudn="FF1009-1">TI</TextIndicator>
    <FreeText xml:space="preserve" ffSeq="2" ffirnFudn="FF1006-1">${ipsRecord.allergies.map(a => a.name).join(', ') || 'No allergies'}</FreeText>
  </ClinicalHistory>
  <Medications setid="GENTEXT" setSeq="13">
    <TextIndicator ffSeq="1" ffirnFudn="FF1009-1">TI</TextIndicator>
    <FreeText xml:space="preserve" ffSeq="2" ffirnFudn="FF1006-1">${ipsRecord.medication.map(m => m.name).join(', ') || 'No medications'}</FreeText>
  </Medications>
  <Procedures setid="GENTEXT" setSeq="14">
    <TextIndicator ffSeq="1" ffirnFudn="FF1009-1">TI</TextIndicator>
    <FreeText xml:space="preserve" ffSeq="2" ffirnFudn="FF1006-1">${ipsRecord.observations.map(o => o.name).join(', ') || 'No procedures'}</FreeText>
  </Procedures>
  <Equipment setid="GENTEXT" setSeq="15">
    <TextIndicator ffSeq="1" ffirnFudn="FF1009-1">TI</TextIndicator>
    <FreeText xml:space="preserve" ffSeq="2" ffirnFudn="FF1006-1">EQUIPMENT</FreeText>
  </Equipment>
  <AttendantRequired setid="ATTREQ" setSeq="16">
    <AffirmativeOrNegativeIndicator ffSeq="1" ffirnFudn="FF1027-1">YES</AffirmativeOrNegativeIndicator>
    <GroupOfFields>
      <DetailsOfAttendant ffSeq="2" ffirnFudn="FF1357-1">ATTENDANT 1</DetailsOfAttendant>
    </GroupOfFields>
    <GroupOfFields>
      <DetailsOfAttendant ffSeq="2" ffirnFudn="FF1357-1">ATTENDANT 2</DetailsOfAttendant>
    </GroupOfFields>
  </AttendantRequired>
  <AttendingPhysician setid="ATTPHYS" setSeq="17">
    <NameAndRankOfPhysician ffSeq="1" ffirnFudn="FF1022-72">NAME AND RANK</NameAndRankOfPhysician>
    <ContactTelephoneNumber ffSeq="2" ffirnFudn="FF1361-2">123456789</ContactTelephoneNumber>  
  </AttendingPhysician>
  <OverallAssessment setid="GENTEXT" setSeq="21">
    <TextIndicator ffSeq="1" ffirnFudn="FF1009-1">TI</TextIndicator>
    <FreeText xml:space="preserve" ffSeq="2" ffirnFudn="FF1006-1">OVERALL ASSESSMENT</FreeText>
  </OverallAssessment>
  <Remarks setid="RMKS">
    <FreeText xml:space="preserve" ffSeq="1" ffirnFudn="FF1006-1">REMARKS</FreeText>
  </Remarks>
</urn:PatientMovementRequest>
    `.trim();

        // console.log("PMR XML",
        //     pmrXml
        //         .split('\n')
        //         .map(l => l.trim())
        //         .join('')
        // );

        // 4. Post the PMR XML to the API endpoint using the access token
        const pmrResponse = await axios.post(
            'https://track.medis.org.uk/api/api/pmrs/create-app11e',
            pmrXml,
            {
                headers: {
                    'Content-Type': 'application/xml',
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        // Return the PMR API response to the client
        res.status(200).send(pmrResponse.data);
    } catch (error) {
        console.error('Error in PMR processing:', error.response ? error.response.data : error.message);
        res.status(500).send('Error processing PMR');
    }
});

module.exports = router;
