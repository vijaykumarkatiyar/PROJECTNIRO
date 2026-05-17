import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export function PlaceholderAvatar({ action = 'idle', ...props }) {
  const group = useRef()
  const head = useRef()
  const leftArm = useRef()
  const rightArm = useRef()

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (!group.current) return

    if (action === 'idle') {
      group.current.position.y = Math.sin(t * 2) * 0.05
      group.current.rotation.y = 0
      head.current.rotation.y = Math.sin(t) * 0.1
      head.current.rotation.z = 0
      head.current.rotation.x = 0
      leftArm.current.rotation.x = 0
      rightArm.current.rotation.x = 0
      leftArm.current.rotation.z = Math.sin(t * 1.5) * 0.1
      rightArm.current.rotation.z = -Math.sin(t * 1.5) * 0.1
    } else if (action === 'dance') {
      group.current.position.y = Math.abs(Math.sin(t * 5)) * 0.3
      group.current.rotation.y = Math.sin(t * 3) * 0.5
      head.current.rotation.z = Math.sin(t * 4) * 0.2
      leftArm.current.rotation.x = Math.sin(t * 6)
      rightArm.current.rotation.x = -Math.sin(t * 6)
      leftArm.current.rotation.z = 0.5
      rightArm.current.rotation.z = -0.5
    } else if (action === 'talk') {
      group.current.position.y = Math.sin(t * 2) * 0.02
      group.current.rotation.y = Math.sin(t * 0.5) * 0.1
      head.current.rotation.y = 0
      head.current.rotation.z = 0
      head.current.rotation.x = Math.sin(t * 15) * 0.05
      leftArm.current.rotation.z = Math.sin(t * 3) * 0.3
      rightArm.current.rotation.z = -Math.sin(t * 4) * 0.2
    }
  })

  return (
    <group ref={group} {...props} dispose={null}>
      {/* Head */}
      <mesh ref={head} position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color="#c084fc" emissive="#aa3bff" emissiveIntensity={0.2} roughness={0.2} metalness={0.8} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.7, 0]}>
        <capsuleGeometry args={[0.3, 0.8, 4, 16]} />
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* Left Arm */}
      <mesh ref={leftArm} position={[-0.45, 0.8, 0]}>
        <capsuleGeometry args={[0.08, 0.6, 4, 16]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {/* Right Arm */}
      <mesh ref={rightArm} position={[0.45, 0.8, 0]}>
        <capsuleGeometry args={[0.08, 0.6, 4, 16]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
    </group>
  )
}
