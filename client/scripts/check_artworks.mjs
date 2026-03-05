import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(thisDir, '..');
const cardsDbPath = path.resolve(projectRoot, '..', 'shared', 'cards_db.json');
const cardsDir = path.resolve(projectRoot, 'public', 'cards');
const artworksDir = path.resolve(projectRoot, '..', 'artworks');

// Keep aligned with client/src/ui/CardArtworkResolver.ts
const aliasByTemplate = {
  // legacy alias map: prefer canonical files named <templateId>.png
};
const sourceToTemplateMap = {
  "hero_luca.png": "emp_01",
  "hero_marco.png": "emp_07",
};

function toTemplateIds(rows) {
  const ids = rows
    .map((row) => String(row?.id ?? '').trim())
    .filter(Boolean);
  return [...new Set(ids)].sort();
}

function toImageFiles(files) {
  return files
    .filter((name) => /\.(png|webp)$/i.test(name))
    .sort((a, b) => a.localeCompare(b));
}

function toBasename(fileName) {
  return fileName.replace(/\.(png|webp)$/i, '');
}

const rawDb = await readFile(cardsDbPath, 'utf8');
const cardTemplates = JSON.parse(rawDb);
const templateIds = toTemplateIds(cardTemplates);
const cardFiles = toImageFiles(await readdir(cardsDir));
const sourceArtworkFiles = toImageFiles(await readdir(artworksDir));

const fileByTemplate = new Set(
  cardFiles
    .filter((name) => /\.png$/i.test(name))
    .map((name) => toBasename(name))
);

const validAliasTemplates = Object.entries(aliasByTemplate)
  .filter(([, fileName]) => cardFiles.includes(fileName))
  .map(([templateId]) => templateId);
const mappedFromSourceTemplates = Object.entries(sourceToTemplateMap)
  .filter(([sourceFile, templateId]) => sourceArtworkFiles.includes(sourceFile) && fileByTemplate.has(templateId))
  .map(([, templateId]) => templateId);
const coveredTemplates = new Set([...fileByTemplate, ...validAliasTemplates, ...mappedFromSourceTemplates]);

const missing = templateIds.filter((id) => !coveredTemplates.has(id));
const extras = cardFiles.filter((name) => {
  const base = toBasename(name);
  if (templateIds.includes(base)) return false;
  return !Object.values(aliasByTemplate).includes(name);
});
const unresolvedSource = sourceArtworkFiles.filter((name) => {
  if (Object.values(aliasByTemplate).includes(name)) return false;
  const mappedTemplate = sourceToTemplateMap[name];
  if (mappedTemplate && fileByTemplate.has(mappedTemplate)) return false;
  return true;
});

console.log('=== ART CHECK ===');
console.log(`Template IDs: ${templateIds.length}`);
console.log(`Image files in /public/cards: ${cardFiles.length}`);
console.log(`Image files in /artworks: ${sourceArtworkFiles.length}`);
console.log(`Alias mapped templates: ${validAliasTemplates.length}`);
console.log(`Mapped from source files: ${mappedFromSourceTemplates.length}`);
console.log('');

console.log(`Missing artworks (${missing.length}):`);
if (missing.length === 0) {
  console.log('- none');
} else {
  missing.forEach((id) => console.log(`- ${id}.png`));
}

console.log('');
console.log(`Extra non-mapped files (${extras.length}):`);
if (extras.length === 0) {
  console.log('- none');
} else {
  extras.forEach((file) => console.log(`- ${file}`));
}

console.log('');
console.log(`Unresolved source artworks (${unresolvedSource.length}):`);
if (unresolvedSource.length === 0) {
  console.log('- none');
} else {
  unresolvedSource.forEach((file) => console.log(`- ${file}`));
}
