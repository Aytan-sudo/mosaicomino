import { TAILLE_LOGIQUE } from './config.js';
import { bornes, contourTransforme, transformerPoint } from './geometrie.js';
import { estPosee, etatParId, pieceParId } from './partie.js';
import { NIVEAUX } from './generateur.js';

const $ = id => document.getElementById(id);
let puzzleCourant;
let etatsCourants;
let selectionCourante;
let contoursActifs = true;

function couleurVariable(index) {
    return getComputedStyle(document.documentElement).getPropertyValue(`--piece-${index}`).trim() || '#d7a75d';
}

function melangerCouleur(couleur, cible, proportion) {
    const lire = valeur => parseInt(valeur, 16);
    const source = couleur.match(/^#([0-9a-f]{6})$/i)?.[1];
    if (!source) return couleur;
    const destination = cible === 'blanc' ? 'ffffff' : '000000';
    const composantes = [0, 2, 4].map(index => Math.round(
        lire(source.slice(index, index + 2)) * (1 - proportion)
        + lire(destination.slice(index, index + 2)) * proportion
    ).toString(16).padStart(2, '0'));
    return `#${composantes.join('')}`;
}

function cheminSilhouette(contexte, silhouette) {
    contexte.beginPath();
    contexte.moveTo(silhouette[0].x, silhouette[0].y);
    for (let index = 1; index < silhouette.length; index++) contexte.lineTo(silhouette[index].x, silhouette[index].y);
    contexte.closePath();
}

function cheminPiece(contexte, piece, etat) {
    const depart = transformerPoint(piece.depart, etat);
    contexte.beginPath();
    contexte.moveTo(depart.x, depart.y);
    for (const segment of piece.segments) {
        const fin = transformerPoint(segment.vers, etat);
        if (segment.c1 && segment.c2) {
            const c1 = transformerPoint(segment.c1, etat);
            const c2 = transformerPoint(segment.c2, etat);
            contexte.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, fin.x, fin.y);
        } else contexte.lineTo(fin.x, fin.y);
    }
    contexte.closePath();
}

function preparerCanvas(canvas, tailleLogique = TAILLE_LOGIQUE) {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2.5);
    const largeur = Math.max(1, Math.round(rect.width * ratio));
    const hauteur = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== largeur || canvas.height !== hauteur) {
        canvas.width = largeur;
        canvas.height = hauteur;
    }
    const contexte = canvas.getContext('2d');
    contexte.setTransform(largeur / tailleLogique, 0, 0, hauteur / tailleLogique, 0, 0);
    contexte.clearRect(0, 0, tailleLogique, tailleLogique);
    return contexte;
}

function dessinerPiece(contexte, piece, etat, options = {}) {
    contexte.save();
    contexte.globalAlpha = options.alpha ?? 1;
    if (!options.sansOmbre) {
        contexte.shadowColor = 'rgba(3, 7, 18, .34)';
        contexte.shadowBlur = options.selectionnee ? 25 : 14;
        contexte.shadowOffsetY = options.selectionnee ? 12 : 7;
    }
    cheminPiece(contexte, piece, etat);
    const couleur = couleurVariable(piece.couleur);
    const degrade = contexte.createLinearGradient(etat.x - 180, etat.y - 170, etat.x + 170, etat.y + 180);
    degrade.addColorStop(0, melangerCouleur(couleur, 'blanc', 0.28));
    degrade.addColorStop(0.22, couleur);
    degrade.addColorStop(1, melangerCouleur(couleur, 'noir', 0.22));
    contexte.fillStyle = degrade;
    contexte.fill();
    contexte.shadowColor = 'transparent';
    contexte.lineJoin = 'round';
    contexte.lineWidth = options.selectionnee ? 8 : 3.2;
    contexte.strokeStyle = options.invalide ? '#ff6a70' : options.selectionnee ? getComputedStyle(document.documentElement).getPropertyValue('--accent') : 'rgba(255,255,255,.52)';
    contexte.stroke();

    if (contoursActifs && !options.invalide) {
        contexte.save();
        cheminPiece(contexte, piece, etat);
        contexte.clip();
        contexte.globalAlpha *= 0.13;
        contexte.strokeStyle = '#101522';
        contexte.lineWidth = 3;
        const espacement = 42 + (piece.couleur % 3) * 12;
        for (let position = -900; position < 1500; position += espacement) {
            contexte.beginPath();
            contexte.moveTo(position, -200);
            contexte.lineTo(position + (piece.couleur % 2 ? 500 : -500), 1200);
            contexte.stroke();
        }
        contexte.restore();
    }
    contexte.restore();
}

function dessinerFond(contexte, puzzle) {
    const style = getComputedStyle(document.documentElement);
    cheminSilhouette(contexte, puzzle.silhouette);
    contexte.fillStyle = style.getPropertyValue('--silhouette').trim();
    contexte.shadowColor = 'rgba(0,0,0,.3)';
    contexte.shadowBlur = 28;
    contexte.shadowOffsetY = 14;
    contexte.fill();
    contexte.shadowColor = 'transparent';
    contexte.lineWidth = 5;
    contexte.lineJoin = 'round';
    contexte.strokeStyle = style.getPropertyValue('--silhouette-trait').trim();
    contexte.stroke();

    contexte.save();
    cheminSilhouette(contexte, puzzle.silhouette);
    contexte.clip();
    contexte.globalAlpha = 0.11;
    contexte.fillStyle = style.getPropertyValue('--texte').trim();
    for (let y = 145; y < 900; y += 54) {
        for (let x = 120 + (y % 108); x < 900; x += 108) {
            contexte.beginPath();
            contexte.arc(x, y, 2.4, 0, Math.PI * 2);
            contexte.fill();
        }
    }
    contexte.restore();
}

export function rendrePlateau(puzzle, etats, selection, apercu = null, contours = true, curseur = null) {
    puzzleCourant = puzzle;
    etatsCourants = etats;
    selectionCourante = selection;
    contoursActifs = contours;
    const canvas = $('plateau');
    const contexte = preparerCanvas(canvas);
    dessinerFond(contexte, puzzle);

    const posees = etats.filter(estPosee).filter(etat => etat.id !== apercu?.etat?.id);
    const ordinaires = posees.filter(etat => etat.id !== selection);
    const choisie = posees.filter(etat => etat.id === selection);
    for (const etat of [...ordinaires, ...choisie]) {
        dessinerPiece(contexte, pieceParId(puzzle, etat.id), etat, { selectionnee: etat.id === selection });
    }
    if (apercu?.etat) {
        dessinerPiece(contexte, pieceParId(puzzle, apercu.etat.id), apercu.etat, {
            selectionnee: true,
            invalide: apercu.invalide,
            alpha: apercu.invalide ? 0.68 : 0.9
        });
    }
    if (curseur) {
        contexte.save();
        contexte.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        contexte.lineWidth = 5;
        contexte.setLineDash([11, 9]);
        contexte.beginPath();
        contexte.arc(curseur.x, curseur.y, 24, 0, Math.PI * 2);
        contexte.stroke();
        contexte.restore();
    }
}

function nomForme(piece) {
    return ({ 3: 'triangle', 4: 'quadrilatère', 5: 'pentagone', 6: 'hexagone' })[piece.sommets]
        || `forme à ${piece.sommets} côtés`;
}

function dessinerApercu(canvas, piece, etat) {
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2.5);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const contexte = canvas.getContext('2d');
    contexte.setTransform(ratio, 0, 0, ratio, 0, 0);
    contexte.clearRect(0, 0, rect.width, rect.height);

    const temporaire = { ...etat, x: 0, y: 0 };
    const contour = contourTransforme(piece, temporaire);
    const boite = bornes(contour);
    const echelle = Math.min((rect.width - 18) / (boite.maxX - boite.minX), (rect.height - 16) / (boite.maxY - boite.minY));
    contexte.save();
    contexte.translate(rect.width / 2, rect.height / 2);
    contexte.scale(echelle, echelle);
    dessinerPiece(contexte, piece, temporaire, { sansOmbre: true, selectionnee: false });
    contexte.restore();
}

export function rendreReserve(puzzle, etats, selection) {
    const reserve = $('reserve');
    const defilement = reserve.scrollLeft;
    reserve.replaceChildren();
    for (const piece of puzzle.pieces) {
        const etat = etatParId(etats, piece.id);
        if (estPosee(etat)) continue;
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'tesselle-reserve';
        bouton.dataset.pieceId = piece.id;
        bouton.setAttribute('aria-pressed', String(selection === piece.id));
        bouton.setAttribute('aria-label', `Tesselle ${Number(piece.id.slice(1))}, ${nomForme(piece)}`);
        if (selection === piece.id) bouton.classList.add('selectionnee');
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 86;
        canvas.setAttribute('aria-hidden', 'true');
        bouton.append(canvas);
        reserve.append(bouton);
        dessinerApercu(canvas, piece, etat);
    }
    if (!reserve.children.length) {
        const vide = document.createElement('p');
        vide.className = 'reserve-vide';
        vide.textContent = 'Toutes les tesselles sont dans la composition.';
        reserve.append(vide);
    }
    reserve.scrollLeft = defilement;
}

export function redessiner() {
    if (!puzzleCourant) return;
    rendrePlateau(puzzleCourant, etatsCourants, selectionCourante, null, contoursActifs);
    rendreReserve(puzzleCourant, etatsCourants, selectionCourante);
}

export function mettreAJourHud({ puzzle, etats, meta, gestes, tempsMs, indices, historique, selection, terminee }) {
    $('hud-niveau').textContent = meta.dateJour ? 'Pièce du jour' : NIVEAUX[puzzle.niveau].nom;
    $('hud-progression').textContent = `${etats.filter(estPosee).length}/${etats.length}`;
    $('hud-gestes').textContent = String(gestes);
    $('hud-temps').textContent = formaterTemps(tempsMs);
    $('bouton-annuler').disabled = !historique.length || terminee;
    $('bouton-indice').disabled = terminee;
    $('rotation-gauche').disabled = !selection || terminee;
    $('rotation-droite').disabled = !selection || terminee;
    $('retourner').hidden = !puzzle.miroirAutorise;
    $('retourner').disabled = !selection || terminee;
    $('ranger').disabled = !selection || terminee;
    $('mention-angle').textContent = `${puzzle.pasAngle}°`;
    $('mention-indices').textContent = indices ? `${indices} indice${indices > 1 ? 's' : ''}` : 'sans indice';
    $('plateau').setAttribute('aria-label', `Composition ${NIVEAUX[puzzle.niveau].nom}, ${etats.filter(estPosee).length} formes posées sur ${etats.length}`);
}

export function rendreStatistiques(stats) {
    $('stat-serie').textContent = String(stats.quotidien.serie || 0);
    $('stat-record-serie').textContent = String(stats.quotidien.meilleureSerie || 0);
    const niveaux = $('stats-niveaux');
    niveaux.replaceChildren(...Object.values(NIVEAUX).map(niveau => {
        const donnees = stats.niveaux[niveau.id] || {};
        const ligne = document.createElement('div');
        const titre = document.createElement('dt');
        titre.textContent = niveau.nom;
        const valeur = document.createElement('dd');
        valeur.textContent = `${donnees.parties || 0} composition${donnees.parties > 1 ? 's' : ''}${donnees.meilleurTempsMs ? ` · ${formaterTemps(donnees.meilleurTempsMs)}` : ''}`;
        ligne.append(titre, valeur);
        return ligne;
    }));
    const historique = $('historique');
    historique.replaceChildren(...(stats.historique || []).slice(0, 8).map(resultat => {
        const item = document.createElement('li');
        item.textContent = `${new Date(resultat.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · ${NIVEAUX[resultat.niveau]?.nom} · ${formaterTemps(resultat.tempsMs)} · ${resultat.gestes} gestes`;
        return item;
    }));
    $('historique-vide').hidden = Boolean(stats.historique?.length);
}

export function formaterTemps(ms) {
    const secondes = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, '0')}`;
}

export function coordonneesPlateau(evenement) {
    const rect = $('plateau').getBoundingClientRect();
    return {
        x: (evenement.clientX - rect.left) * TAILLE_LOGIQUE / rect.width,
        y: (evenement.clientY - rect.top) * TAILLE_LOGIQUE / rect.height,
        dedans: evenement.clientX >= rect.left && evenement.clientX <= rect.right
            && evenement.clientY >= rect.top && evenement.clientY <= rect.bottom
    };
}

export function annoncer(message) {
    $('annonce').textContent = '';
    requestAnimationFrame(() => { $('annonce').textContent = message; });
}

export function celebrer() {
    const couche = $('confettis');
    couche.replaceChildren(...Array.from({ length: 30 }, (_, index) => {
        const element = document.createElement('i');
        element.style.setProperty('--x', `${(index * 43) % 100}vw`);
        element.style.setProperty('--retard', `${(index % 8) * 45}ms`);
        element.style.setProperty('--couleur', couleurVariable(index % 11));
        return element;
    }));
    setTimeout(() => couche.replaceChildren(), 1700);
}
