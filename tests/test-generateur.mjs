import { compteur } from './harness.mjs';
import { aire } from '../js/geometrie.js';
import { genererPuzzle, NIVEAUX } from '../js/generateur.js';
import { estTerminee, etatsInitiaux, placer } from '../js/partie.js';

const { check, egal, rapport } = compteur();
console.log('\nGénérateur de mosaïques\n');
const nombresSommets = new Set();
let courbesObservees = 0;
let miroirsExperts = 0;

for (const niveau of Object.keys(NIVEAUX)) {
    for (let index = 0; index < 25; index++) {
        const puzzle = genererPuzzle(`suite-${index}`, niveau);
        let etats = etatsInitiaux(puzzle);
        for (const piece of puzzle.pieces) {
            nombresSommets.add(piece.sommets);
            courbesObservees += piece.segments.filter(segment => segment.c1).length;
            if (niveau === 'virtuose' && piece.initial.miroir) miroirsExperts++;
            const resultat = placer(puzzle, etats, { id: piece.id, ...piece.solution }, false);
            if (resultat) etats = resultat.etats;
            else etats = [];
        }
        const airePieces = puzzle.pieces.reduce((somme, piece) => somme + piece.aire, 0);
        check(`${niveau} ${index + 1} : nombre et aire`,
            puzzle.pieces.length === NIVEAUX[niveau].pieces && Math.abs(airePieces - aire(puzzle.silhouette)) < 1);
        check(`${niveau} ${index + 1} : solution complète acceptée`, etats.length > 0 && estTerminee(puzzle, etats));
        check(`${niveau} ${index + 1} : réglages cohérents`, puzzle.miroirAutorise === NIVEAUX[niveau].miroir && puzzle.pasAngle === NIVEAUX[niveau].pasAngle);
    }
}

egal('une graine est parfaitement déterministe', genererPuzzle('stable', 'virtuose'), genererPuzzle('stable', 'virtuose'));
check('les découpes produisent au moins quatre familles de polygones', nombresSommets.size >= 4);
check('de nombreuses arêtes deviennent des courbes', courbesObservees > 250);
check('le niveau Virtuose mélange réellement des pièces miroir', miroirsExperts > 20);

rapport();

