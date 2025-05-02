"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = __importDefault(require("node-fetch")); // If running in Node.js
let currentSessionId = null;
async function initializeRunner(n, x) {
    const response = await (0, node_fetch_1.default)('http://127.0.0.1:8080/new', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ n, x }),
    });
    if (response.ok) {
        const data = await response.text(); // Get the session ID as text.
        currentSessionId = data;
        console.log("Session ID:", currentSessionId);
    }
    else {
        console.error("Failed to initialize runner:", response.status, response.statusText);
        try {
            const errorData = await response.json();
            console.error("Error details:", errorData);
        }
        catch (e) {
            console.error("Failed to parse error response:", e);
        }
    }
}
async function getCommitments() {
    if (!currentSessionId) {
        console.error("No session ID available.");
        return undefined;
    }
    const response = await (0, node_fetch_1.default)('http://127.0.0.1:8080/commits', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: currentSessionId }), // Send session_id in body
    });
    if (response.ok) {
        const data = (await response.json());
        console.log("Commits:", data.commits);
        return data.commits;
    }
    else {
        console.error("Failed to get commits:", response.status, response.statusText);
        return undefined;
    }
}
async function sendRandomness(bits) {
    if (!currentSessionId) {
        console.error("No session ID available.");
        return;
    }
    const response = await (0, node_fetch_1.default)('http://127.0.0.1:8080/randomness', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bits, session_id: currentSessionId }), // Send session_id in body
    });
    if (response.ok) {
        const data = await response.json();
        console.log("Randomness Input:", data);
    }
    else {
        console.error("Failed to send randomness:", response.status, response.statusText);
        try {
            const errorData = await response.json();
            console.error("Error details:", errorData);
        }
        catch (e) {
            console.error("Failed to parse error response:", e);
        }
    }
}
async function getPublicRandom() {
    if (!currentSessionId) {
        console.error("No session ID available.");
        return undefined;
    }
    const response = await (0, node_fetch_1.default)('http://127.0.0.1:8080/public_random', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: currentSessionId }), // Send session_id in body
    });
    if (response.ok) {
        const data = (await response.json());
        console.log("Public Random Bits:", data.random_bits);
        return data.random_bits;
    }
    else {
        console.error("Failed to get public random:", response.status, response.statusText);
        return undefined;
    }
}
async function getXorBits() {
    if (!currentSessionId) {
        console.error("No session ID available.");
        return undefined;
    }
    const response = await (0, node_fetch_1.default)('http://127.0.0.1:8080/xor_bits', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: currentSessionId }), // Send session_id in body
    });
    if (response.ok) {
        const data = (await response.json());
        console.log("XOR Bits:", data.xor_bits);
        return data.xor_bits;
    }
    else {
        console.error("Failed to get XOR bits:", response.status, response.statusText);
        return undefined;
    }
}
async function getXorCommits() {
    if (!currentSessionId) {
        console.error("No session ID available.");
        return undefined;
    }
    const response = await (0, node_fetch_1.default)('http://127.0.0.1:8080/xor_commits', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: currentSessionId }), // Send session_id in body
    });
    if (response.ok) {
        const data = (await response.json());
        console.log("XOR Commits:", data.xor_commits);
        return data.xor_commits;
    }
    else {
        console.error("Failed to get XOR commits:", response.status, response.statusText);
        return undefined;
    }
}
async function computeSum() {
    if (!currentSessionId) {
        console.error("No session ID available.");
        return undefined;
    }
    const response = await (0, node_fetch_1.default)('http://127.0.0.1:8080/compute_sum', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: currentSessionId }), // Send session_id in body
    });
    if (response.ok) {
        const data = (await response.json());
        console.log("Final Sum:", data.final_sum);
        return data.final_sum;
    }
    else {
        console.error("Failed to compute sum:", response.status, response.statusText);
        return undefined;
    }
}
async function getZ() {
    if (!currentSessionId) {
        console.error("No session ID available.");
        return undefined;
    }
    const response = await (0, node_fetch_1.default)('http://127.0.0.1:8080/z', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: currentSessionId }), // Send session_id in body
    });
    if (response.ok) {
        const data = (await response.json());
        console.log("Z:", data.z);
        return data.z;
    }
    else {
        console.error("Failed to get Z:", response.status, response.statusText);
        return undefined;
    }
}
async function commitPedersons() {
    if (!currentSessionId) {
        console.error("No session ID available.");
        return;
    }
    const response = await (0, node_fetch_1.default)('http://127.0.0.1:8080/commit_pedersons', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: currentSessionId }), // Send session_id in body
    });
    if (response.ok) {
        const data = await response.json();
        console.log("Pederson Commitments:", data);
    }
    else {
        console.error("Failed to commit Pedersons:", response.status, response.statusText);
        try {
            const errorData = await response.json();
            console.error("Error details:", errorData);
        }
        catch (e) {
            console.error("Failed to parse error response:", e);
        }
    }
}
async function getLhs() {
    if (!currentSessionId) {
        console.error("No session ID available.");
        return undefined;
    }
    const response = await (0, node_fetch_1.default)('http://127.0.0.1:8080/lhs', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: currentSessionId }), // Send session_id in body
    });
    if (response.ok) {
        const data = (await response.json());
        console.log("LHS:", data.lhs);
        return data.lhs;
    }
    else {
        console.error("Failed to get LHS:", response.status, response.statusText);
        return undefined;
    }
}
async function getRhs() {
    if (!currentSessionId) {
        console.error("No session ID available.");
        return undefined;
    }
    const response = await (0, node_fetch_1.default)('http://127.0.0.1:8080/rhs', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: currentSessionId }), // Send session_id in body
    });
    if (response.ok) {
        const data = (await response.json());
        console.log("RHS:", data.rhs);
        return data.rhs;
    }
    else {
        console.error("Failed to get RHS:", response.status, response.statusText);
        return undefined;
    }
}
// Example usage in TypeScript:
async function runFlow() {
    await initializeRunner(5, [1, 0, 1]);
    const commits = await getCommitments();
    console.log("Got commits:", commits);
    await sendRandomness([0, 1, 0, 1, 1]);
    const publicRandom = await getPublicRandom();
    console.log("Public Random:", publicRandom);
    const xorBits = await getXorBits();
    console.log("XOR Bits:", xorBits);
    const xorCommits = await getXorCommits();
    console.log("XOR Commits:", xorCommits);
    const sum = await computeSum();
    console.log("Computed Sum:", sum);
    const z = await getZ();
    console.log("Z:", z);
    await commitPedersons();
    const lhs = await getLhs();
    console.log("LHS:", lhs);
    const rhs = await getRhs();
    console.log("RHS:", rhs);
}
// Call the test function to execute the flow
runFlow();
