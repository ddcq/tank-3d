import * as THREE from 'three'

export interface HeadTrackingData {
  // Rotation in euler angles (degrees)
  yaw: number
  pitch: number
  roll: number

  // Translation in cm
  x: number
  y: number
  z: number
  
  // Tracking state
  isTracking: boolean
  confidence: number
}

export interface HeadTrackingState {
  // Current tracking data
  lastData: HeadTrackingData | null
  lastValidData: HeadTrackingData | null
  
  // Camera offset (calculated from head position)
  cameraOffset: THREE.Vector3
  cameraRotationOffset: THREE.Euler
  
  // Tracking status
  isCalibrated: boolean
  isTracking: boolean
  
  // Timing 
  lastUpdate: number
  lastValidTime: number
  
  // Filter state
  yawFilter: { value: number, velocity: number }
  pitchFilter: { value: number, velocity: number }
  rollFilter: { value: number, velocity: number }
  xFilter: { value: number, velocity: number }
  yFilter: { value: number, velocity: number }
  zFilter: { value: number, velocity: number }
  
  // Calibration
  calibrationOffset: THREE.Vector3
  calibrationRotation: THREE.Euler
}

export interface HeadTrackingConfig {
  enabled: boolean
  maxFPS: number
  processIntervalMS: number
  
  // Sensitivity settings (in degrees/cm)
  yawSensitivity: number
  pitchSensitivity: number  
  rollSensitivity: number
  xSensitivity: number
  ySensitivity: number
  zSensitivity: number

  // Limit settings (in degrees)
  yawLimit: { min: number; max: number }
  pitchLimit: { min: number; max: number }
  rollLimit: { min: number; max: number }
  
  // Translation limits (in cm) 
  translationLimit: {
    x: { min: number; max: number }
    y: { min: number; max: number }
    z: { min: number; max: number }
  }

  // Camera offset scaling factor
  cameraOffsetScale: number
}

export const DEFAULT_HEAD_TRACKING_CONFIG: HeadTrackingConfig = {
  enabled: true,
  maxFPS: 30,
  processIntervalMS: 33, // ~30 FPS
  
  // Sensitivity settings (in degrees/cm)
  yawSensitivity: 1.0,
  pitchSensitivity: 1.0,
  rollSensitivity: 1.0,
  xSensitivity: 1.0,
  ySensitivity: 1.0,
  zSensitivity: 1.0,

  // Limit settings (in degrees)
  yawLimit: { min: -45, max: 45 },
  pitchLimit: { min: -30, max: 30 },
  rollLimit: { min: -20, max: 20 },
  
  // Translation limits (in cm) 
  translationLimit: {
    x: { min: -20, max: 20 },
    y: { min: -20, max: 20 },
    z: { min: -20, max: 20 }
  },

  // Camera offset scaling factor
  cameraOffsetScale: 1.0
}

export interface HeadTrackingSystem {
  initialize(config?: Partial<HeadTrackingConfig>): Promise<void>
  update(): void
  calibrate(): void
  recenter(): void
  enable(): void
  disable(): void
  dispose(): void
  
  // Getters
  getIsTracking(): boolean
  getData(): HeadTrackingData | null
  getCameraOffset(): THREE.Vector3
  getCameraRotationOffset(): THREE.Euler
}