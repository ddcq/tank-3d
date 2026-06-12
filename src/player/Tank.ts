import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { DDSLoader } from 'three/examples/jsm/loaders/DDSLoader.js'

const MODEL_SCALE = 0.55

export class PlayerTank {
  readonly group: THREE.Group
  readonly turretGroup: THREE.Group
  private barrelMesh: THREE.Mesh | null = null
  loaded = false

  constructor() {
    this.group = new THREE.Group()
    this.turretGroup = new THREE.Group()
    this.turretGroup.position.z = 0.4
    this.turretGroup.position.y = 0.3
    this.group.add(this.turretGroup)
  }

  async loadModel(): Promise<void> {
    const objLoader = new OBJLoader()
    const ddsLoader = new DDSLoader()

    try {
      const [obj, diffuseMap, normalMap, roughnessMap] = await Promise.all([
        objLoader.loadAsync('/models/tank/IS4.obj'),
        ddsLoader.loadAsync('/models/tank/IS_4M.dds'),
        ddsLoader.loadAsync('/models/tank/IS_4M_NM.dds'),
        ddsLoader.loadAsync('/models/tank/IS_4M_SM.dds'),
      ])

      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true
          child.receiveShadow = true
          const mat = child.material as THREE.MeshStandardMaterial
          mat.map = diffuseMap
          mat.normalMap = normalMap
          mat.roughnessMap = roughnessMap
          mat.needsUpdate = true
        }
      })

      obj.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE)
      obj.rotation.y = Math.PI

      const box = new THREE.Box3().setFromObject(obj)
      const center = box.getCenter(new THREE.Vector3())
      obj.position.x -= center.x
      obj.position.z -= center.z
      obj.position.y -= box.min.y

      const turretMeshes: THREE.Mesh[] = []
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.name.includes('Turret') || child.name.includes('Gun')) {
            turretMeshes.push(child)
          }
          if (child.name.includes('Gun')) {
            this.barrelMesh = child
          }
        }
      })

      this.group.add(obj)

      for (const mesh of turretMeshes) {
        this.turretGroup.attach(mesh)
      }
      this.loaded = true
    } catch (err) {
      console.warn('Failed to load 3D tank model, using fallback:', err)
      this.createFallback()
    }
  }

  private createFallback(): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0x4b6f2f, roughness: 0.7 })
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 3.6), mat)
    hull.position.y = 0.5
    hull.castShadow = true
    this.group.add(hull)

    const turretMat = new THREE.MeshStandardMaterial({ color: 0x3a5a1f, roughness: 0.7 })
    const turret = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.6), turretMat)
    turret.position.y = 1.05
    this.turretGroup.add(turret)

    const barrelGeo = new THREE.CylinderGeometry(0.1, 0.12, 3, 8)
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x3a5a1f, roughness: 0.6 })
    this.barrelMesh = new THREE.Mesh(barrelGeo, barrelMat)
    this.barrelMesh.rotation.x = Math.PI / 2
    this.barrelMesh.position.set(0, 0, -1.8)
    this.turretGroup.add(this.barrelMesh)

    this.loaded = true
  }

  get barrel(): THREE.Mesh | null { return this.barrelMesh }
}
