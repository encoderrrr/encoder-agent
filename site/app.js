import { autoConnect } from "https://esm.sh/@unicitylabs/sphere-sdk@0.11.0/connect/browser";

const connectButton = document.querySelector("#connect-wallet");
const disconnectButton = document.querySelector("#disconnect-wallet");
const status = document.querySelector("#connect-status");
const statusDot = document.querySelector("#status-dot");
const identity = document.querySelector("#wallet-identity");
const network = document.querySelector("#wallet-network");
const note = document.querySelector("#connect-note");
let connection = null;

function setStatus(label, connected) {
  status.textContent = label;
  statusDot.classList.toggle("is-live", connected);
  connectButton.disabled = connected;
  disconnectButton.disabled = !connected;
}

function displayIdentity(value) {
  identity.textContent = value
    ? value.nametag ? `@${value.nametag}` : value.directAddress || value.chainPubkey
    : "Connect to view";
}

async function connectWallet() {
  connectButton.disabled = true;
  note.textContent = "Opening Sphere Connect approval...";
  try {
    connection = await autoConnect({
      dapp: {
        name: "Encoder Agent",
        description: "DM-native paid service agent on Unicity testnet",
        icon: new URL("./assets/encoder-agent-logo.png", window.location.href).href,
        url: window.location.href,
      },
      walletUrl: "https://sphere.unicity.network",
      network: { id: 4, name: "testnet2" },
      permissions: ["identity:read", "events:subscribe"],
    });
    setStatus("Connected", true);
    displayIdentity(connection.client.walletIdentity || connection.connection.identity);
    network.textContent = connection.client.walletNetwork?.name || "testnet2";
    note.textContent = "Sphere wallet connected. Identity and wallet-lock events are active.";
    connection.client.on("identity:changed", (nextIdentity) => displayIdentity(nextIdentity));
    connection.client.on("wallet:locked", () => {
      connection = null;
      setStatus("Wallet locked", false);
      displayIdentity(null);
      note.textContent = "Wallet locked. Connect again to continue.";
    });
  } catch (error) {
    setStatus("Not connected", false);
    note.textContent = error instanceof Error ? error.message : "Sphere wallet connection was cancelled.";
  }
}

async function disconnectWallet() {
  if (connection) await connection.disconnect();
  connection = null;
  setStatus("Not connected", false);
  displayIdentity(null);
  network.textContent = "testnet2";
  note.textContent = "Disconnected. No wallet permissions are retained by this page.";
}

connectButton.addEventListener("click", connectWallet);
disconnectButton.addEventListener("click", disconnectWallet);
