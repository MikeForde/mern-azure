const { gql } = require('graphql-tag');

const typeDefs = gql`
  type IPSRecord {
    id: ID!
    content: String
  }

  type Query {
    "Return all available IPS records"
    getAllIPS: [IPSRecord]

    "Fetch IPS Bundle by ID in Unified FHIR JSON"
    getIPSUnified(id: ID!): IPSRecord

    "Fetch IPS Bundle by ID in expanded FHIR JSON - i.e., that includes Composition Resource"
    getIPSExpanded(id: ID!): IPSRecord

    "Fetch IPS Bundle by ID in Legacy FHIR JSON - mainly kept for backward compatibility"
    getIPSLegacy(id: ID!): IPSRecord

    "Fetch a simplified plain-text IPS summary"
    getIPSBasic(id: ID!): IPSRecord

    "Fetch a simplified plain-text IPS summary"
    getIPSHL72_x(id: ID!): IPSRecord

    """
    Fetch BEER-format IPS by ID.

    The 'delim' argument determines how the fields are separated in the plain-text response.

    Available delim options (text to use in request vs. delimiter returned):
      - 'semi':     ;
      - 'colon':    :
      - 'pipe':     |
      - 'at':       @
      - 'newline':  \\n
    """
    getIPSBeer(
      id: ID!
      delim: String
    ): IPSRecord

    """
    Fetch an IPS Bundle by patient's last and given name.

    - Name and given are case-insensitive
    - The optional format argument determines the IPS output format Available format values for x-ips-format:
      - "unified" (default): Unified FHIR Bundle
      - "inter": More expanded FHIR Bundle with - for example - Composition Resource
      - "legacy": Deprecated legacy bundle format - just for backward compatibility and comparison
    """
    getIPSByName(
      name: String!
      given: String!
      format: String
    ): IPSRecord
  }
`;

module.exports = typeDefs;
