import type { HeadTrackingSystemImpl } from '../systems/headTracking/HeadTrackingSystem'

const DWELL_MS = 2000

export interface MenuButton {
  id: string
  label: string
}

export class MainMenu {
  private container: HTMLDivElement | null = null
  private cursorEl: HTMLDivElement | null = null
  private buttons: { id: string; el: HTMLDivElement; bar: HTMLDivElement; timer: number }[] = []
  private headTracking: HeadTrackingSystemImpl | null = null
  private rafId = 0
  private running = false
  private resolve: ((id: string) => void) | null = null
  private mouseX = window.innerWidth / 2
  private mouseY = window.innerHeight / 2
  private useMouse = false
  private onMouseMove: ((e: MouseEvent) => void) | null = null

  async show(
    headTracking: HeadTrackingSystemImpl | null,
    buttons: MenuButton[]
  ): Promise<string> {
    this.headTracking = headTracking
    this.createOverlay(buttons)
    this.setupMouseTracking()
    this.running = true
    this.loop()
    return new Promise((resolve) => { this.resolve = resolve })
  }

  private createOverlay(buttons: MenuButton[]): void {
    this.container = document.createElement('div')
    this.container.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:linear-gradient(180deg,#0a0a0a 0%,#1a1a1a 100%)',
      'z-index:100',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'font-family:monospace',
    ].join(';')

    const title = document.createElement('div')
    title.style.cssText = [
      'color:#fff',
      'font-size:48px',
      'font-weight:bold',
      'margin-bottom:60px',
      'text-shadow:0 0 30px rgba(100,200,255,0.3)',
      'letter-spacing:4px',
    ].join(';')
    title.textContent = 'TANK 3D'
    this.container.appendChild(title)

    const subtitle = document.createElement('div')
    subtitle.style.cssText = [
      'color:rgba(255,255,255,0.35)',
      'font-size:14px',
      'margin-top:-48px',
      'margin-bottom:60px',
      'letter-spacing:2px',
    ].join(';')
    subtitle.textContent = 'SÉLECTIONNEZ UNE OPTION'
    this.container.appendChild(subtitle)

    for (const btn of buttons) {
      const btnEl = document.createElement('div')
      btnEl.style.cssText = [
        'position:relative',
        'width:340px',
        'padding:20px 36px',
        'margin:8px 0',
        'background:rgba(255,255,255,0.04)',
        'border:1px solid rgba(255,255,255,0.12)',
        'border-radius:12px',
        'color:rgba(255,255,255,0.6)',
        'font-size:20px',
        'font-family:monospace',
        'text-align:center',
        'cursor:default',
        'overflow:hidden',
        'transition:border-color 0.2s, color 0.2s, background 0.2s',
        'user-select:none',
      ].join(';')

      const label = document.createElement('span')
      label.style.cssText = 'position:relative;z-index:1'
      label.textContent = btn.label
      btnEl.appendChild(label)

      const bar = document.createElement('div')
      bar.style.cssText = [
        'position:absolute',
        'bottom:0',
        'left:0',
        'height:3px',
        'width:0%',
        'background:linear-gradient(90deg,#4488ff,#88ff88)',
        'border-radius:0 0 12px 12px',
        'transition:width 0.05s linear',
      ].join(';')
      btnEl.appendChild(bar)

      this.container.appendChild(btnEl)
      this.buttons.push({ id: btn.id, el: btnEl, bar, timer: -1 })
    }

    this.cursorEl = document.createElement('div')
    this.cursorEl.style.cssText = [
      'position:fixed',
      'width:28px',
      'height:28px',
      'pointer-events:none',
      'z-index:101',
      'transform:translate(-50%,-50%)',
      'opacity:0.8',
    ].join(';')

    const outer = document.createElement('div')
    outer.style.cssText = [
      'position:absolute',
      'inset:0',
      'border:2px solid rgba(255,255,255,0.5)',
      'border-radius:50%',
    ].join(';')
    this.cursorEl.appendChild(outer)

    const inner = document.createElement('div')
    inner.style.cssText = [
      'position:absolute',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'width:6px',
      'height:6px',
      'background:#fff',
      'border-radius:50%',
    ].join(';')
    this.cursorEl.appendChild(inner)

    document.body.appendChild(this.container)
    document.body.appendChild(this.cursorEl)
  }

  private setupMouseTracking(): void {
    this.onMouseMove = (e: MouseEvent) => {
      this.useMouse = true
      this.mouseX = e.clientX
      this.mouseY = e.clientY
    }
    window.addEventListener('mousemove', this.onMouseMove)
  }

  private loop = (): void => {
    if (!this.running) return

    let cx: number, cy: number

    if (this.useMouse || !this.headTracking || !this.headTracking.getIsTracking()) {
      cx = this.mouseX
      cy = this.mouseY
    } else {
      const yaw = this.headTracking.getHeadYaw()
      const pitch = this.headTracking.getHeadPitch()
      const margin = 40
      cx = (-yaw + 1) / 2 * (window.innerWidth - margin * 2) + margin
      cy = (-pitch + 1) / 2 * (window.innerHeight - margin * 2) + margin
    }

    if (this.cursorEl) {
      this.cursorEl.style.left = `${cx}px`
      this.cursorEl.style.top = `${cy}px`
    }

    let hoveredId: string | null = null
    for (const btn of this.buttons) {
      const r = btn.el.getBoundingClientRect()
      if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
        hoveredId = btn.id
        break
      }
    }

    const now = performance.now()
    for (const btn of this.buttons) {
      if (btn.id === hoveredId) {
        if (btn.timer === -1) btn.timer = now
        const elapsed = now - btn.timer
        const progress = Math.min(elapsed / DWELL_MS, 1)
        btn.bar.style.width = `${progress * 100}%`
        btn.el.style.borderColor = 'rgba(68,136,255,0.6)'
        btn.el.style.color = '#fff'
        btn.el.style.background = 'rgba(68,136,255,0.08)'

        if (progress >= 1) {
          this.select(btn.id)
          return
        }
      } else {
        btn.timer = -1
        btn.bar.style.width = '0%'
        btn.el.style.borderColor = 'rgba(255,255,255,0.12)'
        btn.el.style.color = 'rgba(255,255,255,0.6)'
        btn.el.style.background = 'rgba(255,255,255,0.04)'
      }
    }

    this.rafId = requestAnimationFrame(this.loop)
  }

  private select(id: string): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
    if (this.onMouseMove) window.removeEventListener('mousemove', this.onMouseMove)
    this.cursorEl?.remove()
    this.container?.remove()
    this.resolve?.(id)
  }
}
