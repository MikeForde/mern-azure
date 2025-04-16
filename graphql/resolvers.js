const { getAllIPS } = require('../servercontrollers/ipsDatabaseFormats');
const { getIPSBundle } = require('../servercontrollers/ipsBundleFormat');
const { getIPSBasic } = require('../servercontrollers/ipsBasicFormat');
const { getIPSBEER } = require('../servercontrollers/ipsBEERFormat');
const { getIPSBundleByName } = require('../servercontrollers/ipsBundleByName');


const resolvers = {
    Query: {
        getAllIPS: async () => {
            const mockReq = {};
            const mockRes = {
              jsonResult: null,
              json(data) {
                this.jsonResult = data;
              }
            };
            await getAllIPS(mockReq, mockRes);
            return mockRes.jsonResult.map(r => ({
              id: r._id || r.id,
              content: JSON.stringify(r),
            }));
          },
  
      getIPSById: async (_, { id }) => {
        const mockReq = { params: { id } };
        const mockRes = {
          jsonResult: null,
          json(data) {
            this.jsonResult = data;
          }
        };
        await getIPSBundle(mockReq, mockRes);
        return { id, content: JSON.stringify(mockRes.jsonResult) };
      },
  
      getIPSBasic: async (_, { id }) => {
        const mockReq = { params: { id } };
        let rawText = '';
      
        await new Promise((resolve, reject) => {
          getIPSBasic(mockReq, {
            set: () => {},
            send: (data) => {
              rawText = data;
              resolve();
            },
            status: () => ({
              send: (err) => reject(new Error(err)),
            }),
          });
        });
      
        return { id, content: rawText };
      },
  
      getIPSBeer: async (_, { id, delim }) => {
        const mockReq = { params: { id, delim: delim || '' } };
        let rawText = '';
      
        await new Promise((resolve, reject) => {
          getIPSBEER(mockReq, {
            set: () => {},
            send: (data) => {
              rawText = data;
              resolve();
            },
            status: () => ({
              send: (err) => reject(new Error(err)),
            }),
          });
        });
      
        return { id, content: rawText };
      },
      getIPSByName: async (_, { name, given, format }) => {
        const mockReq = {
          params: { name, given },
          headers: {
            'x-ips-format': format || 'unified',  // fallback to default
          }
        };
      
        let bundle = null;
      
        await new Promise((resolve, reject) => {
          getIPSBundleByName(mockReq, {
            json: (data) => {
              bundle = data;
              resolve();
            },
            status: () => ({
              json: (err) => reject(new Error(err?.message || 'Error')),
              send: (err) => reject(new Error(err?.message || 'Error')),
            })
          });
        });
      
        return {
          id: bundle.id || 'unknown',
          content: JSON.stringify(bundle),
        };
      }
    }
  };
  

module.exports = resolvers;
