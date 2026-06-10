export class HUD {
  private scoreEl = document.createElement('div')
  private waveEl = document.createElement('div')
  private livesEl = document.createElement('div')
  private infoEl = document.createElement('div')

  score = 0
  wave = 1
  lives = 3

  show(): void {
    this.addCSS()

    this.scoreEl.className = 'hud-score'
    this.waveEl.className = 'hud-wave'
    this.livesEl.className = 'hud-lives'
    this.infoEl.className = 'hud-info'

    this.updateUI()
  }

  update(score: number, wave: number, lives: number): void {
    this.score = score
    this.wave = wave
    this.lives = lives
    this.updateUI()
  }

  private updateUI(): void {
    if (!this.scoreEl.parentNode) return
    this.scoreEl.textContent = `SCORE: ${this.score}`
    this.waveEl.textContent = `WAVE: ${this.wave}`
    const heartColor = this.lives > 0 ? '#ff3333' : '#555'
    this.livesEl.innerHTML = String(this.lives)
      .split('')
      .map(() => `<span style="color:${heartColor};font-size:18px">♥</span>`)
      .join(' ')
  }

  reset(): void {
    this.score = 0
    this.wave = 1
    this.lives = 3
    this.updateUI()
  }

  private addCSS(): void {
    if (document.getElementById('hud-styles')) return
    const style = document.createElement('style')
    style.id = 'hud-styles'
    style.textContent = `
      .hud-score, .hud-wave { position: fixed; top: 20px; color: #fff; font-size: 18px; font-weight: bold; text-shadow: 0 0 6px rgba(0,0,0,.7); z-index: 20; }
      .hud-score { left: 50%; transform: translateX(-50%); }
      .hud-wave { right: 30px; top: 20px; font-size: 16px; opacity: .8; }
      .hud-lives { position: fixed; left: 30px; top: 20px; z-index: 20; display: flex; gap: 4px; }
      .hud-info { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); color: rgba(255,255,255,.6); font-size: 13px; background: rgba(0,0,0,.45); padding: 8px 18px; border-radius: 8px; z-index: 20; pointer-events: none; white-space: nowrap; }
      #crosshair { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); color: rgba(255,255,255,.5); font-size: 28px; text-shadow: 0 0 6px rgba(0,0,0,.6); z-index: 15; pointer-events: none; }
    `
    document.head.appendChild(style)
    // Rebuild container content since the method may fire multiple times during init
    let container = document.getElementById('hud')
    if (!container) {
      container = document.createElement('div')
      container.id = 'hud'
      container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10'
      document.body.appendChild(container as Node)
    }
    const c = container as HTMLElement
    if (!c.querySelector('.hud-score')) c.append(this.scoreEl, this.waveEl, this.livesEl, this.infoEl)
  }

  hide(): void {
    document.getElementById('hud')?.remove()
  }
}
