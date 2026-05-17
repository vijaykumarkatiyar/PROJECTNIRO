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

function CameraController({ action, bgMode, controlsRef, headPositionRef }) {
  const { camera } = useThree()
  const targetPos = useRef(DEFAULT_POS.clone())
  const targetLookAt = useRef(DEFAULT_TARGET.clone())

  useFrame((_, delta) => {
    const isDance = action === 'dance'
    const isSitting = bgMode === 'sitting_room'
    
    // Smoothly track look-at target
    let goalTarget = DEFAULT_TARGET
    if (isDance) {
      goalTarget = DANCE_TARGET
    } else if (isSitting) {
      // Look slightly below head at desk level (y = 0.08) to center the room setup
      goalTarget = new THREE.Vector3(0, 0.08, 0.05)
    } else {
      goalTarget = headPositionRef.current || DEFAULT_TARGET
    }
    
    // Zoom out for dance/room, or stay perfectly portrait-locked on the face/shoulders
    let goalPos = DEFAULT_POS
    if (isDance) {
      goalPos = DANCE_POS
    } else if (isSitting) {
      // Beautiful zoomed-out camera angle showing the entire desk, keyboard, mouse, and chair base
      goalPos = new THREE.Vector3(0, 0.48, 1.65)
    } else {
      goalPos = new THREE.Vector3(
        goalTarget.x,
        goalTarget.y,
        goalTarget.z + 0.65 // Perfect portrait framing distance
      )
    }

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

function SittingRoom3D() {
  const mouseRef = useRef()

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (mouseRef.current) {
      // Slide wireless mouse in sync with her right forearm slide!
      mouseRef.current.position.z = 0.02 + Math.sin(t * 1.5) * Math.cos(t * 0.7) * 0.02
      mouseRef.current.position.x = 0.22 + Math.cos(t * 1.5) * 0.005
    }
  })

  return (
    <group>
      {/* ── Floor standing plane ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.582, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#111827" roughness={0.6} metalness={0.1} />
      </mesh>
      
      {/* Floor Grid for Techy Look */}
      <gridHelper args={[20, 24, '#3b82f6', '#1e293b']} position={[0, -0.58, 0]} />

      {/* ── Minimalist Office Desk ── */}
      <group position={[0, 0, 0.22]}>
        {/* Table Top */}
        <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.1, 0.04, 0.54]} />
          <meshStandardMaterial color="#2d1a12" roughness={0.3} metalness={0.15} /> {/* Walnut finish */}
        </mesh>
        
        {/* Desk Drawer */}
        <mesh position={[-0.32, 0.07, 0.02]} castShadow>
          <boxGeometry args={[0.26, 0.1, 0.4]} />
          <meshStandardMaterial color="#111827" roughness={0.6} />
        </mesh>

        {/* Desk Legs (Sleek Metal Cylinders) */}
        {[
          [-0.5, -0.215, -0.22], // Front Left
          [0.5, -0.215, -0.22],  // Front Right
          [-0.5, -0.215, 0.22],  // Back Left
          [0.5, -0.215, 0.22],   // Back Right
        ].map((pos, idx) => (
          <mesh key={idx} position={pos} castShadow>
            <cylinderGeometry args={[0.018, 0.018, 0.7]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}
      </group>

      {/* ── Minimalist Ergonomic Desk Chair ── */}
      <group position={[0, 0, -0.15]}>
        {/* Chair Seat Base */}
        <mesh position={[0, -0.15, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.42, 0.05, 0.42]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} />
        </mesh>
        
        {/* Seat Padding Details */}
        <mesh position={[0, -0.12, 0]}>
          <boxGeometry args={[0.4, 0.02, 0.4]} />
          <meshStandardMaterial color="#312e81" roughness={0.8} />
        </mesh>

        {/* Chair Backrest */}
        <mesh position={[0, 0.15, -0.2]} rotation={[0.08, 0, 0]} castShadow>
          <boxGeometry args={[0.38, 0.46, 0.05]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} />
        </mesh>
        
        {/* Backrest Frame support */}
        <mesh position={[0, -0.02, -0.21]} castShadow>
          <boxGeometry args={[0.06, 0.25, 0.03]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Armrests */}
        {[
          [-0.22, -0.04, 0.05], // Left Armrest
          [0.22, -0.04, 0.05]   // Right Armrest
        ].map((pos, idx) => (
          <group key={idx} position={pos}>
            <mesh position={[0, 0, 0]} castShadow>
              <cylinderGeometry args={[0.012, 0.012, 0.18]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.09, -0.05]} castShadow>
              <boxGeometry args={[0.045, 0.02, 0.2]} />
              <meshStandardMaterial color="#090d16" roughness={0.6} />
            </mesh>
          </group>
        ))}

        {/* Chair Support Pole */}
        <mesh position={[0, -0.365, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.38]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
        </mesh>

        {/* Chair Base (5-star metal stand) */}
        {[0, 72, 144, 216, 288].map((angle, idx) => {
          const rad = (angle * Math.PI) / 180
          return (
            <group key={idx} rotation={[0, rad, 0]} position={[0, -0.55, 0]}>
              <mesh position={[0, 0, 0.16]} rotation={[0.1, 0, 0]} castShadow>
                <boxGeometry args={[0.03, 0.025, 0.32]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
              </mesh>
              <mesh position={[0, -0.02, 0.3]} castShadow>
                <sphereGeometry args={[0.018]} />
                <meshStandardMaterial color="#020617" roughness={0.9} />
              </mesh>
            </group>
          )
        })}
      </group>

      {/* ── Desktop Computer & Accessories ── */}
      <group position={[0, 0.17, 0.22]}>
        {/* Monitor Base Plate */}
        <mesh position={[0, 0, 0.2]} castShadow>
          <boxGeometry args={[0.2, 0.01, 0.14]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>

        {/* Monitor Support Stand */}
        <mesh position={[0, 0.1, 0.21]} rotation={[0.1, 0, 0]} castShadow>
          <boxGeometry args={[0.035, 0.2, 0.025]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Monitor Bezel/Frame */}
        <mesh position={[0, 0.25, 0.18]} castShadow>
          <boxGeometry args={[0.56, 0.35, 0.02]} />
          <meshStandardMaterial color="#0f172a" roughness={0.4} />
        </mesh>

        {/* Glowing Screen Plane (Code/Chat Editor theme) */}
        <mesh position={[0, 0.25, 0.169]}>
          <planeGeometry args={[0.54, 0.33]} />
          <meshStandardMaterial 
            color="#a855f7" 
            emissive="#a855f7" 
            emissiveIntensity={1.2} 
            roughness={0.1} 
          />
        </mesh>

        {/* Techy Code Editor Details */}
        <group position={[0, 0.25, 0.168]}>
          <mesh position={[-0.16, 0.13, 0]}>
            <planeGeometry args={[0.18, 0.02]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
          </mesh>
          <mesh position={[-0.22, -0.02, 0]}>
            <planeGeometry args={[0.07, 0.25]} />
            <meshBasicMaterial color="#3b0764" transparent opacity={0.6} />
          </mesh>
          {[
            [-0.09, 0.09, 0.12, '#ef4444'],
            [-0.07, 0.05, 0.16, '#3b82f6'],
            [-0.11, 0.01, 0.09, '#10b981'],
            [-0.04, -0.03, 0.2, '#f59e0b'],
            [-0.06, -0.07, 0.14, '#3b82f6'],
            [-0.12, -0.11, 0.07, '#a855f7'],
          ].map((val, idx) => (
            <mesh key={idx} position={[val[0], val[1], 0]}>
              <planeGeometry args={[val[2], 0.012]} />
              <meshBasicMaterial color={val[3]} />
            </mesh>
          ))}
        </group>

        {/* Monitor Screen Back Glow */}
        <pointLight position={[0, 0.3, 0.25]} distance={2.2} intensity={2.0} color="#c084fc" />

        {/* ── Modern Slim Keyboard ── */}
        <group position={[-0.05, 0.005, 0.02]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.34, 0.01, 0.11]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.003, 0]} receiveShadow>
            <boxGeometry args={[0.32, 0.008, 0.09]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} />
          </mesh>
        </group>

        {/* ── Animated Wireless Mouse ── */}
        <mesh ref={mouseRef} position={[0.22, 0.008, 0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.045, 0.016, 0.075]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} />
        </mesh>
      </group>
    </group>
  )
}

export function AvatarCanvas({ action, bgMode = 'default', onDance, onAvatarLoaded, wordEventRef }) {
  const controlsRef = useRef()
  const yawRef = useRef(0)
  const headPositionRef = useRef(new THREE.Vector3(0, 0.65, 0))

  const isSitting = bgMode === 'sitting_room'
  const avatarPos = isSitting ? [0, 0.22, 0.05] : [0, 0.35, 0]

  return (
    <div className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing select-none">
      <Canvas shadows camera={{ position: [0, 0.65, 0.85], fov: 52 }} gl={{ alpha: true }}>
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
            position={avatarPos} 
            action={action} 
            bgMode={bgMode}
            onDance={onDance} 
            yawRef={yawRef} 
            onLoaded={onAvatarLoaded} 
            wordEventRef={wordEventRef} 
            headPositionRef={headPositionRef}
          />
        </React.Suspense>

        {/* Conditionally render the 3D Classroom Environment Setup */}
        {isSitting && <SittingRoom3D />}

        {/* Ground shadow beneath the character */}
        <ContactShadows position={[0, -0.58, 0]} opacity={0.65} scale={4} blur={2.5} far={2} />

        <DragYaw yawRef={yawRef} />
        <CameraController action={action} bgMode={bgMode} controlsRef={controlsRef} headPositionRef={headPositionRef} />

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
