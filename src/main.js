// Entry point: boots the engine with the game data and starts the UI.
import { createGame } from './engine/index.js';
import { DATA } from './data/index.js';
import { startApp } from './ui/app.js';

startApp({ createGame, DATA });
