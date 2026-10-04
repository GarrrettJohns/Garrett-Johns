// Camera modes: which view the game is in and when it changes. Pure state,
// no three.js, so the rules can be tested headless. The renderer turns the
// current mode into a camera pose and blends smoothly between poses.
//
//   kingdom   – the high tactical view (~55° down) for building and defence
//   adventure – a lower trailing view for riding out and seeing landmarks
//   combat    – close behind the mounted king for a fight
//
// A cinematic is a short overlay on top of any mode (landmark reveals). It
// never takes away control: the king keeps moving and fighting.

export const MODES = ['kingdom', 'adventure', 'combat'];

// Poses and timing (metres, radians, seconds). Tuned on a 390×844 portrait
// view; see docs/crownfall/implementation-status.md.
export const CAM = {
  blend: 0.9,              // seconds for most of a transition
  adventure: { dist: 15, height: 8.5, ahead: 7, lookUp: 1.4, fov: 52 },
  combat: { dist: 12.5, height: 7.4, ahead: 5, lookUp: 1.6, shoulder: 1.9, fov: 56 },
  enterCombat: 14,         // an enemy this close to the king starts a fight view...
  leaveCombat: 22,         // ...which lasts until none is within this...
  combatHold: 2.5,         // ...for this long (hysteresis, so the view doesn't jerk)
  leaveHome: 1.0,          // seconds outside the build areas before the adventure view
  followTurn: 2.2,         // rad/s the chase camera swings round behind the king
  followArc: 1.9,          // ...but only when he heads within this angle of the way it faces
  manualHold: 1.6,         // seconds a manual camera turn is respected before following again
};

export function initialCam() {
  return { mode: 'kingdom', override: 'auto', calm: 0, away: 0 };
}

// Advance the camera state by dt. `ctx`:
//   uiBusy      – a build sheet, menu or placement is open (always kingdom)
//   nearEnemy   – distance from the king to the nearest live, mobile enemy
//   atHome      – the king is inside the walls or on an outpost's land
//   alive       – the king is alive (when not, stay put)
export function stepCam(state, ctx, dt) {
  const s = { ...state };
  if (s.override !== 'auto') {
    s.mode = ctx.uiBusy ? 'kingdom' : s.override;
    return s;
  }
  if (ctx.uiBusy || !ctx.alive) { s.mode = 'kingdom'; s.calm = 0; return s; }
  if (ctx.nearEnemy < CAM.enterCombat) { s.mode = 'combat'; s.calm = 0; return s; }
  if (s.mode === 'combat') {
    s.calm = ctx.nearEnemy < CAM.leaveCombat ? 0 : s.calm + dt;
    if (s.calm < CAM.combatHold) return s;
  }
  s.away = ctx.atHome ? 0 : s.away + dt;
  s.mode = s.away >= CAM.leaveHome ? 'adventure' : 'kingdom';
  return s;
}

// The manual camera button cycles Auto → Kingdom → Adventure → Combat → Auto.
export function cycleOverride(state) {
  const order = ['auto', 'kingdom', 'adventure', 'combat'];
  return { ...state, override: order[(order.indexOf(state.override) + 1) % order.length] };
}

// Turn a stick input (screen right = +x, screen up = -z) into a world-space
// direction for a camera looking along `yaw` (atan2 of its ground forward).
// In the kingdom view the camera looks north (yaw = π) and this is identity.
export function stickToWorld(input, yaw) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);   // camera forward on the ground
  const rx = -fz, rz = fx;                         // camera right
  return { x: rx * input.x - fx * input.z, z: rz * input.x - fz * input.z };
}
