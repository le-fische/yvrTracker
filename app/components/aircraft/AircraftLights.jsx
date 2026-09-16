'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export default function AircraftLights({ metrics, isNight }) {
  const strobeRef = useRef();
  const beaconRef = useRef();

  useFrame((state) => {
    if (!isNight) {
      if (strobeRef.current) strobeRef.current.visible = false;
      if (beaconRef.current) beaconRef.current.visible = false;
      return;
    }
    const t = state.clock.elapsedTime;
    
    const flashStrobe = (t % 1.5) < 0.05 || (t % 1.5 > 0.15 && t % 1.5 < 0.2);
    if (strobeRef.current) {
      strobeRef.current.visible = true;
      strobeRef.current.children.forEach(c => {
         c.material.opacity = flashStrobe ? 1 : 0;
      })
    }

    const flashBeacon = (t % 1.2) < 0.1;
    if (beaconRef.current) {
      beaconRef.current.visible = true;
      beaconRef.current.children.forEach(c => {
         c.material.opacity = flashBeacon ? 1 : 0;
      })
    }
  });

  if (!metrics) return null;

  const lenZ = metrics.maxZ - metrics.minZ;
  const lenX = metrics.maxX - metrics.minX;
  const heightY = metrics.maxY - metrics.minY;
  
  const s = Math.max(lenZ, lenX) * 0.008; // Proportional light radius
  
  const fuselageTopY = metrics.minY + heightY * 0.35;
  const fuselageBotY = metrics.minY + heightY * 0.15;
  const fuselageZ = metrics.minZ + lenZ * 0.4;
  
  const wingY = metrics.minY + heightY * 0.25;
  const wingZ = metrics.minZ + lenZ * 0.6; // Swept back
  
  const tailY = metrics.maxY - heightY * 0.05;
  const tailZ = metrics.maxZ - lenZ * 0.05;

  return (
    <group>
      <group ref={strobeRef}>
        <mesh position={[metrics.minX, wingY, wingZ]}>
          <sphereGeometry args={[s, 8, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh position={[metrics.maxX, wingY, wingZ]}>
          <sphereGeometry args={[s, 8, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh position={[0, tailY, tailZ]}>
          <sphereGeometry args={[s, 8, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      <group ref={beaconRef}>
        <mesh position={[0, fuselageTopY, fuselageZ]}>
          <sphereGeometry args={[s*1.2, 8, 8]} />
          <meshBasicMaterial color="#ff0000" transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh position={[0, fuselageBotY, fuselageZ]}>
          <sphereGeometry args={[s*1.2, 8, 8]} />
          <meshBasicMaterial color="#ff0000" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      {isNight && (
        <group>
          <mesh position={[metrics.minX, wingY, wingZ + s*2]}>
            <sphereGeometry args={[s*0.8, 8, 8]} />
            <meshBasicMaterial color="#ff0000" depthWrite={false} />
          </mesh>
          <mesh position={[metrics.maxX, wingY, wingZ + s*2]}>
            <sphereGeometry args={[s*0.8, 8, 8]} />
            <meshBasicMaterial color="#00ff00" depthWrite={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}
