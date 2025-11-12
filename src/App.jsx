import React, { useState } from 'react'

export default function App(){
  const [asm, setAsm] = useState(`.text
addi x1, x0, 5
add x2, x1, x1
beq x1, x2, end
sub x3, x2, x1
end:
`)
  const [machineCode, setMachineCode] = useState([])
  const [currentLine, setCurrentLine] = useState(-1)
  const [running, setRunning] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')

  const asmLines = asm.split('\n').filter(l => l.trim())

  async function handleAssemble(){
    setRunning(true)
    setError('')
    setMachineCode([])
    setCurrentLine(-1)
    try{
      const resp = await fetch('/api/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: asm
      })
      if (!resp.ok) {
        const err = await resp.text()
        setError(`Error: ${err}`)
      } else {
        const txt = await resp.text()
        const lines = txt.trim().split('\n').filter(l => l.trim())
        const parsed = lines.map(line => {
          const parts = line.trim().split(/\s+/)
          return {
            address: parts[0],
            machineCode: parts[1] || '0x00000000'
          }
        })
        setMachineCode(parsed)
      }
    } catch (e){
      setError(`Error: ${e.message}`)
    } finally { setRunning(false) }
  }

  function stepForward(){
    if (currentLine < machineCode.length - 1) {
      setCurrentLine(currentLine + 1)
    }
  }

  function stepBackward(){
    if (currentLine > 0) {
      setCurrentLine(currentLine - 1)
    } else if (currentLine === -1 && machineCode.length > 0) {
      setCurrentLine(0)
    }
  }

  function reset(){
    setCurrentLine(-1)
  }

  async function autoExecute(){
    if (machineCode.length === 0) return
    setExecuting(true)
    setCurrentLine(0)
    
    for (let i = 0; i < machineCode.length; i++) {
      setCurrentLine(i)
      await new Promise(resolve => setTimeout(resolve, 800))
    }
    
    setExecuting(false)
  }

  return (
    <div className="container">
      <header className="header">
        <div className="header-content">
          <h1>RISC-V Assembly Executor</h1>
          <p className="subtitle">Line-by-line assembly code visualization</p>
        </div>
      </header>

      <div className="main-grid">
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">📝 Assembly Code</span>
            <span className="badge">{asmLines.length} lines</span>
          </div>
          <div className="code-container">
            {asmLines.map((line, idx) => (
              <div 
                key={idx} 
                className={`code-line ${currentLine === idx ? 'active' : ''} ${currentLine > idx ? 'executed' : ''}`}
              >
                <span className="line-number">{idx + 1}</span>
                <span className="line-content">{line}</span>
              </div>
            ))}
          </div>
          <textarea 
            className="code-editor"
            value={asm} 
            onChange={e=>setAsm(e.target.value)}
            placeholder="Enter your RISC-V assembly code here..."
          />
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">⚙️ Machine Code</span>
            <span className="badge">{machineCode.length} instructions</span>
          </div>
          <div className="code-container machine-code-view">
            {machineCode.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📦</span>
                <p>No machine code yet</p>
                <small>Click "Assemble" to generate machine code</small>
              </div>
            ) : (
              machineCode.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`code-line machine-line ${currentLine === idx ? 'active' : ''} ${currentLine > idx ? 'executed' : ''}`}
                >
                  <span className="line-number">{idx + 1}</span>
                  <span className="address">{item.address}</span>
                  <span className="machine-code">{item.machineCode}</span>
                </div>
              ))
            )}
          </div>
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="controls-panel">
        <div className="control-group">
          <button 
            className="btn btn-primary" 
            onClick={handleAssemble} 
            disabled={running || executing}
          >
            {running ? '⏳ Assembling...' : '🔨 Assemble'}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={()=>{ setAsm(''); setMachineCode([]); setCurrentLine(-1); setError(''); }}
            disabled={executing}
          >
            🗑️ Clear
          </button>
        </div>

        <div className="divider"></div>

        <div className="control-group">
          <button 
            className="btn btn-step" 
            onClick={stepBackward}
            disabled={currentLine <= -1 || executing || machineCode.length === 0}
            title="Step backward"
          >
            ⏮️ Prev
          </button>
          <button 
            className="btn btn-step" 
            onClick={stepForward}
            disabled={currentLine >= machineCode.length - 1 || executing || machineCode.length === 0}
            title="Step forward"
          >
            Next ⏭️
          </button>
          <button 
            className="btn btn-play" 
            onClick={autoExecute}
            disabled={executing || machineCode.length === 0}
          >
            {executing ? '⏸️ Running...' : '▶️ Auto Run'}
          </button>
          <button 
            className="btn btn-reset" 
            onClick={reset}
            disabled={executing || machineCode.length === 0}
          >
            🔄 Reset
          </button>
        </div>

        <div className="execution-info">
          <div className="info-item">
            <span className="info-label">Current Line:</span>
            <span className="info-value">{currentLine === -1 ? '-' : currentLine + 1}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Progress:</span>
            <span className="info-value">
              {machineCode.length === 0 ? '0%' : 
               currentLine === -1 ? '0%' : 
               `${Math.round(((currentLine + 1) / machineCode.length) * 100)}%`}
            </span>
          </div>
        </div>
      </div>

      <footer className="footer">
        <p>💡 Enter assembly code, click Assemble, then use step controls to execute line by line</p>
      </footer>
    </div>
  )
}
