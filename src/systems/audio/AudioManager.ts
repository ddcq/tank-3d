export class AudioManager {
  private ctx: AudioContext | null = null
  private ambientNodes: AudioNode[] = []
  private ambientGain: GainNode | null = null
  private monsterBuffer: AudioBuffer | null = null
  private gunshotBuffer: AudioBuffer | null = null
  private reloadBuffer: AudioBuffer | null = null

  init(): void {
    if (this.ctx) return
    try {
      this.ctx = new AudioContext()
    } catch {
      // Web Audio API not available
    }
  }

  private loadBuffer(url: string): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      const ctx = this.ctx
      if (!ctx) { reject(new Error('no context')); return }
      fetch(url)
        .then(r => r.arrayBuffer())
        .then(buf => ctx.decodeAudioData(buf))
        .then(resolve)
        .catch(reject)
    })
  }

  preloadMonster(): void {
    this.loadBuffer('/sounds/monster.mp3')
      .then(buf => { this.monsterBuffer = buf })
      .catch(() => { /* fallback to synthetic sound */ })
  }

  preloadGunshoot(): void {
    this.loadBuffer('/sounds/gunshoot.mp3')
      .then(buf => { this.gunshotBuffer = buf })
      .catch(() => { /* fallback to synthetic sound */ })
  }

  preloadReload(): void {
    this.loadBuffer('/sounds/reload.mp3')
      .then(buf => { this.reloadBuffer = buf })
      .catch(() => { /* fallback to synthetic sound */ })
  }

  private ctxOrNull(): AudioContext | null {
    if (!this.ctx) return null
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  userGesture(): void {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  private noise(ctx: AudioContext, dur: number): AudioBufferSourceNode {
    const len = ctx.sampleRate * dur
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    return src
  }

  startAmbient(): void {
    const ctx = this.ctxOrNull()
    if (!ctx || this.ambientGain) return

    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.035, ctx.currentTime)
    masterGain.connect(ctx.destination)
    this.ambientGain = masterGain

    const osc1 = ctx.createOscillator()
    osc1.type = 'sawtooth'
    osc1.frequency.setValueAtTime(28, ctx.currentTime)
    osc1.frequency.linearRampToValueAtTime(30, ctx.currentTime + 3)
    const g1 = ctx.createGain()
    g1.gain.setValueAtTime(0.5, ctx.currentTime)
    osc1.connect(g1)
    g1.connect(masterGain)
    osc1.start()
    this.ambientNodes.push(osc1, g1)

    const osc2 = ctx.createOscillator()
    osc2.type = 'sawtooth'
    osc2.frequency.setValueAtTime(60, ctx.currentTime)
    osc2.frequency.linearRampToValueAtTime(62, ctx.currentTime + 3)
    const g2 = ctx.createGain()
    g2.gain.setValueAtTime(0.25, ctx.currentTime)
    osc2.connect(g2)
    g2.connect(masterGain)
    osc2.start()
    this.ambientNodes.push(osc2, g2)

    const osc3 = ctx.createOscillator()
    osc3.type = 'square'
    osc3.frequency.setValueAtTime(15, ctx.currentTime)
    const g3 = ctx.createGain()
    g3.gain.setValueAtTime(0.1, ctx.currentTime)
    osc3.connect(g3)
    g3.connect(masterGain)
    osc3.start()
    this.ambientNodes.push(osc3, g3)

    const noiseSrc = this.noise(ctx, 4)
    noiseSrc.loop = true
    const ng = ctx.createGain()
    const np = ctx.createBiquadFilter()
    np.type = 'lowpass'
    np.frequency.setValueAtTime(200, ctx.currentTime)
    ng.gain.setValueAtTime(0.15, ctx.currentTime)
    noiseSrc.connect(np)
    np.connect(ng)
    ng.connect(masterGain)
    noiseSrc.start()
    this.ambientNodes.push(noiseSrc, ng, np)
  }

  stopAmbient(): void {
    const ctx = this.ctxOrNull()
    if (ctx && this.ambientGain) {
      this.ambientGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    }
    setTimeout(() => {
      for (const n of this.ambientNodes) {
        if (n instanceof AudioScheduledSourceNode) {
          try { n.stop() } catch { /* already stopped */ }
        }
        n.disconnect()
      }
      this.ambientNodes = []
      this.ambientGain = null
    }, 1000)
  }

  playStep(): void {
    const ctx = this.ctxOrNull()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(60, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.1)

    const n = this.noise(ctx, 0.05)
    const ng = ctx.createGain()
    const np = ctx.createBiquadFilter()
    np.type = 'lowpass'
    np.frequency.setValueAtTime(800, ctx.currentTime)
    ng.gain.setValueAtTime(0.12, ctx.currentTime)
    ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
    n.connect(np)
    np.connect(ng)
    ng.connect(ctx.destination)
    n.start(ctx.currentTime)
    n.stop(ctx.currentTime + 0.05)
  }

  playTurn(): void {
    const ctx = this.ctxOrNull()
    if (!ctx) return

    const bpf = ctx.createBiquadFilter()
    bpf.type = 'bandpass'
    bpf.frequency.setValueAtTime(200, ctx.currentTime)
    bpf.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15)
    bpf.Q.setValueAtTime(5, ctx.currentTime)

    const n = this.noise(ctx, 0.15)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    n.connect(bpf)
    bpf.connect(gain)
    gain.connect(ctx.destination)
    n.start(ctx.currentTime)
    n.stop(ctx.currentTime + 0.15)

    const osc = ctx.createOscillator()
    const og = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.12)
    og.gain.setValueAtTime(0.06, ctx.currentTime)
    og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.connect(og)
    og.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.12)
  }

  playConfirm(): void {
    const ctx = this.ctxOrNull()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(300, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(500, ctx.currentTime + 0.06)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.12)
  }

  playWin(): void {
    const ctx = this.ctxOrNull()
    if (!ctx) return

    const notes = [130, 165, 196, 261]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      const t = ctx.currentTime + i * 0.2
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.15, t + 0.06)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.4)
    })
  }

  playBlocked(): void {
    const ctx = this.ctxOrNull()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(40, ctx.currentTime)
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  }

  playReset(): void {
    const ctx = this.ctxOrNull()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(300, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.3)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.35)
  }

  playGunPickup(): void {
    const ctx = this.ctxOrNull()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.25)
  }

  playReload(): void {
    const ctx = this.ctxOrNull()
    if (!ctx) return

    if (this.reloadBuffer) {
      const src = ctx.createBufferSource()
      src.buffer = this.reloadBuffer
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.8, ctx.currentTime)
      src.connect(gain)
      gain.connect(ctx.destination)
      src.start(ctx.currentTime)
    } else {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1)
      osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.2)
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.3)
    }
  }

  playMonster(): void {
    const ctx = this.ctxOrNull()
    if (!ctx) return

    if (this.monsterBuffer) {
      const src = ctx.createBufferSource()
      src.buffer = this.monsterBuffer
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(1, ctx.currentTime)
      src.connect(gain)
      gain.connect(ctx.destination)
      src.start(ctx.currentTime)
    } else {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(80, ctx.currentTime)
      osc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.4)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)

      const n = this.noise(ctx, 0.3)
      const ng = ctx.createGain()
      const np = ctx.createBiquadFilter()
      np.type = 'lowpass'
      np.frequency.setValueAtTime(150, ctx.currentTime)
      np.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.3)
      ng.gain.setValueAtTime(0.15, ctx.currentTime)
      ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      n.connect(np)
      np.connect(ng)
      ng.connect(ctx.destination)
      n.start(ctx.currentTime)
      n.stop(ctx.currentTime + 0.3)
    }
  }

  playGunShot(): void {
    const ctx = this.ctxOrNull()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(150, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)

    const n = this.noise(ctx, 0.08)
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.3, ctx.currentTime)
    ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
    n.connect(ng)
    ng.connect(ctx.destination)
    n.start(ctx.currentTime)
    n.stop(ctx.currentTime + 0.08)
  }

  playGunShotFromFile(): void {
    const ctx = this.ctxOrNull()
    if (!ctx) return

    if (this.gunshotBuffer) {
      const src = ctx.createBufferSource()
      src.buffer = this.gunshotBuffer
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.8, ctx.currentTime)
      src.connect(gain)
      gain.connect(ctx.destination)
      src.start(ctx.currentTime)
    } else {
      this.playGunShot()
    }
  }

  playTeleport(): void {
    const ctx = this.ctxOrNull()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(200, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.25)
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.4)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.2)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  }

  playMonsterApproach(): void {
    const ctx = this.ctxOrNull()
    if (!ctx) return

    if (this.monsterBuffer) {
      const src = ctx.createBufferSource()
      src.buffer = this.monsterBuffer
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(1, ctx.currentTime)
      src.connect(gain)
      gain.connect(ctx.destination)
      src.start(ctx.currentTime)
    } else {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(60, ctx.currentTime)
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.6)
      osc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 1.2)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.4)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 1.2)

      const n = this.noise(ctx, 0.6)
      const ng = ctx.createGain()
      const np = ctx.createBiquadFilter()
      np.type = 'lowpass'
      np.frequency.setValueAtTime(80, ctx.currentTime)
      np.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.3)
      np.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.9)
      ng.gain.setValueAtTime(0.1, ctx.currentTime)
      ng.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.3)
      ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0)
      n.connect(np)
      np.connect(ng)
      ng.connect(ctx.destination)
      n.start(ctx.currentTime)
      n.stop(ctx.currentTime + 0.6)

      const n2 = this.noise(ctx, 1.2)
      const ng2 = ctx.createGain()
      const np2 = ctx.createBiquadFilter()
      np2.type = 'highpass'
      np2.frequency.setValueAtTime(2000, ctx.currentTime)
      ng2.gain.setValueAtTime(0.03, ctx.currentTime)
      ng2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
      n2.connect(np2)
      np2.connect(ng2)
      ng2.connect(ctx.destination)
      n2.start(ctx.currentTime)
      n2.stop(ctx.currentTime + 1.2)
    }
  }

  playDeath(): void {
    const ctx = this.ctxOrNull()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(200, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.6)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.7)

    const n = this.noise(ctx, 0.5)
    const ng = ctx.createGain()
    const np = ctx.createBiquadFilter()
    np.type = 'lowpass'
    np.frequency.setValueAtTime(300, ctx.currentTime)
    np.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5)
    ng.gain.setValueAtTime(0.1, ctx.currentTime)
    ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    n.connect(np)
    np.connect(ng)
    ng.connect(ctx.destination)
    n.start(ctx.currentTime)
    n.stop(ctx.currentTime + 0.5)
  }

  dispose(): void {
    this.stopAmbient()
    this.ctx?.close()
    this.ctx = null
  }
}
