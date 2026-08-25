// Synthèse WebAudio : pas un octet d'audio dans le dépôt, quatre timbres et
// c'est tout. Le son accompagne la composition, il ne la commente pas — d'où
// des durées très courtes et un volume bas par principe.
//
// Tout vit au-dessus de 300 Hz. Un haut-parleur de téléphone ne restitue à peu
// près rien en dessous, et l'oreille y est de surcroît bien moins sensible à
// faible volume : une note écrite plus bas ne lève aucune erreur, elle part
// simplement sans arriver. Le jeu se voulant mobile d'abord, c'est un défaut et
// pas un réglage — `tests/test-son.mjs` garde le plancher.

let contexte;

function audio() {
    if (contexte) return contexte;
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (AudioContext) contexte = new AudioContext();
    return contexte;
}

function note(frequence, { duree = 0.08, volume = 0.03, delai = 0, vers = null, forme = 'triangle' } = {}) {
    const moteur = audio();
    if (!moteur) return;
    if (moteur.state === 'suspended') moteur.resume?.();

    const debut = moteur.currentTime + delai;
    const oscillateur = moteur.createOscillator();
    const gain = moteur.createGain();

    oscillateur.type = forme;
    oscillateur.frequency.setValueAtTime(frequence, debut);
    if (vers) oscillateur.frequency.exponentialRampToValueAtTime(vers, debut + duree);

    gain.gain.setValueAtTime(0.0001, debut);
    gain.gain.exponentialRampToValueAtTime(volume, debut + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree);

    oscillateur.connect(gain).connect(moteur.destination);
    oscillateur.start(debut);
    oscillateur.stop(debut + duree + 0.02);
}

// La tesselle qui trouve sa place : une note pleine, le repère du jeu.
export const sonPose = () => note(370);

// La rotation se tapote en rafale : plus haut, deux fois plus court, presque
// rien — sinon dix petits angles feraient dix petits coups de marteau.
export const sonRotation = () => note(510, { duree: 0.045, volume: 0.018 });

// Le refus disait non par la profondeur — 135 Hz, c'est-à-dire rien du tout sur
// la cible du projet, alors qu'il s'entendait parfaitement sur un ordinateur.
// Il le dit maintenant par la chute : la note part au-dessus de la pose et
// retombe au ras du plancher. C'est le mouvement qui porte le sens, et le
// mouvement, lui, survit au haut-parleur d'un téléphone.
export const sonRefus = () => note(400, { duree: 0.09, volume: 0.024, vers: 310, forme: 'sine' });

// La seule fanfare : quatre notes qui montent, la composition est close.
export function sonVictoire() {
    [330, 440, 554, 659].forEach((frequence, rang) => note(frequence, { duree: 0.18, delai: rang * 0.08 }));
}

// Le déblocage au geste.
//
// iOS ne laisse démarrer un contexte audio que depuis un événement
// d'activation : `pointerdown`, `touchstart`, `pointerup`, `touchend`,
// `keydown`, `click`. Mosaïcomino y échappe aujourd'hui — poser une tesselle se
// conclut sur `pointerup`, tourner sur un `click` — mais le glissement, lui, se
// suit dans `pointermove`, qui n'est pas une activation : il suffirait qu'un
// son y naisse un jour pour que le jeu devienne muet au doigt, sans lever la
// moindre erreur ni se voir depuis un ordinateur. Le contexte se prépare donc
// dès le poser, avant que le jeu n'ait une note à demander.
// `autorise` évite d'ouvrir un contexte audio chez qui a coupé le son.
const ACTIVATIONS = ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'keydown', 'click'];

export function preparerSon(cible, autorise = () => true) {
    const reveiller = () => {
        if (!autorise()) return;
        const moteur = audio();
        if (moteur && moteur.state !== 'running') moteur.resume?.();
    };
    for (const activation of ACTIVATIONS) {
        cible.addEventListener(activation, reveiller, { capture: true, passive: true });
    }
}

// Un jeu ne chante pas dans le dos de qui est parti lire ailleurs.
export function surveillerVisibilite(document) {
    document.addEventListener('visibilitychange', () => {
        if (!contexte) return;
        if (document.hidden) contexte.suspend?.();
        else contexte.resume?.();
    });
}
