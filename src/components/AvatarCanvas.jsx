import React, { useRef, useEffect, useState } from 'react'
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

const AVATAR_CANVAS_PROFILES = {
  female: {
    standingY: 0.35,
    sittingY: 0.29,
    sittingDanceY: 0.42,
  },
  male: {
    standingY: 0.35,
    sittingY: -0.08,
    sittingDanceY: 0.08,
  },
}

const LIGHTING_PRESETS = {
  studio: {
    ambientIntensity: 0.8,
    ambientColor: '#ffffff',
    keyPosition: [2, 2, 3],
    keyIntensity: 2.5,
    keyColor: '#ffffff',
    fillPosition: [-2, 2, -3],
    fillIntensity: 0.5,
    fillColor: '#a8b1ff',
    rimPosition: [-1.3, 1.15, 1.8],
    rimIntensity: 0.45,
    rimColor: '#f9a8d4',
    environment: 'city',
    shadowOpacity: 0.65,
    shadowBlur: 2.8,
    shadowScale: 4.4,
    shadowFar: 2.4,
    shadowRadius: 4,
    exposure: 1.02,
  },
  warm: {
    ambientIntensity: 0.7,
    ambientColor: '#fff7ed',
    keyPosition: [1.8, 2.2, 2.4],
    keyIntensity: 2.85,
    keyColor: '#fed7aa',
    fillPosition: [-2.2, 1.4, -2.2],
    fillIntensity: 0.34,
    fillColor: '#f97316',
    rimPosition: [-1.4, 1.1, 1.7],
    rimIntensity: 0.72,
    rimColor: '#facc15',
    environment: 'sunset',
    shadowOpacity: 0.54,
    shadowBlur: 3.2,
    shadowScale: 4.6,
    shadowFar: 2.5,
    shadowRadius: 5,
    exposure: 1.08,
  },
  cool: {
    ambientIntensity: 0.64,
    ambientColor: '#e0f2fe',
    keyPosition: [2.1, 2.1, 3],
    keyIntensity: 2.35,
    keyColor: '#bae6fd',
    fillPosition: [-2.2, 1.8, -2.8],
    fillIntensity: 0.62,
    fillColor: '#67e8f9',
    rimPosition: [-1.2, 1.25, 1.8],
    rimIntensity: 0.88,
    rimColor: '#a78bfa',
    environment: 'dawn',
    shadowOpacity: 0.72,
    shadowBlur: 2.7,
    shadowScale: 4.5,
    shadowFar: 2.4,
    shadowRadius: 4,
    exposure: 1.0,
  },
  neon: {
    ambientIntensity: 0.44,
    ambientColor: '#cffafe',
    keyPosition: [1.4, 1.8, 2.3],
    keyIntensity: 1.9,
    keyColor: '#22d3ee',
    fillPosition: [-1.7, 1.7, -2],
    fillIntensity: 1.15,
    fillColor: '#f472b6',
    rimPosition: [1.5, 1.15, -1.2],
    rimIntensity: 1.35,
    rimColor: '#a78bfa',
    environment: 'night',
    shadowOpacity: 0.82,
    shadowBlur: 2.25,
    shadowScale: 4.8,
    shadowFar: 2.7,
    shadowRadius: 3,
    exposure: 1.12,
  },
  night: {
    ambientIntensity: 0.34,
    ambientColor: '#c7d2fe',
    keyPosition: [1.6, 2.4, 2.7],
    keyIntensity: 1.45,
    keyColor: '#c4b5fd',
    fillPosition: [-2, 1.2, -2.5],
    fillIntensity: 0.26,
    fillColor: '#38bdf8',
    rimPosition: [-1.2, 1.25, 1.8],
    rimIntensity: 0.95,
    rimColor: '#818cf8',
    environment: 'night',
    shadowOpacity: 0.88,
    shadowBlur: 2.1,
    shadowScale: 4.9,
    shadowFar: 2.8,
    shadowRadius: 3,
    exposure: 0.92,
  },
}

function RendererShadowSettings({ exposure }) {
  const { gl } = useThree()

  useEffect(() => {
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = exposure
    gl.outputColorSpace = THREE.SRGBColorSpace
  }, [exposure, gl])

  return null
}

function DragYaw({ yawRef, disabled }) {
  const { gl } = useThree()
  const dragging = useRef(false)
  const lastX = useRef(0)

  useEffect(() => {
    if (disabled) return
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
  }, [gl, yawRef, disabled])

  return null
}

function CameraController({ action, bgMode, controlsRef, headPositionRef }) {
  const { camera } = useThree()
  const targetPos = useRef(DEFAULT_POS.clone())
  const targetLookAt = useRef(DEFAULT_TARGET.clone())
  const isTransitioning = useRef(true)

  // Trigger transition when bgMode or action changes
  useEffect(() => {
    isTransitioning.current = true
  }, [bgMode, action])

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
      // Front-side room angle keeps the desk readable without the monitor hiding her hand.
      goalPos = new THREE.Vector3(0.82, 0.5, 1.55)
    } else {
      goalPos = new THREE.Vector3(
        goalTarget.x,
        goalTarget.y,
        goalTarget.z + 0.65 // Perfect portrait framing distance
      )
    }

    if (isTransitioning.current) {
      // Smoothly interpolate toward goal during active transitions
      targetPos.current.lerp(goalPos, LERP_SPEED * delta)
      targetLookAt.current.lerp(goalTarget, LERP_SPEED * delta)

      camera.position.copy(targetPos.current)
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetLookAt.current)
        controlsRef.current.update()
      }

      // Check if camera has arrived at the destination preset to end transition
      const posDist = camera.position.distanceTo(goalPos)
      const targetDist = controlsRef.current ? controlsRef.current.target.distanceTo(goalTarget) : 0
      if (posDist < 0.02 && targetDist < 0.02) {
        isTransitioning.current = false
      }
    } else {
      // Transition finished
      if (!isSitting) {
        // In standard modes (not 3D room), keep tracking her face smoothly as she breathes/talks
        targetPos.current.lerp(goalPos, LERP_SPEED * delta)
        targetLookAt.current.lerp(goalTarget, LERP_SPEED * delta)
        camera.position.copy(targetPos.current)
        if (controlsRef.current) {
          controlsRef.current.target.copy(targetLookAt.current)
          controlsRef.current.update()
        }
      }
    }
  })

  return null
}

function SittingRoom3D({ onCollisionChange }) {
  const mouseRef = useRef()
  const objectRefs = useRef({})
  const probeBoxRef = useRef(new THREE.Box3())
  const objectBoxRef = useRef(new THREE.Box3())
  const lastCollisionKeyRef = useRef('')

  const setCollisionTarget = (name) => (node) => {
    if (node) {
      objectRefs.current[name] = node
    } else {
      delete objectRefs.current[name]
    }
  }

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (mouseRef.current) {
      // Slide wireless mouse in sync with the visible right hand.
      mouseRef.current.position.z = 0.02 + Math.sin(t * 1.5) * Math.cos(t * 0.7) * 0.02
      mouseRef.current.position.x = -0.18 + Math.cos(t * 1.5) * 0.005
      mouseRef.current.rotation.y = Math.sin(t * 1.8) * 0.04
      mouseRef.current.updateWorldMatrix(true, true)

      const probeBox = probeBoxRef.current
      probeBox.setFromObject(mouseRef.current).expandByScalar(0.006)

      const collisions = []
      for (const [name, object] of Object.entries(objectRefs.current)) {
        if (!object) continue
        const objectBox = objectBoxRef.current
        objectBox.setFromObject(object)
        if (!probeBox.intersectsBox(objectBox)) continue

        if (name === 'Desk surface') {
          const surfacePenetration = objectBox.max.y - probeBox.min.y
          if (surfacePenetration > 0.014) collisions.push(name)
        } else {
          collisions.push(name)
        }
      }

      const collisionKey = collisions.sort().join('|')
      if (collisionKey !== lastCollisionKeyRef.current) {
        lastCollisionKeyRef.current = collisionKey
        onCollisionChange?.(collisions)
      }
    }
  })

  return (
    <group>
      {/* ── Floor standing plane ── */}
      <mesh ref={setCollisionTarget('Floor')} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.582, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#4b5563" roughness={0.78} metalness={0.04} />
      </mesh>

      {/* ── Minimalist Office Desk ── */}
      <group position={[0, 0, 0.34]}>
        {/* Table Top */}
        <mesh ref={setCollisionTarget('Desk surface')} position={[0, 0.15, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.1, 0.04, 0.54]} />
          <meshStandardMaterial color="#2d1a12" roughness={0.3} metalness={0.15} /> {/* Walnut finish */}
        </mesh>

        {/* Desk Drawer */}
        <mesh ref={setCollisionTarget('Desk drawer')} position={[-0.32, 0.07, 0.02]} castShadow>
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
          <mesh key={idx} ref={setCollisionTarget(`Desk leg ${idx + 1}`)} position={pos} castShadow>
            <cylinderGeometry args={[0.018, 0.018, 0.7]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}
      </group>

      {/* ── Minimalist Ergonomic Desk Chair ── */}
      <group position={[0, 0, -0.15]}>
        {/* Chair Seat Base */}
        <mesh ref={setCollisionTarget('Chair seat')} position={[0, -0.15, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.42, 0.05, 0.42]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} />
        </mesh>

        {/* Seat Padding Details */}
        <mesh ref={setCollisionTarget('Chair cushion')} position={[0, -0.12, 0]}>
          <boxGeometry args={[0.4, 0.02, 0.4]} />
          <meshStandardMaterial color="#312e81" roughness={0.8} />
        </mesh>

        {/* Chair Backrest */}
        <mesh ref={setCollisionTarget('Chair back')} position={[0, 0.15, -0.2]} rotation={[0.08, 0, 0]} castShadow>
          <boxGeometry args={[0.38, 0.46, 0.05]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} />
        </mesh>

        {/* Backrest Frame support */}
        <mesh ref={setCollisionTarget('Chair back support')} position={[0, -0.02, -0.21]} castShadow>
          <boxGeometry args={[0.06, 0.25, 0.03]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Armrests */}
        {[
          [-0.22, -0.04, 0.05], // Left Armrest
          [0.22, -0.04, 0.05]   // Right Armrest
        ].map((pos, idx) => (
          <group key={idx} ref={setCollisionTarget(idx === 0 ? 'Left armrest' : 'Right armrest')} position={pos}>
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
        <mesh ref={setCollisionTarget('Chair support pole')} position={[0, -0.365, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.38]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
        </mesh>

        {/* Chair Base (5-star metal stand) */}
        {[0, 72, 144, 216, 288].map((angle, idx) => {
          const rad = (angle * Math.PI) / 180
          return (
            <group key={idx} ref={setCollisionTarget(`Chair base ${idx + 1}`)} rotation={[0, rad, 0]} position={[0, -0.55, 0]}>
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
      <group position={[0, 0.17, 0.34]}>
        <group position={[-0.28, 0, 0]}>
          {/* Monitor Base Plate */}
          <mesh ref={setCollisionTarget('Monitor base')} position={[0, 0, 0.2]} castShadow>
            <boxGeometry args={[0.18, 0.01, 0.13]} />
            <meshStandardMaterial color="#0f172a" roughness={0.5} />
          </mesh>

          {/* Monitor Support Stand */}
          <mesh ref={setCollisionTarget('Monitor stand')} position={[0, 0.1, 0.21]} rotation={[0.1, 0, 0]} castShadow>
            <boxGeometry args={[0.032, 0.2, 0.025]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
          </mesh>

          {/* Monitor Bezel/Frame */}
          <mesh ref={setCollisionTarget('Monitor')} position={[0, 0.25, 0.18]} castShadow>
            <boxGeometry args={[0.46, 0.32, 0.02]} />
            <meshStandardMaterial color="#0f172a" roughness={0.4} />
          </mesh>

          {/* Glowing Screen Plane (Code/Chat Editor theme) */}
          <mesh position={[0, 0.25, 0.169]}>
            <planeGeometry args={[0.44, 0.3]} />
            <meshStandardMaterial
              color="#a855f7"
              emissive="#a855f7"
              emissiveIntensity={1.2}
              roughness={0.1}
            />
          </mesh>

          {/* Techy Code Editor Details */}
          <group position={[0, 0.25, 0.168]}>
            <mesh position={[-0.12, 0.11, 0]}>
              <planeGeometry args={[0.14, 0.018]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
            </mesh>
            <mesh position={[-0.17, -0.02, 0]}>
              <planeGeometry args={[0.055, 0.22]} />
              <meshBasicMaterial color="#3b0764" transparent opacity={0.6} />
            </mesh>
            {[
              [-0.06, 0.08, 0.09, '#ef4444'],
              [-0.05, 0.045, 0.13, '#3b82f6'],
              [-0.08, 0.01, 0.075, '#10b981'],
              [-0.03, -0.025, 0.16, '#f59e0b'],
              [-0.05, -0.06, 0.11, '#3b82f6'],
              [-0.09, -0.095, 0.06, '#a855f7'],
            ].map((val, idx) => (
              <mesh key={idx} position={[val[0], val[1], 0]}>
                <planeGeometry args={[val[2], 0.012]} />
                <meshBasicMaterial color={val[3]} />
              </mesh>
            ))}
          </group>

          {/* Monitor Screen Back Glow */}
          <pointLight position={[0, 0.3, 0.25]} distance={2.2} intensity={2.0} color="#c084fc" />
        </group>

        {/* ── Modern Slim Keyboard ── */}
        <group ref={setCollisionTarget('Keyboard')} position={[0.15, 0.005, 0.02]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.34, 0.01, 0.11]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.003, 0]} receiveShadow>
            <boxGeometry args={[0.32, 0.008, 0.09]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} />
          </mesh>
          <group position={[-0.02, 0.026, -0.006]} rotation={[0.18, 0, -0.1]}>
            <mesh scale={[1.35, 0.45, 1.0]} castShadow>
              <sphereGeometry args={[0.024, 18, 12]} />
              <meshStandardMaterial color="#e8a17c" roughness={0.55} />
            </mesh>
            {[-0.03, -0.012, 0.006, 0.024].map((x, idx) => (
              <mesh key={idx} position={[x, -0.003, -0.014]} rotation={[Math.PI / 2.6, 0, 0.08]} castShadow>
                <capsuleGeometry args={[0.004, 0.03, 4, 8]} />
                <meshStandardMaterial color="#e8a17c" roughness={0.55} />
              </mesh>
            ))}
          </group>
        </group>

        {/* ── Animated Wireless Mouse ── */}
        <group ref={mouseRef} position={[-0.18, 0.008, 0.02]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.045, 0.016, 0.075]} />
            <meshStandardMaterial color="#1e293b" roughness={0.4} />
          </mesh>
          <group position={[0, 0.024, 0.002]}>
            <mesh scale={[1.15, 0.52, 1.35]} castShadow>
              <sphereGeometry args={[0.026, 18, 12]} />
              <meshStandardMaterial color="#e8a17c" roughness={0.55} />
            </mesh>
            {[-0.018, -0.006, 0.006, 0.018].map((x, idx) => (
              <mesh key={idx} position={[x, -0.001, -0.006]} rotation={[Math.PI / 2.45, 0, 0]} castShadow>
                <capsuleGeometry args={[0.0045, 0.026, 4, 8]} />
                <meshStandardMaterial color="#e8a17c" roughness={0.55} />
              </mesh>
            ))}
            <mesh position={[0.032, -0.002, 0.006]} rotation={[0.6, 0.2, 1.0]} castShadow>
              <capsuleGeometry args={[0.005, 0.028, 4, 8]} />
              <meshStandardMaterial color="#e8a17c" roughness={0.55} />
            </mesh>
          </group>
          <mesh position={[0, 0.012, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.036, 0.0025, 8, 28]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.72} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export function AvatarCanvas({ action, avatarMode = 'female', bgMode = 'default', lightingMode = 'studio', onAvatarLoaded, visemeCurrentRef }) {
  const controlsRef = useRef()
  const yawRef = useRef(0)
  const headPositionRef = useRef(new THREE.Vector3(0, 0.65, 0))
  const [collisionAlert, setCollisionAlert] = useState([])
  const lighting = LIGHTING_PRESETS[lightingMode] || LIGHTING_PRESETS.studio
  const avatarProfile = AVATAR_CANVAS_PROFILES[avatarMode] || AVATAR_CANVAS_PROFILES.female

  const isSitting = bgMode === 'sitting_room'
  const avatarPos = isSitting
    ? (action === 'dance' ? [0, avatarProfile.sittingDanceY, -0.02] : [0, avatarProfile.sittingY, -0.02])
    : [0, avatarProfile.standingY, 0]

  useEffect(() => {
    if (!isSitting) setCollisionAlert([])
  }, [isSitting])

  useEffect(() => {
    yawRef.current = 0
  }, [avatarMode])

  return (
    <div className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing select-none">
      <Canvas
        shadows="soft"
        camera={{ position: [0, 0.65, 0.85], fov: 52, near: 0.01, far: 100 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      >
        <RendererShadowSettings exposure={lighting.exposure} />
        <ambientLight intensity={lighting.ambientIntensity} color={lighting.ambientColor} />
        <directionalLight
          castShadow
          position={lighting.keyPosition}
          intensity={lighting.keyIntensity}
          color={lighting.keyColor}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={0.15}
          shadow-camera-far={9}
          shadow-camera-left={-3.5}
          shadow-camera-right={3.5}
          shadow-camera-top={3.5}
          shadow-camera-bottom={-3.5}
          shadow-bias={-0.00015}
          shadow-normalBias={0.025}
          shadow-radius={lighting.shadowRadius}
        />
        <spotLight
          castShadow
          position={[lighting.keyPosition[0] * 0.7, lighting.keyPosition[1] + 0.8, lighting.keyPosition[2] * 0.7]}
          intensity={lighting.keyIntensity * 0.45}
          color={lighting.keyColor}
          angle={0.52}
          penumbra={0.68}
          distance={6}
          decay={1.35}
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.00012}
          shadow-normalBias={0.02}
        />
        <directionalLight position={lighting.fillPosition} intensity={lighting.fillIntensity} color={lighting.fillColor} />
        <pointLight position={lighting.rimPosition} intensity={lighting.rimIntensity} color={lighting.rimColor} distance={4.5} />
        <Environment key={lighting.environment} preset={lighting.environment} />

        <React.Suspense fallback={null}>
          <GirlAvatar
            key={avatarMode}
            avatarMode={avatarMode}
            position={avatarPos}
            action={action}
            bgMode={bgMode}
            yawRef={yawRef}
            onLoaded={onAvatarLoaded}
            visemeCurrentRef={visemeCurrentRef}
            headPositionRef={headPositionRef}
          />
        </React.Suspense>

        {/* Conditionally render the 3D Classroom Environment Setup */}
        {isSitting && <SittingRoom3D onCollisionChange={setCollisionAlert} />}

        {/* Ground shadow beneath the character */}
        <ContactShadows
          position={[0, -0.58, 0]}
          opacity={lighting.shadowOpacity}
          scale={lighting.shadowScale}
          blur={lighting.shadowBlur}
          far={lighting.shadowFar}
          resolution={1024}
          color="#020617"
        />

        <DragYaw yawRef={yawRef} disabled={isSitting} />
        <CameraController action={action} bgMode={bgMode} controlsRef={controlsRef} headPositionRef={headPositionRef} />

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableRotate={isSitting}
          enableZoom={true}
          minDistance={isSitting ? 1.35 : 0.5}
          maxDistance={6.5}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2 + 0.1}
          target={[0, 0.65, 0]}
        />
      </Canvas>
      {isSitting && collisionAlert.length > 0 && (
        <div className="absolute top-16 left-1/2 z-10 -translate-x-1/2 rounded-full border border-red-400/60 bg-red-950/75 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-red-100 shadow-lg backdrop-blur-md">
          {`Collision: ${collisionAlert.join(', ')}`}
        </div>
      )}
    </div>
  )
}
