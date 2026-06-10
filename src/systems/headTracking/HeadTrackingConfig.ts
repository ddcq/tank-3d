export interface HeadTrackingConfig {
  // Main enable/disable switch
  enabled: boolean

  // Sensitivity settings
  yawSensitivity: number
  pitchSensitivity: number
  rollSensitivity: number
  
  xSensitivity: number
  ySensitivity: number
  zSensitivity: number

  // Smoothing and filtering
  smoothing: number
  deadZone: number
  
  // Camera offset scaling
  cameraOffsetScale: number

  // Performance settings
  maxFPS: number
  processIntervalMS: number

  // Tracking limits
  yawLimit: { min: number; max: number }
  pitchLimit: { min: number; max: number }
  rollLimit: { min: number; max: number }
  
  translationLimit: { 
    x: { min: number; max: number } 
    y: { min: number; max: number } 
    z: { min: number; max: number } 
  }
}

export const DEFAULT_HEAD_TRACKING_CONFIG: HeadTrackingConfig = {
  enabled: true,
  
  // Sensitivity settings (multipliers)
  yawSensitivity: 1.0,
  pitchSensitivity: 1.0,
  rollSensitivity: 1.0,
  
  xSensitivity: 1.0,
  ySensitivity: 1.0,
  zSensitivity: 1.0,

  // Smoothing and filtering
  smoothing: 0.3,
  deadZone: 0.05,
  
  // Camera offset scaling (factor for distance from player)
  cameraOffsetScale: 0.5,

  // Performance settings
  maxFPS: 30,
  processIntervalMS: 1000 / 30, // ~30 FPS

  // Tracking limits in degrees/radians
  yawLimit: { min: -90, max: 90 },
  pitchLimit: { min: -60, max: 60 },
  rollLimit: { min: -45, max: 45 },
  
  translationLimit: { 
    x: { min: -50, max: 50 }, 
    y: { min: -30, max: 30 }, 
    z: { min: -40, max: 40 } 
  }
}