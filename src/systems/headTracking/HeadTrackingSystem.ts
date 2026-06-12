import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

let headTrackingSystem: HeadTrackingSystemImpl | null = null

export class HeadTrackingSystemImpl {
  private faceLandmarker: FaceLandmarker | null = null
  private video: HTMLVideoElement | null = null
  private stream: MediaStream | null = null
  private _isTracking = false
  private _headYaw = 0
  private _headPitch = 0
  private _isMouthOpen = false
  private _prevMouthOpen = false
  private _mouthFire = false
  private animationId = 0
  private enabled = false
  private baseNoseX = 0.5
  private baseNoseY = 0.5

  async initialize(config?: Partial<{ enabled: boolean; maxFPS: number }>): Promise<void> {
    this.enabled = config?.enabled ?? true
    if (!this.enabled) return

    if (this.faceLandmarker) {
      if (!this._isTracking) {
        this._isTracking = true
        this.detectLoop()
      }
      return
    }

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

      this.video = document.createElement('video')
      this.video.width = 640
      this.video.height = 480
      this.video.setAttribute('style', 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none')
      document.body.appendChild(this.video)

      this.stream = await navigator.mediaDevices.getUserMedia({ video: true })
      this.video.srcObject = this.stream
      await this.video.play()

      this._isTracking = true
      this.detectLoop()
    } catch (error) {
      console.warn('Head tracking initialization failed:', error)
      this.enabled = false
    }
  }

  private detectLoop = (): void => {
    if (!this._isTracking || !this.faceLandmarker || !this.video) return
    if (this.video.readyState >= 2) {
      const result = this.faceLandmarker.detectForVideo(this.video, performance.now())
      if (result.faceLandmarks && result.faceLandmarks.length > 0) {
        const face = result.faceLandmarks[0]
        const noseTip = face[0]
        this._headYaw = Math.max(-1, Math.min(1, (noseTip.x - this.baseNoseX) * 8))
        this._headPitch = Math.max(-1, Math.min(1, (this.baseNoseY - noseTip.y) * 4))

        let faceMinY = 1, faceMaxY = 0
        let lipMinY = 1, lipMaxY = 0
        for (const pt of face) {
          faceMinY = Math.min(faceMinY, pt.y)
          faceMaxY = Math.max(faceMaxY, pt.y)
          if (pt.x > 0.25 && pt.x < 0.75 && pt.y > 0.55 && pt.y < 0.85) {
            lipMinY = Math.min(lipMinY, pt.y)
            lipMaxY = Math.max(lipMaxY, pt.y)
          }
        }
        const faceH = faceMaxY - faceMinY
        this._isMouthOpen = faceH > 0.01 && ((lipMaxY - lipMinY) / faceH) > 0.08
        this._mouthFire = this._isMouthOpen && !this._prevMouthOpen
        this._prevMouthOpen = this._isMouthOpen
      }
    }
    this.animationId = requestAnimationFrame(this.detectLoop)
  }

  getHeadYaw(): number { return this._headYaw }
  getHeadPitch(): number { return this._headPitch }
  getIsMouthOpen(): boolean { return this._isMouthOpen }
  getMouthFire(): boolean { return this._mouthFire }
  getIsTracking(): boolean { return this._isTracking }

  enable(): void { this.enabled = true; this._isTracking = true }
  disable(): void { this.enabled = false; this._isTracking = false }
  setCalibrationOffset(noseX: number, noseY: number): void {
    this.baseNoseX = noseX
    this.baseNoseY = noseY
  }
  calibrate(): void {}
  recenter(): void { this._headYaw = 0; this._headPitch = 0 }

  dispose(): void {
    this._isTracking = false
    cancelAnimationFrame(this.animationId)
    this.stream?.getTracks().forEach(t => t.stop())
    this.video?.remove()
    this.faceLandmarker?.close()
  }

  update(): void {}

  static getInstance(): HeadTrackingSystemImpl {
    if (!headTrackingSystem) {
      headTrackingSystem = new HeadTrackingSystemImpl()
    }
    return headTrackingSystem
  }
}
