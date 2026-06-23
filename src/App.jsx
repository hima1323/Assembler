import React, { useState, useRef, useCallback } from 'react'
import './styles.css'

// ── RISC-V Instruction Reference ──────────────────────────────────────────
const ISA_REF = {
  'R-Type': ['add','sub','and','or','xor','sll','srl','sra','slt','mul','div','rem','addw','subw','mulw','divw','remw'],
  'I-Type': ['addi','andi','ori','addiw','lb','lh','lw','ld','jalr'],
  'S-Type': ['sb','sh','sw','sd'],
  'B-Type': ['beq','bne','blt','bge'],
  'U-Type': ['lui','auipc'],
  'J-Type': ['jal'],
  'System': ['ecall'],
}

// ── Simple syntax highlighter ──────────────────────────────────────────────
function highlight(line) {
  const trimmed = line.trimStart()
  const indent = line.slice(0, line.length - trimmed.length)

  // directive
  if (trimmed.startsWith('.')) {
    const parts = trimmed.split(/\s+/)
    return (
      <>
        {indent}
        <span className="dir">{parts[0]}</span>
        {parts.length > 1 ? ' ' + parts.slice(1).join(' ') : ''}
      </>
    )
  }
  // label
  if (trimmed.endsWith(':')) {
    return <><span className="lbl">{line}</span></>
  }

  // comment only
  if (trimmed.startsWith('#')) {
    return <span style={{ color: '#4a5280', fontStyle: 'italic' }}>{line}</span>
  }

  // instruction: mnemonic + args
  const commentIdx = trimmed.indexOf('#')
  const noComment = commentIdx >= 0 ? trimmed.slice(0, commentIdx) : trimmed
  const comment = commentIdx >= 0 ? trimmed.slice(commentIdx) : ''
  const parts = noComment.trim().split(/[\s,]+/)
  const mnemonic = parts[0]
  const args = parts.slice(1).filter(Boolean)

  const fmtArg = (a) => {
    // imm(rs) syntax
    const m = a.match(/^(-?\d+|0x[\da-fA-F]+)\((\w+)\)$/)
    if (m) return <><span className="imm">{m[1]}</span>{'('}<span className="reg">{m[2]}</span>{')'}</>
    // register xN or alias
    if (/^x\d+$/.test(a) || /^(zero|ra|sp|gp|tp|t[0-6]|s\d+|a\d+|fp)$/.test(a))
      return <span className="reg">{a}</span>
    // immediate/label
    if (/^-?\d+$/.test(a) || /^0x/i.test(a) || /^0b/i.test(a))
      return <span className="imm">{a}</span>
    return <span className="lbl">{a}</span>
  }

  return (
    <>
      {indent}
      <span className="kw">{mnemonic}</span>
      {args.length > 0 && (
        <>
          {' '}
          {args.map((a, i) => (
            <React.Fragment key={i}>
              {fmtArg(a)}
              {i < args.length - 1 && <span style={{ color: '#4a5280' }}>, </span>}
            </React.Fragment>
          ))}
        </>
      )}
      {comment && <span style={{ color: '#4a5280', fontStyle: 'italic' }}> {comment}</span>}
    </>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────
const DEFAULT_ASM = `.text
addi x1, x0, 5
add  x2, x1, x1
beq  x1, x2, end
sub  x3, x2, x1
jal  x0, end
end:
addi x4, x0, 1
`

export default function App() {
  const [asm, setAsm] = useState(DEFAULT_ASM)
  const [machineCode, setMachineCode] = useState([])
  const [currentLine, setCurrentLine] = useState(-1)
  const [running, setRunning] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [speed, setSpeed] = useState(700)
  const [showRef, setShowRef] = useState(false)

  const execRef = useRef(false)
  const activeLineRef = useRef(null)

  const asmLines = asm.split('\n')
  const nonEmptyLines = asmLines.filter(l => l.trim())

  // ── Scroll active line into view ─────────────────────────────────────────
  const scrollToActive = useCallback(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [])

  // ── Assemble ──────────────────────────────────────────────────────────────
  async function handleAssemble() {
    setRunning(true)
    setError('')
    setMachineCode([])
    setCurrentLine(-1)
    try {
      const resp = await fetch('/api/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: asm,
      })
      if (!resp.ok) {
        const err = await resp.text()
        setError(err)
      } else {
        const txt = await resp.text()
        const lines = txt.trim().split('\n').filter(l => l.trim())
        const parsed = lines.map(line => {
          const parts = line.trim().split(/\s+/)
          return { address: parts[0], machineCode: parts[1] || '0x00000000' }
        })
        setMachineCode(parsed)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  // ── Step controls ─────────────────────────────────────────────────────────
  function stepForward() {
    setCurrentLine(l => {
      const next = Math.min(l + 1, machineCode.length - 1)
      setTimeout(scrollToActive, 50)
      return next
    })
  }

  function stepBackward() {
    setCurrentLine(l => {
      const prev = l <= 0 ? 0 : l - 1
      setTimeout(scrollToActive, 50)
      return prev
    })
  }

  function reset() {
    execRef.current = false
    setCurrentLine(-1)
    setExecuting(false)
  }

  function clearAll() {
    execRef.current = false
    setAsm('')
    setMachineCode([])
    setCurrentLine(-1)
    setError('')
    setExecuting(false)
  }

  // ── Auto execute ──────────────────────────────────────────────────────────
  async function autoExecute() {
    if (machineCode.length === 0) return
    execRef.current = true
    setExecuting(true)
    setCurrentLine(0)

    for (let i = 0; i < machineCode.length; i++) {
      if (!execRef.current) break
      setCurrentLine(i)
      setTimeout(scrollToActive, 50)
      await new Promise(resolve => setTimeout(resolve, speed))
    }

    execRef.current = false
    setExecuting(false)
  }

  function stopExecution() {
    execRef.current = false
    setExecuting(false)
  }

  // ── Copy machine code ─────────────────────────────────────────────────────
  function copyMachineCode() {
    const text = machineCode.map(m => `${m.address}  ${m.machineCode}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const progress = machineCode.length === 0 || currentLine === -1
    ? 0
    : Math.round(((currentLine + 1) / machineCode.length) * 100)

  const currentPC = currentLine >= 0 && machineCode[currentLine]
    ? machineCode[currentLine].address
    : '—'

  const currentMC = currentLine >= 0 && machineCode[currentLine]
    ? machineCode[currentLine].machineCode
    : '—'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-wrapper">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="header-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="7" y="7" width="10" height="10" rx="1"/>
              <path d="M9 2v2M12 2v2M15 2v2M9 20v2M12 20v2M15 20v2M2 9h2M2 12h2M2 15h2M20 9h2M20 12h2M20 15h2"/>
            </svg>
          </div>
          <div className="header-text">
            <h1>RISC-V Assembler</h1>
            <div className="subtitle">Assembly to Machine Code — Visualize &amp; Execute</div>
          </div>
        </div>
        <div className="header-badges">
          <span className="chip">RV32I / M Extension</span>
          <span className="chip chip-blue">ISA v2.2</span>
          <span className="chip chip-green">Open Source</span>
        </div>
      </header>

      {/* Main panels */}
      <div className="main-grid">
        {/* Assembly Panel */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
            <span className="icon">◈</span> Assembly Input
          </div>
            <span className="badge">{nonEmptyLines.length} lines</span>
          </div>

          {/* Highlighted code viewer */}
          <div className="code-scroll">
            {nonEmptyLines.map((line, idx) => (
              <div
                key={idx}
                ref={currentLine === idx ? activeLineRef : null}
                className={`code-line ${currentLine === idx ? 'active' : ''} ${currentLine > idx ? 'executed' : ''}`}
              >
                <span className="line-number">{idx + 1}</span>
                <span className="line-content">{highlight(line)}</span>
                <span className="line-status" />
              </div>
            ))}
          </div>

          {/* Editor */}
          <textarea
            className="code-editor"
            value={asm}
            onChange={e => {
              setAsm(e.target.value)
              setMachineCode([])
              setCurrentLine(-1)
              setError('')
            }}
            placeholder="Enter your RISC-V assembly code here..."
            spellCheck={false}
            disabled={executing}
          />
        </div>

        {/* Machine Code Panel */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
            <span className="icon">◉</span> Machine Code Output
          </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="badge">{machineCode.length} instructions</span>
              {machineCode.length > 0 && (
                <button
                  className={`copy-btn ${copied ? 'copied' : ''}`}
                  onClick={copyMachineCode}
                  title="Copy machine code"
                >
                  {copied ? '✓ Copied' : '⎘ Copy'}
                </button>
              )}
            </div>
          </div>

          <div className="code-scroll">
            {machineCode.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">▣</span>
                <p>No output yet</p>
                <small>Click Assemble to generate machine code</small>
              </div>
            ) : (
              machineCode.map((item, idx) => (
                <div
                  key={idx}
                  className={`code-line machine-line ${currentLine === idx ? 'active' : ''} ${currentLine > idx ? 'executed' : ''}`}
                >
                  <span className="mc-index">{idx + 1}</span>
                  <span className="mc-address">{item.address}</span>
                  <span className="mc-separator">→</span>
                  <span className="mc-word">{item.machineCode}</span>
                  <span className="line-status" />
                </div>
              ))
            )}
          </div>

          {/* Error box */}
          {error && (
            <div className="error-box">
              <span className="error-icon">⚠️</span>
              <pre className="error-text">{error}</pre>
            </div>
          )}

          {/* Progress bar */}
          <div className="progress-container">
            <span className="progress-label">Execution</span>
            <div className="progress-track">
              <div
                className={`progress-fill ${executing ? 'active' : ''}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="progress-pct">{progress}%</span>
            {currentPC !== '—' && (
              <span className="pc-display">PC: {currentPC}</span>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="controls-panel">
        {/* Assemble + Clear */}
        <div className="control-group">
          <button
            className="btn btn-assemble"
            onClick={handleAssemble}
            disabled={running || executing || !asm.trim()}
          >
            {running ? <><span className="spinner" /> Assembling…</> : 'Assemble'}
          </button>
          <button
            className="btn btn-clear"
            onClick={clearAll}
            disabled={executing}
          >
            Clear
          </button>
        </div>

        <div className="divider-v" />

        {/* Step controls */}
        <div className="control-group">
          <button
            className="btn btn-step"
            onClick={stepBackward}
            disabled={currentLine <= 0 || executing || machineCode.length === 0}
            title="Step backward"
          >
            ← Prev
          </button>
          <button
            className="btn btn-step"
            onClick={stepForward}
            disabled={currentLine >= machineCode.length - 1 || executing || machineCode.length === 0}
            title="Step forward"
          >
            Next →
          </button>
          {executing ? (
            <button className="btn btn-reset" onClick={stopExecution}>
              Stop
            </button>
          ) : (
            <button
              className="btn btn-play"
              onClick={autoExecute}
              disabled={machineCode.length === 0}
            >
              ▶ Run
            </button>
          )}
          <button
            className="btn btn-reset"
            onClick={reset}
            disabled={machineCode.length === 0}
          >
            Reset
          </button>
        </div>

        <div className="divider-v" />

        {/* Speed control */}
        <div className="speed-control">
          <span>Speed</span>
          <select
            className="speed-select"
            value={speed}
            onChange={e => setSpeed(Number(e.target.value))}
            disabled={executing}
          >
            <option value={1500}>Slow</option>
            <option value={700}>Normal</option>
            <option value={300}>Fast</option>
            <option value={80}>Turbo</option>
          </select>
        </div>

        {/* Instruction ref toggle */}
        <button className="ref-toggle" onClick={() => setShowRef(v => !v)}>
          {showRef ? 'Hide Reference' : 'ISA Reference'}
        </button>

        {/* Stats */}
        <div className="exec-stats">
          <div className="stat-item">
            <span className="stat-label">Line</span>
            <span className="stat-value">{currentLine === -1 ? '—' : currentLine + 1}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total</span>
            <span className="stat-value">{machineCode.length || '—'}</span>
          </div>
        </div>
      </div>

      {/* ISA Reference panel */}
      {showRef && (
        <div className="ref-panel">
          <h3>Supported Instructions — RV32I + M Extension</h3>
          <div className="ref-grid">
            {Object.entries(ISA_REF).map(([fmt, ops]) => (
              <div className="ref-group" key={fmt}>
                <h4>{fmt}</h4>
                <div className="ref-list">
                  {ops.map(op => (
                    <span
                      key={op}
                      className="ref-tag"
                      title={`Click to insert ${op}`}
                      onClick={() => {
                        if (!executing) setAsm(a => a + op + ' ')
                      }}
                    >
                      {op}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <span>RISC-V Assembler</span>
        {machineCode.length > 0 && currentLine >= 0 && (
          <> &nbsp;·&nbsp; PC: <span style={{color:'#82aaff',fontFamily:'"JetBrains Mono",monospace'}}>{currentPC}</span>
          &nbsp;·&nbsp; MC: <span style={{color:'#f78c6c',fontFamily:'"JetBrains Mono",monospace'}}>{currentMC}</span></>
        )}
      </footer>
    </div>
  )
}
