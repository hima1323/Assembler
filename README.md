# RISC-V Assembler

A full-stack RISC-V assembler with a modern web-based visualizer. Write assembly code, assemble it to machine code, and step through execution line by line.

![RISC-V Assembler UI](https://img.shields.io/badge/RISC--V-ISA%20v2.2-blueviolet?style=flat-square) ![RV32I/M](https://img.shields.io/badge/ISA-RV32I%20%2F%20M%20Extension-5c6bc0?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Features

- **RISC-V Assembler (C++)** — Translates `.asm` source files to `.mc` machine code files
- **Web Visualizer (React + Vite)** — Syntax-highlighted assembly editor with side-by-side machine code output
- **Line-by-line Execution** — Step forward/backward through instructions, or use Auto Run with adjustable speed
- **Animated Progress Bar** — Live execution progress with current PC address
- **Copy to Clipboard** — One-click copy of the full machine code output
- **ISA Reference Panel** — Expandable quick-reference listing all supported instructions
- **Syntax Highlighting** — Keywords, registers, immediates, and labels are color-coded in the editor view

---

## Supported Instructions

| Format | Instructions |
|--------|-------------|
| **R-Type** | `add`, `sub`, `and`, `or`, `xor`, `sll`, `srl`, `sra`, `slt`, `mul`, `div`, `rem`, `addw`, `subw`, `mulw`, `divw`, `remw` |
| **I-Type** | `addi`, `andi`, `ori`, `addiw`, `lb`, `lh`, `lw`, `ld`, `jalr` |
| **S-Type** | `sb`, `sh`, `sw`, `sd` |
| **B-Type** | `beq`, `bne`, `blt`, `bge` |
| **U-Type** | `lui`, `auipc` |
| **J-Type** | `jal` |
| **System** | `ecall` |

---

## Project Structure

```
Assembler/
├── assembly.cpp        # RISC-V assembler source (C++)
├── assembler           # Compiled assembler binary
├── input.asm           # Input assembly file (written by server on each request)
├── output.mc           # Output machine code file
├── server/
│   └── index.js        # Express API server — runs assembler binary and returns output
├── src/
│   ├── App.jsx         # React frontend — editor, visualizer, controls
│   ├── styles.css      # Dark theme UI styles
│   └── main.jsx        # React entry point
├── package.json
└── vite.config.js
```

---

## Getting Started

### Prerequisites

- **Node.js** v18+ and npm
- **g++** (C++17) to (re)compile the assembler

### 1. Clone the repository

```bash
git clone https://github.com/hima1323/Assembler.git
cd Assembler
```

### 2. Install dependencies

```bash
npm install
```

### 3. (Optional) Recompile the assembler binary

The pre-built `assembler` binary is included. If you want to recompile from source:

```bash
g++ -std=c++17 -O2 -o assembler assembly.cpp
```

### 4. Run the development server

```bash
npm run dev
```

This starts both servers concurrently:
- **Vite frontend** → `http://localhost:5173`
- **Express API server** → `http://localhost:5050`

Open `http://localhost:5173` in your browser.

---

## Usage

1. **Write** your RISC-V assembly code in the editor panel (left side)
2. **Click Assemble** — the code is sent to the server, assembled by the C++ binary, and the machine code appears on the right
3. **Step through** instructions using `← Prev` / `Next →`, or use **▶ Run** for automatic execution
4. **Adjust speed** with the Speed selector (Slow / Normal / Fast / Turbo)
5. **Copy** the machine code output with the Copy button
6. **ISA Reference** — click the button in the controls bar to toggle the instruction reference panel

### Example Assembly

```asm
.text
addi x1, x0, 10
addi x2, x0, 5
add  x3, x1, x2
beq  x1, x2, end
sub  x4, x1, x2
end:
ecall
```

---

## Assembly Language Syntax

- **Comments** start with `#`
- **Labels** end with `:`
- **Directives**: `.text`, `.data`, `.word`, `.space`, `.string`, `.asciiz`, `.align`
- **Registers**: `x0`–`x31`, or ABI aliases (`zero`, `ra`, `sp`, `gp`, `tp`, `t0`–`t6`, `s0`–`s11`, `a0`–`a7`, `fp`)
- **Immediates**: decimal (`42`), hex (`0xFF`), binary (`0b1010`), or character (`'A'`)
- **Load/Store**: `lw x1, 4(x2)` — offset(base) syntax
- **JALR**: supports both `jalr rd, rs1, imm` and `jalr rd, imm(rs1)`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Assembler backend | C++17 |
| API server | Node.js + Express |
| Frontend framework | React 18 + Vite 5 |
| Styling | Vanilla CSS (dark glassmorphism theme) |
| Fonts | Inter + JetBrains Mono (Google Fonts) |

---

## License

MIT
