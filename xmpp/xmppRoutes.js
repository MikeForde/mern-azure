// xmppRoutes.js
require("dotenv").config();
const express = require("express");
const router = express.Router();

// Fallbacks for environment variables
const XMPP_ROOM = process.env.XMPP_ROOM || "testroom@conference.desktop-4tiift3";
const XMPP_DOMAIN = process.env.XMPP_DOMAIN || "desktop-4tiift3";

// Import your helper functions
const { getIPSPlainText } = require("./xmppIPSPlainText");
const { sendGroupMessage, sendPrivateMessage, getRoomOccupants } = require("./xmppConnection");

/**
 * GET /test-send-message
 * Example test route that sends a message to the group room
 */
router.get("/test-send-message", (req, res) => {
  const msg = req.query.msg || "Hello from /test-send-message route!";
  sendGroupMessage(XMPP_ROOM, msg);
  res.send(`Sent message: ${msg}`);
});

/**
 * POST /xmpp-post
 * Sends a message to a specified room (or uses XMPP_ROOM by default)
 */
router.post("/xmpp-post", (req, res) => {
  const { msg, room } = req.body;

  // Provide a default if no "room" is passed
  const roomJid = room || XMPP_ROOM;
  const message = msg || "Hello from /test-send-message route!";

  sendGroupMessage(roomJid, message);

  res.json({
    status: "Message sent",
    room: roomJid,
    message,
  });
});

/**
 * POST /xmpp-ips
 * Fetches an IPS record by ID and sends it to the group room.
 */
router.post("/xmpp-ips", async (req, res) => {
  const { id } = req.body;

  try {
    // 1) Get the plain text version of the IPS record
    const plainText = await getIPSPlainText(id);

    // 2) If null, record wasn't found
    if (!plainText) {
      return res.status(404).json({ error: "IPS record not found" });
    }

    // 3) Send the text to your XMPP chat room
    sendGroupMessage(XMPP_ROOM, plainText);

    // 4) Respond with success
    return res.json({ status: "Message sent" });
  } catch (error) {
    console.error("Error in /xmpp-ips route:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * POST /xmpp-ips-private
 * Fetches an IPS record by ID and sends it privately to an occupant or user.
 * 
 * E.g. { "id": "12345", "from": "mikef" }
 */
router.post("/xmpp-ips-private", async (req, res) => {
  const { id, from } = req.body;

  try {
    // 1) Get the plain text version of the IPS record
    const plainText = await getIPSPlainText(id);

    // 2) If null, record wasn't found
    if (!plainText) {
      return res.status(404).json({ error: "IPS record not found" });
    }

    /**
     * 3) Construct the occupant JID
     *    If you want to send a direct user message (no MUC),
     *    you could do: `${from}@${XMPP_DOMAIN}`
     */
    const occupantJid = `${XMPP_ROOM}/${from}`;

    // 4) Send a private message (type="chat")
    sendPrivateMessage(occupantJid, plainText);

    // 5) Respond with success
    return res.json({ status: "Message sent privately" });
  } catch (error) {
    console.error("Error in /xmpp-ips-private route:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/xmpp-occupants", async (req, res) => {
  try {
    const occupants = await getRoomOccupants(process.env.XMPP_ROOM);
    // Optionally strip off the resource (nick) if you just want the localpart:
    const names = occupants.map(jid => jid.split("/")[1]);
    res.json({ occupants: names });
  } catch (err) {
    console.error("Failed to fetch occupants:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
