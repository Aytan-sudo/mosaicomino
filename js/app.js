import { VERSION, NIVEAU_QUOTIDIEN } from './config.js';
import { genererPuzzle, NIVEAUX } from './generateur.js';
import { contourTransforme, pointDansPolygone } from './geometrie.js';
import { graineLibre } from './hasard.js';
import {
    aimanter, appliquerIndice, estPosee, estTerminee, etatParId,
    etatsInitiaux, peutPlacer, pieceParId, placer, remettreDansLaReserve
} from './partie.js';
import { lienDuPuzzle, messageDePartage } from './partage.js';
import {
    annoncer, celebrer, coordonneesPlateau, formaterTemps, mettreAJourHud,
    rendrePlateau, rendreReserve, rendreStatistiques
} from './rendu.js';
import { preparerSon, sonPose, sonRefus, sonRotation, sonVictoire, surveillerVisibilite } from './son.js';
import {
    chargerPreferences, chargerSession, chargerStatistiques, effacerStatistiques,
    enregistrerPreferences, enregistrerSession, enregistrerVictoire
} from './stockage.js';
import { THEMES, themeSuivant } from './themes.js';

const $ = id => document.getElementById(id);
const copierEtats = etats => etats.map(etat => ({ ...etat }));

let preferences = chargerPreferences();
let puzzle;
let etats;
let meta;
let historique = [];
let gestes = 0;
let indices = 0;
let selection = null;
let terminee = false;
let resultatEnregistre = false;
let tempsCumule = 0;
let debutChrono = 0;
let chronoActif = false;
let dernierEnregistrement = 0;
let glisser = null;
let ignorerClicPlateau = false;
let curseur = { x: 500, y: 500 };

function dateLocale(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function tempsActuel() { return tempsCumule + (chronoActif ? performance.now() - debutChrono : 0); }
function lancerChrono() {
    if (chronoActif || terminee || document.hidden) return;
    debutChrono = performance.now();
    chronoActif = true;
}
function suspendreChrono() {
    if (!chronoActif) return;
    tempsCumule += performance.now() - debutChrono;
    chronoActif = false;
}

function jouer(son) { if (preferences.sons) son(); }
function vibrer(motif) { if (preferences.vibration) navigator.vibrate?.(motif); }

function appliquerPreferences() {
    if (!THEMES.some(theme => theme.id === preferences.theme)) preferences.theme = 'galerie';
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.contours = preferences.contours ? 'oui' : 'non';
    $('option-sons').checked = preferences.sons;
    $('option-vibration').checked = preferences.vibration;
    $('option-contours').checked = preferences.contours;
    $('couleur-barre').setAttribute('content', THEMES.find(theme => theme.id === preferences.theme).couleur);
}

function lireRoute() {
    const params = new URLSearchParams(location.search);
    const jour = params.get('jour');
    if (/^\d{4}-\d{2}-\d{2}$/.test(jour || '')) {
        return { graine: `jour-${jour}`, niveau: NIVEAU_QUOTIDIEN, dateJour: jour, quotidien: jour === dateLocale() };
    }
    const seed = params.get('seed');
    if (!seed) return null;
    const niveau = NIVEAUX[params.get('niveau')] ? params.get('niveau') : 'mosaique';
    return { graine: seed.slice(0, 80), niveau, dateJour: null, quotidien: false };
}

function completerMeta(donnees) { return { ...donnees, nomNiveau: NIVEAUX[donnees.niveau].nom }; }

function synchroniserAdresse() {
    const url = new URL(location.href);
    url.search = '';
    if (meta.dateJour) url.searchParams.set('jour', meta.dateJour);
    else {
        url.searchParams.set('seed', meta.graine);
        url.searchParams.set('niveau', meta.niveau);
    }
    history.replaceState({}, '', `${url.pathname}${url.search}`);
}

function sessionCourante() {
    return {
        schema: 1, puzzle, etats, meta: {
            graine: meta.graine, niveau: meta.niveau,
            dateJour: meta.dateJour, quotidien: meta.quotidien
        },
        historique, gestes, indices, selection, terminee, resultatEnregistre,
        tempsMs: Math.round(tempsActuel())
    };
}

function sauvegarder() {
    enregistrerSession(sessionCourante());
    dernierEnregistrement = Date.now();
}

function demarrer(donnees) {
    suspendreChrono();
    puzzle = genererPuzzle(donnees.graine, donnees.niveau);
    etats = etatsInitiaux(puzzle);
    meta = completerMeta(donnees);
    historique = [];
    gestes = 0;
    indices = 0;
    selection = null;
    terminee = false;
    resultatEnregistre = false;
    tempsCumule = 0;
    curseur = { x: 500, y: 500 };
    synchroniserAdresse();
    lancerChrono();
    rendreTout();
    sauvegarder();
    annoncer(meta.dateJour ? 'La pièce du jour est prête.' : `Nouvelle composition ${meta.nomNiveau}.`);
}

function restaurer(session) {
    puzzle = session.puzzle;
    etats = copierEtats(session.etats);
    meta = completerMeta({
        ...session.meta,
        quotidien: Boolean(session.meta.dateJour && session.meta.dateJour === dateLocale())
    });
    historique = Array.isArray(session.historique) ? session.historique.slice(-36) : [];
    gestes = session.gestes || 0;
    indices = session.indices || 0;
    selection = session.selection || null;
    terminee = Boolean(session.terminee);
    resultatEnregistre = Boolean(session.resultatEnregistre);
    tempsCumule = session.tempsMs || 0;
    synchroniserAdresse();
    lancerChrono();
    rendreTout();
}

function initialiserPartie() {
    const route = lireRoute();
    if (route) return demarrer(route);
    const session = chargerSession();
    if (session?.schema === 1 && session.puzzle?.schema === 1 && NIVEAUX[session.meta?.niveau]) {
        try { return restaurer(session); } catch { /* repartir proprement */ }
    }
    const jour = dateLocale();
    demarrer({ graine: `jour-${jour}`, niveau: NIVEAU_QUOTIDIEN, dateJour: jour, quotidien: true });
}

function curseurVisible() {
    return document.activeElement === $('plateau') && selection ? curseur : null;
}

function rendreTout(apercu = null) {
    rendrePlateau(puzzle, etats, selection, apercu, preferences.contours, curseurVisible());
    if (!apercu) rendreReserve(puzzle, etats, selection);
    mettreAJourHud({ puzzle, etats, meta, gestes, tempsMs: tempsActuel(), indices, historique, selection, terminee });
}

function capturer() {
    historique.push({ etats: copierEtats(etats), gestes, indices, selection });
    historique = historique.slice(-36);
}

function verifierFin() {
    if (terminee || !estTerminee(puzzle, etats)) return false;
    suspendreChrono();
    terminee = true;
    if (!resultatEnregistre) {
        enregistrerVictoire({
            niveau: puzzle.niveau, quotidien: meta.quotidien, dateJour: meta.dateJour,
            tempsMs: Math.round(tempsActuel()), gestes, indices
        });
        resultatEnregistre = true;
    }
    jouer(sonVictoire);
    vibrer([24, 45, 24]);
    celebrer();
    $('fin-temps').textContent = formaterTemps(tempsActuel());
    $('fin-gestes').textContent = String(gestes);
    $('fin-indices').textContent = indices ? String(indices) : 'Aucun';
    $('fin-parfait').hidden = indices !== 0;
    setTimeout(() => $('dialogue-fin').showModal(), 320);
    annoncer('Composition achevée : aucune ouverture, aucun chevauchement.');
    return true;
}

function valider(suivants, message, son = sonPose) {
    capturer();
    etats = suivants;
    gestes++;
    jouer(son);
    vibrer(10);
    verifierFin();
    rendreTout();
    sauvegarder();
    if (!terminee && message) annoncer(message);
}

function refuser(message) {
    jouer(sonRefus);
    vibrer(28);
    $('cadre-plateau').classList.remove('refus');
    requestAnimationFrame(() => $('cadre-plateau').classList.add('refus'));
    annoncer(message);
}

function selectionner(id, versPlateau = false) {
    if (terminee) return;
    selection = id;
    rendreTout();
    sauvegarder();
    annoncer(`Tesselle ${Number(id.slice(1))} sélectionnée.`);
    if (versPlateau) $('plateau').focus();
}

function changerAngle(sens) {
    const etat = selection && etatParId(etats, selection);
    if (!etat || terminee) return;
    const candidat = { ...etat, angle: etat.angle + sens * puzzle.pasAngle };
    if (!estPosee(etat)) {
        valider(etats.map(autre => autre.id === etat.id ? candidat : { ...autre }), `Rotation de ${puzzle.pasAngle} degrés.`, sonRotation);
        return;
    }
    const resultat = placer(puzzle, etats, candidat);
    if (!resultat) return refuser('La tesselle toucherait un bord ou une autre forme.');
    valider(resultat.etats, resultat.aimantee ? 'La forme trouve son raccord.' : 'Tesselle tournée.', sonRotation);
}

function retournerSelection() {
    const etat = selection && etatParId(etats, selection);
    if (!etat || !puzzle.miroirAutorise || terminee) return;
    const candidat = { ...etat, miroir: !etat.miroir };
    if (!estPosee(etat)) {
        valider(etats.map(autre => autre.id === etat.id ? candidat : { ...autre }), 'Tesselle retournée.', sonRotation);
        return;
    }
    const resultat = placer(puzzle, etats, candidat);
    if (!resultat) return refuser('Il faut davantage d’espace pour retourner cette tesselle.');
    valider(resultat.etats, 'Tesselle retournée.', sonRotation);
}

function rangerSelection() {
    const etat = selection && etatParId(etats, selection);
    if (!etat || !estPosee(etat) || terminee) return;
    valider(remettreDansLaReserve(etats, etat.id), 'Tesselle remise dans la collection.');
}

function annuler() {
    if (!historique.length || terminee) return;
    const precedent = historique.pop();
    etats = copierEtats(precedent.etats);
    gestes = precedent.gestes;
    indices = precedent.indices;
    selection = precedent.selection;
    rendreTout();
    sauvegarder();
    annoncer('Dernier geste annulé.');
}

function demanderIndice() {
    if (terminee) return;
    const resultat = appliquerIndice(puzzle, etats);
    if (!resultat.pieceId) return;
    capturer();
    etats = resultat.etats;
    selection = resultat.pieceId;
    gestes++;
    indices++;
    jouer(sonPose);
    vibrer([10, 28, 10]);
    verifierFin();
    rendreTout();
    sauvegarder();
    annoncer(resultat.retirees.length
        ? `Une tesselle est révélée ; ${resultat.retirees.length} forme en conflit retourne dans la collection.`
        : 'Une tesselle rejoint sa place d’origine.');
}

function pieceSousPoint(point) {
    const posees = etats.filter(estPosee);
    const ordre = [...posees.filter(etat => etat.id !== selection), ...posees.filter(etat => etat.id === selection)].reverse();
    return ordre.find(etat => pointDansPolygone(point, contourTransforme(pieceParId(puzzle, etat.id), etat)))?.id || null;
}

function debutGlisser(evenement) {
    if (terminee || evenement.button > 0) return;
    const bouton = evenement.target.closest('.tesselle-reserve');
    const point = coordonneesPlateau(evenement);
    const id = bouton?.dataset.pieceId || (evenement.target === $('plateau') ? pieceSousPoint(point) : null);
    if (!id) return;
    const etat = etatParId(etats, id);
    selection = id;
    glisser = {
        id,
        pointeur: evenement.pointerId,
        departClientX: evenement.clientX,
        departClientY: evenement.clientY,
        original: { ...etat },
        decalage: estPosee(etat) ? { x: point.x - etat.x, y: point.y - etat.y } : { x: 0, y: 0 },
        bouge: false,
        candidat: null
    };
    evenement.preventDefault();
}

function bougerGlisser(evenement) {
    if (!glisser || evenement.pointerId !== glisser.pointeur) return;
    if (!glisser.bouge && Math.hypot(evenement.clientX - glisser.departClientX, evenement.clientY - glisser.departClientY) < 5) return;
    glisser.bouge = true;
    const point = coordonneesPlateau(evenement);
    if (!point.dedans) {
        glisser.candidat = null;
        rendreTout();
        return;
    }
    const brut = {
        ...glisser.original,
        x: point.x - glisser.decalage.x,
        y: point.y - glisser.decalage.y
    };
    const candidat = aimanter(puzzle, etats, brut);
    glisser.candidat = candidat;
    rendrePlateau(puzzle, etats, selection, { etat: candidat, invalide: !peutPlacer(puzzle, etats, candidat) }, preferences.contours);
    evenement.preventDefault();
}

function finGlisser(evenement) {
    if (!glisser || evenement.pointerId !== glisser.pointeur) return;
    const action = glisser;
    glisser = null;
    ignorerClicPlateau = true;
    setTimeout(() => { ignorerClicPlateau = false; }, 0);
    if (!action.bouge) {
        selectionner(action.id);
        return;
    }
    if (!action.candidat) {
        rendreTout();
        return refuser('Déposez la tesselle à l’intérieur de la silhouette.');
    }
    const resultat = placer(puzzle, etats, action.candidat, false);
    if (!resultat) {
        rendreTout();
        return refuser('Les formes ne peuvent ni se chevaucher ni dépasser.');
    }
    selection = action.id;
    valider(resultat.etats, 'Tesselle déposée.');
}

function poserAu(point) {
    const etat = selection && etatParId(etats, selection);
    if (!etat || terminee) return;
    const candidat = aimanter(puzzle, etats, { ...etat, x: point.x, y: point.y });
    const resultat = placer(puzzle, etats, candidat, false);
    if (!resultat) return refuser('Cette forme ne tient pas à cet endroit.');
    valider(resultat.etats, 'Tesselle déposée.');
}

async function partager() {
    const base = location.href;
    const texte = messageDePartage({ base, meta, termine: terminee, tempsMs: tempsActuel(), gestes, indices, pieces: puzzle.pieces.length });
    try {
        if (navigator.share) await navigator.share({ title: 'Mosaïcomino', text: texte });
        else {
            await navigator.clipboard.writeText(texte);
            annoncer('Le message est copié.');
        }
    } catch (erreur) {
        if (erreur?.name !== 'AbortError') refuser('Le partage n’a pas fonctionné.');
    }
}

function remplirOptions() {
    $('choix-niveau').replaceChildren(...Object.values(NIVEAUX).map(niveau => {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'niveau';
        bouton.dataset.niveau = niveau.id;
        bouton.innerHTML = `<strong>${niveau.nom}</strong><span>${niveau.description}</span><small>${niveau.pieces} formes · ${niveau.pasAngle}°${niveau.miroir ? ' · miroirs' : ''}</small>`;
        bouton.addEventListener('click', () => {
            preferences.niveau = niveau.id;
            enregistrerPreferences(preferences);
            actualiserOptions();
        });
        return bouton;
    }));
    $('choix-theme').replaceChildren(...THEMES.map(theme => {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'pastille';
        bouton.dataset.theme = theme.id;
        bouton.style.setProperty('--pastille', theme.couleur);
        bouton.setAttribute('aria-label', `Ambiance ${theme.nom}`);
        bouton.title = theme.nom;
        bouton.addEventListener('click', () => {
            preferences.theme = theme.id;
            enregistrerPreferences(preferences);
            appliquerPreferences();
            actualiserOptions();
            if (puzzle) rendreTout();
        });
        return bouton;
    }));
    actualiserOptions();
}

function actualiserOptions() {
    document.querySelectorAll('[data-niveau]').forEach(element => {
        const active = element.dataset.niveau === preferences.niveau;
        element.classList.toggle('active', active);
        element.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-theme]').forEach(element => {
        const active = element.dataset.theme === preferences.theme;
        element.classList.toggle('active', active);
        element.setAttribute('aria-pressed', String(active));
    });
}

function installerEvenements() {
    document.addEventListener('pointerdown', debutGlisser);
    window.addEventListener('pointermove', bougerGlisser, { passive: false });
    window.addEventListener('pointerup', finGlisser);
    window.addEventListener('pointercancel', finGlisser);
    document.addEventListener('click', evenement => {
        const bouton = evenement.target.closest('.tesselle-reserve');
        if (!bouton) return;
        selectionner(bouton.dataset.pieceId, evenement.detail === 0);
    });
    $('plateau').addEventListener('click', evenement => {
        if (ignorerClicPlateau) return;
        const point = coordonneesPlateau(evenement);
        const id = pieceSousPoint(point);
        if (id) selectionner(id);
        else poserAu(point);
    });

    $('rotation-gauche').addEventListener('click', () => changerAngle(-1));
    $('rotation-droite').addEventListener('click', () => changerAngle(1));
    $('retourner').addEventListener('click', retournerSelection);
    $('ranger').addEventListener('click', rangerSelection);
    $('bouton-annuler').addEventListener('click', annuler);
    $('bouton-indice').addEventListener('click', demanderIndice);
    $('bouton-partager').addEventListener('click', partager);
    $('fin-partager').addEventListener('click', partager);

    $('bouton-nouveau').addEventListener('click', () => demarrer({ graine: graineLibre(), niveau: preferences.niveau, dateJour: null, quotidien: false }));
    $('bouton-jour').addEventListener('click', () => {
        const jour = dateLocale();
        demarrer({ graine: `jour-${jour}`, niveau: NIVEAU_QUOTIDIEN, dateJour: jour, quotidien: true });
    });
    $('fin-rejouer').addEventListener('click', () => {
        $('dialogue-fin').close();
        demarrer({ graine: graineLibre(), niveau: preferences.niveau, dateJour: null, quotidien: false });
    });

    $('bouton-aide').addEventListener('click', () => $('dialogue-aide').showModal());
    $('bouton-options').addEventListener('click', () => $('dialogue-options').showModal());
    $('bouton-stats').addEventListener('click', () => {
        rendreStatistiques(chargerStatistiques());
        $('dialogue-stats').showModal();
    });
    $('options-jouer').addEventListener('click', () => {
        $('dialogue-options').close();
        demarrer({ graine: graineLibre(), niveau: preferences.niveau, dateJour: null, quotidien: false });
    });
    document.querySelectorAll('[data-fermer]').forEach(bouton => bouton.addEventListener('click', () => bouton.closest('dialog').close()));

    $('bouton-theme').addEventListener('click', () => {
        preferences.theme = themeSuivant(preferences.theme);
        enregistrerPreferences(preferences);
        appliquerPreferences();
        actualiserOptions();
        rendreTout();
        annoncer(`Ambiance ${THEMES.find(theme => theme.id === preferences.theme).nom}.`);
    });
    for (const [id, cle] of [['option-sons', 'sons'], ['option-vibration', 'vibration'], ['option-contours', 'contours']]) {
        $(id).addEventListener('change', evenement => {
            preferences[cle] = evenement.target.checked;
            enregistrerPreferences(preferences);
            appliquerPreferences();
            rendreTout();
        });
    }
    $('effacer-stats').addEventListener('click', () => {
        if (!confirm('Effacer les résultats et les séries de Mosaïcomino ?')) return;
        effacerStatistiques();
        rendreStatistiques(chargerStatistiques());
    });

    document.addEventListener('keydown', evenement => {
        if (evenement.target.closest('dialog') || /^(INPUT|SELECT|TEXTAREA)$/.test(evenement.target.tagName)) return;
        const touche = evenement.key.toLowerCase();
        if (touche === 'r') changerAngle(1);
        else if (touche === 'f') retournerSelection();
        else if (touche === 'u') annuler();
        else if (touche === 'delete' || touche === 'backspace') rangerSelection();
        else if (document.activeElement === $('plateau') && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(touche)) {
            evenement.preventDefault();
            const pas = evenement.shiftKey ? 5 : 20;
            if (touche === 'arrowleft') curseur.x = Math.max(50, curseur.x - pas);
            if (touche === 'arrowright') curseur.x = Math.min(950, curseur.x + pas);
            if (touche === 'arrowup') curseur.y = Math.max(50, curseur.y - pas);
            if (touche === 'arrowdown') curseur.y = Math.min(950, curseur.y + pas);
            rendreTout();
        } else if (document.activeElement === $('plateau') && (touche === 'enter' || touche === ' ')) {
            evenement.preventDefault();
            poserAu(curseur);
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { suspendreChrono(); sauvegarder(); }
        else lancerChrono();
    });
    window.addEventListener('resize', () => rendreTout());
    for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
        for (const zone of [$('plateau'), $('reserve')]) zone.addEventListener(type, evenement => evenement.preventDefault());
    }
}

appliquerPreferences();
remplirOptions();
installerEvenements();
preparerSon(document, () => preferences.sons);
surveillerVisibilite(document);
initialiserPartie();
$('version').textContent = `Mosaïcomino ${VERSION}`;

setInterval(() => {
    if (!puzzle) return;
    $('hud-temps').textContent = formaterTemps(tempsActuel());
    if (!terminee && Date.now() - dernierEnregistrement > 10000) sauvegarder();
}, 500);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
