import { compteur } from './harness.mjs';
import {
    aire, bezier, centroide, clipperDemiPlan, contourTransforme, ecartAngle,
    estContenu, inverseTransformerPoint, pointDansPolygone, polygonesSeChevauchent,
    transformerPoint
} from '../js/geometrie.js';

const { check, proche, egal, rapport } = compteur();
console.log('\nGéométrie continue\n');
const carre = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

proche('l’aire du carré est exacte', aire(carre), 100);
egal('son centre est exact', centroide(carre), { x: 5, y: 5 });
check('un point intérieur est reconnu', pointDansPolygone({ x: 4, y: 7 }, carre));
check('un point extérieur est refusé', !pointDansPolygone({ x: 14, y: 7 }, carre));
proche('un demi-plan coupe le carré en deux', aire(clipperDemiPlan(carre, 1, 0, 5)), 50);
egal('une Bézier commence sur son origine', bezier({ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 0 }, 0), { x: 0, y: 0 });

const etat = { x: 20, y: 30, angle: 90, miroir: true };
const transforme = transformerPoint({ x: 4, y: 2 }, etat);
const retour = inverseTransformerPoint(transforme, etat);
proche('la transformation inverse retrouve x', retour.x, 4);
proche('la transformation inverse retrouve y', retour.y, 2);
proche('l’écart angulaire traverse zéro', ecartAngle(355, 5), 10);

const decale = carre.map(point => ({ x: point.x + 8, y: point.y }));
const loin = carre.map(point => ({ x: point.x + 20, y: point.y }));
check('deux surfaces qui se croisent sont détectées', polygonesSeChevauchent(carre, decale, .01));
check('deux surfaces séparées ne se croisent pas', !polygonesSeChevauchent(carre, loin, .01));
check('un carré est contenu dans un carré plus grand', estContenu(carre, [{ x: -1, y: -1 }, { x: 11, y: -1 }, { x: 11, y: 11 }, { x: -1, y: 11 }]));

rapport();

