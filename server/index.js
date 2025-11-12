const express = require('express')
const fs = require('fs')
const path = require('path')
const child = require('child_process')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.text({ limit: '1mb' }))
app.use(express.static(path.join(__dirname, '..')))

const ASSEMBLER = path.join(__dirname, '..', 'assembler') // place the assembler binary here

app.post('/api/assemble', (req, res) => {
  const asm = req.body || ''
  if (!asm) return res.status(400).send('Empty assembly')
  try{
    fs.writeFileSync(path.join(__dirname, '..', 'input.asm'), asm)
  } catch (e){ return res.status(500).send('Failed to write input.asm: '+e.message) }

  // run assembler executable
  child.execFile(ASSEMBLER, { timeout: 5000 }, (err, stdout, stderr) => {
    if (err) {
      const msg = stderr || stdout || err.message
      return res.status(500).send('Assembler failed: ' + msg)
    }
    const outPath = path.join(__dirname, '..', 'output.mc')
    if (!fs.existsSync(outPath)) return res.status(500).send('No output.mc produced')
    const out = fs.readFileSync(outPath, 'utf8')
    res.type('text/plain').send(out)
  })
})

const PORT = process.env.PORT || 5050
app.listen(PORT, ()=> console.log('Server listening on', PORT))
