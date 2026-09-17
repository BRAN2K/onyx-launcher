"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const {
  DiscordRpcService,
  packFrame,
  getPotentialSocketPaths,
  resolveInstanceIcon,
  DEFAULT_MINECRAFT_ICON_URL,
  LOADER_ICONS,
  OPCODES,
  DEFAULT_CLIENT_ID,
} = require("../electron/services/discord-rpc.cjs");

test("DiscordRpcService: packFrame correctly encodes opcode and length", () => {
  const payload = { hello: "world", count: 42 };
  const frame = packFrame(OPCODES.HANDSHAKE, payload);

  assert.equal(frame.readInt32LE(0), OPCODES.HANDSHAKE);
  const len = frame.readInt32LE(4);
  const jsonStr = frame.subarray(8, 8 + len).toString("utf8");
  const parsed = JSON.parse(jsonStr);

  assert.deepEqual(parsed, payload);
});

test("DiscordRpcService: resolveInstanceIcon selects custom icon or loader/Minecraft fallback", () => {
  // Custom remote icon takes priority
  const customUrl = "https://cdn.modrinth.com/data/123/icon.png";
  assert.equal(resolveInstanceIcon({ iconUrl: customUrl }), customUrl);

  // Fabric instance
  assert.equal(
    resolveInstanceIcon({ loader: "Fabric" }),
    LOADER_ICONS.fabric
  );

  // Forge instance
  assert.equal(
    resolveInstanceIcon({ loader: "Forge" }),
    LOADER_ICONS.forge
  );

  // NeoForge instance
  assert.equal(
    resolveInstanceIcon({ loader: "NeoForge" }),
    LOADER_ICONS.neoforge
  );

  // Vanilla or missing loader defaults to classic Minecraft 3D grass block
  assert.equal(
    resolveInstanceIcon({ loader: "Vanilla" }),
    DEFAULT_MINECRAFT_ICON_URL
  );
  assert.equal(
    resolveInstanceIcon({}),
    DEFAULT_MINECRAFT_ICON_URL
  );
});

test("DiscordRpcService: socket paths list is non-empty for current platform", () => {
  const paths = getPotentialSocketPaths();
  assert.ok(Array.isArray(paths));
  assert.ok(paths.length > 0);
  if (process.platform === "win32") {
    assert.ok(paths[0].includes("pipe"));
  } else {
    assert.ok(paths.some((p) => p.includes("discord-ipc-0")));
  }
});

test("DiscordRpcService: handshake and activity flow with mock IPC server", async () => {
  const socketPath =
    process.platform === "win32"
      ? "\\\\?\\pipe\\discord-ipc-test"
      : `/tmp/discord-ipc-mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  let receivedHandshake = null;
  let receivedActivity = null;

  const clientSockets = new Set();
  const server = net.createServer((c) => {
    clientSockets.add(c);
    c.on("close", () => clientSockets.delete(c));
    let buf = Buffer.alloc(0);
    c.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 8) {
        const op = buf.readInt32LE(0);
        const len = buf.readInt32LE(4);
        if (buf.length < 8 + len) break;
        const payload = JSON.parse(buf.subarray(8, 8 + len).toString("utf8"));
        buf = buf.subarray(8 + len);

        if (op === OPCODES.HANDSHAKE) {
          receivedHandshake = payload;
          // Respond with READY
          const readyFrame = packFrame(OPCODES.FRAME, {
            cmd: "DISPATCH",
            evt: "READY",
            data: {
              v: 1,
              user: {
                id: "123456",
                username: "OnyxTester",
                discriminator: "0001",
              },
            },
          });
          c.write(readyFrame);
        } else if (op === OPCODES.FRAME && payload.cmd === "SET_ACTIVITY") {
          receivedActivity = payload.args?.activity;
        }
      }
    });
  });

  await new Promise((resolve) => server.listen(socketPath, resolve));

  try {
    const rpc = new DiscordRpcService({
      clientId: DEFAULT_CLIENT_ID,
      version: "1.6.13",
    });

    // Manually connect to our test socket path
    rpc.connecting = true;
    rpc.socket = net.createConnection(socketPath, () => {
      rpc.connecting = false;
      rpc._send(OPCODES.HANDSHAKE, {
        v: 1,
        client_id: rpc.clientId,
      });
    });
    rpc.socket.on("data", (chunk) => rpc._handleData(chunk));

    await new Promise((resolve) => {
      rpc.once("connected", resolve);
    });

    assert.equal(rpc.connected, true);
    assert.equal(rpc.currentUser, "OnyxTester");
    assert.ok(receivedHandshake);
    assert.equal(receivedHandshake.client_id, DEFAULT_CLIENT_ID);

    // Test playing activity
    rpc.setPlaying(
      {
        name: "FTB Skies",
        loader: "Fabric",
        version: "1.21.4",
        modCount: 154,
      },
      { showGame: true, showTime: true, startTime: 1700000000 }
    );

    // Wait a tick for activity to arrive
    await new Promise((r) => setTimeout(r, 50));

    assert.ok(receivedActivity);
    assert.equal(receivedActivity.details, "Playing FTB Skies");
    assert.equal(receivedActivity.state, "Fabric 1.21.4 • 154 mods");
    assert.equal(receivedActivity.timestamps?.start, 1700000000);

    // Test privacy mode
    rpc.setPlaying(
      {
        name: "Top Secret Pack",
        loader: "Forge",
        version: "1.20.1",
      },
      { showGame: false, showTime: false }
    );

    await new Promise((r) => setTimeout(r, 50));
    assert.equal(receivedActivity.details, "Playing Minecraft");
    assert.equal(receivedActivity.state, "In Game");
    assert.equal(receivedActivity.timestamps, undefined);

    // Test log ingestion: multiplayer server
    const instance = {
      id: "inst-1",
      name: "Onyx SMP",
      loader: "Fabric",
      version: "1.21.1",
    };
    rpc.setPlaying(instance, { showGame: true, showServer: true });
    rpc.ingestGameLog("inst-1", "[Render thread/INFO]: Connecting to hypixel.net, 25565");

    await new Promise((r) => setTimeout(r, 50));
    assert.equal(receivedActivity.details, "Playing Onyx SMP");
    assert.equal(receivedActivity.state, "Fabric 1.21.1 • Server: hypixel.net");

    // Test streamer mode (hideServerIp)
    rpc.setPlaying(instance, {
      showGame: true,
      showServer: true,
      hideServerIp: true,
    });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(receivedActivity.state, "Fabric 1.21.1 • Multiplayer");

    // Test log ingestion: singleplayer world
    rpc.ingestGameLog("inst-1", '[Server thread/INFO]: Preparing level "Hardcore Map"');
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(receivedActivity.state, "Fabric 1.21.1 • World: Hardcore Map");

    // Test log ingestion: return to main menu
    rpc.ingestGameLog("inst-1", "[Server thread/INFO]: Stopping server");
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(receivedActivity.state, "Fabric 1.21.1 • Main Menu");

    rpc.disconnect();
    assert.equal(rpc.connected, false);
  } finally {
    for (const s of clientSockets) {
      s.destroy();
    }
    server.close();
  }
});
