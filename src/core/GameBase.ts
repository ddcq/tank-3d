export abstract class GameBase {
  abstract readonly id: string
  abstract readonly label: string

  constructor(protected readonly container: HTMLElement) {}

  abstract init(): Promise<void>
  abstract start(): void
  abstract stop(): void
  abstract dispose(): void
}
