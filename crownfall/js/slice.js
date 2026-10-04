// The Greenwood journey: the authored encounters along the opening route
// (castle hill → farmland → Fallen Village → bridge and Whispering Woods →
// East Ridge raid → foothill overlook). Pure data plus the rule for when
// each one opens; the simulation in world.js runs them and saves their state.
//
// Kinds:
//   visit – ride within `reach` of the site
//   clear – beat the guards camped at the site
//   raid  – as clear, but a scout rides in to warn the king and his troops
//           in the field join him
//
// State per encounter: 'locked' → 'open' → 'done'. Rewards are paid once, on
// the step to 'done'. Saving keeps the state and how many guards are left.

import { SITES } from './map.js';

export const ENCOUNTERS = [
  {
    id: 'farmland', site: 'farmland', kind: 'visit', reach: 10, icon: '🌾',
    opens: (w) => w.wave >= 1,   // after the first wave, once the tutorial has done its job
    title: "King's Farmland", sub: 'Good soil. Farms inside your walls feed the villagers who settle here',
    reward: { wood: 15 },
  },
  {
    id: 'village', site: 'village', kind: 'clear', icon: '🏚️',
    opens: (w) => w.wave >= 2,
    hint: 'Raiders have burnt the Fallen Village, north-west of the castle. Ride out and drive them off!',
    guards: ['grunt', 'grunt', 'raider', 'archer', 'grunt'],
    title: 'The Fallen Village is free!', sub: 'Three villagers come home to your kingdom',
    reward: { coins: 40, people: 3 },
  },
  {
    id: 'ruin', site: 'ruin', kind: 'visit', reach: 4.5, icon: '🏛️',
    opens: (w) => w.built('bridge'),
    hint: 'Woodcutters speak of an old ruin deep in the Whispering Woods, west of the forest road.',
    title: 'The Old Ruin', sub: 'A chest of old coins — and smoke rising from a watchtower on the East Ridge',
    reward: { coins: 30 }, look: 'ridge',
  },
  {
    id: 'ridge', site: 'ridge', kind: 'raid', icon: '⚔️',
    opens: (w) => w.enc.ruin === 'done' || w.wave >= 4,
    scout: { text: 'Raiders on the East Ridge, sire! Your soldiers will ride with you.' },
    guards: ['raider', 'grunt', 'grunt', 'archer', 'grunt', 'archer'],
    title: 'The East Ridge is clear!', sub: 'The scout joins your army',
    reward: { coins: 60 },
  },
  {
    id: 'overlook', site: 'overlook', kind: 'visit', reach: 4.5, icon: '👁️',
    opens: (w) => w.enc.ridge === 'done',
    title: 'The Foothill Overlook', sub: 'Below lies the Mountain Fort. Take it to open the eastern mountains',
    reward: { coins: 20 }, look: 'fort',
  },
];

export const ENCOUNTER = Object.fromEntries(ENCOUNTERS.map((e) => [e.id, e]));
export const siteOf = (enc) => SITES[enc.site];
