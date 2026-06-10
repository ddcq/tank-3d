export interface SaveData {
  score: number
  wave: number
  lives: number
  savedAt: string
}

export class SaveManager {
  private static readonly KEY = 'space-invader-ua-save'

  static save(score: number, wave: number, lives: number): void {
    const data: SaveData = { score, wave, lives, savedAt: new Date().toISOString() }
    localStorage.setItem(this.KEY, JSON.stringify(data))
  }

  static load(): SaveData | null {
    const raw = localStorage.getItem(this.KEY)
    if (!raw) return null
    try { return JSON.parse(raw) as SaveData } catch { return null }
  }

  static clear(): void {
    localStorage.removeItem(this.KEY)
  }

  static hasSave(): boolean {
    return this.load() !== null
  }
}
