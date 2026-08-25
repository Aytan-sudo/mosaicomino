// Le son — tout ce qui se vérifie sans oreille.
//
// Le piège que cette suite existe pour attraper ne lève aucune erreur et ne se
// voit pas depuis un ordinateur : une note écrite sous 300 Hz part bien, elle
// n'arrive simplement jamais. Un haut-parleur de téléphone ne restitue à peu
// près rien en dessous, et l'oreille y est de surcroît bien moins sensible à
// faible volume. Compter les notes émises ne dit donc rien de ce qui parvient à
// l'oreille : c'est leur hauteur qu'il faut relever.
//
// Le modèle (2048) relit le module au lexique, faute de pouvoir le jouer. Ici
// on peut mieux : un contexte audio factice fait tourner le vrai code et note
// ce qui en sort — rampes comprises. Le relevé à la source reste en second
// rideau, pour attraper un timbre qu'on aurait ajouté sans l'appeler ici.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compteur } from './harness.mjs';

const { check, rapport } = compteur();
console.log('\nSon\n');

// Un haut-parleur de téléphone ne descend pas plus bas. C'est la cible du
// projet : sous ce seuil, la note n'existe pas.
const PLANCHER = 300;

// Le banc d'essai : juste assez d'API WebAudio pour que `js/son.js` tourne, et
// un carnet où chaque oscillateur laisse ses hauteurs et son enveloppe.
function bancDEssai() {
    const emises = [];
    class Parametre {
        constructor(carnet) { this.carnet = carnet; }
        setValueAtTime(valeur) { this.carnet.push(valeur); return this; }
        exponentialRampToValueAtTime(valeur) { this.carnet.push(valeur); return this; }
    }
    class Contexte {
        constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
        // `note()` crée toujours l'oscillateur puis son gain : la dernière note
        // ouverte est donc bien celle que ce gain habille.
        createOscillator() {
            const note = { forme: null, hauteurs: [], gains: [], debut: null, fin: null };
            emises.push(note);
            return {
                set type(valeur) { note.forme = valeur; },
                get type() { return note.forme; },
                frequency: new Parametre(note.hauteurs),
                connect: cible => cible,
                start: temps => { note.debut = temps; },
                stop: temps => { note.fin = temps; }
            };
        }
        createGain() {
            return { gain: new Parametre(emises.at(-1).gains), connect: cible => cible };
        }
        resume() { this.state = 'running'; }
        suspend() { this.state = 'suspended'; }
    }
    globalThis.AudioContext = Contexte;
    return emises;
}

const emises = bancDEssai();
const { sonPose, sonRotation, sonRefus, sonVictoire } = await import('../js/son.js');

const jouer = son => {
    const debut = emises.length;
    son();
    return emises.slice(debut);
};

const pose = jouer(sonPose);
const rotation = jouer(sonRotation);
const refus = jouer(sonRefus);
const victoire = jouer(sonVictoire);

check('les quatre timbres sonnent', emises.length === 7, `${emises.length} notes`);

// Le cœur de la suite : plus rien, pas même une cible de rampe, ne descend
// sous le plancher.
const sous = emises.flatMap(note => note.hauteurs).filter(hauteur => hauteur < PLANCHER);
check('aucune note ne passe sous le plancher du haut-parleur',
    sous.length === 0, sous.map(hauteur => `${Math.round(hauteur)} Hz`).join(' '));

// Le refus ne dit plus non par la profondeur — qu'aucun téléphone ne
// restituerait — mais par la chute. C'est cette intention que le test garde.
check('le refus descend au lieu de s’enfoncer',
    refus.length === 1 && refus[0].hauteurs.length === 2
    && refus[0].hauteurs[0] > refus[0].hauteurs[1]
    && refus[0].hauteurs[1] >= PLANCHER,
    refus[0]?.hauteurs.join(' → '));

check('le refus part au-dessus de la pose et ne s’y confond pas',
    refus[0].hauteurs[0] > pose[0].hauteurs[0]);

// La fanfare monte : c'est ce qui la fait entendre comme une fin heureuse.
const montee = victoire.map(note => note.hauteurs[0]);
check('la victoire monte de bout en bout',
    montee.every((hauteur, rang) => rang === 0 || hauteur > montee[rang - 1]), montee.join(' '));
check('la victoire s’égrène au lieu de plaquer un accord',
    victoire.every((note, rang) => rang === 0 || note.debut > victoire[rang - 1].debut));

// La rotation se tapote en rafale : elle doit rester la plus discrète et la
// plus brève, sinon dix petits angles font dix coups de marteau.
const volume = note => Math.max(...note.gains);
const duree = note => note.fin - note.debut;
check('la rotation reste plus discrète que la pose', volume(rotation[0]) < volume(pose[0]));
check('la rotation reste plus brève que la pose', duree(rotation[0]) < duree(pose[0]));

// Second rideau : un timbre ajouté demain sans passer par cette suite serait
// invisible au banc d'essai. On relit donc aussi le module au lexique.
const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'son.js'), 'utf8');
const ecrites = [
    ...[...source.matchAll(/note\((\d+)/g)].map(([, valeur]) => Number(valeur)),
    ...[...source.matchAll(/vers:\s*(\d+)/g)].map(([, valeur]) => Number(valeur)),
    ...[...source.matchAll(/^\s*\[([\d,\s]+)\]\.forEach/gm)]
        .flatMap(([, liste]) => liste.split(',').map(Number))
];
const basses = ecrites.filter(hauteur => hauteur < PLANCHER);
check('aucune fréquence écrite dans le module ne passe sous le plancher',
    basses.length === 0, basses.join(' '));
check('les fréquences écrites ont bien été relevées', ecrites.length >= 7, String(ecrites.length));

// Le second piège du son sur téléphone : iOS ne démarre un contexte audio que
// depuis un événement d'activation. Le glissement se suit dans `pointermove`,
// qui n'en est pas un — d'où le filet posé dès le poser du doigt.
const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'app.js'), 'utf8');
check('le contexte se prépare dès le premier geste',
    source.includes("'pointerdown'") && app.includes('preparerSon(document'));
check('le son se tait quand l’onglet passe à l’arrière-plan',
    app.includes('surveillerVisibilite(document)'));

rapport();
