const { gql } = require('graphql-tag');

const typeDefs = gql`
  """
  Generic response wrapper used by this GraphQL layer.

  Notes:
  - content is usually returned as a string
  - JSON payloads are stringified JSON
  - plain text / XML / HTML are returned as plain strings
  """
  type ApiResult {
    id: ID
    status: Int
    contentType: String
    content: String
    message: String
  }

  """
  Standard mutation result wrapper.
  """
  type MutationResult {
    ok: Boolean!
    id: ID
    status: Int
    contentType: String
    content: String
    message: String
  }

  type Query {
    """
    Return all available IPS records.

    Example:
    query {
      getAllIPS {
        id
        status
        contentType
        content
      }
    }
    """
    getAllIPS: [ApiResult]

    """
    Return the lightweight IPS list if you expose /ips/list in REST.

    Example:
    query {
      getAllIPSList {
        id
        content
      }
    }
    """
    getAllIPSList: [ApiResult]

    """
    Fetch the raw IPS record by ID.

    Example:
    query {
      getIPSRaw(id: "12345") {
        id
        content
      }
    }
    """
    getIPSRaw(id: ID!): ApiResult

    """
    Fetch the Mongo-style IPS record by ID.

    Example:
    query {
      getIPSMongo(id: "12345") {
        id
        content
      }
    }
    """
    getIPSMongo(id: ID!): ApiResult

    """
    Fetch the expanded IPS FHIR JSON by ID.

    Optional flags:
    - narrative: 0 or 1
    - resourceNarrative: 0 or 1

    Example:
    query {
      getIPSExpanded(id: "12345", narrative: 1, resourceNarrative: 0) {
        id
        content
      }
    }
    """
    getIPSExpanded(
      id: ID!
      narrative: Int = 0
      resourceNarrative: Int = 0
    ): ApiResult

    """
    Fetch the NHS SCR IPS FHIR JSON by ID.

    Example:
    query {
      getIPSNhsScr(id: "12345", narrative: 1, resourceNarrative: 1) {
        id
        content
      }
    }
    """
    getIPSNhsScr(
      id: ID!
      narrative: Int = 0
      resourceNarrative: Int = 0
    ): ApiResult

    """
    Fetch the EPS IPS FHIR JSON by ID.

    Example:
    query {
      getIPSEPS(id: "12345", narrative: 1, resourceNarrative: 1) {
        id
        content
      }
    }
    """
    getIPSEPS(
      id: ID!
      narrative: Int = 0
      resourceNarrative: Int = 0
    ): ApiResult

    """ 
    Fetch the unified IPS FHIR JSON by ID.

    Example:
    query {
      getIPSUnified(id: "12345") {
        id
        content
      }
    }
    """
    getIPSUnified(id: ID!): ApiResult

    """
    Fetch the legacy IPS FHIR JSON by ID.

    Example:
    query {
      getIPSLegacy(id: "12345") {
        id
        content
      }
    }
    """
    getIPSLegacy(id: ID!): ApiResult

    """
    Fetch the IPS as FHIR XML by ID.

    Example:
    query {
      getIPSXML(id: "12345") {
        id
        contentType
        content
      }
    }
    """
    getIPSXML(id: ID!): ApiResult

    """
    Fetch the basic plain-text IPS by ID.

    Example:
    query {
      getIPSBasic(id: "12345") {
        id
        content
      }
    }
    """
    getIPSBasic(id: ID!): ApiResult

    """
    Fetch the human-readable plain-text IPS by ID.

    Example:
    query {
      getIPSPlainText(id: "12345") {
        id
        content
      }
    }
    """
    getIPSPlainText(id: ID!): ApiResult

    """
    Fetch the BEER version by ID.

    Allowed delim values:
    - "semi"
    - "colon"
    - "pipe"
    - "at"
    - "newline"

    Example:
    query {
      getIPSBeer(id: "12345", delim: "pipe") {
        id
        content
      }
    }
    """
    getIPSBeer(id: ID!, delim: String): ApiResult

    """
    Fetch the HL7 2.x version by ID.

    Example:
    query {
      getIPSHL72_x(id: "12345") {
        id
        content
      }
    }
    """
    getIPSHL72_x(id: ID!): ApiResult

    """
    Fetch the NPS version by ID.

    protect values:
    - 0 = none
    - 1 = field-level encryption
    - 2 = omit identifiers

    Example:
    query {
      getNPS(id: "12345", protect: 0) {
        id
        content
      }
    }
    """
    getNPS(id: ID!, protect: Int = 0): ApiResult

    """
    Fetch split NPS NFC payloads by ID.

    Example:
    query {
      getNPSNFC(id: "12345", protect: 0) {
        id
        content
      }
    }
    """
    getNPSNFC(id: ID!, protect: Int = 0): ApiResult

    """
    Fetch the data-split proof-of-concept payload by ID.

    Example:
    query {
      getIPSDataSplitPOC(id: "12345") {
        id
        content
      }
    }
    """
    getIPSDataSplitPOC(id: ID!): ApiResult

    """
    Fetch an IPS Bundle by patient name and given name.

    format values:
    - "unified"
    - "inter"
    - "nhsscr"
    - "legacy"

    Example:
    query {
      getIPSByName(name: "Smith", given: "John", format: "unified") {
        id
        content
      }
    }
    """
    getIPSByName(
      name: String!
      given: String!
      format: String = "unified"
    ): ApiResult

    """
    Search IPS records by patient name.

    Example:
    query {
      searchIPS(name: "Smith") {
        id
        content
      }
    }
    """
    searchIPS(name: String!): [ApiResult]

    """
    Fetch IPS data from ORA by patient name and given name.

    Example:
    query {
      fetchIPSORA(name: "Smith", givenName: "John") {
        content
      }
    }
    """
    fetchIPSORA(name: String!, givenName: String!): ApiResult

    """
    Send a test XMPP message.

    Example:
    query {
      xmppTestSendMessage(msg: "Hello from GraphQL") {
        content
      }
    }
    """
    xmppTestSendMessage(msg: String): ApiResult

    """
    Return the TAK browser HTML page as a string.

    Example:
    query {
      takBrowser(id: "12345") {
        contentType
        content
      }
    }
    """
    takBrowser(id: ID!): ApiResult
  }

  type Mutation {
    """
    Create a new IPS record.

    Pass the Mongo-style JSON body as a string.

    Example:
    mutation {
      addIPS(
        json: "{\\"packageUUID\\":\\"abc-123\\",\\"timeStamp\\":\\"2026-03-12T10:00:00.000Z\\",\\"patient\\":{\\"name\\":\\"Smith\\",\\"given\\":\\"John\\",\\"dob\\":\\"1980-01-01\\"}}"
      ) {
        ok
        status
        content
      }
    }
    """
    addIPS(json: String!): MutationResult

    """
    Create multiple IPS records from a JSON array string.
    """
    addIPSMany(json: String!): MutationResult

    """
    Create IPS records from an IPS Bundle JSON string.
    """
    addIPSFromBundle(json: String!): MutationResult

    """
    Push IPS Bundle JSON to ORA.
    """
    pushIPSORA(json: String!): MutationResult

    """
    Push IPS Bundle JSON to NLD.
    """
    pushIPSNLD(json: String!): MutationResult

    """
    Push IPS Bundle JSON using the unified push route.
    """
    pushIPS(json: String!): MutationResult

    """
    Create Mongo-style IPS records from BEER plain text.
    """
    addIPSFromBEER(text: String!): MutationResult

    """
    Create Mongo-style IPS records from CDA XML.
    """
    addIPSFromCDA(xml: String!): MutationResult

    """
    Create Mongo-style IPS records from HL7 2.x plain text.
    """
    addIPSFromHL72x(text: String!): MutationResult

    """
    Convert Mongo-style JSON to BEER.
    """
    convertMongoToBEER(json: String!): MutationResult

    """
    Convert Mongo-style JSON to HL7 2.x.
    """
    convertMongoToHL72x(json: String!): MutationResult

    """
    Convert BEER plain text to Mongo-style JSON.
    """
    convertBEERToMongo(text: String!): MutationResult

    """
    Convert BEER plain text to IPS JSON.

    format values:
    - "unified"
    - "inter"
    - "nhsscr"
    - "legacy"
    """
    convertBEERToIPS(text: String!, format: String = "unified"): MutationResult

    """
    Convert IPS JSON to BEER.
    """
    convertIPSToBEER(json: String!): MutationResult

    """
    Convert IPS JSON to plain text.
    """
    convertIPSToPlainText(json: String!): MutationResult

    """
    Convert IPS JSON to Mongo-style JSON.
    """
    convertIPSToMongo(json: String!): MutationResult

    """
    Convert CDA XML to IPS JSON.

    format values:
    - "unified"
    - "inter"
    - "nhsscr"
    - "legacy"
    """
    convertCDAToIPS(xml: String!, format: String = "unified"): MutationResult

    """
    Convert CDA XML to BEER.
    """
    convertCDAToBEER(xml: String!): MutationResult

    """
    Convert CDA XML to Mongo-style JSON.
    """
    convertCDAToMongo(xml: String!): MutationResult

    """
    Convert HL7 2.x plain text to Mongo-style JSON.
    """
    convertHL72xToMongo(text: String!): MutationResult

    """
    Convert HL7 2.x plain text to IPS JSON.

    format values:
    - "unified"
    - "inter"
    - "nhsscr"
    - "legacy"
    """
    convertHL72xToIPS(text: String!, format: String = "unified"): MutationResult

    """
    Generic XML to JSON conversion.
    """
    convertXML(xml: String!): MutationResult

    """
    FHIR XML to FHIR JSON conversion.
    """
    convertFHIRXML(xml: String!): MutationResult

    """
    Validate a JSON payload against the NPS schema.
    """
    validateNPS(json: String!): MutationResult

    """
    Validate a FHIR JSON payload against the NHS SCR IPS schema.
    """
    validateNhsScr(json: String!): MutationResult

    """
    Validate a FHIR JSON payload against the EPS IPS schema.
    """
    validateEps(json: String!): MutationResult  

    """
    Update an IPS record by Mongo/Object ID.
    """
    updateIPS(id: ID!, json: String!): MutationResult

    """
    Update an IPS record by package UUID.
    """
    updateIPSByUUID(uuid: String!, json: String!): MutationResult

    """
    Delete an IPS record by ID.
    """
    deleteIPS(id: ID!): MutationResult

    """
    Delete IPS records by practitioner.
    """
    deleteIPSByPractitioner(practitioner: String!): MutationResult

    """
    Send a message to XMPP.

    Example:
    mutation {
      xmppPost(msg: "Hello room", room: "demo@conference.example.org") {
        ok
        content
      }
    }
    """
    xmppPost(msg: String!, room: String): MutationResult

    """
    Fetch an IPS record by ID and broadcast it to XMPP.
    """
    xmppSendIPS(id: ID!): MutationResult

    """
    Fetch an IPS record by ID and send it privately to a named sender/occupant.
    """
    xmppSendIPSPrivate(id: ID!, from: String!): MutationResult

    """
    Send a test TAK CoT message.
    """
    takTest(cot: String): MutationResult

    """
    Resolve an IPS record by ID and send it in TAK CoT format.
    """
    takIPS(id: ID!): MutationResult
  }
`;

module.exports = typeDefs;