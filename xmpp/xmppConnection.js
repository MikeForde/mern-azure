// xmppConnection.js
const { client, xml } = require("@xmpp/client");
const reconnect = require("@xmpp/reconnect");
const Connection = require("@xmpp/connection");
const net = require( 'net');
const { URL } = require ('url');

// Import your ID resolver and IPS text formatter
const { resolveId } = require("../utils/resolveId");
const { getIPSPlainText } = require("./xmppIPSPlainText");

// We'll store the XMPP client instance in a variable so we can reuse it
let xmpp = null;
let isOnline = false;
let sendQueue = [];

// We'll store the JID we get from 'online'
let myJid = null;

//    this will automatically retry start() on disconnects.
function applyReconnect(entity) {
  reconnect({ entity });
}

// helper that waits for the next “online” event
async function waitForOnline() {
  if (isOnline) return;
  await once(xmpp, "online");
}

// ➋ Monkey-patch Client._onData to ignore null chunks
const originalOnData = Connection.prototype._onData;
Connection.prototype._onData = function (chunk) {
  if (chunk == null) {
    console.warn("[XMPP] Ignoring null WebSocket frame");
    return;
  }
  return originalOnData.call(this, chunk);
};

function safeEnv(varName, defaultValue) {
  const value = process.env[varName];
  if (!value) {
    console.warn(`[XMPP] Environment variable ${varName} not set. Using default: ${defaultValue}`);
    return defaultValue;
  }
  return value;
}

// Read environment variables - fallback defaults
const XMPP_SERVICE  = safeEnv("XMPP_SERVICE",  "ws://192.168.68.115:7070/ws/");
const XMPP_DOMAIN   = safeEnv("XMPP_DOMAIN",   "desktop-4tiift3");
const XMPP_USERNAME = safeEnv("XMPP_USERNAME", "mikef");
const XMPP_PASSWORD = safeEnv("XMPP_PASSWORD", "test");
// e.g. "testroom@conference.desktop-4tiift3"
const XMPP_ROOM     = safeEnv("XMPP_ROOM",     "testroom@conference.desktop-4tiift3");

// Default nickname to join room
const DEFAULT_ROOM_NICK = "IPSMern";

// Check if the XMPP service is reachable
async function canReach(hostname, port, timeout = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket
      .once('connect',  () => { socket.destroy(); resolve(true) })
      .once('timeout',  () => { socket.destroy(); resolve(false) })
      .once('error',    () => { socket.destroy(); resolve(false) })
      .connect(port, hostname);
  });
}



/**
 * Initialize a WebSocket-based XMPP client and attach event handlers.
 */
async function initXMPP_WebSocket() {
  if (xmpp) {
    // Already initialized
    return xmpp;
  }

    // parse out host/port from XMPP_SERVICE URL
    const { hostname, port: portString } = new URL(XMPP_SERVICE);
    const port = parseInt(portString || '5222', 10);
  
    if (!(await canReach(hostname, port))) {
      console.log(`✖  XMPP server ${hostname}:${port} unreachable — skipping.`);
      return null;
    }

  xmpp = client({
    service:  XMPP_SERVICE,
    domain:   XMPP_DOMAIN,
    username: XMPP_USERNAME,
    password: XMPP_PASSWORD,
    transport: "websocket",
  });

  applyReconnect(xmpp); 

  // Handle connection errors
  xmpp.on("error", (err) => {
    console.error("XMPP error:", err);
  });

  // Called once the client is online (SASL auth + resource binding complete)
  xmpp.on("online", (address) => {
    isOnline = true;
    myJid = address.toString();
    console.log("XMPP WebSocket is online as", myJid);
    flushSendQueue();  

    // Example: join a room
    const roomJid = `${XMPP_ROOM}/${DEFAULT_ROOM_NICK}`;
    xmpp.send(
      xml("presence", { to: roomJid },
        xml("x", { xmlns: "http://jabber.org/protocol/muc" })
      )
    );

    // Send a quick message to the room
    // xmpp.send(
    //   xml("message", { type: "groupchat", to: XMPP_ROOM },
    //     xml("body", {}, `Hello, this is ${DEFAULT_ROOM_NICK} from Node WebSocket!`)
    //   )
    // );
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

function queueSend(type, stanza) {
  sendQueue.push({ type, stanza });
}
function flushSendQueue() {
  while (sendQueue.length) {
    const { type, stanza } = sendQueue.shift();
    xmpp.send(stanza);
  }
}

/**
 * Send a groupchat message to the specified MUC room.
 * Example usage: sendGroupMessage('testroom@conference.desktop-4tiift3', 'Hello from Node!');
 */
function sendGroupMessage(roomJid, message) {
  if (!xmpp || !isOnline) {
    console.log("[XMPP] offline – queuing group message");
    const stanza = xml("message", { type: "groupchat", to: roomJid },
      xml("body", {}, message)
    );
    return queueSend("group", stanza);
  }
  xmpp.send(xml("message", { type: "groupchat", to: roomJid },
    xml("body", {}, message)
  ));
}

function sendPrivateMessage(toJid, message) {
  if (!xmpp || !isOnline) {
    console.log("[XMPP] offline – queuing private message");
    const stanza = xml("message", { type: "chat", to: toJid },
      xml("body", {}, message)
    );
    return queueSend("private", stanza);
  }
  xmpp.send(xml("message", { type: "chat", to: toJid },
    xml("body", {}, message)
  ));
}

async function getRoomOccupants(roomJid) {
  if (!xmpp) {
    throw new Error("XMPP not initialized");
  }

  // If we’re offline, pause until reconnect
  await waitForOnline();

  // build & send the disco#items IQ
  const disco = xml(
    "iq",
    { to: roomJid, type: "get", id: "occupants1" },
    xml("query", { xmlns: "http://jabber.org/protocol/disco#items" })
  );

  let resp;
  try {
    resp = await xmpp.sendReceive(disco);
  } catch (err) {
    // optionally retry once after a short delay
    console.warn("[XMPP] disco#items failed, retrying…", err);
    await waitForOnline();
    resp = await xmpp.sendReceive(disco);
  }

  // parse out the <item/> elements
  const items = resp
    .getChild("query", "http://jabber.org/protocol/disco#items")
    .getChildren("item");

  return items.map((item) => item.attrs.jid);
}


module.exports = {
  initXMPP_WebSocket,
  sendGroupMessage,
  sendPrivateMessage,
  getRoomOccupants, 
};
