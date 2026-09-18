export const CAMERA_VIEWS = [
  { id: 'FOLLOW', label: 'FOLLOW' },
  { id: 'CHASE', label: 'CHASE', offset: [0, 0.4, 1.2], lookAt: 'aircraft' },
  { id: 'WING_L', label: 'WING L', offset: [-1.0, 0.2, 0], lookAt: 'aircraft' },
  { id: 'WING_R', label: 'WING R', offset: [1.0, 0.2, 0], lookAt: 'aircraft' },
  { id: 'LEAD', label: 'LEAD', offset: [0, 0.1, -1.2], lookAt: 'aircraft' },
  { id: 'COCKPIT', label: 'COCKPIT', lookAt: 'forward' },
  { id: 'TAIL', label: 'TAIL', lookAt: 'forward' }
]
