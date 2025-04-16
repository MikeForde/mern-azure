const { gql } = require('graphql-tag');

const typeDefs = gql`
  type IPSRecord {
    id: ID!
    content: String
  }

  type Query {
    "Return all available IPS records"
    getAllIPS: [IPSRecord]

    "Fetch IPS Bundle by ID in full FHIR JSON"
    getIPSById(id: ID!): IPSRecord

    "Fetch a simplified plain-text IPS summary"
    getIPSBasic(id: ID!): IPSRecord

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
  }
`;

module.exports = typeDefs;
