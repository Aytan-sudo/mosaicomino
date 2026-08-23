import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compteur } from './harness.mjs';
import { VERSION } from '../js/config.js';
import { NIVEAUX } from '../js/generateur.js';
import { THEMES } from '../js/themes.js';

const { check, rapport } = compteur();
console.log('\nPage, interface et PWA\n');
const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = chemin => readFileSync(join(racine, chemin), 'utf8');
const page = lire('index.html');
const app = lire('js/app.js');
const rendu = lire('js/rendu.js');
const styles = `${lire('css/themes.css')}\n${lire('css/style.css')}`;
const worker = lire('sw.js');
const paquet = JSON.parse(lire('package.json'));
const manifeste = JSON.parse(lire('manifest.webmanifest'));

check('les versions du paquet, du code et du cache correspondent', paquet.version === VERSION && worker.includes(`const VERSION = 'mosaicomino-${VERSION}'`));
check('la version est visible dans la page', page.includes(`Mosaïcomino ${VERSION}`));
function modulesCharges(depart) {
    const vus = new Set();
    const suite = [depart];
    while (suite.length) {
        const nom = suite.pop();
        if (vus.has(nom)) continue;
        vus.add(nom);
        for (const [, cible] of lire(`js/${nom}`).matchAll(/from\s+'\.\/([\w-]+\.js)'/g)) suite.push(cible);
    }
    return vus;
}
const modules = readdirSync(join(racine, 'js')).filter(nom => nom.endsWith('.js'));
const charges = modulesCharges('app.js');
const coquille = [...worker.matchAll(/^\s+'([^']+)',?$/gm)].map(([, chemin]) => chemin);
check('tous les modules sont utilisés et disponibles hors ligne', modules.every(nom => charges.has(nom) && coquille.includes(`js/${nom}`)));
check('toutes les ressources mises en cache existent', coquille.every(chemin => chemin === './' || existsSync(join(racine, chemin))));
const ids = [...`${app}\n${rendu}`.matchAll(/\$\('([\w-]+)'\)/g)].map(([, id]) => id);
check('tous les éléments cherchés par l’application existent', ids.every(id => page.includes(`id="${id}"`)));
check('la page utilise un canvas accessible et une application modulaire', page.includes('<canvas id="plateau"') && page.includes('<script type="module" src="js/app.js">'));
check('les trois niveaux alimentent le sélecteur dynamique', Object.keys(NIVEAUX).length === 3 && page.includes('id="choix-niveau"') && app.includes('Object.values(NIVEAUX)'));
check('les six ambiances ont une palette', THEMES.length === 6 && THEMES.slice(1).every(theme => styles.includes(`[data-theme="${theme.id}"]`)));
check('le plateau capte les gestes directs', styles.includes('#plateau') && styles.includes('touch-action: none'));
check('mobile, paysage et mouvement réduit sont traités', styles.includes('safe-area-inset-top') && styles.includes('@media (orientation: landscape)') && styles.includes('prefers-reduced-motion'));
check('le manifeste est complet', manifeste.name === 'Mosaïcomino' && manifeste.orientation === 'any' && manifeste.icons.length === 3 && manifeste.icons.every(icone => existsSync(join(racine, icone.src))));
check('le service worker est enregistré', app.includes("navigator.serviceWorker.register('./sw.js')"));
check('le déploiement attend les tests', lire('.github/workflows/pages.yml').includes('needs: tester'));

rapport();
