const EPSILON = 1e-8;

export const arrondirPoint = point => ({
    x: Math.round(point.x * 1000) / 1000,
    y: Math.round(point.y * 1000) / 1000
});

export function aireSignee(polygone) {
    let somme = 0;
    for (let i = 0; i < polygone.length; i++) {
        const a = polygone[i];
        const b = polygone[(i + 1) % polygone.length];
        somme += a.x * b.y - b.x * a.y;
    }
    return somme / 2;
}

export const aire = polygone => Math.abs(aireSignee(polygone));

export function centroide(polygone) {
    const facteur = aireSignee(polygone) * 6;
    if (Math.abs(facteur) < EPSILON) {
        return {
            x: polygone.reduce((somme, point) => somme + point.x, 0) / polygone.length,
            y: polygone.reduce((somme, point) => somme + point.y, 0) / polygone.length
        };
    }
    let x = 0;
    let y = 0;
    for (let i = 0; i < polygone.length; i++) {
        const a = polygone[i];
        const b = polygone[(i + 1) % polygone.length];
        const croix = a.x * b.y - b.x * a.y;
        x += (a.x + b.x) * croix;
        y += (a.y + b.y) * croix;
    }
    return { x: x / facteur, y: y / facteur };
}

export function clipperDemiPlan(polygone, nx, ny, limite) {
    const resultat = [];
    const valeur = point => nx * point.x + ny * point.y - limite;
    for (let i = 0; i < polygone.length; i++) {
        const courant = polygone[i];
        const suivant = polygone[(i + 1) % polygone.length];
        const vc = valeur(courant);
        const vs = valeur(suivant);
        const courantDedans = vc <= EPSILON;
        const suivantDedans = vs <= EPSILON;
        if (courantDedans) resultat.push(courant);
        if (courantDedans !== suivantDedans) {
            const t = vc / (vc - vs);
            resultat.push({
                x: courant.x + (suivant.x - courant.x) * t,
                y: courant.y + (suivant.y - courant.y) * t
            });
        }
    }
    return simplifier(resultat.map(arrondirPoint));
}

export function simplifier(polygone) {
    if (polygone.length < 3) return polygone;
    const sansDoubles = polygone.filter((point, index) => {
        const precedent = polygone[(index - 1 + polygone.length) % polygone.length];
        return Math.hypot(point.x - precedent.x, point.y - precedent.y) > 0.01;
    });
    if (sansDoubles.length < 3) return sansDoubles;
    return sansDoubles.filter((point, index) => {
        const precedent = sansDoubles[(index - 1 + sansDoubles.length) % sansDoubles.length];
        const suivant = sansDoubles[(index + 1) % sansDoubles.length];
        const croix = (point.x - precedent.x) * (suivant.y - point.y)
            - (point.y - precedent.y) * (suivant.x - point.x);
        return Math.abs(croix) > 0.02;
    });
}

export function pointDansPolygone(point, polygone) {
    let dedans = false;
    for (let i = 0, j = polygone.length - 1; i < polygone.length; j = i++) {
        const a = polygone[i];
        const b = polygone[j];
        if (((a.y > point.y) !== (b.y > point.y))
            && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) dedans = !dedans;
    }
    return dedans;
}

export function distancePointSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const longueur2 = dx * dx + dy * dy;
    if (longueur2 < EPSILON) return Math.hypot(point.x - a.x, point.y - a.y);
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / longueur2));
    return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

export function distanceAuContour(point, polygone) {
    let minimum = Infinity;
    for (let i = 0; i < polygone.length; i++) {
        minimum = Math.min(minimum, distancePointSegment(point, polygone[i], polygone[(i + 1) % polygone.length]));
    }
    return minimum;
}

export function bezier(a, c1, c2, b, t) {
    const u = 1 - t;
    return {
        x: u ** 3 * a.x + 3 * u ** 2 * t * c1.x + 3 * u * t ** 2 * c2.x + t ** 3 * b.x,
        y: u ** 3 * a.y + 3 * u ** 2 * t * c1.y + 3 * u * t ** 2 * c2.y + t ** 3 * b.y
    };
}

export function echantillonnerPiece(piece, subdivisions = 10) {
    const points = [{ ...piece.depart }];
    let courant = piece.depart;
    for (const segment of piece.segments) {
        if (segment.c1 && segment.c2) {
            for (let etape = 1; etape <= subdivisions; etape++) {
                points.push(bezier(courant, segment.c1, segment.c2, segment.vers, etape / subdivisions));
            }
        } else points.push({ ...segment.vers });
        courant = segment.vers;
    }
    points.pop();
    return points;
}

export function transformerPoint(point, etat) {
    const angle = etat.angle * Math.PI / 180;
    const xMiroir = etat.miroir ? -point.x : point.x;
    return {
        x: etat.x + xMiroir * Math.cos(angle) - point.y * Math.sin(angle),
        y: etat.y + xMiroir * Math.sin(angle) + point.y * Math.cos(angle)
    };
}

export function inverseTransformerPoint(point, etat) {
    const angle = -etat.angle * Math.PI / 180;
    const dx = point.x - etat.x;
    const dy = point.y - etat.y;
    let x = dx * Math.cos(angle) - dy * Math.sin(angle);
    const y = dx * Math.sin(angle) + dy * Math.cos(angle);
    if (etat.miroir) x = -x;
    return { x, y };
}

export const contourTransforme = (piece, etat, subdivisions = 10) =>
    echantillonnerPiece(piece, subdivisions).map(point => transformerPoint(point, etat));

export function angleNormalise(angle) {
    return ((angle % 360) + 360) % 360;
}

export function ecartAngle(a, b) {
    const difference = Math.abs(angleNormalise(a) - angleNormalise(b));
    return Math.min(difference, 360 - difference);
}

function orientation(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function intersectionPropre(a, b, c, d, epsilon) {
    if ([a, b].some(point => [c, d].some(autre => Math.hypot(point.x - autre.x, point.y - autre.y) <= epsilon))) return false;
    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);
    return o1 * o2 < -epsilon && o3 * o4 < -epsilon;
}

export function polygonesSeChevauchent(a, b, epsilon = 1.2) {
    for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < b.length; j++) {
            if (intersectionPropre(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length], epsilon)) return true;
        }
    }
    const sondes = polygone => polygone.flatMap((point, index) => {
        const suivant = polygone[(index + 1) % polygone.length];
        return [point, { x: (point.x + suivant.x) / 2, y: (point.y + suivant.y) / 2 }];
    });
    if (sondes(a).some(point => pointDansPolygone(point, b) && distanceAuContour(point, b) > epsilon)) return true;
    if (sondes(b).some(point => pointDansPolygone(point, a) && distanceAuContour(point, a) > epsilon)) return true;
    return false;
}

export function estContenu(polygone, enveloppe, epsilon = 1.5) {
    return polygone.every(point => pointDansPolygone(point, enveloppe) || distanceAuContour(point, enveloppe) <= epsilon);
}

export function bornes(polygone) {
    const xs = polygone.map(point => point.x);
    const ys = polygone.map(point => point.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
