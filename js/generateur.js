import { Alea } from './hasard.js';
import {
    aire, arrondirPoint, centroide, clipperDemiPlan, distanceAuContour,
    echantillonnerPiece, pointDansPolygone, simplifier
} from './geometrie.js';

export const NIVEAUX = {
    epure: {
        id: 'epure', nom: 'Épure', pieces: 6, sommets: 8,
        rayonX: 390, rayonY: 340, courbes: 0.48, pasAngle: 30, miroir: false,
        description: 'Six grandes formes et des angles francs.'
    },
    mosaique: {
        id: 'mosaique', nom: 'Mosaïque', pieces: 8, sommets: 10,
        rayonX: 420, rayonY: 365, courbes: 0.75, pasAngle: 15, miroir: false,
        description: 'Huit tesselles aux courbes souvent trompeuses.'
    },
    virtuose: {
        id: 'virtuose', nom: 'Virtuose', pieces: 11, sommets: 12,
        rayonX: 435, rayonY: 390, courbes: 0.92, pasAngle: 15, miroir: true,
        description: 'Onze formes proches, courbes et miroirs.'
    }
};

function creerSilhouette(configuration, alea) {
    const phase = -Math.PI / 2 + alea.entre(-0.09, 0.09);
    const cisaillement = alea.entre(-0.11, 0.11);
    return Array.from({ length: configuration.sommets }, (_, index) => {
        const angle = phase + index * Math.PI * 2 / configuration.sommets;
        const xEllipse = Math.cos(angle) * configuration.rayonX;
        const yEllipse = Math.sin(angle) * configuration.rayonY;
        return arrondirPoint({
            x: 500 + xEllipse + yEllipse * cisaillement,
            y: 500 + yEllipse
        });
    });
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function creerSites(silhouette, configuration, alea) {
    if (configuration.id === 'epure') {
        const positions = [
            [300, 320], [510, 285], [710, 335],
            [315, 660], [520, 700], [705, 645]
        ];
        return positions.map(([x, y]) => ({ x: x + alea.entre(-28, 28), y: y + alea.entre(-25, 25) }));
    }
    const minimum = configuration.id === 'virtuose' ? 135 : 165;
    const sites = [];
    for (let essai = 0; essai < 8000 && sites.length < configuration.pieces; essai++) {
        const candidat = { x: alea.entre(115, 885), y: alea.entre(115, 885) };
        if (!pointDansPolygone(candidat, silhouette) || distanceAuContour(candidat, silhouette) < 55) continue;
        if (sites.every(site => distance(site, candidat) >= minimum)) sites.push(candidat);
    }
    if (sites.length !== configuration.pieces) throw new Error('Les centres sont trop serrés.');
    return sites;
}

function cellulesVoronoi(silhouette, sites) {
    return sites.map((site, index) => {
        let cellule = silhouette.map(point => ({ ...point }));
        for (let autre = 0; autre < sites.length && cellule.length >= 3; autre++) {
            if (autre === index) continue;
            const voisin = sites[autre];
            const nx = 2 * (voisin.x - site.x);
            const ny = 2 * (voisin.y - site.y);
            const limite = voisin.x ** 2 + voisin.y ** 2 - site.x ** 2 - site.y ** 2;
            cellule = clipperDemiPlan(cellule, nx, ny, limite);
        }
        return simplifier(cellule).map(arrondirPoint);
    });
}

function equilibrer(silhouette, sites) {
    const cellules = cellulesVoronoi(silhouette, sites);
    return cellules.map((cellule, index) => {
        const centre = centroide(cellule);
        return {
            x: sites[index].x * 0.35 + centre.x * 0.65,
            y: sites[index].y * 0.35 + centre.y * 0.65
        };
    });
}

const clePoint = point => `${Math.round(point.x * 10)},${Math.round(point.y * 10)}`;
const cleArete = (a, b) => [clePoint(a), clePoint(b)].sort().join('|');

function repertoireAretes(cellules) {
    const aretes = new Map();
    for (const cellule of cellules) {
        for (let index = 0; index < cellule.length; index++) {
            const a = cellule[index];
            const b = cellule[(index + 1) % cellule.length];
            const cle = cleArete(a, b);
            if (!aretes.has(cle)) aretes.set(cle, []);
            aretes.get(cle).push({ a, b });
        }
    }
    return aretes;
}

function courbesPartagees(cellules, configuration, alea) {
    const courbes = new Map();
    for (const [cle, occurrences] of repertoireAretes(cellules)) {
        if (occurrences.length !== 2 || !alea.chance(configuration.courbes)) continue;
        const [premiere] = occurrences;
        let a = premiere.a;
        let b = premiere.b;
        if (clePoint(a) > clePoint(b)) [a, b] = [b, a];
        const longueur = distance(a, b);
        if (longueur < 65) continue;
        const signe = alea.chance(0.5) ? 1 : -1;
        // Une courbe commune doit rester dans le voisinage de son arête : une
        // bosse trop forte pourrait atteindre une troisième tesselle près d'un
        // sommet de Voronoï.
        const bosse = longueur * alea.entre(0.022, configuration.id === 'virtuose' ? 0.052 : 0.044) * signe;
        const nx = -(b.y - a.y) / longueur;
        const ny = (b.x - a.x) / longueur;
        courbes.set(cle, {
            a, b,
            c1: { x: a.x + (b.x - a.x) / 3 + nx * bosse, y: a.y + (b.y - a.y) / 3 + ny * bosse },
            c2: { x: a.x + (b.x - a.x) * 2 / 3 + nx * bosse, y: a.y + (b.y - a.y) * 2 / 3 + ny * bosse }
        });
    }
    return courbes;
}

function soustraire(point, centre) { return arrondirPoint({ x: point.x - centre.x, y: point.y - centre.y }); }

function creerPiece(cellule, index, couleur, courbes, configuration, alea) {
    const centre = centroide(cellule);
    const depart = soustraire(cellule[0], centre);
    const segments = cellule.map((a, numero) => {
        const b = cellule[(numero + 1) % cellule.length];
        const courbe = courbes.get(cleArete(a, b));
        if (!courbe) return { vers: soustraire(b, centre), c1: null, c2: null };
        const memeSens = clePoint(a) === clePoint(courbe.a);
        return {
            vers: soustraire(b, centre),
            c1: soustraire(memeSens ? courbe.c1 : courbe.c2, centre),
            c2: soustraire(memeSens ? courbe.c2 : courbe.c1, centre)
        };
    });
    const piece = {
        id: `t${index + 1}`,
        depart,
        segments,
        sommets: cellule.length,
        couleur,
        solution: { x: centre.x, y: centre.y, angle: 0, miroir: false },
        initial: {
            angle: alea.entier(Math.round(360 / configuration.pasAngle)) * configuration.pasAngle,
            miroir: configuration.miroir && alea.chance(0.5)
        }
    };
    piece.aire = aire(echantillonnerPiece(piece, 16));
    return piece;
}

function assembler(silhouette, configuration, alea) {
    let sites = creerSites(silhouette, configuration, alea);
    if (configuration.id !== 'epure') sites = equilibrer(silhouette, sites);
    const cellules = cellulesVoronoi(silhouette, sites);
    const aireMoyenne = aire(silhouette) / configuration.pieces;
    if (cellules.some(cellule => cellule.length < 3 || aire(cellule) < aireMoyenne * 0.42 || aire(cellule) > aireMoyenne * 2.05)) {
        throw new Error('Découpe trop déséquilibrée.');
    }
    const courbes = courbesPartagees(cellules, configuration, alea);
    const couleurs = alea.melanger(Array.from({ length: configuration.pieces }, (_, index) => index));
    return alea.melanger(cellules.map((cellule, index) => creerPiece(
        cellule, index, couleurs[index], courbes, configuration, alea
    )));
}

export function genererPuzzle(graine, niveau = 'mosaique') {
    const configuration = NIVEAUX[niveau];
    if (!configuration) throw new Error(`Niveau inconnu : ${niveau}`);
    for (let essai = 0; essai < 60; essai++) {
        const alea = new Alea(`mosaicomino-v1|${graine}|${niveau}|${essai}`);
        try {
            const silhouette = creerSilhouette(configuration, alea);
            return {
                schema: 1,
                graine: String(graine),
                niveau,
                pasAngle: configuration.pasAngle,
                miroirAutorise: configuration.miroir,
                silhouette,
                pieces: assembler(silhouette, configuration, alea)
            };
        } catch { /* la graine reste stable, seule la tentative change */ }
    }
    throw new Error('Impossible de produire une mosaïque équilibrée.');
}
