import {
    contourTransforme, ecartAngle, estContenu, polygonesSeChevauchent
} from './geometrie.js';

export function etatsInitiaux(puzzle) {
    return puzzle.pieces.map(piece => ({
        id: piece.id,
        x: null,
        y: null,
        angle: piece.initial.angle,
        miroir: puzzle.miroirAutorise ? piece.initial.miroir : false
    }));
}

export const pieceParId = (puzzle, id) => puzzle.pieces.find(piece => piece.id === id);
export const etatParId = (etats, id) => etats.find(etat => etat.id === id);
export const estPosee = etat => Number.isFinite(etat.x) && Number.isFinite(etat.y);

export function occupation(puzzle, etats, saufId = null) {
    return etats
        .filter(etat => etat.id !== saufId && estPosee(etat))
        .map(etat => ({ id: etat.id, contour: contourTransforme(pieceParId(puzzle, etat.id), etat) }));
}

export function peutPlacer(puzzle, etats, candidat) {
    if (!estPosee(candidat)) return false;
    const piece = pieceParId(puzzle, candidat.id);
    if (!piece || (candidat.miroir && !puzzle.miroirAutorise)) return false;
    const contour = contourTransforme(piece, candidat);
    if (!estContenu(contour, puzzle.silhouette, 2.1)) return false;
    return occupation(puzzle, etats, candidat.id)
        .every(autre => !polygonesSeChevauchent(contour, autre.contour, 2.1));
}

export function aimanter(puzzle, etats, candidat, seuilPosition = 44) {
    const piece = pieceParId(puzzle, candidat.id);
    const solution = piece.solution;
    if (candidat.miroir || Math.hypot(candidat.x - solution.x, candidat.y - solution.y) > seuilPosition) return candidat;
    if (ecartAngle(candidat.angle, solution.angle) > puzzle.pasAngle * 0.56) return candidat;
    const exacte = { ...candidat, ...solution };
    return peutPlacer(puzzle, etats, exacte) ? exacte : candidat;
}

export function placer(puzzle, etats, candidat, avecAimant = true) {
    const final = avecAimant ? aimanter(puzzle, etats, candidat) : candidat;
    if (!peutPlacer(puzzle, etats, final)) return null;
    return {
        etats: etats.map(etat => etat.id === final.id ? { ...final } : { ...etat }),
        aimantee: final.x !== candidat.x || final.y !== candidat.y || final.angle !== candidat.angle || final.miroir !== candidat.miroir
    };
}

export function remettreDansLaReserve(etats, id) {
    return etats.map(etat => etat.id === id ? { ...etat, x: null, y: null } : { ...etat });
}

export function estTerminee(puzzle, etats) {
    return etats.length === puzzle.pieces.length && etats.every(estPosee);
}

export function estDansLaSolution(puzzle, etat) {
    const solution = pieceParId(puzzle, etat.id).solution;
    return estPosee(etat)
        && !etat.miroir
        && Math.hypot(etat.x - solution.x, etat.y - solution.y) < 1
        && ecartAngle(etat.angle, solution.angle) < 0.2;
}

export function appliquerIndice(puzzle, etats) {
    const cible = etats.find(etat => !estDansLaSolution(puzzle, etat));
    if (!cible) return { etats, pieceId: null, retirees: [] };
    const piece = pieceParId(puzzle, cible.id);
    const solution = { id: cible.id, ...piece.solution };
    const contour = contourTransforme(piece, solution);
    const retirees = occupation(puzzle, etats, cible.id)
        .filter(autre => polygonesSeChevauchent(contour, autre.contour, 2.1))
        .map(autre => autre.id);
    return {
        pieceId: cible.id,
        retirees,
        etats: etats.map(etat => {
            if (etat.id === cible.id) return solution;
            if (retirees.includes(etat.id)) return { ...etat, x: null, y: null };
            return { ...etat };
        })
    };
}

