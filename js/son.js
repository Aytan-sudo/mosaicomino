let audio;

function note(frequence, duree = 0.08, delai = 0, volume = 0.03) {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return;
    audio ||= new AudioContext();
    const debut = audio.currentTime + delai;
    const oscillateur = audio.createOscillator();
    const gain = audio.createGain();
    oscillateur.type = 'triangle';
    oscillateur.frequency.setValueAtTime(frequence, debut);
    gain.gain.setValueAtTime(0.0001, debut);
    gain.gain.exponentialRampToValueAtTime(volume, debut + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
    oscillateur.connect(gain).connect(audio.destination);
    oscillateur.start(debut);
    oscillateur.stop(debut + duree + 0.02);
}

export const sonPose = () => note(370);
export const sonRotation = () => note(510, 0.045, 0, 0.018);
export const sonRefus = () => note(135, 0.11, 0, 0.02);
export function sonVictoire() { [330, 440, 554, 659].forEach((frequence, index) => note(frequence, 0.18, index * 0.08)); }

