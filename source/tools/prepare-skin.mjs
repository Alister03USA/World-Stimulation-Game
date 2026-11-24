// Copy the original CC0 photograph unchanged; record provenance for offline distribution.
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), original = process.argv[2];
if (!original) throw new Error('Provide the downloaded original lizard_skin.png from OpenGameArt.');
const bytes = await readFile(original);
await copyFile(original, path.join(root, 'assets/reptile-skin.png'));
await writeFile(path.join(root, 'assets/appearance-sources.json'), JSON.stringify({
  texture: { file: 'reptile-skin.png', author: 'RooMan93', title: 'Reptile Skin', source: 'https://opengameart.org/content/reptile-skin', download: 'https://opengameart.org/sites/default/files/lizard_skin.png', license: 'CC0-1.0', sha256: createHash('sha256').update(bytes).digest('hex'), modification: 'Original 512px photograph-derived texture copied unchanged; runtime triplanar projection, tinting are artistic material effects.' },
  references: [
    { animal: 'Allosaurus', source: 'https://www.nps.gov/subjects/fossils/what-makes-a-dinosaur-a-dinosaur.htm', usage: 'Visual anatomy reference only; museum skeleton image not bundled.' },
    { animal: 'Ceratosaurus', source: 'https://www.nps.gov/places/ceratosaurus.htm', usage: 'Visual anatomy reference only; NPS/Walters-Kissinger reconstruction not bundled.' },
    { animal: 'Diplodocus', source: 'https://www.nhm.ac.uk/discover/dino-directory/diplodocus.html', photograph: 'https://commons.wikimedia.org/wiki/File:DiplodocusSkeleton.jpg', usage: 'Visual reference only; Ivengo(RUS) public-domain skeleton photograph not bundled.' },
    { animal: 'Cryptoclidus', source: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8684327/', citation: 'Krahl and Witzel (2021), PeerJ 9:e12537, Figure 1; skeleton photograph by G. Oleschinski.', usage: 'Visual reference only; CC BY paper figure not bundled.' }
  ], uncertainty: 'Skin colors and scale arrangement are artistic reconstructions. Modern lizard skin is a surface-detail reference, not evidence of exact dinosaur or plesiosaur skin.'
}, null, 2) + '\n');
