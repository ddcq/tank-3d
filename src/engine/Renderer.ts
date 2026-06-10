import * as THREE from 'three'

export class Renderer {
  public readonly instance: THREE.WebGLRenderer

  constructor(container: HTMLElement) {
    this.instance = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.instance.shadowMap.enabled = true
    this.instance.shadowMap.type = THREE.PCFSoftShadowMap
    this.instance.toneMapping = THREE.ACESFilmicToneMapping
    this.instance.toneMappingExposure = 1.0
    container.appendChild(this.instance.domElement)
    this.resize()
  }

  resize(): void {
    const width = window.innerWidth
    const height = window.innerHeight
    this.instance.setSize(width, height)
    this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.instance.render(scene, camera)
  }

  dispose(): void {
    this.instance.dispose()
  }
}
