import React, { useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'
import { GirlAvatar } from './GirlAvatar'
import * as THREE from 'three'

// Default (idle and talk) — face + shoulders portrait framing
const DEFAULT_POS = new THREE.Vector3(0, 0.65, 0.85)
const DEFAULT_TARGET = new THREE.Vector3(0, 0.65, 0)

// Full-body view for dancing
const DANCE_POS = new THREE.Vector3(0, 0.72, 3.35)
const DANCE_TARGET = new THREE.Vector3(0, 0.42, 0)

const LERP_SPEED = 2.5 // how fast the camera moves (higher = faster)

// Left-drag on canvas → rotate avatar around Y (radians per screen pixel)
const DRAG_YAW_SENSITIVITY = 0.005

function DragYaw({ yawRef }) {
  const { gl } = useThree()
  const dragging = useRef(false)
  const lastX = useRef(0)

  useEffect(() => {
    const canvas = gl.domElement

    const onPointerDown = (e) => {
      if (e.button !== 0) return
      dragging.current = true
      lastX.current = e.clientX
      canvas.setPointerCapture(e.pointerId)
    }

    const endDrag = (e) => {
      if (e.pointerId != null) {
        try {
          canvas.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }
      dragging.current = false
    }

    const onPointerMove = (e) => {
      if (!dragging.current) return
      const dx = e.clientX - lastX.current
      lastX.current = e.clientX
      yawRef.current += dx * DRAG_YAW_SENSITIVITY
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', endDrag)
    canvas.addEventListener('pointercancel', endDrag)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', endDrag)
      canvas.removeEventListener('pointercancel', endDrag)
    }
  }, [gl, yawRef])

  return null
}

function CameraController({ action, controlsRef, headPositionRef }) {
  const { camera } = useThree()
  const targetPos = useRef(DEFAULT_POS.clone())
  const targetLookAt = useRef(DEFAULT_TARGET.clone())

  useFrame((_, delta) => {
    const isDance = action === 'dance'
    
    // Smoothly track the actual head bone world coordinates, or fallback to default
    const goalTarget = isDance ? DANCE_TARGET : (headPositionRef.current || DEFAULT_TARGET)
    
    // Zoom out for dance, or stay perfectly portrait-locked on the face/shoulders
    const goalPos = isDance 
      ? DANCE_POS 
      : new THREE.Vector3(
          goalTarget.x,
          goalTarget.y,
          goalTarget.z + 0.65 // Perfect portrait framing distance
        )

    // Smoothly interpolate toward goal
    targetPos.current.lerp(goalPos, LERP_SPEED * delta)
    targetLookAt.current.lerp(goalTarget, LERP_SPEED * delta)

    camera.position.copy(targetPos.current)
    
    // Update OrbitControls target so it stays in sync
    if (controlsRef.current) {
      controlsRef.current.target.copy(targetLookAt.current)
      controlsRef.current.update()
    }
  })

  return null
}

export function AvatarCanvas({ action, onDance, onAvatarLoaded, wordEventRef }) {
  const controlsRef = useRef()
  const yawRef = useRef(0)
  const headPositionRef = useRef(new THREE.Vector3(0, 0.65, 0))

  return (
    <div className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing select-none">
      <Canvas shadows camera={{ position: [0, 0.65, 0.85], fov: 52 }}>
        <color attach="background" args={['#0f172a']} />
        <ambientLight intensity={0.8} />
        <directionalLight 
          castShadow 
          position={[2, 2, 3]} 
          intensity={2.5} 
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0001}
        />
        <directionalLight position={[-2, 2, -3]} intensity={0.5} color="#a8b1ff" />
        <Environment preset="city" />
        
        <React.Suspense fallback={null}>
          <GirlAvatar 
            position={[0, 0.35, 0]} 
            action={action} 
            onDance={onDance} 
            yawRef={yawRef} 
            onLoaded={onAvatarLoaded} 
            wordEventRef={wordEventRef} 
            headPositionRef={headPositionRef}
          />
        </React.Suspense>

        {/* Ground shadow beneath the character */}
        <ContactShadows position={[0, -0.58, 0]} opacity={0.65} scale={4} blur={2.5} far={2} />

        <DragYaw yawRef={yawRef} />
        <CameraController action={action} controlsRef={controlsRef} headPositionRef={headPositionRef} />

        <OrbitControls 
          ref={controlsRef}
          enablePan={false}
          enableRotate={false}
          enableZoom={true}
          minDistance={0.5}
          maxDistance={6.5}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2 + 0.1}
          target={[0, 0.65, 0]}
        />
      </Canvas>
    </div>
  )
}
