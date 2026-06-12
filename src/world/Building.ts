import * as THREE from 'three'

const CONCRETE = [0x7a7a7a, 0x8a8a8a, 0x6a6a6a, 0x9a9994, 0x727272]
const BURNT = [0x3a2a1a, 0x4a3322, 0x553322, 0x443322, 0x332211, 0x2a1a0a]

const MODEL_SCALE = 0.012

export class Building {
  readonly mesh: THREE.Group
  readonly depth: number

  constructor(side: 'left' | 'right', _index: number, modelGeom: THREE.BufferGeometry, texture?: THREE.Texture) {
    const damage = Math.random()
    const isBurnt = damage > 0.55

    let color: number
    if (isBurnt) {
      color = BURNT[Math.floor(Math.random() * BURNT.length)]
    } else if (texture) {
      const palette = CONCRETE
      const base = palette[Math.floor(Math.random() * palette.length)]
      color = base
    } else {
      color = CONCRETE[Math.floor(Math.random() * CONCRETE.length)]
    }

    const bodyMat = new THREE.MeshStandardMaterial({
      map: texture || undefined,
      color: texture ? color : undefined,
      roughness: isBurnt ? 0.98 : 0.85,
      metalness: isBurnt ? 0 : 0.05,
    })

    const body = new THREE.Mesh(modelGeom, bodyMat)
    body.castShadow = true
    body.receiveShadow = true

    const scale = MODEL_SCALE * (0.8 + Math.random() * 0.4)
    body.scale.set(scale, scale, scale)

    const group = new THREE.Group()
    group.add(body)

    const box = new THREE.Box3().setFromObject(body)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    body.position.x -= center.x
    body.position.z -= center.z
    body.position.y -= box.min.y

    const d = size.z
    this.depth = d

    if (damage > 0.7) {
      body.rotation.z = (Math.random() - 0.5) * 0.15
      body.rotation.x = (Math.random() - 0.5) * 0.1
    } else if (damage > 0.35) {
      body.rotation.z = (Math.random() - 0.5) * 0.06
    }

    const rotY = side === 'left' ? -Math.PI / 2 : Math.PI / 2
    group.rotation.y = rotY

    const xPos = side === 'left'
      ? -12 - Math.random() * 3 - d / 2
      : 12 + Math.random() * 3 + d / 2

    group.position.set(xPos, 0, 0)

    this.mesh = group
  }
}
