import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const NUM_LANDMARKS = 468
const STABILITY_THRESHOLD = 0.004
const CONSECUTIVE_STABLE = 20
const STABLE_RATIO = 0.7
const CONFIRMATION_MS = 600
const VIDEO_W = 640
const VIDEO_H = 480

export class CalibrationScreen {
  private video: HTMLVideoElement | null = null
  private stream: MediaStream | null = null
  private faceLandmarker: FaceLandmarker | null = null
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private container: HTMLDivElement | null = null
  private running = false
  private animationId = 0
  private resolveCalib: ((value: { noseX: number; noseY: number }) => void) | null = null

  async calibrate(): Promise<{ noseX: number; noseY: number }> {
    const overlay = this.createOverlay()
    document.body.appendChild(overlay)
    this.container = overlay

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      )
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
      })
    } catch (err) {
      this.showError('Impossible de charger le modèle de reconnaissance faciale')
      await this.delay(2000)
      this.dispose()
      return { noseX: 0.5, noseY: 0.5 }
    }

    const videoWrap = overlay.querySelector<HTMLDivElement>('.calib-video-wrap')!
    this.canvas = document.createElement('canvas')
    this.canvas.width = VIDEO_W
    this.canvas.height = VIDEO_H
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'
    videoWrap.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!

    this.video = document.createElement('video')
    this.video.width = VIDEO_W
    this.video.height = VIDEO_H
    this.video.setAttribute('playsinline', '')
    this.video.style.cssText = 'width:100%;height:100%;object-fit:cover'
    videoWrap.insertBefore(this.video, this.canvas)

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true })
      this.video.srcObject = this.stream
      await this.video.play()
    } catch (err) {
      this.showError('Caméra non accessible. Vérifiez les permissions.')
      await this.delay(2000)
      this.dispose()
      return { noseX: 0.5, noseY: 0.5 }
    }

    this.showMessage('Regardez fixement le point rouge', 'Stabilisez votre tête...')
    this.running = true
    this.runCalibration()

    return new Promise((resolve) => {
      this.resolveCalib = resolve
    })
  }

  private finish(result: { noseX: number; noseY: number }): void {
    this.running = false
    cancelAnimationFrame(this.animationId)
    this.dispose()
    this.resolveCalib?.(result)
  }

  private runCalibration(): void {
    const prevPositions = new Float32Array(NUM_LANDMARKS * 2)
    const stableCounts = new Uint16Array(NUM_LANDMARKS)
    let confirmed = false
    let confirmTimer = 0
    let lastNoseX = 0.5
    let lastNoseY = 0.5
    const progressEl = this.container!.querySelector<HTMLDivElement>('.calib-progress')!
    const statusEl = this.container!.querySelector<HTMLDivElement>('.calib-status')!
    const instructionsEl = this.container!.querySelector<HTMLDivElement>('.calib-instructions')!

    const loop = (timestamp: number): void => {
      if (!this.running || !this.faceLandmarker || !this.video) {
        this.finish({ noseX: lastNoseX, noseY: lastNoseY })
        return
      }

      if (this.video.readyState >= 2) {
        const result = this.faceLandmarker.detectForVideo(this.video, timestamp)
        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
          const face = result.faceLandmarks[0]
          const noseTip = face[0]
          lastNoseX = noseTip.x
          lastNoseY = noseTip.y

          this.drawFace(face, stableCounts)

          let stableLandmarks = 0
          for (let i = 0; i < face.length; i++) {
            const dx = face[i].x - prevPositions[i * 2]
            const dy = face[i].y - prevPositions[i * 2 + 1]
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < STABILITY_THRESHOLD) {
              stableCounts[i] = Math.min(stableCounts[i] + 1, CONSECUTIVE_STABLE + 5)
            } else {
              stableCounts[i] = 0
            }
            if (stableCounts[i] >= CONSECUTIVE_STABLE) {
              stableLandmarks++
            }
            prevPositions[i * 2] = face[i].x
            prevPositions[i * 2 + 1] = face[i].y
          }

          const ratio = stableLandmarks / face.length
          progressEl.textContent = `${Math.round(ratio * 100)}%`

          if (ratio >= STABLE_RATIO) {
            if (!confirmed) {
              confirmed = true
              confirmTimer = timestamp
              statusEl.textContent = 'Calibrage réussi ✓'
            }
            if (timestamp - confirmTimer >= CONFIRMATION_MS) {
              instructionsEl.textContent = 'Calibration terminée ✓'
              this.finish({ noseX: lastNoseX, noseY: lastNoseY })
              return
            }
          } else {
            confirmed = false
            statusEl.textContent = 'Stabilisez votre tête...'
          }
        }
      }

      this.animationId = requestAnimationFrame(loop)
    }

    this.animationId = requestAnimationFrame(loop)
  }

  private drawFace(face: { x: number; y: number }[], stableCounts: Uint16Array): void {
    if (!this.canvas || !this.ctx) return
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height
    ctx.clearRect(0, 0, w, h)

    for (let i = 0; i < face.length; i++) {
      const x = face[i].x * w
      const y = face[i].y * h

      ctx.beginPath()
      ctx.arc(x, y, 1.5, 0, Math.PI * 2)
      ctx.fillStyle = stableCounts[i] >= CONSECUTIVE_STABLE ? '#00ff00' : '#ff0000'
      ctx.fill()
    }
  }

  private createOverlay(): HTMLDivElement {
    const container = document.createElement('div')
    container.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:#000',
      'z-index:100',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'font-family:monospace',
    ].join(';')

    const videoWrap = document.createElement('div')
    videoWrap.className = 'calib-video-wrap'
    videoWrap.style.cssText = [
      'position:relative',
      `width:${VIDEO_W}px`,
      `height:${VIDEO_H}px`,
      'max-width:90vw',
      'max-height:60vh',
      'border:2px solid #444',
      'border-radius:12px',
      'overflow:hidden',
      'transform:scaleX(-1)',
    ].join(';')
    container.appendChild(videoWrap)

    const focusDot = document.createElement('div')
    focusDot.style.cssText = [
      'position:absolute',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'width:8px',
      'height:8px',
      'border-radius:50%',
      'background:#ff0000',
      'z-index:2',
      'pointer-events:none',
    ].join(';')
    videoWrap.appendChild(focusDot)

    const loadingText = document.createElement('div')
    loadingText.className = 'calib-loading'
    loadingText.style.cssText = [
      'position:absolute',
      'inset:0',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'color:#888',
      'font-size:18px',
      'background:#111',
      'z-index:3',
    ].join(';')
    loadingText.textContent = 'Chargement du modèle...'
    videoWrap.appendChild(loadingText)

    const instructionsEl = document.createElement('div')
    instructionsEl.className = 'calib-instructions'
    instructionsEl.style.cssText = [
      'color:#fff',
      'font-size:18px',
      'margin-top:24px',
      'text-align:center',
      'max-width:500px',
      'line-height:1.5',
    ].join(';')
    instructionsEl.innerHTML = 'Regardez fixement le <strong>point rouge</strong> pendant quelques secondes'
    container.appendChild(instructionsEl)

    const progressEl = document.createElement('div')
    progressEl.className = 'calib-progress'
    progressEl.style.cssText = [
      'color:#88ff88',
      'font-size:36px',
      'font-weight:bold',
      'margin-top:16px',
    ].join(';')
    progressEl.textContent = '0%'
    container.appendChild(progressEl)

    const statusEl = document.createElement('div')
    statusEl.className = 'calib-status'
    statusEl.style.cssText = [
      'color:#aaa',
      'font-size:14px',
      'margin-top:8px',
    ].join(';')
    statusEl.textContent = 'Initialisation...'
    container.appendChild(statusEl)

    const skipBtn = document.createElement('button')
    skipBtn.textContent = 'Passer (SKIP)'
    skipBtn.style.cssText = [
      'margin-top:32px',
      'padding:10px 28px',
      'background:#333',
      'color:#999',
      'border:1px solid #555',
      'border-radius:8px',
      'font-family:monospace',
      'font-size:14px',
      'cursor:pointer',
    ].join(';')
    skipBtn.addEventListener('click', () => this.finish({ noseX: 0.5, noseY: 0.5 }))
    skipBtn.addEventListener('mouseenter', () => {
      skipBtn.style.background = '#444'
      skipBtn.style.color = '#fff'
    })
    skipBtn.addEventListener('mouseleave', () => {
      skipBtn.style.background = '#333'
      skipBtn.style.color = '#999'
    })
    container.appendChild(skipBtn)

    return container
  }

  private showError(msg: string): void {
    const el = this.container?.querySelector<HTMLDivElement>('.calib-instructions')
    if (el) {
      el.innerHTML = `<span style="color:#ff4444">${msg}</span>`
    }
  }

  private showMessage(_msg: string, status: string): void {
    const loadingEl = this.container?.querySelector<HTMLDivElement>('.calib-loading')
    if (loadingEl) loadingEl.remove()
    const statusEl = this.container?.querySelector<HTMLDivElement>('.calib-status')
    if (statusEl) statusEl.textContent = status
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private dispose(): void {
    this.running = false
    cancelAnimationFrame(this.animationId)
    this.stream?.getTracks().forEach((t) => t.stop())
    this.faceLandmarker?.close()
    this.video?.remove()
    this.canvas?.remove()
    this.container?.remove()
    this.faceLandmarker = null
    this.stream = null
    this.video = null
    this.canvas = null
    this.ctx = null
    this.container = null
  }
}
