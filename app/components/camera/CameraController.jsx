'use client'

import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

export default function CameraController({ cameraMode, selectedAircraftId, resetTrigger, chaseViewIndex }) {
  const controlsRef = useRef()
  const { camera, gl } = useThree()
  const defaultFov = useRef(75)

  useEffect(() => {
    const handleWheel = (e) => {
      if (cameraMode === 'TOWER') {
        e.preventDefault()
        e.stopPropagation()
        camera.fov += e.deltaY * 0.05
        camera.fov = Math.max(2, Math.min(camera.fov, 75))
        camera.updateProjectionMatrix()
      }
    }
    const domElement = gl.domElement;
    domElement.addEventListener('wheel', handleWheel, { passive: false })
    return () => domElement.removeEventListener('wheel', handleWheel)
  }, [cameraMode, camera, gl])

  useEffect(() => {
    if (cameraMode !== 'TOWER') {
      camera.fov = defaultFov.current
      camera.updateProjectionMatrix()
    }
  }, [cameraMode, camera])

  useEffect(() => {
    if (resetTrigger > 0 && controlsRef.current && cameraMode === 'GLOBAL' && !selectedAircraftId) {
      controlsRef.current.target.set(4.06, 0, -0.25)
    }
  }, [resetTrigger, cameraMode, selectedAircraftId])

  useFrame(() => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    const aircraftRef = selectedAircraftId && typeof window !== 'undefined' ? window.aircraftRefs?.[selectedAircraftId] : null;

    if (cameraMode === 'TOWER') {
      const towerPos = new THREE.Vector3(4.06, 0.7, -0.25);
      controls.enableZoom = false;
      controls.enablePan = false;
      
      if (aircraftRef) {
        controls.enabled = false; 
        camera.position.copy(towerPos);
        const planePos = new THREE.Vector3();
        aircraftRef.getWorldPosition(planePos);
        
        const targetRotation = new THREE.Quaternion().setFromRotationMatrix(
          new THREE.Matrix4().lookAt(camera.position, planePos, camera.up)
        );
        if (camera.quaternion.angleTo(targetRotation) > 0.05) {
          camera.quaternion.slerp(targetRotation, 0.05);
        } else {
          camera.quaternion.copy(targetRotation);
        }
      } else {
        controls.enabled = true;
        controls.enableZoom = true;
        controls.minDistance = 0.0001;
        controls.maxDistance = 0.0001;
        controls.target.copy(towerPos);
      }
    } else {
      controls.minDistance = 1;
      controls.maxDistance = 200;

      if (aircraftRef) {
        const planePos = new THREE.Vector3();
        aircraftRef.getWorldPosition(planePos);
        
        if (controls.target.distanceTo(planePos) > 0.5) {
          controls.target.lerp(planePos, 0.05);
        } else {
          controls.target.copy(planePos);
        }
        
        if (chaseViewIndex > 0) {
          controls.enabled = false;
          const offset = new THREE.Vector3();
          
          if (chaseViewIndex === 1) offset.set(0, 0.4, 1.2); 
          else if (chaseViewIndex === 2) offset.set(-1.0, 0.2, 0); 
          else if (chaseViewIndex === 3) offset.set(1.0, 0.2, 0); 
          else if (chaseViewIndex === 4) offset.set(0, 0.1, -1.2); 
          
          offset.applyQuaternion(aircraftRef.quaternion);
          const targetCamPos = planePos.clone().add(offset);
          
          camera.position.copy(targetCamPos);
          
          const targetRotation = new THREE.Quaternion().setFromRotationMatrix(
            new THREE.Matrix4().lookAt(camera.position, planePos, camera.up)
          );
          camera.quaternion.copy(targetRotation);
        } else {
          controls.enabled = true;
          controls.enableZoom = true;
          controls.enablePan = true;
        }
      } else {
        controls.enabled = true;
        controls.enableZoom = true;
        controls.enablePan = true;
        
        if (typeof window.lastResetTrigger === 'undefined') window.lastResetTrigger = 0;
        
        if (resetTrigger > window.lastResetTrigger) {
           window.isResetting = true;
           window.lastResetTrigger = resetTrigger;
        }

        if (window.isResetting) {
           const defaultTarget = new THREE.Vector3(4.06, 0, -0.25);
           const defaultPos = new THREE.Vector3(-11, 10, -15);
           controls.target.lerp(defaultTarget, 0.05);
           camera.position.lerp(defaultPos, 0.05);
           
           if (controls.target.distanceTo(defaultTarget) < 0.1 && camera.position.distanceTo(defaultPos) < 0.1) {
               window.isResetting = false;
           }
        }
      }
    }
    
    if (controls.enabled) {
      controls.update();
    }
  })

  return <OrbitControls ref={controlsRef} target={[4.06, 0, -0.25]} maxPolarAngle={Math.PI / 2 - 0.01} makeDefault />
}
