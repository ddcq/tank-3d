import * as THREE from 'three'

interface AssetRecord {
  texture?: THREE.Texture
  model?: THREE.Object3D
}

export class AssetManager {
  private cache = new Map<string, AssetRecord>()
  private loading = new Map<string, Promise<void>>()

  private readonly textureLoader = new THREE.TextureLoader()

  async loadTexture(key: string, url: string): Promise<THREE.Texture> {
    const existing = this.cache.get(key)?.texture
    if (existing) return existing

    if (!this.loading.has(key)) {
      this.loading.set(
        key,
        new Promise((resolve, reject) => {
          this.textureLoader.load(url, (tex) => {
            this.cache.set(key, { texture: tex })
            this.loading.delete(key)
            resolve()
          }, undefined, reject)
        }),
      )
    }

    await this.loading.get(key)
    return this.cache.get(key)!.texture!
  }

  getTexture(key: string): THREE.Texture | undefined {
    return this.cache.get(key)?.texture
  }

  dispose(): void {
    for (const record of this.cache.values()) {
      record.texture?.dispose()
    }
    this.cache.clear()
  }
}
