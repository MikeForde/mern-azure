// xmppConnection.js
const { client, xml } = require("@xmpp/client");

// Import your ID resolver and IPS text formatter
const { resolveId } = require("../utils/resolveId");
const { getIPSPlainText } = require("./xmppIPSPlainText");

// We'll store the XMPP client instance in a variable so we can reuse it
let xmpp = null;

// We'll store the JID we get from 'online'
let myJid = null;

function safeEnv(varName, defaultValue) {
  const value = process.env[varName];
  if (!value) {
    console.warn(`[XMPP] Environment variable ${varName} not set. Using default: ${defaultValue}`);
    return defaultValue;
  }
  return value;
}

// Read environment variables - fallback defaults
const XMPP_SERVICE  = safeEnv("XMPP_SERVICE",  "ws://192.168.68.112:7070/ws/");
const XMPP_DOMAIN   = safeEnv("XMPP_DOMAIN",   "desktop-4tiift3");
const XMPP_USERNAME = safeEnv("XMPP_USERNAME", "mikef");
const XMPP_PASSWORD = safeEnv("XMPP_PASSWORD", "test");
// e.g. "testroom@conference.desktop-4tiift3"
const XMPP_ROOM     = safeEnv("XMPP_ROOM",     "testroom@conference.desktop-4tiift3");

// Default nickname to join room
const DEFAULT_ROOM_NICK = "IPSMern";

/**
 * Initialize a WebSocket-based XMPP client and attach event handlers.
 */
async function initXMPP_WebSocket() {
  if (xmpp) {
    // Already initialized
    return xmpp;
  }

  xmpp = client({
    service:  XMPP_SERVICE,
    domain:   XMPP_DOMAIN,
    username: XMPP_USERNAME,
    password: XMPP_PASSWORD,
    transport: "websocket",
  });

  // Handle connection errors
  xmpp.on("error", (err) => {
    console.error("XMPP error:", err);
  });

  // Called once the client is online (SASL auth + resource binding complete)
  xmpp.on("online", (address) => {
    myJid = address.toString();
    console.log("XMPP WebSocket is online as", myJid);

    // Example: join a room
    const roomJid = `${XMPP_ROOM}/${DEFAULT_ROOM_NICK}`;
    xmpp.send(
      xml("presence", { to: roomJid },
        xml("x", { xmlns: "http://jabber.org/protocol/muc" })
      )
    );

    // Send a quick message to the room
    xmpp.send(
      xml("message", { type: "groupchat", to: XMPP_ROOM },
        xml("body", {}, `Hello, this is ${DEFAULT_ROOM_NICK} from Node WebSocket!`)
      )
    );
  });

  xmpp.on("stanza", async (stanza) => {
    if (stanza.is("message")) {
      const from = stanza.attrs.from; // e.g. "mikef@desktop-4tiift3/abcdefgh"
      const messageType = stanza.attrs.type; // "groupchat", "chat", ...
      const body = stanza.getChildText("body");

      // 1) If from is our own JID (or occupant JID in a MUC), skip
      if (from && from.startsWith(myJid)) {
        // We are receiving our own message or echo, ignore
        return;
      }

      if (body) {
        console.log(`${messageType} from ${from}: ${body}`);

        try {
          // 2) Check if 'body' is a valid IPS record id
          const ipsRecord = await resolveId(body);
          if (ipsRecord) {
            // 3) Get the plain text representation
            const plainText = await getIPSPlainText(body);

            // 4) Reply directly to the sender with type="chat"
            xmpp.send(
              xml("message", { type: "chat", to: from },
                xml("body", {}, plainText)
              )
            );
          }
        } catch (err) {
          console.error("Error retrieving or sending IPS record:", err);
          // Optionally, reply with an error
          xmpp.send(
            xml("message", { type: "chat", to: from },
              xml("body", {}, "Error: Unable to retrieve IPS record.")
            )
          );
        }
      }
    }
  });

  

  // Connect (start the XMPP session)
  try {
    await xmpp.start();
    console.log("XMPP WebSocket connection started!");
    return xmpp;
  } catch (err) {
    console.error("XMPP WebSocket start error:", err);
    throw err;
  }
}

/**
 * Send a groupchat message to the specified MUC room.
 * Example usage: sendGroupMessage('testroom@conference.desktop-4tiift3', 'Hello from Node!');
 */
function sendGroupMessage(roomJid, message) {
  if (!xmpp) {
    throw new Error("XMPP client not initialized or not online yet.");
  }
  xmpp.send(
    xml("message", { type: "groupchat", to: roomJid },
      xml("body", {}, message)
    )
  );
}

function sendPrivateMessage(toJid, message) {
  if (!xmpp) {
    throw new Error("XMPP client not initialized or offline.");
  }
  xmpp.send(
    xml("message", { type: "chat", to: toJid },
      xml("body", {}, message)
    )
  );
}

module.exports = {
  initXMPP_WebSocket,
  sendGroupMessage,
  sendPrivateMessage
};
