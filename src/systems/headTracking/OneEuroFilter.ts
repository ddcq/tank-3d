/**
 * One Euro Filter implementation for smoothing head tracking data
 * Based on: http://cristal.univ-lille.fr/~casiez/1euro/
 */
export class OneEuroFilter {
  private readonly minCutoff: number
  private readonly beta: number
  private readonly dCutOff: number
  
  private lastValue: number | null = null
  private lastDerivative: number | null = null
  private lastTimestamp: number | null = null

  constructor(
    minCutoff: number = 1.0,
    beta: number = 0.0,
    dCutOff: number = 1.0
  ) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutOff = dCutOff
  }

  filter(value: number, timestamp?: number): number {
    if (this.lastValue === null) {
      this.lastValue = value
      this.lastDerivative = 0.0
      this.lastTimestamp = timestamp || Date.now()
      return value
    }

    const ts = timestamp || Date.now()
    const lastTs = this.lastTimestamp || ts
    const dt = Math.max(0.001, (ts - lastTs)) / 1000.0
    this.lastTimestamp = ts

    // Compute the rate of change (derivative)
    const der = (value - this.lastValue) / dt
    this.lastDerivative = this.lowPassFilter(der, this.dCutOff, this.lastDerivative ?? 0)

    // Filter the value using the derivative
    const filteredValue = this.lowPassFilter(
      value,
      this.minCutoff + this.beta * Math.abs(this.lastDerivative ?? 0),
      this.lastValue
    )

    this.lastValue = filteredValue
    return filteredValue
  }

  private lowPassFilter(value: number, cutoff: number, lastValue: number): number {
    const alpha = 1.0 / (1.0 + cutoff)
    return alpha * value + (1.0 - alpha) * lastValue
  }

  reset(value: number) {
    this.lastValue = value
    this.lastDerivative = 0.0
    this.lastTimestamp = Date.now()
  }
}