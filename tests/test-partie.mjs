import { compteur } from './harness.mjs';
import { genererPuzzle } from '../js/generateur.js';
import {
    appliquerIndice, estTerminee, etatsInitiaux, peutPlacer, placer, remettreDansLaReserve
} from '../js/partie.js';

const { check, rapport } = compteur();
console.log('\nRègles de composition\n');
const puzzle = genererPuzzle('regles', 'virtuose');
let etats = etatsInitiaux(puzzle);
check('toutes les tesselles commencent dans la collection', etats.every(etat => etat.x === null));

const premiere = puzzle.pieces[0];
const solutionPremiere = { id: premiere.id, ...premiere.solution };
check('la première solution est acceptée', peutPlacer(puzzle, etats, solutionPremiere));
const pose = placer(puzzle, etats, solutionPremiere, false);
etats = pose.etats;
const seconde = puzzle.pieces[1];
check('un placement très extérieur est refusé', !peutPlacer(puzzle, etats, { id: seconde.id, x: -200, y: -200, angle: 0, miroir: false }));
check('un chevauchement avec la première forme est refusé', !peutPlacer(puzzle, etats, { id: seconde.id, x: premiere.solution.x, y: premiere.solution.y, angle: 0, miroir: false }));
check('ranger une forme la retire de la composition', remettreDansLaReserve(etats, premiere.id).every(etat => etat.id !== premiere.id || etat.x === null));

const indice = appliquerIndice(puzzle, etatsInitiaux(puzzle));
check('un indice place une forme exacte', indice.pieceId && indice.etats.filter(etat => etat.x !== null).length === 1);

etats = etatsInitiaux(puzzle);
for (const piece of puzzle.pieces) etats = placer(puzzle, etats, { id: piece.id, ...piece.solution }, false).etats;
check('toutes les formes sans chevauchement terminent la composition', estTerminee(puzzle, etats));

rapport();

