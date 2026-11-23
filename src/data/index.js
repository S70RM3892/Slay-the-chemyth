// Aggregates all game data into one bundle for the engine: createGame({ data: DATA }).
import { TAGS } from './tags.js';
import { CARDS, STARTER_DECK } from './cards.js';
import { RELICS, STARTER_RELIC } from './relics.js';
import { POTIONS } from './potions.js';
import { ENEMIES } from './enemies.js';
import { ENCOUNTERS } from './encounters.js';
import { EVENTS } from './events.js';
import { QUESTIONS, QUIZ_SETS } from './questions/index.js';

export { TAGS, CARDS, STARTER_DECK, RELICS, STARTER_RELIC, POTIONS, ENEMIES, ENCOUNTERS, EVENTS, QUESTIONS, QUIZ_SETS };

export const DATA = Object.freeze({
  TAGS, CARDS, STARTER_DECK, RELICS, STARTER_RELIC, POTIONS, ENEMIES, ENCOUNTERS, EVENTS, QUESTIONS, QUIZ_SETS,
});
