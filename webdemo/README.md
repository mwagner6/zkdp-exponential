# ZKDP (Zero-Knowledge Differential Privacy Demo)

A web application demonstrating privacy-preserving cryptographic concepts.

## Description

This project is a React-based web application built with Vite, TypeScript, and Tailwind CSS. It serves as an educational tool to explain and demonstrate concepts such as:

*   Zero-Knowledge Proofs
*   Differential Privacy
*   Sigma-OR Protocols

It features a multi-page navigation structure and includes an interactive demo/game screen.

## Tech Stack

*   **Framework:** React 19
*   **Build Tool:** Vite
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS, Emotion, MUI
*   **UI Components:** Radix UI, Lucide Icons
*   **Linting:** ESLint
*   **Other Libraries:** `react-papaparse`, `react-window`

## Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm (comes with Node.js) or pnpm or yarn

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/Dynosol/zkdp
    cd zkdp
    ```
2.  Install dependencies:
    ```bash
    npm install
    # or
    # pnpm install
    # or
    # yarn install
    ```

### Running the Development Server

To start the local development server:

```bash
npm run dev
# or
# pnpm dev
# or
# yarn dev
```

Open your browser and navigate to `http://localhost:5173` (or the port specified by Vite).

## Available Scripts

*   `npm run dev`: Starts the development server with hot module replacement.
*   `npm run build`: Compiles TypeScript and builds the application for production in the `dist/` folder.
*   `npm run lint`: Runs ESLint to check for code style and potential errors.
*   `npm run preview`: Serves the production build locally for previewing.

## Project Structure

```
zkdp/
├── public/             # Static assets
├── src/                # Source files
│   ├── assets/         # Image/font assets
│   │   ├── navigation/
│   │   ├── pages/      # Page components (ZeroKnowledge, DP, Sigma, Game)
│   │   └── ui/         # Base UI elements (likely from Shadcn/ui or similar)
│   ├── lib/            # Utility functions, Shadcn utils
│   ├── App.css         # Main app styles
│   ├── App.tsx         # Root application component (handles routing/layout)
│   ├── index.css       # Global styles / Tailwind base
│   ├── main.tsx        # Application entry point
│   └── vite-env.d.ts   # Vite environment types
├── .eslintrc.cjs       # ESLint configuration
├── .gitignore          # Git ignore rules
├── index.html          # Main HTML entry point
├── package.json        # Project metadata and dependencies
├── pnpm-lock.yaml      # pnpm lock file
├── postcss.config.js   # PostCSS configuration
├── README.md           # This file
├── tailwind.config.js  # Tailwind CSS configuration
├── tsconfig.json       # Base TypeScript configuration
├── tsconfig.app.json   # App-specific TypeScript configuration
├── tsconfig.node.json  # Node-specific TypeScript configuration
└── vite.config.ts      # Vite configuration
```
