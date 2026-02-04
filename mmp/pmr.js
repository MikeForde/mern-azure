const express = require('express');
const axios = require('axios');
const { resolveId } = require('../utils/resolveId'); // your function to get the IPS record
const { XMLParser } = require('fast-xml-parser');

const router = express.Router();

const mmpBaseUrl = 'https://mm.medis.org.uk/';

async function fetchActiveMtfCodes() {
  const soapBody = `
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nvg="https://tide.act.nato.int/wsdl/2012/nvg" xmlns:nvg1="https://tide.act.nato.int/schemas/2012/10/nvg">
          <soapenv:Header />
          <soapenv:Body>
            <nvg:GetNvg />
          </soapenv:Body>
        </soapenv:Envelope>`.trim();

  const resp = await axios.post(
    `${mmpBaseUrl}webservice/NvgMtfService.asmx`,
    soapBody,
    {
      headers: {
        'Content-Type': 'application/xml',
      },
      // optional but sometimes helps with SOAP endpoints
      responseType: 'text',
      timeout: 15000,
    }
  );

  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true, // strips s:, soapenv:, etc.
    trimValues: true,
  });

  const obj = parser.parse(resp.data);

  // Navigate to: Envelope -> Body -> GetNvgResponse -> nvg -> point[]
  const points =
    obj?.Envelope?.Body?.GetNvgResponse?.nvg?.point ||
    obj?.Envelope?.Body?.GetNvgResponse?.nvg?.Point ||
    [];

  const pointsArr = Array.isArray(points) ? points : [points];

  // Each point has ExtendedData -> SimpleData[] with keys, we want key="Code"
  const codes = [];
  for (const p of pointsArr) {
    const ed = p?.ExtendedData;
    if (!ed) continue;

    const simpleData = ed?.SimpleData || [];
    const sdArr = Array.isArray(simpleData) ? simpleData : [simpleData];

    for (const sd of sdArr) {
      const key = sd?.['@_key'];
      if (key === 'Code') {
        const code = (typeof sd === 'string' ? sd : sd?.['#text'] ?? sd) + '';
        const cleaned = code.trim().toUpperCase();
        if (cleaned) codes.push(cleaned);
      }
    }
  }

  // Unique + sanity filter
  return [...new Set(codes)].filter(c => /^[A-Z0-9]{2,6}$/.test(c));
}

router.get('/pmr/mtfs', async (req, res) => {
  try {
    const mtfs = await fetchActiveMtfCodes(); // reuse your function (move it outside the POST handler)
    res.json({ mtfs });
  } catch (e) {
    res.status(500).send(`Failed to load MTFs: ${e.message}`);
  }
});

router.post('/pmr/:id', async (req, res) => {
  const id = req.params.id;
  const fromQ = (req.query.from || '').toString().trim().toUpperCase();
  const toQ = (req.query.to || '').toString().trim().toUpperCase();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');

  const readyDay = String(now.getDate()).padStart(2, '0');
  const readyHour = String(now.getHours()).padStart(2, '0');
  const readyMinute = String(now.getMinutes()).padStart(2, '0');
  const readyMonth = month;      // you already have this as "JAN/FEB/..."
  const readyYear = String(year);

  try {
    // 1. Retrieve the IPS record from MongoDB
    const ipsRecord = await resolveId(id);
    if (!ipsRecord) {
      return res.status(404).send('IPS record not found');
    }

    // Extract the first three letters of the first name and surname, and convert them to uppercase.
    const firstNameSub = (ipsRecord.patient.given || 'UNK').substring(0, 3).toUpperCase();
    const surnameSub = (ipsRecord.patient.name || 'UNK').substring(0, 3).toUpperCase();

    // Construct the patient ID in the format: IPS-[first 3 letters of first name]-[first 3 letters of surname]01-[year][month][day]Z[hour][minute]-01
    const patientId = `IPS-${firstNameSub}-${surnameSub}01-${year}${month}${day}Z${hour}${minute}-01`;

    // 2. Get an access token from IdentityServer
    function pickTwoDistinct(arr) {
      if (!arr || arr.length < 2) return null;
      const i = Math.floor(Math.random() * arr.length);
      let j = Math.floor(Math.random() * (arr.length - 1));
      if (j >= i) j++;
      return [arr[i], arr[j]];
    }

    function isValidMtf(code) {
      return /^[A-Z0-9]{2,6}$/.test(code);
    }

    let mtfOrig = 'IV1';
    let mtfDest = 'BR1';

    if (fromQ || toQ) {
      // If user supplies one, require both (clear error to frontend)
      if (!fromQ || !toQ) {
        return res.status(400).send('PMR requires both query parameters: ?from=XXX&to=YYY');
      }
      if (!isValidMtf(fromQ) || !isValidMtf(toQ)) {
        return res.status(400).send('Invalid MTF code(s). Expected 2–6 chars A-Z/0-9.');
      }
      if (fromQ === toQ) {
        return res.status(400).send('From and To MTF cannot be the same.');
      }
      mtfOrig = fromQ;
      mtfDest = toQ;
    } else {
      // Backward-compatible behaviour: random, then fallback
      try {
        const mtfs = await fetchActiveMtfCodes();
        const picked = pickTwoDistinct(mtfs);
        if (picked) {
          [mtfOrig, mtfDest] = picked;
        }
      } catch (e) {
        console.warn('Failed to fetch MTF list from NVG, falling back to IV1/BR1:', e.message);
      }
    }

    const tokenResponse = await axios.post(
      `${mmpBaseUrl}identity/connect/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: 'IPS1',
        client_secret: '009efe3d-7553-4ee6-acb4-f548790d63e9',
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
    <PatientSecondName ffSeq="3" ffirnFudn="FF1022-26">${(ipsRecord.patient.name).toUpperCase() || 'UNKNOWN'}</PatientSecondName>
    <PatientFirstNameS ffSeq="4" ffirnFudn="FF1022-3">${(ipsRecord.patient.given).toUpperCase() || 'UNKNOWN'}</PatientFirstNameS>
    <DateOfBirth ffSeq="5" ffirnFudn="FF2001-1">
      <Day>${ipsRecord.patient.dob
        ? String(new Date(ipsRecord.patient.dob).getDate()).padStart(2, '0')
        : ''
      }</Day>
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
      <GeographicalEntity ffirnFudn="FF1265-1">${ipsRecord.patient.nation || 'GBR'}</GeographicalEntity>
    </Nationality>
    <PatientStatus ffSeq="11" ffirnFudn="FF1282-5">E</PatientStatus>
    <PatientType ffSeq="12" ffirnFudn="FF1282-4">E</PatientType>
  </PatientDetails>
  <PatientReady setid="PATREAD" setSeq="7">
    <PatientReadyToMove ffSeq="1" ffirnFudn="FF2033-1">
      <Day>${readyDay}</Day>
      <HourTime>${readyHour}</HourTime>
      <MinuteTime>${readyMinute}</MinuteTime>
      <TimeZone>Z</TimeZone>
      <MonthNameAbbreviated>${readyMonth}</MonthNameAbbreviated>
      <Year4Digit>${readyYear}</Year4Digit>
    </PatientReadyToMove>
  </PatientReady>
  <MtfTransfer setid="MTFTRANS" setSeq="8">
    <MtfOrigination ffSeq="1">
      <UnitName ffirnFudn="FF1022-48">${mtfOrig}</UnitName>
    </MtfOrigination>
    <RequestingUnitLocation ffSeq="2">
      <NationalGridSystemCoordinates ffirnFudn="FF1911-1">11111</NationalGridSystemCoordinates>
    </RequestingUnitLocation>
    <MtfDestination ffSeq="3">
      <UnitName ffirnFudn="FF1022-48">${mtfDest}</UnitName>
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
    <FreeText xml:space="preserve" ffSeq="2" ffirnFudn="FF1006-1">${ipsRecord.conditions.map(c => c.name).join(', ').toUpperCase() || 'NO CONDITIONS'}</FreeText>
  </Diagnosis>
  <History setid="GENTEXT" setSeq="11">
    <TextIndicator ffSeq="1" ffirnFudn="FF1009-1">TI</TextIndicator>
    <FreeText xml:space="preserve" ffSeq="2" ffirnFudn="FF1006-1">${ipsRecord.allergies.map(a => a.name).join(', ').toUpperCase() || 'NO ALLERGIES'}</FreeText>
  </History>
  <ClinicalHistory setid="GENTEXT" setSeq="12">
    <TextIndicator ffSeq="1" ffirnFudn="FF1009-1">TI</TextIndicator>
    <FreeText xml:space="preserve" ffSeq="2" ffirnFudn="FF1006-1">CLINICAL HISTORY</FreeText>
  </ClinicalHistory>
  <Medications setid="GENTEXT" setSeq="13">
    <TextIndicator ffSeq="1" ffirnFudn="FF1009-1">TI</TextIndicator>
    <FreeText xml:space="preserve" ffSeq="2" ffirnFudn="FF1006-1">${ipsRecord.medication.map(m => m.name).join(', ').toUpperCase() || 'NO MEDICATIONS'}</FreeText>
  </Medications>
  <Procedures setid="GENTEXT" setSeq="14">
    <TextIndicator ffSeq="1" ffirnFudn="FF1009-1">TI</TextIndicator>
    <FreeText xml:space="preserve" ffSeq="2" ffirnFudn="FF1006-1">${ipsRecord.observations.map(o => o.name).join(', ').toUpperCase() || 'NO OBSERVATIONS'}</FreeText>
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
    //   pmrXml
    //     .split('\n')
    //     .map(l => l.trim())
    //     .join('')
    // );

    // 4. Post the PMR XML to the API endpoint using the access token
    const pmrResponse = await axios.post(
      `${mmpBaseUrl}api/api/pmrs/create-app11e`,
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
    const errorMessage = error.response && error.response.data
      ? `Error processing PMR: ${JSON.stringify(error.response.data)}`
      : `Error processing PMR: ${error.message}`;
    console.error(errorMessage);
    res.status(500).send(errorMessage);
  }
});

module.exports = router;
