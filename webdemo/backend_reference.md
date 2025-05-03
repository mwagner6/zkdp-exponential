# Verifiable Differential Privacy API Reference

A pure-Rust implementation for auditable Differential Privacy with a RESTful API.

## Overview

This project provides an API for implementing Verifiable Differential Privacy protocols. It allows clients to:

1. Initialize a protocol session
2. Exchange cryptographic commitments
3. Generate and share randomness
4. Perform secure computations for differential privacy

## API Endpoints

All API requests (except initialization) require a session ID to be included in the request body.

### Base URL

```
http://127.0.0.1:9537
```

### Authentication

Sessions are managed through a session ID token returned when initializing a new protocol run.

### Endpoints

#### Initialize a New Session

Create a new protocol session with initial parameters.

```
POST /new
```

**Request Body:**
```json
{
  "n": number,         // Number of clients
  "x": number[]        // Initial bit vector 
}
```

**Response:**
- Content: Session ID as plain text
- Status: 200 OK

**Example:**
```javascript
// Request
await fetch('http://127.0.0.1:9537/new', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ n: 5, x: [1, 0, 1] }),
});

// Response: "5ba0217e-c86a-4fc2-a471-967d52d32155"
```

#### Get Commitments

Retrieve commitments for the current session.

```
POST /commits
```

**Request Body:**
```json
{
  "session_id": string  // Session ID from initialization
}
```

**Response:**
```json
{
  "commits": string[]  // Array of commitment strings
}
```

**Example:**
```javascript
// Request
await fetch('http://127.0.0.1:9537/commits', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ session_id: currentSessionId }),
});

// Response
{
  "commits": [
    "15070004647723273483970547774244217700325200181350708005002868201307331405284",
    "54745247385048886442338912085182890590488993449678482636773292748086649707492",
    "25658623352299369194038352583585613061418330993806487151276333147999645687072"
  ]
}
```

#### Send Randomness

Submit random bits to the protocol.

```
POST /randomness
```

**Request Body:**
```json
{
  "session_id": string,  // Session ID
  "bits": number[]       // Array of random bits (0 or 1)
}
```

**Response:**
- Status: 200 OK
- Response contains confirmation data

**Example:**
```javascript
// Request
await fetch('http://127.0.0.1:9537/randomness', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ 
    bits: [0, 1, 0, 1, 1], 
    session_id: currentSessionId 
  }),
});
```

#### Get Public Random Bits

Retrieve the publicly generated random bits.

```
POST /public_random
```

**Request Body:**
```json
{
  "session_id": string  // Session ID
}
```

**Response:**
```json
{
  "random_bits": number[]  // Array of public random bits
}
```

**Example:**
```javascript
// Response
{
  "random_bits": [0, 1, 0, 1, 1]
}
```

#### Get XOR Bits

Retrieve XOR operation results on bits.

```
POST /xor_bits
```

**Request Body:**
```json
{
  "session_id": string  // Session ID
}
```

**Response:**
```json
{
  "xor_bits": number[]  // Array of XOR bits
}
```

**Example:**
```javascript
// Response
{
  "xor_bits": [0, 0, 0, 0, 0]
}
```

#### Get XOR Commitments

Retrieve commitments for XOR operations.

```
POST /xor_commits
```

**Request Body:**
```json
{
  "session_id": string  // Session ID
}
```

**Response:**
```json
{
  "xor_commits": string[]  // Array of XOR commitment strings
}
```

**Example:**
```javascript
// Response
{
  "xor_commits": [
    "0",
    "53453403443306840533278073560698739391446669128918427283046925944918568268514",
    "0",
    "53453403443306840533278073560698739391446669128918427283046925944918568268514",
    "53453403443306840533278073560698739391446669128918427283046925944918568268514"
  ]
}
```

#### Compute Sum

Compute the final sum for the protocol.

```
POST /compute_sum
```

**Request Body:**
```json
{
  "session_id": string  // Session ID
}
```

**Response:**
```json
{
  "final_sum": number  // Computed sum
}
```

**Example:**
```javascript
// Response
{
  "final_sum": 2
}
```

#### Get Z Value

Retrieve the 'Z' value from the protocol (cryptographic value used in verification).

```
POST /z
```

**Request Body:**
```json
{
  "session_id": string  // Session ID
}
```

**Response:**
```json
{
  "z": string  // Z value as a string
}
```

**Example:**
```javascript
// Response
{
  "z": "2108122679420404309238408873249790423291381040280085637674166688375491606111"
}
```

#### Commit Pedersons

Submit Pedersen commitments for the protocol.

```
POST /commit_pedersons
```

**Request Body:**
```json
{
  "session_id": string  // Session ID
}
```

**Response:**
- Status: 200 OK
- Response contains confirmation data

**Example:**
```javascript
// Request
await fetch('http://127.0.0.1:9537/commit_pedersons', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ session_id: currentSessionId }),
});
```

#### Get LHS Value

Retrieve the Left-Hand Side value of the verification equation.

```
POST /lhs
```

**Request Body:**
```json
{
  "session_id": string  // Session ID
}
```

**Response:**
```json
{
  "lhs": string  // LHS value as a string
}
```

**Example:**
```javascript
// Response
{
  "lhs": "49529535007609002931128516754888936353080991290307884209723899877359495173784"
}
```

#### Get RHS Value

Retrieve the Right-Hand Side value of the verification equation.

```
POST /rhs
```

**Request Body:**
```json
{
  "session_id": string  // Session ID
}
```

**Response:**
```json
{
  "rhs": string  // RHS value as a string
}
```

**Example:**
```javascript
// Response
{
  "rhs": "49529535007609002931128516754888936353080991290307884209723899877359495173784"
}
```

## Testing the API

You can test the API using the provided Node.js client in `backendtest/`:

1. Install dependencies in the backendtest directory:
   ```
   cd backendtest
   npm install
   ```

2. Run the test script:
   ```
   npm start
   ```

## Running the Backend

1. Start the Rust backend server:
   ```
   cargo run
   ```

2. The server will listen on `http://127.0.0.1:9537`

## Protocol Flow

A typical protocol flow follows these steps:

1. Initialize a new session (`/new`)
2. Get commitments (`/commits`)
3. Send randomness (`/randomness`)
4. Get public random bits (`/public_random`)
5. Get XOR bits (`/xor_bits`)
6. Get XOR commitments (`/xor_commits`)
7. Compute sum (`/compute_sum`)
8. Get Z value (`/z`)
9. Commit Pedersons (`/commit_pedersons`)
10. Get LHS value (`/lhs`)
11. Get RHS value (`/rhs`)

## Technology Stack

- Backend: Rust with Actix-web framework
- Cryptography: curve25519-dalek, bulletproofs, merlin
- Client Test Suite: Node.js with TypeScript
